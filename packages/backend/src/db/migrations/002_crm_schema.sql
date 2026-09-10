-- Nature's Crates CRM v1: Order Recovery + Corporate/Festive Gifting
CREATE TABLE IF NOT EXISTS crm_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30), email VARCHAR(200), role VARCHAR(30) NOT NULL DEFAULT 'employee',
  employment_status VARCHAR(30) NOT NULL DEFAULT 'active',
  employment_start_date DATE,
  employment_end_date DATE,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  daily_capacity INTEGER NOT NULL DEFAULT 30 CHECK (daily_capacity > 0),
  commission_plan_id UUID,
  auth_user_id VARCHAR(200) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_commission_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(200) NOT NULL,
  effective_from DATE NOT NULL, effective_to DATE, status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS crm_commission_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), commission_plan_id UUID NOT NULL REFERENCES crm_commission_plans(id),
  min_order_value NUMERIC(12,2) NOT NULL DEFAULT 0, max_order_value NUMERIC(12,2),
  commission_amount NUMERIC(12,2) NOT NULL, condition VARCHAR(80) NOT NULL DEFAULT 'CALLED_AND_CONFIRMED',
  UNIQUE(commission_plan_id,min_order_value)
);
ALTER TABLE crm_employees ADD CONSTRAINT fk_crm_employee_plan FOREIGN KEY (commission_plan_id) REFERENCES crm_commission_plans(id);

CREATE TABLE IF NOT EXISTS crm_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), external_customer_id VARCHAR(100), name VARCHAR(200) NOT NULL,
  normalized_phone VARCHAR(30), phone VARCHAR(30), alternate_phone VARCHAR(30), email VARCHAR(200),
  address_line_1 TEXT, address_line_2 TEXT, city VARCHAR(100), state VARCHAR(100), pincode VARCHAR(15),
  first_order_at TIMESTAMPTZ, last_order_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_crm_customer_phone ON crm_customers(normalized_phone) WHERE normalized_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), external_order_id VARCHAR(100) UNIQUE NOT NULL,
  customer_id UUID REFERENCES crm_customers(id), order_date TIMESTAMPTZ, order_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20), payment_status VARCHAR(30), order_status VARCHAR(40), shopdeck_status VARCHAR(100),
  delivery_status VARCHAR(100), final_status VARCHAR(20), final_status_at TIMESTAMPTZ, final_status_source VARCHAR(30),
  is_cod BOOLEAN NOT NULL DEFAULT FALSE, is_rto_risk BOOLEAN NOT NULL DEFAULT FALSE,
  awb VARCHAR(100), courier_partner VARCHAR(100), import_batch_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_orders_queue ON crm_orders(final_status,order_status,is_cod,order_date DESC);
CREATE INDEX IF NOT EXISTS idx_crm_orders_awb ON crm_orders(awb) WHERE awb IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), order_id UUID NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
  sku VARCHAR(150), product_name VARCHAR(500), quantity INTEGER NOT NULL DEFAULT 1, unit_price NUMERIC(12,2) DEFAULT 0, line_value NUMERIC(12,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_crm_order_items_order ON crm_order_items(order_id);

CREATE TABLE IF NOT EXISTS crm_call_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), order_id UUID NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES crm_employees(id), assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), assigned_by VARCHAR(200),
  assignment_type VARCHAR(20) NOT NULL DEFAULT 'AUTO', assignment_status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
  due_date DATE, completed_at TIMESTAMPTZ, reassigned_from UUID REFERENCES crm_call_assignments(id), reassignment_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_crm_active_assignment ON crm_call_assignments(order_id) WHERE assignment_status IN ('ASSIGNED','IN_PROGRESS');
CREATE INDEX IF NOT EXISTS idx_crm_assignment_employee ON crm_call_assignments(employee_id,assignment_status,due_date);

CREATE TABLE IF NOT EXISTS crm_call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), order_id UUID NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES crm_employees(id), assignment_id UUID REFERENCES crm_call_assignments(id),
  call_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), call_completed_at TIMESTAMPTZ,
  call_outcome VARCHAR(40) NOT NULL, notes TEXT, customer_commitment_date TIMESTAMPTZ, next_followup_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_calls_order ON crm_call_logs(order_id,call_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_calls_employee ON crm_call_logs(employee_id,call_started_at DESC);

CREATE TABLE IF NOT EXISTS crm_order_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), order_id UUID NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
  final_status VARCHAR(20) NOT NULL, settlement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), settlement_source VARCHAR(30) NOT NULL,
  updated_by VARCHAR(200), notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_crm_settlement_order ON crm_order_settlements(order_id);

CREATE TABLE IF NOT EXISTS crm_commission_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), employee_id UUID NOT NULL REFERENCES crm_employees(id), order_id UUID NOT NULL REFERENCES crm_orders(id),
  call_log_id UUID REFERENCES crm_call_logs(id), commission_plan_id UUID REFERENCES crm_commission_plans(id), commission_rule_id UUID REFERENCES crm_commission_rules(id),
  order_value NUMERIC(12,2) NOT NULL DEFAULT 0, final_status VARCHAR(20), eligible BOOLEAN NOT NULL DEFAULT FALSE, eligibility_reason TEXT,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0, earned_date DATE, payout_month DATE, status VARCHAR(20) NOT NULL DEFAULT 'EARNED',
  approved_by VARCHAR(200), approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_commission_employee ON crm_commission_ledger(employee_id,payout_month,status);

CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), company_name VARCHAR(300) NOT NULL, contact_name VARCHAR(200), designation VARCHAR(150),
  phone VARCHAR(30), email VARCHAR(200), lead_type VARCHAR(50) NOT NULL DEFAULT 'CORPORATE', source VARCHAR(100), city VARCHAR(100), industry VARCHAR(100), company_size VARCHAR(50),
  assigned_employee_id UUID REFERENCES crm_employees(id), lead_status VARCHAR(40) NOT NULL DEFAULT 'LEAD', estimated_deal_value NUMERIC(12,2) DEFAULT 0,
  expected_close_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner ON crm_leads(assigned_employee_id,lead_status);

CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE, assigned_employee_id UUID REFERENCES crm_employees(id),
  deal_name VARCHAR(300) NOT NULL, stage VARCHAR(40) NOT NULL DEFAULT 'LEAD', quoted_value NUMERIC(12,2) DEFAULT 0, expected_value NUMERIC(12,2) DEFAULT 0,
  won_value NUMERIC(12,2) DEFAULT 0, expected_close_date DATE, actual_close_date DATE, probability NUMERIC(5,2) DEFAULT 0,
  lost_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage,expected_close_date);

CREATE TABLE IF NOT EXISTS crm_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE, deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES crm_employees(id), due_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ, activity_type VARCHAR(30) NOT NULL DEFAULT 'CALL', outcome VARCHAR(100), notes TEXT,
  next_followup_at TIMESTAMPTZ, status VARCHAR(20) NOT NULL DEFAULT 'OPEN', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_followups_due ON crm_followups(employee_id,status,due_at);

CREATE TABLE IF NOT EXISTS crm_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), employee_id UUID NOT NULL REFERENCES crm_employees(id), attendance_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ, check_out_at TIMESTAMPTZ, status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
  UNIQUE(employee_id,attendance_date)
);

CREATE TABLE IF NOT EXISTS crm_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), file_name VARCHAR(500) NOT NULL, source VARCHAR(50) NOT NULL DEFAULT 'SHOPDECK', uploaded_by VARCHAR(200), uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_rows INTEGER DEFAULT 0, created_count INTEGER DEFAULT 0, updated_count INTEGER DEFAULT 0, skipped_count INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), actor_id VARCHAR(200), action VARCHAR(100) NOT NULL, entity_type VARCHAR(100) NOT NULL, entity_id VARCHAR(100),
  old_value JSONB, new_value JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_audit_entity ON crm_audit_logs(entity_type,entity_id,created_at DESC);

INSERT INTO crm_commission_plans(name,effective_from,status)
SELECT 'Standard Recovery Commission', CURRENT_DATE, 'active'
WHERE NOT EXISTS (SELECT 1 FROM crm_commission_plans WHERE name='Standard Recovery Commission');
INSERT INTO crm_commission_rules(commission_plan_id,min_order_value,max_order_value,commission_amount,condition)
SELECT p.id,0,999.99,20,'CALLED_AND_CONFIRMED'
FROM crm_commission_plans p WHERE p.name='Standard Recovery Commission'
AND NOT EXISTS (SELECT 1 FROM crm_commission_rules r WHERE r.commission_plan_id=p.id AND r.min_order_value=0);
INSERT INTO crm_commission_rules(commission_plan_id,min_order_value,max_order_value,commission_amount,condition)
SELECT p.id,1000,NULL,30,'CALLED_AND_CONFIRMED'
FROM crm_commission_plans p WHERE p.name='Standard Recovery Commission'
AND NOT EXISTS (SELECT 1 FROM crm_commission_rules r WHERE r.commission_plan_id=p.id AND r.min_order_value=1000);
