/**
 * BLE Device Types and Interfaces
 *
 * Types and interfaces for Bluetooth Low Energy medical device integration
 */

// ============================================================================
// BLE Device Types
// ============================================================================

export type BLEDeviceType = 'blood_pressure' | 'glucose' | 'pulse_oximeter' | 'scale';

export type BLEConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';

export type BLEDeviceManufacturer =
  | 'omron'
  | 'withings'
  | 'ihealth'
  | 'accu_chek'
  | 'onetouch'
  | 'freestyle'
  | 'nonin'
  | 'masimo'
  | 'garmin'
  | 'unknown';

// ============================================================================
// BLE Device Interfaces
// ============================================================================

export interface BLEDevice {
  id: string;
  name: string;
  localName?: string;
  type: BLEDeviceType;
  manufacturer: BLEDeviceManufacturer;
  rssi: number;
  connectionState: BLEConnectionState;
  isPaired: boolean;
  lastSync?: Date;
  batteryLevel?: number;
  services: string[];
}

export interface PairedBLEDevice extends BLEDevice {
  pairedAt: Date;
  lastConnectedAt?: Date;
  connectionCount: number;
  autoConnect: boolean;
}

// ============================================================================
// Measurement Types
// ============================================================================

export interface BPReading {
  systolic: number;
  diastolic: number;
  pulse?: number;
  timestamp: Date;
  deviceId: string;
  measurementId?: string;
  position?: 'sitting' | 'standing' | 'lying_down';
  arm?: 'left' | 'right';
  movementDetected?: boolean;
  irregularPulse?: boolean;
}

export interface GlucoseReading {
  value: number; // mg/dL
  timestamp: Date;
  deviceId: string;
  measurementId?: string;
  mealContext?: 'fasting' | 'before_meal' | 'after_meal';
  sampleType?: 'capillary' | 'venous' | 'arterial';
  testStripType?: string;
}

export interface PulseOximeterReading {
  spO2: number; // Percentage
  pulse: number; // BPM
  timestamp: Date;
  deviceId: string;
  perfusionIndex?: number;
  plethVariabilityIndex?: number;
}

export interface ScaleReading {
  weight: number; // kg
  bodyFatPercentage?: number;
  bodyWaterPercentage?: number;
  muscleMass?: number; // kg
  bmi?: number;
  timestamp: Date;
  deviceId: string;
}

export type BLEMeasurement = BPReading | GlucoseReading | PulseOximeterReading | ScaleReading;

// ============================================================================
// Service and Characteristic UUIDs
// ============================================================================

export const BLE_UUIDS = {
  // Blood Pressure Service
  BLOOD_PRESSURE_SERVICE: '00001810-0000-1000-8000-00805f9b34fb',
  BLOOD_PRESSURE_MEASUREMENT: '00002A35-0000-1000-8000-00805f9b34fb',

  // Glucose Service
  GLUCOSE_SERVICE: '00001808-0000-1000-8000-00805f9b34fb',
  GLUCOSE_MEASUREMENT: '00002A18-0000-1000-8000-00805f9b34fb',
  GLUCOSE_FEATURE: '00002A51-0000-1000-8000-00805f9b34fb',
  RECORD_ACCESS_CONTROL_POINT: '00002A52-0000-1000-8000-00805f9b34fb',

  // Pulse Oximeter Service
  PULSE_OXIMETER_SERVICE: '00001822-0000-1000-8000-00805f9b34fb',
  PULSE_OXIMETER_MEASUREMENT: '00002A5E-0000-1000-8000-00805f9b34fb',

  // Device Information Service
  DEVICE_INFORMATION_SERVICE: '0000180A-0000-1000-8000-00805f9b34fb',
  DEVICE_NAME: '00002A00-0000-1000-8000-00805f9b34fb',
  MANUFACTURER_NAME: '00002A29-0000-1000-8000-00805f9b34fb',
  MODEL_NUMBER: '00002A24-0000-1000-8000-00805f9b34fb',
  SERIAL_NUMBER: '00002A25-0000-1000-8000-00805f9b34fb',
  HARDWARE_REVISION: '00002A27-0000-1000-8000-00805f9b34fb',
  FIRMWARE_REVISION: '00002A26-0000-1000-8000-00805f9b34fb',
  SOFTWARE_REVISION: '00002A28-0000-1000-8000-00805f9b34fb',

  // Battery Service
  BATTERY_SERVICE: '0000180F-0000-1000-8000-00805f9b34fb',
  BATTERY_LEVEL: '00002A19-0000-1000-8000-00805f9b34fb',

  // Generic Access
  GENERIC_ACCESS_SERVICE: '00001800-0000-1000-8000-00805f9b34fb',
  GAP_DEVICE_NAME: '00002A00-0000-1000-8000-00805f9b34fb',

  // Generic Attribute
  GENERIC_ATTRIBUTE_SERVICE: '00001801-0000-1000-8000-00805f9b34fb',
  SERVICE_CHANGED: '00002A05-0000-1000-8000-00805f9b34fb',

  // Common descriptors
  CLIENT_CHARACTERISTIC_CONFIG: '00002902-0000-1000-8000-00805f9b34fb',
} as const;

// ============================================================================
// Device Recognition Patterns
// ============================================================================

export const DEVICE_NAME_PATTERNS: Record<BLEDeviceType, RegExp[]> = {
  blood_pressure: [
    /omron/i,
    /withings.*bp/i,
    /ihealth.*bp/i,
    /blood.*pressure/i,
    /bp.*monitor/i,
    /m3/i,
    /m6/i,
    /evolv/i,
    / BPM/i,
  ],
  glucose: [
    /accu.*chek/i,
    /onetouch/i,
    /freestyle.*libre/i,
    /contour/i,
    /glucose/i,
    /gluco/i,
    /meter/i,
  ],
  pulse_oximeter: [
    /nonin/i,
    /masimo/i,
    /pulse.*ox/i,
    /oximeter/i,
    /spo2/i,
  ],
  scale: [
    /withings.*body/i,
    /garmin.*index/i,
    /scale/i,
    /smart.*scale/i,
    /body.*composition/i,
  ],
};

export const MANUFACTURER_IDS: Record<number, BLEDeviceManufacturer> = {
  0x0006: 'omron',
  0x004c: 'withings', // Apple (common for Withings)
  0x0157: 'ihealth',
  0x0234: 'accu_chek',
};

// ============================================================================
// Scan and Connection Options
// ============================================================================

export interface BLEScanOptions {
  timeout?: number; // milliseconds
  allowDuplicates?: boolean;
  scanningMode?: 'low_latency' | 'balanced' | 'low_power';
  callbackType?: 'all' | 'first' | 'first_match';
}

export interface BLEConnectionOptions {
  timeout?: number; // milliseconds
  autoConnect?: boolean;
  retrieveServices?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export type BLEErrorCode =
  | 'bluetooth_unavailable'
  | 'bluetooth_unauthorized'
  | 'bluetooth_powered_off'
  | 'device_not_found'
  | 'device_not_connected'
  | 'connection_failed'
  | 'connection_timeout'
  | 'service_not_found'
  | 'characteristic_not_found'
  | 'read_failed'
  | 'write_failed'
  | 'notification_failed'
  | 'pairing_failed'
  | 'scan_failed'
  | 'parse_error'
  | 'unknown';

export class BLEError extends Error {
  constructor(
    public code: BLEErrorCode,
    message: string,
    public deviceId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'BLEError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      deviceId: this.deviceId,
      originalMessage: this.originalError?.message,
    };
  }
}

// ============================================================================
// Measurement Validation
// ============================================================================

export interface MeasurementValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const BP_RANGE = {
  systolic: { min: 60, max: 250 },
  diastolic: { min: 40, max: 150 },
  pulse: { min: 30, max: 200 },
};

export const GLUCOSE_RANGE = {
  min: 10, // mg/dL
  max: 600, // mg/dL
};

export const SPO2_RANGE = {
  min: 70, // percentage
  max: 100, // percentage
};

export const WEIGHT_RANGE = {
  min: 10, // kg
  max: 300, // kg
};
