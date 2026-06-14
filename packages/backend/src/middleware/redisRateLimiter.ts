/**
 * Redis-Based Rate Limiting
 * 
 * Uses Redis for distributed rate limiting across multiple server instances.
 * Falls back to in-memory when Redis is unavailable.
 * 
 * Limits:
 * - Default: 100 requests/minute per IP
 * - API Key authenticated: 300 requests/minute
 * - Admin role: 1000 requests/minute
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Rate limit tiers
const RATE_LIMITS: Record<string, { requests: number; windowSeconds: number }> = {
  default: { requests: 100, windowSeconds: 60 },
  authenticated: { requests: 300, windowSeconds: 60 },
  admin: { requests: 1000, windowSeconds: 60 },
  webhook: { requests: 50, windowSeconds: 60 },
};

// Redis client (lazy initialization)
let redis: Redis | null = null;
let redisAvailable = false;

function getRedisClient(): Redis | null {
  if (redis) return redis;

  try {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 1,
      retryStrategy(times: number) {
        if (times > 3) return null; // Stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('connect', () => {
      redisAvailable = true;
      logger.info('Redis rate limiter connected');
    });

    redis.on('error', (err) => {
      redisAvailable = false;
      logger.debug('Redis rate limiter unavailable, using in-memory fallback', { error: err.message });
    });

    redis.connect().catch(() => {
      redisAvailable = false;
    });

    return redis;
  } catch {
    return null;
  }
}

// In-memory fallback
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Redis-based rate limiter middleware
 */
export async function redisRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = getRateLimitKey(req);
  const limit = getRateLimit(req);

  try {
    const client = getRedisClient();

    if (client && redisAvailable) {
      // Redis-based sliding window
      const result = await redisCheck(client, key, limit);

      res.setHeader('X-RateLimit-Limit', limit.requests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.resetAt.toString());

      if (!result.allowed) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.resetAt - Date.now() / 1000)),
          limit: limit.requests,
          window: `${limit.windowSeconds}s`,
        });
        return;
      }
    } else {
      // In-memory fallback
      const result = memoryCheck(key, limit);

      if (!result.allowed) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded (fallback)',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        });
        return;
      }
    }

    next();
  } catch (error) {
    // On any rate limiter error, allow the request through
    logger.debug('Rate limiter error, allowing request', { error: (error as Error).message });
    next();
  }
}

// =====================================================
// INTERNAL HELPERS
// =====================================================

function getRateLimitKey(req: Request): string {
  const auth = req.auth;
  if (auth) {
    return `rl:user:${auth.userId}`;
  }
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `rl:ip:${ip}`;
}

function getRateLimit(req: Request): { requests: number; windowSeconds: number } {
  const auth = req.auth;
  if (!auth) return RATE_LIMITS['default']!;
  if (auth.role === 'admin') return RATE_LIMITS['admin']!;
  return RATE_LIMITS['authenticated']!;
}

async function redisCheck(
  client: Redis,
  key: string,
  limit: { requests: number; windowSeconds: number }
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - limit.windowSeconds;
  const resetAt = now + limit.windowSeconds;

  // Sliding window using sorted set
  const pipeline = client.pipeline();
  pipeline.zremrangebyscore(key, '-inf', windowStart.toString());
  pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
  pipeline.zcard(key);
  pipeline.expire(key, limit.windowSeconds);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) || 0;
  const remaining = Math.max(0, limit.requests - count);
  const allowed = count <= limit.requests;

  return { allowed, remaining, resetAt };
}

function memoryCheck(
  key: string,
  limit: { requests: number; windowSeconds: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + limit.windowSeconds * 1000 });
    return { allowed: true, remaining: limit.requests - 1, resetAt: now + limit.windowSeconds * 1000 };
  }

  record.count++;
  const remaining = Math.max(0, limit.requests - record.count);
  const allowed = record.count <= limit.requests;

  return { allowed, remaining, resetAt: record.resetAt };
}

// Periodic cleanup of in-memory store
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 60000);
