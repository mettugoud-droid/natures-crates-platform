/**
 * Phase 12: Production Security Middleware
 * - Request validation
 * - API key authentication
 * - Audit logging
 * - Input sanitization
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { query } from '../db/pool';

/**
 * API Key authentication middleware
 * Validates API key from header or query parameter
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth in development
  if (process.env.NODE_ENV === 'development' && !process.env.REQUIRE_API_KEY) {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    res.status(401).json({ success: false, error: 'API key required' });
    return;
  }

  const validKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);
  
  if (validKeys.length > 0 && !validKeys.includes(apiKey as string)) {
    res.status(403).json({ success: false, error: 'Invalid API key' });
    return;
  }

  next();
}

/**
 * Request ID middleware - adds unique ID to every request
 */
export function requestId(req: Request, _res: Response, next: NextFunction): void {
  req.headers['x-request-id'] = req.headers['x-request-id'] || 
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  next();
}

/**
 * Audit logging middleware - logs all write operations
 */
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const startTime = Date.now();
    
    // Capture response
    const originalEnd = res.end.bind(res);
    const _startTime = startTime;
    res.on('finish', () => {
      const duration = Date.now() - _startTime;
      
      // Log audit entry (async, non-blocking)
      logAuditEntry({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userId: (req as any).auth?.userId || 'anonymous',
        ip: req.ip || 'unknown',
        requestId: req.headers['x-request-id'] as string || '',
        duration,
        timestamp: new Date(),
      }).catch(() => {}); // Silent fail for audit
    });
  }
  
  next();
}

/**
 * Input sanitization - prevents XSS and SQL injection in query params
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        (req.query as any)[key] = sanitizeString(value);
      }
    }
  }
  next();
}

/**
 * Security headers middleware (supplements helmet)
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

// Helper functions

function sanitizeString(str: string): string {
  return str
    .replace(/<[^>]*>/g, '') // Strip HTML
    .replace(/[;'"\\]/g, '') // Strip potential SQL chars from query params
    .trim()
    .substring(0, 1000); // Max length
}

async function logAuditEntry(entry: {
  method: string;
  path: string;
  statusCode: number;
  userId: string;
  ip: string;
  requestId: string;
  duration: number;
  timestamp: Date;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO compliance_records (
        source_type, source_name, collection_method, collection_timestamp,
        data_type, record_count, rate_limit_respected, robots_txt_respected,
        tos_compliant, jurisdiction, request_id, response_code, processing_time_ms
      ) VALUES ('internal_api', $1, $2, $3, 'api_request', 1, true, true, true, 'IN', $4, $5, $6)`,
      [entry.path, entry.method, entry.timestamp, entry.requestId, entry.statusCode, entry.duration]
    );
  } catch {
    // Non-critical, ignore
  }
}
