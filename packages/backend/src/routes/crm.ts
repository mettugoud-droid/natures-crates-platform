import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, transaction } from '../db/pool';

const router = Router();
const outcomeSchema = z.enum(['CONFIRMED','RESCHEDULED','NO_ANSWER','CANCELLED','WRONG_NUMBER','CUSTOMER_DECLINED','CALL_BACK_REQUESTED']);

router.get('/dashboard', async (_req: Request, res: Response) => {
  const [kpis, employees, pipeline] = await Promise.all([
    query<any>(`SELECT COUNT(*) FILTER (WHERE is_cod AND final_status IS NULL) AS open_cod,
      COUNT(*) FILTER (WHERE is_cod AND order_status IN ('READY_TO_SHIP','READY TO SHIP')) AS ready_to_ship,
      COUNT(*) FILTER (WHERE is_cod AND order_status ILIKE '%NDR%') AS ndr,
      COUNT(*) FILTER (WHERE is_cod AND (is_rto_risk OR order_status ILIKE '%RTO%')) AS rto_risk,
      COUNT(*) FILTER (WHERE final_status='DELIVERED') AS delivered,
      COUNT(*) FILTER (WHERE final_status='RTO') AS rto,
      COALESCE(SUM(order_value) FILTER (WHERE final_status='DELIVERED'),0) AS delivered_value,
      COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('EARNED','APPROVED','PAID')),0) AS commission
      FROM crm_orders o LEFT JOIN crm_commission_ledger c ON c.order_id=o.id`),
    query<any>(`SELECT e.id,e.employee_code,e.name,e.daily_capacity,
      COUNT(a.id) FILTER (WHERE a.assignment_status IN ('ASSIGNED','IN_PROGRESS')) AS open_queue,
      COUNT(c.id) AS calls,
      COUNT(c.id) FILTER (WHERE c.call_outcome='CONFIRMED') AS confirmed,
      COUNT(o.id) FILTER (WHERE o.final_status='DELIVERED') AS delivered,
      COUNT(o.id) FILTER (WHERE o.final_status='RTO') AS rto,
      COALESCE(SUM(cl.commission_amount),0) AS commission
      FROM crm_employees e
      LEFT JOIN crm_call_assignments a ON a.employee_id=e.id
      LEFT JOIN crm_call_logs c ON c.employee_id=e.id
      LEFT JOIN crm_orders o ON o.id=c.order_id
      LEFT JOIN crm_commission_ledger cl ON cl.employee_id=e.id
      GROUP BY e.id ORDER BY calls DESC`),
    query<any>(`SELECT stage,COUNT(*)::int AS deals,COALESCE(SUM(CASE WHEN stage='WON' THEN won_value ELSE expected_value END),0) AS value
      FROM crm_deals GROUP BY stage ORDER BY stage`),
  ]);
  const k = kpis[0] || {};
  const settledCalled = await query<any>(`SELECT COUNT(*) FILTER (WHERE o.final_status='RTO')::int AS rto,
      COUNT(*)::int AS settled FROM crm_orders o WHERE o.final_status IS NOT NULL AND EXISTS
      (SELECT 1 FROM crm_call_logs c WHERE c.order_id=o.id)`);
  const settledUncalled = await query<any>(`SELECT COUNT(*) FILTER (WHERE o.final_status='RTO')::int AS rto,
      COUNT(*)::int AS settled FROM crm_orders o WHERE o.final_status IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM crm_call_logs c WHERE c.order_id=o.id)`);
  const rate = (x:any) => x.settled ? Number(((x.rto / x.settled) * 100).toFixed(1)) : 0;
  res.json({ success:true, data:{ ...k, calledRtoPct:rate(settledCalled[0]||{}), uncalledRtoPct:rate(settledUncalled[0]||{}), employees, pipeline } });
});

router.get('/orders', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const params:any[]=[]; const where:string[]=[];
  if(search){ params.push(`%${search}%`); where.push(`(o.external_order_id ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`); }
  if(status){ params.push(status); where.push(`COALESCE(o.final_status,o.order_status) = $${params.length}`); }
  params.push(limit);
  const rows=await query<any>(`SELECT o.id,o.external_order_id,o.order_date,o.order_value,o.payment_method,o.order_status,o.shopdeck_status,o.final_status,o.awb,o.courier_partner,
    c.name AS customer_name,c.phone AS customer_phone,c.city,c.state,
    e.name AS assigned_employee,
    (SELECT COUNT(*) FROM crm_call_logs x WHERE x.order_id=o.id)::int AS call_count,
    (SELECT x.call_outcome FROM crm_call_logs x WHERE x.order_id=o.id ORDER BY x.call_started_at DESC LIMIT 1) AS last_call_outcome
    FROM crm_orders o LEFT JOIN crm_customers c ON c.id=o.customer_id LEFT JOIN crm_call_assignments a ON a.order_id=o.id AND a.assignment_status IN ('ASSIGNED','IN_PROGRESS') LEFT JOIN crm_employees e ON e.id=a.employee_id
    ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY o.order_date DESC NULLS LAST LIMIT $${params.length}`,params);
  res.json({success:true,data:rows});
});

router.post('/orders/:id/calls', async (req: Request, res: Response) => {
  const input=z.object({employeeId:z.string().uuid(),assignmentId:z.string().uuid().optional(),callOutcome:outcomeSchema,notes:z.string().max(5000).optional(),nextFollowupAt:z.string().datetime().optional()}).parse(req.body);
  const rows=await transaction(async client=>{
    const result=await client.query(`INSERT INTO crm_call_logs(order_id,employee_id,assignment_id,call_outcome,notes,next_followup_at,call_completed_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,[req.params.id,input.employeeId,input.assignmentId||null,input.callOutcome,input.notes||null,input.nextFollowupAt||null]);
    await client.query(`UPDATE crm_call_assignments SET assignment_status='COMPLETED',completed_at=NOW() WHERE id=$1`,[input.assignmentId||null]);
    if(input.callOutcome==='CONFIRMED') await client.query(`UPDATE crm_orders SET order_status='CONFIRMED',updated_at=NOW() WHERE id=$1`,[req.params.id]);
    return result.rows;
  });
  res.status(201).json({success:true,data:rows[0]});
});

router.post('/orders/:id/settlement', async (req: Request, res: Response) => {
  const input=z.object({finalStatus:z.enum(['DELIVERED','RTO','CANCELLED']),source:z.string().default('MANUAL'),notes:z.string().optional()}).parse(req.body);
  const result=await transaction(async client=>{
    const order=await client.query(`UPDATE crm_orders SET final_status=$1,final_status_at=NOW(),final_status_source=$2,updated_at=NOW() WHERE id=$3 RETURNING *`,[input.finalStatus,input.source,req.params.id]);
    await client.query(`INSERT INTO crm_order_settlements(order_id,final_status,settlement_source,updated_by,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_id) DO UPDATE SET final_status=EXCLUDED.final_status,settlement_date=NOW(),settlement_source=EXCLUDED.settlement_source,notes=EXCLUDED.notes`,[req.params.id,input.finalStatus,input.source,'crm-user',input.notes||null]);
    if(input.finalStatus==='DELIVERED'){
      const caller=await client.query(`SELECT c.id,c.employee_id FROM crm_call_logs c WHERE c.order_id=$1 AND c.call_outcome='CONFIRMED' ORDER BY c.call_started_at ASC LIMIT 1`,[req.params.id]);
      if(caller.rows[0]){
        const o=order.rows[0];
        const rule=await client.query(`SELECT r.* FROM crm_commission_rules r JOIN crm_commission_plans p ON p.id=r.commission_plan_id WHERE p.status='active' AND r.min_order_value <= $1 AND (r.max_order_value IS NULL OR r.max_order_value >= $1) ORDER BY r.min_order_value DESC LIMIT 1`,[o.order_value]);
        if(rule.rows[0]) await client.query(`INSERT INTO crm_commission_ledger(employee_id,order_id,call_log_id,commission_plan_id,commission_rule_id,order_value,final_status,eligible,eligibility_reason,commission_amount,earned_date,payout_month) VALUES($1,$2,$3,$4,$5,$6,'DELIVERED',TRUE,'CALLED_AND_CONFIRMED',$7,CURRENT_DATE,date_trunc('month',CURRENT_DATE)::date) ON CONFLICT DO NOTHING`,[caller.rows[0].employee_id,req.params.id,caller.rows[0].id,rule.rows[0].commission_plan_id,rule.rows[0].id,o.order_value,rule.rows[0].commission_amount]);
      }
    }
    return order.rows[0];
  });
  res.json({success:true,data:result});
});

export default router;
