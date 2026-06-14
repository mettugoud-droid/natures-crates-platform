-- =====================================================
-- Seed Data: Data Sources Configuration
-- =====================================================

INSERT INTO data_sources (name, tier, provider, enabled, config, rate_limit, retry_config, status) VALUES
-- Tier 1: Official APIs
('Amazon PA-API v5', 'tier_1_official_api', 'Amazon', true,
  '{"region": "IN", "marketplace": "amazon.in", "partner_type": "Associates"}',
  '{"requestsPerSecond": 1, "requestsPerMinute": 60, "requestsPerHour": 8640, "requestsPerDay": 8640, "burstLimit": 1}',
  '{"maxRetries": 3, "initialDelayMs": 2000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

('Google Trends (via DataForSEO)', 'tier_1_official_api', 'Google/DataForSEO', true,
  '{"geo": "IN", "language": "en", "type": "web"}',
  '{"requestsPerSecond": 2, "requestsPerMinute": 30, "requestsPerHour": 500, "requestsPerDay": 5000, "burstLimit": 5}',
  '{"maxRetries": 3, "initialDelayMs": 5000, "maxDelayMs": 60000, "backoffMultiplier": 2}',
  'active'),

('Meta Ads Library', 'tier_1_official_api', 'Meta', false,
  '{"country": "IN", "ad_type": "ALL"}',
  '{"requestsPerSecond": 2, "requestsPerMinute": 60, "requestsPerHour": 1000, "requestsPerDay": 10000, "burstLimit": 5}',
  '{"maxRetries": 2, "initialDelayMs": 3000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

-- Tier 2: Approved Providers
('Bright Data', 'tier_2_approved_provider', 'Bright Data', true,
  '{"zone": "web_scraper", "format": "json"}',
  '{"requestsPerSecond": 5, "requestsPerMinute": 100, "requestsPerHour": 2000, "requestsPerDay": 20000, "burstLimit": 10}',
  '{"maxRetries": 3, "initialDelayMs": 3000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

('Keepa', 'tier_2_approved_provider', 'Keepa', true,
  '{"domain": 44, "marketplace": "amazon.in"}',
  '{"requestsPerSecond": 1, "requestsPerMinute": 30, "requestsPerHour": 100, "requestsPerDay": 1000, "burstLimit": 2}',
  '{"maxRetries": 2, "initialDelayMs": 5000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

('Apify', 'tier_2_approved_provider', 'Apify', true,
  '{"proxy_configuration": "auto", "max_concurrency": 5}',
  '{"requestsPerSecond": 3, "requestsPerMinute": 60, "requestsPerHour": 1000, "requestsPerDay": 10000, "burstLimit": 5}',
  '{"maxRetries": 3, "initialDelayMs": 5000, "maxDelayMs": 60000, "backoffMultiplier": 2}',
  'active'),

('DataForSEO', 'tier_2_approved_provider', 'DataForSEO', true,
  '{"location_code": 2356, "language_code": "en"}',
  '{"requestsPerSecond": 2, "requestsPerMinute": 60, "requestsPerHour": 1000, "requestsPerDay": 10000, "burstLimit": 5}',
  '{"maxRetries": 3, "initialDelayMs": 3000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

('Semrush', 'tier_2_approved_provider', 'Semrush', false,
  '{"database": "in", "device": "desktop"}',
  '{"requestsPerSecond": 1, "requestsPerMinute": 30, "requestsPerHour": 500, "requestsPerDay": 5000, "burstLimit": 2}',
  '{"maxRetries": 2, "initialDelayMs": 5000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

-- Tier 3: Configurable Connectors
('IndiaMART', 'tier_3_configurable_connector', 'IndiaMART', true,
  '{"api_type": "crm_listing", "version": "v2"}',
  '{"requestsPerSecond": 1, "requestsPerMinute": 10, "requestsPerHour": 200, "requestsPerDay": 2000, "burstLimit": 2}',
  '{"maxRetries": 2, "initialDelayMs": 5000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

('TradeIndia', 'tier_3_configurable_connector', 'TradeIndia', true,
  '{"format": "json", "country": "IN"}',
  '{"requestsPerSecond": 1, "requestsPerMinute": 10, "requestsPerHour": 100, "requestsPerDay": 1000, "burstLimit": 2}',
  '{"maxRetries": 2, "initialDelayMs": 5000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

('ExportersIndia', 'tier_3_configurable_connector', 'ExportersIndia', true,
  '{"format": "json", "country": "IN"}',
  '{"requestsPerSecond": 1, "requestsPerMinute": 10, "requestsPerHour": 100, "requestsPerDay": 1000, "burstLimit": 2}',
  '{"maxRetries": 2, "initialDelayMs": 5000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active'),

('Alibaba', 'tier_3_configurable_connector', 'Alibaba', true,
  '{"country": "IN", "category": "food_beverage"}',
  '{"requestsPerSecond": 1, "requestsPerMinute": 10, "requestsPerHour": 100, "requestsPerDay": 500, "burstLimit": 2}',
  '{"maxRetries": 2, "initialDelayMs": 10000, "maxDelayMs": 60000, "backoffMultiplier": 2}',
  'active'),

('MSME Directory', 'tier_3_configurable_connector', 'Government of India', true,
  '{"source": "udyam_registration", "state": "all"}',
  '{"requestsPerSecond": 1, "requestsPerMinute": 10, "requestsPerHour": 100, "requestsPerDay": 500, "burstLimit": 2}',
  '{"maxRetries": 2, "initialDelayMs": 5000, "maxDelayMs": 30000, "backoffMultiplier": 2}',
  'active');
