/**
 * Caregiver Notification Service
 *
 * SPEC-005: Caregiver Mode Module
 * Handles notification routing with escalation logic for multiple caregivers
 *
 * Features:
 * - Priority-based notification routing (primary first, then secondary)
 * - Escalation with 5-minute response timer
 * - Professional caregiver shift awareness
 * - Quiet hours support
 * - Activity logging for all notifications
 */

import { query, queryOne, transaction } from '../database/connection';
import { logger } from '../utils/logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type CaregiverRole = 'primary' | 'secondary' | 'professional';
export type CaregiverStatus = 'pending' | 'active' | 'paused' | 'ended';
export type NotificationType = 'medication_missed' | 'vital_abnormal' | 'emergency' | 'escalation';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'acknowledged' | 'expired';

export interface CaregiverNotification {
  id: string;
  caregiverId: string;
  patientId: string;
  patientName: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  priority: NotificationPriority;
  status: NotificationStatus;
  sentAt?: Date;
  acknowledgedAt?: Date;
  expiresAt: Date;
  escalationLevel: number;
  originalAlertId?: string;
  relationshipId: string;
  responseDeadline?: Date;
}

export interface CaregiverRelationship {
  id: string;
  patientId: string;
  caregiverId: string;
  role: CaregiverRole;
  status: CaregiverStatus;
  permissions: {
    viewVitals: boolean;
    viewMedications: boolean;
    receiveAlerts: boolean;
    modifySchedule: boolean;
    contactPatient: boolean;
  };
  notificationPreferences: {
    medicationMissed: boolean;
    vitalAbnormal: boolean;
    emergencyAlerts: boolean;
    quietHours: {
      enabled: boolean;
      start: string; // HH:mm
      end: string; // HH:mm
    };
  };
  professionalSchedule?: ProfessionalSchedule;
  caregiverEmail?: string;
  caregiverName?: string;
  caregiverPhone?: string;
}

export interface ProfessionalSchedule {
  monday?: TimeRange;
  tuesday?: TimeRange;
  wednesday?: TimeRange;
  thursday?: TimeRange;
  friday?: TimeRange;
  saturday?: TimeRange;
  sunday?: TimeRange;
}

export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface CaregiverAction {
  id: string;
  patientId: string;
  caregiverId: string;
  alertId?: string;
  notificationId?: string;
  type: 'acknowledged' | 'called_patient' | 'called_emergency' | 'marked_skipped' | 'added_note';
  notes?: string;
  createdAt: Date;
}

// ============================================================================
// Service
// ============================================================================

export class CaregiverNotificationService {
  private readonly ESCALATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ESCALATION_LEVELS = 3;

  /**
   * Notify caregivers of an event with escalation logic (CG-002, CG-003, CG-006)
   */
  async notifyCaregivers(params: {
    patientId: string;
    eventType: NotificationType;
    title: string;
    message: string;
    data: Record<string, unknown>;
    priority: NotificationPriority;
    originalAlertId?: string;
  }): Promise<CaregiverNotification[]> {
    const { patientId, eventType, title, message, data, priority, originalAlertId } = params;

    // Get all active caregivers for this patient
    const caregivers = await this.getActiveCaregivers(patientId);

    if (caregivers.length === 0) {
      logger.warn(`No active caregivers found for patient ${patientId}`);
      return [];
    }

    // Sort caregivers by priority and availability
    const sortedCaregivers = this.sortCaregiversByPriority(caregivers);

    // Filter caregivers who should receive this type of notification
    const eligibleCaregivers = sortedCaregivers.filter(cg =>
      this.shouldNotifyForEvent(cg, eventType, priority)
    );

    if (eligibleCaregivers.length === 0) {
      logger.info(`No eligible caregivers for event ${eventType} on patient ${patientId}`);
      return [];
    }

    // Create notifications with staggered expiration for escalation
    const notifications: CaregiverNotification[] = [];
    const now = new Date();

    for (let i = 0; i < eligibleCaregivers.length; i++) {
      const caregiver = eligibleCaregivers[i];
      const expiresAt = new Date(now.getTime() + this.ESCALATION_TIMEOUT_MS * (i + 1));
      const responseDeadline = new Date(now.getTime() + this.ESCALATION_TIMEOUT_MS);

      const notification = await this.createNotification({
        caregiverId: caregiver.caregiverId,
        patientId,
        patientName: caregiver.caregiverName || 'Patient',
        type: eventType,
        title,
        message,
        data,
        priority,
        expiresAt,
        escalationLevel: i,
        originalAlertId,
        relationshipId: caregiver.id,
        responseDeadline: i === 0 ? responseDeadline : undefined,
      });

      notifications.push(notification);

      // Log the notification
      await this.logCaregiverAction({
        patientId,
        caregiverId: caregiver.caregiverId,
        notificationId: notification.id,
        alertId: originalAlertId,
        type: 'acknowledged', // Using acknowledged as a sent indicator
        notes: `Notification sent: ${title}`,
      });

      // Send the actual notification (in production, this would use push/sms)
      await this.sendNotification(notification, caregiver);
    }

    // Schedule escalation check for the first caregiver
    if (eligibleCaregivers.length > 1 && notifications.length > 0) {
      this.scheduleEscalationCheck(notifications[0].id);
    }

    return notifications;
  }

  /**
   * Get all active caregivers for a patient
   */
  private async getActiveCaregivers(patientId: string): Promise<CaregiverRelationship[]> {
    const rows = await query<
      CaregiverRelationship & {
        caregiver_email: string;
        caregiver_name: string;
        caregiver_phone: string;
      }
    >(
      `SELECT
         cr.id,
         cr.patient_id,
         cr.caregiver_id,
         cr.role,
         cr.status,
         cr.permissions,
         cr.notification_preferences,
         cr.professional_schedule,
         u.email as caregiver_email,
         u.name as caregiver_name,
         u.phone as caregiver_phone
       FROM caregiver_relationships cr
       JOIN users u ON cr.caregiver_id = u.id
       WHERE cr.patient_id = $1 AND cr.status = 'active'
       ORDER BY
         CASE cr.role
           WHEN 'primary' THEN 1
           WHEN 'secondary' THEN 2
           WHEN 'professional' THEN 3
         END`,
      [patientId]
    );

    return rows.map(row => ({
      id: row.id,
      patientId: row.patient_id,
      caregiverId: row.caregiver_id,
      role: row.role,
      status: row.status,
      permissions: typeof row.permissions === 'string'
        ? JSON.parse(row.permissions)
        : row.permissions,
      notificationPreferences: typeof row.notification_preferences === 'string'
        ? JSON.parse(row.notification_preferences)
        : row.notification_preferences,
      professionalSchedule: row.professional_schedule
        ? (typeof row.professional_schedule === 'string'
          ? JSON.parse(row.professional_schedule)
          : row.professional_schedule)
        : undefined,
      caregiverEmail: row.caregiver_email,
      caregiverName: row.caregiver_name,
      caregiverPhone: row.caregiver_phone,
    }));
  }

  /**
   * Sort caregivers by priority and current availability
   * Primary caregivers first, then those within scheduled hours
   */
  private sortCaregiversByPriority(caregivers: CaregiverRelationship[]): CaregiverRelationship[] {
    const now = new Date();
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return caregivers.sort((a, b) => {
      // Primary caregivers always first
      if (a.role === 'primary' && b.role !== 'primary') return -1;
      if (b.role === 'primary' && a.role !== 'primary') return 1;

      // Check if professional caregiver is on shift
      const aOnShift = this.isProfessionalOnShift(a, currentDay, currentTime);
      const bOnShift = this.isProfessionalOnShift(b, currentDay, currentTime);

      if (aOnShift && !bOnShift) return -1;
      if (bOnShift && !aOnShift) return 1;

      // Secondary before professional
      if (a.role === 'secondary' && b.role === 'professional') return -1;
      if (b.role === 'secondary' && a.role === 'professional') return 1;

      return 0;
    });
  }

  /**
   * Check if a professional caregiver is currently on shift
   */
  private isProfessionalOnShift(
    caregiver: CaregiverRelationship,
    currentDay: string,
    currentTime: string
  ): boolean {
    if (caregiver.role !== 'professional' || !caregiver.professionalSchedule) {
      return true; // Non-professionals are always "on shift"
    }

    const schedule = caregiver.professionalSchedule as Record<string, TimeRange | undefined>;
    const todaySchedule = schedule[currentDay];

    if (!todaySchedule) {
      return false;
    }

    return currentTime >= todaySchedule.start && currentTime <= todaySchedule.end;
  }

  /**
   * Check if caregiver should be notified for this event type
   * Takes into account notification preferences and quiet hours
   */
  private shouldNotifyForEvent(
    caregiver: CaregiverRelationship,
    eventType: NotificationType,
    priority: NotificationPriority
  ): boolean {
    const prefs = caregiver.notificationPreferences;

    // Check notification preferences
    switch (eventType) {
      case 'medication_missed':
        if (!prefs.medicationMissed) return false;
        break;
      case 'vital_abnormal':
        if (!prefs.vitalAbnormal) return false;
        break;
      case 'emergency':
      case 'escalation':
        if (!prefs.emergencyAlerts) return false;
        break;
    }

    // Check quiet hours (unless it's critical priority)
    if (priority !== 'critical' && prefs.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const { start, end } = prefs.quietHours;

      // Handle quiet hours that cross midnight
      if (start <= end) {
        // Normal range (e.g., 22:00 - 08:00 doesn't work, this would be 22:00 - 23:59)
        if (currentTime >= start && currentTime <= end) {
          return false;
        }
      } else {
        // Range crosses midnight (e.g., 22:00 - 08:00)
        if (currentTime >= start || currentTime <= end) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Create a notification record
   */
  private async createNotification(params: {
    caregiverId: string;
    patientId: string;
    patientName: string;
    type: NotificationType;
    title: string;
    message: string;
    data: Record<string, unknown>;
    priority: NotificationPriority;
    expiresAt: Date;
    escalationLevel: number;
    originalAlertId?: string;
    relationshipId: string;
    responseDeadline?: Date;
  }): Promise<CaregiverNotification> {
    const {
      caregiverId,
      patientId,
      patientName,
      type,
      title,
      message,
      data,
      priority,
      expiresAt,
      escalationLevel,
      originalAlertId,
      relationshipId,
      responseDeadline,
    } = params;

    const id = crypto.randomUUID();

    await query(
      `INSERT INTO caregiver_notifications
       (id, caregiver_id, patient_id, patient_name, type, title, message, data,
        priority, status, expires_at, escalation_level, original_alert_id,
        relationship_id, response_deadline, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
      [
        id,
        caregiverId,
        patientId,
        patientName,
        type,
        title,
        message,
        JSON.stringify(data),
        priority,
        'sent',
        expiresAt,
        escalationLevel,
        originalAlertId || null,
        relationshipId,
        responseDeadline || null,
      ]
    );

    return {
      id,
      caregiverId,
      patientId,
      patientName,
      type,
      title,
      message,
      data,
      priority,
      status: 'sent',
      sentAt: new Date(),
      expiresAt,
      escalationLevel,
      originalAlertId,
      relationshipId,
      responseDeadline,
    };
  }

  /**
   * Send notification to caregiver
   * In production, this would integrate with FCM, APNs, SMS, etc.
   */
  private async sendNotification(
    notification: CaregiverNotification,
    caregiver: CaregiverRelationship
  ): Promise<void> {
    // TODO: Integrate with real notification service
    logger.info('Notification sent', {
      notificationId: notification.id,
      caregiverId: notification.caregiverId,
      caregiverName: caregiver.caregiverName,
      type: notification.type,
      priority: notification.priority,
    });

    // In production:
    // - If caregiver has push token: send push notification via FCM/APNs
    // - If high priority: also send SMS
    // - If critical: also attempt voice call
  }

  /**
   * Schedule escalation check for a notification
   * In production, this would use a job queue (Bull, BullMQ)
   */
  private scheduleEscalationCheck(notificationId: string): void {
    // Use setTimeout for demo - in production use a job queue
    setTimeout(async () => {
      await this.checkEscalation(notificationId);
    }, this.ESCALATION_TIMEOUT_MS);
  }

  /**
   * Check if notification needs escalation
   */
  async checkEscalation(notificationId: string): Promise<void> {
    const notification = await queryOne<CaregiverNotification>(
      'SELECT * FROM caregiver_notifications WHERE id = $1',
      [notificationId]
    );

    if (!notification || notification.status !== 'sent') {
      return; // Already handled or doesn't exist
    }

    const now = new Date();
    if (now < notification.expiresAt) {
      return; // Not time yet
    }

    // Escalate to next caregiver
    await this.escalateNotification(notification);
  }

  /**
   * Escalate notification to next available caregiver
   */
  private async escalateNotification(originalNotification: CaregiverNotification): Promise<void> {
    if (originalNotification.escalationLevel >= this.MAX_ESCALATION_LEVELS) {
      // Max escalation reached - mark as expired
      await query(
        'UPDATE caregiver_notifications SET status = $1, updated_at = NOW() WHERE id = $2',
        ['expired', originalNotification.id]
      );
      logger.warn('Notification expired - max escalation reached', {
        notificationId: originalNotification.id,
        patientId: originalNotification.patientId,
      });
      return;
    }

    // Get next eligible caregiver
    const caregivers = await this.getActiveCaregivers(originalNotification.patientId);
    const eligibleCaregivers = caregivers.filter(cg =>
      cg.caregiverId !== originalNotification.caregiverId &&
      this.shouldNotifyForEvent(cg, originalNotification.type, originalNotification.priority)
    );

    if (eligibleCaregivers.length === 0) {
      logger.warn('No more caregivers to escalate to', {
        originalNotificationId: originalNotification.id,
      });
      return;
    }

    // Create escalation notification for next caregiver
    const nextCaregiver = eligibleCaregivers[0];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ESCALATION_TIMEOUT_MS);

    await this.createNotification({
      caregiverId: nextCaregiver.caregiverId,
      patientId: originalNotification.patientId,
      patientName: originalNotification.patientName,
      type: 'escalation',
      title: `Escalation: ${originalNotification.title}`,
      message: `${originalNotification.message}\n\nPrevious caregiver did not respond.`,
      data: {
        ...originalNotification.data,
        originalNotificationId: originalNotification.id,
        escalationReason: 'no_response',
      },
      priority: originalNotification.priority,
      expiresAt,
      escalationLevel: originalNotification.escalationLevel + 1,
      originalAlertId: originalNotification.originalAlertId,
      relationshipId: nextCaregiver.id,
    });

    logger.info('Notification escalated', {
      originalNotificationId: originalNotification.id,
      newCaregiverId: nextCaregiver.caregiverId,
      escalationLevel: originalNotification.escalationLevel + 1,
    });
  }

  /**
   * Acknowledge a notification
   */
  async acknowledgeNotification(
    notificationId: string,
    caregiverId: string
  ): Promise<CaregiverNotification | null> {
    const notification = await queryOne<CaregiverNotification>(
      'SELECT * FROM caregiver_notifications WHERE id = $1 AND caregiver_id = $2',
      [notificationId, caregiverId]
    );

    if (!notification) {
      return null;
    }

    await query(
      `UPDATE caregiver_notifications
       SET status = 'acknowledged', acknowledged_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [notificationId]
    );

    // Log the acknowledgment
    await this.logCaregiverAction({
      patientId: notification.patientId,
      caregiverId,
      notificationId,
      alertId: notification.originalAlertId,
      type: 'acknowledged',
      notes: `Acknowledged: ${notification.title}`,
    });

    return {
      ...notification,
      status: 'acknowledged',
      acknowledgedAt: new Date(),
    };
  }

  /**
   * Log caregiver action
   */
  async logCaregiverAction(params: {
    patientId: string;
    caregiverId: string;
    alertId?: string;
    notificationId?: string;
    type: CaregiverAction['type'];
    notes?: string;
  }): Promise<CaregiverAction> {
    const { patientId, caregiverId, alertId, notificationId, type, notes } = params;
    const id = crypto.randomUUID();

    await query(
      `INSERT INTO caregiver_actions
       (id, patient_id, caregiver_id, alert_id, notification_id, type, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [id, patientId, caregiverId, alertId || null, notificationId || null, type, notes || null]
    );

    return {
      id,
      patientId,
      caregiverId,
      alertId,
      notificationId,
      type,
      notes,
      createdAt: new Date(),
    };
  }

  /**
   * Get pending notifications for a caregiver
   */
  async getPendingNotifications(caregiverId: string): Promise<CaregiverNotification[]> {
    return query<CaregiverNotification>(
      `SELECT * FROM caregiver_notifications
       WHERE caregiver_id = $1 AND status IN ('pending', 'sent')
       ORDER BY created_at DESC
       LIMIT 50`,
      [caregiverId]
    );
  }

  /**
   * Get caregiver activity log for a patient
   */
  async getCaregiverActivity(patientId: string, limit = 50): Promise<CaregiverAction[]> {
    const rows = await query<
      CaregiverAction & { caregiver_name: string }
    >(
      `SELECT ca.*, u.name as caregiver_name
       FROM caregiver_actions ca
       JOIN users u ON ca.caregiver_id = u.id
       WHERE ca.patient_id = $1
       ORDER BY ca.created_at DESC
       LIMIT $2`,
      [patientId, limit]
    );

    return rows;
  }

  /**
   * Check for notifications that need escalation
   * Called by cron job
   */
  async checkPendingEscalations(): Promise<number> {
    const now = new Date();

    const expiredNotifications = await query<
      CaregiverNotification
    >(
      `SELECT * FROM caregiver_notifications
       WHERE status = 'sent' AND expires_at <= $1 AND escalation_level < $2`,
      [now, this.MAX_ESCALATION_LEVELS]
    );

    for (const notification of expiredNotifications) {
      await this.escalateNotification(notification);
    }

    return expiredNotifications.length;
  }
}

// Export singleton instance
export const caregiverNotificationService = new CaregiverNotificationService();
