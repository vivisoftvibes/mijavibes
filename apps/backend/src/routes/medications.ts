/**
 * Medication routes
 *
 * Endpoints for medication management (US-001 to US-005)
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateParams, validateBody } from '../middleware/validator';
import { MedicationService } from '../services/MedicationService';
import { logAuditEvent } from '../utils/logger';

export const medicationRouter = Router();
const medicationService = new MedicationService();

// Validation schemas
const createMedicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.enum(['daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed', 'weekly']),
  times: z.array(z.string()).min(1),
  photoUrl: z.string().url().optional(),
  supplyDays: z.number().int().positive().optional(),
  rxNumber: z.string().optional(),
  notes: z.string().optional(),
});

const updateMedicationSchema = createMedicationSchema.partial();

const medicationIdSchema = z.object({
  medicationId: z.string().uuid(),
});

/**
 * GET /api/medications
 * Get all medications for current user
 */
medicationRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const medications = await medicationService.getUserMedications(userId);

    logAuditEvent(userId, 'medications.list', undefined, {
      count: medications.length,
    });

    res.json({ medications });
  })
);

/**
 * GET /api/medications/today
 * Get today's medication schedule (US-001)
 */
medicationRouter.get(
  '/today',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();

    const schedule = await medicationService.getTodaysSchedule(userId, date);

    logAuditEvent(userId, 'medications.today', undefined, {
      date: date.toISOString().split('T')[0],
      count: schedule.length,
    });

    res.json({ schedule, date });
  })
);

/**
 * POST /api/medications
 * Create a new medication
 */
medicationRouter.post(
  '/',
  authenticate,
  validateBody(createMedicationSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const medication = await medicationService.createMedication(userId, req.body);

    logAuditEvent(userId, 'medication.created', medication.id, {
      name: medication.name,
    });

    res.status(201).json({ medication });
  })
);

/**
 * GET /api/medications/:medicationId
 * Get medication details
 */
medicationRouter.get(
  '/:medicationId',
  authenticate,
  validateParams(medicationIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;

    const medication = await medicationService.getMedication(userId, medicationId);

    logAuditEvent(userId, 'medication.view', medicationId);

    res.json({ medication });
  })
);

/**
 * PUT /api/medications/:medicationId
 * Update medication
 */
medicationRouter.put(
  '/:medicationId',
  authenticate,
  validateParams(medicationIdSchema),
  validateBody(updateMedicationSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;

    const medication = await medicationService.updateMedication(userId, medicationId, req.body);

    logAuditEvent(userId, 'medication.updated', medicationId);

    res.json({ medication });
  })
);

/**
 * DELETE /api/medications/:medicationId
 * Delete medication (soft delete)
 */
medicationRouter.delete(
  '/:medicationId',
  authenticate,
  validateParams(medicationIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;

    await medicationService.deleteMedication(userId, medicationId);

    logAuditEvent(userId, 'medication.deleted', medicationId);

    res.status(204).send();
  })
);

/**
 * POST /api/medications/:medicationId/take
 * Mark medication as taken (US-003)
 */
medicationRouter.post(
  '/:medicationId/take',
  authenticate,
  validateParams(medicationIdSchema),
  validateBody(z.object({
    scheduledAt: z.string().datetime(),
    notes: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;
    const { scheduledAt, notes } = req.body;

    const log = await medicationService.markMedicationTaken(
      userId,
      medicationId,
      new Date(scheduledAt),
      notes
    );

    logAuditEvent(userId, 'medication.taken', medicationId, {
      scheduledAt,
      notes,
    });

    res.json({ log });
  })
);

/**
 * POST /api/medications/:medicationId/skip
 * Mark medication as skipped
 */
medicationRouter.post(
  '/:medicationId/skip',
  authenticate,
  validateParams(medicationIdSchema),
  validateBody(z.object({
    scheduledAt: z.string().datetime(),
    notes: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;
    const { scheduledAt, notes } = req.body;

    const log = await medicationService.markMedicationSkipped(
      userId,
      medicationId,
      new Date(scheduledAt),
      notes
    );

    logAuditEvent(userId, 'medication.skipped', medicationId);

    res.json({ log });
  })
);

/**
 * GET /api/medications/:medicationId/logs
 * Get medication log history
 */
medicationRouter.get(
  '/:medicationId/logs',
  authenticate,
  validateParams(medicationIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await medicationService.getMedicationLogs(userId, medicationId, limit, offset);

    res.json({ logs });
  })
);
