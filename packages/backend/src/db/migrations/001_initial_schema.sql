-- =====================================================
-- Nature's Crates Platform - Database Schema
-- AI-Powered Product Discovery & Margin Intelligence
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- PRODUCTS
-- =====================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(500) NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(200),
  brand VARCHAR(200),
  description TEXT,
  selling_price DECIMAL(12, 2) NOT NULL,
  cost_price DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'INR',
  images TEXT[] DEFAULT '{}',
  
  -- Source
  source_marketplace VARCHAR(50) NOT NULL,
  source_url TEXT,
  asin VARCHAR(20),
  flipkart_pid VARCHAR(50),
  
  -- Metrics
  rating DECIMAL(3, 2),
  reviews_count INTEGER DEFAULT 0,
  estimated_monthly_sales INTEGER,
  growth_rate DECIMAL(8, 2),
  competition_score INTEGER CHECK (competition_score >= 0 AND competition_score <= 100),
  opportunity_score INTEGER CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  
  -- Data Quality
  confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  freshness_score INTEGER DEFAULT 100 CHECK (freshness_score >= 0 AND freshness_score <= 100),
  source_reliability_score INTEGER DEFAULT 50 CHECK (source_reliability_score >= 0 AND source_reliability_score <= 100),
  
  -- Flags
  is_white_label_candidate BOOLEAN DEFAULT FALSE,
  is_private_label_candidate BOOLEAN DEFAULT FALSE,
  is_duplicate BOOLEAN DEFAULT FALSE,
  is_outdated BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_marketplace ON products(source_marketplace);
CREATE INDEX idx_products_opportunity ON products(opportunity_score DESC);
CREATE INDEX idx_products_asin ON products(asin) WHERE asin IS NOT NULL;
CREATE INDEX idx_products_flipkart ON products(flipkart_pid) WHERE flipkart_pid IS NOT NULL;
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_white_label ON products(is_white_label_candidate) WHERE is_white_label_candidate = TRUE;
CREATE INDEX idx_products_created ON products(created_at DESC);

-- =====================================================
-- PRODUCT TRENDS (Historical pricing/ranking data)
-- =====================================================

CREATE TABLE product_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price DECIMAL(12, 2),
  sales_estimate INTEGER,
  ranking INTEGER,
  reviews_count INTEGER,
  rating DECIMAL(3, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, date)
);

CREATE INDEX idx_trends_product_date ON product_trends(product_id, date DESC);

-- =====================================================
-- SUPPLIERS / MANUFACTURERS
-- =====================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(500) NOT NULL,
  company_type VARCHAR(50) NOT NULL, -- manufacturer, wholesaler, trader, exporter
  
  -- Location
  city VARCHAR(200),
  state VARCHAR(200),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(10),
  full_address TEXT,
  
  -- Contact
  phone VARCHAR(50),
  email VARCHAR(200),
  website VARCHAR(500),
  contact_person VARCHAR(200),
  
  -- Capabilities
  oem_available BOOLEAN DEFAULT FALSE,
  white_label_available BOOLEAN DEFAULT FALSE,
  private_label_available BOOLEAN DEFAULT FALSE,
  custom_packaging_available BOOLEAN DEFAULT FALSE,
  contract_manufacturing BOOLEAN DEFAULT FALSE,
  
  -- Terms
  moq INTEGER,
  lead_time_days INTEGER,
  payment_terms TEXT[] DEFAULT '{}',
  
  -- Verification
  gst_registered BOOLEAN DEFAULT FALSE,
  gst_number VARCHAR(20),
  certifications TEXT[] DEFAULT '{}',
  year_established INTEGER,
  annual_turnover VARCHAR(100),
  employee_count VARCHAR(50),
  
  -- Scores
  trust_score INTEGER DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
  verification_status VARCHAR(30) DEFAULT 'unverified',
  
  -- Source
  source_directory VARCHAR(50) NOT NULL,
  source_url TEXT,
  
  -- Products
  product_categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_suppliers_trust ON suppliers(trust_score DESC);
CREATE INDEX idx_suppliers_type ON suppliers(company_type);
CREATE INDEX idx_suppliers_state ON suppliers(state);
CREATE INDEX idx_suppliers_oem ON suppliers(oem_available) WHERE oem_available = TRUE;
CREATE INDEX idx_suppliers_white_label ON suppliers(white_label_available) WHERE white_label_available = TRUE;
CREATE INDEX idx_suppliers_name_trgm ON suppliers USING gin(name gin_trgm_ops);

-- =====================================================
-- SUPPLIER VERIFICATIONS
-- =====================================================

CREATE TABLE supplier_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  gst_verified BOOLEAN DEFAULT FALSE,
  business_legitimacy VARCHAR(30) DEFAULT 'unverified',
  manufacturing_capacity VARCHAR(30) DEFAULT 'unknown',
  export_capable BOOLEAN DEFAULT FALSE,
  oem_capable BOOLEAN DEFAULT FALSE,
  packaging_capable BOOLEAN DEFAULT FALSE,
  
  certifications JSONB DEFAULT '[]',
  overall_score INTEGER DEFAULT 0,
  
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_by VARCHAR(200) DEFAULT 'system',
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_verifications_supplier ON supplier_verifications(supplier_id);

-- =====================================================
-- SUPPLIER QUOTES
-- =====================================================

CREATE TABLE supplier_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  price_per_unit DECIMAL(12, 2) NOT NULL,
  moq INTEGER NOT NULL,
  lead_time_days INTEGER,
  packaging_included BOOLEAN DEFAULT FALSE,
  custom_branding BOOLEAN DEFAULT FALSE,
  valid_until DATE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quotes_supplier ON supplier_quotes(supplier_id);
CREATE INDEX idx_quotes_product ON supplier_quotes(product_id);

-- =====================================================
-- MARGIN ANALYSES
-- =====================================================

CREATE TABLE margin_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Revenue
  selling_price DECIMAL(12, 2) NOT NULL,
  
  -- Costs
  product_cost DECIMAL(12, 2) DEFAULT 0,
  manufacturing_cost DECIMAL(12, 2) DEFAULT 0,
  packaging_cost DECIMAL(12, 2) DEFAULT 0,
  branding_cost DECIMAL(12, 2) DEFAULT 0,
  shipping_cost DECIMAL(12, 2) DEFAULT 0,
  gst DECIMAL(12, 2) DEFAULT 0,
  gst_rate DECIMAL(5, 2) DEFAULT 0,
  marketing_cost DECIMAL(12, 2) DEFAULT 0,
  return_cost DECIMAL(12, 2) DEFAULT 0,
  marketplace_fees DECIMAL(12, 2) DEFAULT 0,
  marketplace_fee_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Calculated
  total_cost DECIMAL(12, 2) NOT NULL,
  gross_profit DECIMAL(12, 2) NOT NULL,
  gross_margin_percent DECIMAL(8, 2) NOT NULL,
  net_profit DECIMAL(12, 2) NOT NULL,
  net_margin_percent DECIMAL(8, 2) NOT NULL,
  roi DECIMAL(8, 2) NOT NULL,
  break_even_units INTEGER NOT NULL,
  recommended_selling_price DECIMAL(12, 2),
  
  -- Flags
  meets_gross_margin_target BOOLEAN DEFAULT FALSE,
  meets_net_margin_target BOOLEAN DEFAULT FALSE,
  
  -- Assumptions
  assumptions JSONB DEFAULT '{}',
  confidence VARCHAR(20) DEFAULT 'medium',
  
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_margins_product ON margin_analyses(product_id);
CREATE INDEX idx_margins_gross ON margin_analyses(gross_margin_percent DESC);
CREATE INDEX idx_margins_net ON margin_analyses(net_margin_percent DESC);
CREATE INDEX idx_margins_meets_target ON margin_analyses(meets_gross_margin_target, meets_net_margin_target);

-- =====================================================
-- WHITE LABEL OPPORTUNITIES
-- =====================================================

CREATE TABLE white_label_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Scoring (0-100)
  demand_score INTEGER DEFAULT 0,
  competition_score INTEGER DEFAULT 0,
  margin_score INTEGER DEFAULT 0,
  manufacturing_ease_score INTEGER DEFAULT 0,
  repeat_purchase_score INTEGER DEFAULT 0,
  branding_potential_score INTEGER DEFAULT 0,
  regulatory_complexity_score INTEGER DEFAULT 0,
  
  -- Overall
  opportunity_score INTEGER NOT NULL CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  classification VARCHAR(30) NOT NULL, -- excellent, good, moderate, avoid
  
  -- Types
  opportunity_types TEXT[] DEFAULT '{}',
  
  -- AI Analysis
  reasoning TEXT,
  risks TEXT[] DEFAULT '{}',
  improvements TEXT[] DEFAULT '{}',
  branding_opportunities TEXT[] DEFAULT '{}',
  expected_monthly_revenue DECIMAL(12, 2),
  
  -- Metadata
  ai_model VARCHAR(100),
  confidence VARCHAR(20) DEFAULT 'medium',
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_opportunities_product ON white_label_opportunities(product_id);
CREATE INDEX idx_opportunities_score ON white_label_opportunities(opportunity_score DESC);
CREATE INDEX idx_opportunities_classification ON white_label_opportunities(classification);

-- =====================================================
-- LAUNCH RECOMMENDATIONS
-- =====================================================

CREATE TABLE launch_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES white_label_opportunities(id),
  
  should_launch BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  expected_profit DECIMAL(12, 2),
  
  recommended_channels TEXT[] DEFAULT '{}',
  recommended_price DECIMAL(12, 2),
  estimated_investment DECIMAL(12, 2),
  estimated_time_to_market INTEGER, -- days
  
  priority VARCHAR(20) DEFAULT 'medium',
  
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recommendations_product ON launch_recommendations(product_id);
CREATE INDEX idx_recommendations_launch ON launch_recommendations(should_launch, priority);

-- =====================================================
-- PRODUCT BUNDLES
-- =====================================================

CREATE TABLE product_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(300) NOT NULL,
  description TEXT,
  bundle_type VARCHAR(50) NOT NULL,
  
  -- Financials
  total_cost DECIMAL(12, 2) DEFAULT 0,
  recommended_price DECIMAL(12, 2) DEFAULT 0,
  bundle_margin DECIMAL(8, 2) DEFAULT 0,
  bundle_roi DECIMAL(8, 2) DEFAULT 0,
  aov_increase DECIMAL(8, 2) DEFAULT 0,
  
  -- Targeting
  target_channels TEXT[] DEFAULT '{}',
  seasonality TEXT[] DEFAULT '{}',
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE bundle_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id UUID NOT NULL REFERENCES product_bundles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  unit_cost DECIMAL(12, 2) DEFAULT 0,
  
  UNIQUE(bundle_id, product_id)
);

CREATE INDEX idx_bundle_products_bundle ON bundle_products(bundle_id);

-- =====================================================
-- COMPETITORS
-- =====================================================

CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(300) NOT NULL,
  brand VARCHAR(200),
  competitor_type VARCHAR(50) NOT NULL,
  website VARCHAR(500),
  marketplaces TEXT[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  estimated_revenue VARCHAR(100),
  
  pricing_strategy VARCHAR(30),
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  unique_selling_points TEXT[] DEFAULT '{}',
  
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE competitor_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  competitor_price DECIMAL(12, 2),
  competitor_rating DECIMAL(3, 2),
  competitor_reviews INTEGER DEFAULT 0,
  competitor_sales INTEGER,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(competitor_id, product_id)
);

CREATE INDEX idx_comp_products_competitor ON competitor_products(competitor_id);

-- =====================================================
-- MARKET RISKS
-- =====================================================

CREATE TABLE market_risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  risk_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  mitigation TEXT,
  classification VARCHAR(30) NOT NULL, -- safe_to_launch, review_required, avoid
  
  identified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_risks_product ON market_risks(product_id);
CREATE INDEX idx_risks_classification ON market_risks(classification);

-- =====================================================
-- DATA SOURCES & COMPLIANCE
-- =====================================================

CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL UNIQUE,
  tier VARCHAR(50) NOT NULL,
  provider VARCHAR(200) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Configuration (encrypted in production)
  config JSONB DEFAULT '{}',
  rate_limit JSONB DEFAULT '{}',
  retry_config JSONB DEFAULT '{}',
  proxy_config JSONB DEFAULT '{}',
  
  -- Status
  status VARCHAR(30) DEFAULT 'active',
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_error_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  
  -- Reliability
  reliability_score INTEGER DEFAULT 100,
  uptime_percent DECIMAL(5, 2) DEFAULT 100,
  avg_response_time_ms INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE compliance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_source_id UUID REFERENCES data_sources(id),
  source_type VARCHAR(50) NOT NULL,
  source_name VARCHAR(200) NOT NULL,
  collection_method VARCHAR(100) NOT NULL,
  collection_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  data_type VARCHAR(100),
  record_count INTEGER DEFAULT 0,
  
  -- Compliance flags
  rate_limit_respected BOOLEAN DEFAULT TRUE,
  robots_txt_respected BOOLEAN DEFAULT TRUE,
  tos_compliant BOOLEAN DEFAULT TRUE,
  jurisdiction VARCHAR(50) DEFAULT 'IN',
  
  -- Audit
  request_id VARCHAR(200),
  response_code INTEGER,
  processing_time_ms INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_compliance_source ON compliance_records(data_source_id);
CREATE INDEX idx_compliance_timestamp ON compliance_records(collection_timestamp DESC);
CREATE INDEX idx_compliance_violations ON compliance_records(tos_compliant) WHERE tos_compliant = FALSE;

-- =====================================================
-- AI RECOMMENDATION LISTS
-- =====================================================

CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(100) NOT NULL,
  products JSONB NOT NULL DEFAULT '[]',
  
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  ai_model VARCHAR(100),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recommendations_category ON ai_recommendations(category);
CREATE INDEX idx_recommendations_generated ON ai_recommendations(generated_at DESC);

-- =====================================================
-- JOB EXECUTION LOG
-- =====================================================

CREATE TABLE job_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'running', -- running, completed, failed, cancelled
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Results
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  -- Details
  config JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_jobs_name ON job_executions(job_name);
CREATE INDEX idx_jobs_status ON job_executions(status);
CREATE INDEX idx_jobs_started ON job_executions(started_at DESC);

-- =====================================================
-- DAILY REPORTS
-- =====================================================

CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL UNIQUE,
  report_type VARCHAR(50) DEFAULT 'executive_summary',
  
  -- Summary
  new_products_discovered INTEGER DEFAULT 0,
  new_opportunities_found INTEGER DEFAULT 0,
  new_suppliers_added INTEGER DEFAULT 0,
  high_margin_products INTEGER DEFAULT 0,
  
  -- Content
  executive_summary TEXT,
  top_opportunities JSONB DEFAULT '[]',
  key_metrics JSONB DEFAULT '{}',
  competitor_changes JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reports_date ON daily_reports(report_date DESC);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON product_bundles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
