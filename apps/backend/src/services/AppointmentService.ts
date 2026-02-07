/**
 * Appointment Service
 *
 * Handles consultation booking, management, and video call integration
 * SPEC-004: Telemedicine Integration Module
 */

import { query, queryOne, transaction } from '../database/connection';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

// ============================================================================
// TYPES
// ============================================================================

export type AppointmentType = 'in_person' | 'video' | 'async_message';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type PaymentMethod = 'insurance' | 'credit_card' | 'paypal' | 'apple_pay' | 'google_pay';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'refunded' | 'failed';
export type VideoSdkProvider = 'agora' | 'twilio' | 'daily';

export interface TimeSlot {
  slotTime: string;
  slotEndTime: string;
  isAvailable: boolean;
}

export interface Appointment {
  id: string;
  userId: string;
  providerId: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: Date;
  duration: number;
  reason: string;
  notes?: string;
  healthDataSnapshot?: Record<string, unknown>;
  videoCallLink?: string;
  videoCallToken?: string;
  reminderSent: boolean;
  reminderAt?: Date;
  calendarEventId?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  noShowAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentDetail extends Appointment {
  providerName: string;
  providerSpecialty?: string;
  providerClinicName?: string;
  providerPhone?: string;
  providerEmail?: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
}

export interface ConsultationNote {
  id: string;
  appointmentId: string;
  providerId: string;
  chiefComplaint?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessment?: string;
  treatmentPlan?: Record<string, unknown>;
  followUpInstructions?: string;
  prescribedMedications?: Record<string, unknown>;
  vitalsDuringConsultation?: Record<string, unknown>;
  isConfidential: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TreatmentPlanUpdate {
  id: string;
  appointmentId: string;
  userId: string;
  updatedBy: string;
  medicationChanges?: Record<string, unknown>;
  newMeasurementFrequencies?: Record<string, unknown>;
  lifestyleRecommendations?: string[];
  followUpScheduledAt?: Date;
  followUpProviderId?: string;
  createdAt: Date;
}

export interface ConsultationPayment {
  id: string;
  appointmentId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  insuranceProvider?: string;
  insuranceMemberId?: string;
  insurancePreAuthorization?: string;
  paymentGatewayTransactionId?: string;
  paymentGatewayResponse?: Record<string, unknown>;
  refundedAt?: Date;
  refundAmount?: number;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoCallSession {
  id: string;
  appointmentId: string;
  providerId: string;
  userId: string;
  providerSdk: VideoSdkProvider;
  sessionId: string;
  providerToken: string;
  userToken: string;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  recordingUrl?: string;
  recordingStatus: 'none' | 'requested' | 'processing' | 'available' | 'failed';
  technicalIssues?: Record<string, unknown>;
  createdAt: Date;
}

export interface HealthSummary {
  period: string;
  bloodPressureSummary?: {
    average: { systolic: number; diastolic: number };
    highest: { systolic: number; diastolic: number };
    lowest: { systolic: number; diastolic: number };
    readings: number;
  };
  glucoseSummary?: {
    average: number;
    highest: number;
    lowest: number;
    readings: number;
  };
  medicationAdherence?: {
    onTime: number;
    missed: number;
    total: number;
  };
  alertsCount: number;
  medicationsCurrent?: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    times: string[];
  }>;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class AppointmentService {
  // ========================================================================
  // APPOINTMENT MANAGEMENT
  // ========================================================================

  /**
   * Get available time slots for a provider
   */
  async getAvailableSlots(
    providerId: string,
    date: Date,
    consultationType: AppointmentType = 'video'
  ): Promise<TimeSlot[]> {
    const dateStr = date.toISOString().split('T')[0];
    const type = consultationType === 'async_message' ? 'video' : consultationType;

    return query<TimeSlot>(
      'SELECT * FROM get_provider_available_slots($1, $2::date, $3)',
      [providerId, dateStr, type]
    );
  }

  /**
   * Create a new appointment
   */
  async createAppointment(data: {
    userId: string;
    providerId: string;
    type: AppointmentType;
    scheduledAt: Date;
    duration?: number;
    reason: string;
    notes?: string;
    includeHealthSummary?: boolean;
  }): Promise<Appointment> {
    const { userId, providerId, type, scheduledAt, duration = 20, reason, notes, includeHealthSummary = true } = data;

    // Verify provider exists
    const provider = await queryOne<{ id: string; consultationTypes: string[] }>(
      'SELECT id, consultation_type FROM healthcare_providers WHERE id = $1',
      [providerId]
    );

    if (!provider) {
      throw new NotFoundError('Healthcare provider');
    }

    // Verify provider offers this consultation type
    if (!provider.consultationTypes.includes(type)) {
      throw new ValidationError('Provider does not offer this consultation type');
    }

    // Check if slot is available
    const slotAvailable = await this.isSlotAvailable(providerId, scheduledAt, type);
    if (!slotAvailable) {
      throw new ValidationError('Selected time slot is not available');
    }

    // Generate health data snapshot if requested
    let healthDataSnapshot: Record<string, unknown> | undefined;
    if (includeHealthSummary) {
      const summary = await this.generateHealthSummary(userId, '30d');
      healthDataSnapshot = summary;
    }

    // Create appointment
    const appointment = await queryOne<Pick<Appointment, 'id' | 'createdAt' | 'updatedAt'>>(
      `INSERT INTO appointments (
        user_id, provider_id, type, scheduled_at, duration, reason, notes, health_data_snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, created_at as "createdAt", updated_at as "updatedAt"`,
      [userId, providerId, type, scheduledAt, duration, reason, notes, JSON.stringify(healthDataSnapshot)]
    );

    if (!appointment) {
      throw new Error('Failed to create appointment');
    }

    // Generate video call link for video appointments
    if (type === 'video') {
      const videoSession = await this.createVideoCallSession(appointment.id, userId, providerId);
      await query(
        'UPDATE appointments SET video_call_link = $1, video_call_token = $2 WHERE id = $3',
        [videoSession.sessionId, videoSession.userToken, appointment.id]
      );
    }

    return this.getAppointmentById(appointment.id);
  }

  /**
   * Check if a time slot is available
   */
  private async isSlotAvailable(providerId: string, scheduledAt: Date, type: AppointmentType): Promise<boolean> {
    const existing = await queryOne<{ count: bigint }>(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE provider_id = $1
         AND type = $2
         AND scheduled_at = $3
         AND status IN ('scheduled', 'confirmed', 'in_progress')`,
      [providerId, type, scheduledAt]
    );

    return !existing || Number(existing.count) === 0;
  }

  /**
   * Get appointment by ID with full details
   */
  async getAppointmentById(appointmentId: string): Promise<Appointment> {
    const appointment = await queryOne<Appointment>(
      `SELECT id, user_id as "userId", provider_id as "providerId", type, status,
         scheduled_at as "scheduledAt", duration, reason, notes,
         health_data_snapshot as "healthDataSnapshot",
         video_call_link as "videoCallLink", video_call_token as "videoCallToken",
         reminder_sent as "reminderSent", reminder_at as "reminderAt",
         calendar_event_id as "calendarEventId",
         cancellation_reason as "cancellationReason",
         cancelled_at as "cancelledAt", cancelled_by as "cancelledBy",
         no_show_at as "noShowAt",
         created_at as "createdAt", updated_at as "updatedAt"
       FROM appointments WHERE id = $1`,
      [appointmentId]
    );

    if (!appointment) {
      throw new NotFoundError('Appointment');
    }

    return appointment;
  }

  /**
   * Get appointment with provider and user details
   */
  async getAppointmentDetail(appointmentId: string): Promise<AppointmentDetail> {
    const detail = await queryOne<AppointmentDetail>(
      `SELECT id, user_id as "userId", provider_id as "providerId", type, status,
         scheduled_at as "scheduledAt", duration, reason, notes,
         video_call_link as "videoCallLink", reminder_sent as "reminderSent",
         calendar_event_id as "calendarEventId",
         created_at as "createdAt", updated_at as "updatedAt",
         provider_name as "providerName", provider_specialty as "providerSpecialty",
         provider_clinic_name as "providerClinicName",
         provider_phone as "providerPhone", provider_email as "providerEmail",
         user_name as "userName", user_email as "userEmail", user_phone as "userPhone"
       FROM appointment_details WHERE id = $1`,
      [appointmentId]
    );

    if (!detail) {
      throw new NotFoundError('Appointment');
    }

    return detail;
  }

  /**
   * Get user's appointments
   */
  async getUserAppointments(
    userId: string,
    status?: AppointmentStatus,
    limit = 20,
    offset = 0
  ): Promise<AppointmentDetail[]> {
    let queryText = `
      SELECT id, user_id as "userId", provider_id as "providerId", type, status,
             scheduled_at as "scheduledAt", duration, reason, notes,
             video_call_link as "videoCallLink", reminder_sent as "reminderSent",
             calendar_event_id as "calendarEventId",
             created_at as "createdAt", updated_at as "updatedAt",
             provider_name as "providerName", provider_specialty as "providerSpecialty",
             provider_clinic_name as "providerClinicName",
             provider_phone as "providerPhone", provider_email as "providerEmail",
             user_name as "userName", user_email as "userEmail", user_phone as "userPhone"
      FROM appointment_details
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];

    if (status) {
      queryText += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    queryText += ' ORDER BY scheduled_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    return query<AppointmentDetail>(queryText, params);
  }

  /**
   * Get provider's appointments
   */
  async getProviderAppointments(
    providerId: string,
    status?: AppointmentStatus,
    startDate?: Date,
    endDate?: Date,
    limit = 20
  ): Promise<AppointmentDetail[]> {
    let queryText = `
      SELECT id, user_id as "userId", provider_id as "providerId", type, status,
             scheduled_at as "scheduledAt", duration, reason, notes,
             video_call_link as "videoCallLink", reminder_sent as "reminderSent",
             calendar_event_id as "calendarEventId",
             created_at as "createdAt", updated_at as "updatedAt",
             provider_name as "providerName", provider_specialty as "providerSpecialty",
             provider_clinic_name as "providerClinicName",
             provider_phone as "providerPhone", provider_email as "providerEmail",
             user_name as "userName", user_email as "userEmail", user_phone as "userPhone"
      FROM appointment_details
      WHERE provider_id = $1
    `;
    const params: unknown[] = [providerId];

    if (status) {
      queryText += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    if (startDate) {
      queryText += ' AND scheduled_at >= $' + (params.length + 1);
      params.push(startDate);
    }

    if (endDate) {
      queryText += ' AND scheduled_at <= $' + (params.length + 1);
      params.push(endDate);
    }

    queryText += ' ORDER BY scheduled_at ASC LIMIT $' + (params.length + 1);
    params.push(limit);

    return query<AppointmentDetail>(queryText, params);
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus,
    userId?: string
  ): Promise<Appointment> {
    const updateData: { status: AppointmentStatus; cancelledAt?: Date; cancelledBy?: string; noShowAt?: Date } = {
      status,
    };

    if (status === 'cancelled' && userId) {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = userId;
    }

    if (status === 'no_show') {
      updateData.noShowAt = new Date();
    }

    const updated = await queryOne<Pick<Appointment, 'id' | 'updatedAt'>>(
      'UPDATE appointments SET status = $1, cancelled_at = $2, cancelled_by = $3, no_show_at = $4, updated_at = NOW() WHERE id = $5 RETURNING id, updated_at as "updatedAt"',
      [status, updateData.cancelledAt || null, updateData.cancelledBy || null, updateData.noShowAt || null, appointmentId]
    );

    if (!updated) {
      throw new NotFoundError('Appointment');
    }

    return this.getAppointmentById(appointmentId);
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(appointmentId: string, userId: string, reason?: string): Promise<Appointment> {
    const appointment = await this.getAppointmentById(appointmentId);

    if (appointment.userId !== userId) {
      throw new ValidationError('You can only cancel your own appointments');
    }

    if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
      throw new ValidationError(`Cannot cancel appointment with status: ${appointment.status}`);
    }

    await query(
      `UPDATE appointments
       SET status = 'cancelled', cancellation_reason = $1, cancelled_at = NOW(), cancelled_by = $2, updated_at = NOW()
       WHERE id = $3`,
      [reason, userId, appointmentId]
    );

    return this.getAppointmentById(appointmentId);
  }

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(appointmentId: string, newScheduledAt: Date, userId: string): Promise<Appointment> {
    const appointment = await this.getAppointmentById(appointmentId);

    if (appointment.userId !== userId) {
      throw new ValidationError('You can only reschedule your own appointments');
    }

    if (['completed', 'cancelled', 'no_show', 'in_progress'].includes(appointment.status)) {
      throw new ValidationError(`Cannot reschedule appointment with status: ${appointment.status}`);
    }

    // Check if new slot is available
    const slotAvailable = await this.isSlotAvailable(appointment.providerId, newScheduledAt, appointment.type);
    if (!slotAvailable) {
      throw new ValidationError('Selected time slot is not available');
    }

    await query(
      'UPDATE appointments SET scheduled_at = $1, updated_at = NOW() WHERE id = $2',
      [newScheduledAt, appointmentId]
    );

    // Regenerate video call token for video appointments
    if (appointment.type === 'video') {
      await query(
        'DELETE FROM video_call_sessions WHERE appointment_id = $1',
        [appointmentId]
      );
      const videoSession = await this.createVideoCallSession(appointmentId, userId, appointment.providerId);
      await query(
        'UPDATE appointments SET video_call_link = $1, video_call_token = $2 WHERE id = $3',
        [videoSession.sessionId, videoSession.userToken, appointmentId]
      );
    }

    return this.getAppointmentById(appointmentId);
  }

  // ========================================================================
  // VIDEO CALL INTEGRATION
  // ========================================================================

  /**
   * Create video call session (placeholder for Agora/Twilio integration)
   */
  async createVideoCallSession(
    appointmentId: string,
    userId: string,
    providerId: string
  ): Promise<{ sessionId: string; userToken: string; providerToken: string }> {
    // Generate unique session ID
    const sessionId = `session_${appointmentId}_${Date.now()}`;

    // Placeholder tokens - in production, generate using Agora/Twilio SDK
    const userToken = this.generateVideoToken(sessionId, userId, 'user');
    const providerToken = this.generateVideoToken(sessionId, providerId, 'provider');

    // Store session
    await query(
      `INSERT INTO video_call_sessions (appointment_id, provider_id, user_id, session_id, provider_token, user_token)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [appointmentId, providerId, userId, sessionId, providerToken, userToken]
    );

    return { sessionId, userToken, providerToken };
  }

  /**
   * Generate video token (placeholder - implement with actual SDK)
   */
  private generateVideoToken(sessionId: string, userId: string, role: 'user' | 'provider'): string {
    // In production, use Agora/Twilio SDK to generate real tokens
    const timestamp = Math.floor(Date.now() / 1000);
    const expiry = timestamp + 3600; // 1 hour
    const data = `${sessionId}:${userId}:${role}:${expiry}`;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Start video call
   */
  async startVideoCall(appointmentId: string, userId: string): Promise<VideoCallSession> {
    const session = await queryOne<VideoCallSession>(
      `UPDATE video_call_sessions
       SET started_at = NOW()
       WHERE appointment_id = $1 AND user_id = $2
       RETURNING *`,
      [appointmentId, userId]
    );

    if (!session) {
      throw new NotFoundError('Video call session');
    }

    return session;
  }

  /**
   * End video call
   */
  async endVideoCall(appointmentId: string, userId: string): Promise<VideoCallSession> {
    const session = await queryOne<VideoCallSession>(
      `UPDATE video_call_sessions
       SET ended_at = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE appointment_id = $1 AND user_id = $2
       RETURNING *`,
      [appointmentId, userId]
    );

    if (!session) {
      throw new NotFoundError('Video call session');
    }

    // Update appointment status
    await query(
      'UPDATE appointments SET status = $1 WHERE id = $2',
      ['completed', appointmentId]
    );

    return session;
  }

  // ========================================================================
  // HEALTH SUMMARY
  // ========================================================================

  /**
   * Generate health summary for a period
   */
  async generateHealthSummary(userId: string, period: '7d' | '30d' | '90d' = '30d'): Promise<HealthSummary> {
    const summary = await queryOne<HealthSummary>(
      'SELECT * FROM generate_health_summary($1, $2)',
      [userId, period]
    );

    return summary || {
      period,
      alertsCount: 0,
    };
  }

  /**
   * Create health summary record (for PDF export)
   */
  async createHealthSummary(
    userId: string,
    period: '7d' | '30d' | '90d',
    appointmentId?: string,
    generatedBy?: string
  ): Promise<{ id: string; summaryData: HealthSummary }> {
    const summaryData = await this.generateHealthSummary(userId, period);

    const result = await queryOne<{ id: string }>(
      `INSERT INTO health_summaries (user_id, appointment_id, generated_by, period, summary_data, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')
       RETURNING id`,
      [userId, appointmentId || null, generatedBy || null, period, JSON.stringify(summaryData)]
    );

    if (!result) {
      throw new Error('Failed to create health summary');
    }

    return { id: result.id, summaryData };
  }

  /**
   * Get health summary by ID
   */
  async getHealthSummary(summaryId: string): Promise<HealthSummary & { id: string; pdfUrl?: string }> {
    const summary = await queryOne<HealthSummary & { id: string; pdfUrl?: string }>(
      `SELECT id, period, summary_data, pdf_url as "pdfUrl"
       FROM health_summaries
       WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [summaryId]
    );

    if (!summary) {
      throw new NotFoundError('Health summary');
    }

    return summary;
  }

  // ========================================================================
  // CONSULTATION NOTES
  // ========================================================================

  /**
   * Create consultation notes
   */
  async createConsultationNotes(data: {
    appointmentId: string;
    providerId: string;
    chiefComplaint?: string;
    subjectiveNotes?: string;
    objectiveNotes?: string;
    assessment?: string;
    treatmentPlan?: Record<string, unknown>;
    followUpInstructions?: string;
    prescribedMedications?: Record<string, unknown>;
    vitalsDuringConsultation?: Record<string, unknown>;
    isConfidential?: boolean;
  }): Promise<ConsultationNote> {
    const {
      appointmentId,
      providerId,
      chiefComplaint,
      subjectiveNotes,
      objectiveNotes,
      assessment,
      treatmentPlan,
      followUpInstructions,
      prescribedMedications,
      vitalsDuringConsultation,
      isConfidential = false,
    } = data;

    const note = await queryOne<ConsultationNote>(
      `INSERT INTO consultation_notes (
        appointment_id, provider_id, chief_complaint, subjective_notes, objective_notes,
        assessment, treatment_plan, follow_up_instructions, prescribed_medications,
        vitals_during_consultation, is_confidential
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        appointmentId,
        providerId,
        chiefComplaint,
        subjectiveNotes,
        objectiveNotes,
        assessment,
        JSON.stringify(treatmentPlan),
        followUpInstructions,
        JSON.stringify(prescribedMedications),
        JSON.stringify(vitalsDuringConsultation),
        isConfidential,
      ]
    );

    if (!note) {
      throw new Error('Failed to create consultation notes');
    }

    return note;
  }

  /**
   * Get consultation notes for an appointment
   */
  async getConsultationNotes(appointmentId: string): Promise<ConsultationNote> {
    const note = await queryOne<ConsultationNote>(
      `SELECT id, appointment_id as "appointmentId", provider_id as "providerId",
         chief_complaint as "chiefComplaint", subjective_notes as "subjectiveNotes",
         objective_notes as "objectiveNotes", assessment,
         treatment_plan as "treatmentPlan", follow_up_instructions as "followUpInstructions",
         prescribed_medications as "prescribedMedications",
         vitals_during_consultation as "vitalsDuringConsultation",
         is_confidential as "isConfidential", created_at as "createdAt", updated_at as "updatedAt"
       FROM consultation_notes WHERE appointment_id = $1`,
      [appointmentId]
    );

    if (!note) {
      throw new NotFoundError('Consultation notes');
    }

    return note;
  }

  // ========================================================================
  // TREATMENT PLAN UPDATES
  // ========================================================================

  /**
   * Create treatment plan update
   */
  async createTreatmentPlanUpdate(data: {
    appointmentId: string;
    userId: string;
    updatedBy: string;
    medicationChanges?: Record<string, unknown>;
    newMeasurementFrequencies?: Record<string, unknown>;
    lifestyleRecommendations?: string[];
    followUpScheduledAt?: Date;
    followUpProviderId?: string;
  }): Promise<TreatmentPlanUpdate> {
    const {
      appointmentId,
      userId,
      updatedBy,
      medicationChanges,
      newMeasurementFrequencies,
      lifestyleRecommendations,
      followUpScheduledAt,
      followUpProviderId,
    } = data;

    const update = await queryOne<TreatmentPlanUpdate>(
      `INSERT INTO treatment_plan_updates (
        appointment_id, user_id, updated_by, medication_changes,
        new_measurement_frequencies, lifestyle_recommendations,
        follow_up_scheduled_at, follow_up_provider_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        appointmentId,
        userId,
        updatedBy,
        medicationChanges ? JSON.stringify(medicationChanges) : null,
        newMeasurementFrequencies ? JSON.stringify(newMeasurementFrequencies) : null,
        lifestyleRecommendations,
        followUpScheduledAt,
        followUpProviderId,
      ]
    );

    if (!update) {
      throw new Error('Failed to create treatment plan update');
    }

    return update;
  }

  /**
   * Get treatment plan updates for a user
   */
  async getTreatmentPlanUpdates(userId: string, limit = 10): Promise<TreatmentPlanUpdate[]> {
    return query<TreatmentPlanUpdate>(
      `SELECT id, appointment_id as "appointmentId", user_id as "userId", updated_by as "updatedBy",
         medication_changes as "medicationChanges",
         new_measurement_frequencies as "newMeasurementFrequencies",
         lifestyle_recommendations as "lifestyleRecommendations",
         follow_up_scheduled_at as "followUpScheduledAt",
         follow_up_provider_id as "followUpProviderId", created_at as "createdAt"
       FROM treatment_plan_updates
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  }

  // ========================================================================
  // PAYMENT/INSURANCE
  // ========================================================================

  /**
   * Create payment record
   */
  async createPayment(data: {
    appointmentId: string;
    userId: string;
    amount: number;
    currency?: string;
    method: PaymentMethod;
    insuranceProvider?: string;
    insuranceMemberId?: string;
    insurancePreAuthorization?: string;
  }): Promise<ConsultationPayment> {
    const {
      appointmentId,
      userId,
      amount,
      currency = 'USD',
      method,
      insuranceProvider,
      insuranceMemberId,
      insurancePreAuthorization,
    } = data;

    const payment = await queryOne<ConsultationPayment>(
      `INSERT INTO consultation_payments (
        appointment_id, user_id, amount, currency, method,
        insurance_provider, insurance_member_id, insurance_pre_authorization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [appointmentId, userId, amount, currency, method, insuranceProvider, insuranceMemberId, insurancePreAuthorization]
    );

    if (!payment) {
      throw new Error('Failed to create payment record');
    }

    return payment;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    transactionId?: string,
    gatewayResponse?: Record<string, unknown>
  ): Promise<ConsultationPayment> {
    await query(
      `UPDATE consultation_payments
       SET status = $1,
           payment_gateway_transaction_id = $2,
           payment_gateway_response = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [status, transactionId || null, gatewayResponse ? JSON.stringify(gatewayResponse) : null, paymentId]
    );

    const payment = await queryOne<ConsultationPayment>(
      `SELECT id, appointment_id as "appointmentId", user_id as "userId", amount, currency, method, status,
         insurance_provider as "insuranceProvider", insurance_member_id as "insuranceMemberId",
         insurance_pre_authorization as "insurancePreAuthorization",
         payment_gateway_transaction_id as "paymentGatewayTransactionId",
         payment_gateway_response as "paymentGatewayResponse",
         refunded_at as "refundedAt", refund_amount as "refundAmount", refund_reason as "refundReason",
         created_at as "createdAt", updated_at as "updatedAt"
       FROM consultation_payments WHERE id = $1`,
      [paymentId]
    );

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    return payment;
  }

  /**
   * Get payment by appointment ID
   */
  async getPaymentByAppointment(appointmentId: string): Promise<ConsultationPayment | null> {
    return queryOne<ConsultationPayment>(
      `SELECT id, appointment_id as "appointmentId", user_id as "userId", amount, currency, method, status,
         insurance_provider as "insuranceProvider", insurance_member_id as "insuranceMemberId",
         insurance_pre_authorization as "insurancePreAuthorization",
         payment_gateway_transaction_id as "paymentGatewayTransactionId",
         payment_gateway_response as "paymentGatewayResponse",
         refunded_at as "refundedAt", refund_amount as "refundAmount", refund_reason as "refundReason",
         created_at as "createdAt", updated_at as "updatedAt"
       FROM consultation_payments WHERE appointment_id = $1`,
      [appointmentId]
    );
  }

  // ========================================================================
  // REMINDERS
  // ========================================================================

  /**
   * Get appointments that need reminders (scheduled within 24 hours)
   */
  async getAppointmentsNeedingReminders(): Promise<Array<Appointment & { userEmail: string; userPhone?: string }>> {
    return query<Appointment & { userEmail: string; userPhone?: string }>(
      `SELECT a.*, u.email as "userEmail", u.phone as "userPhone"
       FROM appointments a
       JOIN users u ON a.user_id = u.id
       WHERE a.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
         AND a.reminder_sent = FALSE
         AND a.status IN ('scheduled', 'confirmed')
       ORDER BY a.scheduled_at ASC`
    );
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(appointmentId: string): Promise<void> {
    await query(
      'UPDATE appointments SET reminder_sent = TRUE, reminder_at = NOW() WHERE id = $1',
      [appointmentId]
    );
  }
}
