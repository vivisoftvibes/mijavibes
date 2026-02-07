/**
 * Statistics Service
 *
 * Provides health statistics and analytics
 * US-014: Health statistics dashboard
 */

import { query, queryOne } from '../database/connection';

export interface HealthOverview {
  medications: {
    total: number;
    takenToday: number;
    remainingToday: number;
    adherenceRate: number;
  };
  vitals: {
    bloodPressure: {
      latest: { systolic: number; diastolic: number; date: Date } | null;
      average: { systolic: number; diastolic: number };
      isAbnormal: boolean;
    };
    glucose: {
      latest: { value: number; date: Date } | null;
      average: number;
      isAbnormal: boolean;
    };
  };
  alerts: {
    activeCount: number;
    lastWeekCount: number;
  };
}

export interface MedicationAdherence {
  rate: number;
  total: number;
  taken: number;
  missed: number;
  skipped: number;
  dailyBreakdown: Array<{
    date: string;
    taken: number;
    total: number;
    rate: number;
  }>;
}

export interface VitalsSummary {
  bloodPressure: {
    readings: number;
    averageSystolic: number;
    averageDiastolic: number;
    highest: { systolic: number; diastolic: number; date: Date };
    lowest: { systolic: number; diastolic: number; date: Date };
    abnormalCount: number;
  };
  glucose: {
    readings: number;
    average: number;
    highest: { value: number; date: Date };
    lowest: { value: number; date: Date };
    abnormalCount: number;
  };
}

export interface HealthTrend {
  date: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

export class StatsService {
  /**
   * Get health overview dashboard
   */
  async getOverview(userId: string, startDate?: Date, endDate?: Date): Promise<HealthOverview> {
    const today = new Date().toISOString().split('T')[0];

    // Medication stats
    const medStats = await queryOne<{
      total: bigint;
      takenToday: bigint;
    }>(
      `SELECT
         COUNT(DISTINCT m.id)::bigint as total,
         COUNT(DISTINCT ml.id) FILTER (WHERE ml.status = 'taken' AND DATE(ml.scheduled_at) = $2)::bigint as "takenToday"
       FROM medications m
       LEFT JOIN medication_logs ml ON ml.medication_id = m.id AND DATE(ml.scheduled_at) = $2
       WHERE m.user_id = $1 AND m.is_active = TRUE`,
      [userId, today]
    );

    const adherence = await this.getMedicationAdherence(userId, '30d');

    // Blood pressure stats
    const latestBP = await queryOne<{
      systolic: number;
      diastolic: number;
      measuredAt: Date;
    }>(
      `SELECT systolic, diastolic, measured_at as "measuredAt"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure'
       ORDER BY measured_at DESC
       LIMIT 1`,
      [userId]
    );

    const avgBP = await queryOne<{ avgSystolic: string; avgDiastolic: string }>(
      `SELECT
         AVG(systolic)::varchar as "avgSystolic",
         AVG(diastolic)::varchar as "avgDiastolic"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure'
         AND measured_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    // Glucose stats
    const latestGlucose = await queryOne<{ value: string; measuredAt: Date }>(
      `SELECT value, measured_at as "measuredAt"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose'
       ORDER BY measured_at DESC
       LIMIT 1`,
      [userId]
    );

    const avgGlucose = await queryOne<{ avg: string }>(
      `SELECT AVG(CAST(value AS NUMERIC))::varchar as avg
       FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose'
         AND measured_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    // Alert stats
    const alertStats = await queryOne<{ activeCount: bigint; lastWeekCount: bigint }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')::bigint as "activeCount",
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint as "lastWeekCount"
       FROM emergency_alerts
       WHERE user_id = $1`,
      [userId]
    );

    return {
      medications: {
        total: Number(medStats?.total || 0),
        takenToday: Number(medStats?.takenToday || 0),
        remainingToday: Number(medStats?.total || 0) - Number(medStats?.takenToday || 0),
        adherenceRate: adherence.rate,
      },
      vitals: {
        bloodPressure: {
          latest: latestBP
            ? { systolic: latestBP.systolic, diastolic: latestBP.diastolic, date: latestBP.measuredAt }
            : null,
          average: {
            systolic: parseFloat(avgBP?.avgSystolic || '0'),
            diastolic: parseFloat(avgBP?.avgDiastolic || '0'),
          },
          isAbnormal: latestBP
            ? latestBP.systolic > 140 || latestBP.diastolic > 90
            : false,
        },
        glucose: {
          latest: latestGlucose
            ? { value: parseInt(latestGlucose.value), date: latestGlucose.measuredAt }
            : null,
          average: parseFloat(avgGlucose?.avg || '0'),
          isAbnormal: latestGlucose
            ? parseInt(latestGlucose.value) > 130
            : false,
        },
      },
      alerts: {
        activeCount: Number(alertStats?.activeCount || 0),
        lastWeekCount: Number(alertStats?.lastWeekCount || 0),
      },
    };
  }

  /**
   * Get medication adherence statistics
   */
  async getMedicationAdherence(userId: string, period: '7d' | '30d' | '90d'): Promise<MedicationAdherence> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await queryOne<{
      taken: bigint;
      missed: bigint;
      skipped: bigint;
      total: bigint;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'taken')::bigint as taken,
         COUNT(*) FILTER (WHERE status = 'skipped')::bigint as skipped,
         COUNT(*) FILTER (WHERE status = 'pending' AND scheduled_at < NOW())::bigint as missed,
         COUNT(*)::bigint as total
       FROM medication_logs
       WHERE user_id = $1 AND scheduled_at >= $2`,
      [userId, startDate]
    );

    const taken = Number(stats?.taken || 0);
    const skipped = Number(stats?.skipped || 0);
    const missed = Number(stats?.missed || 0);
    const total = taken + skipped + missed;
    const rate = total > 0 ? (taken / total) * 100 : 0;

    // Daily breakdown
    const dailyBreakdown = await query<
      { date: string; taken: bigint; total: bigint }
    >(
      `SELECT
         DATE(scheduled_at) as date,
         COUNT(*) FILTER (WHERE status = 'taken')::bigint as taken,
         COUNT(*)::bigint as total
       FROM medication_logs
       WHERE user_id = $1 AND scheduled_at >= $2
       GROUP BY DATE(scheduled_at)
       ORDER BY date ASC`,
      [userId, startDate]
    );

    return {
      rate,
      taken,
      missed,
      skipped,
      total,
      dailyBreakdown: dailyBreakdown.map((d) => ({
        date: d.date,
        taken: Number(d.taken),
        total: Number(d.total),
        rate: Number(d.total) > 0 ? (Number(d.taken) / Number(d.total)) * 100 : 0,
      })),
    };
  }

  /**
   * Get vital signs summary
   */
  async getVitalsSummary(userId: string, period: '7d' | '30d' | '90d'): Promise<VitalsSummary> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Blood pressure summary
    const bpSummary = await queryOne<{
      readings: bigint;
      avgSystolic: string;
      avgDiastolic: string;
      highestSystolic: number;
      highestDiastolic: number;
      highestDate: Date;
      lowestSystolic: number;
      lowestDiastolic: number;
      lowestDate: Date;
      abnormalCount: bigint;
    }>(
      `SELECT
         COUNT(*)::bigint as readings,
         AVG(systolic)::varchar as "avgSystolic",
         AVG(diastolic)::varchar as "avgDiastolic",
         MAX(systolic) as "highestSystolic",
         MAX(diastolic) as "highestDiastolic",
         (MAX(measured_at) FILTER (WHERE systolic = MAX(systolic) OVER ())) as "highestDate",
         MIN(systolic) as "lowestSystolic",
         MIN(diastolic) as "lowestDiastolic",
         (MIN(measured_at) FILTER (WHERE systolic = MIN(systolic) OVER ())) as "lowestDate",
         COUNT(*) FILTER (WHERE systolic > 140 OR diastolic > 90)::bigint as "abnormalCount"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'blood_pressure' AND measured_at >= $2`,
      [userId, startDate]
    );

    // Glucose summary
    const glucoseSummary = await queryOne<{
      readings: bigint;
      avg: string;
      highestValue: number;
      highestDate: Date;
      lowestValue: number;
      lowestDate: Date;
      abnormalCount: bigint;
    }>(
      `SELECT
         COUNT(*)::bigint as readings,
         AVG(CAST(value AS NUMERIC))::varchar as avg,
         MAX(CAST(value AS NUMERIC)) as "highestValue",
         MAX(measured_at) FILTER (WHERE CAST(value AS NUMERIC) = MAX(CAST(value AS NUMERIC)) OVER ()) as "highestDate",
         MIN(CAST(value AS NUMERIC)) as "lowestValue",
         MIN(measured_at) FILTER (WHERE CAST(value AS NUMERIC) = MIN(CAST(value AS NUMERIC)) OVER ()) as "lowestDate",
         COUNT(*) FILTER (WHERE CAST(value AS NUMERIC) > 130)::bigint as "abnormalCount"
       FROM vital_signs
       WHERE user_id = $1 AND type = 'glucose' AND measured_at >= $2`,
      [userId, startDate]
    );

    return {
      bloodPressure: {
        readings: Number(bpSummary?.readings || 0),
        averageSystolic: parseFloat(bpSummary?.avgSystolic || '0'),
        averageDiastolic: parseFloat(bpSummary?.avgDiastolic || '0'),
        highest: {
          systolic: bpSummary?.highestSystolic || 0,
          diastolic: bpSummary?.highestDiastolic || 0,
          date: bpSummary?.highestDate || new Date(),
        },
        lowest: {
          systolic: bpSummary?.lowestSystolic || 0,
          diastolic: bpSummary?.lowestDiastolic || 0,
          date: bpSummary?.lowestDate || new Date(),
        },
        abnormalCount: Number(bpSummary?.abnormalCount || 0),
      },
      glucose: {
        readings: Number(glucoseSummary?.readings || 0),
        average: parseFloat(glucoseSummary?.avg || '0'),
        highest: {
          value: glucoseSummary?.highestValue || 0,
          date: glucoseSummary?.highestDate || new Date(),
        },
        lowest: {
          value: glucoseSummary?.lowestValue || 0,
          date: glucoseSummary?.lowestDate || new Date(),
        },
        abnormalCount: Number(glucoseSummary?.abnormalCount || 0),
      },
    };
  }

  /**
   * Get health trends for charts
   */
  async getHealthTrends(
    userId: string,
    type: 'blood_pressure' | 'glucose',
    period: '7d' | '30d' | '90d'
  ): Promise<{ data: HealthTrend[] }> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await query<HealthTrend>(
      `SELECT
         DATE(measured_at) as date,
         CASE
           WHEN type = 'glucose' THEN AVG(CAST(value AS NUMERIC))
           ELSE NULL
         END as value,
         CASE
           WHEN type = 'blood_pressure' THEN AVG(systolic)
           ELSE NULL
         END as systolic,
         CASE
           WHEN type = 'blood_pressure' THEN AVG(diastolic)
           ELSE NULL
         END as diastolic
       FROM vital_signs
       WHERE user_id = $1 AND type = $2 AND measured_at >= $3
       GROUP BY DATE(measured_at)
       ORDER BY date ASC`,
      [userId, type, startDate]
    );

    return { data };
  }

  /**
   * Get alerts history
   */
  async getAlertsHistory(userId: string, period: '7d' | '30d' | '90d'): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    recent: Array<{ id: string; type: string; status: string; createdAt: Date }>;
  }> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const byType = await query<{ type: string; count: bigint }>(
      `SELECT type, COUNT(*)::bigint as count
       FROM emergency_alerts
       WHERE user_id = $1 AND created_at >= $2
       GROUP BY type`,
      [userId, startDate]
    );

    const byStatus = await query<{ status: string; count: bigint }>(
      `SELECT status, COUNT(*)::bigint as count
       FROM emergency_alerts
       WHERE user_id = $1 AND created_at >= $2
       GROUP BY status`,
      [userId, startDate]
    );

    const recent = await query<{ id: string; type: string; status: string; createdAt: Date }>(
      `SELECT id, type, status, created_at as "createdAt"
       FROM emergency_alerts
       WHERE user_id = $1 AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId, startDate]
    );

    return {
      total: byType.reduce((sum, t) => sum + Number(t.count), 0),
      byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: Number(t.count) }), {}),
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: Number(s.count) }), {}),
      recent,
    };
  }
}
