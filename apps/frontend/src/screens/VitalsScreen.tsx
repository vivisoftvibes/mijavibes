/**
 * Vitals Screen
 *
 * Lists recent vital signs and provides quick add actions
 * BLE-001: Link to device discovery and management
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { VitalSign } from '../types';
import { vitalSignsService } from '../services/api';
import { useBPDevices, useGlucoseDevices } from '../store/useBLEStore';

export const VitalsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [vitals, setVitals] = React.useState<VitalSign[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // BLE devices
  const bpDevices = useBPDevices();
  const glucoseDevices = useGlucoseDevices();

  useEffect(() => {
    loadVitals();
  }, []);

  const loadVitals = async () => {
    setIsLoading(true);
    try {
      const data = await vitalSignsService.getVitalSigns(undefined, undefined, undefined, 20);
      setVitals(data);
    } catch (error) {
      console.error('Failed to load vitals', error);
    } finally {
      setIsLoading(false);
    }
  };

  const bloodPressureReadings = vitals.filter((v) => v.type === 'blood_pressure');
  const glucoseReadings = vitals.filter((v) => v.type === 'glucose');

  const hasPairedDevices = bpDevices.length > 0 || glucoseDevices.length > 0;

  return (
    <View className="flex-1 bg-bg-secondary">
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light flex-row items-center justify-between">
        <View>
          <Text className="text-text-primary text-2xl font-bold">Vital Signs</Text>
          <Text className="text-text-secondary">Track your health measurements</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('DeviceList' as never)}
          className="flex-row items-center bg-bg-primary rounded-full px-3 py-1"
        >
          <Text className="text-text-primary text-sm">
            {hasPairedDevices ? `${bpDevices.length + glucoseDevices.length} devices` : 'Devices'}
          </Text>
          <Text className="text-text-primary text-sm ml-1">›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Quick Actions */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            onPress={() => navigation.navigate('RecordBloodPressure' as never)}
            className="flex-1 bg-primary rounded-xl p-4"
          >
            <Text className="text-white text-2xl mb-2">💓</Text>
            <Text className="text-white font-bold">Blood Pressure</Text>
            <Text className="text-white/80 text-sm">
              {bpDevices.length > 0 ? 'Use Device' : 'Record Now'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('RecordGlucose' as never)}
            className="flex-1 bg-warning rounded-xl p-4"
          >
            <Text className="text-white text-2xl mb-2">🩸</Text>
            <Text className="text-white font-bold">Glucose</Text>
            <Text className="text-white/80 text-sm">
              {glucoseDevices.length > 0 ? 'Use Device' : 'Record Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add Device CTA (show if no devices) */}
        {!hasPairedDevices && (
          <TouchableOpacity
            onPress={() => navigation.navigate('DeviceDiscovery' as never)}
            className="bg-blue-50 rounded-xl p-4 mb-6 flex-row items-center border border-blue-200"
          >
            <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
              <Text className="text-blue-600 text-lg">📡</Text>
            </View>
            <View className="flex-1">
              <Text className="text-text-primary font-semibold">Connect a BLE Device</Text>
              <Text className="text-text-secondary text-sm">
                Automatically sync readings from compatible devices
              </Text>
            </View>
            <Text className="text-primary text-lg">›</Text>
          </TouchableOpacity>
        )}

        {/* Blood Pressure History */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text-primary text-lg font-bold">
              Blood Pressure
            </Text>
            {bloodPressureReadings.length > 0 && (
              <Text className="text-text-secondary text-sm">
                {bloodPressureReadings.length} readings
              </Text>
            )}
          </View>

          {bloodPressureReadings.length === 0 ? (
            <View className="bg-white rounded-xl p-6 items-center">
              <Text className="text-text-secondary">No blood pressure readings yet</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RecordBloodPressure' as never)}
                className="mt-4 bg-primary px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Add First Reading</Text>
              </TouchableOpacity>
            </View>
          ) : (
            bloodPressureReadings.map((reading) => (
              <View
                key={reading.id}
                className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between"
              >
                <View>
                  <Text className="text-text-primary font-bold text-lg">
                    {reading.systolic}/{reading.diastolic} mmHg
                  </Text>
                  <Text className="text-text-secondary text-sm">
                    {format(new Date(reading.measuredAt), 'MMM d, h:mm a')}
                  </Text>
                </View>
                <View
                  className={`px-3 py-1 rounded-full ${
                    (reading.systolic || 0) > 140 || (reading.diastolic || 0) > 90
                      ? 'bg-warning/20'
                      : 'bg-success/20'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      (reading.systolic || 0) > 140 || (reading.diastolic || 0) > 90
                        ? 'text-warning'
                        : 'text-success'
                    }`}
                  >
                    {(reading.systolic || 0) > 140 || (reading.diastolic || 0) > 90
                      ? 'High'
                      : 'Normal'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Glucose History */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-text-primary text-lg font-bold">Glucose</Text>
            {glucoseReadings.length > 0 && (
              <Text className="text-text-secondary text-sm">
                {glucoseReadings.length} readings
              </Text>
            )}
          </View>

          {glucoseReadings.length === 0 ? (
            <View className="bg-white rounded-xl p-6 items-center">
              <Text className="text-text-secondary">No glucose readings yet</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('RecordGlucose' as never)}
                className="mt-4 bg-warning px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Add First Reading</Text>
              </TouchableOpacity>
            </View>
          ) : (
            glucoseReadings.map((reading) => {
              const value = parseInt(reading.value || '0');
              return (
                <View
                  key={reading.id}
                  className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between"
                >
                  <View>
                    <Text className="text-text-primary font-bold text-lg">
                      {reading.value} mg/dL
                    </Text>
                    <Text className="text-text-secondary text-sm">
                      {format(new Date(reading.measuredAt), 'MMM d, h:mm a')}
                    </Text>
                    {(reading.additionalData as any)?.fasting && (
                      <Text className="text-text-secondary text-xs">(Fasting)</Text>
                    )}
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      value > 130 ? 'bg-warning/20' : 'bg-success/20'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        value > 130 ? 'text-warning' : 'text-success'
                      }`}
                    >
                      {value > 130 ? 'High' : 'Normal'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};
