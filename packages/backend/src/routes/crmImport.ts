import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { transaction } from '../db/pool';

const router = Router();
const rowSchema=z.object({orderId:z.string().min(1),orderDate:z.string().optional(),orderStatus:z.string().optional(),productName:z.string().optional(),sku:z.string().optional(),quantity:z.coerce.number().optional(),paymentMode:z.string().optional(),sellingPrice:z.coerce.number().optional(),amountToCollect:z.coerce.number().optional(),customerName:z.string().optional(),customerNumber:z.string().optional(),customerAddress:z.string().optional(),city:z.string().optional(),state:z.string().optional(),pincode:z.string().optional(),awb:z.string().optional(),courierPartner:z.string().optional(),callStatus:z.string().optional(),callRemarks:z.string().optional()});

const phone=(value?:string)=>{const digits=(value||'').replace(/\D/g,''); return digits ? digits.slice(-10) : null;};
const isCod=(value?:string)=>/cod|cash/i.test(value||'');

router.post('/orders',async(req:Request,res:Response)=>{
  const body=z.object({fileName:z.string().min(1).max(500),rows:z.array(rowSchema).min(1).max(10000)}).parse(req.body);
  const result=await transaction(async client=>{
    const batch=(await client.query(`INSERT INTO crm_import_batches(file_name,source,uploaded_by,total_rows,status) VALUES($1,'SHOPDECK',$2,$3,'PROCESSING') RETURNING id`,[body.fileName,req.auth?.userId||'unknown',body.rows.length])).rows[0];
    let created=0,updated=0,skipped=0,errors=0;
    for(const row of body.rows){
      try{
        const normalized=phone(row.customerNumber);
        let customer:any=null;
        if(normalized) customer=(await client.query(`SELECT id FROM crm_customers WHERE normalized_phone=$1 LIMIT 1`,[normalized])).rows[0];
        if(!customer) customer=(await client.query(`INSERT INTO crm_customers(name,normalized_phone,phone,address_line_1,city,state,pincode) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[row.customerName||'Unknown',normalized,row.customerNumber||null,row.customerAddress||null,row.city||null,row.state||null,row.pincode||null])).rows[0];
        const existing=(await client.query(`SELECT id FROM crm_orders WHERE external_order_id=$1`,[row.orderId])).rows[0];
        const orderValue=Number(row.sellingPrice ?? row.amountToCollect ?? 0)||0;
        const cod=isCod(row.paymentMode);
        const status=row.orderStatus||'IMPORTED';
        let order:any;
        if(existing){
          order=(await client.query(`UPDATE crm_orders SET customer_id=$1,order_date=$2,order_value=$3,payment_method=$4,order_status=$5,shopdeck_status=$5,awb=$6,courier_partner=$7,is_cod=$8,updated_at=NOW(),import_batch_id=$9 WHERE id=$10 RETURNING id`,[customer.id,row.orderDate||null,orderValue,row.paymentMode||null,status,row.awb||null,row.courierPartner||null,cod,batch.id,existing.id])).rows[0];
          updated++;
        }else{
          order=(await client.query(`INSERT INTO crm_orders(external_order_id,customer_id,order_date,order_value,payment_method,order_status,shopdeck_status,awb,courier_partner,is_cod,import_batch_id) VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10) RETURNING id`,[row.orderId,customer.id,row.orderDate||null,orderValue,row.paymentMode||null,status,row.awb||null,row.courierPartner||null,cod,batch.id])).rows[0];
          created++;
        }
        if(row.productName) await client.query(`INSERT INTO crm_order_items(order_id,sku,product_name,quantity,unit_price,line_value) VALUES($1,$2,$3,$4,$5,$6)`,[order.id,row.sku||null,row.productName,row.quantity||1,row.sellingPrice||0,(row.sellingPrice||0)*(row.quantity||1)]);
      }catch{errors++;}
    }
    await client.query(`UPDATE crm_import_batches SET created_count=$1,updated_count=$2,skipped_count=$3,error_count=$4,status=$5 WHERE id=$6`,[created,updated,skipped,errors,errors?'COMPLETED_WITH_ERRORS':'COMPLETED',batch.id]);
    return {batchId:batch.id,totalRows:body.rows.length,created,updated,skipped,errors};
  });
  res.status(201).json({success:true,data:result});
});
export default router;
