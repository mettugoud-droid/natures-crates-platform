// Compliance and data quality types

export interface ComplianceRecord {
  id: string;
  dataSourceId: string;
  sourceType: DataSourceTier;
  sourceName: string;
  collectionMethod: string;
  collectionTimestamp: Date;
  dataType: string;
  recordCount: number;
  
  // Compliance
  rateLimitRespected: boolean;
  robotsTxtRespected: boolean;
  tosCompliant: boolean;
  jurisdiction: string;
  
  // Audit
  requestId: string;
  responseCode: number;
  processingTimeMs: number;
  
  createdAt: Date;
}

export type DataSourceTier = 'tier_1_official_api' | 'tier_2_approved_provider' | 'tier_3_configurable_connector';

export interface DataSource {
  id: string;
  name: string;
  tier: DataSourceTier;
  provider: string;
  enabled: boolean;
  
  // Configuration
  apiKey?: string;
  baseUrl?: string;
  rateLimit: RateLimitConfig;
  retryConfig: RetryConfig;
  proxyConfig?: ProxyConfig;
  
  // Status
  status: 'active' | 'degraded' | 'disabled' | 'error';
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  
  // Reliability
  reliabilityScore: number; // 0-100
  uptimePercent: number;
  averageResponseTimeMs: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export interface ProxyConfig {
  enabled: boolean;
  provider: string;
  rotationInterval: number; // seconds
  geoTargeting: string[];
}

export interface DataQualityScore {
  productId: string;
  confidenceScore: number; // 0-100
  freshnessScore: number; // 0-100
  sourceReliabilityScore: number; // 0-100
  overallQuality: 'high' | 'medium' | 'low';
  
  // Flags
  isDuplicate: boolean;
  isOutdated: boolean;
  hasMissingSupplierData: boolean;
  hasMarginUncertainty: boolean;
  
  // Details
  lastVerifiedAt: Date;
  dataSources: string[];
  conflictingData: string[];
}

export interface ComplianceReport {
  id: string;
  reportDate: Date;
  period: 'daily' | 'weekly' | 'monthly';
  
  // Metrics
  totalRequests: number;
  compliantRequests: number;
  complianceRate: number;
  
  // By source
  sourceBreakdown: {
    sourceName: string;
    tier: DataSourceTier;
    requests: number;
    compliant: number;
    violations: number;
  }[];
  
  // Violations
  violations: ComplianceViolation[];
  
  generatedAt: Date;
}

export interface ComplianceViolation {
  sourceId: string;
  timestamp: Date;
  type: 'rate_limit_exceeded' | 'tos_violation' | 'robots_txt_violation' | 'unauthorized_access';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  resolution: string | null;
}
