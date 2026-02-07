/**
 * Device Adapters
 *
 * Device-specific adapters for medical devices
 * Each adapter handles proprietary communication protocols
 */

import { Device } from 'react-native-ble-plx';
import {
  BPReading,
  GlucoseReading,
  BLEMeasurement,
  BLEDeviceType,
} from '../../types/ble';

// ============================================================================
// Base Adapter Interface
// ============================================================================

export interface DeviceAdapter {
  /**
   * Connect and prepare the device
   */
  connect(): Promise<void>;

  /**
   * Trigger a measurement (if supported)
   */
  triggerMeasurement(): Promise<void>;

  /**
   * Read current measurement
   */
  readMeasurement(): Promise<BLEMeasurement>;

  /**
   * Subscribe to automatic measurements
   */
  subscribeToMeasurements(callback: (measurement: BLEMeasurement) => void): Promise<() => void>;

  /**
   * Get device battery level
   */
  getBatteryLevel(): Promise<number | null>;

  /**
   * Disconnect from device
   */
  disconnect(): Promise<void>;

  /**
   * Check if device is ready for measurement
   */
  isReady(): boolean;
}

// ============================================================================
// Omron Blood Pressure Monitor Adapter
// ============================================================================

/**
 * Omron-specific blood pressure monitor adapter
 * Supports: Omron M3, M6, Evolv series
 */
export class OmronBPAdapter implements DeviceAdapter {
  private device: Device;
  private isConnectedFlag: boolean = false;
  private privateServiceUUID = '00001810-0000-1000-8000-00805f9b34fb'; // Blood Pressure
  private measurementUUID = '00002A35-0000-1000-8000-00805f9b34fb';

  constructor(device: Device) {
    this.device = device;
  }

  async connect(): Promise<void> {
    if (!this.device.isConnected()) {
      await this.device.connect();
    }
    await this.device.discoverAllServicesAndCharacteristics();
    this.isConnectedFlag = true;
  }

  async triggerMeasurement(): Promise<void> {
    // Omron devices typically auto-start when cuff is applied
    // Some models support remote trigger via custom characteristic
    // This is a placeholder for future implementation
    throw new Error('Remote measurement trigger not supported. Start measurement on device.');
  }

  async readMeasurement(): Promise<BLEMeasurement> {
    const services = await this.device.services();
    const bpService = services.find(
      (s) => s.uuid.toLowerCase() === this.privateServiceUUID.toLowerCase()
    );

    if (!bpService) {
      throw new Error('Blood pressure service not found');
    }

    const characteristics = await bpService.characteristics();
    const measurementChar = characteristics.find(
      (c) => c.uuid.toLowerCase() === this.measurementUUID.toLowerCase()
    );

    if (!measurementChar) {
      throw new Error('Blood pressure measurement characteristic not found');
    }

    // Read the most recent measurement
    if (!measurementChar.isReadable) {
      throw new Error('Measurement characteristic is not readable');
    }

    const data = await measurementChar.read();
    return this.parseBloodPressure(data.value!, this.device.id);
  }

  async subscribeToMeasurements(
    callback: (measurement: BLEMeasurement) => void
  ): Promise<() => void> {
    const services = await this.device.services();
    const bpService = services.find(
      (s) => s.uuid.toLowerCase() === this.privateServiceUUID.toLowerCase()
    );

    if (!bpService) {
      throw new Error('Blood pressure service not found');
    }

    const characteristics = await bpService.characteristics();
    const measurementChar = characteristics.find(
      (c) => c.uuid.toLowerCase() === this.measurementUUID.toLowerCase()
    );

    if (!measurementChar) {
      throw new Error('Measurement characteristic not found');
    }

    if (!measurementChar.isNotifiable) {
      throw new Error('Measurement characteristic does not support notifications');
    }

    // Enable notifications
    await this.device.writeCharacteristicWithoutResponseForService(
      this.privateServiceUUID,
      '00002902-0000-1000-8000-00805f9b34fb', // CCC descriptor
      Buffer.from([0x01, 0x00]).toString('base64')
    );

    const monitor = measurementChar.monitor((error, characteristic) => {
      if (error) {
        console.error('[OmronBP] Notification error:', error);
        return;
      }

      if (characteristic?.value) {
        try {
          const measurement = this.parseBloodPressure(characteristic.value, this.device.id);
          callback(measurement);
        } catch (error) {
          console.error('[OmronBP] Parse error:', error);
        }
      }
    });

    return () => monitor?.remove?.() || this.device.cancelConnection();
  }

  async getBatteryLevel(): Promise<number | null> {
    try {
      const services = await this.device.services();
      const batteryService = services.find(
        (s) => s.uuid.toLowerCase() === '0000180F-0000-1000-8000-00805f9b34fb'.toLowerCase()
      );

      if (!batteryService) {
        return null;
      }

      const characteristics = await batteryService.characteristics();
      const batteryChar = characteristics.find(
        (c) => c.uuid.toLowerCase() === '00002A19-0000-1000-8000-00805f9b34fb'.toLowerCase()
      );

      if (!batteryChar || !batteryChar.isReadable) {
        return null;
      }

      const data = await batteryChar.read();
      if (data.value) {
        const view = new DataView(data.value);
        return view.getUint8(0);
      }
    } catch (error) {
      console.error('[OmronBP] Error reading battery:', error);
    }
    return null;
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    await this.device.cancelConnection();
  }

  isReady(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * Parse Omron blood pressure measurement
   * Uses standard Bluetooth SIG format with some Omron extensions
   */
  private parseBloodPressure(value: ArrayBuffer, deviceId: string): BPReading {
    const data = new DataView(value);
    let offset = 0;

    // Flags byte
    const flags = data.getUint8(offset);
    offset += 1;

    const unit = (flags & 0x01) === 0; // 0 = mmHg, 1 = kPa
    const timeStampPresent = (flags & 0x02) !== 0;
    const pulseRatePresent = (flags & 0x04) !== 0;
    const userIdPresent = (flags & 0x08) !== 0;
    const measurementStatusPresent = (flags & 0x10) !== 0;

    // Systolic (16-bit, 1/10 mmHg)
    const systolicRaw = data.getUint16(offset, true);
    const systolic = unit ? systolicRaw / 10 / 1.33322 : systolicRaw / 10; // Convert kPa to mmHg if needed
    offset += 2;

    // Diastolic
    const diastolicRaw = data.getUint16(offset, true);
    const diastolic = unit ? diastolicRaw / 10 / 1.33322 : diastolicRaw / 10;
    offset += 2;

    // Mean arterial pressure (skip)
    offset += 2;

    // Pulse rate (if present)
    let pulse: number | undefined;
    if (pulseRatePresent) {
      pulse = data.getUint16(offset, true) / 10;
      offset += 2;
    }

    // User ID (skip)
    if (userIdPresent) {
      offset += 1;
    }

    // Measurement status
    let irregularPulse = false;
    let movementDetected = false;
    if (measurementStatusPresent) {
      const status = data.getUint16(offset, true);
      irregularPulse = (status & 0x01) !== 0;
      movementDetected = (status & 0x02) !== 0;
      // Check for cuff too loose, etc.
    }

    // Omron-specific: Check for "movement detection" bit in extended status
    // Some Omron devices include additional status bytes

    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      pulse: pulse ? Math.round(pulse) : undefined,
      timestamp: new Date(),
      deviceId,
      movementDetected,
      irregularPulse,
    };
  }
}

// ============================================================================
// Withings Blood Pressure Monitor Adapter
// ============================================================================

/**
 * Withings-specific blood pressure monitor adapter
 * Supports: Withings BPM Connect, BPM Core
 */
export class WithingsBPAdapter implements DeviceAdapter {
  private device: Device;
  private isConnectedFlag: boolean = false;
  private serviceUUID = '00001810-0000-1000-8000-00805f9b34fb';

  constructor(device: Device) {
    this.device = device;
  }

  async connect(): Promise<void> {
    if (!this.device.isConnected()) {
      await this.device.connect();
    }
    await this.device.discoverAllServicesAndCharacteristics();
    this.isConnectedFlag = true;
  }

  async triggerMeasurement(): Promise<void> {
    // Withings devices auto-start when cuff is applied
    throw new Error('Remote measurement trigger not supported. Start measurement on device.');
  }

  async readMeasurement(): Promise<BLEMeasurement> {
    // Withings typically pushes measurements via notifications
    // Reading may return cached data
    throw new Error('Withings devices push measurements. Use subscribeToMeasurements() instead.');
  }

  async subscribeToMeasurements(
    callback: (measurement: BLEMeasurement) => void
  ): Promise<() => void> {
    const services = await this.device.services();
    const bpService = services.find(
      (s) => s.uuid.toLowerCase() === this.serviceUUID.toLowerCase()
    );

    if (!bpService) {
      throw new Error('Blood pressure service not found');
    }

    const characteristics = await bpService.characteristics();
    const measurementChar = characteristics.find(
      (c) => c.uuid.toLowerCase() === '00002A35-0000-1000-8000-00805f9b34fb'.toLowerCase()
    );

    if (!measurementChar) {
      throw new Error('Measurement characteristic not found');
    }

    const monitor = measurementChar.monitor((error, characteristic) => {
      if (error) {
        console.error('[WithingsBP] Notification error:', error);
        return;
      }

      if (characteristic?.value) {
        try {
          const measurement = this.parseWithingsBP(characteristic.value, this.device.id);
          callback(measurement);
        } catch (error) {
          console.error('[WithingsBP] Parse error:', error);
        }
      }
    });

    return () => monitor?.remove?.() || this.device.cancelConnection();
  }

  async getBatteryLevel(): Promise<number | null> {
    // Similar to Omron implementation
    try {
      const services = await this.device.services();
      const batteryService = services.find(
        (s) => s.uuid.toLowerCase() === '0000180F-0000-1000-8000-00805f9b34fb'.toLowerCase()
      );

      if (!batteryService) {
        return null;
      }

      const characteristics = await batteryService.characteristics();
      const batteryChar = characteristics.find(
        (c) => c.uuid.toLowerCase() === '00002A19-0000-1000-8000-00805f9b34fb'.toLowerCase()
      );

      if (!batteryChar || !batteryChar.isReadable) {
        return null;
      }

      const data = await batteryChar.read();
      if (data.value) {
        const view = new DataView(data.value);
        return view.getUint8(0);
      }
    } catch (error) {
      console.error('[WithingsBP] Error reading battery:', error);
    }
    return null;
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    await this.device.cancelConnection();
  }

  isReady(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * Parse Withings blood pressure measurement
   * Withings uses standard Bluetooth SIG format
   */
  private parseWithingsBP(value: ArrayBuffer, deviceId: string): BPReading {
    const data = new DataView(value);
    let offset = 0;

    const flags = data.getUint8(offset);
    offset += 1;

    const unit = (flags & 0x01) === 0;
    const pulseRatePresent = (flags & 0x04) !== 0;
    const measurementStatusPresent = (flags & 0x10) !== 0;

    const systolic = data.getUint16(offset, true) / (unit ? 13.3322 : 10);
    offset += 2;

    const diastolic = data.getUint16(offset, true) / (unit ? 13.3322 : 10);
    offset += 2;

    offset += 2; // Skip MAP

    let pulse: number | undefined;
    if (pulseRatePresent) {
      pulse = data.getUint16(offset, true) / 10;
      offset += 2;
    }

    let irregularPulse = false;
    let movementDetected = false;
    if (measurementStatusPresent) {
      const status = data.getUint16(offset, true);
      irregularPulse = (status & 0x01) !== 0;
      movementDetected = (status & 0x02) !== 0;
    }

    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      pulse: pulse ? Math.round(pulse) : undefined,
      timestamp: new Date(),
      deviceId,
      movementDetected,
      irregularPulse,
    };
  }
}

// ============================================================================
// Accu-Chek Glucose Meter Adapter
// ============================================================================

/**
 * Accu-Chek glucose meter adapter
 * Supports: Accu-Chek Guide, Accu-Chek Active, Accu-Chek Mobile
 */
export class AccuChekAdapter implements DeviceAdapter {
  private device: Device;
  private isConnectedFlag: boolean = false;
  private serviceUUID = '00001808-0000-1000-8000-00805f9b34fb'; // Glucose Service

  constructor(device: Device) {
    this.device = device;
  }

  async connect(): Promise<void> {
    if (!this.device.isConnected()) {
      await this.device.connect();
    }
    await this.device.discoverAllServicesAndCharacteristics();

    // Authenticate if required (Accu-Chek may require authentication)
    await this.authenticate();

    this.isConnectedFlag = true;
  }

  private async authenticate(): Promise<void> {
    // Some Accu-Chek meters require authentication
    // This is a placeholder for future implementation
    // Typically involves writing to a control point characteristic
  }

  async triggerMeasurement(): Promise<void> {
    // Glucose meters don't support remote triggering
    throw new Error('Glucose meters require manual blood sample. Trigger not supported.');
  }

  async readMeasurement(): Promise<BLEMeasurement> {
    const services = await this.device.services();
    const glucoseService = services.find(
      (s) => s.uuid.toLowerCase() === this.serviceUUID.toLowerCase()
    );

    if (!glucoseService) {
      throw new Error('Glucose service not found');
    }

    const characteristics = await glucoseService.characteristics();
    const measurementChar = characteristics.find(
      (c) => c.uuid.toLowerCase() === '00002A18-0000-1000-8000-00805f9b34fb'.toLowerCase()
    );

    if (!measurementChar) {
      throw new Error('Glucose measurement characteristic not found');
    }

    if (measurementChar.isReadable) {
      const data = await measurementChar.read();
      return this.parseGlucose(data.value!, this.device.id);
    }

    throw new Error('Cannot read measurement. Device may require notification subscription.');
  }

  async subscribeToMeasurements(
    callback: (measurement: BLEMeasurement) => void
  ): Promise<() => void> {
    const services = await this.device.services();
    const glucoseService = services.find(
      (s) => s.uuid.toLowerCase() === this.serviceUUID.toLowerCase()
    );

    if (!glucoseService) {
      throw new Error('Glucose service not found');
    }

    const characteristics = await glucoseService.characteristics();
    const measurementChar = characteristics.find(
      (c) => c.uuid.toLowerCase() === '00002A18-0000-1000-8000-00805f9b34fb'.toLowerCase()
    );

    if (!measurementChar) {
      throw new Error('Measurement characteristic not found');
    }

    const monitor = measurementChar.monitor((error, characteristic) => {
      if (error) {
        console.error('[AccuChek] Notification error:', error);
        return;
      }

      if (characteristic?.value) {
        try {
          const measurement = this.parseGlucose(characteristic.value, this.device.id);
          callback(measurement);
        } catch (error) {
          console.error('[AccuChek] Parse error:', error);
        }
      }
    });

    return () => monitor?.remove?.() || this.device.cancelConnection();
  }

  async getBatteryLevel(): Promise<number | null> {
    try {
      const services = await this.device.services();
      const batteryService = services.find(
        (s) => s.uuid.toLowerCase() === '0000180F-0000-1000-8000-00805f9b34fb'.toLowerCase()
      );

      if (!batteryService) {
        return null;
      }

      const characteristics = await batteryService.characteristics();
      const batteryChar = characteristics.find(
        (c) => c.uuid.toLowerCase() === '00002A19-0000-1000-8000-00805f9b34fb'.toLowerCase()
      );

      if (!batteryChar || !batteryChar.isReadable) {
        return null;
      }

      const data = await batteryChar.read();
      if (data.value) {
        const view = new DataView(data.value);
        return view.getUint8(0);
      }
    } catch (error) {
      console.error('[AccuChek] Error reading battery:', error);
    }
    return null;
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    await this.device.cancelConnection();
  }

  isReady(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * Parse Accu-Chek glucose measurement
   * Uses standard Bluetooth SIG Glucose Measurement format
   */
  private parseGlucose(value: ArrayBuffer, deviceId: string): GlucoseReading {
    const data = new DataView(value);
    let offset = 0;

    const flags = data.getUint8(offset);
    offset += 1;

    const timeOffsetPresent = (flags & 0x01) !== 0;
    const typeAndLocationPresent = (flags & 0x02) !== 0;
    const concentrationUnitsKgMl = (flags & 0x04) === 0;

    const sequenceNumber = data.getUint16(offset, true);
    offset += 2;

    // Timestamp
    const year = data.getUint16(offset, true);
    offset += 2;
    const month = data.getUint8(offset);
    offset += 1;
    const day = data.getUint8(offset);
    offset += 1;
    const hours = data.getUint8(offset);
    offset += 1;
    const minutes = data.getUint8(offset);
    offset += 1;
    const seconds = data.getUint8(offset);
    offset += 1;

    const timestamp = new Date(year, month - 1, day, hours, minutes, seconds);

    if (timeOffsetPresent) {
      offset += 2;
    }

    // Glucose concentration
    let value: number;
    if (concentrationUnitsKgMl) {
      value = data.getFloat16(offset, true) * 100000;
    } else {
      value = data.getSFloat16(offset, true) * 18015.6;
    }
    offset += 2;

    // Sample type and location
    let mealContext: GlucoseReading['mealContext'];
    if (typeAndLocationPresent) {
      const typeByte = data.getUint8(offset);
      offset += 1;

      const sampleType = (typeByte & 0xF0) >> 4;
      // Type: 1=fasting, 2=before meal, 3=after meal
      if (sampleType === 1) mealContext = 'fasting';
      else if (sampleType === 2) mealContext = 'before_meal';
      else if (sampleType === 3) mealContext = 'after_meal';
    }

    return {
      value: Math.round(value),
      timestamp,
      deviceId,
      measurementId: sequenceNumber.toString(),
      mealContext,
    };
  }
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Create appropriate adapter based on device name/type
 */
export function createDeviceAdapter(device: Device, deviceType: BLEDeviceType): DeviceAdapter {
  const name = (device.name || device.localName || '').toLowerCase();

  switch (deviceType) {
    case 'blood_pressure':
      if (name.includes('omron')) {
        return new OmronBPAdapter(device);
      }
      if (name.includes('withings') || name.includes('nokia')) {
        return new WithingsBPAdapter(device);
      }
      if (name.includes('ihealth')) {
        // iHealth devices use similar protocol to Omron
        return new OmronBPAdapter(device);
      }
      // Default to standard adapter for BP monitors
      return new OmronBPAdapter(device);

    case 'glucose':
      if (name.includes('accu') || name.includes('chek')) {
        return new AccuChekAdapter(device);
      }
      if (name.includes('onetouch')) {
        // OneTouch uses similar protocol
        return new AccuChekAdapter(device);
      }
      if (name.includes('freestyle') || name.includes('libre')) {
        // FreeStyle Libre uses different protocol
        return new AccuChekAdapter(device);
      }
      return new AccuChekAdapter(device);

    default:
      throw new Error(`No adapter available for device type: ${deviceType}`);
  }
}

/**
 * Get standard service UUID for device type
 */
export function getServiceUUIDForDeviceType(deviceType: BLEDeviceType): string {
  switch (deviceType) {
    case 'blood_pressure':
      return '00001810-0000-1000-8000-00805f9b34fb';
    case 'glucose':
      return '00001808-0000-1000-8000-00805f9b34fb';
    case 'pulse_oximeter':
      return '00001822-0000-1000-8000-00805f9b34fb';
    default:
      throw new Error(`Unknown device type: ${deviceType}`);
  }
}

/**
 * Get measurement characteristic UUID for device type
 */
export function getCharacteristicUUIDForDeviceType(deviceType: BLEDeviceType): string {
  switch (deviceType) {
    case 'blood_pressure':
      return '00002A35-0000-1000-8000-00805f9b34fb';
    case 'glucose':
      return '00002A18-0000-1000-8000-00805f9b34fb';
    case 'pulse_oximeter':
      return '00002A5E-0000-1000-8000-00805f9b34fb';
    default:
      throw new Error(`Unknown device type: ${deviceType}`);
  }
}
