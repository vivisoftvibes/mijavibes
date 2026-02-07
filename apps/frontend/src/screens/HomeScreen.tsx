/**
 * Home Screen
 *
 * Main dashboard showing today's summary, quick actions, and alerts
 * US-001: Display today's medication reminders
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { useMedicationStore } from '../store/useMedicationStore';
import { useStatsStore } from '../store/useStatsStore';
import { TodayMedication } from '../types';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);

  const {
    todaySchedule,
    isLoading: medsLoading,
    loadTodaySchedule,
    markAsTaken,
    markAsSkipped,
  } = useMedicationStore();

  const {
    overview,
    isLoading: statsLoading,
    loadOverview,
  } = useStatsStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadTodaySchedule(),
      loadOverview(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const upcomingMeds = todaySchedule.filter(
    (m) => m.status === 'pending'
  );

  const takenMeds = todaySchedule.filter(
    (m) => m.status === 'taken'
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      className="flex-1 bg-bg-secondary"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View className="bg-primary pt-safe pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white text-lg opacity-90">
              {getGreeting()}, {user?.name?.split(' ')[0]}!
            </Text>
            <Text className="text-white text-2xl font-bold">
              {format(new Date(), 'MMMM d, yyyy')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile' as never)}
            className="w-12 h-12 bg-white/20 rounded-full items-center justify-center"
          >
            {user?.profilePhotoUrl ? (
              <Image
                source={{ uri: user.profilePhotoUrl }}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <Text className="text-white text-xl font-bold">
                {user?.name?.charAt(0) || '?'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-white/20 rounded-xl p-4">
            <Text className="text-white/80 text-sm">Medications Today</Text>
            <Text className="text-white text-3xl font-bold">
              {takenMeds.length}/{todaySchedule.length}
            </Text>
          </View>
          <View className="flex-1 bg-white/20 rounded-xl p-4">
            <Text className="text-white/80 text-sm">Adherence Rate</Text>
            <Text className="text-white text-3xl font-bold">
              {overview?.medications?.adherenceRate?.toFixed(0) || 0}%
            </Text>
          </View>
        </View>
      </View>

      {/* Emergency Alert Banner */}
      {overview?.alerts?.activeCount > 0 && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Emergency' as never)}
          className="mx-4 mt-4 bg-danger rounded-xl p-4 flex-row items-center"
        >
          <View className="bg-white/20 rounded-full p-2 mr-3">
            <Text className="text-white text-xl">!</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold">Active Emergency Alert</Text>
            <Text className="text-white/80 text-sm">
              {overview.alerts.activeCount} active alert(s) require attention
            </Text>
          </View>
          <Text className="text-white">→</Text>
        </TouchableOpacity>
      )}

      {/* Upcoming Medications Section */}
      <View className="px-4 mt-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-text-primary text-lg font-bold">Upcoming Medications</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Medications' as never)}>
            <Text className="text-primary">See All</Text>
          </TouchableOpacity>
        </View>

        {upcomingMeds.length === 0 ? (
          <View className="bg-white rounded-xl p-6 items-center">
            <Text className="text-text-secondary">No upcoming medications</Text>
          </View>
        ) : (
          upcomingMeds.slice(0, 3).map((med) => (
            <MedicationCard
              key={`${med.medicationId}-${med.scheduledTime}`}
              medication={med}
              onTaken={() => markAsTaken(med.medicationId, med.scheduledAt)}
              onSkipped={() => markAsSkipped(med.medicationId, med.scheduledAt)}
            />
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View className="px-4 mt-6">
        <Text className="text-text-primary text-lg font-bold mb-3">Quick Actions</Text>

        <View className="flex-row gap-3 flex-wrap">
          <QuickAction
            icon="P"
            label="Record BP"
            color="bg-primary"
            onPress={() => navigation.navigate('RecordBloodPressure' as never)}
          />
          <QuickAction
            icon="G"
            label="Record Glucose"
            color="bg-warning"
            onPress={() => navigation.navigate('RecordGlucose' as never)}
          />
          <QuickAction
            icon="S"
            label="View Stats"
            color="bg-success"
            onPress={() => navigation.navigate('Stats' as never)}
          />
          <QuickAction
            icon="E"
            label="Emergency"
            color="bg-danger"
            onPress={() => navigation.navigate('Emergency' as never)}
          />
        </View>
      </View>

      {/* Vital Signs Summary */}
      <View className="px-4 mt-6 mb-6">
        <Text className="text-text-primary text-lg font-bold mb-3">Latest Vitals</Text>

        <View className="bg-white rounded-xl p-4">
          {overview?.vitals?.bloodPressure?.latest ? (
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-border-light">
              <View>
                <Text className="text-text-secondary text-sm">Blood Pressure</Text>
                <Text className="text-text-primary text-xl font-bold">
                  {overview.vitals.bloodPressure.latest.systolic}/
                  {overview.vitals.bloodPressure.latest.diastolic} mmHg
                </Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  overview.vitals.bloodPressure.isAbnormal
                    ? 'bg-danger/20'
                    : 'bg-success/20'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    overview.vitals.bloodPressure.isAbnormal
                      ? 'text-danger'
                      : 'text-success'
                  }`}
                >
                  {overview.vitals.bloodPressure.isAbnormal ? 'High' : 'Normal'}
                </Text>
              </View>
            </View>
          ) : (
            <View className="mb-3 pb-3 border-b border-border-light">
              <Text className="text-text-secondary">No blood pressure readings yet</Text>
            </View>
          )}

          {overview?.vitals?.glucose?.latest ? (
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-text-secondary text-sm">Glucose</Text>
                <Text className="text-text-primary text-xl font-bold">
                  {overview.vitals.glucose.latest.value} mg/dL
                </Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  overview.vitals.glucose.isAbnormal
                    ? 'bg-danger/20'
                    : 'bg-success/20'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    overview.vitals.glucose.isAbnormal
                      ? 'text-danger'
                      : 'text-success'
                  }`}
                >
                  {overview.vitals.glucose.isAbnormal ? 'High' : 'Normal'}
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Text className="text-text-secondary">No glucose readings yet</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

interface MedicationCardProps {
  medication: TodayMedication;
  onTaken: () => void;
  onSkipped: () => void;
}

const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  onTaken,
  onSkipped,
}) => {
  const time = new Date();
  const [hours, minutes] = medication.scheduledTime.split(':');
  time.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  const isPast = time < new Date();

  return (
    <View className="bg-white rounded-xl p-4 mb-3 flex-row items-center">
      {medication.photoUrl ? (
        <Image
          source={{ uri: medication.photoUrl }}
          className="w-12 h-12 rounded-lg mr-3"
        />
      ) : (
        <View className="w-12 h-12 bg-bg-secondary rounded-lg mr-3 items-center justify-center">
          <Text className="text-text-secondary text-lg font-bold">M</Text>
        </View>
      )}

      <View className="flex-1">
        <Text className="text-text-primary font-bold">{medication.medicationName}</Text>
        <Text className="text-text-secondary text-sm">{medication.dosage}</Text>
        <Text className="text-text-secondary text-sm">
          {format(time, 'h:mm a')}
        </Text>
      </View>

      {isPast && (
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={onSkipped}
            className="px-4 py-2 bg-bg-secondary rounded-lg"
          >
            <Text className="text-text-secondary font-medium">Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onTaken}
            className="px-4 py-2 bg-success rounded-lg"
          >
            <Text className="text-white font-medium">Take</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

interface QuickActionProps {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    className={`${color} rounded-xl p-4 w-[calc(50%-6px)] items-center`}
  >
    <View className="bg-white/20 rounded-full w-12 h-12 items-center justify-center mb-2">
      <Text className="text-white text-xl font-bold">{icon}</Text>
    </View>
    <Text className="text-white font-medium text-center">{label}</Text>
  </TouchableOpacity>
);
