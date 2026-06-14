import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'natures_crates',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  // AI
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'claude-sonnet-4-20250514',
  },
  
  // Authentication
  auth: {
    clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  },
  
  // Data Providers
  providers: {
    amazonSpApiKey: process.env.AMAZON_SP_API_KEY || '',
    amazonPaApiKey: process.env.AMAZON_PA_API_KEY || '',
    amazonPaApiSecret: process.env.AMAZON_PA_API_SECRET || '',
    amazonPartnerTag: process.env.AMAZON_PARTNER_TAG || '',
    flipkartAffiliateId: process.env.FLIPKART_AFFILIATE_ID || '',
    flipkartAffiliateToken: process.env.FLIPKART_AFFILIATE_TOKEN || '',
    brightDataApiKey: process.env.BRIGHT_DATA_API_KEY || '',
    apifyApiKey: process.env.APIFY_API_KEY || '',
    dataForSeoLogin: process.env.DATAFORSEO_LOGIN || '',
    dataForSeoPassword: process.env.DATAFORSEO_PASSWORD || '',
    keepaApiKey: process.env.KEEPA_API_KEY || '',
    semrushApiKey: process.env.SEMRUSH_API_KEY || '',
  },
  
  // Compliance
  compliance: {
    defaultRateLimit: parseInt(process.env.DEFAULT_RATE_LIMIT || '60', 10), // per minute
    auditLogEnabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    robotsTxtRespect: process.env.ROBOTS_TXT_RESPECT !== 'false',
  },
  
  // Jobs
  jobs: {
    cronEnabled: process.env.CRON_ENABLED === 'true',
    dailyScanTime: process.env.DAILY_SCAN_TIME || '02:00', // IST
  },
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
