/**
 * Medication Detail Screen
 *
 * Shows detailed medication information with refill and auto-refill options
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useMedicationStore } from '../store/useMedicationStore';
import { usePharmacyRefillStore } from '../store/usePharmacyRefillStore';
import type { RootStackParamList } from '../types';
import type { NavigationProp } from '@react-navigation/native';

type RouteParams = {
  MedicationDetail: {
    medicationId: string;
  };
};

export const MedicationDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RouteParams, 'MedicationDetail'>>();
  const { medicationId } = route.params;

  const { medications, deleteMedication } = useMedicationStore();
  const { inventory, loadInventory, loadAutoRefillSettings, autoRefillSettings } =
    usePharmacyRefillStore();

  const medication = medications.find((m) => m.id === medicationId);
  const inventoryItem = inventory.find((i) => i.medicationId === medicationId);
  const autoRefill = autoRefillSettings.find((a) => a.medicationId === medicationId);

  useEffect(() => {
    loadInventory();
    loadAutoRefillSettings();
  }, []);

  if (!medication) {
    return (
      <View className="flex-1 bg-bg-secondary items-center justify-center">
        <Text className="text-text-secondary">Medication not found</Text>
      </View>
    );
  }

  const handleDelete = () => {
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
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete medication');
            }
          },
        },
      ]
    );
  };

  const handleRefill = () => {
    navigation.navigate('PharmacyRefillSelect' as never, {
      medicationIds: [medication.id],
    } as never);
  };

  const handleAutoRefillSettings = () => {
    navigation.navigate('PharmacyAutoRefillSettings' as never, {
      medicationId: medication.id,
    } as never);
  };

  const getSupplyStatus = () => {
    const days = inventoryItem?.currentSupply || medication.supplyDays || 0;
    if (days <= 3) return { label: 'Crítico', color: 'text-error', bg: 'bg-error/20' };
    if (days <= 7) return { label: 'Bajo', color: 'text-warning', bg: 'bg-warning/20' };
    if (days <= 14) return { label: 'Aceptable', color: 'text-info', bg: 'bg-info/20' };
    return { label: 'Bueno', color: 'text-success', bg: 'bg-success/20' };
  };

  const supplyStatus = getSupplyStatus();

  return (
    <View className="flex-1 bg-bg-secondary">
      {/* Header */}
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-text-primary text-2xl">{'←'}</Text>
          </TouchableOpacity>
          <Text className="text-text-primary text-xl font-bold">
            Medicamento
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Medication Photo */}
        <View className="bg-white p-6 items-center">
          {medication.photoUrl ? (
            <Image
              source={{ uri: medication.photoUrl }}
              className="w-32 h-32 rounded-lg"
            />
          ) : (
            <View className="w-32 h-32 bg-bg-secondary rounded-lg items-center justify-center">
              <Text className="text-text-secondary text-4xl font-bold">M</Text>
            </View>
          )}

          <Text className="text-text-primary text-2xl font-bold mt-4">
            {medication.name}
          </Text>
          <Text className="text-text-secondary text-lg">{medication.dosage}</Text>
        </View>

        {/* Supply Status */}
        <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
          <Text className="text-text-primary font-bold mb-3">Suministro</Text>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-text-secondary text-sm">Días restantes</Text>
              <Text className="text-text-primary text-2xl font-bold">
                {inventoryItem?.currentSupply || medication.supplyDays || 0}
              </Text>
            </View>
            <View className={`px-4 py-2 rounded-lg ${supplyStatus.bg}`}>
              <Text className={supplyStatus.color font-bold}>{supplyStatus.label}</Text>
            </View>
          </View>

          {inventoryItem?.lastRefillDate && (
            <Text className="text-text-secondary text-sm mt-3">
              Último surtido: {new Date(inventoryItem.lastRefillDate).toLocaleDateString('es-MX')}
            </Text>
          )}
        </View>

        {/* Schedule Info */}
        <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
          <Text className="text-text-primary font-bold mb-3">Horario</Text>
          <Text className="text-text-secondary">
            Frecuencia: {medication.frequency.replace('_', ' ')}
          </Text>
          <Text className="text-text-secondary mt-1">
            Horas: {medication.times.join(', ')}
          </Text>
        </View>

        {/* Refill Section */}
        <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
          <Text className="text-text-primary font-bold mb-3">Surtido</Text>

          {/* Refill Button */}
          <TouchableOpacity
            onPress={handleRefill}
            className="bg-primary p-4 rounded-lg mb-3"
          >
            <Text className="text-white font-medium text-center text-lg">
              Surtir receta ahora
            </Text>
          </TouchableOpacity>

          {/* Auto-Refill Status */}
          <View className="flex-row items-center justify-between p-3 bg-bg-secondary rounded-lg">
            <View className="flex-1">
              <Text className="text-text-primary font-medium">Auto-surtido</Text>
              <Text className="text-text-secondary text-sm">
                {autoRefill?.enabled
                  ? `Activado (${autoRefill.triggerDays} días)`
                  : 'No configurado'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleAutoRefillSettings}
              className="bg-white px-4 py-2 rounded-lg"
            >
              <Text className="text-primary font-medium">
                {autoRefill?.enabled ? 'Editar' : 'Configurar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notes */}
        {medication.notes && (
          <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
            <Text className="text-text-primary font-bold mb-2">Notas</Text>
            <Text className="text-text-secondary">{medication.notes}</Text>
          </View>
        )}

        {/* Rx Number */}
        {medication.rxNumber && (
          <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
            <Text className="text-text-primary font-bold mb-2">
              Número de receta
            </Text>
            <Text className="text-text-secondary">{medication.rxNumber}</Text>
          </View>
        )}

        {/* Danger Zone */}
        <View className="bg-white mx-4 mt-4 mb-8 p-4 rounded-xl border border-error/30">
          <Text className="text-error font-bold mb-3">Zona de peligro</Text>
          <TouchableOpacity
            onPress={handleDelete}
            className="border border-error p-3 rounded-lg"
          >
            <Text className="text-error text-center font-medium">
              Eliminar medicamento
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
