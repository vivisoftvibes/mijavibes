# SPEC-002: IoT Device Integration Module

**Parent:** SPEC-001
**Module:** Bluetooth Low Energy (BLE) Device Integration
**Version:** 1.0.0
**Date:** 2026-02-07

---

## 1. Overview

This module handles integration with Bluetooth-enabled medical devices for automatic vital sign recording. It supports blood pressure monitors and glucose meters that are commonly used by chronic patients.

---

## 2. Supported Device Categories

| Device Type | Examples | Data Collected |
|-------------|----------|----------------|
| Blood Pressure Monitor | Omron M3, Withings BPM, iHealth | Systolic, Diastolic, Pulse, Timestamp |
| Glucose Meter | Accu-Chek, OneTouch, Freestyle Libre | Glucose level, Timestamp, Meal context |
| Pulse Oximeter | Nonin, Masimo | SpO2, Pulse Rate |
| Smart Scale | Withings Body+, Garmin Index | Weight, Body fat %, BMI |

---

## 3. Technical Requirements

### 3.1 BLE Specifications

```typescript
interface BLEDevice {
  id: string;
  name: string;
  type: 'blood_pressure' | 'glucose' | 'pulse_oximeter' | 'scale';
  rssi: number;
  connected: boolean;
  lastSync?: Date;
}

interface BPReading {
  systolic: number;
  diastolic: number;
  pulse?: number;
  timestamp: Date;
  deviceId: string;
}

interface GlucoseReading {
  value: number; // mg/dL
  timestamp: Date;
  deviceId: string;
  mealContext?: 'fasting' | 'before_meal' | 'after_meal';
}
```

### 3.2 Supported Services & Characteristics

| Device Type | Service UUID | Characteristic UUID | Properties |
|-------------|--------------|---------------------|------------|
| Blood Pressure | 0x1810 | 0x2A35 | Read, Notify |
| Glucose Meter | 0x1808 | 0x2A18 | Read, Notify |
| Pulse Oximeter | 0x1822 | 0x2A5E | Read, Notify |

---

## 4. User Stories (EARS Format)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| BLE-001 | WHEN user opens device discovery, THE SYSTEM SHALL scan for BLE devices for 30 seconds | - Shows list of discovered devices<br>- Shows signal strength for each device<br>- Filters supported device types |
| BLE-002 | WHEN user selects a device, THE SYSTEM SHALL attempt pairing | - Shows pairing animation<br>- Shows success/error message<br>- Saves pairing information |
| BLE-003 | WHEN device is paired, THE SYSTEM SHALL auto-connect on app launch | - Connection established within 5 seconds<br>- Shows connection status in UI<br>- Falls back to manual if connection fails |
| BLE-004 | WHEN user takes measurement, THE SYSTEM SHALL auto-capture data | - Data received within 10 seconds<br>- Validates data range<br>- Saves measurement to database |
| BLE-005 | WHEN device disconnects unexpectedly, THE SYSTEM SHALL notify user | - Clear error message<br>- Suggest troubleshooting steps<br>- Option to reconnect |

---

## 5. Implementation Architecture

```typescript
// BLE Service Structure
class BLEService {
  // Device Discovery
  async scanDevices(timeout: number): Promise<BLEDevice[]>

  // Connection Management
  async connect(deviceId: string): Promise<boolean>
  async disconnect(deviceId: string): Promise<void>
  isConnected(deviceId: string): boolean

  // Data Collection
  async startNotifications(deviceId: string, callback: (data: any) => void): Promise<void>
  stopNotifications(deviceId: string): Promise<void>

  // Paired Devices
  getPairedDevices(): BLEDevice[]
  forgetDevice(deviceId: string): Promise<void>

  // Device-specific parsers
  parseBloodPressure(data: DataView): BPReading
  parseGlucose(data: DataView): GlucoseReading
}

// Device Adapter Pattern
interface DeviceAdapter {
  connect(): Promise<void>
  readMeasurement(): Promise<Measurement>
  disconnect(): Promise<void>
}

class OmronBPAdapter implements DeviceAdapter { /* ... */ }
class WithingsBPMAdapter implements DeviceAdapter { /* ... */ }
class AccuChekAdapter implements DeviceAdapter { /* ... */ }
```

---

## 6. Error Handling

| Error Type | Recovery Action |
|------------|-----------------|
| Device not found | Rescan, show help |
| Pairing failed | Retry, show compatibility note |
| Connection timeout | Retry 3x, then suggest manual entry |
| Data invalid | Show error, allow manual correction |
| Bluetooth disabled | Prompt to enable Bluetooth |

---

## 7. Testing Strategy

- Device compatibility matrix testing
- Connection stability testing
- Data accuracy validation
- Background scanning behavior
- Battery impact analysis

---

**Dependencies:** SPEC-001 (Core App)
**Related:** SPEC-003 (Emergency Alerts)
