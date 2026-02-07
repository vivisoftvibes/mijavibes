/**
 * Health check endpoints
 *
 * Provides system health status for monitoring
 */

import { Router } from 'express';
import { healthCheck } from '../database/connection';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const dbHealthy = await healthCheck();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
    },
  });
});

healthRouter.get('/readiness', async (req, res) => {
  const dbHealthy = await healthCheck();

  if (dbHealthy) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not_ready', details: 'database_unavailable' });
  }
});
