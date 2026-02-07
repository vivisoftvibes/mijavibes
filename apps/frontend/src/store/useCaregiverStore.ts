/**
 * Caregiver Store
 *
 * Zustand store for managing caregiver state - SPEC-005
 * Handles patient cards, patient details, notifications, and caregiver actions
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PatientCard,
  PatientStatus,
  PatientDetail,
  CaregiverNotification,
  CaregiverAction,
  CaregiverRelationship,
  CaregiverInvite,
} from '../types';
import { caregiverService } from '../services/api';

interface CaregiverState {
  // Patient data
  patients: PatientCard[];
  selectedPatientId: string | null;
  patientStatuses: Record<string, PatientStatus>;
  patientDetails: Record<string, PatientDetail>;

  // Notifications
  notifications: CaregiverNotification[];
  unreadCount: number;

  // Activity log
  activityLog: CaregiverAction[];

  // Loading states
  isLoadingPatients: boolean;
  isLoadingStatus: boolean;
  isLoadingDetail: boolean;
  isLoadingNotifications: boolean;

  // Error states
  error: string | null;

  // Actions - Patient Management
  loadPatients: () => Promise<void>;
  loadPatientStatus: (patientId: string) => Promise<PatientStatus>;
  loadPatientDetail: (patientId: string) => Promise<PatientDetail>;
  selectPatient: (patientId: string | null) => void;
  refreshPatientData: (patientId: string) => Promise<void>;

  // Actions - Notifications
  loadNotifications: () => Promise<void>;
  acknowledgeNotification: (notificationId: string) => Promise<void>;
  markAllAsRead: () => void;

  // Actions - Caregiver Actions
  logAction: (
    patientId: string,
    type: CaregiverAction['type'],
    data?: { alertId?: string; notificationId?: string; notes?: string }
  ) => Promise<void>;
  loadActivityLog: (patientId: string, limit?: number) => Promise<void>;

  // Actions - Relationship Management
  inviteCaregiver: (data: {
    email: string;
    role: 'primary' | 'secondary' | 'professional';
    notificationPreferences?: Record<string, boolean>;
    professionalSchedule?: Record<string, { start: string; end: string }>;
  }) => Promise<CaregiverInvite>;
  updatePreferences: (
    relationshipId: string,
    preferences: Partial<{
      medicationMissed: boolean;
      vitalAbnormal: boolean;
      emergencyAlerts: boolean;
      quietHours: { enabled: boolean; start: string; end: string };
    }>
  ) => Promise<void>;
  updateSchedule: (
    relationshipId: string,
    schedule: Record<string, { start: string; end: string }>
  ) => Promise<void>;
  pauseNotifications: (relationshipId: string) => Promise<void>;
  resumeNotifications: (relationshipId: string) => Promise<void>;
  removeRelationship: (relationshipId: string) => Promise<void>;

  // Actions - Quick Actions
  callPatient: (patientId: string, phone: string) => void;
  messagePatient: (patientId: string) => void;
  startVideoCall: (patientId: string) => void;

  // Utilities
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  patients: [],
  selectedPatientId: null,
  patientStatuses: {},
  patientDetails: {},
  notifications: [],
  unreadCount: 0,
  activityLog: [],
  isLoadingPatients: false,
  isLoadingStatus: false,
  isLoadingDetail: false,
  isLoadingNotifications: false,
  error: null,
};

export const useCaregiverStore = create<CaregiverState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Load all patients for the caregiver
      loadPatients: async () => {
        set({ isLoadingPatients: true, error: null });

        try {
          const patients = await caregiverService.getPatients();

          // Load status for each patient
          const statusPromises = patients.map(async (patient) => {
            try {
              const status = await caregiverService.getPatientStatus(patient.id);
              return { patientId: patient.id, status };
            } catch {
              return { patientId: patient.id, status: null };
            }
          });

          const statuses = await Promise.all(statusPromises);
          const statusMap: Record<string, PatientStatus> = {};
          statuses.forEach(({ patientId, status }) => {
            if (status) statusMap[patientId] = status;
          });

          set({
            patients,
            patientStatuses: statusMap,
            isLoadingPatients: false,
          });
        } catch (error: any) {
          set({
            error: error.error || 'Failed to load patients',
            isLoadingPatients: false,
          });
          throw error;
        }
      },

      // Load status for a specific patient
      loadPatientStatus: async (patientId: string) => {
        set({ isLoadingStatus: true, error: null });

        try {
          const status = await caregiverService.getPatientStatus(patientId);

          set((state) => ({
            patientStatuses: {
              ...state.patientStatuses,
              [patientId]: status,
            },
            isLoadingStatus: false,
          }));

          return status;
        } catch (error: any) {
          set({
            error: error.error || 'Failed to load patient status',
            isLoadingStatus: false,
          });
          throw error;
        }
      },

      // Load detailed patient information
      loadPatientDetail: async (patientId: string) => {
        set({ isLoadingDetail: true, error: null });

        try {
          const detail = await caregiverService.getPatientDetail(patientId);

          set((state) => ({
            patientDetails: {
              ...state.patientDetails,
              [patientId]: detail,
            },
            isLoadingDetail: false,
          }));

          return detail;
        } catch (error: any) {
          set({
            error: error.error || 'Failed to load patient details',
            isLoadingDetail: false,
          });
          throw error;
        }
      },

      // Select a patient
      selectPatient: (patientId: string | null) => {
        set({ selectedPatientId: patientId });
      },

      // Refresh all data for a patient
      refreshPatientData: async (patientId: string) => {
        await Promise.all([
          get().loadPatientStatus(patientId),
          get().loadPatientDetail(patientId),
        ]);
      },

      // Load notifications
      loadNotifications: async () => {
        set({ isLoadingNotifications: true, error: null });

        try {
          const notifications = await caregiverService.getNotifications();

          const unreadCount = notifications.filter(
            (n) => n.status === 'pending' || n.status === 'sent'
          ).length;

          set({
            notifications,
            unreadCount,
            isLoadingNotifications: false,
          });
        } catch (error: any) {
          set({
            error: error.error || 'Failed to load notifications',
            isLoadingNotifications: false,
          });
        }
      },

      // Acknowledge a notification
      acknowledgeNotification: async (notificationId: string) => {
        try {
          await caregiverService.acknowledgeNotification(notificationId);

          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === notificationId
                ? { ...n, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() }
                : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          }));
        } catch (error: any) {
          set({ error: error.error || 'Failed to acknowledge notification' });
          throw error;
        }
      },

      // Mark all notifications as read (local state only)
      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.status === 'pending' || n.status === 'sent'
              ? { ...n, status: 'delivered' as const }
              : n
          ),
          unreadCount: 0,
        }));
      },

      // Log a caregiver action
      logAction: async (
        patientId: string,
        type: CaregiverAction['type'],
        data?: { alertId?: string; notificationId?: string; notes?: string }
      ) => {
        try {
          await caregiverService.logAction(patientId, type, data || {});

          // Reload activity log
          await get().loadActivityLog(patientId);
        } catch (error: any) {
          set({ error: error.error || 'Failed to log action' });
          throw error;
        }
      },

      // Load activity log for a patient
      loadActivityLog: async (patientId: string, limit = 50) => {
        try {
          const activity = await caregiverService.getActivity(patientId, limit);

          set({ activityLog: activity });
        } catch (error: any) {
          set({ error: error.error || 'Failed to load activity log' });
        }
      },

      // Invite a caregiver
      inviteCaregiver: async (data) => {
        try {
          const invite = await caregiverService.inviteCaregiver(data);
          return invite;
        } catch (error: any) {
          set({ error: error.error || 'Failed to send invite' });
          throw error;
        }
      },

      // Update notification preferences
      updatePreferences: async (relationshipId, preferences) => {
        try {
          await caregiverService.updatePreferences(relationshipId, preferences);
        } catch (error: any) {
          set({ error: error.error || 'Failed to update preferences' });
          throw error;
        }
      },

      // Update professional schedule
      updateSchedule: async (relationshipId, schedule) => {
        try {
          await caregiverService.updateSchedule(relationshipId, schedule);
        } catch (error: any) {
          set({ error: error.error || 'Failed to update schedule' });
          throw error;
        }
      },

      // Pause notifications
      pauseNotifications: async (relationshipId) => {
        try {
          await caregiverService.pauseNotifications(relationshipId);
        } catch (error: any) {
          set({ error: error.error || 'Failed to pause notifications' });
          throw error;
        }
      },

      // Resume notifications
      resumeNotifications: async (relationshipId) => {
        try {
          await caregiverService.resumeNotifications(relationshipId);
        } catch (error: any) {
          set({ error: error.error || 'Failed to resume notifications' });
          throw error;
        }
      },

      // Remove relationship
      removeRelationship: async (relationshipId) => {
        try {
          await caregiverService.removeRelationship(relationshipId);

          // Reload patients list
          await get().loadPatients();
        } catch (error: any) {
          set({ error: error.error || 'Failed to remove relationship' });
          throw error;
        }
      },

      // Quick action: Call patient
      callPatient: (patientId: string, phone: string) => {
        // Use React Native's Linking API to open phone
        // In a real implementation: Linking.openURL(`tel:${phone}`)
        console.log(`Calling patient ${patientId} at ${phone}`);
      },

      // Quick action: Message patient
      messagePatient: (patientId: string) => {
        // Navigate to messaging screen or open SMS
        console.log(`Messaging patient ${patientId}`);
      },

      // Quick action: Start video call
      startVideoCall: (patientId: string) => {
        // Navigate to video call screen
        console.log(`Starting video call with patient ${patientId}`);
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Reset store
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'salud-aldia-caregiver',
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
      // Only persist certain fields
      partialize: (state) => ({
        selectedPatientId: state.selectedPatientId,
        // Don't persist patient data, notifications, or activity logs
        // as they should be refreshed on app load
      }),
    }
  )
);

// Selectors for computed values
export const usePatientCards = () =>
  useCaregiverStore((state) => {
    const { patients, patientStatuses } = state;

    return patients.map((patient) => {
      const status = patientStatuses[patient.id];

      return {
        ...patient,
        status: status?.status || 'all_good',
        medications: {
          taken: status?.medications.taken || 0,
          total: status?.medications.scheduled || 0,
          upcoming: (status?.medications.scheduled || 0) - (status?.medications.taken || 0),
        },
        vitals: {
          bp: status?.vitals.lastBP
            ? {
                systolic: parseInt(status.vitals.lastBP.value.split('/')[0]),
                diastolic: parseInt(status.vitals.lastBP.value.split('/')[1]),
                time: formatTime(status.vitals.lastBP.timestamp),
                isAbnormal: status.vitals.lastBP.abnormal,
              }
            : undefined,
          glucose: status?.vitals.lastGlucose
            ? {
                value: status.vitals.lastGlucose.value,
                time: formatTime(status.vitals.lastGlucose.timestamp),
                isAbnormal: status.vitals.lastGlucose.abnormal,
              }
            : undefined,
        },
      };
    });
  });

export const useSelectedPatient = () =>
  useCaregiverStore((state) => {
    const { selectedPatientId, patientDetails } = state;
    return selectedPatientId ? patientDetails[selectedPatientId] : null;
  });

export const useUnreadCount = () =>
  useCaregiverStore((state) => state.unreadCount);

// Helper function
function formatTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}
