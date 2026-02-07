/**
 * Database migration runner
 *
 * Applies SQL migrations from the migrations directory
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

const migrationFiles = [
  '001_initial_schema.sql',
  '002_emergency_alerts_system.sql',
  '003_telemedicine_integration.sql',
  '004_pharmacy_refill_system.sql',
];

async function runMigrations() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'salud_aldia',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    logger.info('Starting database migrations...');

    for (const file of migrationFiles) {
      logger.info(`Applying migration: ${file}`);

      const migrationPath = join(process.cwd(), '..', '..', '..', 'database', 'migrations', file);
      const sql = readFileSync(migrationPath, 'utf-8');

      await pool.query(sql);

      logger.info(`Migration applied: ${file}`);
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
