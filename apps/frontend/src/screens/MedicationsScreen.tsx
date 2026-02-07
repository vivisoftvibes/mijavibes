/**
 * Medications Screen
 *
 * Lists all medications with actions to add, edit, and manage
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMedicationStore } from '../store/useMedicationStore';
import { Medication } from '../types';
import { medicationService } from '../services/api';
import type { RootStackParamList } from '../types';
import type { NavigationProp } from '@react-navigation/native';

export const MedicationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const {
    medications,
    todaySchedule,
    isLoading,
    isRefreshing,
    loadMedications,
    loadTodaySchedule,
    refresh,
    deleteMedication,
  } = useMedicationStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadMedications(), loadTodaySchedule()]);
  };

  const handleDelete = (medication: Medication) => {
    Alert.alert(
      'Delete Medication',
      `Are you sure you want to delete ${medication.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedication(medication.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete medication');
            }
          },
        },
      ]
    );
  };

  const getTodayStatus = (medicationId: string) => {
    const todayMeds = todaySchedule.filter((m) => m.medicationId === medicationId);
    const taken = todayMeds.filter((m) => m.status === 'taken').length;
    const total = todayMeds.length;
    return { taken, total };
  };

  const handleRefill = (medication: Medication) => {
    // Navigate to pharmacy selection for refill
    navigation.navigate('PharmacyRefillSelect' as never, {
      medicationIds: [medication.id],
    } as never);
  };

  const sortedMedications = [...medications].sort((a, b) => {
    // Low supply medications first
    if (a.isLowSupply && !b.isLowSupply) return -1;
    if (!a.isLowSupply && b.isLowSupply) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <View className="flex-1 bg-bg-secondary">
      {/* Header */}
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light">
        <View className="flex-row items-center justify-between">
          <Text className="text-text-primary text-2xl font-bold">Medications</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddMedication' as never)}
            className="bg-primary px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-medium">+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={{
          refreshing: isRefreshing,
          onRefresh: refresh,
        }}
      >
        {sortedMedications.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <View className="bg-bg-primary rounded-full w-20 h-20 items-center justify-center mb-4">
              <Text className="text-text-secondary text-4xl">💊</Text>
            </View>
            <Text className="text-text-primary text-lg font-bold mb-2">
              No Medications Yet
            </Text>
            <Text className="text-text-secondary text-center mb-6">
              Add your medications to start tracking and receive reminders
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddMedication' as never)}
              className="bg-primary px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-medium">Add First Medication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="p-4">
            {sortedMedications.map((medication) => {
              const { taken, total } = getTodayStatus(medication.id);

              return (
                <TouchableOpacity
                  key={medication.id}
                  onPress={() =>
                    navigation.navigate('MedicationDetail' as never, {
                      medicationId: medication.id,
                    })
                  }
                  className="bg-white rounded-xl p-4 mb-3"
                >
                  <View className="flex-row">
                    {medication.photoUrl ? (
                      <Image
                        source={{ uri: medication.photoUrl }}
                        className="w-16 h-16 rounded-lg mr-3"
                      />
                    ) : (
                      <View className="w-16 h-16 bg-bg-secondary rounded-lg mr-3 items-center justify-center">
                        <Text className="text-text-secondary text-2xl font-bold">M</Text>
                      </View>
                    )}

                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-text-primary font-bold text-lg">
                          {medication.name}
                        </Text>
                        {medication.isLowSupply && (
                          <View className="bg-warning/20 px-2 py-1 rounded">
                            <Text className="text-warning text-xs font-medium">
                              Low Supply
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text className="text-text-secondary">{medication.dosage}</Text>

                      <View className="flex-row items-center mt-1">
                        <Text className="text-text-secondary text-sm mr-2">
                          {medication.frequency.replace('_', ' ')}
                        </Text>
                        <Text className="text-text-secondary text-sm">
                          at {medication.times.join(', ')}
                        </Text>
                      </View>

                      {total > 0 && (
                        <View className="flex-row items-center mt-2">
                          <View
                            className={`flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden mr-2`}
                          >
                            <View
                              className={`h-full ${
                                taken === total ? 'bg-success' : 'bg-primary'
                              }`}
                              style={{ width: `${(taken / total) * 100}%` }}
                            />
                          </View>
                          <Text className="text-text-secondary text-sm">
                            {taken}/{total}
                          </Text>
                        </View>
                      )}

                      {/* Refill button for low supply */}
                      {medication.isLowSupply && (
                        <TouchableOpacity
                          onPress={() => handleRefill(medication)}
                          className="mt-2 bg-primary/20 p-2 rounded-lg"
                        >
                          <Text className="text-primary text-sm font-medium text-center">
                            Surtir receta
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Refill Alert */}
      {sortedMedications.some((m) => m.isLowSupply) && (
        <View className="bg-warning p-4">
          <View className="flex-row items-center">
            <Text className="text-white font-medium mr-2">⚠️</Text>
            <View className="flex-1">
              <Text className="text-white font-medium">
                Low Supply Alert
              </Text>
              <Text className="text-white/80 text-sm">
                Some medications need refilling soon
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('PharmacyList' as never)}
              className="bg-white/20 px-3 py-1 rounded"
            >
              <Text className="text-white font-medium">Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
