/**
 * Emergency Service
 *
 * Handles emergency alerts and notifications
 * SPEC-003: Emergency Alerts System with Escalation Protocol
 *
 * Features:
 * - Alert triggering for critical BP and glucose (EA-001)
 * - Multi-channel notifications: Push, SMS, Email (EA-002)
 * - Escalation rules: 5min -> secondary, 10min -> emergency services (EA-003)
 * - Location sharing for emergencies (EA-004)
 * - Alert acknowledgment stops escalation (EA-005)
 * - Manual SOS bypasses escalation (EA-006)
 */

import { query, queryOne, transaction } from '../database/connection';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { logEmergencyEvent, logger } from '../utils/logger';
import { CaregiverService } from './CaregiverService';

// Alert type enumeration matching SPEC-003
export type AlertType =
  | 'critical_bp'
  | 'critical_glucose'
  | 'medication_missed'
  | 'no_response'
  | 'manual_trigger'
  | 'irregular_pattern';

export type AlertStatus = 'active' | 'acknowledged' | 'escalated' | 'resolved' | 'false_alarm';

export type AlertSeverity = 'critical' | 'high' | 'warning';

export type NotificationChannel = 'push' | 'sms' | 'email' | 'call';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface EmergencyAlert {
  id: string;
  userId: string;
  type: AlertType;
  severity: AlertSeverity;
  vitalSignId?: string;
  medicationId?: string;
  status: AlertStatus;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  escalationLevel: number;
  escalatedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
  wasFalseAlarm?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  relationship: 'primary_caregiver' | 'secondary_caregiver' | 'emergency_contact' | 'healthcare_provider';
  isPrimary: boolean;
  priority: 1 | 2 | 3;
  notificationMethods: NotificationChannel[];
  availableHours?: { start: string; end: string }[];
  isActive: boolean;
}

export interface EmergencyNotification {
  id: string;
  alertId: string;
  recipientContactId?: string;
  recipientType: string;
  recipientContact: string; // phone number or email
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

export interface CreateAlertInput {
  userId: string;
  type: AlertType;
  vitalSignId?: string;
  medicationId?: string;
  location?: { lat: number; lng: number; address?: string };
  notes?: string;
  bypassEscalation?: boolean; // For manual SOS - EA-006
}

export interface AlertThresholds {
  bloodPressure: {
    criticalHigh: { systolic: number; diastolic: number };
    warningHigh: { systolic: number; diastolic: number };
    criticalLow: { systolic: number; diastolic: number };
    warningLow: { systolic: number; diastolic: number };
  };
  glucose: {
    criticalLow: number;
    warningLow: number;
    criticalHigh: number;
    warningHighFasting: number;
    warningHighPostMeal: number;
  };
}

// Escalation configuration per SPEC-003
const ESCALATION_CONFIG = {
  tier1: {
    waitMinutes: 5,
    escalationLevel: 1,
    name: 'Secondary Contacts',
  },
  tier2: {
    waitMinutes: 10,
    escalationLevel: 2,
    name: 'Emergency Services',
  },
};

// Alert severity mapping
const ALERT_SEVERITY: Record<AlertType, AlertSeverity> = {
  critical_bp: 'critical',
  critical_glucose: 'critical',
  medication_missed: 'warning',
  no_response: 'high',
  manual_trigger: 'critical',
  irregular_pattern: 'warning',
};

export class EmergencyService {
  private caregiverService: CaregiverService;

  constructor() {
    this.caregiverService = new CaregiverService();
  }

  /**
   * Create emergency alert (EA-001)
   * - Alert sent within 10 seconds of trigger
   * - Includes all relevant data (values, timestamp)
   */
  async createEmergencyAlert(input: CreateAlertInput): Promise<EmergencyAlert> {
    // Check if there's already an active alert of this type for the user
    const existingAlert = await queryOne<EmergencyAlert>(
      `SELECT id, escalation_level as "escalationLevel", status
       FROM emergency_alerts
       WHERE user_id = $1 AND type = $2 AND status IN ('active', 'acknowledged')
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.userId, input.type]
    );

    if (existingAlert && existingAlert.status === 'active') {
      // Return existing active alert instead of creating duplicate
      logger.info(`Active alert already exists for user ${input.userId}, type ${input.type}`);
      return this.getAlert(input.userId, existingAlert.id);
    }

    // For manual_trigger (SOS), bypass escalation and go directly to highest level (EA-006)
    const initialEscalationLevel = input.bypassEscalation ? 2 : 0;
    const severity = ALERT_SEVERITY[input.type];

    const alert = await queryOne<EmergencyAlert>(
      `INSERT INTO emergency_alerts (
         user_id, type, severity, vital_sign_id, medication_id,
         location_lat, location_lng, location_address, notes,
         escalation_level, bypass_escalation
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, user_id as "userId", type, severity, vital_sign_id as "vitalSignId",
                 medication_id as "medicationId", status,
                 location_lat as "locationLat", location_lng as "locationLng",
                 location_address as "locationAddress",
                 escalation_level as "escalationLevel", escalated_at as "escalatedAt",
                 acknowledged_at as "acknowledgedAt", acknowledged_by as "acknowledgedBy",
                 resolved_at as "resolvedAt", resolved_by as "resolvedBy",
                 notes, was_false_alarm as "wasFalseAlarm", created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [
        input.userId,
        input.type,
        severity,
        input.vitalSignId || null,
        input.medicationId || null,
        input.location?.lat || null,
        input.location?.lng || null,
        input.location?.address || null,
        input.notes || null,
        initialEscalationLevel,
        input.bypassEscalation || false,
      ]
    );

    if (!alert) {
      throw new Error('Failed to create emergency alert');
    }

    // Log emergency event for HIPAA audit trail
    logEmergencyEvent(input.userId, input.type, severity, {
      alertId: alert.id,
      location: input.location,
      bypassEscalation: input.bypassEscalation,
    });

    // Send notifications immediately (EA-002)
    await this.sendEmergencyNotifications(alert);

    // For manual SOS, immediately notify emergency services (EA-006)
    if (input.bypassEscalation) {
      await this.notifyEmergencyServices(alert);
    }

    return alert;
  }

  /**
   * Get emergency alerts for user
   */
  async getUserAlerts(
    userId: string,
    status?: string,
    limit = 20
  ): Promise<EmergencyAlert[]> {
    let queryText = `
      SELECT id, user_id as "userId", type, severity, vital_sign_id as "vitalSignId",
             medication_id as "medicationId", status,
             location_lat as "locationLat", location_lng as "locationLng",
             location_address as "locationAddress",
             escalation_level as "escalationLevel", escalated_at as "escalatedAt",
             acknowledged_at as "acknowledgedAt", acknowledged_by as "acknowledgedBy",
             resolved_at as "resolvedAt", resolved_by as "resolvedBy",
             notes, was_false_alarm as "wasFalseAlarm", created_at as "createdAt",
             updated_at as "updatedAt"
      FROM emergency_alerts
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];

    if (status) {
      queryText += ' AND status = $2';
      params.push(status);
    }

    queryText += ' ORDER BY created_at DESC';

    if (limit) {
      queryText += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }

    return query<EmergencyAlert>(queryText, params);
  }

  /**
   * Get alert by ID with caregiver access check
   */
  async getAlert(userId: string, alertId: string): Promise<EmergencyAlert> {
    const alert = await queryOne<EmergencyAlert>(
      `SELECT id, user_id as "userId", type, severity, vital_sign_id as "vitalSignId",
              medication_id as "medicationId", status,
              location_lat as "locationLat", location_lng as "locationLng",
              location_address as "locationAddress",
              escalation_level as "escalationLevel", escalated_at as "escalatedAt",
              acknowledged_at as "acknowledgedAt", acknowledged_by as "acknowledgedBy",
              resolved_at as "resolvedAt", resolved_by as "resolvedBy",
              notes, was_false_alarm as "wasFalseAlarm", created_at as "createdAt",
              updated_at as "updatedAt"
       FROM emergency_alerts
       WHERE id = $1`,
      [alertId]
    );

    if (!alert) {
      throw new NotFoundError('Emergency alert');
    }

    // Check access - user or their caregiver
    if (alert.userId !== userId) {
      const isCaregiver = await this.checkCaregiverAccess(userId, alert.userId);
      if (!isCaregiver) {
        throw new ValidationError('You do not have access to this alert');
      }
    }

    return alert;
  }

  /**
   * Acknowledge emergency alert (EA-005)
   * - Stops escalation when user responds
   * - Response timestamp logged
   */
  async acknowledgeAlert(
    userId: string,
    alertId: string,
    notes?: string
  ): Promise<EmergencyAlert> {
    const alert = await this.getAlert(userId, alertId);

    if (alert.status !== 'active') {
      throw new ValidationError('Alert is not active');
    }

    const updated = await queryOne<EmergencyAlert>(
      `UPDATE emergency_alerts
       SET status = 'acknowledged',
           acknowledged_at = NOW(),
           acknowledged_by = $2,
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id as "userId", type, severity, vital_sign_id as "vitalSignId",
                 medication_id as "medicationId", status,
                 location_lat as "locationLat", location_lng as "locationLng",
                 location_address as "locationAddress",
                 escalation_level as "escalationLevel", escalated_at as "escalatedAt",
                 acknowledged_at as "acknowledgedAt", acknowledged_by as "acknowledgedBy",
                 resolved_at as "resolvedAt", resolved_by as "resolvedBy",
                 notes, was_false_alarm as "wasFalseAlarm", created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [alertId, userId, notes || null]
    );

    if (!updated) {
      throw new Error('Failed to acknowledge alert');
    }

    // Log acknowledgment for audit trail
    logEmergencyEvent(userId, updated.type, 'acknowledged', {
      alertId,
      acknowledgedBy: userId,
    });

    // Notify all contacts that alert was acknowledged (EA-005)
    await this.notifyAlertResolution(updated, 'acknowledged');

    return updated;
  }

  /**
   * Resolve emergency alert
   */
  async resolveAlert(
    userId: string,
    alertId: string,
    notes?: string,
    wasFalseAlarm = false
  ): Promise<EmergencyAlert> {
    const alert = await this.getAlert(userId, alertId);

    const newStatus = wasFalseAlarm ? 'false_alarm' : 'resolved';

    const updated = await queryOne<EmergencyAlert>(
      `UPDATE emergency_alerts
       SET status = $2,
           resolved_at = NOW(),
           resolved_by = $3,
           was_false_alarm = $4,
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id as "userId", type, severity, vital_sign_id as "vitalSignId",
                 medication_id as "medicationId", status,
                 location_lat as "locationLat", location_lng as "locationLng",
                 location_address as "locationAddress",
                 escalation_level as "escalationLevel", escalated_at as "escalatedAt",
                 acknowledged_at as "acknowledgedAt", acknowledged_by as "acknowledgedBy",
                 resolved_at as "resolvedAt", resolved_by as "resolvedBy",
                 notes, was_false_alarm as "wasFalseAlarm", created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [alertId, newStatus, userId, wasFalseAlarm, notes || null]
    );

    if (!updated) {
      throw new Error('Failed to resolve alert');
    }

    // Log resolution for audit trail
    logEmergencyEvent(userId, updated.type, 'resolved', {
      alertId,
      wasFalseAlarm,
      resolvedBy: userId,
    });

    // Notify all contacts that alert was resolved
    await this.notifyAlertResolution(updated, 'resolved');

    return updated;
  }

  /**
   * Get emergency contacts for user (EA-002)
   * Supports multiple emergency contacts per SPEC-003
   */
  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    const contacts: EmergencyContact[] = [];

    // Get user's emergency contact from profile
    const user = await queryOne<{
      emergencyContactName: string;
      emergencyContactPhone: string;
    }>(
      'SELECT emergency_contact_name as "emergencyContactName", emergency_contact_phone as "emergencyContactPhone" FROM users WHERE id = $1',
      [userId]
    );

    if (user?.emergencyContactName && user?.emergencyContactPhone) {
      contacts.push({
        id: 'user-emergency-contact',
        userId,
        name: user.emergencyContactName,
        phone: user.emergencyContactPhone,
        relationship: 'emergency_contact',
        isPrimary: true,
        priority: 1,
        notificationMethods: ['sms', 'call'],
        isActive: true,
      });
    }

    // Get caregivers with their notification preferences
    const caregivers = await query<
      {
        id: string;
        name: string;
        phone: string;
        email: string;
        isPrimary: boolean;
        notificationPreferences: Record<string, boolean>;
      }[]
    >(
      `SELECT u.id, u.name, u.phone, u.email, cr.is_primary as "isPrimary",
              cr.notification_preferences as "notificationPreferences"
       FROM caregiver_relationships cr
       JOIN users u ON cr.caregiver_id = u.id
       WHERE cr.patient_id = $1 AND u.is_active = TRUE
       ORDER BY cr.is_primary DESC`,
      [userId]
    );

    for (const cg of caregivers) {
      const methods: NotificationChannel[] = [];
      if (cg.notificationPreferences?.emergencyAlerts) {
        methods.push('push');
      }
      if (cg.phone) {
        methods.push('sms');
      }
      if (cg.email) {
        methods.push('email');
      }

      contacts.push({
        id: cg.id,
        userId,
        name: cg.name,
        phone: cg.phone || '',
        email: cg.email,
        relationship: cg.isPrimary ? 'primary_caregiver' : 'secondary_caregiver',
        isPrimary: cg.isPrimary,
        priority: cg.isPrimary ? 1 : 2,
        notificationMethods: methods.length > 0 ? methods : ['push'],
        isActive: true,
      });
    }

    return contacts;
  }

  /**
   * Send emergency notifications (EA-002)
   * - Push notification with sound
   * - In-app notification
   * - SMS fallback if no response
   */
  private async sendEmergencyNotifications(alert: EmergencyAlert): Promise<void> {
    const contacts = await this.getEmergencyContacts(alert.userId);

    // Group contacts by priority
    const primaryContacts = contacts.filter((c) => c.priority === 1);
    const secondaryContacts = contacts.filter((c) => c.priority === 2);
    const tertiaryContacts = contacts.filter((c) => c.priority === 3);

    // Send to primary contacts first
    const contactsToNotify = alert.escalationLevel >= 1
      ? [...primaryContacts, ...secondaryContacts]
      : primaryContacts;

    for (const contact of contactsToNotify) {
      // Create notification records for each channel
      for (const channel of contact.notificationMethods) {
        const notificationId = await this.createNotificationRecord({
          alertId: alert.id,
          recipientContactId: contact.id,
          recipientType: contact.relationship,
          recipientContact: channel === 'email' ? (contact.email || contact.phone) : contact.phone,
          channel,
        });

        // Send the notification
        await this.sendNotification(notificationId, alert, contact, channel);
      }
    }

    // Notify caregivers through the caregiver service
    await this.caregiverService.notifyCaregivers(alert.userId, 'emergency', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      location: alert.locationLat
        ? { lat: alert.locationLat, lng: alert.locationLng, address: alert.locationAddress }
        : undefined,
    });
  }

  /**
   * Create a notification record
   */
  private async createNotificationRecord(data: {
    alertId: string;
    recipientContactId?: string;
    recipientType: string;
    recipientContact: string;
    channel: NotificationChannel;
  }): Promise<string> {
    const result = await queryOne<{ id: string }>(
      `INSERT INTO emergency_notifications (
         alert_id, recipient_contact_id, recipient_type, recipient_contact, channel, status
       )
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [data.alertId, data.recipientContactId || null, data.recipientType, data.recipientContact, data.channel]
    );

    return result?.id || '';
  }

  /**
   * Send notification through specific channel
   */
  private async sendNotification(
    notificationId: string,
    alert: EmergencyAlert,
    contact: EmergencyContact,
    channel: NotificationChannel
  ): Promise<boolean> {
    try {
      let success = false;

      switch (channel) {
        case 'push':
          success = await this.sendPushNotification(alert, contact);
          break;
        case 'sms':
          success = await this.sendSMSNotification(alert, contact);
          break;
        case 'email':
          success = await this.sendEmailNotification(alert, contact);
          break;
        case 'call':
          success = await this.sendPhoneCall(alert, contact);
          break;
      }

      // Update notification record
      await query(
        `UPDATE emergency_notifications
         SET status = $2, sent_at = NOW()
         WHERE id = $1`,
        [notificationId, success ? 'sent' : 'failed']
      );

      return success;
    } catch (error) {
      logger.error('Failed to send notification', { notificationId, error });

      await query(
        `UPDATE emergency_notifications
         SET status = 'failed', error_message = $2, retry_count = retry_count + 1
         WHERE id = $1`,
        [notificationId, error instanceof Error ? error.message : 'Unknown error']
      );

      return false;
    }
  }

  /**
   * Send push notification (Firebase Cloud Messaging)
   */
  private async sendPushNotification(
    alert: EmergencyAlert,
    contact: EmergencyContact
  ): Promise<boolean> {
    // In production: Use Firebase Admin SDK to send push notification
    const message = this.getAlertMessage(alert);
    logger.info(`[Push] To: ${contact.name} (${contact.id}) - ${message.title}`);

    // Simulate push notification - in production, use FCM
    // await admin.messaging().sendToDevice(...)

    return true;
  }

  /**
   * Send SMS notification (Twilio)
   */
  private async sendSMSNotification(
    alert: EmergencyAlert,
    contact: EmergencyContact
  ): Promise<boolean> {
    // In production: Use Twilio to send SMS
    const message = this.getAlertMessage(alert);
    const smsBody = `${message.title}\n${message.body}\n${message.location || ''}`;

    logger.info(`[SMS] To: ${contact.phone} - ${smsBody}`);

    // Simulate SMS - in production, use Twilio
    // await twilio.messages.create({ body: smsBody, to: contact.phone, ... })

    return true;
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    alert: EmergencyAlert,
    contact: EmergencyContact
  ): Promise<boolean> {
    // In production: Use SendGrid, AWS SES, or similar
    const message = this.getAlertMessage(alert);

    logger.info(`[Email] To: ${contact.email} - ${message.title}`);

    // Simulate email - in production, use email service
    // await emailService.send({ to: contact.email, subject: message.title, ... })

    return true;
  }

  /**
   * Make phone call for critical alerts
   */
  private async sendPhoneCall(
    alert: EmergencyAlert,
    contact: EmergencyContact
  ): Promise<boolean> {
    // In production: Use Twilio Programmable Voice
    const message = this.getAlertMessage(alert);

    logger.info(`[Call] To: ${contact.phone} - ${message.title}`);

    // Simulate phone call - in production, use Twilio
    // await twilio.calls.create({ to: contact.phone, ... })

    return true;
  }

  /**
   * Get human-readable alert message
   */
  private getAlertMessage(alert: EmergencyAlert): {
    title: string;
    body: string;
    location?: string;
  } {
    const messages: Record<AlertType, { title: string; body: string }> = {
      critical_bp: {
        title: 'CRITICAL: Blood Pressure Alert',
        body: 'Critical blood pressure reading detected. Immediate attention required.',
      },
      critical_glucose: {
        title: 'CRITICAL: Glucose Alert',
        body: 'Critical glucose level detected. Immediate attention required.',
      },
      medication_missed: {
        title: 'WARNING: Medication Missed',
        body: 'A scheduled medication dose was not confirmed within 2 hours.',
      },
      no_response: {
        title: 'HIGH: No Response Alert',
        body: 'Patient has not been active for 24h+ and missed check-in.',
      },
      manual_trigger: {
        title: 'SOS: EMERGENCY',
        body: 'Patient has triggered the emergency SOS button. Immediate help needed!',
      },
      irregular_pattern: {
        title: 'WARNING: Abnormal Pattern Detected',
        body: '3 consecutive abnormal readings detected. Medical review recommended.',
      },
    };

    const message = messages[alert.type];
    let locationStr = '';

    if (alert.locationLat && alert.locationLng) {
      locationStr = alert.locationAddress ||
        `Location: ${alert.locationLat.toFixed(5)}, ${alert.locationLng.toFixed(5)}`;
    }

    return {
      ...message,
      location: locationStr || undefined,
    };
  }

  /**
   * Escalate unresponsive alerts (EA-003)
   * This should be called by a cron job every minute
   */
  async escalateUnresponsiveAlerts(): Promise<{
    escalated: number;
    details: Array<{ alertId: string; newLevel: number }>;
  }> {
    const now = Date.now();
    const fiveMinutesAgo = new Date(now - ESCALATION_CONFIG.tier1.waitMinutes * 60 * 1000);
    const tenMinutesAgo = new Date(now - ESCALATION_CONFIG.tier2.waitMinutes * 60 * 1000);

    // Find alerts that need escalation
    const alertsNeedingEscalation = await query<
      EmergencyAlert & {
        bypassEscalation: boolean;
      }
    >(
      `SELECT id, user_id as "userId", type, severity, escalation_level as "escalationLevel",
              bypass_escalation as "bypassEscalation", created_at as "createdAt",
              escalated_at as "escalatedAt", location_lat as "locationLat",
              location_lng as "locationLng", location_address as "locationAddress"
       FROM emergency_alerts
       WHERE status = 'active'
         AND bypass_escalation = false
         AND (
           (escalation_level = 0 AND created_at < $1)
           OR (escalation_level = 1 AND escalated_at < $2)
         )`,
      [fiveMinutesAgo, tenMinutesAgo]
    );

    const results: Array<{ alertId: string; newLevel: number }> = [];

    for (const alert of alertsNeedingEscalation) {
      const newLevel = await this.escalateAlert(alert);
      results.push({ alertId: alert.id, newLevel });
    }

    return {
      escalated: results.length,
      details: results,
    };
  }

  /**
   * Escalate an alert to the next level (EA-003)
   */
  private async escalateAlert(alert: EmergencyAlert & {
    bypassEscalation: boolean;
  }): Promise<number> {
    const newLevel = alert.escalationLevel + 1;

    await query(
      `UPDATE emergency_alerts
       SET escalation_level = $2,
           escalated_at = NOW(),
           status = 'escalated',
           updated_at = NOW()
       WHERE id = $1`,
      [alert.id, newLevel]
    );

    logEmergencyEvent(alert.userId, alert.type, 'escalated', {
      alertId: alert.id,
      escalationLevel: newLevel,
    });

    if (newLevel === 1) {
      // 5 minutes - notify secondary contacts
      await this.notifySecondaryContacts(alert);
    } else if (newLevel >= 2) {
      // 10 minutes - notify emergency services (EA-003, EA-004)
      await this.notifyEmergencyServices(alert);
    }

    return newLevel;
  }

  /**
   * Notify secondary contacts (5 minute escalation)
   */
  private async notifySecondaryContacts(alert: EmergencyAlert): Promise<void> {
    const contacts = await this.getEmergencyContacts(alert.userId);
    const secondaryContacts = contacts.filter((c) => c.priority >= 2);

    logger.info(`Notifying secondary contacts for alert ${alert.id}`);

    for (const contact of secondaryContacts) {
      for (const channel of contact.notificationMethods) {
        const notificationId = await this.createNotificationRecord({
          alertId: alert.id,
          recipientContactId: contact.id,
          recipientType: contact.relationship,
          recipientContact: channel === 'email' ? (contact.email || contact.phone) : contact.phone,
          channel,
        });

        await this.sendNotification(notificationId, alert, contact, channel);
      }
    }
  }

  /**
   * Notify emergency services (10 minute escalation) (EA-003, EA-004)
   * Includes GPS coordinates, address if available, contact info for user
   */
  private async notifyEmergencyServices(alert: EmergencyAlert): Promise<void> {
    logger.info(`EMERGENCY SERVICES NOTIFICATION for alert ${alert.id}`);

    // Get user info for emergency services
    const user = await queryOne<{
      name: string;
      phone: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
    }>(
      `SELECT name, phone, emergency_contact_name as "emergencyContactName",
              emergency_contact_phone as "emergencyContactPhone"
       FROM users WHERE id = $1`,
      [alert.userId]
    );

    // In production: This would make an actual API call to emergency services
    // or use a service like RapidSOS to share location with 911

    const emergencyInfo = {
      alertId: alert.id,
      patientName: user?.name || 'Unknown',
      patientPhone: user?.phone,
      emergencyContact: user?.emergencyContactName,
      emergencyContactPhone: user?.emergencyContactPhone,
      location: {
        lat: alert.locationLat,
        lng: alert.locationLng,
        address: alert.locationAddress,
      },
      alertType: alert.type,
      severity: alert.severity,
      notes: alert.notes,
    };

    logger.error(`EMERGENCY SERVICES CALLED: ${JSON.stringify(emergencyInfo)}`);

    // Create emergency service notification record
    await this.createNotificationRecord({
      alertId: alert.id,
      recipientType: 'emergency_services',
      recipientContact: '911',
      channel: 'call',
    });

    // Notify all contacts with location (EA-004)
    const allContacts = await this.getEmergencyContacts(alert.userId);
    for (const contact of allContacts) {
      const locationMessage = `EMERGENCY: Services have been contacted for ${user?.name}. ` +
        `Location: ${alert.locationAddress || `${alert.locationLat?.toFixed(5)}, ${alert.locationLng?.toFixed(5)}`}`;

      await this.sendSMSNotification(alert, {
        ...contact,
        phone: contact.phone,
      });

      logger.info(`[Location Share] Sent to ${contact.name}: ${locationMessage}`);
    }
  }

  /**
   * Notify all contacts when alert is resolved or acknowledged (EA-005)
   */
  private async notifyAlertResolution(
    alert: EmergencyAlert,
    resolutionType: 'acknowledged' | 'resolved'
  ): Promise<void> {
    const contacts = await this.getEmergencyContacts(alert.userId);
    const message = resolutionType === 'acknowledged'
      ? `Alert ACKNOWLEDGED: ${alert.type} - Patient has responded. No further action needed.`
      : `Alert RESOLVED: ${alert.type} - Situation has been resolved.`;

    logger.info(`[Resolution] Notifying all contacts: ${message}`);

    for (const contact of contacts) {
      // Log notification - actual sending can be rate-limited for resolutions
      logger.info(`[Resolution Notification] ${contact.name}: ${message}`);
    }
  }

  /**
   * Get alert with notifications
   */
  async getAlertWithNotifications(userId: string, alertId: string): Promise<{
    alert: EmergencyAlert;
    notifications: EmergencyNotification[];
  }> {
    const alert = await this.getAlert(userId, alertId);

    const notifications = await query<EmergencyNotification>(
      `SELECT id, alert_id as "alertId", recipient_contact_id as "recipientContactId",
              recipient_type as "recipientType", recipient_contact as "recipientContact",
              channel, status, sent_at as "sentAt", delivered_at as "deliveredAt",
              error_message as "errorMessage", retry_count as "retryCount", created_at as "createdAt"
       FROM emergency_notifications
       WHERE alert_id = $1
       ORDER BY created_at ASC`,
      [alertId]
    );

    return { alert, notifications };
  }

  /**
   * Check for medication missed alerts
   * Called by medication service when dose is missed
   */
  async checkMedicationAdherence(userId: string): Promise<void> {
    // Check if any medication was missed (no confirmation within 2 hours)
    const missedMedications = await query<{
      medicationId: string;
      medicationName: string;
      scheduledTime: Date;
    }>(
      `SELECT ml.medication_id as "medicationId", m.name as "medicationName", ml.scheduled_at as "scheduledTime"
       FROM medication_logs ml
       JOIN medications m ON ml.medication_id = m.id
       WHERE ml.user_id = $1
         AND ml.status = 'pending'
         AND ml.scheduled_at < NOW() - INTERVAL '2 hours'
         AND EXISTS (
           SELECT 1 FROM emergency_alerts ea
           WHERE ea.medication_id = ml.medication_id
             AND ea.type = 'medication_missed'
             AND ea.created_at > ml.scheduled_at - INTERVAL '1 hour'
         ) IS FALSE
       LIMIT 1`,
      [userId]
    );

    for (const missed of missedMedications) {
      await this.createEmergencyAlert({
        userId,
        type: 'medication_missed',
        medicationId: missed.medicationId,
        notes: `Missed dose of ${missed.medicationName} scheduled at ${missed.scheduledTime.toISOString()}`,
      });
    }
  }

  /**
   * Check for irregular patterns (3 consecutive high readings)
   */
  async checkIrregularPatterns(userId: string): Promise<void> {
    // Check for 3 consecutive high BP readings
    const highBPReadings = await query<{ count: bigint }>(
      `SELECT COUNT(*)::bigint as count
       FROM (
         SELECT measured_at, systolic, diastolic
         FROM vital_signs
         WHERE user_id = $1
           AND type = 'blood_pressure'
           AND (systolic >= 140 OR diastolic >= 90)
         ORDER BY measured_at DESC
         LIMIT 3
       ) as recent_readings
       WHERE systolic >= 140 OR diastolic >= 90`,
      [userId]
    );

    if (highBPReadings[0] && Number(highBPReadings[0].count) >= 3) {
      // Check if alert already created recently
      const existingAlert = await queryOne<{ id: string }>(
        `SELECT id FROM emergency_alerts
         WHERE user_id = $1 AND type = 'irregular_pattern'
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [userId]
      );

      if (!existingAlert) {
        await this.createEmergencyAlert({
          userId,
          type: 'irregular_pattern',
          notes: '3 consecutive high blood pressure readings detected',
        });
      }
    }
  }

  /**
   * Get user's alert thresholds
   * Returns configured thresholds for alert triggering
   */
  async getUserThresholds(userId: string): Promise<AlertThresholds> {
    // Check if user has custom thresholds
    const customThresholds = await queryOne<{
      bpCriticalHighSys: number;
      bpCriticalHighDia: number;
      bpWarningHighSys: number;
      bpWarningHighDia: number;
      bpCriticalLowSys: number;
      bpCriticalLowDia: number;
      glucoseCriticalLow: number;
      glucoseWarningLow: number;
      glucoseCriticalHigh: number;
      glucoseWarningHighFasting: number;
      glucoseWarningHighPostMeal: number;
    }>(
      `SELECT
         bp_critical_high_sys as "bpCriticalHighSys",
         bp_critical_high_dia as "bpCriticalHighDia",
         bp_warning_high_sys as "bpWarningHighSys",
         bp_warning_high_dia as "bpWarningHighDia",
         bp_critical_low_sys as "bpCriticalLowSys",
         bp_critical_low_dia as "bpCriticalLowDia",
         glucose_critical_low as "glucoseCriticalLow",
         glucose_warning_low as "glucoseWarningLow",
         glucose_critical_high as "glucoseCriticalHigh",
         glucose_warning_high_fasting as "glucoseWarningHighFasting",
         glucose_warning_high_post_meal as "glucoseWarningHighPostMeal"
       FROM user_alert_thresholds
       WHERE user_id = $1`,
      [userId]
    );

    // Return custom thresholds or defaults
    return {
      bloodPressure: {
        criticalHigh: {
          systolic: customThresholds?.bpCriticalHighSys || 180,
          diastolic: customThresholds?.bpCriticalHighDia || 120,
        },
        warningHigh: {
          systolic: customThresholds?.bpWarningHighSys || 140,
          diastolic: customThresholds?.bpWarningHighDia || 90,
        },
        criticalLow: {
          systolic: customThresholds?.bpCriticalLowSys || 90,
          diastolic: customThresholds?.bpCriticalLowDia || 60,
        },
        warningLow: {
          systolic: 100,
          diastolic: 65,
        },
      },
      glucose: {
        criticalLow: customThresholds?.glucoseCriticalLow || 70,
        warningLow: customThresholds?.glucoseWarningLow || 80,
        criticalHigh: customThresholds?.glucoseCriticalHigh || 400,
        warningHighFasting: customThresholds?.glucoseWarningHighFasting || 125,
        warningHighPostMeal: customThresholds?.glucoseWarningHighPostMeal || 180,
      },
    };
  }

  /**
   * Update user's alert thresholds
   */
  async updateUserThresholds(
    userId: string,
    thresholds: Partial<AlertThresholds>
  ): Promise<void> {
    await query(
      `INSERT INTO user_alert_thresholds (
         user_id,
         bp_critical_high_sys, bp_critical_high_dia,
         bp_warning_high_sys, bp_warning_high_dia,
         bp_critical_low_sys, bp_critical_low_dia,
         glucose_critical_low, glucose_warning_low,
         glucose_critical_high, glucose_warning_high_fasting, glucose_warning_high_post_meal
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (user_id) DO UPDATE SET
         bp_critical_high_sys = COALESCE(EXCLUDED.bp_critical_high_sys, user_alert_thresholds.bp_critical_high_sys),
         bp_critical_high_dia = COALESCE(EXCLUDED.bp_critical_high_dia, user_alert_thresholds.bp_critical_high_dia),
         bp_warning_high_sys = COALESCE(EXCLUDED.bp_warning_high_sys, user_alert_thresholds.bp_warning_high_sys),
         bp_warning_high_dia = COALESCE(EXCLUDED.bp_warning_high_dia, user_alert_thresholds.bp_warning_high_dia),
         bp_critical_low_sys = COALESCE(EXCLUDED.bp_critical_low_sys, user_alert_thresholds.bp_critical_low_sys),
         bp_critical_low_dia = COALESCE(EXCLUDED.bp_critical_low_dia, user_alert_thresholds.bp_critical_low_dia),
         glucose_critical_low = COALESCE(EXCLUDED.glucose_critical_low, user_alert_thresholds.glucose_critical_low),
         glucose_warning_low = COALESCE(EXCLUDED.glucose_warning_low, user_alert_thresholds.glucose_warning_low),
         glucose_critical_high = COALESCE(EXCLUDED.glucose_critical_high, user_alert_thresholds.glucose_critical_high),
         glucose_warning_high_fasting = COALESCE(EXCLUDED.glucose_warning_high_fasting, user_alert_thresholds.glucose_warning_high_fasting),
         glucose_warning_high_post_meal = COALESCE(EXCLUDED.glucose_warning_high_post_meal, user_alert_thresholds.glucose_warning_high_post_meal)`,
      [
        userId,
        thresholds.bloodPressure?.criticalHigh?.systolic,
        thresholds.bloodPressure?.criticalHigh?.diastolic,
        thresholds.bloodPressure?.warningHigh?.systolic,
        thresholds.bloodPressure?.warningHigh?.diastolic,
        thresholds.bloodPressure?.criticalLow?.systolic,
        thresholds.bloodPressure?.criticalLow?.diastolic,
        thresholds.glucose?.criticalLow,
        thresholds.glucose?.warningLow,
        thresholds.glucose?.criticalHigh,
        thresholds.glucose?.warningHighFasting,
        thresholds.glucose?.warningHighPostMeal,
      ]
    );
  }

  /**
   * Check if a caregiver can access a patient's alerts
   */
  private async checkCaregiverAccess(caregiverId: string, patientId: string): Promise<boolean> {
    const result = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM caregiver_relationships
         WHERE caregiver_id = $1 AND patient_id = $2
       ) as exists`,
      [caregiverId, patientId]
    );

    return result?.exists || false;
  }
}
