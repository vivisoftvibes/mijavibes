/**
 * Telemedicine Service
 *
 * Handles healthcare provider management and consultation suggestions
 * US-040: Suggest consultation based on trends
 * US-041: Show available options
 * US-042: Update treatment plan
 */

import { query, queryOne } from '../database/connection';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

export interface HealthcareProvider {
  id: string;
  name: string;
  specialty?: string;
  clinicName?: string;
  phone?: string;
  email?: string;
  consultationTypes: Array<'in_person' | 'online'>;
  availability?: Record<string, unknown>;
}

export interface UserProvider {
  providerId: string;
  name: string;
  specialty?: string;
  clinicName?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
}

export interface ConsultationSuggestion {
  type: 'consultation_recommended' | 'medication_review' | 'follow_up_needed';
  priority: 'low' | 'medium' | 'high';
  reason: string;
  suggestedSpecialty?: string;
  recommendedWithin?: string; // e.g., '1 week', '3 days'
}

export class TelemedicineService {
  /**
   * Get healthcare providers (US-041)
   */
  async getProviders(
    specialty?: string,
    consultationType?: 'in_person' | 'online'
  ): Promise<HealthcareProvider[]> {
    let queryText = `
      SELECT id, name, specialty, clinic_name as "clinicName", phone, email,
             consultation_type as "consultationTypes", availability
      FROM healthcare_providers
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (specialty) {
      queryText += ' AND specialty = $' + (params.length + 1);
      params.push(specialty);
    }

    if (consultationType) {
      queryText += ' AND $' + (params.length + 1) + ' = ANY(consultation_type)';
      params.push(consultationType);
    }

    queryText += ' ORDER BY name';

    const providers = await query<
      {
        id: string;
        name: string;
        specialty?: string;
        clinicName?: string;
        phone?: string;
        email?: string;
        consultationTypes: string[];
        availability?: Record<string, unknown>;
      }
    >(queryText, params);

    return providers.map((p) => ({
      ...p,
      consultationTypes: p.consultationTypes as Array<'in_person' | 'online'>,
    }));
  }

  /**
   * Get provider by ID
   */
  async getProvider(providerId: string): Promise<HealthcareProvider> {
    const provider = await queryOne<{
      id: string;
      name: string;
      specialty?: string;
      clinicName?: string;
      phone?: string;
      email?: string;
      consultationTypes: string[];
      availability?: Record<string, unknown>;
    }>(
      `SELECT id, name, specialty, clinic_name as "clinicName", phone, email,
              consultation_type as "consultationTypes", availability
       FROM healthcare_providers
       WHERE id = $1`,
      [providerId]
    );

    if (!provider) {
      throw new NotFoundError('Healthcare provider');
    }

    return {
      ...provider,
      consultationTypes: provider.consultationTypes as Array<'in_person' | 'online'>,
    };
  }

  /**
   * Get user's linked healthcare providers
   */
  async getUserProviders(userId: string): Promise<UserProvider[]> {
    return query<UserProvider>(
      `SELECT hp.id as "providerId", hp.name, hp.specialty, hp.clinic_name as "clinicName",
              hp.phone, hp.email, up.is_primary as "isPrimary"
       FROM user_providers up
       JOIN healthcare_providers hp ON up.provider_id = hp.id
       WHERE up.user_id = $1
       ORDER BY up.is_primary DESC, hp.name`,
      [userId]
    );
  }

  /**
   * Link a healthcare provider to user
   */
  async linkProvider(userId: string, providerId: string, isPrimary = false): Promise<{ id: string }> {
    // Verify provider exists
    const provider = await queryOne<{ id: string }>(
      'SELECT id FROM healthcare_providers WHERE id = $1',
      [providerId]
    );

    if (!provider) {
      throw new NotFoundError('Healthcare provider');
    }

    // Check if already linked
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM user_providers WHERE user_id = $1 AND provider_id = $2',
      [userId, providerId]
    );

    if (existing) {
      throw new ValidationError('Provider already linked to user');
    }

    // If setting as primary, remove primary from other relationships
    if (isPrimary) {
      await query(
        'UPDATE user_providers SET is_primary = FALSE WHERE user_id = $1',
        [userId]
      );
    }

    const relationship = await queryOne<{ id: string }>(
      `INSERT INTO user_providers (user_id, provider_id, is_primary)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userId, providerId, isPrimary]
    );

    if (!relationship) {
      throw new Error('Failed to link provider');
    }

    return relationship;
  }

  /**
   * Get consultation recommendations based on health data (US-040)
   */
  async getRecommendations(userId: string): Promise<{
    shouldConsult: boolean;
    recommendations: ConsultationSuggestion[];
  }> {
    const recommendations: ConsultationSuggestion[] = [];
    let shouldConsult = false;

    // Check blood pressure trends
    const bpTrend = await queryOne<{
      avgSystolic: string;
      avgDiastolic: string;
      highestSystolic: number;
    }>(
      `SELECT
         AVG(systolic)::varchar as "avgSystolic",
         AVG(diastolic)::varchar as "avgDiastolic",
         MAX(systolic) as "highestSystolic"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure'
         AND measured_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    if (bpTrend) {
      const avgSystolic = parseFloat(bpTrend.avgSystolic);
      const avgDiastolic = parseFloat(bpTrend.avgDiastolic);

      if (avgSystolic > 140 || avgDiastolic > 90) {
        shouldConsult = true;
        recommendations.push({
          type: 'consultation_recommended',
          priority: avgSystolic > 160 || avgDiastolic > 100 ? 'high' : 'medium',
          reason: `Blood pressure has been elevated (average: ${avgSystolic}/${avgDiastolic} mmHg) over the past 30 days`,
          suggestedSpecialty: 'Cardiologist',
          recommendedWithin: '1 week',
        });
      }
    }

    // Check glucose trends
    const glucoseTrend = await queryOne<{
      avg: string;
      highestValue: number;
    }>(
      `SELECT
         AVG(CAST(value AS NUMERIC))::varchar as avg,
         MAX(CAST(value AS NUMERIC)) as "highestValue"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose'
         AND measured_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    if (glucoseTrend) {
      const avgGlucose = parseFloat(glucoseTrend.avg);

      if (avgGlucose > 150) {
        shouldConsult = true;
        recommendations.push({
          type: 'consultation_recommended',
          priority: avgGlucose > 200 ? 'high' : 'medium',
          reason: `Blood glucose has been elevated (average: ${avgGlucose.toFixed(0)} mg/dL) over the past 30 days`,
          suggestedSpecialty: 'Endocrinologist',
          recommendedWithin: '1 week',
        });
      }
    }

    // Check medication adherence
    const adherence = await queryOne<{
      taken: bigint;
      total: bigint;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'taken')::bigint as taken,
         COUNT(*)::bigint as total
       FROM medication_logs
       WHERE user_id = $1 AND scheduled_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    if (adherence && Number(adherence.total) > 0) {
      const adherenceRate = (Number(adherence.taken) / Number(adherence.total)) * 100;

      if (adherenceRate < 70) {
        shouldConsult = true;
        recommendations.push({
          type: 'medication_review',
          priority: 'medium',
          reason: `Medication adherence is below 70% (${adherenceRate.toFixed(0)}%). Consider reviewing medication regimen.`,
          recommendedWithin: '2 weeks',
        });
      }
    }

    return { shouldConsult, recommendations };
  }

  /**
   * Get consultation suggestions based on health trends (US-040)
   */
  async getConsultationSuggestions(userId: string): Promise<{
    showBanner: boolean;
    message?: string;
    actionUrl?: string;
    providers?: HealthcareProvider[];
  }> {
    const { shouldConsult, recommendations } = await this.getRecommendations(userId);

    if (!shouldConsult || recommendations.length === 0) {
      return { showBanner: false };
    }

    const highPriority = recommendations.find((r) => r.priority === 'high');

    if (highPriority) {
      // Get relevant providers
      const providers = await this.getProviders(highPriority.suggestedSpecialty);

      return {
        showBanner: true,
        message: highPriority.reason,
        actionUrl: '/telemedicine',
        providers,
      };
    }

    const mediumPriority = recommendations.find((r) => r.priority === 'medium');

    if (mediumPriority) {
      return {
        showBanner: true,
        message: mediumPriority.reason,
        actionUrl: '/telemedicine',
      };
    }

    return { showBanner: false };
  }
}
