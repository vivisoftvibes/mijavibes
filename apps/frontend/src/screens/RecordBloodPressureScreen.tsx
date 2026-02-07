/**
 * Record Blood Pressure Screen
 *
 * US-010: Display input form for blood pressure
 * US-013: Show warning for abnormal readings
 * BLE-004: Auto-capture data from BLE devices
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { vitalSignsService } from '../services/api';
import { useBLEStore, useBPDevices, getBLEService } from '../store/useBLEStore';
import { BPReading } from '../types/ble';

export const RecordBloodPressureScreen: React.FC = () => {
  const navigation = useNavigation();

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [measuredAt, setMeasuredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [position, setPosition] = useState<'sitting' | 'standing' | 'lying_down'>('sitting');
  const [arm, setArm] = useState<'left' | 'right'>('left');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingForMeasurement, setIsWaitingForMeasurement] = useState(false);
  const [bleSource, setBleSource] = useState<string | null>(null);

  // BLE state
  const { currentMeasurement, connectedDevices, initializeBLE } = useBLEStore();
  const bpDevices = useBPDevices();
  const connectedBPDevices = connectedDevices.filter((d) => d.type === 'blood_pressure');

  useEffect(() => {
    // Initialize BLE on mount
    initializeBLE();
  }, []);

  useEffect(() => {
    // Handle incoming BLE measurements
    if (currentMeasurement && isWaitingForMeasurement) {
      const bpReading = currentMeasurement as BPReading;

      if (bpReading.systolic && bpReading.diastolic) {
        setSystolic(bpReading.systolic.toString());
        setDiastolic(bpReading.diastolic.toString());
        if (bpReading.pulse) {
          setPulse(bpReading.pulse.toString());
        }
        setMeasuredAt(new Date(bpReading.timestamp));
        setBleSource(bpReading.deviceId);
        setIsWaitingForMeasurement(false);

        // Auto-submit after a short delay
        setTimeout(() => {
          handleSubmit();
        }, 500);
      }
    }
  }, [currentMeasurement, isWaitingForMeasurement]);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setMeasuredAt(date);
    }
    setShowDatePicker(false);
  };

  const validateInput = (): boolean => {
    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);

    if (isNaN(sys) || sys < 60 || sys > 250) {
      Alert.alert('Invalid Input', 'Systolic must be between 60 and 250 mmHg');
      return false;
    }

    if (isNaN(dia) || dia < 40 || dia > 150) {
      Alert.alert('Invalid Input', 'Diastolic must be between 40 and 150 mmHg');
      return false;
    }

    if (dia >= sys) {
      Alert.alert('Invalid Input', 'Diastolic must be less than systolic');
      return false;
    }

    return true;
  };

  const getSeverity = (sys: number, dia: number): 'normal' | 'warning' | 'critical' => {
    if (sys >= 180 || dia >= 120 || sys <= 90 || dia <= 60) return 'critical';
    if (sys >= 140 || dia >= 90) return 'warning';
    return 'normal';
  };

  const handleSubmit = async () => {
    if (!validateInput()) return;

    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);
    const severity = getSeverity(sys, dia);

    if (severity === 'critical') {
      Alert.alert(
        'Critical Blood Pressure Detected',
        'Your reading indicates critically high or low blood pressure. Consider contacting your healthcare provider.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save & Alert',
            onPress: () => submitReading(sys, dia, true, parseInt(pulse) || undefined),
          },
          {
            text: 'Save Anyway',
            onPress: () => submitReading(sys, dia, false, parseInt(pulse) || undefined),
          },
        ]
      );
      return;
    }

    if (severity === 'warning') {
      Alert.alert(
        'Elevated Blood Pressure',
        'Your reading is above the normal range. Consider monitoring more frequently.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: () => submitReading(sys, dia, false, parseInt(pulse) || undefined),
          },
        ]
      );
      return;
    }

    await submitReading(sys, dia, false, parseInt(pulse) || undefined);
  };

  const handleBLECapture = () => {
    if (connectedBPDevices.length === 0) {
      Alert.alert(
        'No Connected Device',
        'Please connect your blood pressure monitor first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect Device',
            onPress: () => navigation.navigate('DeviceDiscovery' as never, { deviceType: 'blood_pressure' } as never),
          },
        ]
      );
      return;
    }

    setIsWaitingForMeasurement(true);
    setBleSource(null);

    // Set a timeout in case no measurement is received
    setTimeout(() => {
      if (isWaitingForMeasurement) {
        setIsWaitingForMeasurement(false);
        Alert.alert(
          'No Measurement Received',
          'Please ensure your device is on and try taking a measurement again.',
          [{ text: 'OK' }]
        );
      }
    }, 30000); // 30 second timeout
  };

  const submitReading = async (sys: number, dia: number, triggerAlert: boolean, pulseValue?: number) => {
    setIsSubmitting(true);

    try {
      await vitalSignsService.recordBloodPressure({
        systolic: sys,
        diastolic: dia,
        measuredAt: measuredAt.toISOString(),
        source: bleSource ? 'bluetooth_device' : 'manual',
        deviceId: bleSource || undefined,
        additionalData: {
          position,
          arm,
          ...(pulseValue && { pulse: pulseValue }),
        },
      });

      if (triggerAlert) {
        // Trigger emergency alert
        await vitalSignsService.createAlert({
          type: 'critical_bp',
        });
      }

      Alert.alert(
        'Success',
        'Blood pressure recorded successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.error || 'Failed to record blood pressure');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sys = parseInt(systolic) || 0;
  const dia = parseInt(diastolic) || 0;
  const severity = sys && dia ? getSeverity(sys, dia) : null;

  return (
    <ScrollView className="flex-1 bg-bg-secondary">
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light">
        <Text className="text-text-primary text-2xl font-bold">
          Record Blood Pressure
        </Text>
        <Text className="text-text-secondary">
          Enter your blood pressure reading or use a connected device
        </Text>
      </View>

      <View className="p-4">
        {/* BLE Capture Section */}
        {(connectedBPDevices.length > 0 || bpDevices.length > 0) && (
          <View className="bg-primary/10 rounded-xl p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-text-primary font-bold mb-1">
                  {connectedBPDevices.length > 0 ? 'Connected Device' : 'Paired Devices'}
                </Text>
                {connectedBPDevices.length > 0 ? (
                  <Text className="text-text-secondary text-sm">
                    🩺 {connectedBPDevices[0].name}
                  </Text>
                ) : (
                  <Text className="text-text-secondary text-sm">
                    {bpDevices.length} paired device{bpDevices.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>

              {isWaitingForMeasurement ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text className="text-primary ml-2 font-medium">Waiting...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleBLECapture}
                  className={`${
                    connectedBPDevices.length > 0 ? 'bg-primary' : 'bg-gray-400'
                  } rounded-lg px-4 py-2`}
                  disabled={connectedBPDevices.length === 0}
                >
                  <Text className="text-white font-semibold text-sm">
                    {connectedBPDevices.length > 0 ? 'Sync Reading' : 'Connect Device'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {isWaitingForMeasurement && (
              <Text className="text-text-secondary text-xs mt-3">
                Take a measurement on your device. Reading will be captured automatically.
              </Text>
            )}

            {bleSource && !isWaitingForMeasurement && (
              <View className="flex-row items-center mt-2 bg-success/20 rounded-lg p-2">
                <Text className="text-success text-xs font-medium">
                  ✓ Reading received from {connectedBPDevices.find(d => d.id === bleSource)?.name || 'device'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Blood Pressure Input */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-text-primary font-bold mb-4">
            Blood Pressure (mmHg)
          </Text>

          <View className="flex-row items-center justify-center gap-4">
            <View className="flex-1">
              <Text className="text-text-secondary text-sm text-center mb-2">
                Systolic (Top)
              </Text>
              <TextInput
                value={systolic}
                onChangeText={setSystolic}
                placeholder="120"
                keyboardType="number-pad"
                maxLength={3}
                className="bg-bg-secondary rounded-xl text-center text-4xl font-bold py-6"
                editable={!isWaitingForMeasurement}
              />
            </View>

            <Text className="text-text-primary text-3xl font-bold">/</Text>

            <View className="flex-1">
              <Text className="text-text-secondary text-sm text-center mb-2">
                Diastolic (Bottom)
              </Text>
              <TextInput
                value={diastolic}
                onChangeText={setDiastolic}
                placeholder="80"
                keyboardType="number-pad"
                maxLength={3}
                className="bg-bg-secondary rounded-xl text-center text-4xl font-bold py-6"
                editable={!isWaitingForMeasurement}
              />
            </View>
          </View>

          {/* Pulse Input */}
          <View className="mt-4">
            <Text className="text-text-secondary text-sm text-center mb-2">
              Pulse (BPM) - Optional
            </Text>
            <TextInput
              value={pulse}
              onChangeText={setPulse}
              placeholder="72"
              keyboardType="number-pad"
              maxLength={3}
              className="bg-bg-secondary rounded-xl text-center text-2xl font-semibold py-4"
              editable={!isWaitingForMeasurement}
            />
          </View>

          {/* Severity Indicator */}
          {severity && (
            <View className="mt-4 p-3 rounded-lg bg-bg-secondary">
              <View className="flex-row items-center justify-center">
                <View
                  className={`w-3 h-3 rounded-full mr-2 ${
                    severity === 'critical'
                      ? 'bg-danger'
                      : severity === 'warning'
                      ? 'bg-warning'
                      : 'bg-success'
                  }`}
                />
                <Text
                  className={`font-medium ${
                    severity === 'critical'
                      ? 'text-danger'
                      : severity === 'warning'
                      ? 'text-warning'
                      : 'text-success'
                  }`}
                >
                  {severity === 'critical'
                    ? 'Critical - Consult doctor immediately'
                    : severity === 'warning'
                    ? 'Elevated - Monitor closely'
                    : 'Normal'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Additional Options */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-text-primary font-bold mb-4">
            Additional Information
          </Text>

          {/* Date/Time Picker */}
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center justify-between py-3 border-b border-border-light"
          >
            <Text className="text-text-primary">Measured At</Text>
            <View className="flex-row items-center">
              <Text className="text-text-secondary mr-2">
                {measuredAt.toLocaleString()}
              </Text>
              <Text className="text-primary">›</Text>
            </View>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={measuredAt}
              mode="datetime"
              onChange={handleDateChange}
            />
          )}

          {/* Body Position */}
          <View className="py-3 border-b border-border-light">
            <Text className="text-text-primary mb-3">Body Position</Text>
            <View className="flex-row gap-2">
              {(['sitting', 'standing', 'lying_down'] as const).map((pos) => (
                <TouchableOpacity
                  key={pos}
                  onPress={() => setPosition(pos)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 ${
                    position === pos
                      ? 'border-primary bg-primary/10'
                      : 'border-border-light'
                  }`}
                >
                  <Text
                    className={`text-center capitalize ${
                      position === pos ? 'text-primary font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {pos.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Arm Selection */}
          <View className="py-3">
            <Text className="text-text-primary mb-3">Measured Arm</Text>
            <View className="flex-row gap-2">
              {(['left', 'right'] as const).map((side) => (
                <TouchableOpacity
                  key={side}
                  onPress={() => setArm(side)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 ${
                    arm === side
                      ? 'border-primary bg-primary/10'
                      : 'border-border-light'
                  }`}
                >
                  <Text
                    className={`text-center capitalize ${
                      arm === side ? 'text-primary font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {side}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Reference Info */}
        <View className="bg-bg-primary rounded-xl p-4 mb-4">
          <Text className="text-text-primary font-bold mb-2">
            Blood Pressure Ranges
          </Text>
          <View className="space-y-2">
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-success rounded-full mr-2" />
              <Text className="text-text-secondary">
                Normal: Less than 120/80 mmHg
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-warning rounded-full mr-2" />
              <Text className="text-text-secondary">
                Elevated: 120-139 systolic or 80-89 diastolic
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-danger rounded-full mr-2" />
              <Text className="text-text-secondary">
                Critical: 180/120 or higher (seek immediate care)
              </Text>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !systolic || !diastolic || isWaitingForMeasurement}
          className={`bg-primary rounded-xl py-4 items-center ${
            isSubmitting || !systolic || !diastolic || isWaitingForMeasurement ? 'opacity-50' : ''
          }`}
        >
          {isSubmitting || isWaitingForMeasurement ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">
              {bleSource ? 'Save BLE Reading' : 'Save Reading'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
