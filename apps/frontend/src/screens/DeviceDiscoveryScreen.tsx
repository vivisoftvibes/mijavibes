/**
 * Device Discovery Screen
 *
 * BLE-001: Scan and discover BLE devices
 * BLE-002: Pair devices with the app
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useBLEStore } from '../store/useBLEStore';
import { BLEDevice, BLEDeviceType } from '../types/ble';

type DiscoveryScreenRouteProp = RouteProp<
  { DeviceDiscovery: { deviceType?: BLEDeviceType } },
  'DeviceDiscovery'
>;

export const DeviceDiscoveryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<DiscoveryScreenRouteProp>();
  const { deviceType: filterType } = route.params || {};

  const {
    bluetoothEnabled,
    isScanning,
    discoveredDevices,
    pairedDevices,
    lastError,
    startScanning,
    stopScanning,
    connectDevice,
    clearLastError,
    checkBluetoothStatus,
  } = useBLEStore();

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    // Check Bluetooth status on mount
    checkBluetoothStatus();
  }, []);

  useEffect(() => {
    // Auto-start scan if Bluetooth is enabled
    if (bluetoothEnabled === true && !isScanning && discoveredDevices.length === 0) {
      handleStartScan();
    }

    // Handle Bluetooth disabled
    if (bluetoothEnabled === false) {
      Alert.alert(
        'Bluetooth Disabled',
        'Please enable Bluetooth to scan for medical devices.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
          { text: 'Settings', onPress: () => {/* Open device settings */} },
        ]
      );
    }
  }, [bluetoothEnabled]);

  useEffect(() => {
    // Update scan progress
    if (isScanning) {
      const interval = setInterval(() => {
        setScanProgress((prev) => (prev >= 100 ? 0 : prev + 3.33));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setScanProgress(0);
    }
  }, [isScanning]);

  // Filter discovered devices by type if specified
  const filteredDevices = filterType
    ? discoveredDevices.filter((d) => d.type === filterType)
    : discoveredDevices;

  const isPaired = (deviceId: string): boolean => {
    return pairedDevices.some((d) => d.id === deviceId);
  };

  const handleStartScan = async () => {
    try {
      clearLastError();
      await startScanning(30000);
    } catch (error: any) {
      Alert.alert('Scan Failed', error.message || 'Failed to start scanning');
    }
  };

  const handleStopScan = async () => {
    await stopScanning();
  };

  const handleConnectDevice = async (device: BLEDevice) => {
    setConnectingId(device.id);

    try {
      clearLastError();
      const connected = await connectDevice(device.id);

      if (connected) {
        Alert.alert(
          'Device Connected',
          `${device.name} has been connected successfully.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Connection Failed',
        error.message || 'Failed to connect to device. Please try again.',
        [
          { text: 'Retry', onPress: () => handleConnectDevice(device) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setConnectingId(null);
    }
  };

  const getDeviceIcon = (type: BLEDeviceType): string => {
    switch (type) {
      case 'blood_pressure':
        return '🩺';
      case 'glucose':
        return '🩸';
      case 'pulse_oximeter':
        return '🫁';
      case 'scale':
        return '⚖️';
      default:
        return '📱';
    }
  };

  const getSignalStrengthBars = (rssi: number): number => {
    if (rssi >= -60) return 4;
    if (rssi >= -70) return 3;
    if (rssi >= -80) return 2;
    return 1;
  };

  const getDeviceTypeName = (type: BLEDeviceType): string => {
    switch (type) {
      case 'blood_pressure':
        return 'Blood Pressure Monitor';
      case 'glucose':
        return 'Glucose Meter';
      case 'pulse_oximeter':
        return 'Pulse Oximeter';
      case 'scale':
        return 'Smart Scale';
      default:
        return 'Medical Device';
    }
  };

  if (bluetoothEnabled === null) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.statusText}>Checking Bluetooth status...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find Devices</Text>
        <Text style={styles.headerSubtitle}>
          {filterType
            ? `Looking for ${getDeviceTypeName(filterType)}`
            : 'Looking for nearby medical devices'}
        </Text>
      </View>

      {/* Scan Status */}
      <View style={styles.scanStatusContainer}>
        {isScanning ? (
          <View style={styles.scanningStatus}>
            <View style={styles.scanProgress}>
              <ActivityIndicator size="small" color="#4F46E5" />
              <Text style={styles.scanningText}>
                Scanning... {Math.round(scanProgress)}%
              </Text>
            </View>
            <TouchableOpacity style={styles.stopButton} onPress={handleStopScan}>
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.scanButton} onPress={handleStartScan}>
            <Text style={styles.scanButtonText}>Start Scan</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Error Display */}
      {lastError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorMessage}>{lastError.message}</Text>
          <TouchableOpacity onPress={clearLastError}>
            <Text style={styles.dismissButton}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Devices List */}
      <ScrollView style={styles.devicesList} contentContainerStyle={styles.devicesListContent}>
        {filteredDevices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>
              {isScanning ? 'Scanning for devices...' : 'No devices found'}
            </Text>
            <Text style={styles.emptyText}>
              {isScanning
                ? 'Make sure your device is powered on and in pairing mode.'
                : 'Tap "Start Scan" to search for nearby medical devices.'}
            </Text>
          </View>
        ) : (
          filteredDevices.map((device) => {
            const signalBars = getSignalStrengthBars(device.rssi);
            const paired = isPaired(device.id);
            const connecting = connectingId === device.id;

            return (
              <TouchableOpacity
                key={device.id}
                style={[
                  styles.deviceCard,
                  paired && styles.deviceCardPaired,
                  connecting && styles.deviceCardConnecting,
                ]}
                onPress={() => !paired && !connecting && handleConnectDevice(device)}
                disabled={paired || connecting}
              >
                <View style={styles.deviceIconContainer}>
                  <Text style={styles.deviceIcon}>{getDeviceIcon(device.type)}</Text>
                </View>

                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName} numberOfLines={1}>
                    {device.name}
                  </Text>
                  <Text style={styles.deviceType}>{getDeviceTypeName(device.type)}</Text>

                  {/* Signal Strength */}
                  <View style={styles.signalContainer}>
                    <Text style={styles.signalLabel}>Signal:</Text>
                    {[1, 2, 3, 4].map((bar) => (
                      <View
                        key={bar}
                        style={[
                          styles.signalBar,
                          bar <= signalBars ? styles.signalBarActive : styles.signalBarInactive,
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.deviceStatus}>
                  {paired ? (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>Paired</Text>
                    </View>
                  ) : connecting ? (
                    <View style={styles.statusBadge}>
                      <ActivityIndicator size="small" color="#4F46E5" />
                    </View>
                  ) : (
                    <View style={styles.connectBadge}>
                      <Text style={styles.connectBadgeText}>Connect</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Hint */}
        {filterType && (
          <View style={styles.hintContainer}>
            <Text style={styles.hintIcon}>💡</Text>
            <Text style={styles.hintText}>
              Tip: Put your device in pairing mode by holding the power button for 3-5 seconds.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: 'white',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  scanStatusContainer: {
    padding: 16,
  },
  scanningStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
  },
  scanProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanningText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  stopButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
  },
  stopButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  scanButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: '#991B1B',
  },
  dismissButton: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 8,
  },
  devicesList: {
    flex: 1,
  },
  devicesListContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceCardPaired: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1,
  },
  deviceCardConnecting: {
    opacity: 0.7,
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceIcon: {
    fontSize: 24,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  deviceType: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginRight: 4,
  },
  signalBar: {
    width: 3,
    height: 4,
    marginRight: 1,
    borderRadius: 2,
  },
  signalBarActive: {
    backgroundColor: '#10B981',
  },
  signalBarInactive: {
    backgroundColor: '#E5E7EB',
  },
  deviceStatus: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  connectBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 20,
  },
  connectBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  hintContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  hintIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
});
