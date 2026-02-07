/**
 * BLE Store
 *
 * Zustand store for BLE device management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BLEDevice,
  PairedBLEDevice,
  BLEDeviceType,
  BLEConnectionState,
  BLEMeasurement,
  BPReading,
  GlucoseReading,
  BLEError,
} from '../types/ble';
import { getBLEService, BLEServiceEvent } from '../services/ble';

interface BLEState {
  // State
  bluetoothEnabled: boolean | null;
  isScanning: boolean;
  discoveredDevices: BLEDevice[];
  pairedDevices: PairedBLEDevice[];
  connectedDevices: BLEDevice[];
  currentMeasurement: BLEMeasurement | null;
  lastError: BLEError | null;
  autoConnectEnabled: boolean;

  // Actions
  initializeBLE: () => Promise<void>;
  checkBluetoothStatus: () => Promise<boolean>;
  startScanning: (timeout?: number) => Promise<void>;
  stopScanning: () => Promise<void>;
  connectDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  forgetDevice: (deviceId: string) => Promise<void>;
  setAutoConnect: (enabled: boolean) => Promise<void>;
  setDeviceAutoConnect: (deviceId: string, enabled: boolean) => Promise<void>;
  clearLastError: () => void;
  reset: () => void;
}

export const useBLEStore = create<BLEState>()(
  persist(
    (set, get) => ({
      // Initial state
      bluetoothEnabled: null,
      isScanning: false,
      discoveredDevices: [],
      pairedDevices: [],
      connectedDevices: [],
      currentMeasurement: null,
      lastError: null,
      autoConnectEnabled: true,

      /**
       * Initialize BLE service and setup listeners
       */
      initializeBLE: async () => {
        const bleService = getBLEService();

        // Setup event listeners
        bleService.addListener((event: BLEServiceEvent) => {
          const state = get();

          switch (event.type) {
            case 'stateChanged':
              if (event.state !== undefined) {
                set({ bluetoothEnabled: event.state === 'PoweredOn' });
              }
              if (event.device) {
                // Update device connection state
                set((prev) => ({
                  discoveredDevices: prev.discoveredDevices.map((d) =>
                    d.id === event.device!.id ? event.device! : d
                  ),
                  connectedDevices: event.device!.connectionState === 'connected'
                    ? [...prev.connectedDevices.filter((d) => d.id !== event.device!.id), event.device!]
                    : prev.connectedDevices.filter((d) => d.id !== event.device!.id),
                }));
              }
              break;

            case 'deviceDiscovered':
              if (event.device) {
                set((prev) => {
                  const exists = prev.discoveredDevices.some((d) => d.id === event.device!.id);
                  if (exists) {
                    return {
                      discoveredDevices: prev.discoveredDevices.map((d) =>
                        d.id === event.device!.id ? event.device! : d
                      ),
                    };
                  }
                  return {
                    discoveredDevices: [...prev.discoveredDevices, event.device!],
                  };
                });
              }
              break;

            case 'deviceConnected':
              if (event.device) {
                set((prev) => {
                  const paired = prev.pairedDevices.map((d) =>
                    d.id === event.device!.id
                      ? { ...d, connectionState: 'connected' as BLEConnectionState, lastConnectedAt: new Date() }
                      : d
                  );
                  return {
                    connectedDevices: [...prev.connectedDevices.filter((d) => d.id !== event.device!.id), event.device!],
                    pairedDevices: paired,
                  };
                });
              }
              break;

            case 'deviceDisconnected':
              if (event.device) {
                set((prev) => ({
                  connectedDevices: prev.connectedDevices.filter((d) => d.id !== event.device!.id),
                  pairedDevices: prev.pairedDevices.map((d) =>
                    d.id === event.device!.id
                      ? { ...d, connectionState: 'disconnected' as BLEConnectionState }
                      : d
                  ),
                }));
              }
              break;

            case 'measurementReceived':
              if (event.measurement) {
                set({ currentMeasurement: event.measurement });
              }
              break;

            case 'scanComplete':
              set({ isScanning: false });
              break;

            case 'error':
              if (event.error) {
                set({ lastError: event.error });
              }
              break;
          }
        });

        // Check initial Bluetooth status
        const isEnabled = await bleService.isEnabled();
        set({ bluetoothEnabled: isEnabled });

        // Load paired devices
        const pairedDevices = bleService.getPairedDevices();
        set({ pairedDevices });
      },

      /**
       * Check Bluetooth status
       */
      checkBluetoothStatus: async () => {
        const bleService = getBLEService();
        const isEnabled = await bleService.isEnabled();
        set({ bluetoothEnabled: isEnabled });
        return isEnabled;
      },

      /**
       * Start scanning for BLE devices
       */
      startScanning: async (timeout = 30000) => {
        const bleService = getBLEService();

        set({ isScanning: true, discoveredDevices: [], lastError: null });

        try {
          const devices = await bleService.scanDevices({ timeout });
          set({ discoveredDevices: devices, isScanning: false });
        } catch (error: any) {
          set({
            isScanning: false,
            lastError: error instanceof BLEError ? error : new BLEError('scan_failed', error.message),
          });
          throw error;
        }
      },

      /**
       * Stop scanning for devices
       */
      stopScanning: async () => {
        const bleService = getBLEService();
        await bleService.stopScan();
        set({ isScanning: false });
      },

      /**
       * Connect to a device
       */
      connectDevice: async (deviceId: string) => {
        const bleService = getBLEService();

        set({ lastError: null });

        // Update device state to connecting
        set((prev) => ({
          discoveredDevices: prev.discoveredDevices.map((d) =>
            d.id === deviceId ? { ...d, connectionState: 'connecting' } : d
          ),
          pairedDevices: prev.pairedDevices.map((d) =>
            d.id === deviceId ? { ...d, connectionState: 'connecting' } : d
          ),
        }));

        try {
          const connected = await bleService.connect(deviceId, { timeout: 15000 });

          if (connected) {
            // Refresh paired devices list
            const pairedDevices = bleService.getPairedDevices();
            const connectedDevices = bleService.getConnectedDevices();

            set({
              pairedDevices,
              connectedDevices,
              discoveredDevices: get().discoveredDevices.map((d) =>
                d.id === deviceId ? { ...d, connectionState: 'connected', isPaired: true } : d
              ),
            });
          }

          return connected;
        } catch (error: any) {
          const bleError = error instanceof BLEError
            ? error
            : new BLEError('connection_failed', error.message, deviceId);

          set({
            lastError: bleError,
            discoveredDevices: get().discoveredDevices.map((d) =>
              d.id === deviceId ? { ...d, connectionState: 'disconnected' } : d
            ),
          });

          throw bleError;
        }
      },

      /**
       * Disconnect from a device
       */
      disconnectDevice: async (deviceId: string) => {
        const bleService = getBLEService();
        await bleService.disconnect(deviceId);

        set((prev) => ({
          connectedDevices: prev.connectedDevices.filter((d) => d.id !== deviceId),
          pairedDevices: prev.pairedDevices.map((d) =>
            d.id === deviceId ? { ...d, connectionState: 'disconnected' } : d
          ),
        }));
      },

      /**
       * Forget a paired device
       */
      forgetDevice: async (deviceId: string) => {
        const bleService = getBLEService();
        await bleService.forgetDevice(deviceId);

        set((prev) => ({
          pairedDevices: prev.pairedDevices.filter((d) => d.id !== deviceId),
          connectedDevices: prev.connectedDevices.filter((d) => d.id !== deviceId),
          discoveredDevices: prev.discoveredDevices.filter((d) => d.id !== deviceId),
        }));
      },

      /**
       * Set auto-connect enabled
       */
      setAutoConnect: async (enabled: boolean) => {
        const bleService = getBLEService();
        await bleService.setAutoConnect(enabled);
        set({ autoConnectEnabled: enabled });
      },

      /**
       * Set device auto-connect setting
       */
      setDeviceAutoConnect: async (deviceId: string, enabled: boolean) => {
        const bleService = getBLEService();
        await bleService.setDeviceAutoConnect(deviceId, enabled);

        set((prev) => ({
          pairedDevices: prev.pairedDevices.map((d) =>
            d.id === deviceId ? { ...d, autoConnect: enabled } : d
          ),
        }));
      },

      /**
       * Clear last error
       */
      clearLastError: () => {
        set({ lastError: null });
      },

      /**
       * Reset store to initial state
       */
      reset: () => {
        set({
          bluetoothEnabled: null,
          isScanning: false,
          discoveredDevices: [],
          pairedDevices: [],
          connectedDevices: [],
          currentMeasurement: null,
          lastError: null,
          autoConnectEnabled: true,
        });
      },
    }),
    {
      name: '@salud_aldia_ble_store',
      partialize: (state) => ({
        pairedDevices: state.pairedDevices,
        autoConnectEnabled: state.autoConnectEnabled,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get devices by type
 */
export const useDevicesByType = (type: BLEDeviceType) =>
  useBLEStore((state) => state.pairedDevices.filter((d) => d.type === type));

/**
 * Get connected devices by type
 */
export const useConnectedDevicesByType = (type: BLEDeviceType) =>
  useBLEStore((state) =>
    state.connectedDevices.filter((d) => d.type === type && d.connectionState === 'connected')
  );

/**
 * Get blood pressure devices
 */
export const useBPDevices = () => useDevicesByType('blood_pressure');

/**
 * Get glucose devices
 */
export const useGlucoseDevices = () => useDevicesByType('glucose');

/**
 * Check if any device is connected
 */
export const useIsAnyDeviceConnected = () =>
  useBLEStore((state) => state.connectedDevices.length > 0);
