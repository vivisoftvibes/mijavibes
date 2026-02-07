/**
 * BLE Service Module
 *
 * Exports all BLE-related services and utilities
 */

export { BLEService, getBLEService } from './BLEService';
export type { BLEServiceEventListener, BLEServiceEvent } from './BLEService';

export {
  OmronBPAdapter,
  WithingsBPAdapter,
  AccuChekAdapter,
  createDeviceAdapter,
  getServiceUUIDForDeviceType,
  getCharacteristicUUIDForDeviceType,
} from './DeviceAdapters';
export type { DeviceAdapter } from './DeviceAdapters';
