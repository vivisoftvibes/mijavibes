/**
 * Vital Signs routes
 *
 * Endpoints for vital signs tracking (US-010 to US-014)
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, checkResourceAccess } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validator';
import { VitalSignsService } from '../services/VitalSignsService';
import { logAuditEvent } from '../utils/logger';

export const vitalSignsRouter = Router();
const vitalSignsService = new VitalSignsService();

// Validation schemas
const createBloodPressureSchema = z.object({
  type: z.literal('blood_pressure'),
  systolic: z.number().int().min(60).max(250),
  diastolic: z.number().int().min(40).max(150),
  measuredAt: z.string().datetime().optional(),
  source: z.enum(['manual', 'bluetooth_device']).default('manual'),
  deviceId: z.string().optional(),
  additionalData: z.object({
    position: z.enum(['sitting', 'standing', 'lying_down']).optional(),
    arm: z.enum(['left', 'right']).optional(),
  }).optional(),
});

const createGlucoseSchema = z.object({
  type: z.literal('glucose'),
  value: z.string().regex(/^\d+$/),
  unit: z.literal('mg/dL'),
  measuredAt: z.string().datetime().optional(),
  source: z.enum(['manual', 'bluetooth_device']).default('manual'),
  deviceId: z.string().optional(),
  additionalData: z.object({
    fasting: z.boolean().optional(),
    mealTime: z.enum(['before_meal', 'after_meal', 'bedtime']).optional(),
  }).optional(),
});

const vitalSignIdSchema = z.object({
  vitalSignId: z.string().uuid(),
});

const statsQuerySchema = z.object({
  type: z.enum(['blood_pressure', 'glucose']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().optional().transform((v) => v ? parseInt(v) : undefined),
});

/**
 * GET /api/vital-signs
 * Get all vital signs for current user
 */
vitalSignsRouter.get(
  '/',
  authenticate,
  validateQuery(statsQuerySchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { type, startDate, endDate, limit } = req.query;

    const vitalSigns = await vitalSignsService.getVitalSigns(
      userId,
      type as string | undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
      limit
    );

    logAuditEvent(userId, 'vital_signs.list', undefined, {
      count: vitalSigns.length,
      type,
    });

    res.json({ vitalSigns });
  })
);

/**
 * POST /api/vital-signs/blood-pressure
 * Record blood pressure (US-010)
 */
vitalSignsRouter.post(
  '/blood-pressure',
  authenticate,
  validateBody(createBloodPressureSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { systolic, diastolic, measuredAt, source, deviceId, additionalData } = req.body;

    const vitalSign = await vitalSignsService.createBloodPressure({
      userId,
      systolic,
      diastolic,
      measuredAt: measuredAt ? new Date(measuredAt) : new Date(),
      source,
      deviceId,
      additionalData,
    });

    logAuditEvent(userId, 'vital_sign.created', vitalSign.id, {
      type: 'blood_pressure',
      systolic,
      diastolic,
    });

    res.status(201).json({ vitalSign });
  })
);

/**
 * POST /api/vital-signs/glucose
 * Record glucose (US-011)
 */
vitalSignsRouter.post(
  '/glucose',
  authenticate,
  validateBody(createGlucoseSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { value, measuredAt, source, deviceId, additionalData } = req.body;

    const vitalSign = await vitalSignsService.createGlucose({
      userId,
      value,
      unit: 'mg/dL',
      measuredAt: measuredAt ? new Date(measuredAt) : new Date(),
      source,
      deviceId,
      additionalData,
    });

    logAuditEvent(userId, 'vital_sign.created', vitalSign.id, {
      type: 'glucose',
      value,
    });

    res.status(201).json({ vitalSign });
  })
);

/**
 * GET /api/vital-signs/:vitalSignId
 * Get vital sign details
 */
vitalSignsRouter.get(
  '/:vitalSignId',
  authenticate,
  validateParams(vitalSignIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { vitalSignId } = req.params;

    const vitalSign = await vitalSignsService.getVitalSign(userId, vitalSignId);

    logAuditEvent(userId, 'vital_sign.view', vitalSignId);

    res.json({ vitalSign });
  })
);

/**
 * DELETE /api/vital-signs/:vitalSignId
 * Delete vital sign
 */
vitalSignsRouter.delete(
  '/:vitalSignId',
  authenticate,
  validateParams(vitalSignIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { vitalSignId } = req.params;

    await vitalSignsService.deleteVitalSign(userId, vitalSignId);

    logAuditEvent(userId, 'vital_sign.deleted', vitalSignId);

    res.status(204).send();
  })
);

/**
 * GET /api/vital-signs/stats/summary
 * Get vital signs summary (US-014)
 */
vitalSignsRouter.get(
  '/stats/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    const summary = await vitalSignsService.getSummary(userId, days);

    logAuditEvent(userId, 'vital_signs.summary', undefined, { days });

    res.json(summary);
  })
);

/**
 * GET /api/vital-signs/stats/trends
 * Get vital signs trends for charts (US-014)
 */
vitalSignsRouter.get(
  '/stats/trends',
  authenticate,
  validateQuery(z.object({
    type: z.enum(['blood_pressure', 'glucose']),
    period: z.enum(['7d', '30d', '90d']).default('30d'),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { type, period } = req.query;

    const trends = await vitalSignsService.getTrends(userId, type as 'blood_pressure' | 'glucose', period);

    logAuditEvent(userId, 'vital_signs.trends', undefined, { type, period });

    res.json(trends);
  })
);

/**
 * GET /api/vital-signs/check-abnormal
 * Check if latest readings are abnormal (US-013)
 */
vitalSignsRouter.get(
  '/check-abnormal',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const check = await vitalSignsService.checkAbnormalReadings(userId);

    logAuditEvent(userId, 'vital_signs.check_abnormal', undefined);

    res.json(check);
  })
);
