/**
 * Statistics routes
 *
 * Endpoints for health statistics and analytics (US-014)
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateQuery } from '../middleware/validator';
import { StatsService } from '../services/StatsService';
import { logAuditEvent } from '../utils/logger';

export const statsRouter = Router();
const statsService = new StatsService();

const periodQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/stats/overview
 * Get health overview dashboard
 */
statsRouter.get(
  '/overview',
  authenticate,
  validateQuery(dateRangeSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    const overview = await statsService.getOverview(
      userId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    logAuditEvent(userId, 'stats.overview', undefined);

    res.json(overview);
  })
);

/**
 * GET /api/stats/medication-adherence
 * Get medication adherence statistics
 */
statsRouter.get(
  '/medication-adherence',
  authenticate,
  validateQuery(periodQuerySchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { period } = req.query;

    const adherence = await statsService.getMedicationAdherence(userId, period);

    logAuditEvent(userId, 'stats.adherence', undefined, { period });

    res.json(adherence);
  })
);

/**
 * GET /api/stats/vitals-summary
 * Get vital signs summary statistics
 */
statsRouter.get(
  '/vitals-summary',
  authenticate,
  validateQuery(periodQuerySchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { period } = req.query;

    const summary = await statsService.getVitalsSummary(userId, period);

    logAuditEvent(userId, 'stats.vitals_summary', undefined, { period });

    res.json(summary);
  })
);

/**
 * GET /api/stats/health-trends
 * Get health trends for charts
 */
statsRouter.get(
  '/health-trends',
  authenticate,
  validateQuery(z.object({
    type: z.enum(['blood_pressure', 'glucose']),
    period: z.enum(['7d', '30d', '90d']).default('30d'),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { type, period } = req.query;

    const trends = await statsService.getHealthTrends(userId, type, period);

    logAuditEvent(userId, 'stats.trends', undefined, { type, period });

    res.json(trends);
  })
);

/**
 * GET /api/stats/alerts-history
 * Get emergency alerts history
 */
statsRouter.get(
  '/alerts-history',
  authenticate,
  validateQuery(periodQuerySchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { period } = req.query;

    const history = await statsService.getAlertsHistory(userId, period);

    logAuditEvent(userId, 'stats.alerts_history', undefined, { period });

    res.json(history);
  })
);
