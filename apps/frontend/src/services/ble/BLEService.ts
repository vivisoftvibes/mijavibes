/**
 * BLE Service
 *
 * Core Bluetooth Low Energy service for medical device integration
 * Uses react-native-ble-plx for BLE operations
 */

import { BleManager, Device, Characteristic, Service, State } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BLEDevice,
  BLEDeviceType,
  BLEConnectionState,
  PairedBLEDevice,
  BLEScanOptions,
  BLEConnectionOptions,
  BLEMeasurement,
  BPReading,
  GlucoseReading,
  BLE_UUIDS,
  DEVICE_NAME_PATTERNS,
  MANUFACTURER_IDS,
  BLEError,
  BLEErrorCode,
  MeasurementValidationResult,
  BP_RANGE,
  GLUCOSE_RANGE,
} from '../../types/ble';

// Storage keys
const PAIRED_DEVICES_KEY = '@salud_aldia_paired_ble_devices';
const AUTO_CONNECT_ENABLED_KEY = '@salud_aldia_ble_auto_connect';

// Scan timeout in milliseconds
const DEFAULT_SCAN_TIMEOUT = 30000;
const CONNECTION_TIMEOUT = 15000;

// Event types
export type BLEServiceEventType =
  | 'stateChanged'
  | 'deviceDiscovered'
  | 'deviceConnected'
  | 'deviceDisconnected'
  | 'deviceReady'
  | 'measurementReceived'
  | 'scanComplete'
  | 'error';

export interface BLEServiceEvent {
  type: BLEServiceEventType;
  device?: BLEDevice;
  measurement?: BLEMeasurement;
  error?: BLEError;
  state?: State;
}

export type BLEEventListener = (event: BLEServiceEvent) => void;

/**
 * Main BLE Service class
 * Handles device discovery, connection, and data collection
 */
export class BLEService {
  private static instance: BLEService;

  private manager: BleManager;
  private isScanning: boolean = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private discoveredDevices: Map<string, BLEDevice> = new Map();
  private connectedDevices: Map<string, Device> = new Map();
  private pairedDevices: PairedBLEDevice[] = [];
  private listeners: Set<BLEEventListener> = new Set();
  private notificationListeners: Map<string, { unsubscribe: () => void }> = new Map();
  private autoConnectEnabled: boolean = true;

  private constructor() {
    this.manager = new BleManager();
    this.setupManagerListeners();
    this.loadPairedDevices();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BLEService {
    if (!BLEService.instance) {
      BLEService.instance = new BLEService();
    }
    return BLEService.instance;
  }

  /**
   * Setup manager event listeners
   */
  private setupManagerListeners(): void {
    this.manager.onStateChange((state) => {
      this.emit({ type: 'stateChanged', state });

      if (state === State.PoweredOn && this.autoConnectEnabled) {
        this.autoConnectPairedDevices();
      }
    }, true);
  }

  /**
   * Load paired devices from storage
   */
  private async loadPairedDevices(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PAIRED_DEVICES_KEY);
      if (stored) {
        const devices = JSON.parse(stored);
        this.pairedDevices = devices.map((d: PairedBLEDevice) => ({
          ...d,
          lastSync: d.lastSync ? new Date(d.lastSync) : undefined,
          pairedAt: new Date(d.pairedAt),
          lastConnectedAt: d.lastConnectedAt ? new Date(d.lastConnectedAt) : undefined,
          connectionState: 'disconnected',
        }));
      }

      const autoConnectSetting = await AsyncStorage.getItem(AUTO_CONNECT_ENABLED_KEY);
      this.autoConnectEnabled = autoConnectSetting !== 'false';
    } catch (error) {
      console.error('[BLEService] Failed to load paired devices:', error);
    }
  }

  /**
   * Save paired devices to storage
   */
  private async savePairedDevices(): Promise<void> {
    try {
      await AsyncStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(this.pairedDevices));
    } catch (error) {
      console.error('[BLEService] Failed to save paired devices:', error);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: BLEServiceEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[BLEService] Listener error:', error);
      }
    });
  }

  /**
   * Detect device type from name and services
   */
  private detectDeviceType(name: string, services: string[]): BLEDeviceType {
    for (const [type, patterns] of Object.entries(DEVICE_NAME_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(name)) {
          return type as BLEDeviceType;
        }
      }
    }

    // Check service UUIDs as fallback
    const serviceUuids = services.map((s) => s.toLowerCase());
    if (serviceUuids.includes(BLE_UUIDS.BLOOD_PRESSURE_SERVICE.toLowerCase())) {
      return 'blood_pressure';
    }
    if (serviceUuids.includes(BLE_UUIDS.GLUCOSE_SERVICE.toLowerCase())) {
      return 'glucose';
    }
    if (serviceUuids.includes(BLE_UUIDS.PULSE_OXIMETER_SERVICE.toLowerCase())) {
      return 'pulse_oximeter';
    }

    return 'blood_pressure'; // Default
  }

  /**
   * Convert RN device to BLE device
   */
  private convertToBLEDevice(device: Device): BLEDevice {
    const name = device.name || device.localName || 'Unknown Device';
    const type = this.detectDeviceType(name, device.serviceUUIDs || []);

    return {
      id: device.id,
      name,
      localName: device.localName,
      type,
      manufacturer: 'unknown',
      rssi: device.rssi || 0,
      connectionState: device.isConnected() ? 'connected' : 'disconnected',
      isPaired: this.isDevicePaired(device.id),
      services: device.serviceUUIDs || [],
    };
  }

  /**
   * Check if device is paired
   */
  private isDevicePaired(deviceId: string): boolean {
    return this.pairedDevices.some((d) => d.id === deviceId);
  }

  /**
   * Add event listener
   */
  public addListener(listener: BLEEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove all listeners
   */
  public removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Check if Bluetooth is enabled
   */
  public async isEnabled(): Promise<boolean> {
    const state = await this.manager.state();
    return state === State.PoweredOn;
  }

  /**
   * Get current Bluetooth state
   */
  public async getState(): Promise<State> {
    return this.manager.state();
  }

  /**
   * Request Bluetooth permissions (iOS)
   */
  public async requestPermissions(): Promise<boolean> {
    // Permissions are handled in the app, this is a placeholder
    // On iOS, permissions are requested when bleManager is created
    return true;
  }

  /**
   * Scan for BLE devices
   */
  public async scanDevices(options: BLEScanOptions = {}): Promise<BLEDevice[]> {
    const {
      timeout = DEFAULT_SCAN_TIMEOUT,
      allowDuplicates = false,
    } = options;

    if (this.isScanning) {
      throw new BLEError('scan_failed', 'Scan already in progress');
    }

    const state = await this.manager.state();
    if (state !== State.PoweredOn) {
      throw new BLEError('bluetooth_powered_off', 'Bluetooth is not powered on');
    }

    this.isScanning = true;
    this.discoveredDevices.clear();

    const discoveredDevices: BLEDevice[] = [];

    try {
      // Start scanning for all services
      await this.manager.startDeviceScan(
        null, // Scan for all services
        { allowDuplicates, scanningMode: 'lowLatency' as any },
        (error, device) => {
          if (error) {
            this.emit({
              type: 'error',
              error: new BLEError('scan_failed', error.message, undefined, error),
            });
            return;
          }

          if (device) {
            const bleDevice = this.convertToBLEDevice(device);
            this.discoveredDevices.set(device.id, bleDevice);
            discoveredDevices.push(bleDevice);
            this.emit({ type: 'deviceDiscovered', device: bleDevice });
          }
        }
      );

      // Set timeout to stop scanning
      this.scanTimer = setTimeout(() => {
        this.stopScan();
      }, timeout);

      // Wait for scan to complete
      return new Promise((resolve) => {
        const checkComplete = setInterval(() => {
          if (!this.isScanning) {
            clearInterval(checkComplete);
            resolve(Array.from(this.discoveredDevices.values()));
            this.emit({ type: 'scanComplete' });
          }
        }, 500);
      });
    } catch (error: any) {
      this.isScanning = false;
      throw new BLEError('scan_failed', error.message, undefined, error);
    }
  }

  /**
   * Stop scanning for devices
   */
  public async stopScan(): Promise<void> {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    if (this.isScanning) {
      this.isScanning = false;
      await this.manager.stopDeviceScan();
    }
  }

  /**
   * Connect to a device
   */
  public async connect(deviceId: string, options: BLEConnectionOptions = {}): Promise<boolean> {
    const { timeout = CONNECTION_TIMEOUT } = options;

    const device = await this.manager.devices([deviceId]);
    if (!device || device.length === 0) {
      throw new BLEError('device_not_found', `Device ${deviceId} not found`);
    }

    const bleDevice = this.discoveredDevices.get(deviceId) || this.convertToBLEDevice(device[0]);

    try {
      // Update connection state
      bleDevice.connectionState = 'connecting';
      this.emit({ type: 'stateChanged', device: bleDevice });

      // Connect with timeout
      const connectedDevice = await this.connectWithTimeout(device[0], timeout);

      // Store connected device
      this.connectedDevices.set(deviceId, connectedDevice);

      // Discover services
      await connectedDevice.discoverAllServicesAndCharacteristics();

      // Get device info
      await this.readDeviceInfo(connectedDevice);

      // Update connection state
      bleDevice.connectionState = 'connected';
      this.emit({ type: 'deviceConnected', device: bleDevice });
      this.emit({ type: 'deviceReady', device: bleDevice });

      // Add to paired devices if not already paired
      if (!this.isDevicePaired(deviceId)) {
        await this.pairDevice(deviceId);
      } else {
        // Update last connected time
        const pairedDevice = this.pairedDevices.find((d) => d.id === deviceId);
        if (pairedDevice) {
          pairedDevice.lastConnectedAt = new Date();
          pairedDevice.connectionCount++;
          await this.savePairedDevices();
        }
      }

      // Setup notifications based on device type
      await this.setupNotifications(connectedDevice, bleDevice.type);

      return true;
    } catch (error: any) {
      bleDevice.connectionState = 'disconnected';
      this.emit({
        type: 'error',
        error: new BLEError('connection_failed', error.message, deviceId, error),
      });
      throw error;
    }
  }

  /**
   * Connect with timeout
   */
  private connectWithTimeout(device: Device, timeout: number): Promise<Device> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      device
        .connect()
        .then((connectedDevice) => {
          clearTimeout(timer);
          resolve(connectedDevice);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Read device information
   */
  private async readDeviceInfo(device: Device): Promise<void> {
    try {
      const services = await device.services();
      const deviceInfoService = services.find(
        (s) => s.uuid.toLowerCase() === BLE_UUIDS.DEVICE_INFORMATION_SERVICE.toLowerCase()
      );

      if (deviceInfoService) {
        const characteristics = await deviceInfoService.characteristics();

        for (const characteristic of characteristics) {
          if (characteristic.isReadable) {
            try {
              const data = await characteristic.read();
              // Device info could be decoded here
            } catch {
              // Ignore read errors
            }
          }
        }
      }

      // Read battery level
      const batteryService = services.find(
        (s) => s.uuid.toLowerCase() === BLE_UUIDS.BATTERY_SERVICE.toLowerCase()
      );

      if (batteryService) {
        const characteristics = await batteryService.characteristics();
        const batteryLevelChar = characteristics.find(
          (c) => c.uuid.toLowerCase() === BLE_UUIDS.BATTERY_LEVEL.toLowerCase()
        );

        if (batteryLevelChar && batteryLevelChar.isReadable) {
          try {
            const data = await batteryLevelChar.read();
            // Battery level could be extracted here
          } catch {
            // Ignore read errors
          }
        }
      }
    } catch (error) {
      console.error('[BLEService] Error reading device info:', error);
    }
  }

  /**
   * Setup notifications for device measurements
   */
  private async setupNotifications(device: Device, deviceType: BLEDeviceType): Promise<void> {
    try {
      const services = await device.services();

      let serviceUuid: string;
      let characteristicUuid: string;

      switch (deviceType) {
        case 'blood_pressure':
          serviceUuid = BLE_UUIDS.BLOOD_PRESSURE_SERVICE;
          characteristicUuid = BLE_UUIDS.BLOOD_PRESSURE_MEASUREMENT;
          break;
        case 'glucose':
          serviceUuid = BLE_UUIDS.GLUCOSE_SERVICE;
          characteristicUuid = BLE_UUIDS.GLUCOSE_MEASUREMENT;
          break;
        case 'pulse_oximeter':
          serviceUuid = BLE_UUIDS.PULSE_OXIMETER_SERVICE;
          characteristicUuid = BLE_UUIDS.PULSE_OXIMETER_MEASUREMENT;
          break;
        default:
          return;
      }

      const service = services.find((s) => s.uuid.toLowerCase() === serviceUuid.toLowerCase());
      if (!service) {
        console.warn(`[BLEService] Service ${serviceUuid} not found`);
        return;
      }

      const characteristics = await service.characteristics();
      const characteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === characteristicUuid.toLowerCase()
      );

      if (!characteristic) {
        console.warn(`[BLEService] Characteristic ${characteristicUuid} not found`);
        return;
      }

      // Subscribe to notifications
      if (characteristic.isNotifiable || characteristic.isNotifying) {
        const monitor = characteristic.monitor((error, characteristic) => {
          if (error) {
            this.emit({
              type: 'error',
              error: new BLEError('notification_failed', error.message, device.id),
            });
            return;
          }

          if (characteristic?.value) {
            this.parseAndEmitMeasurement(device.id, deviceType, characteristic.value);
          }
        });

        if (monitor) {
          this.notificationListeners.set(`${device.id}_${characteristicUuid}`, monitor);
        }
      }
    } catch (error: any) {
      console.error('[BLEService] Error setting up notifications:', error);
    }
  }

  /**
   * Parse and emit measurement
   */
  private parseAndEmitMeasurement(deviceId: string, deviceType: BLEDeviceType, value: ArrayBuffer): void {
    try {
      const data = new DataView(value);

      let measurement: BLEMeasurement;

      switch (deviceType) {
        case 'blood_pressure':
          measurement = this.parseBloodPressure(data, deviceId);
          break;
        case 'glucose':
          measurement = this.parseGlucose(data, deviceId);
          break;
        default:
          return;
      }

      this.emit({ type: 'measurementReceived', measurement });
    } catch (error: any) {
      this.emit({
        type: 'error',
        error: new BLEError('parse_error', error.message, deviceId),
      });
    }
  }

  /**
   * Parse blood pressure measurement
   * Format: Bluetooth SIG Blood Pressure Measurement
   */
  private parseBloodPressure(data: DataView, deviceId: string): BPReading {
    let offset = 0;

    // Flags byte
    const flags = data.getUint8(offset);
    offset += 1;

    const unit = (flags & 0x01) === 0 ? 'mmHg' : 'kPa';
    const timeStampPresent = (flags & 0x02) !== 0;
    const pulseRatePresent = (flags & 0x04) !== 0;
    const userIdPresent = (flags & 0x08) !== 0;
    const measurementStatusPresent = (flags & 0x10) !== 0;

    // Systolic (float in unit of measurement)
    const systolic = data.getUint16(offset, true) / 10; // Convert to mmHg
    offset += 2;

    // Diastolic
    const diastolic = data.getUint16(offset, true) / 10;
    offset += 2;

    // Mean arterial pressure
    offset += 2;

    let pulse: number | undefined;
    if (pulseRatePresent) {
      pulse = data.getUint16(offset, true) / 10; // BPM
      offset += 2;
    }

    let measurementId: string | undefined;
    if (userIdPresent) {
      measurementId = data.getUint8(offset).toString();
      offset += 1;
    }

    let irregularPulse = false;
    let movementDetected = false;
    if (measurementStatusPresent) {
      const status = data.getUint16(offset, true);
      irregularPulse = (status & 0x01) !== 0;
      movementDetected = (status & 0x02) !== 0;
    }

    return {
      systolic,
      diastolic,
      pulse,
      timestamp: new Date(),
      deviceId,
      measurementId,
      movementDetected,
      irregularPulse,
    };
  }

  /**
   * Parse glucose measurement
   * Format: Bluetooth SIG Glucose Measurement
   */
  private parseGlucose(data: DataView, deviceId: string): GlucoseReading {
    let offset = 0;

    // Flags
    const flags = data.getUint8(offset);
    offset += 1;

    const timeOffsetPresent = (flags & 0x01) !== 0;
    const typeAndLocationPresent = (flags & 0x02) !== 0;
    const concentrationUnitsKgMl = (flags & 0x04) === 0; // false = kg/L, true = mol/L

    // Sequence number
    const sequenceNumber = data.getUint16(offset, true);
    offset += 2;

    // Base time (year, month, day, hour, minute, second)
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

    // Time offset
    if (timeOffsetPresent) {
      offset += 2;
    }

    // Glucose concentration
    let value: number;
    if (concentrationUnitsKgMl) {
      // kg/L: value is in kg/L, convert to mg/dL
      // 1 kg/L = 100000 mg/dL for glucose
      value = data.getFloat16(offset, true) * 100000;
    } else {
      // mol/L: value is in mol/L, convert to mg/dL
      // 1 mol/L glucose = 18015.6 mg/dL
      value = data.getSFloat16(offset, true) * 18015.6;
    }
    offset += 2;

    // Type and location
    let mealContext: GlucoseReading['mealContext'];
    if (typeAndLocationPresent) {
      const sampleLocation = data.getUint8(offset) & 0x0F;
      const type = (data.getUint8(offset) & 0xF0) >> 4;
      offset += 1;

      // Type: 1=fasting, 2=before meal, 3=after meal
      if (type === 1) mealContext = 'fasting';
      else if (type === 2) mealContext = 'before_meal';
      else if (type === 3) mealContext = 'after_meal';
    }

    return {
      value: Math.round(value),
      timestamp,
      deviceId,
      measurementId: sequenceNumber.toString(),
      mealContext,
    };
  }

  /**
   * Validate blood pressure reading
   */
  public validateBP(reading: BPReading): MeasurementValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (reading.systolic < BP_RANGE.systolic.min || reading.systolic > BP_RANGE.systolic.max) {
      errors.push(
        `Systolic must be between ${BP_RANGE.systolic.min} and ${BP_RANGE.systolic.max} mmHg`
      );
    }

    if (reading.diastolic < BP_RANGE.diastolic.min || reading.diastolic > BP_RANGE.diastolic.max) {
      errors.push(
        `Diastolic must be between ${BP_RANGE.diastolic.min} and ${BP_RANGE.diastolic.max} mmHg`
      );
    }

    if (reading.diastolic >= reading.systolic) {
      errors.push('Diastolic must be less than systolic');
    }

    if (reading.pulse) {
      if (reading.pulse < BP_RANGE.pulse.min || reading.pulse > BP_RANGE.pulse.max) {
        warnings.push(`Pulse rate outside normal range (${BP_RANGE.pulse.min}-${BP_RANGE.pulse.max} BPM)`);
      }
    }

    if (reading.movementDetected) {
      warnings.push('Movement detected during measurement - may affect accuracy');
    }

    if (reading.irregularPulse) {
      warnings.push('Irregular pulse detected - consult healthcare provider');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate glucose reading
   */
  public validateGlucose(reading: GlucoseReading): MeasurementValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (reading.value < GLUCOSE_RANGE.min || reading.value > GLUCOSE_RANGE.max) {
      errors.push(
        `Glucose must be between ${GLUCOSE_RANGE.min} and ${GLUCOSE_RANGE.max} mg/dL`
      );
    }

    // Add warnings for abnormal readings
    if (reading.value < 70) {
      warnings.push('Low glucose detected - may indicate hypoglycemia');
    } else if (reading.value > 180 && reading.mealContext !== 'after_meal') {
      warnings.push('High glucose detected - may indicate hyperglycemia');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Disconnect from a device
   */
  public async disconnect(deviceId: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      return;
    }

    // Cancel all notifications for this device
    for (const [key, listener] of this.notificationListeners.entries()) {
      if (key.startsWith(deviceId)) {
        listener.unsubscribe();
        this.notificationListeners.delete(key);
      }
    }

    try {
      await device.cancelConnection();
    } catch (error) {
      console.error('[BLEService] Error disconnecting:', error);
    }

    this.connectedDevices.delete(deviceId);

    const bleDevice = this.pairedDevices.find((d) => d.id === deviceId);
    if (bleDevice) {
      bleDevice.connectionState = 'disconnected';
    }

    this.emit({
      type: 'deviceDisconnected',
      device: bleDevice || this.convertToBLEDevice(device),
    });
  }

  /**
   * Disconnect all devices
   */
  public async disconnectAll(): Promise<void> {
    const deviceIds = Array.from(this.connectedDevices.keys());
    await Promise.all(deviceIds.map((id) => this.disconnect(id)));
  }

  /**
   * Pair a device
   */
  private async pairDevice(deviceId: string): Promise<void> {
    const device = this.discoveredDevices.get(deviceId);
    if (!device) {
      return;
    }

    const pairedDevice: PairedBLEDevice = {
      ...device,
      isPaired: true,
      pairedAt: new Date(),
      lastConnectedAt: new Date(),
      connectionCount: 1,
      autoConnect: true,
    };

    this.pairedDevices.push(pairedDevice);
    await this.savePairedDevices();
  }

  /**
   * Forget a paired device
   */
  public async forgetDevice(deviceId: string): Promise<void> {
    // Disconnect if connected
    if (this.connectedDevices.has(deviceId)) {
      await this.disconnect(deviceId);
    }

    // Remove from paired devices
    this.pairedDevices = this.pairedDevices.filter((d) => d.id !== deviceId);
    await this.savePairedDevices();
  }

  /**
   * Get all paired devices
   */
  public getPairedDevices(): PairedBLEDevice[] {
    return [...this.pairedDevices];
  }

  /**
   * Get connected devices
   */
  public getConnectedDevices(): BLEDevice[] {
    return Array.from(this.connectedDevices.values()).map((d) => this.convertToBLEDevice(d));
  }

  /**
   * Check if device is connected
   */
  public isDeviceConnected(deviceId: string): boolean {
    return this.connectedDevices.has(deviceId);
  }

  /**
   * Auto-connect to paired devices
   */
  private async autoConnectPairedDevices(): Promise<void> {
    if (!this.autoConnectEnabled) {
      return;
    }

    const devicesToConnect = this.pairedDevices
      .filter((d) => d.autoConnect && d.connectionState !== 'connected')
      .slice(0, 3); // Limit to 3 simultaneous connections

    for (const device of devicesToConnect) {
      try {
        await this.connect(device.id, { timeout: 10000 });
      } catch (error) {
        console.error(`[BLEService] Failed to auto-connect to ${device.name}:`, error);
      }
    }
  }

  /**
   * Set auto-connect enabled
   */
  public async setAutoConnect(enabled: boolean): Promise<void> {
    this.autoConnectEnabled = enabled;
    await AsyncStorage.setItem(AUTO_CONNECT_ENABLED_KEY, enabled.toString());

    if (enabled) {
      const state = await this.manager.state();
      if (state === State.PoweredOn) {
        await this.autoConnectPairedDevices();
      }
    }
  }

  /**
   * Update device auto-connect setting
   */
  public async setDeviceAutoConnect(deviceId: string, enabled: boolean): Promise<void> {
    const device = this.pairedDevices.find((d) => d.id === deviceId);
    if (device) {
      device.autoConnect = enabled;
      await this.savePairedDevices();
    }
  }

  /**
   * Destroy service and cleanup
   */
  public async destroy(): Promise<void> {
    await this.disconnectAll();
    await this.stopScan();
    this.removeAllListeners();
    await this.manager.destroy();
  }
}

// Export singleton instance getter
export const getBLEService = (): BLEService => BLEService.getInstance();
