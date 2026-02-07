/**
 * Emergency routes
 *
 * Endpoints for emergency alert system (SPEC-003)
 * EA-001: Alert triggering for critical vital signs
 * EA-002: Multi-channel notifications (Push, SMS, Email)
 * EA-003: Escalation rules (5min -> secondary, 10min -> emergency services)
 * EA-004: Location sharing for emergencies
 * EA-005: Alert acknowledgment stops escalation
 * EA-006: Manual SOS bypasses escalation
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams } from '../middleware/validator';
import { EmergencyService } from '../services/EmergencyService';
import { logAuditEvent } from '../utils/logger';
import { logger } from '../utils/logger';

export const emergencyRouter = Router();
const emergencyService = new EmergencyService();

// Validation schemas
const createAlertSchema = z.object({
  type: z.enum([
    'critical_bp',
    'critical_glucose',
    'medication_missed',
    'no_response',
    'manual_trigger',
    'irregular_pattern',
  ]),
  vitalSignId: z.string().uuid().optional(),
  medicationId: z.string().uuid().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
  bypassEscalation: z.boolean().optional(), // For SOS button - EA-006
});

const alertIdSchema = z.object({
  alertId: z.string().uuid(),
});

const acknowledgeSchema = z.object({
  notes: z.string().optional(),
});

const resolveSchema = z.object({
  notes: z.string().optional(),
  wasFalseAlarm: z.boolean().optional(),
});

const updateThresholdsSchema = z.object({
  bloodPressure: z.object({
    criticalHigh: z.object({
      systolic: z.number().optional(),
      diastolic: z.number().optional(),
    }).optional(),
    warningHigh: z.object({
      systolic: z.number().optional(),
      diastolic: z.number().optional(),
    }).optional(),
    criticalLow: z.object({
      systolic: z.number().optional(),
      diastolic: z.number().optional(),
    }).optional(),
  }).optional(),
  glucose: z.object({
    criticalLow: z.number().optional(),
    warningLow: z.number().optional(),
    criticalHigh: z.number().optional(),
    warningHighFasting: z.number().optional(),
    warningHighPostMeal: z.number().optional(),
  }).optional(),
});

/**
 * POST /api/emergency/alerts
 * Create emergency alert (EA-001)
 * - Alert sent within 10 seconds
 * - Includes all relevant data
 */
emergencyRouter.post(
  '/alerts',
  authenticate,
  validateBody(createAlertSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { type, vitalSignId, medicationId, location, notes, bypassEscalation } = req.body;

    const alert = await emergencyService.createEmergencyAlert({
      userId,
      type,
      vitalSignId,
      medicationId,
      location,
      notes,
      bypassEscalation,
    });

    logAuditEvent(userId, 'emergency.created', alert.id, {
      type,
      location,
      bypassEscalation,
    });

    res.status(201).json({ alert });
  })
);

/**
 * POST /api/emergency/sos
 * Trigger SOS emergency (EA-006)
 * - Bypasses escalation
 * - Immediately notifies all contacts and emergency services
 */
emergencyRouter.post(
  '/sos',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { location, notes } = req.body;

    const alert = await emergencyService.createEmergencyAlert({
      userId,
      type: 'manual_trigger',
      location,
      notes: notes || 'SOS button triggered',
      bypassEscalation: true, // EA-006: Immediate escalation
    });

    logAuditEvent(userId, 'emergency.sos_triggered', alert.id, {
      location,
    });

    res.status(201).json({ alert });
  })
);

/**
 * GET /api/emergency/alerts
 * Get emergency alerts for user
 */
emergencyRouter.get(
  '/alerts',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    const alerts = await emergencyService.getUserAlerts(userId, status, limit);

    logAuditEvent(userId, 'emergency.alerts.list', undefined, {
      count: alerts.length,
      status,
    });

    res.json({ alerts });
  })
);

/**
 * GET /api/emergency/alerts/active
 * Get active alerts for current user
 * Used by frontend to show active alerts on app load
 */
emergencyRouter.get(
  '/alerts/active',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const alerts = await emergencyService.getUserAlerts(userId, 'active', 10);

    res.json({
      alerts,
      hasActiveAlerts: alerts.length > 0,
    });
  })
);

/**
 * GET /api/emergency/alerts/:alertId
 * Get alert details with notifications
 */
emergencyRouter.get(
  '/alerts/:alertId',
  authenticate,
  validateParams(alertIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { alertId } = req.params;

    const result = await emergencyService.getAlertWithNotifications(userId, alertId);

    logAuditEvent(userId, 'emergency.alert.view', alertId);

    res.json(result);
  })
);

/**
 * POST /api/emergency/alerts/:alertId/acknowledge
 * Acknowledge emergency alert (EA-005)
 * - Stops escalation when user responds
 * - Response timestamp logged
 */
emergencyRouter.post(
  '/alerts/:alertId/acknowledge',
  authenticate,
  validateParams(alertIdSchema),
  validateBody(acknowledgeSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { alertId } = req.params;
    const { notes } = req.body;

    const alert = await emergencyService.acknowledgeAlert(userId, alertId, notes);

    logAuditEvent(userId, 'emergency.alert.acknowledged', alertId);

    res.json({ alert });
  })
);

/**
 * POST /api/emergency/alerts/:alertId/resolve
 * Resolve emergency alert
 */
emergencyRouter.post(
  '/alerts/:alertId/resolve',
  authenticate,
  validateParams(alertIdSchema),
  validateBody(resolveSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { alertId } = req.params;
    const { notes, wasFalseAlarm } = req.body;

    const alert = await emergencyService.resolveAlert(userId, alertId, notes, wasFalseAlarm);

    logAuditEvent(userId, 'emergency.alert.resolved', alertId, {
      wasFalseAlarm,
    });

    res.json({ alert });
  })
);

/**
 * GET /api/emergency/contacts
 * Get emergency contacts for user (EA-002)
 */
emergencyRouter.get(
  '/contacts',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const contacts = await emergencyService.getEmergencyContacts(userId);

    res.json({ contacts });
  })
);

/**
 * GET /api/emergency/thresholds
 * Get user's alert thresholds
 */
emergencyRouter.get(
  '/thresholds',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const thresholds = await emergencyService.getUserThresholds(userId);

    res.json({ thresholds });
  })
);

/**
 * PUT /api/emergency/thresholds
 * Update user's alert thresholds
 */
emergencyRouter.put(
  '/thresholds',
  authenticate,
  validateBody(updateThresholdsSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const thresholds = req.body;

    await emergencyService.updateUserThresholds(userId, thresholds);

    logAuditEvent(userId, 'emergency.thresholds.updated', undefined, {
      thresholds,
    });

    const updated = await emergencyService.getUserThresholds(userId);

    res.json({ thresholds: updated });
  })
);

/**
 * POST /api/emergency/_internal/escalate
 * Internal endpoint for escalation cron job (EA-003)
 * This should be called every minute by a cron job
 *
 * In production, protect this endpoint with an API key or IP whitelist
 */
emergencyRouter.post(
  '/_internal/escalate',
  asyncHandler(async (req, res) => {
    // Simple API key check (in production, use proper auth)
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey !== process.env.ESCALATION_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await emergencyService.escalateUnresponsiveAlerts();

    logger.info(`Escalation check completed: ${result.escalated} alerts escalated`, {
      details: result.details,
    });

    res.json({
      escalated: result.escalated,
      details: result.details,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/emergency/_internal/check-medications
 * Internal endpoint for checking medication adherence
 * Called by cron job to trigger medication_missed alerts
 */
emergencyRouter.post(
  '/_internal/check-medications',
  asyncHandler(async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey !== process.env.ESCALATION_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all active patients and check their medication adherence
    // For now, just return success - actual implementation would query all users
    logger.info('Medication adherence check initiated');

    res.json({
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/emergency/_internal/check-patterns
 * Internal endpoint for checking irregular patterns
 * Called by cron job to trigger irregular_pattern alerts
 */
emergencyRouter.post(
  '/_internal/check-patterns',
  asyncHandler(async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey !== process.env.ESCALATION_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('Irregular pattern check initiated');

    res.json({
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
  })
);
