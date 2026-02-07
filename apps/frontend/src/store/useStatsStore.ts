/**
 * Stats Store
 *
 * Zustand store for health statistics
 */

import { create } from 'zustand';
import {
  HealthOverview,
  MedicationAdherence,
  VitalsSummary,
  HealthTrendData,
} from '../types';
import { statsService } from '../services/api';

interface StatsState {
  overview: HealthOverview | null;
  medicationAdherence: MedicationAdherence | null;
  vitalsSummary: {
    bloodPressure: VitalsSummary['bloodPressure'] | null;
    glucose: VitalsSummary['glucose'] | null;
  } | null;
  healthTrends: {
    data: HealthTrendData[];
  } | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadOverview: (startDate?: Date, endDate?: Date) => Promise<void>;
  loadMedicationAdherence: (period?: '7d' | '30d' | '90d') => Promise<void>;
  loadVitalsSummary: (period?: '7d' | '30d' | '90d') => Promise<void>;
  loadHealthTrends: (type: 'blood_pressure' | 'glucose', period?: '7d' | '30d' | '90d') => Promise<void>;
  clearError: () => void;
}

export const useStatsStore = create<StatsState>((set) => ({
  overview: null,
  medicationAdherence: null,
  vitalsSummary: null,
  healthTrends: null,
  isLoading: false,
  error: null,

  loadOverview: async (startDate?: Date, endDate?: Date) => {
    set({ isLoading: true, error: null });

    try {
      const response = await statsService.getOverview(startDate, endDate);
      set({ overview: response, isLoading: false });
    } catch (error: any) {
      set({
        error: error.error || 'Failed to load overview',
        isLoading: false,
      });
    }
  },

  loadMedicationAdherence: async (period = '30d') => {
    try {
      const response = await statsService.getMedicationAdherence(period);
      set({ medicationAdherence: response });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load adherence data' });
    }
  },

  loadVitalsSummary: async (period = '30d') => {
    try {
      const response = await statsService.getVitalsSummary(period);
      set({ vitalsSummary: response });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load vitals summary' });
    }
  },

  loadHealthTrends: async (type, period = '30d') => {
    try {
      const response = await statsService.getHealthTrends(type, period);
      set({ healthTrends: response });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load trends' });
    }
  },

  clearError: () => set({ error: null }),
}));
