/**
 * Medication Store
 *
 * Zustand store for managing medication state
 */

import { create } from 'zustand';
import { Medication, TodayMedication, MedicationLog } from '../types';
import { medicationService } from '../services/api';

interface MedicationState {
  medications: Medication[];
  todaySchedule: TodayMedication[];
  logs: MedicationLog[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Actions
  loadMedications: () => Promise<void>;
  loadTodaySchedule: (date?: Date) => Promise<void>;
  loadLogs: (medicationId: string) => Promise<void>;
  createMedication: (data: {
    name: string;
    dosage: string;
    frequency: string;
    times: string[];
    photoUrl?: string;
    supplyDays?: number;
    rxNumber?: string;
    notes?: string;
  }) => Promise<Medication>;
  updateMedication: (medicationId: string, data: Partial<Medication>) => Promise<void>;
  deleteMedication: (medicationId: string) => Promise<void>;
  markAsTaken: (medicationId: string, scheduledAt: string, notes?: string) => Promise<void>;
  markAsSkipped: (medicationId: string, scheduledAt: string, notes?: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  todaySchedule: [],
  logs: [],
  isLoading: false,
  isRefreshing: false,
  error: null,

  loadMedications: async () => {
    set({ isLoading: true, error: null });

    try {
      const medications = await medicationService.getMedications();
      set({ medications, isLoading: false });
    } catch (error: any) {
      set({
        error: error.error || 'Failed to load medications',
        isLoading: false,
      });
    }
  },

  loadTodaySchedule: async (date?: Date) => {
    set({ isLoading: true, error: null });

    try {
      const schedule = await medicationService.getTodaysSchedule(date);
      set({ todaySchedule: schedule, isLoading: false });
    } catch (error: any) {
      set({
        error: error.error || 'Failed to load today\'s schedule',
        isLoading: false,
      });
    }
  },

  loadLogs: async (medicationId: string) => {
    try {
      const logs = await medicationService.getLogs(medicationId);
      set({ logs });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load logs' });
    }
  },

  createMedication: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const medication = await medicationService.createMedication(data);
      set((state) => ({
        medications: [...state.medications, medication],
        isLoading: false,
      }));
      return medication;
    } catch (error: any) {
      set({
        error: error.error || 'Failed to create medication',
        isLoading: false,
      });
      throw error;
    }
  },

  updateMedication: async (medicationId, data) => {
    set({ isLoading: true, error: null });

    try {
      const updated = await medicationService.updateMedication(medicationId, data);
      set((state) => ({
        medications: state.medications.map((m) =>
          m.id === medicationId ? { ...m, ...updated } : m
        ),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.error || 'Failed to update medication',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteMedication: async (medicationId) => {
    set({ isLoading: true, error: null });

    try {
      await medicationService.deleteMedication(medicationId);
      set((state) => ({
        medications: state.medications.filter((m) => m.id !== medicationId),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.error || 'Failed to delete medication',
        isLoading: false,
      });
      throw error;
    }
  },

  markAsTaken: async (medicationId, scheduledAt, notes) => {
    try {
      await medicationService.markAsTaken(medicationId, scheduledAt, notes);

      // Update today's schedule
      set((state) => ({
        todaySchedule: state.todaySchedule.map((item) =>
          item.medicationId === medicationId && item.scheduledTime === scheduledAt
            ? { ...item, status: 'taken', takenAt: new Date().toISOString() }
            : item
        ),
      }));
    } catch (error: any) {
      set({ error: error.error || 'Failed to mark as taken' });
      throw error;
    }
  },

  markAsSkipped: async (medicationId, scheduledAt, notes) => {
    try {
      await medicationService.markAsSkipped(medicationId, scheduledAt, notes);

      // Update today's schedule
      set((state) => ({
        todaySchedule: state.todaySchedule.map((item) =>
          item.medicationId === medicationId && item.scheduledTime === scheduledAt
            ? { ...item, status: 'skipped' }
            : item
        ),
      }));
    } catch (error: any) {
      set({ error: error.error || 'Failed to mark as skipped' });
      throw error;
    }
  },

  refresh: async () => {
    set({ isRefreshing: true });
    await get().loadMedications();
    await get().loadTodaySchedule();
    set({ isRefreshing: false });
  },

  clearError: () => set({ error: null }),
}));
