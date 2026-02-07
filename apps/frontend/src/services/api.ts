/**
 * API Service
 *
 * Centralized API client with error handling, auth, and HIPAA compliance
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '../types';

// API base URL
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.salud-aldia.com/api';

// Storage keys
const ACCESS_TOKEN_KEY = '@salud_aldia_access_token';
const REFRESH_TOKEN_KEY = '@salud_aldia_refresh_token';

/**
 * Create configured axios instance
 */
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add auth token
  instance.interceptors.request.use(
    async (config) => {
      const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle token refresh and errors
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiError>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Handle token expiration
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
          if (refreshToken) {
            const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken } = data;
            await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return instance(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
          // In a real app, navigate to login screen
          return Promise.reject(refreshError);
        }
      }

      // Handle other errors
      if (error.response?.data) {
        return Promise.reject(error.response.data);
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

export const apiClient = createApiInstance();

/**
 * Auth service
 */
export const authService = {
  /**
   * Register new user
   */
  register: async (data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    dateOfBirth?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) => {
    const response = await apiClient.post('/auth/register', data);
    await storeTokens(response.data);
    return response.data;
  },

  /**
   * Login user
   */
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    await storeTokens(response.data);
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async () => {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  },

  /**
   * Get current user profile
   */
  getProfile: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  /**
   * Update profile
   */
  updateProfile: async (data: {
    name?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) => {
    const response = await apiClient.put('/auth/me', data);
    return response.data;
  },
};

/**
 * Medication service
 */
export const medicationService = {
  /**
   * Get all medications
   */
  getMedications: async () => {
    const response = await apiClient.get('/medications');
    return response.data.medications;
  },

  /**
   * Get today's medication schedule
   */
  getTodaysSchedule: async (date?: Date) => {
    const params = date ? { date: date.toISOString() } : {};
    const response = await apiClient.get('/medications/today', { params });
    return response.data.schedule;
  },

  /**
   * Create medication
   */
  createMedication: async (data: {
    name: string;
    dosage: string;
    frequency: string;
    times: string[];
    photoUrl?: string;
    supplyDays?: number;
    rxNumber?: string;
    notes?: string;
  }) => {
    const response = await apiClient.post('/medications', data);
    return response.data.medication;
  },

  /**
   * Update medication
   */
  updateMedication: async (medicationId: string, data: Partial<{
    name: string;
    dosage: string;
    frequency: string;
    times: string[];
    photoUrl?: string;
    supplyDays?: number;
    rxNumber?: string;
    notes?: string;
  }>) => {
    const response = await apiClient.put(`/medications/${medicationId}`, data);
    return response.data.medication;
  },

  /**
   * Delete medication
   */
  deleteMedication: async (medicationId: string) => {
    await apiClient.delete(`/medications/${medicationId}`);
  },

  /**
   * Mark medication as taken
   */
  markAsTaken: async (medicationId: string, scheduledAt: string, notes?: string) => {
    const response = await apiClient.post(`/medications/${medicationId}/take`, {
      scheduledAt,
      notes,
    });
    return response.data.log;
  },

  /**
   * Mark medication as skipped
   */
  markAsSkipped: async (medicationId: string, scheduledAt: string, notes?: string) => {
    const response = await apiClient.post(`/medications/${medicationId}/skip`, {
      scheduledAt,
      notes,
    });
    return response.data.log;
  },

  /**
   * Get medication logs
   */
  getLogs: async (medicationId: string, limit = 30, offset = 0) => {
    const response = await apiClient.get(`/medications/${medicationId}/logs`, {
      params: { limit, offset },
    });
    return response.data.logs;
  },
};

/**
 * Vital signs service
 */
export const vitalSignsService = {
  /**
   * Get vital signs
   */
  getVitalSigns: async (type?: string, startDate?: Date, endDate?: Date, limit?: number) => {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();
    if (limit) params.limit = limit.toString();

    const response = await apiClient.get('/vital-signs', { params });
    return response.data.vitalSigns;
  },

  /**
   * Record blood pressure
   */
  recordBloodPressure: async (data: {
    systolic: number;
    diastolic: number;
    measuredAt?: string;
    source?: 'manual' | 'bluetooth_device';
    deviceId?: string;
    additionalData?: {
      position?: 'sitting' | 'standing' | 'lying_down';
      arm?: 'left' | 'right';
    };
  }) => {
    const response = await apiClient.post('/vital-signs/blood-pressure', data);
    return response.data.vitalSign;
  },

  /**
   * Record glucose
   */
  recordGlucose: async (data: {
    value: string;
    measuredAt?: string;
    source?: 'manual' | 'bluetooth_device';
    deviceId?: string;
    additionalData?: {
      fasting?: boolean;
      mealTime?: 'before_meal' | 'after_meal' | 'bedtime';
    };
  }) => {
    const response = await apiClient.post('/vital-signs/glucose', {
      ...data,
      unit: 'mg/dL',
    });
    return response.data.vitalSign;
  },

  /**
   * Get vital signs summary
   */
  getSummary: async (days = 30) => {
    const response = await apiClient.get('/vital-signs/stats/summary', {
      params: { days },
    });
    return response.data;
  },

  /**
   * Get vital signs trends
   */
  getTrends: async (type: 'blood_pressure' | 'glucose', period: '7d' | '30d' | '90d') => {
    const response = await apiClient.get('/vital-signs/stats/trends', {
      params: { type, period },
    });
    return response.data;
  },

  /**
   * Check for abnormal readings
   */
  checkAbnormal: async () => {
    const response = await apiClient.get('/vital-signs/check-abnormal');
    return response.data;
  },
};

/**
 * Emergency service
 * SPEC-003: Emergency Alerts System
 */
export const emergencyService = {
  /**
   * Create emergency alert
   */
  createAlert: async (data: {
    type: 'critical_bp' | 'critical_glucose' | 'medication_missed' | 'no_response' | 'manual_trigger' | 'irregular_pattern';
    vitalSignId?: string;
    medicationId?: string;
    location?: { lat: number; lng: number; address?: string };
    notes?: string;
    bypassEscalation?: boolean;
  }) => {
    const response = await apiClient.post('/emergency/alerts', data);
    return response.data.alert;
  },

  /**
   * Trigger SOS emergency (EA-006)
   * Bypasses escalation, immediately notifies all contacts
   */
  triggerSOS: async (location?: { lat: number; lng: number; address?: string }) => {
    const response = await apiClient.post('/emergency/sos', { location });
    return response.data.alert;
  },

  /**
   * Get alerts
   */
  getAlerts: async (status?: string, limit = 20) => {
    const params: Record<string, string> = { limit: limit.toString() };
    if (status) params.status = status;

    const response = await apiClient.get('/emergency/alerts', { params });
    return response.data.alerts;
  },

  /**
   * Get active alerts for current user
   */
  getActiveAlerts: async () => {
    const response = await apiClient.get('/emergency/alerts/active');
    return response.data;
  },

  /**
   * Get alert details
   */
  getAlert: async (alertId: string) => {
    const response = await apiClient.get(`/emergency/alerts/${alertId}`);
    return response.data.alert;
  },

  /**
   * Get alert with notifications
   */
  getAlertWithNotifications: async (alertId: string) => {
    const response = await apiClient.get(`/emergency/alerts/${alertId}`);
    return response.data;
  },

  /**
   * Acknowledge alert (EA-005)
   */
  acknowledgeAlert: async (alertId: string, notes?: string) => {
    const response = await apiClient.post(`/emergency/alerts/${alertId}/acknowledge`, { notes });
    return response.data.alert;
  },

  /**
   * Resolve alert
   */
  resolveAlert: async (alertId: string, notes?: string, wasFalseAlarm = false) => {
    const response = await apiClient.post(`/emergency/alerts/${alertId}/resolve`, {
      notes,
      wasFalseAlarm,
    });
    return response.data.alert;
  },

  /**
   * Get emergency contacts (EA-002)
   */
  getContacts: async () => {
    const response = await apiClient.get('/emergency/contacts');
    return response.data.contacts;
  },

  /**
   * Get user's alert thresholds
   */
  getThresholds: async () => {
    const response = await apiClient.get('/emergency/thresholds');
    return response.data.thresholds;
  },

  /**
   * Update user's alert thresholds
   */
  updateThresholds: async (thresholds: {
    bloodPressure?: {
      criticalHigh?: { systolic?: number; diastolic?: number };
      warningHigh?: { systolic?: number; diastolic?: number };
      criticalLow?: { systolic?: number; diastolic?: number };
    };
    glucose?: {
      criticalLow?: number;
      warningLow?: number;
      criticalHigh?: number;
      warningHighFasting?: number;
      warningHighPostMeal?: number;
    };
  }) => {
    const response = await apiClient.put('/emergency/thresholds', thresholds);
    return response.data.thresholds;
  },
};

/**
 * Stats service
 */
export const statsService = {
  /**
   * Get health overview
   */
  getOverview: async (startDate?: Date, endDate?: Date) => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();

    const response = await apiClient.get('/stats/overview', { params });
    return response.data;
  },

  /**
   * Get medication adherence
   */
  getMedicationAdherence: async (period: '7d' | '30d' | '90d' = '30d') => {
    const response = await apiClient.get('/stats/medication-adherence', {
      params: { period },
    });
    return response.data;
  },

  /**
   * Get vitals summary
   */
  getVitalsSummary: async (period: '7d' | '30d' | '90d' = '30d') => {
    const response = await apiClient.get('/stats/vitals-summary', {
      params: { period },
    });
    return response.data;
  },

  /**
   * Get health trends
   */
  getHealthTrends: async (type: 'blood_pressure' | 'glucose', period: '7d' | '30d' | '90d' = '30d') => {
    const response = await apiClient.get('/stats/health-trends', {
      params: { type, period },
    });
    return response.data;
  },
};

/**
 * Caregiver service (SPEC-005)
 */
export const caregiverService = {
  /**
   * Get patients for caregiver (CG-001)
   */
  getPatients: async () => {
    const response = await apiClient.get('/caregivers/patients');
    return response.data.patients;
  },

  /**
   * Get patient status for dashboard card
   */
  getPatientStatus: async (patientId: string) => {
    const response = await apiClient.get(`/caregivers/patients/${patientId}/status`);
    return response.data;
  },

  /**
   * Get detailed patient information (CG-004)
   */
  getPatientDetail: async (patientId: string) => {
    const response = await apiClient.get(`/caregivers/patients/${patientId}/detail`);
    return response.data;
  },

  /**
   * Get patient activity log (CG-007)
   */
  getActivity: async (patientId: string, limit = 50) => {
    const response = await apiClient.get(`/caregivers/patients/${patientId}/activity`, {
      params: { limit },
    });
    return response.data.activity;
  },

  /**
   * Get patient summary (Legacy - use getPatientDetail instead)
   */
  getPatientSummary: async (patientId: string) => {
    const response = await apiClient.get(`/caregivers/patients/${patientId}/summary`);
    return response.data;
  },

  /**
   * Invite caregiver with role and schedule options
   */
  inviteCaregiver: async (data: {
    email: string;
    role: 'primary' | 'secondary' | 'professional';
    notificationPreferences?: {
      medicationMissed?: boolean;
      vitalAbnormal?: boolean;
      emergencyAlerts?: boolean;
      quietHours?: {
        enabled?: boolean;
        start?: string;
        end?: string;
      };
    };
    professionalSchedule?: Record<string, { start: string; end: string }>;
  }) => {
    const response = await apiClient.post('/caregivers/invite', data);
    return response.data.invite;
  },

  /**
   * Accept caregiver invite
   */
  acceptInvite: async (token: string) => {
    const response = await apiClient.post('/caregivers/accept', { token });
    return response.data.relationship;
  },

  /**
   * Update notification preferences
   */
  updatePreferences: async (
    relationshipId: string,
    preferences: {
      medicationMissed?: boolean;
      vitalAbnormal?: boolean;
      emergencyAlerts?: boolean;
      quietHours?: {
        enabled?: boolean;
        start?: string;
        end?: string;
      };
    }
  ) => {
    const response = await apiClient.put(
      `/caregivers/relationships/${relationshipId}/preferences`,
      { notificationPreferences: preferences }
    );
    return response.data.relationship;
  },

  /**
   * Update professional schedule (CG-008)
   */
  updateSchedule: async (
    relationshipId: string,
    schedule: Record<string, { start: string; end: string }>
  ) => {
    const response = await apiClient.put(
      `/caregivers/relationships/${relationshipId}/schedule`,
      { professionalSchedule: schedule }
    );
    return response.data.relationship;
  },

  /**
   * Pause notifications for a relationship
   */
  pauseNotifications: async (relationshipId: string) => {
    const response = await apiClient.post(
      `/caregivers/relationships/${relationshipId}/pause`
    );
    return response.data.relationship;
  },

  /**
   * Resume notifications for a relationship
   */
  resumeNotifications: async (relationshipId: string) => {
    const response = await apiClient.post(
      `/caregivers/relationships/${relationshipId}/resume`
    );
    return response.data.relationship;
  },

  /**
   * Remove caregiver relationship
   */
  removeRelationship: async (relationshipId: string) => {
    await apiClient.delete(`/caregivers/relationships/${relationshipId}`);
  },

  /**
   * Log a caregiver action (CG-007)
   */
  logAction: async (
    patientId: string,
    type: 'acknowledged' | 'called_patient' | 'called_emergency' | 'marked_skipped' | 'added_note',
    data?: { alertId?: string; notificationId?: string; notes?: string }
  ) => {
    const response = await apiClient.post(`/caregivers/patients/${patientId}/actions`, {
      ...data,
      type,
    });
    return response.data.action;
  },

  /**
   * Get pending notifications
   */
  getNotifications: async () => {
    const response = await apiClient.get('/caregivers/notifications');
    return response.data.notifications;
  },

  /**
   * Acknowledge a notification
   */
  acknowledgeNotification: async (notificationId: string) => {
    const response = await apiClient.post('/caregivers/notifications/acknowledge', {
      notificationId,
    });
    return response.data.notification;
  },
};

/**
 * Pharmacy service
 */
export const pharmacyService = {
  /**
   * Get pharmacy partners
   */
  getPharmacies: async (lat?: number, lng?: number) => {
    const params: Record<string, string> = {};
    if (lat !== undefined) params.lat = lat.toString();
    if (lng !== undefined) params.lng = lng.toString();

    const response = await apiClient.get('/pharmacy/partners', { params });
    return response.data.pharmacies;
  },

  /**
   * Create refill order
   */
  createRefill: async (data: {
    medicationId: string;
    pharmacyId?: string;
    deliveryAddress?: string;
  }) => {
    const response = await apiClient.post('/pharmacy/refills', data);
    return response.data.refill;
  },

  /**
   * Get refill orders
   */
  getRefills: async (status?: string) => {
    const params: Record<string, string> = {};
    if (status) params.status = status;

    const response = await apiClient.get('/pharmacy/refills', { params });
    return response.data.refills;
  },

  /**
   * Get low supply medications
   */
  getLowSupplyMedications: async () => {
    const response = await apiClient.get('/pharmacy/medications/low-supply');
    return response.data.medications;
  },
};

/**
 * Telemedicine service
 */
export const telemedicineService = {
  /**
   * Get healthcare providers
   */
  getProviders: async (specialty?: string, consultationType?: 'in_person' | 'online') => {
    const params: Record<string, string> = {};
    if (specialty) params.specialty = specialty;
    if (consultationType) params.consultationType = consultationType;

    const response = await apiClient.get('/telemedicine/providers', { params });
    return response.data.providers;
  },

  /**
   * Get provider details
   */
  getProvider: async (providerId: string) => {
    const response = await apiClient.get(`/telemedicine/providers/${providerId}`);
    return response.data.provider;
  },

  /**
   * Get user's linked healthcare providers
   */
  getUserProviders: async () => {
    const response = await apiClient.get('/telemedicine/user-providers');
    return response.data.providers;
  },

  /**
   * Link a healthcare provider to user
   */
  linkProvider: async (providerId: string, isPrimary = false) => {
    const response = await apiClient.post('/telemedicine/user-providers', {
      providerId,
      isPrimary,
    });
    return response.data.relationship;
  },

  /**
   * Get consultation recommendations
   */
  getRecommendations: async () => {
    const response = await apiClient.get('/telemedicine/recommendations');
    return response.data;
  },

  /**
   * Get consultation suggestions
   */
  getSuggestions: async () => {
    const response = await apiClient.get('/telemedicine/suggestions');
    return response.data;
  },
};

/**
 * Appointments service (SPEC-004)
 */
export const appointmentService = {
  /**
   * Get user's appointments
   */
  getAppointments: async (status?: string, limit = 20, offset = 0) => {
    const params: Record<string, string | number> = { limit, offset };
    if (status) params.status = status;

    const response = await apiClient.get('/appointments', { params });
    return response.data.appointments;
  },

  /**
   * Get upcoming appointments
   */
  getUpcomingAppointments: async () => {
    const response = await apiClient.get('/appointments/upcoming');
    return response.data.appointments;
  },

  /**
   * Get appointment details
   */
  getAppointment: async (appointmentId: string) => {
    const response = await apiClient.get(`/appointments/${appointmentId}`);
    return response.data.appointment;
  },

  /**
   * Create a new appointment
   */
  createAppointment: async (data: {
    providerId: string;
    type: 'in_person' | 'video' | 'async_message';
    scheduledAt: string;
    duration?: number;
    reason: string;
    notes?: string;
    includeHealthSummary?: boolean;
  }) => {
    const response = await apiClient.post('/appointments', data);
    return response.data.appointment;
  },

  /**
   * Update appointment status
   */
  updateStatus: async (appointmentId: string, status: string) => {
    const response = await apiClient.patch(`/appointments/${appointmentId}/status`, {
      status,
    });
    return response.data.appointment;
  },

  /**
   * Cancel appointment
   */
  cancelAppointment: async (appointmentId: string, reason?: string) => {
    const response = await apiClient.post(`/appointments/${appointmentId}/cancel`, {
      reason,
    });
    return response.data.appointment;
  },

  /**
   * Reschedule appointment
   */
  rescheduleAppointment: async (appointmentId: string, scheduledAt: string) => {
    const response = await apiClient.post(`/appointments/${appointmentId}/reschedule`, {
      scheduledAt,
    });
    return response.data.appointment;
  },

  /**
   * Get available time slots for a provider
   */
  getAvailableSlots: async (providerId: string, date: string, consultationType?: string) => {
    const params: Record<string, string> = { providerId, date };
    if (consultationType) params.consultationType = consultationType;

    const response = await apiClient.get('/appointments/slots/available', { params });
    return response.data.slots;
  },

  /**
   * Start video call
   */
  startVideoCall: async (appointmentId: string) => {
    const response = await apiClient.post(`/appointments/${appointmentId}/video/start`);
    return response.data.session;
  },

  /**
   * End video call
   */
  endVideoCall: async (appointmentId: string) => {
    const response = await apiClient.post(`/appointments/${appointmentId}/video/end`);
    return response.data.session;
  },

  /**
   * Get consultation notes for an appointment
   */
  getConsultationNotes: async (appointmentId: string) => {
    const response = await apiClient.get(`/appointments/${appointmentId}/notes`);
    return response.data.notes;
  },

  /**
   * Create consultation notes
   */
  createConsultationNotes: async (appointmentId: string, data: {
    providerId: string;
    chiefComplaint?: string;
    subjectiveNotes?: string;
    objectiveNotes?: string;
    assessment?: string;
    treatmentPlan?: Record<string, unknown>;
    followUpInstructions?: string;
    prescribedMedications?: Record<string, unknown>;
    vitalsDuringConsultation?: Record<string, unknown>;
    isConfidential?: boolean;
  }) => {
    const response = await apiClient.post(`/appointments/${appointmentId}/notes`, data);
    return response.data.notes;
  },

  /**
   * Get treatment plan updates for user
   */
  getTreatmentPlanUpdates: async (limit = 10) => {
    const response = await apiClient.get('/appointments/treatment-updates', {
      params: { limit },
    });
    return response.data.updates;
  },

  /**
   * Create treatment plan update
   */
  createTreatmentPlanUpdate: async (appointmentId: string, data: {
    userId: string;
    medicationChanges?: Record<string, unknown>;
    newMeasurementFrequencies?: Record<string, unknown>;
    lifestyleRecommendations?: string[];
    followUpScheduledAt?: string;
    followUpProviderId?: string;
  }) => {
    const response = await apiClient.post(`/appointments/${appointmentId}/treatment-plan`, data);
    return response.data.update;
  },

  /**
   * Generate health summary
   */
  generateHealthSummary: async (period: '7d' | '30d' | '90d' = '30d') => {
    const response = await apiClient.get('/appointments/health-summary', {
      params: { period },
    });
    return response.data.summary;
  },

  /**
   * Create saved health summary
   */
  createHealthSummary: async (period: '7d' | '30d' | '90d', appointmentId?: string) => {
    const response = await apiClient.post('/appointments/health-summary', {
      period,
      appointmentId,
    });
    return response.data;
  },

  /**
   * Get saved health summary
   */
  getHealthSummary: async (summaryId: string) => {
    const response = await apiClient.get(`/appointments/health-summary/${summaryId}`);
    return response.data.summary;
  },

  /**
   * Get payment details for an appointment
   */
  getPayment: async (appointmentId: string) => {
    const response = await apiClient.get(`/appointments/${appointmentId}/payment`);
    return response.data.payment;
  },

  /**
   * Create payment record for an appointment
   */
  createPayment: async (appointmentId: string, data: {
    amount: number;
    currency?: string;
    method: 'insurance' | 'credit_card' | 'paypal' | 'apple_pay' | 'google_pay';
    insuranceProvider?: string;
    insuranceMemberId?: string;
    insurancePreAuthorization?: string;
  }) => {
    const response = await apiClient.post(`/appointments/${appointmentId}/payment`, data);
    return response.data.payment;
  },
};

/**
 * Store auth tokens
 */
async function storeTokens(data: { accessToken: string; refreshToken: string }): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, data.accessToken],
    [REFRESH_TOKEN_KEY, data.refreshToken],
  ]);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return !!token;
}

/**
 * Clear all stored data
 */
export async function clearStorage(): Promise<void> {
  await AsyncStorage.clear();
}
