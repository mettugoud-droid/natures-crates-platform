/**
 * Authentication & RBAC Middleware
 * 
 * Uses Clerk for session-based auth (frontend) and API key for programmatic access.
 * Implements Role-Based Access Control: Admin > Analyst > Viewer
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

// Role hierarchy: admin > analyst > viewer
export type UserRole = 'admin' | 'analyst' | 'viewer';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  analyst: 2,
  viewer: 1,
};

// Extend Express Request with auth context
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
        email?: string;
        sessionId?: string;
        method: 'clerk' | 'api_key' | 'dev_bypass';
      };
    }
  }
}

/**
 * Primary authentication middleware.
 * Supports:
 * 1. Clerk JWT (Authorization: Bearer <token>)
 * 2. API Key (x-api-key header)
 * 3. Dev bypass (when NODE_ENV=development and no CLERK_SECRET_KEY)
 */
export function clerkAuth(req: Request, res: Response, next: NextFunction): void {
  // 1. Check API key first (programmatic access)
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    const keyConfig = validateApiKey(apiKey);
    if (keyConfig) {
      req.auth = {
        userId: keyConfig.userId,
        role: keyConfig.role,
        method: 'api_key',
      };
      next();
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid API key' });
    return;
  }

  // 2. Check Clerk session token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    if (config.auth.clerkSecretKey) {
      // Verify Clerk JWT
      verifyClerkToken(token)
        .then((session) => {
          if (session) {
            req.auth = {
              userId: session.userId,
              role: session.role,
              email: session.email,
              sessionId: session.sessionId,
              method: 'clerk',
            };
            next();
          } else {
            res.status(401).json({ success: false, error: 'Invalid or expired session' });
          }
        })
        .catch((err) => {
          logger.error('Clerk token verification failed', { error: err.message });
          res.status(401).json({ success: false, error: 'Authentication failed' });
        });
      return;
    }
  }

  // 3. Dev bypass - ONLY when no Clerk key configured and in development
  if (config.nodeEnv === 'development' && !config.auth.clerkSecretKey) {
    req.auth = {
      userId: 'dev_user',
      role: 'admin',
      email: 'dev@natures-crates.com',
      method: 'dev_bypass',
    };
    next();
    return;
  }

  // No valid authentication found
  res.status(401).json({
    success: false,
    error: 'Authentication required. Provide Bearer token or x-api-key header.',
  });
}

/**
 * RBAC middleware factory.
 * Checks if the authenticated user has the required role level.
 * Admin can access everything. Analyst can access analyst + viewer. Viewer can only view.
 */
export function requireRole(minimumRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.auth.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;

    if (userLevel >= requiredLevel) {
      next();
      return;
    }

    logger.warn('RBAC: Access denied', {
      userId: req.auth.userId,
      userRole: req.auth.role,
      requiredRole: minimumRole,
      path: req.path,
    });

    res.status(403).json({
      success: false,
      error: `Insufficient permissions. Required: ${minimumRole}, your role: ${req.auth.role}`,
    });
  };
}

/**
 * Admin-only route guard
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole('admin')(req, res, next);
}

/**
 * Analyst or Admin route guard
 */
export function requireAnalyst(req: Request, res: Response, next: NextFunction): void {
  requireRole('analyst')(req, res, next);
}

// =====================================================
// INTERNAL HELPERS
// =====================================================

interface ApiKeyConfig {
  userId: string;
  role: UserRole;
  name: string;
}

/**
 * Validate API key against configured keys.
 * Keys configured via environment: API_KEYS=key1:admin:name1,key2:analyst:name2
 */
function validateApiKey(key: string): ApiKeyConfig | null {
  const keysConfig = process.env.API_KEYS || '';
  if (!keysConfig) return null;

  const keys = keysConfig.split(',');
  for (const entry of keys) {
    const [apiKey, role, name] = entry.split(':');
    if (apiKey === key) {
      return {
        userId: `api_key_${name || 'unknown'}`,
        role: (role as UserRole) || 'viewer',
        name: name || 'unnamed',
      };
    }
  }
  return null;
}

interface ClerkSession {
  userId: string;
  role: UserRole;
  email?: string;
  sessionId: string;
}

/**
 * Verify Clerk JWT token.
 * In production, uses Clerk SDK to verify token signature and extract claims.
 */
async function verifyClerkToken(token: string): Promise<ClerkSession | null> {
  try {
    // Use Clerk's backend API to verify the session
    const response = await fetch('https://api.clerk.com/v1/sessions/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.auth.clerkSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    
    // Extract role from Clerk's public metadata
    const role = data.user?.public_metadata?.role || 'viewer';

    return {
      userId: data.user_id || data.sub,
      role: role as UserRole,
      email: data.user?.email_addresses?.[0]?.email_address,
      sessionId: data.id || data.sid,
    };
  } catch (error) {
    logger.error('Clerk verification error', { error: (error as Error).message });
    return null;
  }
}
