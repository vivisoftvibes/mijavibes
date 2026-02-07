/**
 * Vital Signs Service
 *
 * Handles vital signs recording and analysis
 * SPEC-003 Integration: Automatic emergency alert triggering
 * - Critical BP: >180/120 or <90/60
 * - Critical Glucose: <70 or >400 mg/dL
 * - Irregular Pattern: 3 consecutive high readings
 */

import { query, queryOne } from '../database/connection';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { logEmergencyEvent, logger } from '../utils/logger';
import { EmergencyService, type AlertType } from './EmergencyService';

export interface VitalSign {
  id: string;
  userId: string;
  type: 'blood_pressure' | 'glucose';
  systolic?: number;
  diastolic?: number;
  value?: string;
  unit: string;
  additionalData?: Record<string, unknown>;
  source: 'manual' | 'bluetooth_device';
  deviceId?: string;
  measuredAt: Date;
  createdAt: Date;
}

export interface BloodPressureInput {
  userId: string;
  systolic: number;
  diastolic: number;
  measuredAt: Date;
  source: 'manual' | 'bluetooth_device';
  deviceId?: string;
  additionalData?: Record<string, unknown>;
}

export interface GlucoseInput {
  userId: string;
  value: string;
  unit: string;
  measuredAt: Date;
  source: 'manual' | 'bluetooth_device';
  deviceId?: string;
  additionalData?: Record<string, unknown>;
}

export interface VitalSignSummary {
  bloodPressure: {
    latest?: VitalSign;
    averageSystolic: number;
    averageDiastolic: number;
    count: number;
    isAbnormal: boolean;
  };
  glucose: {
    latest?: VitalSign;
    average: number;
    count: number;
    isAbnormal: boolean;
  };
}

export interface TrendData {
  date: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

// Thresholds (US-013)
const BP_CRITICAL_HIGH = { systolic: 180, diastolic: 120 };
const BP_WARNING_HIGH = { systolic: 140, diastolic: 90 };
const BP_CRITICAL_LOW = { systolic: 90, diastolic: 60 };
const GLUCOSE_CRITICAL_LOW = 70;
const GLUCOSE_CRITICAL_HIGH = 400;
const GLUCOSE_WARNING_HIGH_FASTING = 130;
const GLUCOSE_WARNING_HIGH_POST_MEAL = 180;

export class VitalSignsService {
  private emergencyService: EmergencyService;

  constructor() {
    this.emergencyService = new EmergencyService();
  }

  /**
   * Check for irregular patterns after recording a vital sign
   * Triggers irregular_pattern alert if 3 consecutive high readings
   */
  private async checkIrregularPatterns(userId: string): Promise<void> {
    // Check for 3 consecutive high BP readings
    const highBPReadings = await query<{ count: bigint }>(
      `SELECT COUNT(*)::bigint as count
       FROM (
         SELECT measured_at, systolic, diastolic
         FROM vital_signs
         WHERE user_id = $1
           AND type = 'blood_pressure'
           AND measured_at > NOW() - INTERVAL '7 days'
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
        await this.emergencyService.createEmergencyAlert({
          userId,
          type: 'irregular_pattern',
          notes: '3 consecutive high blood pressure readings detected in the past 7 days',
        });
        logger.warn(`Irregular pattern alert created for user ${userId}`);
      }
    }
  }

  /**
   * Get all vital signs for a user
   */
  async getVitalSigns(
    userId: string,
    type?: string,
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<VitalSign[]> {
    let queryText = `
      SELECT id, user_id as "userId", type, systolic, diastolic, value, unit,
             additional_data as "additionalData", source, device_id as "deviceId",
             measured_at as "measuredAt", created_at as "createdAt"
      FROM vital_signs
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (type) {
      queryText += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    if (startDate) {
      queryText += ` AND measured_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      queryText += ` AND measured_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    queryText += ' ORDER BY measured_at DESC';

    if (limit) {
      queryText += ` LIMIT $${paramIndex++}`;
      params.push(limit);
    }

    return query<VitalSign>(queryText, params);
  }

  /**
   * Create blood pressure reading (US-010)
   * Triggers emergency alert if critical values detected (SPEC-003)
   */
  async createBloodPressure(input: BloodPressureInput): Promise<VitalSign> {
    const vitalSign = await queryOne<VitalSign>(
      `INSERT INTO vital_signs (user_id, type, systolic, diastolic, unit, additional_data, source, device_id, measured_at)
       VALUES ($1, 'blood_pressure', $2, $3, 'mmHg', $4, $5, $6, $7)
       RETURNING id, user_id as "userId", type, systolic, diastolic, value, unit,
                 additional_data as "additionalData", source, device_id as "deviceId",
                 measured_at as "measuredAt", created_at as "createdAt"`,
      [
        input.userId,
        input.systolic,
        input.diastolic,
        input.additionalData || {},
        input.source,
        input.deviceId || null,
        input.measuredAt,
      ]
    );

    if (!vitalSign) {
      throw new Error('Failed to create vital sign');
    }

    // Check for critical values and trigger emergency alert if needed (US-013, SPEC-003 EA-001)
    const isCritical =
      input.systolic >= BP_CRITICAL_HIGH.systolic ||
      input.diastolic >= BP_CRITICAL_HIGH.diastolic ||
      input.systolic <= BP_CRITICAL_LOW.systolic ||
      input.diastolic <= BP_CRITICAL_LOW.diastolic;

    if (isCritical) {
      await this.emergencyService.createEmergencyAlert({
        userId: input.userId,
        type: 'critical_bp',
        vitalSignId: vitalSign.id,
        notes: `BP: ${input.systolic}/${input.diastolic} mmHg`,
      });
      logger.warn(`Critical BP alert triggered for user ${input.userId}: ${input.systolic}/${input.diastolic}`);
    } else {
      // Check for irregular patterns (non-critical but concerning trends)
      await this.checkIrregularPatterns(input.userId);
    }

    return vitalSign;
  }

  /**
   * Create glucose reading (US-011)
   * Triggers emergency alert if critical values detected (SPEC-003)
   */
  async createGlucose(input: GlucoseInput): Promise<VitalSign> {
    const glucoseValue = parseInt(input.value);

    const vitalSign = await queryOne<VitalSign>(
      `INSERT INTO vital_signs (user_id, type, value, unit, additional_data, source, device_id, measured_at)
       VALUES ($1, 'glucose', $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id as "userId", type, systolic, diastolic, value, unit,
                 additional_data as "additionalData", source, device_id as "deviceId",
                 measured_at as "measuredAt", created_at as "createdAt"`,
      [
        input.userId,
        input.value,
        input.unit,
        input.additionalData || {},
        input.source,
        input.deviceId || null,
        input.measuredAt,
      ]
    );

    if (!vitalSign) {
      throw new Error('Failed to create vital sign');
    }

    // Check for critical values (US-013, SPEC-003 EA-001)
    const isCritical = glucoseValue <= GLUCOSE_CRITICAL_LOW || glucoseValue >= GLUCOSE_CRITICAL_HIGH;

    if (isCritical) {
      await this.emergencyService.createEmergencyAlert({
        userId: input.userId,
        type: 'critical_glucose',
        vitalSignId: vitalSign.id,
        notes: `Glucose: ${glucoseValue} mg/dL`,
      });
      logger.warn(`Critical glucose alert triggered for user ${input.userId}: ${glucoseValue} mg/dL`);
    }

    return vitalSign;
  }

  /**
   * Get a single vital sign by ID
   */
  async getVitalSign(userId: string, vitalSignId: string): Promise<VitalSign> {
    const vitalSign = await queryOne<VitalSign>(
      `SELECT id, user_id as "userId", type, systolic, diastolic, value, unit,
              additional_data as "additionalData", source, device_id as "deviceId",
              measured_at as "measuredAt", created_at as "createdAt"
       FROM vital_signs
       WHERE id = $1`,
      [vitalSignId]
    );

    if (!vitalSign) {
      throw new NotFoundError('Vital sign');
    }

    // Check access
    if (vitalSign.userId !== userId) {
      const isCaregiver = await this.checkCaregiverAccess(userId, vitalSign.userId);
      if (!isCaregiver) {
        throw new ValidationError('You do not have access to this vital sign');
      }
    }

    return vitalSign;
  }

  /**
   * Delete vital sign
   */
  async deleteVitalSign(userId: string, vitalSignId: string): Promise<void> {
    const vitalSign = await this.getVitalSign(userId, vitalSignId);

    if (vitalSign.userId !== userId) {
      throw new ValidationError('Only the owner can delete vital signs');
    }

    await query('DELETE FROM vital_signs WHERE id = $1', [vitalSignId]);
  }

  /**
   * Get vital signs summary (US-014)
   */
  async getSummary(userId: string, days: number): Promise<VitalSignSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Blood pressure stats
    const bpStats = await queryOne<{
      avgSystolic: string;
      avgDiastolic: string;
      count: bigint;
    }>(
      `SELECT
         AVG(systolic)::varchar as "avgSystolic",
         AVG(diastolic)::varchar as "avgDiastolic",
         COUNT(*)::bigint as count
       FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure' AND measured_at >= $2`,
      [userId, startDate]
    );

    const latestBP = await queryOne<VitalSign>(
      `SELECT id, user_id as "userId", type, systolic, diastolic, value, unit,
              additional_data as "additionalData", source, device_id as "deviceId",
              measured_at as "measuredAt", created_at as "createdAt"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure'
       ORDER BY measured_at DESC
       LIMIT 1`,
      [userId]
    );

    // Glucose stats
    const glucoseStats = await queryOne<{
      avg: string;
      count: bigint;
    }>(
      `SELECT
         AVG(CAST(value AS INTEGER))::varchar as avg,
         COUNT(*)::bigint as count
       FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose' AND measured_at >= $2`,
      [userId, startDate]
    );

    const latestGlucose = await queryOne<VitalSign>(
      `SELECT id, user_id as "userId", type, systolic, diastolic, value, unit,
              additional_data as "additionalData", source, device_id as "deviceId",
              measured_at as "measuredAt", created_at as "createdAt"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose'
       ORDER BY measured_at DESC
       LIMIT 1`,
      [userId]
    );

    return {
      bloodPressure: {
        latest: latestBP || undefined,
        averageSystolic: parseFloat(bpStats?.avgSystolic || '0'),
        averageDiastolic: parseFloat(bpStats?.avgDiastolic || '0'),
        count: Number(bpStats?.count || 0),
        isAbnormal: latestBP
          ? this.isBloodPressureAbnormal(latestBP.systolic!, latestBP.diastolic!)
          : false,
      },
      glucose: {
        latest: latestGlucose || undefined,
        average: parseFloat(glucoseStats?.avg || '0'),
        count: Number(glucoseStats?.count || 0),
        isAbnormal: latestGlucose
          ? this.isGlucoseAbnormal(
              parseInt(latestGlucose.value!),
              (latestGlucose.additionalData as any)?.fasting || false
            )
          : false,
      },
    };
  }

  /**
   * Get vital signs trends for charts (US-014)
   */
  async getTrends(
    userId: string,
    type: 'blood_pressure' | 'glucose',
    period: '7d' | '30d' | '90d'
  ): Promise<{ data: TrendData[]; thresholds?: { warning: number; critical: number } }> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await query<TrendData>(
      `SELECT
         DATE(measured_at) as date,
         CASE
           WHEN type = 'blood_pressure' THEN AVG(systolic)
           ELSE AVG(CAST(value AS NUMERIC))
         END as value,
         CASE WHEN type = 'blood_pressure' THEN AVG(systolic) END as systolic,
         CASE WHEN type = 'blood_pressure' THEN AVG(diastolic) END as diastolic
       FROM vital_signs
       WHERE user_id = $1 AND type = $2 AND measured_at >= $3
       GROUP BY DATE(measured_at)
       ORDER BY date ASC`,
      [userId, type, startDate]
    );

    if (type === 'glucose') {
      return {
        data,
        thresholds: {
          warning: GLUCOSE_WARNING_HIGH_FASTING,
          critical: GLUCOSE_CRITICAL_HIGH,
        },
      };
    }

    return { data };
  }

  /**
   * Check if latest readings are abnormal (US-013)
   */
  async checkAbnormalReadings(userId: string): Promise<{
    hasAbnormal: boolean;
    bloodPressure?: VitalSign & { isWarning: boolean; isCritical: boolean };
    glucose?: VitalSign & { isWarning: boolean; isCritical: boolean };
  }> {
    const result = {
      hasAbnormal: false,
      bloodPressure: undefined as VitalSign & { isWarning: boolean; isCritical: boolean } | undefined,
      glucose: undefined as VitalSign & { isWarning: boolean; isCritical: boolean } | undefined,
    };

    // Get latest blood pressure
    const latestBP = await queryOne<VitalSign & { additionalData: any }>(
      `SELECT * FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure'
       ORDER BY measured_at DESC
       LIMIT 1`,
      [userId]
    );

    if (latestBP) {
      const isCritical =
        latestBP.systolic! >= BP_CRITICAL_HIGH.systolic ||
        latestBP.diastolic! >= BP_CRITICAL_HIGH.diastolic ||
        latestBP.systolic! <= BP_CRITICAL_LOW.systolic ||
        latestBP.diastolic! <= BP_CRITICAL_LOW.diastolic;

      const isWarning =
        !isCritical &&
        (latestBP.systolic! >= BP_WARNING_HIGH.systolic ||
          latestBP.diastolic! >= BP_WARNING_HIGH.diastolic);

      if (isWarning || isCritical) {
        result.hasAbnormal = true;
        result.bloodPressure = {
          ...latestBP,
          isWarning,
          isCritical,
        } as any;
      }
    }

    // Get latest glucose
    const latestGlucose = await queryOne<VitalSign & { additionalData: any }>(
      `SELECT * FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose'
       ORDER BY measured_at DESC
       LIMIT 1`,
      [userId]
    );

    if (latestGlucose) {
      const glucoseValue = parseInt(latestGlucose.value!);
      const fasting = latestGlucose.additionalData?.fasting || false;

      const isCritical = glucoseValue <= GLUCOSE_CRITICAL_LOW || glucoseValue >= GLUCOSE_CRITICAL_HIGH;
      const isWarning =
        !isCritical &&
        (fasting
          ? glucoseValue >= GLUCOSE_WARNING_HIGH_FASTING
          : glucoseValue >= GLUCOSE_WARNING_HIGH_POST_MEAL);

      if (isWarning || isCritical) {
        result.hasAbnormal = true;
        result.glucose = {
          ...latestGlucose,
          isWarning,
          isCritical,
        } as any;
      }
    }

    return result;
  }

  private isBloodPressureAbnormal(systolic: number, diastolic: number): boolean {
    return (
      systolic >= BP_WARNING_HIGH.systolic ||
      diastolic >= BP_WARNING_HIGH.diastolic ||
      systolic <= BP_CRITICAL_LOW.systolic ||
      diastolic <= BP_CRITICAL_LOW.diastolic
    );
  }

  private isGlucoseAbnormal(value: number, fasting: boolean): boolean {
    if (value <= GLUCOSE_CRITICAL_LOW || value >= GLUCOSE_CRITICAL_HIGH) {
      return true;
    }
    return fasting ? value >= GLUCOSE_WARNING_HIGH_FASTING : value >= GLUCOSE_WARNING_HIGH_POST_MEAL;
  }

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
