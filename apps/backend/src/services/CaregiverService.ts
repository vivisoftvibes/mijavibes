/**
 * Caregiver Service (SPEC-005)
 *
 * Enhanced caregiver-patient relationship management
 * - Multiple caregiver types (primary, secondary, professional)
 * - Professional caregiver shift management
 * - Consent and privacy features
 * - Activity logging
 */

import { query, queryOne, transaction } from '../database/connection';
import { NotFoundError, ValidationError, ForbiddenError } from '../middleware/errorHandler';
import crypto from 'crypto';
import { caregiverNotificationService } from './CaregiverNotificationService';

// ============================================================================
// Types
// ============================================================================

export type CaregiverRole = 'primary' | 'secondary' | 'professional';
export type CaregiverStatus = 'pending' | 'active' | 'paused' | 'ended';

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
  createdAt: Date;
  endedAt?: Date;
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

export interface PatientCard {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  address?: string;
  isPrimary: boolean;
  role: CaregiverRole;
  status: CaregiverStatus;
}

export interface PatientStatus {
  patientId: string;
  timestamp: Date;
  medications: {
    scheduled: number;
    taken: number;
    missed: number;
    pending: number;
  };
  vitals: {
    lastBP?: { value: string; timestamp: Date; abnormal: boolean };
    lastGlucose?: { value: number; timestamp: Date; abnormal: boolean };
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
  status: 'all_good' | 'attention_needed' | 'critical';
}

export interface PatientDetail {
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
    photoUrl?: string;
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };
  relationship: {
    id: string;
    role: CaregiverRole;
    status: CaregiverStatus;
    permissions: CaregiverRelationship['permissions'];
    isPrimary: boolean;
  };
  medications: {
    today: Array<{
      id: string;
      name: string;
      dosage: string;
      scheduledTime: string;
      status: 'taken' | 'pending' | 'missed' | 'skipped';
      takenAt?: Date;
      photoUrl?: string;
    }>;
    week: {
      total: number;
      taken: number;
      missed: number;
      adherence: number;
    };
  };
  vitals: {
    bloodPressure: Array<{
      id: string;
      systolic: number;
      diastolic: number;
      measuredAt: Date;
      isAbnormal: boolean;
    }>;
    glucose: Array<{
      id: string;
      value: number;
      measuredAt: Date;
      isAbnormal: boolean;
    }>;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    createdAt: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
  }>;
  activity: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: Date;
    caregiver?: {
      id: string;
      name: string;
    };
  }>;
  otherCaregivers: Array<{
    id: string;
    name: string;
    role: CaregiverRole;
    status: CaregiverStatus;
  }>;
}

export interface CaregiverAction {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  alertId?: string;
  notificationId?: string;
  type: 'acknowledged' | 'called_patient' | 'called_emergency' | 'marked_skipped' | 'added_note';
  notes?: string;
  createdAt: Date;
}

export interface CaregiverInvite {
  id: string;
  patientId: string;
  patientName: string;
  email: string;
  token: string;
  role: CaregiverRole;
  expiresAt: Date;
}

// ============================================================================
// Service
// ============================================================================

export class CaregiverService {
  /**
   * Get all patients for a caregiver (CG-001)
   */
  async getCaregiverPatients(caregiverId: string): Promise<PatientCard[]> {
    const today = new Date().toISOString().split('T')[0];

    const patients = await query<
      PatientCard & {
        patient_id: string;
        is_primary: boolean;
        caregiver_role: CaregiverRole;
        caregiver_status: CaregiverStatus;
      }
    >(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.phone,
         u.photo_url as "photoUrl",
         u.date_of_birth as "dateOfBirth",
         u.address,
         cr.is_primary as "isPrimary",
         cr.role as "caregiverRole",
         cr.status as "caregiverStatus"
       FROM caregiver_relationships cr
       JOIN users u ON cr.patient_id = u.id
       WHERE cr.caregiver_id = $1 AND u.is_active = TRUE AND cr.status = 'active'
       ORDER BY cr.is_primary DESC, cr.role, u.name`,
      [caregiverId]
    );

    return patients.map(p => ({
      id: p.patient_id || p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      photoUrl: p.photoUrl,
      dateOfBirth: p.dateOfBirth,
      address: p.address,
      isPrimary: p.isPrimary,
      role: p.caregiverRole,
      status: p.caregiverStatus,
    }));
  }

  /**
   * Get detailed patient information for caregiver (CG-004)
   */
  async getPatientDetail(caregiverId: string, patientId: string): Promise<PatientDetail> {
    // Verify caregiver has access
    const relationship = await queryOne<
      CaregiverRelationship & { patient_name: string; patient_email: string }
    >(
      `SELECT cr.*, u.name as patient_name, u.email as patient_email
       FROM caregiver_relationships cr
       JOIN users u ON cr.patient_id = u.id
       WHERE cr.caregiver_id = $1 AND cr.patient_id = $2 AND cr.status = 'active'`,
      [caregiverId, patientId]
    );

    if (!relationship) {
      throw new ForbiddenError('You do not have access to this patient');
    }

    // Get patient details
    const patient = await queryOne<{
      id: string;
      name: string;
      email: string;
      phone?: string;
      dateOfBirth?: string;
      photoUrl?: string;
      address?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    }>(
      `SELECT
         id, name, email, phone, photo_url as "photoUrl",
         date_of_birth as "dateOfBirth", address,
         emergency_contact_name as "emergencyContactName",
         emergency_contact_phone as "emergencyContactPhone"
       FROM users WHERE id = $1`,
      [patientId]
    );

    if (!patient) {
      throw new NotFoundError('Patient');
    }

    // Get medications for today
    const today = new Date().toISOString().split('T')[0];
    const todayMedications = await query<
      {
        id: string;
        name: string;
        dosage: string;
        scheduledTime: string;
        status: string;
        takenAt?: Date;
        photoUrl?: string;
      }
    >(
      `SELECT
         m.id, m.name, m.dosage, m.times,
         ml.status, ml.taken_at as "takenAt", m.photo_url as "photoUrl"
       FROM medications m
       LEFT JOIN medication_logs ml ON ml.medication_id = m.id
         AND DATE(ml.scheduled_at) = $2
       WHERE m.user_id = $1 AND m.is_active = TRUE
       ORDER BY m.times`,
      [patientId, today]
    );

    // Expand times into individual schedules
    const expandedMedications = todayMedications.flatMap(med => {
      const times = Array.isArray(med.times) ? med.times : [med.times];
      return times.map(time => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        scheduledTime: time,
        status: med.status || 'pending',
        takenAt: med.takenAt,
        photoUrl: med.photoUrl,
      }));
    });

    // Get week stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekStats = await queryOne<{
      total: bigint;
      taken: bigint;
      missed: bigint;
    }>(
      `SELECT
         COUNT(DISTINCT ml.id)::bigint as total,
         COUNT(DISTINCT ml.id) FILTER (WHERE ml.status = 'taken')::bigint as taken,
         COUNT(DISTINCT ml.id) FILTER (WHERE ml.status = 'skipped' OR ml.status = 'missed')::bigint as missed
       FROM medication_logs ml
       WHERE ml.medication_id IN (SELECT id FROM medications WHERE user_id = $1)
         AND ml.scheduled_at >= $2`,
      [patientId, weekAgo.toISOString()]
    );

    // Get recent vitals
    const vitalsBP = await query<
      { id: string; systolic: number; diastolic: number; measuredAt: Date }
    >(
      `SELECT id, systolic, diastolic, measured_at as "measuredAt"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure'
       ORDER BY measured_at DESC
       LIMIT 7`,
      [patientId]
    );

    const vitalsGlucose = await query<
      { id: string; value: number; measuredAt: Date }
    >(
      `SELECT id, CAST(value AS INTEGER) as value, measured_at as "measuredAt"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose'
       ORDER BY measured_at DESC
       LIMIT 7`,
      [patientId]
    );

    // Get recent alerts
    const alerts = await query<{
      id: string;
      type: string;
      severity: string;
      status: string;
      createdAt: Date;
      acknowledgedAt?: Date;
      acknowledgedBy?: string;
    }>(
      `SELECT id, type, severity, status, created_at as "createdAt",
              acknowledged_at as "acknowledgedAt", acknowledged_by as "acknowledgedBy"
       FROM emergency_alerts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [patientId]
    );

    // Get caregiver activity
    const activity = await query<
      {
        id: string;
        type: string;
        description: string;
        createdAt: Date;
        caregiverId: string;
        caregiverName: string;
      }
    >(
      `SELECT ca.id, ca.type, ca.notes as description, ca.created_at as "createdAt",
              ca.caregiver_id as "caregiverId", u.name as "caregiverName"
       FROM caregiver_actions ca
       JOIN users u ON ca.caregiver_id = u.id
       WHERE ca.patient_id = $1
       ORDER BY ca.created_at DESC
       LIMIT 20`,
      [patientId]
    );

    // Get other caregivers
    const otherCaregivers = await query<{
      id: string;
      name: string;
      role: CaregiverRole;
      status: CaregiverStatus;
    }>(
      `SELECT u.id, u.name, cr.role, cr.status
       FROM caregiver_relationships cr
       JOIN users u ON cr.caregiver_id = u.id
       WHERE cr.patient_id = $1 AND cr.caregiver_id != $2 AND cr.status = 'active'`,
      [patientId, caregiverId]
    );

    return {
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        photoUrl: patient.photoUrl,
        address: patient.address,
        emergencyContactName: patient.emergencyContactName,
        emergencyContactPhone: patient.emergencyContactPhone,
      },
      relationship: {
        id: relationship.id,
        role: relationship.role,
        status: relationship.status,
        permissions: relationship.permissions,
        isPrimary: relationship.is_primary,
      },
      medications: {
        today: expandedMedications,
        week: {
          total: Number(weekStats?.total || 0),
          taken: Number(weekStats?.taken || 0),
          missed: Number(weekStats?.missed || 0),
          adherence: weekStats && Number(weekStats.total) > 0
            ? Math.round((Number(weekStats.taken) / Number(weekStats.total)) * 100)
            : 100,
        },
      },
      vitals: {
        bloodPressure: vitalsBP.map(bp => ({
          ...bp,
          isAbnormal: bp.systolic > 140 || bp.diastolic > 90,
        })),
        glucose: vitalsGlucose.map(g => ({
          ...g,
          isAbnormal: g.value > 130,
        })),
      },
      alerts,
      activity: activity.map(a => ({
        id: a.id,
        type: a.type,
        description: a.description || '',
        createdAt: a.createdAt,
        caregiver: {
          id: a.caregiverId,
          name: a.caregiverName,
        },
      })),
      otherCaregivers,
    };
  }

  /**
   * Get patient status for caregiver dashboard cards
   */
  async getPatientStatus(caregiverId: string, patientId: string): Promise<PatientStatus> {
    // Verify access
    const hasAccess = await queryOne<{ id: string }>(
      'SELECT id FROM caregiver_relationships WHERE caregiver_id = $1 AND patient_id = $2 AND status = $3',
      [caregiverId, patientId, 'active']
    );

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this patient');
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Get medication status
    const medicationStats = await queryOne<{
      scheduled: bigint;
      taken: bigint;
      missed: bigint;
      pending: bigint;
    }>(
      `SELECT
         COUNT(DISTINCT m.id)::bigint as scheduled,
         COUNT(DISTINCT ml.id) FILTER (WHERE ml.status = 'taken' AND DATE(ml.scheduled_at) = $2)::bigint as taken,
         COUNT(DISTINCT ml.id) FILTER (WHERE ml.status IN ('skipped', 'missed') AND DATE(ml.scheduled_at) = $2)::bigint as missed,
         COUNT(DISTINCT ml.id) FILTER (WHERE ml.status = 'pending' AND ml.scheduled_at <= NOW())::bigint as pending
       FROM medications m
       LEFT JOIN medication_logs ml ON ml.medication_id = m.id AND DATE(ml.scheduled_at) = $2
       WHERE m.user_id = $1 AND m.is_active = TRUE`,
      [patientId, today]
    );

    // Get latest vitals
    const latestBP = await queryOne<{ systolic: number; diastolic: number; measuredAt: Date }>(
      `SELECT systolic, diastolic, measured_at as "measuredAt"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure'
       ORDER BY measured_at DESC
       LIMIT 1`,
      [patientId]
    );

    const latestGlucose = await queryOne<{ value: number; measuredAt: Date }>(
      `SELECT CAST(value AS INTEGER) as value, measured_at as "measuredAt"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose'
       ORDER BY measured_at DESC
       LIMIT 1`,
      [patientId]
    );

    // Get recent activity
    const recentActivity = await query<{
      type: string;
      description: string;
      timestamp: Date;
    }>(
      `SELECT
         'medication' as type,
         'Took ' || m.name as description,
         ml.taken_at as timestamp
       FROM medication_logs ml
       JOIN medications m ON ml.medication_id = m.id
       WHERE ml.user_id = $1 AND ml.taken_at > NOW() - INTERVAL '24 hours'
       UNION ALL
       SELECT
         'vital' as type,
         'Recorded ' || type as description,
         measured_at as timestamp
       FROM vital_signs
       WHERE user_id = $1 AND measured_at > NOW() - INTERVAL '24 hours'
       ORDER BY timestamp DESC
       LIMIT 5`,
      [patientId]
    );

    // Determine overall status
    let status: 'all_good' | 'attention_needed' | 'critical' = 'all_good';

    const taken = Number(medicationStats?.taken || 0);
    const missed = Number(medicationStats?.missed || 0);
    const scheduled = Number(medicationStats?.scheduled || 0);

    if (scheduled > 0 && missed > 0) {
      const adherenceRate = taken / scheduled;
      if (adherenceRate < 0.5) {
        status = 'critical';
      } else if (adherenceRate < 0.8) {
        status = 'attention_needed';
      }
    }

    if (latestBP && (latestBP.systolic > 160 || latestBP.diastolic > 100)) {
      status = 'critical';
    } else if (latestBP && (latestBP.systolic > 140 || latestBP.diastolic > 90)) {
      status = status === 'all_good' ? 'attention_needed' : status;
    }

    if (latestGlucose && latestGlucose.value > 180) {
      status = 'critical';
    } else if (latestGlucose && latestGlucose.value > 130) {
      status = status === 'all_good' ? 'attention_needed' : status;
    }

    return {
      patientId,
      timestamp: now,
      medications: {
        scheduled,
        taken,
        missed,
        pending: Number(medicationStats?.pending || 0),
      },
      vitals: {
        lastBP: latestBP
          ? {
              value: `${latestBP.systolic}/${latestBP.diastolic} mmHg`,
              timestamp: latestBP.measuredAt,
              abnormal: latestBP.systolic > 140 || latestBP.diastolic > 90,
            }
          : undefined,
        lastGlucose: latestGlucose
          ? {
              value: latestGlucose.value,
              timestamp: latestGlucose.measuredAt,
              abnormal: latestGlucose.value > 130,
            }
          : undefined,
      },
      recentActivity,
      status,
    };
  }

  /**
   * Invite a caregiver (requires patient consent)
   */
  async inviteCaregiver(
    patientId: string,
    input: {
      email: string;
      role: CaregiverRole;
      notificationPreferences?: Record<string, boolean>;
      professionalSchedule?: ProfessionalSchedule;
    }
  ): Promise<CaregiverInvite> {
    // Check if caregiver user exists
    const existingUser = await queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM users WHERE email = $1',
      [input.email]
    );

    // Check if relationship already exists
    if (existingUser) {
      const existingRelationship = await queryOne<CaregiverRelationship>(
        'SELECT * FROM caregiver_relationships WHERE patient_id = $1 AND caregiver_id = $2',
        [patientId, existingUser.id]
      );

      if (existingRelationship && existingRelationship.status !== 'ended') {
        throw new ValidationError('Caregiver relationship already exists');
      }
    }

    // Get patient name
    const patient = await queryOne<{ name: string }>(
      'SELECT name FROM users WHERE id = $1',
      [patientId]
    );

    if (!patient) {
      throw new NotFoundError('Patient');
    }

    // Create invite token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Store invite
    const inviteId = crypto.randomUUID();

    await query(
      `INSERT INTO caregiver_invites
       (id, patient_id, email, token, role, notification_preferences, professional_schedule, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        inviteId,
        patientId,
        input.email,
        token,
        input.role,
        input.notificationPreferences ? JSON.stringify(input.notificationPreferences) : null,
        input.professionalSchedule ? JSON.stringify(input.professionalSchedule) : null,
        expiresAt,
      ]
    );

    // TODO: Send email with invite link

    return {
      id: inviteId,
      patientId,
      patientName: patient.name,
      email: input.email,
      token,
      role: input.role,
      expiresAt,
    };
  }

  /**
   * Accept caregiver invite
   */
  async acceptInvite(userId: string, token: string): Promise<CaregiverRelationship> {
    const invite = await queryOne<
      CaregiverInvite & {
        notification_preferences: string | null;
        professional_schedule: string | null;
      }
    >(
      'SELECT * FROM caregiver_invites WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (!invite) {
      throw new ValidationError('Invalid or expired invite token');
    }

    // Check if email matches user email
    const user = await queryOne<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ValidationError('This invite was sent to a different email address');
    }

    // Create relationship
    const relationshipId = crypto.randomUUID();

    const permissions = this.getDefaultPermissions(invite.role);

    await query(
      `INSERT INTO caregiver_relationships
       (id, patient_id, caregiver_id, role, status, permissions, notification_preferences, professional_schedule, created_at)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, NOW())
       RETURNING id, patient_id as "patientId", caregiver_id as "caregiverId", role, status, permissions,
                 notification_preferences as "notificationPreferences", professional_schedule as "professionalSchedule", created_at as "createdAt"`,
      [
        relationshipId,
        invite.patientId,
        userId,
        invite.role,
        JSON.stringify(permissions),
        invite.notification_preferences,
        invite.professional_schedule,
      ]
    );

    // Delete invite
    await query('DELETE FROM caregiver_invites WHERE id = $1', [invite.id]);

    // Log the action
    await caregiverNotificationService.logCaregiverAction({
      patientId: invite.patientId,
      caregiverId: userId,
      type: 'acknowledged',
      notes: `Accepted caregiver invite as ${invite.role}`,
    });

    return await this.getRelationshipById(relationshipId);
  }

  /**
   * Get relationship by ID
   */
  private async getRelationshipById(relationshipId: string): Promise<CaregiverRelationship> {
    const row = await queryOne<
      CaregiverRelationship & {
        patient_id: string;
        caregiver_id: string;
        notification_preferences: string;
        professional_schedule: string | null;
      }
    >('SELECT * FROM caregiver_relationships WHERE id = $1', [relationshipId]);

    if (!row) {
      throw new NotFoundError('Caregiver relationship');
    }

    return {
      id: row.id,
      patientId: row.patient_id,
      caregiverId: row.caregiver_id,
      role: row.role,
      status: row.status,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      notificationPreferences: typeof row.notification_preferences === 'string'
        ? JSON.parse(row.notification_preferences)
        : row.notification_preferences,
      professionalSchedule: row.professional_schedule
        ? typeof row.professional_schedule === 'string'
          ? JSON.parse(row.professional_schedule)
          : row.professional_schedule
        : undefined,
      createdAt: row.created_at,
      endedAt: row.ended_at,
    };
  }

  /**
   * Get default permissions for a role
   */
  private getDefaultPermissions(role: CaregiverRole) {
    switch (role) {
      case 'primary':
        return {
          viewVitals: true,
          viewMedications: true,
          receiveAlerts: true,
          modifySchedule: true,
          contactPatient: true,
        };
      case 'secondary':
        return {
          viewVitals: true,
          viewMedications: true,
          receiveAlerts: true,
          modifySchedule: false,
          contactPatient: false,
        };
      case 'professional':
        return {
          viewVitals: true,
          viewMedications: true,
          receiveAlerts: true,
          modifySchedule: true,
          contactPatient: true,
        };
      default:
        return {
          viewVitals: false,
          viewMedications: false,
          receiveAlerts: false,
          modifySchedule: false,
          contactPatient: false,
        };
    }
  }

  /**
   * Remove caregiver relationship
   */
  async removeRelationship(userId: string, relationshipId: string): Promise<void> {
    const relationship = await queryOne<
      CaregiverRelationship & { patient_id: string; caregiver_id: string }
    >(
      'SELECT * FROM caregiver_relationships WHERE id = $1',
      [relationshipId]
    );

    if (!relationship) {
      throw new NotFoundError('Caregiver relationship');
    }

    // Check if user is either patient or caregiver
    if (relationship.patient_id !== userId && relationship.caregiver_id !== userId) {
      throw new ForbiddenError('You do not have permission to remove this relationship');
    }

    await query(
      'UPDATE caregiver_relationships SET status = $1, ended_at = NOW() WHERE id = $2',
      ['ended', relationshipId]
    );
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    relationshipId: string,
    preferences: Partial<{
      medicationMissed: boolean;
      vitalAbnormal: boolean;
      emergencyAlerts: boolean;
      quietHours: { enabled: boolean; start: string; end: string };
    }>
  ): Promise<CaregiverRelationship> {
    const relationship = await queryOne<
      CaregiverRelationship & { caregiver_id: string; notification_preferences: string }
    >(
      'SELECT * FROM caregiver_relationships WHERE id = $1',
      [relationshipId]
    );

    if (!relationship) {
      throw new NotFoundError('Caregiver relationship');
    }

    // Only caregiver can update their own preferences
    if (relationship.caregiver_id !== userId) {
      throw new ForbiddenError('Only the caregiver can update notification preferences');
    }

    const currentPrefs = typeof relationship.notification_preferences === 'string'
      ? JSON.parse(relationship.notification_preferences)
      : relationship.notification_preferences;

    const updatedPrefs = {
      ...currentPrefs,
      ...preferences,
      quietHours: {
        ...currentPrefs.quietHours,
        ...(preferences.quietHours || {}),
      },
    };

    await query(
      'UPDATE caregiver_relationships SET notification_preferences = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedPrefs), relationshipId]
    );

    return this.getRelationshipById(relationshipId);
  }

  /**
   * Update professional schedule
   */
  async updateProfessionalSchedule(
    userId: string,
    relationshipId: string,
    schedule: ProfessionalSchedule
  ): Promise<CaregiverRelationship> {
    const relationship = await queryOne<
      CaregiverRelationship & { caregiver_id: string; role: CaregiverRole }
    >(
      'SELECT * FROM caregiver_relationships WHERE id = $1',
      [relationshipId]
    );

    if (!relationship) {
      throw new NotFoundError('Caregiver relationship');
    }

    if (relationship.role !== 'professional') {
      throw new ValidationError('Schedule can only be set for professional caregivers');
    }

    // Only caregiver or patient can update
    if (relationship.caregiver_id !== userId) {
      // Check if user is the patient
      const isPatient = await queryOne<{ id: string }>(
        'SELECT id FROM caregiver_relationships WHERE id = $1 AND patient_id = $2',
        [relationshipId, userId]
      );

      if (!isPatient) {
        throw new ForbiddenError('Only the caregiver or patient can update schedule');
      }
    }

    await query(
      'UPDATE caregiver_relationships SET professional_schedule = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(schedule), relationshipId]
    );

    return this.getRelationshipById(relationshipId);
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
    return caregiverNotificationService.logCaregiverAction(params);
  }

  /**
   * Get caregiver actions for a patient
   */
  async getCaregiverActions(patientId: string, limit = 50): Promise<CaregiverAction[]> {
    const rows = await query<
      CaregiverAction & { caregiver_name: string }
    >(
      `SELECT ca.*, u.name as "caregiverName"
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
   * Pause notifications for a relationship
   */
  async pauseNotifications(userId: string, relationshipId: string): Promise<CaregiverRelationship> {
    const relationship = await queryOne<
      CaregiverRelationship & { caregiver_id: string; patient_id: string }
    >(
      'SELECT * FROM caregiver_relationships WHERE id = $1',
      [relationshipId]
    );

    if (!relationship) {
      throw new NotFoundError('Caregiver relationship');
    }

    // Only caregiver can pause their own notifications
    if (relationship.caregiver_id !== userId) {
      throw new ForbiddenError('Only the caregiver can pause their notifications');
    }

    await query(
      'UPDATE caregiver_relationships SET status = $1, updated_at = NOW() WHERE id = $2',
      ['paused', relationshipId]
    );

    return this.getRelationshipById(relationshipId);
  }

  /**
   * Resume notifications for a relationship
   */
  async resumeNotifications(userId: string, relationshipId: string): Promise<CaregiverRelationship> {
    const relationship = await queryOne<
      CaregiverRelationship & { caregiver_id: string }
    >(
      'SELECT * FROM caregiver_relationships WHERE id = $1',
      [relationshipId]
    );

    if (!relationship) {
      throw new NotFoundError('Caregiver relationship');
    }

    // Only caregiver can resume their own notifications
    if (relationship.caregiver_id !== userId) {
      throw new ForbiddenError('Only the caregiver can resume their notifications');
    }

    await query(
      'UPDATE caregiver_relationships SET status = $1, updated_at = NOW() WHERE id = $2',
      ['active', relationshipId]
    );

    return this.getRelationshipById(relationshipId);
  }
}

export const caregiverService = new CaregiverService();
