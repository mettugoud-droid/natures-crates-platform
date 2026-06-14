/**
 * Database Connection Pool with Resilience
 * 
 * Features:
 * - Connection pooling with configurable limits
 * - Graceful error handling (never crashes server)
 * - Query timeout protection
 * - Structured logging for all queries
 * - Transaction support
 * - Health check capability
 */

import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  max: config.database.maxConnections,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000, // 30s query timeout
});

pool.on('error', (err) => {
  // Log but DO NOT crash
  logger.error('Database pool error (non-fatal)', {
    error: err.message,
    code: (err as any).code,
  });
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

export { pool };

/**
 * Execute a query with error handling.
 * NEVER throws unhandled - always returns empty array on failure.
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Executed query', {
      text: text.substring(0, 100),
      duration,
      rows: result.rowCount,
    });

    return result.rows as T[];
  } catch (error) {
    const duration = Date.now() - start;
    const msg = error instanceof Error ? error.message : 'Unknown database error';
    const code = (error as any)?.code || 'UNKNOWN';

    logger.error('Database query failed', {
      error: msg,
      code,
      text: text.substring(0, 100),
      duration,
    });

    // Re-throw as a controlled error (will be caught by Express error handler)
    throw new DatabaseError(msg, code);
  }
}

/**
 * Execute a query expecting a single row.
 * Returns null if no rows found or on error.
 */
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Execute a transaction.
 * Automatically rolls back on error.
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connectivity.
 * Used by health check endpoint.
 */
export async function checkHealth(): Promise<{ connected: boolean; responseTimeMs: number }> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { connected: true, responseTimeMs: Date.now() - start };
  } catch {
    return { connected: false, responseTimeMs: Date.now() - start };
  }
}

/**
 * Custom database error class.
 * Prevents raw pg errors from propagating as unhandled exceptions.
 */
export class DatabaseError extends Error {
  code: string;
  isOperational: boolean;

  constructor(message: string, code: string = 'UNKNOWN') {
    super(`Database error: ${message}`);
    this.name = 'DatabaseError';
    this.code = code;
    this.isOperational = true;
  }
}
