/**
 * SPEC-006: Pharmacy Selection Screen
 *
 * Screen 2: Pharmacy Selection
 * Shows available pharmacy partners sorted by distance
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePharmacyRefillStore } from '../store/usePharmacyRefillStore';
import type { PharmacyPartner, DeliveryType } from '../types';

type RouteParams = {
  PharmacyRefillSelect: {
    medicationIds: string[];
  };
};

export const PharmacyRefillSelectScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PharmacyRefillSelect'>>();
  const { medicationIds } = route.params;

  const {
    pharmacies,
    pharmaciesLoading,
    loadPharmacies,
  } = usePharmacyRefillStore();

  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyPartner | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryType>('pickup');

  useEffect(() => {
    loadPharmacies();
  }, []);

  const handleContinue = () => {
    if (!selectedPharmacy) {
      Alert.alert('Selecciona farmacia', 'Por favor selecciona una farmacia');
      return;
    }

    // Navigate to review screen
    navigation.navigate('PharmacyRefillReview' as never, {
      medicationIds,
      pharmacyId: selectedPharmacy.id,
      deliveryType: selectedDelivery,
    } as never);
  };

  const getDeliveryLabel = () => {
    if (selectedDelivery === 'pickup') {
      return 'Recoger en tienda';
    }
    return 'Delivery a domicilio';
  };

  const formatOperatingHours = (pharmacy: PharmacyPartner) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hours = pharmacy.operatingHours[today];
    if (!hours || hours.open === 'closed') {
      return 'Cerrado hoy';
    }
    return `${hours.open} - ${hours.close}`;
  };

  return (
    <View className="flex-1 bg-bg-secondary">
      {/* Header */}
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-text-primary text-2xl">{'←'}</Text>
          </TouchableOpacity>
          <Text className="text-text-primary text-xl font-bold">
            Seleccionar farmacia
          </Text>
        </View>
      </View>

      {/* Location indicator */}
      <View className="bg-primary/10 px-4 py-2 flex-row items-center">
        <Text className="text-primary mr-2">📍</Text>
        <Text className="text-primary text-sm">
          Usando tu ubicación actual
        </Text>
      </View>

      {pharmaciesLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <ScrollView className="flex-1">
          {/* Delivery Type Toggle */}
          <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
            <Text className="text-text-primary font-bold mb-3">Tipo de entrega</Text>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setSelectedDelivery('pickup')}
                className={`flex-1 p-3 rounded-lg mr-2 ${
                  selectedDelivery === 'pickup'
                    ? 'bg-primary'
                    : 'bg-bg-secondary'
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    selectedDelivery === 'pickup' ? 'text-white' : 'text-text-primary'
                  }`}
                >
                  Recoger en tienda
                </Text>
                <Text
                  className={`text-center text-xs mt-1 ${
                    selectedDelivery === 'pickup' ? 'text-white/80' : 'text-text-secondary'
                  }`}
                >
                  Gratis
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedDelivery('delivery')}
                className={`flex-1 p-3 rounded-lg ${
                  selectedDelivery === 'delivery'
                    ? 'bg-primary'
                    : 'bg-bg-secondary'
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    selectedDelivery === 'delivery' ? 'text-white' : 'text-text-primary'
                  }`}
                >
                  Delivery
                </Text>
                <Text
                  className={`text-center text-xs mt-1 ${
                    selectedDelivery === 'delivery' ? 'text-white/80' : 'text-text-secondary'
                  }`}
                >
                  Costo adicional
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pharmacy List */}
          <View className="p-4">
            <Text className="text-text-secondary text-sm mb-3">
              Farmacias cercanas
            </Text>

            {pharmacies.map((pharmacy) => {
              const isDeliveryOnly = !pharmacy.deliveryAvailable && selectedDelivery === 'delivery';
              const isSelected = selectedPharmacy?.id === pharmacy.id;

              return (
                <TouchableOpacity
                  key={pharmacy.id}
                  onPress={() => !isDeliveryOnly && setSelectedPharmacy(pharmacy)}
                  disabled={isDeliveryOnly}
                  className={`bg-white rounded-xl p-4 mb-3 ${
                    isDeliveryOnly ? 'opacity-50' : ''
                  } ${isSelected ? 'border-2 border-primary' : ''}`}
                >
                  <View className="flex-row">
                    {/* Logo */}
                    <View className="w-16 h-16 bg-bg-secondary rounded-lg mr-3 items-center justify-center">
                      <Text className="text-text-primary text-2xl font-bold">
                        {pharmacy.name.charAt(0)}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-text-primary font-bold text-lg">
                          {pharmacy.name}
                        </Text>
                        {pharmacy.distance && (
                          <View className="bg-bg-secondary px-2 py-1 rounded">
                            <Text className="text-text-secondary text-sm">
                              {pharmacy.distance} km
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Delivery info */}
                      {pharmacy.deliveryAvailable ? (
                        <View className="flex-row items-center mt-1">
                          <Text className="text-success text-xs mr-1">🚚</Text>
                          <Text className="text-text-secondary text-sm mr-3">
                            Delivery disponible
                          </Text>
                          {selectedDelivery === 'delivery' && (
                            <Text className="text-text-secondary text-sm">
                              💲 ${pharmacy.deliveryFee.toFixed(2)} envío
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text className="text-text-secondary text-sm">
                          Solo recoger en tienda
                        </Text>
                      )}

                      {/* Delivery time */}
                      <View className="flex-row items-center mt-1">
                        <Text className="text-text-secondary text-xs mr-1">⏱️</Text>
                        <Text className="text-text-secondary text-sm">
                          {selectedDelivery === 'delivery'
                            ? `${pharmacy.estimatedDeliveryTime.min}-${pharmacy.estimatedDeliveryTime.max} horas`
                            : 'Listo en 1-2 horas'}
                        </Text>
                      </View>

                      {/* Operating hours */}
                      <Text className="text-text-secondary text-xs mt-1">
                        {formatOperatingHours(pharmacy)}
                      </Text>

                      {isSelected && (
                        <View className="mt-2 bg-primary/10 rounded-lg p-2">
                          <Text className="text-primary text-sm text-center font-medium">
                            ✓ Seleccionada - {getDeliveryLabel()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Continue Button */}
      <View className="bg-white p-4 border-t border-border-light">
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!selectedPharmacy || pharmaciesLoading}
          className={`p-4 rounded-lg ${
            !selectedPharmacy ? 'bg-bg-secondary' : 'bg-primary'
          }`}
        >
          <Text
            className={`text-center font-medium text-lg ${
              !selectedPharmacy ? 'text-text-secondary' : 'text-white'
            }`}
          >
            Continuar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
