/**
 * TypeScript type definitions for SaludAlDía
 *
 * This file contains all shared type definitions used across the app
 */

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'patient' | 'caregiver' | 'admin';
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  profilePhotoUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  caregiverPatients?: Patient[];
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

// ============================================================================
// Medication Types
// ============================================================================

export type MedicationFrequency =
  | 'daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'as_needed'
  | 'weekly';

export type MedicationStatus = 'pending' | 'taken' | 'skipped';

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: MedicationFrequency;
  times: string[];
  photoUrl?: string;
  supplyDays?: number;
  rxNumber?: string;
  notes?: string;
  isActive: boolean;
  isLowSupply?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationLog {
  id: string;
  userId: string;
  medicationId: string;
  scheduledAt: string;
  takenAt?: string;
  status: MedicationStatus;
  notes?: string;
  createdAt: string;
}

export interface TodayMedication {
  medicationId: string;
  medicationName: string;
  dosage: string;
  photoUrl?: string;
  scheduledTime: string;
  logId?: string;
  status: MedicationStatus;
  takenAt?: string;
}

// ============================================================================
// Vital Signs Types
// ============================================================================

export type VitalSignType = 'blood_pressure' | 'glucose' | 'weight' | 'temperature';

export type VitalSignSource = 'manual' | 'bluetooth_device';

export interface VitalSign {
  id: string;
  userId: string;
  type: VitalSignType;
  systolic?: number;
  diastolic?: number;
  value?: string;
  unit: string;
  additionalData?: Record<string, unknown>;
  source: VitalSignSource;
  deviceId?: string;
  measuredAt: string;
  createdAt: string;
}

export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  measuredAt: string;
  isAbnormal: boolean;
}

export interface GlucoseReading {
  value: number;
  unit: string;
  measuredAt: string;
  isAbnormal: boolean;
  fasting?: boolean;
}

// ============================================================================
// Emergency Types (SPEC-003)
// ============================================================================

export type EmergencyAlertType =
  | 'critical_bp'
  | 'critical_glucose'
  | 'medication_missed'
  | 'no_response'
  | 'manual_trigger'
  | 'irregular_pattern';

export type EmergencyAlertStatus =
  | 'active'
  | 'acknowledged'
  | 'escalated'
  | 'resolved'
  | 'false_alarm';

export type AlertSeverity = 'critical' | 'high' | 'warning';

export type NotificationChannel = 'push' | 'sms' | 'email' | 'call';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface EmergencyAlert {
  id: string;
  userId: string;
  type: EmergencyAlertType;
  severity: AlertSeverity;
  vitalSignId?: string;
  medicationId?: string;
  status: EmergencyAlertStatus;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  escalationLevel: number;
  escalatedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
  wasFalseAlarm?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  relationship:
    | 'primary_caregiver'
    | 'secondary_caregiver'
    | 'emergency_contact'
    | 'healthcare_provider';
  isPrimary: boolean;
  priority: 1 | 2 | 3;
  notificationMethods: NotificationChannel[];
  availableHours?: { start: string; end: string }[];
  isActive?: boolean;
}

export interface EmergencyNotification {
  id: string;
  alertId: string;
  recipientContactId?: string;
  recipientType: string;
  recipientContact: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
}

export interface AlertThresholds {
  bloodPressure: {
    criticalHigh: { systolic: number; diastolic: number };
    warningHigh: { systolic: number; diastolic: number };
    criticalLow: { systolic: number; diastolic: number };
    warningLow?: { systolic: number; diastolic: number };
  };
  glucose: {
    criticalLow: number;
    warningLow: number;
    criticalHigh: number;
    warningHighFasting: number;
    warningHighPostMeal: number;
  };
}

// ============================================================================
// Caregiver Types (SPEC-005)
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
  createdAt: string;
  endedAt?: string;
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

export interface CaregiverAction {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  alertId?: string;
  type: 'acknowledged' | 'called_patient' | 'called_emergency' | 'marked_skipped' | 'added_note';
  notes?: string;
  createdAt: string;
}

export interface CaregiverInvite {
  id: string;
  patientId: string;
  patientName: string;
  email: string;
  token: string;
  role: CaregiverRole;
  expiresAt: string;
}

export interface PatientStatus {
  patientId: string;
  timestamp: string;
  medications: {
    scheduled: number;
    taken: number;
    missed: number;
    pending: number;
  };
  vitals: {
    lastBP?: { value: string; timestamp: string; abnormal: boolean };
    lastGlucose?: { value: number; timestamp: string; abnormal: boolean };
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
  status: 'all_good' | 'attention_needed' | 'critical';
}

export interface PatientCard {
  id: string;
  name: string;
  photoUrl?: string;
  age?: number;
  isPrimary: boolean;
  status: 'all_good' | 'attention_needed' | 'critical';
  lastSeen?: string;
  medications: {
    taken: number;
    total: number;
    upcoming: Array<{
      id: string;
      name: string;
      time: string;
      status: 'taken' | 'pending' | 'missed';
    }>;
  };
  vitals: {
    bp?: { systolic: number; diastolic: number; time: string; isAbnormal: boolean };
    glucose?: { value: number; time: string; isAbnormal: boolean };
  };
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
      takenAt?: string;
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
      measuredAt: string;
      isAbnormal: boolean;
    }>;
    glucose: Array<{
      id: string;
      value: number;
      measuredAt: string;
      isAbnormal: boolean;
    }>;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: 'critical' | 'high' | 'warning';
    status: string;
    createdAt: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
  }>;
  activity: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
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

export interface CaregiverNotification {
  id: string;
  caregiverId: string;
  patientId: string;
  patientName: string;
  type: 'medication_missed' | 'vital_abnormal' | 'emergency' | 'escalation';
  title: string;
  message: string;
  data: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'sent' | 'delivered' | 'acknowledged';
  sentAt?: string;
  acknowledgedAt?: string;
  expiresAt: string;
  escalationLevel: number;
  originalAlertId?: string;
}

// Legacy compatibility - keep existing types for other parts of the app
export interface PatientSummary {
  patient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    isPrimary: boolean;
  };
  medications: {
    total: number;
    takenToday: number;
    missedToday: number;
    upcoming: Array<{
      id: string;
      name: string;
      scheduledTime: string;
    }>;
  };
  vitalSigns: {
    latestBP?: { systolic: number; diastolic: number; measuredAt: string; isAbnormal: boolean };
    latestGlucose?: { value: string; measuredAt: string; isAbnormal: boolean };
  };
  alerts: {
    activeCount: number;
    recent: Array<{
      id: string;
      type: string;
      createdAt: string;
    }>;
  };
}

// ============================================================================
// Stats Types
// ============================================================================

export interface MedicationAdherence {
  rate: number;
  taken: number;
  missed: number;
  skipped: number;
  total: number;
  dailyBreakdown: Array<{
    date: string;
    taken: number;
    total: number;
    rate: number;
  }>;
}

export interface HealthOverview {
  medications: {
    total: number;
    takenToday: number;
    remainingToday: number;
    adherenceRate: number;
  };
  vitals: {
    bloodPressure: {
      latest: { systolic: number; diastolic: number; date: string } | null;
      average: { systolic: number; diastolic: number };
      isAbnormal: boolean;
    };
    glucose: {
      latest: { value: number; date: string } | null;
      average: number;
      isAbnormal: boolean;
    };
  };
  alerts: {
    activeCount: number;
    lastWeekCount: number;
  };
}

export interface HealthTrendData {
  date: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

// ============================================================================
// Pharmacy Types (SPEC-006)
// ============================================================================

export type PharmacyIntegrationType = 'direct_api' | 'manual_fax' | 'email' | 'manual';
export type PrescriptionRefillStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type DeliveryType = 'delivery' | 'pickup';
export type PharmacyPaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'insurance';
export type PharmacyPaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type SupplyAlertUrgency = 'critical' | 'warning' | 'info';

export interface PharmacyPartner {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  logoUrl?: string;
  integrationType: PharmacyIntegrationType;
  deliveryAvailable: boolean;
  deliveryRadiusKm?: number;
  deliveryFee: number;
  minimumOrder: number;
  estimatedDeliveryTime: {
    min: number;
    max: number;
  };
  operatingHours: Record<string, { open: string; close: string }>;
  distance?: number;
}

export interface MedicationInventory {
  id: string;
  userId: string;
  medicationId: string;
  currentSupply: number;
  lastRefillDate?: string;
  nextRefillDate?: string;
  refillReminderSent: boolean;
  autoRefillEnabled: boolean;
  preferredPharmacyId?: string;
}

export interface SupplyAlert {
  id: string;
  userId: string;
  medicationId: string;
  medicationName: string;
  daysRemaining: number;
  urgency: SupplyAlertUrgency;
  suggestedRefillDate: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface PharmacyOrderItem {
  medicationId: string;
  name: string;
  dosage: string;
  quantity: number;
  rxNumber?: string;
  requiresPrescription: boolean;
  price?: number;
}

export interface PharmacyOrder {
  id: string;
  userId: string;
  medicationId?: string;
  pharmacyId?: string;
  status: PrescriptionRefillStatus;
  orderId?: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  scheduledFor?: string;
  items: PharmacyOrderItem[];
  paymentMethod?: PharmacyPaymentMethod;
  paymentAmount?: number;
  paymentStatus: PharmacyPaymentStatus;
  paymentTransactionId?: string;
  insuranceProvider?: string;
  insuranceMemberId?: string;
  insuranceClaimId?: string;
  insuranceCopay?: number;
  estimatedDelivery?: string;
  trackingUrl?: string;
  trackingNumber?: string;
  driverLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  };
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  prescriptionUrls?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  pharmacy?: PharmacyPartner;
  medication?: {
    id: string;
    name: string;
    dosage: string;
    photoUrl?: string;
  };
}

// Legacy compatibility - keep existing types
export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  deliveryAvailable: boolean;
  deliveryRadiusKm?: number;
  distance?: number;
}

export interface PrescriptionRefill {
  id: string;
  userId: string;
  medicationId: string;
  pharmacyId?: string;
  status: PrescriptionRefillStatus;
  orderId?: string;
  deliveryAddress?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  createdAt: string;
  medication?: {
    id: string;
    name: string;
    dosage: string;
    supplyDays: number;
    photoUrl?: string;
  };
  pharmacy?: Pharmacy;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PharmacyPaymentMethod;
  isDefault: boolean;
  isActive: boolean;
  cardLast4?: string;
  cardBrand?: string;
  cardExpiryMonth?: number;
  cardExpiryYear?: number;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceMemberId?: string;
}

export interface AutoRefillSettings {
  id: string;
  userId: string;
  medicationId: string;
  enabled: boolean;
  triggerDays: number;
  preferredPharmacyId?: string;
  paymentMethodId?: string;
  confirmationRequired: boolean;
  lastAutoFillDate?: string;
}

// ============================================================================
// Telemedicine Types (SPEC-004)
// ============================================================================

export type ConsultationType = 'in_person' | 'online';

export type AppointmentType = 'in_person' | 'video' | 'async_message';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type PaymentMethod = 'insurance' | 'credit_card' | 'paypal' | 'apple_pay' | 'google_pay';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'refunded' | 'failed';

export interface HealthcareProvider {
  id: string;
  name: string;
  specialty?: string;
  credentials?: string[];
  clinicName?: string;
  phone?: string;
  email?: string;
  consultationTypes: AppointmentType[];
  availability?: ProviderAvailabilitySlot[];
  location?: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
  rating?: number;
  consultationCount?: number;
  languages?: string[];
  consultationFee?: {
    inPerson?: number;
    video?: number;
    async?: number;
  };
  insuranceAccepted?: string[];
}

export interface ProviderAvailabilitySlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:mm format
  endTime: string;
}

export interface HealthcareProviderDetail extends HealthcareProvider {
  isPrimary?: boolean;
}

export interface ConsultationSuggestion {
  type: 'consultation_recommended' | 'medication_review' | 'follow_up_needed';
  priority: 'low' | 'medium' | 'high';
  reason: string;
  suggestedSpecialty?: string;
  recommendedWithin?: string;
}

export interface Appointment {
  id: string;
  userId: string;
  providerId: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: string;
  duration: number;
  reason: string;
  notes?: string;
  healthDataSnapshot?: HealthSummary;
  videoCallLink?: string;
  videoCallToken?: string;
  reminderSent: boolean;
  reminderAt?: string;
  calendarEventId?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  noShowAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentDetail extends Appointment {
  providerName: string;
  providerSpecialty?: string;
  providerClinicName?: string;
  providerPhone?: string;
  providerEmail?: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
}

export interface AvailableTimeSlot {
  slotTime: string;
  slotEndTime: string;
  isAvailable: boolean;
}

export interface HealthSummary {
  period: '7d' | '30d' | '90d';
  bloodPressureSummary?: {
    average: { systolic: number; diastolic: number };
    highest: { systolic: number; diastolic: number };
    lowest: { systolic: number; diastolic: number };
    readings: number;
  };
  glucoseSummary?: {
    average: number;
    highest: number;
    lowest: number;
    readings: number;
  };
  medicationAdherence?: {
    onTime: number;
    missed: number;
    total: number;
  };
  alertsCount: number;
  medicationsCurrent?: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    times: string[];
  }>;
}

export interface ConsultationNote {
  id: string;
  appointmentId: string;
  providerId: string;
  chiefComplaint?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessment?: string;
  treatmentPlan?: Record<string, unknown>;
  followUpInstructions?: string;
  prescribedMedications?: Record<string, unknown>;
  vitalsDuringConsultation?: Record<string, unknown>;
  isConfidential: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentPlanUpdate {
  id: string;
  appointmentId: string;
  userId: string;
  updatedBy: string;
  medicationChanges?: Record<string, unknown>;
  newMeasurementFrequencies?: Record<string, unknown>;
  lifestyleRecommendations?: string[];
  followUpScheduledAt?: string;
  followUpProviderId?: string;
  createdAt: string;
}

export interface ConsultationPayment {
  id: string;
  appointmentId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  insuranceProvider?: string;
  insuranceMemberId?: string;
  insurancePreAuthorization?: string;
  paymentGatewayTransactionId?: string;
  refundedAt?: string;
  refundAmount?: number;
  refundReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoCallSession {
  id: string;
  appointmentId: string;
  providerId: string;
  userId: string;
  sessionId: string;
  providerToken: string;
  userToken: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  recordingUrl?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}

export interface ApiError {
  error: string;
  code: string;
  details?: Array<{
    path: string;
    message: string;
  }>;
}

// ============================================================================
// Navigation Types
// ============================================================================

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  MedicationDetail: { medicationId: string };
  AddMedication: undefined;
  RecordBloodPressure: undefined;
  RecordGlucose: undefined;
  HealthStats: undefined;
  Emergency: { alertId?: string };
  PharmacyList: undefined;
  MedicationRefill: { medicationId: string };
  PharmacyRefillSelect: { medicationIds: string[] };
  PharmacyRefillReview: { medicationIds: string[]; pharmacyId: string; deliveryType: DeliveryType };
  PharmacyOrderTracking: { orderId: string };
  PharmacyPaymentMethods: undefined;
  PharmacyAutoRefillSettings: { medicationId: string };
  Telemedicine: undefined;
  TelemedicineProviders: undefined;
  TelemedicineBookAppointment: { providerId: string };
  TelemedicineAppointmentDetail: { appointmentId: string };
  TelemedicineVideoCall: { appointmentId: string };
  PatientDetail: { patientId: string };
  DeviceDiscovery: { deviceType?: 'blood_pressure' | 'glucose' | 'pulse_oximeter' | 'scale' };
  DeviceList: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Medications: undefined;
  Vitals: undefined;
  Stats: undefined;
  Profile: undefined;
  Caregiver: undefined;
};

export type DrawerParamList = {
  Main: undefined;
  Settings: undefined;
  Emergency: undefined;
};
