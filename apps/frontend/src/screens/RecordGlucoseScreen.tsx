/**
 * Record Glucose Screen
 *
 * US-011: Display input form for glucose readings
 * US-014: Show warning for abnormal glucose levels
 * BLE-004: Auto-capture data from BLE glucose meters
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
import { useBLEStore, useGlucoseDevices } from '../store/useBLEStore';
import { GlucoseReading } from '../types/ble';

export const RecordGlucoseScreen: React.FC = () => {
  const navigation = useNavigation();

  const [glucose, setGlucose] = useState('');
  const [measuredAt, setMeasuredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mealContext, setMealContext] = useState<'fasting' | 'before_meal' | 'after_meal' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingForMeasurement, setIsWaitingForMeasurement] = useState(false);
  const [bleSource, setBleSource] = useState<string | null>(null);

  // BLE state
  const { currentMeasurement, connectedDevices, initializeBLE } = useBLEStore();
  const glucoseDevices = useGlucoseDevices();
  const connectedGlucoseDevices = connectedDevices.filter((d) => d.type === 'glucose');

  useEffect(() => {
    // Initialize BLE on mount
    initializeBLE();
  }, []);

  useEffect(() => {
    // Handle incoming BLE measurements
    if (currentMeasurement && isWaitingForMeasurement) {
      const glucoseReading = currentMeasurement as GlucoseReading;

      if (glucoseReading.value) {
        setGlucose(glucoseReading.value.toString());
        setMeasuredAt(new Date(glucoseReading.timestamp));
        if (glucoseReading.mealContext) {
          setMealContext(glucoseReading.mealContext);
        }
        setBleSource(glucoseReading.deviceId);
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
    const value = parseInt(glucose);

    if (isNaN(value) || value < 10 || value > 600) {
      Alert.alert('Invalid Input', 'Glucose must be between 10 and 600 mg/dL');
      return false;
    }

    return true;
  };

  const getSeverity = (value: number): 'normal' | 'warning' | 'critical' => {
    if (mealContext === 'fasting') {
      if (value < 70 || value >= 126) return 'critical';
      if (value >= 100) return 'warning';
    } else {
      if (value < 70) return 'critical';
      if (value >= 180) return 'warning';
    }
    return 'normal';
  };

  const handleSubmit = async () => {
    if (!validateInput()) return;

    const value = parseInt(glucose);
    const severity = getSeverity(value);

    if (severity === 'critical') {
      Alert.alert(
        'Critical Glucose Detected',
        mealContext === 'fasting'
          ? 'Your fasting glucose is outside the normal range. Consider contacting your healthcare provider.'
          : 'Your glucose level is abnormally high or low. Consider contacting your healthcare provider.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save & Alert',
            onPress: () => submitReading(value, true),
          },
          {
            text: 'Save Anyway',
            onPress: () => submitReading(value, false),
          },
        ]
      );
      return;
    }

    if (severity === 'warning') {
      Alert.alert(
        'Elevated Glucose',
        'Your glucose level is above the normal range. Consider monitoring more frequently.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: () => submitReading(value, false),
          },
        ]
      );
      return;
    }

    await submitReading(value, false);
  };

  const submitReading = async (value: number, triggerAlert: boolean) => {
    setIsSubmitting(true);

    try {
      await vitalSignsService.recordGlucose({
        value: value.toString(),
        measuredAt: measuredAt.toISOString(),
        source: bleSource ? 'bluetooth_device' : 'manual',
        deviceId: bleSource || undefined,
        additionalData: {
          fasting: mealContext === 'fasting',
          mealTime: mealContext === 'before_meal' ? 'before_meal' : mealContext === 'after_meal' ? 'after_meal' : undefined,
        },
      });

      if (triggerAlert) {
        // Trigger emergency alert
        await vitalSignsService.createAlert({
          type: 'critical_glucose',
        });
      }

      Alert.alert(
        'Success',
        'Glucose reading recorded successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.error || 'Failed to record glucose');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBLECapture = () => {
    if (connectedGlucoseDevices.length === 0) {
      Alert.alert(
        'No Connected Device',
        'Please connect your glucose meter first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect Device',
            onPress: () => navigation.navigate('DeviceDiscovery' as never, { deviceType: 'glucose' } as never),
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

  const value = parseInt(glucose) || 0;
  const severity = value ? getSeverity(value) : null;

  return (
    <ScrollView className="flex-1 bg-bg-secondary">
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light">
        <Text className="text-text-primary text-2xl font-bold">
          Record Glucose
        </Text>
        <Text className="text-text-secondary">
          Enter your glucose reading or use a connected device
        </Text>
      </View>

      <View className="p-4">
        {/* BLE Capture Section */}
        {(connectedGlucoseDevices.length > 0 || glucoseDevices.length > 0) && (
          <View className="bg-warning/10 rounded-xl p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-text-primary font-bold mb-1">
                  {connectedGlucoseDevices.length > 0 ? 'Connected Device' : 'Paired Devices'}
                </Text>
                {connectedGlucoseDevices.length > 0 ? (
                  <Text className="text-text-secondary text-sm">
                    🩸 {connectedGlucoseDevices[0].name}
                  </Text>
                ) : (
                  <Text className="text-text-secondary text-sm">
                    {glucoseDevices.length} paired device{glucoseDevices.length > 1 ? 's' : ''}
                  </Text>
                )}
              </View>

              {isWaitingForMeasurement ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#F59E0B" />
                  <Text className="text-warning ml-2 font-medium">Waiting...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleBLECapture}
                  className={`${
                    connectedGlucoseDevices.length > 0 ? 'bg-warning' : 'bg-gray-400'
                  } rounded-lg px-4 py-2`}
                  disabled={connectedGlucoseDevices.length === 0}
                >
                  <Text className="text-white font-semibold text-sm">
                    {connectedGlucoseDevices.length > 0 ? 'Sync Reading' : 'Connect Device'}
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
                  ✓ Reading received from {connectedGlucoseDevices.find(d => d.id === bleSource)?.name || 'device'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Glucose Input */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-text-primary font-bold mb-4">
            Glucose Level (mg/dL)
          </Text>

          <View className="items-center justify-center">
            <TextInput
              value={glucose}
              onChangeText={setGlucose}
              placeholder="100"
              keyboardType="number-pad"
              maxLength={3}
              className="bg-bg-secondary rounded-xl text-center text-5xl font-bold py-8 w-full"
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
                    ? mealContext === 'fasting'
                    ? 'Abnormal fasting glucose'
                    : 'Abnormal glucose level'
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

          {/* Meal Context */}
          <View className="py-3">
            <Text className="text-text-primary mb-3">Meal Context</Text>
            <View className="flex-row gap-2 flex-wrap">
              {(['fasting', 'before_meal', 'after_meal'] as const).map((context) => (
                <TouchableOpacity
                  key={context}
                  onPress={() => setMealContext(mealContext === context ? null : context)}
                  className={`px-4 py-2 rounded-lg border-2 ${
                    mealContext === context
                      ? 'border-warning bg-warning/10'
                      : 'border-border-light'
                  }`}
                >
                  <Text
                    className={`text-sm capitalize ${
                      mealContext === context ? 'text-warning font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {context.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Reference Info */}
        <View className="bg-bg-primary rounded-xl p-4 mb-4">
          <Text className="text-text-primary font-bold mb-2">
            Glucose Ranges (mg/dL)
          </Text>
          <View className="space-y-2">
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-success rounded-full mr-2" />
              <Text className="text-text-secondary">
                Fasting: 70-99 mg/dL
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-success rounded-full mr-2" />
              <Text className="text-text-secondary">
                After meal: Below 140 mg/dL
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-warning rounded-full mr-2" />
              <Text className="text-text-secondary">
                Pre-diabetes: 100-125 (fasting)
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-danger rounded-full mr-2" />
              <Text className="text-text-secondary">
                Diabetes: 126+ (fasting) or seek care if below 70
              </Text>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !glucose || isWaitingForMeasurement}
          className={`bg-warning rounded-xl py-4 items-center ${
            isSubmitting || !glucose || isWaitingForMeasurement ? 'opacity-50' : ''
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
