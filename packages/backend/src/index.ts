import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initializeJobs } from './jobs/scheduler';

// Route imports
import productRoutes from './routes/products';
import marginRoutes from './routes/margins';
import opportunityRoutes from './routes/opportunities';
import supplierRoutes from './routes/suppliers';
import recommendationRoutes from './routes/recommendations';
import complianceRoutes from './routes/compliance';
import marketplaceRoutes from './routes/marketplace';
import competitorRoutes from './routes/competitors';
import bundleRoutes from './routes/bundles';
import productFinderRoutes from './routes/productFinder';
import analyticsRoutes from './routes/analytics';
import reportRoutes from './routes/reports';

// Security & Monitoring imports
import { requestId, auditLog, sanitizeInput, securityHeaders } from './middleware/security';
import { metricsCollector, detailedHealthCheck, prometheusMetrics } from './middleware/monitoring';
import { clerkAuth, requireRole } from './middleware/auth';
import { redisRateLimiter } from './middleware/redisRateLimiter';

// =====================================================
// GLOBAL EXCEPTION HANDLERS (Priority 1.4)
// Prevent server crashes on unhandled errors
// =====================================================
process.on('uncaughtException', (error: Error) => {
  logger.error('UNCAUGHT EXCEPTION - Server staying alive', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  // Do NOT exit - keep server running
});

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error('UNHANDLED REJECTION - Server staying alive', {
    reason: message,
    stack,
    timestamp: new Date().toISOString(),
  });
  // Do NOT exit - keep server running
});

const app = express();

// =====================================================
// MIDDLEWARE STACK
// =====================================================

// Security headers & CORS
app.use(helmet());
app.use(cors({
  origin: [
    config.frontendUrl,
    'http://localhost:3000',
    'https://natures-cratesfrontend-production.up.railway.app',
    /\.up\.railway\.app$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Structured logging
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.info(message.trim()) },
}));

// Security middleware
app.use(requestId);
app.use(sanitizeInput);
app.use(securityHeaders);
app.use(metricsCollector);

// Rate limiting (Redis-based in production, in-memory fallback)
app.use(redisRateLimiter);

// =====================================================
// PUBLIC ENDPOINTS (no auth required)
// =====================================================
// Diagnostic endpoint (temporary - remove after DB is working)
app.get('/api/debug/db-config', (_req, res) => {
  const dbUrl = process.env.DATABASE_URL || 'NOT SET';
  const masked = dbUrl === 'NOT SET' ? 'NOT SET' : dbUrl.replace(/:[^:@]+@/, ':***@');
  res.json({
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_MASKED: masked,
    DB_HOST: process.env.DB_HOST || 'NOT SET',
    DB_PORT: process.env.DB_PORT || 'NOT SET',
    DB_NAME: process.env.DB_NAME || 'NOT SET',
    DB_USER: process.env.DB_USER || 'NOT SET',
    DB_SSL: process.env.DB_SSL || 'NOT SET',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'natures-crates-api',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});
app.get('/api/health/detailed', detailedHealthCheck);
app.get('/api/metrics', prometheusMetrics);

// =====================================================
// AUTHENTICATION GATE
// All routes below require valid Clerk session or API key
// =====================================================
app.use('/api', clerkAuth);
app.use(auditLog);

// =====================================================
// PROTECTED API ROUTES (with RBAC)
// =====================================================

// Viewer role (read-only access)
app.use('/api/products', requireRole('viewer'), productRoutes);
app.use('/api/margins', requireRole('viewer'), marginRoutes);
app.use('/api/opportunities', requireRole('viewer'), opportunityRoutes);
app.use('/api/suppliers', requireRole('viewer'), supplierRoutes);
app.use('/api/recommendations', requireRole('viewer'), recommendationRoutes);
app.use('/api/compliance', requireRole('viewer'), complianceRoutes);
app.use('/api/marketplace', requireRole('viewer'), marketplaceRoutes);
app.use('/api/competitors', requireRole('viewer'), competitorRoutes);
app.use('/api/bundles', requireRole('viewer'), bundleRoutes);
app.use('/api/product-finder', requireRole('viewer'), productFinderRoutes);
app.use('/api/analytics', requireRole('viewer'), analyticsRoutes);
app.use('/api/reports', requireRole('viewer'), reportRoutes);

// =====================================================
// ERROR HANDLING
// =====================================================
app.use(notFoundHandler);
app.use(errorHandler);

// =====================================================
// SERVER START
// =====================================================
const server = app.listen(config.port, () => {
  logger.info(`Nature's Crates API server running on port ${config.port}`, {
    environment: config.nodeEnv,
    port: config.port,
    auth: config.auth.clerkSecretKey ? 'Clerk enabled' : 'Dev mode (no auth)',
  });

  if (config.jobs.cronEnabled) {
    initializeJobs();
    logger.info('Scheduled jobs initialized');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down');
  server.close(() => process.exit(0));
});

export default app;
