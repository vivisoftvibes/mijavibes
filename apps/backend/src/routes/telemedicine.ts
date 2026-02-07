/**
 * Telemedicine routes
 *
 * Endpoints for doctor consultation booking (US-040 to US-042)
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validator';
import { TelemedicineService } from '../services/TelemedicineService';
import { logAuditEvent } from '../utils/logger';

export const telemedicineRouter = Router();
const telemedicineService = new TelemedicineService();

/**
 * GET /api/telemedicine/providers
 * Get healthcare providers (US-041)
 */
telemedicineRouter.get(
  '/providers',
  authenticate,
  validateQuery(z.object({
    specialty: z.string().optional(),
    consultationType: z.enum(['in_person', 'online']).optional(),
  })),
  asyncHandler(async (req, res) => {
    const { specialty, consultationType } = req.query;

    const providers = await telemedicineService.getProviders(
      specialty as string | undefined,
      consultationType as 'in_person' | 'online' | undefined
    );

    logAuditEvent(req.user!.id, 'telemedicine.providers.list', undefined, {
      count: providers.length,
    });

    res.json({ providers });
  })
);

/**
 * GET /api/telemedicine/providers/:providerId
 * Get provider details
 */
telemedicineRouter.get(
  '/providers/:providerId',
  authenticate,
  validateParams(z.object({ providerId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { providerId } = req.params;

    const provider = await telemedicineService.getProvider(providerId);

    logAuditEvent(userId, 'telemedicine.provider.view', providerId);

    res.json({ provider });
  })
);

/**
 * GET /api/telemedicine/user-providers
 * Get user's linked healthcare providers
 */
telemedicineRouter.get(
  '/user-providers',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const providers = await telemedicineService.getUserProviders(userId);

    logAuditEvent(userId, 'telemedicine.user_providers.list', undefined, {
      count: providers.length,
    });

    res.json({ providers });
  })
);

/**
 * POST /api/telemedicine/user-providers
 * Link a healthcare provider to user
 */
telemedicineRouter.post(
  '/user-providers',
  authenticate,
  validateBody(z.object({
    providerId: z.string().uuid(),
    isPrimary: z.boolean().default(false),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { providerId, isPrimary } = req.body;

    const relationship = await telemedicineService.linkProvider(userId, providerId, isPrimary);

    logAuditEvent(userId, 'telemedicine.provider.linked', providerId, {
      isPrimary,
    });

    res.status(201).json({ relationship });
  })
);

/**
 * GET /api/telemedicine/recommendations
 * Get consultation recommendations based on health data (US-040)
 */
telemedicineRouter.get(
  '/recommendations',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const recommendations = await telemedicineService.getRecommendations(userId);

    logAuditEvent(userId, 'telemedicine.recommendations', undefined);

    res.json({ recommendations });
  })
);

/**
 * GET /api/telemedicine/suggestions
 * Get consultation suggestions based on health trends
 */
telemedicineRouter.get(
  '/suggestions',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const suggestions = await telemedicineService.getConsultationSuggestions(userId);

    logAuditEvent(userId, 'telemedicine.suggestions', undefined);

    res.json({ suggestions });
  })
);
