/**
 * Medication Service
 *
 * Handles medication management, reminders, and adherence tracking
 * US-001: Display today's medication reminders
 * US-002: Send push notifications for reminders
 * US-003: Mark medication as taken
 * US-004: Photo upload support
 * US-005: Low supply alerts
 */

import { query, queryOne, transaction } from '../database/connection';
import { NotFoundError, ValidationError, ForbiddenError } from '../middleware/errorHandler';

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  photoUrl?: string;
  supplyDays?: number;
  rxNumber?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface MedicationLog {
  id: string;
  userId: string;
  medicationId: string;
  scheduledAt: Date;
  takenAt?: Date;
  status: 'pending' | 'taken' | 'skipped';
  notes?: string;
}

export interface TodaySchedule {
  medicationId: string;
  medicationName: string;
  dosage: string;
  photoUrl?: string;
  scheduledTime: string;
  logId?: string;
  status: 'pending' | 'taken' | 'skipped';
  takenAt?: Date;
}

export interface CreateMedicationInput {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  photoUrl?: string;
  supplyDays?: number;
  rxNumber?: string;
  notes?: string;
}

export class MedicationService {
  /**
   * Get all medications for a user
   */
  async getUserMedications(userId: string): Promise<Medication[]> {
    return query<Medication>(
      `SELECT id, user_id as "userId", name, dosage, frequency, times, photo_url as "photoUrl",
              supply_days as "supplyDays", rx_number as "rxNumber", notes, is_active as "isActive", created_at as "createdAt"
       FROM medications
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY name`,
      [userId]
    );
  }

  /**
   * Get today's medication schedule (US-001)
   */
  async getTodaysSchedule(userId: string, date: Date): Promise<TodaySchedule[]> {
    const dateStr = date.toISOString().split('T')[0];

    return query<TodaySchedule>(
      `SELECT m.id as "medicationId",
              m.name as "medicationName",
              m.dosage,
              m.photo_url as "photoUrl",
              UNNEST(m.times) as "scheduledTime",
              ml.id as "logId",
              COALESCE(ml.status, 'pending') as status,
              ml.taken_at as "takenAt"
       FROM medications m
       CROSS JOIN LATERAL UNNEST(m.times) AS scheduled_time
       LEFT JOIN LATERAL (
         SELECT id, status, taken_at
         FROM medication_logs
         WHERE medication_id = m.id
           AND user_id = $1
           AND DATE(scheduled_at) = $2
           AND EXTRACT(HOUR FROM scheduled_at) = EXTRACT(HOUR FROM scheduled_time)::integer
         LIMIT 1
       ) ml ON true
       WHERE m.user_id = $1 AND m.is_active = TRUE
       ORDER BY scheduled_time`,
      [userId, dateStr]
    );
  }

  /**
   * Create a new medication
   */
  async createMedication(userId: string, input: CreateMedicationInput): Promise<Medication> {
    // Check for low supply (US-005)
    const isLowSupply = input.supplyDays !== undefined && input.supplyDays < 7;

    const medication = await queryOne<Medication>(
      `INSERT INTO medications (user_id, name, dosage, frequency, times, photo_url, supply_days, rx_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id as "userId", name, dosage, frequency, times, photo_url as "photoUrl",
                 supply_days as "supplyDays", rx_number as "rxNumber", notes, is_active as "isActive", created_at as "createdAt"`,
      [
        userId,
        input.name,
        input.dosage,
        input.frequency,
        input.times,
        input.photoUrl || null,
        input.supplyDays || null,
        input.rxNumber || null,
        input.notes || null,
      ]
    );

    if (!medication) {
      throw new Error('Failed to create medication');
    }

    // Create medication logs for the next 30 days
    await this.createMedicationLogs(medication.id, userId, medication.times);

    return {
      ...medication,
      isLowSupply,
    } as Medication & { isLowSupply?: boolean };
  }

  /**
   * Create medication logs for future dates
   */
  private async createMedicationLogs(medicationId: string, userId: string, times: string[]): Promise<void> {
    const logs: Array<{ userId: string; medicationId: string; scheduledAt: Date }> = [];

    for (let day = 0; day < 30; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);
      date.setHours(0, 0, 0, 0);

      for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledAt = new Date(date);
        scheduledAt.setHours(hours, minutes, 0, 0);

        logs.push({ userId, medicationId, scheduledAt });
      }
    }

    // Batch insert
    for (const log of logs) {
      await query(
        'INSERT INTO medication_logs (user_id, medication_id, scheduled_at) VALUES ($1, $2, $3)',
        [log.userId, log.medicationId, log.scheduledAt]
      );
    }
  }

  /**
   * Get a single medication by ID
   */
  async getMedication(userId: string, medicationId: string): Promise<Medication> {
    const medication = await queryOne<Medication>(
      `SELECT id, user_id as "userId", name, dosage, frequency, times, photo_url as "photoUrl",
              supply_days as "supplyDays", rx_number as "rxNumber", notes, is_active as "isActive", created_at as "createdAt"
       FROM medications
       WHERE id = $1`,
      [medicationId]
    );

    if (!medication) {
      throw new NotFoundError('Medication');
    }

    // Check access: user must be owner or caregiver
    if (medication.userId !== userId) {
      const isCaregiver = await this.checkCaregiverAccess(userId, medication.userId);
      if (!isCaregiver) {
        throw new ForbiddenError('You do not have access to this medication');
      }
    }

    return medication;
  }

  /**
   * Update medication
   */
  async updateMedication(userId: string, medicationId: string, updates: Partial<CreateMedicationInput>): Promise<Medication> {
    const medication = await this.getMedication(userId, medicationId);

    if (medication.userId !== userId) {
      throw new ForbiddenError('Only the owner can update medications');
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.dosage !== undefined) {
      fields.push(`dosage = $${paramIndex++}`);
      values.push(updates.dosage);
    }
    if (updates.frequency !== undefined) {
      fields.push(`frequency = $${paramIndex++}`);
      values.push(updates.frequency);
    }
    if (updates.times !== undefined) {
      fields.push(`times = $${paramIndex++}`);
      values.push(updates.times);
    }
    if (updates.photoUrl !== undefined) {
      fields.push(`photo_url = $${paramIndex++}`);
      values.push(updates.photoUrl);
    }
    if (updates.supplyDays !== undefined) {
      fields.push(`supply_days = $${paramIndex++}`);
      values.push(updates.supplyDays);
    }
    if (updates.rxNumber !== undefined) {
      fields.push(`rx_number = $${paramIndex++}`);
      values.push(updates.rxNumber);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }

    if (fields.length === 0) {
      return medication;
    }

    values.push(medicationId);

    const updated = await queryOne<Medication>(
      `UPDATE medications SET ${fields.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, user_id as "userId", name, dosage, frequency, times, photo_url as "photoUrl",
                 supply_days as "supplyDays", rx_number as "rxNumber", notes, is_active as "isActive", created_at as "createdAt"`,
      values
    );

    if (!updated) {
      throw new Error('Failed to update medication');
    }

    return updated;
  }

  /**
   * Soft delete medication
   */
  async deleteMedication(userId: string, medicationId: string): Promise<void> {
    const medication = await this.getMedication(userId, medicationId);

    if (medication.userId !== userId) {
      throw new ForbiddenError('Only the owner can delete medications');
    }

    await query('UPDATE medications SET is_active = FALSE WHERE id = $1', [medicationId]);
  }

  /**
   * Mark medication as taken (US-003)
   */
  async markMedicationTaken(
    userId: string,
    medicationId: string,
    scheduledAt: Date,
    notes?: string
  ): Promise<MedicationLog> {
    const medication = await this.getMedication(userId, medicationId);

    // Find or create log entry
    let log = await queryOne<MedicationLog>(
      `SELECT id, user_id as "userId", medication_id as "medicationId", scheduled_at as "scheduledAt",
              taken_at as "takenAt", status, notes
       FROM medication_logs
       WHERE user_id = $1 AND medication_id = $2 AND scheduled_at = $3`,
      [userId, medicationId, scheduledAt]
    );

    if (!log) {
      log = await queryOne<MedicationLog>(
        `INSERT INTO medication_logs (user_id, medication_id, scheduled_at, status, taken_at, notes)
         VALUES ($1, $2, $3, 'taken', NOW(), $4)
         RETURNING id, user_id as "userId", medication_id as "medicationId", scheduled_at as "scheduledAt",
                   taken_at as "takenAt", status, notes`,
        [userId, medicationId, scheduledAt, notes || null]
      );
    } else {
      log = await queryOne<MedicationLog>(
        `UPDATE medication_logs SET status = 'taken', taken_at = NOW(), notes = $4
         WHERE id = $5
         RETURNING id, user_id as "userId", medication_id as "medicationId", scheduled_at as "scheduledAt",
                   taken_at as "takenAt", status, notes`,
        [notes || null, log.id]
      );
    }

    if (!log) {
      throw new Error('Failed to mark medication as taken');
    }

    return log;
  }

  /**
   * Mark medication as skipped
   */
  async markMedicationSkipped(
    userId: string,
    medicationId: string,
    scheduledAt: Date,
    notes?: string
  ): Promise<MedicationLog> {
    // Find or create log entry
    let log = await queryOne<MedicationLog>(
      `SELECT id FROM medication_logs
       WHERE user_id = $1 AND medication_id = $2 AND scheduled_at = $3`,
      [userId, medicationId, scheduledAt]
    );

    if (!log) {
      log = await queryOne<MedicationLog>(
        `INSERT INTO medication_logs (user_id, medication_id, scheduled_at, status, notes)
         VALUES ($1, $2, $3, 'skipped', $4)
         RETURNING id, user_id as "userId", medication_id as "medicationId", scheduled_at as "scheduledAt",
                   taken_at as "takenAt", status, notes`,
        [userId, medicationId, scheduledAt, notes || null]
      );
    } else {
      log = await queryOne<MedicationLog>(
        `UPDATE medication_logs SET status = 'skipped', notes = $4
         WHERE id = $5
         RETURNING id, user_id as "userId", medication_id as "medicationId", scheduled_at as "scheduledAt",
                   taken_at as "takenAt", status, notes`,
        [notes || null, log.id]
      );
    }

    if (!log) {
      throw new Error('Failed to mark medication as skipped');
    }

    return log;
  }

  /**
   * Get medication log history
   */
  async getMedicationLogs(userId: string, medicationId: string, limit: number, offset: number): Promise<MedicationLog[]> {
    const medication = await this.getMedication(userId, medicationId);

    return query<MedicationLog>(
      `SELECT id, user_id as "userId", medication_id as "medicationId", scheduled_at as "scheduledAt",
              taken_at as "takenAt", status, notes
       FROM medication_logs
       WHERE medication_id = $1
       ORDER BY scheduled_at DESC
       LIMIT $2 OFFSET $3`,
      [medicationId, limit, offset]
    );
  }

  /**
   * Check if user is a caregiver for patient
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

  /**
   * Get medications with low supply (US-005)
   */
  async getLowSupplyMedications(userId: string): Promise<Medication[]> {
    return query<Medication>(
      `SELECT id, user_id as "userId", name, dosage, frequency, times, photo_url as "photoUrl",
              supply_days as "supplyDays", rx_number as "rxNumber", notes, is_active as "isActive", created_at as "createdAt"
       FROM medications
       WHERE user_id = $1 AND supply_days IS NOT NULL AND supply_days < 7 AND is_active = TRUE
       ORDER BY supply_days ASC`,
      [userId]
    );
  }

  /**
   * Get medication adherence rate
   */
  async getAdherenceRate(userId: string, days: number = 30): Promise<{ rate: number; taken: number; total: number }> {
    const result = await queryOne<{ taken: bigint; total: bigint }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'taken')::bigint as taken,
         COUNT(*)::bigint as total
       FROM medication_logs
       WHERE user_id = $1
         AND scheduled_at >= NOW() - INTERVAL '1 day' * $2`,
      [userId, days]
    );

    const taken = Number(result?.taken || 0);
    const total = Number(result?.total || 0);
    const rate = total > 0 ? (taken / total) * 100 : 0;

    return { rate, taken, total };
  }
}
