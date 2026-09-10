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
import crmRoutes from './routes/crm';
import crmImportRoutes from './routes/crmImport';

import { requestId, auditLog, sanitizeInput, securityHeaders } from './middleware/security';
import { metricsCollector, detailedHealthCheck, prometheusMetrics } from './middleware/monitoring';
import { clerkAuth, requireRole } from './middleware/auth';
import { redisRateLimiter } from './middleware/redisRateLimiter';

process.on('uncaughtException', (error: Error) => {
  logger.error('UNCAUGHT EXCEPTION - Server staying alive', { error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
});
process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error('UNHANDLED REJECTION - Server staying alive', { reason: message, timestamp: new Date().toISOString() });
});

const app = express();
app.use(helmet());
app.use(cors({ origin: [config.frontendUrl, 'http://localhost:3000'], credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization','x-api-key','x-request-id'] }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }));
app.use(requestId);
app.use(sanitizeInput);
app.use(securityHeaders);
app.use(metricsCollector);
app.use(redisRateLimiter);

app.get('/api/health', (_req, res) => res.json({ success:true, service:'natures-crates-api', version:'1.0.0', environment:config.nodeEnv, timestamp:new Date().toISOString() }));
app.get('/api/health/detailed', detailedHealthCheck);
app.get('/api/metrics', prometheusMetrics);

app.use('/api', clerkAuth);
app.use(auditLog);

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
app.use('/api/crm', requireRole('viewer'), crmRoutes);
app.use('/api/crm/import', requireRole('analyst'), crmImportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Nature's Crates API server running on port ${config.port}`, { environment: config.nodeEnv, port: config.port, auth: config.auth.clerkSecretKey ? 'Clerk enabled' : 'Dev mode (no auth)' });
  if (config.jobs.cronEnabled) { initializeJobs(); logger.info('Scheduled jobs initialized'); }
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
export default app;
