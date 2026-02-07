/**
 * Caregiver routes (SPEC-005)
 *
 * Endpoints for caregiver-patient relationships, notifications, and patient monitoring
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams } from '../middleware/validator';
import { CaregiverService } from '../services/CaregiverService';
import { caregiverNotificationService } from '../services/CaregiverNotificationService';
import { logAuditEvent } from '../utils/logger';

export const caregiverRouter = Router();
const caregiverService = new CaregiverService();

// ============================================================================
// Validation Schemas
// ============================================================================

const inviteCaregiverSchema = z.object({
  email: z.string().email(),
  role: z.enum(['primary', 'secondary', 'professional']),
  notificationPreferences: z.object({
    medicationMissed: z.boolean().default(true),
    vitalAbnormal: z.boolean().default(true),
    emergencyAlerts: z.boolean().default(true),
    quietHours: z.object({
      enabled: z.boolean().default(false),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('22:00'),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('08:00'),
    }),
  }).optional(),
  professionalSchedule: z.record(z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  })).optional(),
});

const acceptInviteSchema = z.object({
  token: z.string(),
});

const caregiverRelationshipIdSchema = z.object({
  relationshipId: z.string().uuid(),
});

const patientIdSchema = z.object({
  patientId: z.string().uuid(),
});

const updatePreferencesSchema = z.object({
  notificationPreferences: z.object({
    medicationMissed: z.boolean().optional(),
    vitalAbnormal: z.boolean().optional(),
    emergencyAlerts: z.boolean().optional(),
    quietHours: z.object({
      enabled: z.boolean().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }).optional(),
});

const updateScheduleSchema = z.object({
  professionalSchedule: z.record(z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  })),
});

const logActionSchema = z.object({
  alertId: z.string().uuid().optional(),
  notificationId: z.string().uuid().optional(),
  type: z.enum(['acknowledged', 'called_patient', 'called_emergency', 'marked_skipped', 'added_note']),
  notes: z.string().optional(),
});

const acknowledgeNotificationSchema = z.object({
  notificationId: z.string().uuid(),
});

// ============================================================================
// Patient Management Routes (CG-001, CG-004)
// ============================================================================

/**
 * GET /api/caregivers/patients
 * Get patients for current caregiver (CG-001)
 */
caregiverRouter.get(
  '/patients',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const patients = await caregiverService.getCaregiverPatients(userId);

    logAuditEvent(userId, 'caregiver.patients.list', undefined, {
      count: patients.length,
    });

    res.json({ patients });
  })
);

/**
 * GET /api/caregivers/patients/:patientId/status
 * Get patient status for dashboard card
 */
caregiverRouter.get(
  '/patients/:patientId/status',
  authenticate,
  validateParams(patientIdSchema),
  asyncHandler(async (req, res) => {
    const caregiverId = req.user!.id;
    const { patientId } = req.params;

    const status = await caregiverService.getPatientStatus(caregiverId, patientId);

    logAuditEvent(caregiverId, 'caregiver.patient_status', patientId);

    res.json(status);
  })
);

/**
 * GET /api/caregivers/patients/:patientId/detail
 * Get detailed patient information (CG-004)
 */
caregiverRouter.get(
  '/patients/:patientId/detail',
  authenticate,
  validateParams(patientIdSchema),
  asyncHandler(async (req, res) => {
    const caregiverId = req.user!.id;
    const { patientId } = req.params;

    const detail = await caregiverService.getPatientDetail(caregiverId, patientId);

    logAuditEvent(caregiverId, 'caregiver.patient_detail', patientId);

    res.json(detail);
  })
);

/**
 * GET /api/caregivers/patients/:patientId/activity
 * Get caregiver activity log for a patient (CG-007)
 */
caregiverRouter.get(
  '/patients/:patientId/activity',
  authenticate,
  validateParams(patientIdSchema),
  asyncHandler(async (req, res) => {
    const caregiverId = req.user!.id;
    const { patientId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    // Verify access first
    await caregiverService.getPatientStatus(caregiverId, patientId);

    const activity = await caregiverService.getCaregiverActions(patientId, limit);

    logAuditEvent(caregiverId, 'caregiver.patient_activity', patientId);

    res.json({ activity });
  })
);

// ============================================================================
// Relationship Management Routes
// ============================================================================

/**
 * POST /api/caregivers/invite
 * Invite a caregiver (sent by patient)
 */
caregiverRouter.post(
  '/invite',
  authenticate,
  validateBody(inviteCaregiverSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { email, role, notificationPreferences, professionalSchedule } = req.body;

    const invite = await caregiverService.inviteCaregiver(userId, {
      email,
      role,
      notificationPreferences,
      professionalSchedule,
    });

    logAuditEvent(userId, 'caregiver.invited', invite.id, {
      email,
      role,
    });

    res.status(201).json({ invite });
  })
);

/**
 * POST /api/caregivers/accept
 * Accept caregiver invite
 */
caregiverRouter.post(
  '/accept',
  authenticate,
  validateBody(acceptInviteSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { token } = req.body;

    const relationship = await caregiverService.acceptInvite(userId, token);

    logAuditEvent(userId, 'caregiver.invite_accepted', relationship.id);

    res.json({ relationship });
  })
);

/**
 * DELETE /api/caregivers/relationships/:relationshipId
 * Remove caregiver relationship
 */
caregiverRouter.delete(
  '/relationships/:relationshipId',
  authenticate,
  validateParams(caregiverRelationshipIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { relationshipId } = req.params;

    await caregiverService.removeRelationship(userId, relationshipId);

    logAuditEvent(userId, 'caregiver.relationship_removed', relationshipId);

    res.status(204).send();
  })
);

/**
 * PUT /api/caregivers/relationships/:relationshipId/preferences
 * Update notification preferences
 */
caregiverRouter.put(
  '/relationships/:relationshipId/preferences',
  authenticate,
  validateParams(caregiverRelationshipIdSchema),
  validateBody(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { relationshipId } = req.params;
    const { notificationPreferences } = req.body;

    const relationship = await caregiverService.updateNotificationPreferences(
      userId,
      relationshipId,
      notificationPreferences
    );

    logAuditEvent(userId, 'caregiver.preferences_updated', relationshipId);

    res.json({ relationship });
  })
);

/**
 * PUT /api/caregivers/relationships/:relationshipId/schedule
 * Update professional schedule (CG-008)
 */
caregiverRouter.put(
  '/relationships/:relationshipId/schedule',
  authenticate,
  validateParams(caregiverRelationshipIdSchema),
  validateBody(updateScheduleSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { relationshipId } = req.params;
    const { professionalSchedule } = req.body;

    const relationship = await caregiverService.updateProfessionalSchedule(
      userId,
      relationshipId,
      professionalSchedule
    );

    logAuditEvent(userId, 'caregiver.schedule_updated', relationshipId);

    res.json({ relationship });
  })
);

/**
 * POST /api/caregivers/relationships/:relationshipId/pause
 * Pause notifications for a relationship
 */
caregiverRouter.post(
  '/relationships/:relationshipId/pause',
  authenticate,
  validateParams(caregiverRelationshipIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { relationshipId } = req.params;

    const relationship = await caregiverService.pauseNotifications(userId, relationshipId);

    logAuditEvent(userId, 'caregiver.notifications_paused', relationshipId);

    res.json({ relationship });
  })
);

/**
 * POST /api/caregivers/relationships/:relationshipId/resume
 * Resume notifications for a relationship
 */
caregiverRouter.post(
  '/relationships/:relationshipId/resume',
  authenticate,
  validateParams(caregiverRelationshipIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { relationshipId } = req.params;

    const relationship = await caregiverService.resumeNotifications(userId, relationshipId);

    logAuditEvent(userId, 'caregiver.notifications_resumed', relationshipId);

    res.json({ relationship });
  })
);

// ============================================================================
// Caregiver Actions Routes (CG-005, CG-007)
// ============================================================================

/**
 * POST /api/caregivers/patients/:patientId/actions
 * Log a caregiver action (CG-007)
 */
caregiverRouter.post(
  '/patients/:patientId/actions',
  authenticate,
  validateParams(patientIdSchema),
  validateBody(logActionSchema),
  asyncHandler(async (req, res) => {
    const caregiverId = req.user!.id;
    const { patientId } = req.params;
    const { alertId, notificationId, type, notes } = req.body;

    // Verify access
    await caregiverService.getPatientStatus(caregiverId, patientId);

    const action = await caregiverService.logCaregiverAction({
      patientId,
      caregiverId,
      alertId,
      notificationId,
      type,
      notes,
    });

    logAuditEvent(caregiverId, 'caregiver.action_logged', patientId, {
      actionType: type,
    });

    res.status(201).json({ action });
  })
);

// ============================================================================
// Notification Routes
// ============================================================================

/**
 * GET /api/caregivers/notifications
 * Get pending notifications for current caregiver
 */
caregiverRouter.get(
  '/notifications',
  authenticate,
  asyncHandler(async (req, res) => {
    const caregiverId = req.user!.id;

    const notifications = await caregiverNotificationService.getPendingNotifications(caregiverId);

    logAuditEvent(caregiverId, 'caregiver.notifications_list', undefined, {
      count: notifications.length,
    });

    res.json({ notifications });
  })
);

/**
 * POST /api/caregivers/notifications/acknowledge
 * Acknowledge a notification
 */
caregiverRouter.post(
  '/notifications/acknowledge',
  authenticate,
  validateBody(acknowledgeNotificationSchema),
  asyncHandler(async (req, res) => {
    const caregiverId = req.user!.id;
    const { notificationId } = req.body;

    const notification = await caregiverNotificationService.acknowledgeNotification(
      notificationId,
      caregiverId
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    logAuditEvent(caregiverId, 'caregiver.notification_acknowledged', notificationId);

    res.json({ notification });
  })
);

// ============================================================================
// Summary Route (Legacy - for backward compatibility)
// ============================================================================

/**
 * GET /api/caregivers/patients/:patientId/summary
 * Get patient summary for caregiver (Legacy - use /detail instead)
 */
caregiverRouter.get(
  '/patients/:patientId/summary',
  authenticate,
  validateParams(patientIdSchema),
  asyncHandler(async (req, res) => {
    const caregiverId = req.user!.id;
    const { patientId } = req.params;

    const detail = await caregiverService.getPatientDetail(caregiverId, patientId);

    // Convert to legacy summary format
    const summary = {
      patient: detail.patient,
      medications: {
        total: detail.medications.week.total,
        takenToday: detail.medications.today.filter(m => m.status === 'taken').length,
        missedToday: detail.medications.today.filter(m => m.status === 'missed').length,
        upcoming: detail.medications.today
          .filter(m => m.status === 'pending')
          .map(m => ({
            id: m.id,
            name: m.name,
            scheduledTime: m.scheduledTime,
          })),
      },
      vitalSigns: {
        latestBP: detail.vitals.bloodPressure[0]
          ? {
              systolic: detail.vitals.bloodPressure[0].systolic,
              diastolic: detail.vitals.bloodPressure[0].diastolic,
              measuredAt: detail.vitals.bloodPressure[0].measuredAt,
              isAbnormal: detail.vitals.bloodPressure[0].isAbnormal,
            }
          : undefined,
        latestGlucose: detail.vitals.glucose[0]
          ? {
              value: detail.vitals.glucose[0].value.toString(),
              measuredAt: detail.vitals.glucose[0].measuredAt,
              isAbnormal: detail.vitals.glucose[0].isAbnormal,
            }
          : undefined,
      },
      alerts: {
        activeCount: detail.alerts.filter(a => a.status === 'active').length,
        recent: detail.alerts.slice(0, 5).map(a => ({
          id: a.id,
          type: a.type,
          createdAt: a.createdAt,
        })),
      },
    };

    logAuditEvent(caregiverId, 'caregiver.patient_summary', patientId);

    res.json(summary);
  })
);
