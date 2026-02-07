/**
 * Device List Screen
 *
 * BLE-005: Manage paired BLE devices
 * BLE-003: Configure auto-connect settings
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Switch,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBLEStore, useBPDevices, useGlucoseDevices } from '../store/useBLEStore';
import { PairedBLEDevice, BLEDeviceType } from '../types/ble';

export const DeviceListScreen: React.FC = () => {
  const navigation = useNavigation();

  const {
    connectedDevices,
    bluetoothEnabled,
    autoConnectEnabled,
    disconnectDevice,
    forgetDevice,
    setAutoConnect,
    setDeviceAutoConnect,
    checkBluetoothStatus,
  } = useBLEStore();

  const bpDevices = useBPDevices();
  const glucoseDevices = useGlucoseDevices();

  const [selectedDevice, setSelectedDevice] = useState<PairedBLEDevice | null>(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  useEffect(() => {
    checkBluetoothStatus();
  }, []);

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

  const getConnectionStatus = (device: PairedBLEDevice): string => {
    const isConnected = connectedDevices.some((d) => d.id === device.id);
    if (isConnected) return 'Connected';
    if (device.connectionState === 'connecting') return 'Connecting...';
    return 'Disconnected';
  };

  const handleDisconnect = async (deviceId: string) => {
    Alert.alert(
      'Disconnect Device',
      'Are you sure you want to disconnect this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectDevice(deviceId);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to disconnect device');
            }
          },
        },
      ]
    );
  };

  const handleForget = async (device: PairedBLEDevice) => {
    Alert.alert(
      'Forget Device',
      `Are you sure you want to forget "${device.name}"? You'll need to pair it again to use it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            try {
              await forgetDevice(device.id);
              setShowDeviceModal(false);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to forget device');
            }
          },
        },
      ]
    );
  };

  const handleConnectToNew = (type?: BLEDeviceType) => {
    setShowDeviceModal(false);
    navigation.navigate('DeviceDiscovery' as never, { deviceType: type } as never);
  };

  const showDeviceOptions = (device: PairedBLEDevice) => {
    setSelectedDevice(device);
    setShowDeviceModal(true);
  };

  const renderDeviceCard = (device: PairedBLEDevice) => {
    const isConnected = connectedDevices.some((d) => d.id === device.id);
    const status = getConnectionStatus(device);

    return (
      <TouchableOpacity
        key={device.id}
        style={[styles.deviceCard, isConnected && styles.deviceCardConnected]}
        onPress={() => showDeviceOptions(device)}
      >
        <View style={styles.deviceIconContainer}>
          <Text style={styles.deviceIcon}>{getDeviceIcon(device.type)}</Text>
        </View>

        <View style={styles.deviceInfo}>
          <View style={styles.deviceNameRow}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {device.name}
            </Text>
            <View
              style={[
                styles.statusIndicator,
                isConnected ? styles.statusConnected : styles.statusDisconnected,
              ]}
            />
          </View>

          <Text style={styles.deviceType}>{getDeviceTypeName(device.type)}</Text>

          <View style={styles.deviceMeta}>
            <Text style={styles.metaText}>{status}</Text>
            {device.lastSync && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.metaText}>
                  Last sync: {new Date(device.lastSync).toLocaleDateString()}
                </Text>
              </>
            )}
          </View>

          {device.batteryLevel !== undefined && (
            <View style={styles.batteryContainer}>
              <Text style={styles.batteryText}>Battery: {device.batteryLevel}%</Text>
            </View>
          )}
        </View>

        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (type: 'blood_pressure' | 'glucose') => {
    const title = type === 'blood_pressure' ? 'Blood Pressure Monitors' : 'Glucose Meters';
    const icon = type === 'blood_pressure' ? '🩺' : '🩸';

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>{icon}</Text>
        <Text style={styles.emptyTitle}>No {title.toLowerCase()}</Text>
        <Text style={styles.emptyText}>
          Pair your {title.toLowerCase()} to automatically record measurements
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleConnectToNew(type)}
        >
          <Text style={styles.addButtonText}>Add {title}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Devices</Text>
        <Text style={styles.headerSubtitle}>
          Manage your connected medical devices
        </Text>
      </View>

      {/* Global Settings */}
      <View style={styles.settingsSection}>
        <View style={styles.settingCard}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Auto-connect</Text>
            <Text style={styles.settingDescription}>
              Automatically connect to paired devices when app opens
            </Text>
          </View>
          <Switch
            value={autoConnectEnabled}
            onValueChange={(value) => setAutoConnect(value)}
            trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
            thumbColor={autoConnectEnabled ? '#4F46E5' : '#F3F4F6'}
          />
        </View>

        {!bluetoothEnabled && (
          <View style={styles.bluetoothWarning}>
            <Text style={styles.bluetoothWarningIcon}>⚠️</Text>
            <View style={styles.bluetoothWarningText}>
              <Text style={styles.bluetoothWarningTitle}>Bluetooth is off</Text>
              <Text style={styles.bluetoothWarningDesc}>
                Enable Bluetooth to connect your devices
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Devices List */}
      <ScrollView
        style={styles.devicesList}
        contentContainerStyle={styles.devicesListContent}
      >
        {/* Blood Pressure Devices */}
        <View style={styles.deviceSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Blood Pressure Monitors</Text>
            <TouchableOpacity onPress={() => handleConnectToNew('blood_pressure')}>
              <Text style={styles.addLink}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {bpDevices.length === 0
            ? renderEmptyState('blood_pressure')
            : bpDevices.map(renderDeviceCard)}
        </View>

        {/* Glucose Devices */}
        <View style={styles.deviceSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Glucose Meters</Text>
            <TouchableOpacity onPress={() => handleConnectToNew('glucose')}>
              <Text style={styles.addLink}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {glucoseDevices.length === 0
            ? renderEmptyState('glucose')
            : glucoseDevices.map(renderDeviceCard)}
        </View>
      </ScrollView>

      {/* Device Options Modal */}
      <Modal
        visible={showDeviceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeviceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeviceModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {selectedDevice && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalDeviceIcon}>
                    <Text style={styles.modalIconText}>
                      {getDeviceIcon(selectedDevice.type)}
                    </Text>
                  </View>
                  <Text style={styles.modalDeviceName}>{selectedDevice.name}</Text>
                  <Text style={styles.modalDeviceType}>
                    {getDeviceTypeName(selectedDevice.type)}
                  </Text>
                </View>

                <View style={styles.modalBody}>
                  {/* Auto-connect toggle */}
                  <View style={styles.modalSetting}>
                    <View style={styles.modalSettingInfo}>
                      <Text style={styles.modalSettingTitle}>Auto-connect</Text>
                      <Text style={styles.modalSettingDesc}>
                        Connect automatically when nearby
                      </Text>
                    </View>
                    <Switch
                      value={selectedDevice.autoConnect}
                      onValueChange={(value) => {
                        setDeviceAutoConnect(selectedDevice.id, value);
                        setSelectedDevice({ ...selectedDevice, autoConnect: value });
                      }}
                      trackColor={{ false: '#E5E7EB', true: '#C7D2FE' }}
                      thumbColor={selectedDevice.autoConnect ? '#4F46E5' : '#F3F4F6'}
                    />
                  </View>

                  {/* Device info */}
                  <View style={styles.deviceInfoSection}>
                    <Text style={styles.infoLabel}>Device ID</Text>
                    <Text style={styles.infoValue}>{selectedDevice.id}</Text>

                    {selectedDevice.pairedAt && (
                      <>
                        <Text style={styles.infoLabel}>Paired</Text>
                        <Text style={styles.infoValue}>
                          {new Date(selectedDevice.pairedAt).toLocaleDateString()}
                        </Text>
                      </>
                    )}

                    {selectedDevice.connectionCount > 0 && (
                      <>
                        <Text style={styles.infoLabel}>Connection Count</Text>
                        <Text style={styles.infoValue}>
                          {selectedDevice.connectionCount} times
                        </Text>
                      </>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={styles.modalActions}>
                    {connectedDevices.some((d) => d.id === selectedDevice.id) ? (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.disconnectButton]}
                        onPress={() => {
                          handleDisconnect(selectedDevice.id);
                          setShowDeviceModal(false);
                        }}
                      >
                        <Text style={styles.disconnectButtonText}>Disconnect</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.connectButton]}
                        onPress={() => {
                          setShowDeviceModal(false);
                          navigation.navigate('DeviceDiscovery' as never);
                        }}
                      >
                        <Text style={styles.connectButtonText}>Reconnect</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.actionButton, styles.forgetButton]}
                      onPress={() => handleForget(selectedDevice)}
                    >
                      <Text style={styles.forgetButtonText}>Forget Device</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowDeviceModal(false)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
  settingsSection: {
    padding: 16,
  },
  settingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  bluetoothWarning: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  bluetoothWarningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  bluetoothWarningText: {
    flex: 1,
  },
  bluetoothWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  bluetoothWarningDesc: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  devicesList: {
    flex: 1,
  },
  devicesListContent: {
    paddingBottom: 24,
  },
  deviceSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  addLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceCardConnected: {
    borderColor: '#86EFAC',
    borderWidth: 1,
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
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusConnected: {
    backgroundColor: '#10B981',
  },
  statusDisconnected: {
    backgroundColor: '#D1D5DB',
  },
  deviceType: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  deviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaSeparator: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 6,
  },
  batteryContainer: {
    marginTop: 6,
  },
  batteryText: {
    fontSize: 11,
    color: '#6B7280',
  },
  chevron: {
    fontSize: 20,
    color: '#D1D5DB',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 34,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalDeviceIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIconText: {
    fontSize: 32,
  },
  modalDeviceName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalDeviceType: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  modalSettingInfo: {
    flex: 1,
  },
  modalSettingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  modalSettingDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  deviceInfoSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
  },
  modalActions: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#4F46E5',
  },
  connectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#F3F4F6',
  },
  disconnectButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  forgetButton: {
    backgroundColor: '#FEF2F2',
  },
  forgetButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});
