/**
 * Appointment routes
 *
 * Endpoints for consultation booking and management
 * SPEC-004: Telemedicine Integration Module
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validator';
import { AppointmentService } from '../services/AppointmentService';
import { logAuditEvent } from '../utils/logger';

export const appointmentsRouter = Router();
const appointmentService = new AppointmentService();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const appointmentTypeSchema = z.enum(['in_person', 'video', 'async_message']);
const appointmentStatusSchema = z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']);
const paymentMethodSchema = z.enum(['insurance', 'credit_card', 'paypal', 'apple_pay', 'google_pay']);
const paymentStatusSchema = z.enum(['pending', 'processing', 'paid', 'refunded', 'failed']);

// ============================================================================
// APPOINTMENT MANAGEMENT
// ============================================================================

/**
 * GET /api/appointments
 * Get user's appointments
 */
appointmentsRouter.get(
  '/',
  authenticate,
  validateQuery(z.object({
    status: appointmentStatusSchema.optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { status, limit, offset } = req.query;

    const appointments = await appointmentService.getUserAppointments(
      userId,
      status as any,
      limit as number,
      offset as number
    );

    logAuditEvent(userId, 'appointments.list', undefined, {
      count: appointments.length,
      status,
    });

    res.json({ appointments, total: appointments.length });
  })
);

/**
 * GET /api/appointments/upcoming
 * Get upcoming appointments
 */
appointmentsRouter.get(
  '/upcoming',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const appointments = await appointmentService.getUserAppointments(
      userId,
      'scheduled',
      50,
      0
    );

    // Filter for future appointments only
    const upcoming = appointments.filter(a => new Date(a.scheduledAt) > new Date());

    res.json({ appointments: upcoming });
  })
);

/**
 * GET /api/appointments/:appointmentId
 * Get appointment details
 */
appointmentsRouter.get(
  '/:appointmentId',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;

    const appointment = await appointmentService.getAppointmentDetail(appointmentId);

    // Verify user has access to this appointment
    if (appointment.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this appointment',
        code: 'FORBIDDEN',
      });
    }

    logAuditEvent(userId, 'appointments.view', appointmentId);

    res.json({ appointment });
  })
);

/**
 * POST /api/appointments
 * Create a new appointment
 */
appointmentsRouter.post(
  '/',
  authenticate,
  validateBody(z.object({
    providerId: z.string().uuid(),
    type: appointmentTypeSchema,
    scheduledAt: z.string().datetime(),
    duration: z.number().min(5).max(120).optional(),
    reason: z.string().min(5).max(500),
    notes: z.string().max(1000).optional(),
    includeHealthSummary: z.boolean().optional(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const {
      providerId,
      type,
      scheduledAt,
      duration,
      reason,
      notes,
      includeHealthSummary,
    } = req.body;

    const appointment = await appointmentService.createAppointment({
      userId,
      providerId,
      type,
      scheduledAt: new Date(scheduledAt),
      duration,
      reason,
      notes,
      includeHealthSummary,
    });

    logAuditEvent(userId, 'appointments.create', appointment.id, {
      providerId,
      type,
      scheduledAt,
    });

    res.status(201).json({ appointment });
  })
);

/**
 * PATCH /api/appointments/:appointmentId/status
 * Update appointment status
 */
appointmentsRouter.patch(
  '/:appointmentId/status',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  validateBody(z.object({
    status: appointmentStatusSchema,
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;
    const { status } = req.body;

    const appointment = await appointmentService.getAppointmentById(appointmentId);

    // Verify user has access (can be patient or provider)
    if (appointment.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this appointment',
        code: 'FORBIDDEN',
      });
    }

    const updated = await appointmentService.updateAppointmentStatus(appointmentId, status, userId);

    logAuditEvent(userId, 'appointments.status_update', appointmentId, {
      oldStatus: appointment.status,
      newStatus: status,
    });

    res.json({ appointment: updated });
  })
);

/**
 * POST /api/appointments/:appointmentId/cancel
 * Cancel appointment
 */
appointmentsRouter.post(
  '/:appointmentId/cancel',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  validateBody(z.object({
    reason: z.string().max(500).optional(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;
    const { reason } = req.body;

    const appointment = await appointmentService.cancelAppointment(appointmentId, userId, reason);

    logAuditEvent(userId, 'appointments.cancel', appointmentId, {
      reason,
    });

    res.json({ appointment });
  })
);

/**
 * POST /api/appointments/:appointmentId/reschedule
 * Reschedule appointment
 */
appointmentsRouter.post(
  '/:appointmentId/reschedule',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  validateBody(z.object({
    scheduledAt: z.string().datetime(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;
    const { scheduledAt } = req.body;

    const appointment = await appointmentService.rescheduleAppointment(
      appointmentId,
      new Date(scheduledAt),
      userId
    );

    logAuditEvent(userId, 'appointments.reschedule', appointmentId, {
      newScheduledAt: scheduledAt,
    });

    res.json({ appointment });
  })
);

// ============================================================================
// AVAILABLE SLOTS
// ============================================================================

/**
 * GET /api/appointments/slots/available
 * Get available time slots for a provider
 */
appointmentsRouter.get(
  '/slots/available',
  authenticate,
  validateQuery(z.object({
    providerId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    consultationType: appointmentTypeSchema.optional(),
  })),
  asyncHandler(async (req, res) => {
    const { providerId, date, consultationType = 'video' } = req.query;

    const slots = await appointmentService.getAvailableSlots(
      providerId as string,
      new Date(date as string),
      consultationType as any
    );

    res.json({ slots });
  })
);

// ============================================================================
// VIDEO CALL
// ============================================================================

/**
 * POST /api/appointments/:appointmentId/video/start
 * Start video call
 */
appointmentsRouter.post(
  '/:appointmentId/video/start',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;

    const session = await appointmentService.startVideoCall(appointmentId, userId);

    logAuditEvent(userId, 'appointments.video_start', appointmentId);

    res.json({ session });
  })
);

/**
 * POST /api/appointments/:appointmentId/video/end
 * End video call
 */
appointmentsRouter.post(
  '/:appointmentId/video/end',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;

    const session = await appointmentService.endVideoCall(appointmentId, userId);

    logAuditEvent(userId, 'appointments.video_end', appointmentId, {
      duration: session.durationSeconds,
    });

    res.json({ session });
  })
);

// ============================================================================
// CONSULTATION NOTES
// ============================================================================

/**
 * GET /api/appointments/:appointmentId/notes
 * Get consultation notes for an appointment
 */
appointmentsRouter.get(
  '/:appointmentId/notes',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;

    // Verify user has access
    const appointment = await appointmentService.getAppointmentById(appointmentId);
    if (appointment.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to these notes',
        code: 'FORBIDDEN',
      });
    }

    const notes = await appointmentService.getConsultationNotes(appointmentId);

    logAuditEvent(userId, 'appointments.notes_view', appointmentId);

    res.json({ notes });
  })
);

/**
 * POST /api/appointments/:appointmentId/notes
 * Create consultation notes (provider only)
 */
appointmentsRouter.post(
  '/:appointmentId/notes',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  validateBody(z.object({
    providerId: z.string().uuid(),
    chiefComplaint: z.string().optional(),
    subjectiveNotes: z.string().optional(),
    objectiveNotes: z.string().optional(),
    assessment: z.string().optional(),
    treatmentPlan: z.object({}).optional(),
    followUpInstructions: z.string().optional(),
    prescribedMedications: z.object({}).optional(),
    vitalsDuringConsultation: z.object({}).optional(),
    isConfidential: z.boolean().optional(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;
    const notesData = req.body;

    // In production, verify user is a provider
    const notes = await appointmentService.createConsultationNotes({
      appointmentId,
      ...notesData,
    });

    logAuditEvent(userId, 'appointments.notes_create', appointmentId);

    res.status(201).json({ notes });
  })
);

// ============================================================================
// TREATMENT PLAN UPDATES
// ============================================================================

/**
 * GET /api/appointments/treatment-updates
 * Get treatment plan updates for current user
 */
appointmentsRouter.get(
  '/treatment-updates',
  authenticate,
  validateQuery(z.object({
    limit: z.coerce.number().min(1).max(100).default(10),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { limit } = req.query;

    const updates = await appointmentService.getTreatmentPlanUpdates(userId, limit as number);

    res.json({ updates });
  })
);

/**
 * POST /api/appointments/:appointmentId/treatment-plan
 * Create treatment plan update
 */
appointmentsRouter.post(
  '/:appointmentId/treatment-plan',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  validateBody(z.object({
    userId: z.string().uuid(),
    medicationChanges: z.object({}).optional(),
    newMeasurementFrequencies: z.object({}).optional(),
    lifestyleRecommendations: z.array(z.string()).optional(),
    followUpScheduledAt: z.string().datetime().optional(),
    followUpProviderId: z.string().uuid().optional(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id; // The provider creating the update
    const { appointmentId } = req.params;
    const updateData = req.body;

    const update = await appointmentService.createTreatmentPlanUpdate({
      appointmentId,
      ...updateData,
      updatedBy: userId,
    });

    logAuditEvent(userId, 'appointments.treatment_plan_create', appointmentId);

    res.status(201).json({ update });
  })
);

// ============================================================================
// HEALTH SUMMARY
// ============================================================================

/**
 * GET /api/appointments/health-summary
 * Generate health summary for current user
 */
appointmentsRouter.get(
  '/health-summary',
  authenticate,
  validateQuery(z.object({
    period: z.enum(['7d', '30d', '90d']).default('30d'),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { period } = req.query;

    const summary = await appointmentService.generateHealthSummary(userId, period as any);

    logAuditEvent(userId, 'appointments.health_summary', undefined, {
      period,
    });

    res.json({ summary });
  })
);

/**
 * POST /api/appointments/health-summary
 * Create saved health summary (for PDF export)
 */
appointmentsRouter.post(
  '/health-summary',
  authenticate,
  validateBody(z.object({
    period: z.enum(['7d', '30d', '90d']).default('30d'),
    appointmentId: z.string().uuid().optional(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { period, appointmentId } = req.body;

    const result = await appointmentService.createHealthSummary(
      userId,
      period,
      appointmentId,
      userId
    );

    logAuditEvent(userId, 'appointments.health_summary_create', result.id, {
      period,
    });

    res.status(201).json({ id: result.id, summary: result.summaryData });
  })
);

/**
 * GET /api/appointments/health-summary/:summaryId
 * Get saved health summary
 */
appointmentsRouter.get(
  '/health-summary/:summaryId',
  authenticate,
  validateParams(z.object({
    summaryId: z.string().uuid(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { summaryId } = req.params;

    const summary = await appointmentService.getHealthSummary(summaryId);

    // Verify ownership
    const appointment = await appointmentService.getAppointmentById(summary.appointmentId || '');
    if (appointment.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this summary',
        code: 'FORBIDDEN',
      });
    }

    logAuditEvent(userId, 'appointments.health_summary_view', summaryId);

    res.json({ summary });
  })
);

// ============================================================================
// PAYMENT
// ============================================================================

/**
 * GET /api/appointments/:appointmentId/payment
 * Get payment details for an appointment
 */
appointmentsRouter.get(
  '/:appointmentId/payment',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;

    // Verify access
    const appointment = await appointmentService.getAppointmentById(appointmentId);
    if (appointment.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this payment',
        code: 'FORBIDDEN',
      });
    }

    const payment = await appointmentService.getPaymentByAppointment(appointmentId);

    res.json({ payment });
  })
);

/**
 * POST /api/appointments/:appointmentId/payment
 * Create payment record for an appointment
 */
appointmentsRouter.post(
  '/:appointmentId/payment',
  authenticate,
  validateParams(z.object({
    appointmentId: z.string().uuid(),
  })),
  validateBody(z.object({
    amount: z.number().positive(),
    currency: z.string().length(3).default('USD'),
    method: paymentMethodSchema,
    insuranceProvider: z.string().optional(),
    insuranceMemberId: z.string().optional(),
    insurancePreAuthorization: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { appointmentId } = req.params;
    const paymentData = req.body;

    // Verify access
    const appointment = await appointmentService.getAppointmentById(appointmentId);
    if (appointment.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this appointment',
        code: 'FORBIDDEN',
      });
    }

    const payment = await appointmentService.createPayment({
      appointmentId,
      userId,
      ...paymentData,
    });

    logAuditEvent(userId, 'appointments.payment_create', appointmentId, {
      amount: paymentData.amount,
      method: paymentData.method,
    });

    res.status(201).json({ payment });
  })
);

/**
 * PATCH /api/appointments/payments/:paymentId/status
 * Update payment status (webhook endpoint)
 */
appointmentsRouter.patch(
  '/payments/:paymentId/status',
  validateParams(z.object({
    paymentId: z.string().uuid(),
  })),
  validateBody(z.object({
    status: paymentStatusSchema,
    transactionId: z.string().optional(),
    gatewayResponse: z.object({}).optional(),
  })),
  asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const { status, transactionId, gatewayResponse } = req.body;

    const payment = await appointmentService.updatePaymentStatus(
      paymentId,
      status,
      transactionId,
      gatewayResponse
    );

    res.json({ payment });
  })
);
