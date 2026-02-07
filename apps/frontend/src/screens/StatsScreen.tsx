/**
 * Health Stats Screen
 *
 * US-014: Display health statistics with charts
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useStatsStore } from '../store/useStatsStore';
import { format, subDays } from 'date-fns';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 32;

export const StatsScreen: React.FC = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [chartType, setChartType] = useState<'blood_pressure' | 'glucose'>('blood_pressure');

  const {
    overview,
    medicationAdherence,
    vitalsSummary,
    healthTrends,
    isLoading,
    loadOverview,
    loadMedicationAdherence,
    loadVitalsSummary,
    loadHealthTrends,
  } = useStatsStore();

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    await Promise.all([
      loadOverview(),
      loadMedicationAdherence(period),
      loadVitalsSummary(period),
      loadHealthTrends(chartType, period),
    ]);
  };

  const handleChartTypeChange = (type: 'blood_pressure' | 'glucose') => {
    setChartType(type);
    loadHealthTrends(type, period);
  };

  const adherenceData = medicationAdherence?.dailyBreakdown || [];

  const trendData = {
    labels:
      healthTrends?.data?.map((d) =>
        format(new Date(d.date), period === '7d' ? 'EEE' : 'MMM d')
      ) || [],
    datasets: [
      {
        data:
          chartType === 'blood_pressure'
            ? healthTrends?.data?.map((d) => d.systolic || 0) || []
            : healthTrends?.data?.map((d) => d.value || 0) || [],
        color: (opacity = 1) => `rgba(0, 102, 204, ${opacity})`,
        strokeWidth: 2,
      },
      ...(chartType === 'blood_pressure'
        ? [
            {
              data: healthTrends?.data?.map((d) => d.diastolic || 0) || [],
              color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
              strokeWidth: 2,
            },
          ]
        : []),
    ],
  };

  return (
    <ScrollView className="flex-1 bg-bg-secondary">
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light">
        <Text className="text-text-primary text-2xl font-bold">Health Statistics</Text>
        <Text className="text-text-secondary">Track your health progress over time</Text>
      </View>

      {/* Period Selector */}
      <View className="flex-row bg-white mx-4 mt-4 rounded-lg p-1">
        {(['7d', '30d', '90d'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg ${
              period === p ? 'bg-primary' : ''
            }`}
          >
            <Text
              className={`text-center font-medium ${
                period === p ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Medication Adherence */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-text-primary font-bold text-lg">
            Medication Adherence
          </Text>
          <View
            className={`px-3 py-1 rounded-full ${
              (medicationAdherence?.rate || 0) >= 90
                ? 'bg-success/20'
                : (medicationAdherence?.rate || 0) >= 70
                ? 'bg-warning/20'
                : 'bg-danger/20'
            }`}
          >
            <Text
              className={`font-bold ${
                (medicationAdherence?.rate || 0) >= 90
                  ? 'text-success'
                  : (medicationAdherence?.rate || 0) >= 70
                  ? 'text-warning'
                  : 'text-danger'
              }`}
            >
              {medicationAdherence?.rate?.toFixed(0) || 0}%
            </Text>
          </View>
        </View>

        <View className="flex-row gap-4 mb-4">
          <View className="flex-1 bg-bg-secondary rounded-lg p-3">
            <Text className="text-text-secondary text-sm">Taken</Text>
            <Text className="text-text-primary text-2xl font-bold">
              {medicationAdherence?.taken || 0}
            </Text>
          </View>
          <View className="flex-1 bg-bg-secondary rounded-lg p-3">
            <Text className="text-text-secondary text-sm">Missed</Text>
            <Text className="text-text-primary text-2xl font-bold">
              {medicationAdherence?.missed || 0}
            </Text>
          </View>
          <View className="flex-1 bg-bg-secondary rounded-lg p-3">
            <Text className="text-text-secondary text-sm">Total</Text>
            <Text className="text-text-primary text-2xl font-bold">
              {medicationAdherence?.total || 0}
            </Text>
          </View>
        </View>

        {adherenceData.length > 0 && (
          <BarChart
            data={{
              labels: adherenceData.map((d) => format(new Date(d.date), 'MMM d')),
              datasets: [
                {
                  data: adherenceData.map((d) => Math.round(d.rate)),
                },
              ],
            }}
            width={CHART_WIDTH}
            height={180}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 102, 204, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
              style: { borderRadius: 16 },
            }}
            style={{ borderRadius: 16 }}
            showValuesOnTopOfBars
          />
        )}
      </View>

      {/* Blood Pressure Stats */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4">
        <Text className="text-text-primary font-bold text-lg mb-4">
          Blood Pressure Summary
        </Text>

        {vitalsSummary?.bloodPressure ? (
          <>
            <View className="flex-row gap-4 mb-4">
              <View className="flex-1">
                <Text className="text-text-secondary text-sm">Average</Text>
                <Text className="text-text-primary text-xl font-bold">
                  {vitalsSummary.bloodPressure.averageSystolic.toFixed(0)}/
                  {vitalsSummary.bloodPressure.averageDiastolic.toFixed(0)} mmHg
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-text-secondary text-sm">Readings</Text>
                <Text className="text-text-primary text-xl font-bold">
                  {vitalsSummary.bloodPressure.readings}
                </Text>
              </View>
            </View>

            <View className="bg-bg-secondary rounded-lg p-3 mb-3">
              <Text className="text-text-secondary text-sm mb-1">Highest</Text>
              <Text className="text-text-primary font-bold">
                {vitalsSummary.bloodPressure.highest.systolic}/
                {vitalsSummary.bloodPressure.highest.diastolic} mmHg
              </Text>
              <Text className="text-text-secondary text-xs">
                {format(new Date(vitalsSummary.bloodPressure.highest.date), 'MMM d, yyyy')}
              </Text>
            </View>

            <View className="bg-bg-secondary rounded-lg p-3">
              <Text className="text-text-secondary text-sm mb-1">Lowest</Text>
              <Text className="text-text-primary font-bold">
                {vitalsSummary.bloodPressure.lowest.systolic}/
                {vitalsSummary.bloodPressure.lowest.diastolic} mmHg
              </Text>
              <Text className="text-text-secondary text-xs">
                {format(new Date(vitalsSummary.bloodPressure.lowest.date), 'MMM d, yyyy')}
              </Text>
            </View>
          </>
        ) : (
          <Text className="text-text-secondary text-center py-4">
            No blood pressure readings yet
          </Text>
        )}
      </View>

      {/* Glucose Stats */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4">
        <Text className="text-text-primary font-bold text-lg mb-4">
          Glucose Summary
        </Text>

        {vitalsSummary?.glucose ? (
          <>
            <View className="flex-row gap-4 mb-4">
              <View className="flex-1">
                <Text className="text-text-secondary text-sm">Average</Text>
                <Text className="text-text-primary text-xl font-bold">
                  {vitalsSummary.glucose.average.toFixed(0)} mg/dL
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-text-secondary text-sm">Readings</Text>
                <Text className="text-text-primary text-xl font-bold">
                  {vitalsSummary.glucose.readings}
                </Text>
              </View>
            </View>

            <View className="bg-bg-secondary rounded-lg p-3 mb-3">
              <Text className="text-text-secondary text-sm mb-1">Highest</Text>
              <Text className="text-text-primary font-bold">
                {vitalsSummary.glucose.highest.value} mg/dL
              </Text>
            </View>

            <View className="bg-bg-secondary rounded-lg p-3">
              <Text className="text-text-secondary text-sm mb-1">Lowest</Text>
              <Text className="text-text-primary font-bold">
                {vitalsSummary.glucose.lowest.value} mg/dL
              </Text>
            </View>
          </>
        ) : (
          <Text className="text-text-secondary text-center py-4">
            No glucose readings yet
          </Text>
        )}
      </View>

      {/* Trends Chart */}
      <View className="bg-white mx-4 mt-4 mb-4 rounded-xl p-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-text-primary font-bold text-lg">Trends</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => handleChartTypeChange('blood_pressure')}
              className={`px-3 py-1 rounded-lg ${
                chartType === 'blood_pressure' ? 'bg-primary' : 'bg-bg-secondary'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  chartType === 'blood_pressure' ? 'text-white' : 'text-text-secondary'
                }`}
              >
                BP
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleChartTypeChange('glucose')}
              className={`px-3 py-1 rounded-lg ${
                chartType === 'glucose' ? 'bg-primary' : 'bg-bg-secondary'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  chartType === 'glucose' ? 'text-white' : 'text-text-secondary'
                }`}
              >
                Glucose
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {trendData.labels.length > 0 ? (
          <LineChart
            data={trendData}
            width={CHART_WIDTH}
            height={220}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 102, 204, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#0066CC',
              },
            }}
            style={{ borderRadius: 16 }}
            bezier
          />
        ) : (
          <Text className="text-text-secondary text-center py-8">
            No data available for the selected period
          </Text>
        )}

        {/* Legend */}
        {chartType === 'blood_pressure' && (
          <View className="flex-row justify-center gap-6 mt-4">
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-primary rounded-full mr-2" />
              <Text className="text-text-secondary text-sm">Systolic</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 bg-success rounded-full mr-2" />
              <Text className="text-text-secondary text-sm">Diastolic</Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};
