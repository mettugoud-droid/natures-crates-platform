/**
 * Phase 12: Monitoring & Health Check Middleware
 * - Prometheus-compatible metrics
 * - Request duration tracking
 * - Error rate monitoring
 * - System health endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';

// In-memory metrics (use Prometheus client in production)
const metrics = {
  requestCount: 0,
  errorCount: 0,
  requestDurations: [] as number[],
  lastErrors: [] as { path: string; error: string; timestamp: Date }[],
  startTime: Date.now(),
};

/**
 * Request metrics middleware
 */
export function metricsCollector(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  metrics.requestCount++;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.requestDurations.push(duration);

    // Keep only last 1000 durations
    if (metrics.requestDurations.length > 1000) {
      metrics.requestDurations = metrics.requestDurations.slice(-1000);
    }

    if (res.statusCode >= 400) {
      metrics.errorCount++;
      metrics.lastErrors.push({
        path: req.path,
        error: `HTTP ${res.statusCode}`,
        timestamp: new Date(),
      });
      
      // Keep only last 50 errors
      if (metrics.lastErrors.length > 50) {
        metrics.lastErrors = metrics.lastErrors.slice(-50);
      }
    }
  });

  next();
}

/**
 * Detailed health check endpoint handler
 */
export async function detailedHealthCheck(_req: Request, res: Response): Promise<void> {
  const checks: Record<string, { status: string; responseTime?: number; details?: any }> = {};

  // Database health
  const dbStart = Date.now();
  try {
    await pool.query('SELECT 1');
    checks['database'] = { status: 'healthy', responseTime: Date.now() - dbStart };
  } catch (error) {
    checks['database'] = { status: 'unhealthy', responseTime: Date.now() - dbStart, details: 'Connection failed' };
  }

  // Calculate metrics
  const durations = metrics.requestDurations;
  const avgDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;
  const p95Duration = durations.length > 0 
    ? durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] 
    : 0;
  const errorRate = metrics.requestCount > 0 
    ? (metrics.errorCount / metrics.requestCount) * 100 
    : 0;

  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);

  const overallStatus = Object.values(checks).every(c => c.status === 'healthy') 
    ? 'healthy' 
    : 'degraded';

  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    version: '1.0.0',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    timestamp: new Date().toISOString(),
    checks,
    metrics: {
      totalRequests: metrics.requestCount,
      totalErrors: metrics.errorCount,
      errorRate: `${errorRate.toFixed(2)}%`,
      avgResponseTime: `${avgDuration.toFixed(0)}ms`,
      p95ResponseTime: `${p95Duration}ms`,
    },
    recentErrors: metrics.lastErrors.slice(-5),
  });
}

/**
 * Prometheus-compatible metrics endpoint
 */
export function prometheusMetrics(_req: Request, res: Response): void {
  const durations = metrics.requestDurations;
  const avgDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;

  const lines = [
    '# HELP http_requests_total Total HTTP requests',
    '# TYPE http_requests_total counter',
    `http_requests_total ${metrics.requestCount}`,
    '',
    '# HELP http_errors_total Total HTTP errors',
    '# TYPE http_errors_total counter',
    `http_errors_total ${metrics.errorCount}`,
    '',
    '# HELP http_request_duration_ms Average request duration',
    '# TYPE http_request_duration_ms gauge',
    `http_request_duration_ms ${avgDuration.toFixed(2)}`,
    '',
    '# HELP process_uptime_seconds Process uptime',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${Math.floor((Date.now() - metrics.startTime) / 1000)}`,
  ];

  res.setHeader('Content-Type', 'text/plain');
  res.send(lines.join('\n'));
}
