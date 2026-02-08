/**
 * Database connection configuration
 *
 * Uses Supabase PostgreSQL with connection pooling
 * HIPAA: SSL required for data in transit
 */

import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

// Parse DATABASE_URL if available, otherwise use individual variables
let poolConfig: PoolConfig;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL (preferred for Render/production)
  // Parse connection string and add SSL
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  };
} else {
  // Fallback to individual environment variables
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
  };
}

// Create connection pool
export const pool = new Pool(poolConfig);

// Log pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', err);
});

/**
 * Execute a SQL query with parameters
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 100) {
      logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }

    return result.rows as T[];
  } catch (error) {
    logger.error('Database query error', { error, query: text });
    throw error;
  }
}

/**
 * Get a single row from a query
 */
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: import('pg').PoolClient) => Promise<T>
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
 * Health check for database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database connection pool closed');
}

// Graceful shutdown
process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);
