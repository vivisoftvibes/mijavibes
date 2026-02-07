/**
 * Pharmacy routes
 *
 * Endpoints for prescription refills (US-050 to US-052)
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams } from '../middleware/validator';
import { PharmacyService } from '../services/PharmacyService';
import { logAuditEvent } from '../utils/logger';

export const pharmacyRouter = Router();
const pharmacyService = new PharmacyService();

const createRefillSchema = z.object({
  medicationId: z.string().uuid(),
  pharmacyId: z.string().uuid().optional(),
  deliveryAddress: z.string().optional(),
});

const refillIdSchema = z.object({
  refillId: z.string().uuid(),
});

/**
 * GET /api/pharmacy/partners
 * Get pharmacy partners (US-050)
 */
pharmacyRouter.get(
  '/partners',
  authenticate,
  asyncHandler(async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    const pharmacies = await pharmacyService.getPharmacies(
      isNaN(lat) ? undefined : lat,
      isNaN(lng) ? undefined : lng
    );

    logAuditEvent(req.user!.id, 'pharmacy.partners.list', undefined, {
      count: pharmacies.length,
    });

    res.json({ pharmacies });
  })
);

/**
 * POST /api/pharmacy/refills
 * Create prescription refill order (US-050, US-051)
 */
pharmacyRouter.post(
  '/refills',
  authenticate,
  validateBody(createRefillSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId, pharmacyId, deliveryAddress } = req.body;

    const refill = await pharmacyService.createRefillOrder(userId, {
      medicationId,
      pharmacyId,
      deliveryAddress,
    });

    logAuditEvent(userId, 'pharmacy.refill.created', refill.id, {
      medicationId,
      pharmacyId,
    });

    res.status(201).json({ refill });
  })
);

/**
 * GET /api/pharmacy/refills
 * Get user's refill orders
 */
pharmacyRouter.get(
  '/refills',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const status = req.query.status as string | undefined;

    const refills = await pharmacyService.getUserRefills(userId, status);

    logAuditEvent(userId, 'pharmacy.refills.list', undefined, {
      count: refills.length,
    });

    res.json({ refills });
  })
);

/**
 * GET /api/pharmacy/refills/:refillId
 * Get refill order details
 */
pharmacyRouter.get(
  '/refills/:refillId',
  authenticate,
  validateParams(refillIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { refillId } = req.params;

    const refill = await pharmacyService.getRefillOrder(userId, refillId);

    logAuditEvent(userId, 'pharmacy.refill.view', refillId);

    res.json({ refill });
  })
);

/**
 * POST /api/pharmacy/refills/:refillId/cancel
 * Cancel refill order
 */
pharmacyRouter.post(
  '/refills/:refillId/cancel',
  authenticate,
  validateParams(refillIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { refillId } = req.params;

    const refill = await pharmacyService.cancelRefillOrder(userId, refillId);

    logAuditEvent(userId, 'pharmacy.refill.cancelled', refillId);

    res.json({ refill });
  })
);

/**
 * GET /api/pharmacy/medications/low-supply
 * Get medications with low supply (US-005)
 */
pharmacyRouter.get(
  '/medications/low-supply',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const medications = await pharmacyService.getLowSupplyMedications(userId);

    logAuditEvent(userId, 'pharmacy.low_supply.list', undefined, {
      count: medications.length,
    });

    res.json({ medications });
  })
);
