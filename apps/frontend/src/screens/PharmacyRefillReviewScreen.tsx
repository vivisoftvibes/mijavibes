/**
 * SPEC-006: Order Review Screen
 *
 * Screen 3: Order Review
 * Shows order summary before confirmation
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
import { useMedicationStore } from '../store/useMedicationStore';
import type { PharmacyPartner, DeliveryType, PaymentMethod } from '../types';

type RouteParams = {
  PharmacyRefillReview: {
    medicationIds: string[];
    pharmacyId: string;
    deliveryType: DeliveryType;
  };
};

export const PharmacyRefillReviewScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PharmacyRefillReview'>>();
  const { medicationIds, pharmacyId, deliveryType } = route.params;

  const {
    pharmacies,
    paymentMethods,
    ordersLoading,
    createOrder,
    loadPaymentMethods,
  } = usePharmacyRefillStore();

  const { medications } = useMedicationStore();

  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');

  const pharmacy = pharmacies.find((p) => p.id === pharmacyId);
  const orderMedications = medications.filter((m) => medicationIds.includes(m.id));

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  useEffect(() => {
    // Set default payment method
    const defaultPayment = paymentMethods.find((pm) => pm.isDefault);
    if (defaultPayment) {
      setSelectedPayment(defaultPayment);
    } else if (paymentMethods.length > 0) {
      setSelectedPayment(paymentMethods[0]);
    }
  }, [paymentMethods]);

  const calculateTotal = () => {
    let total = 0;
    orderMedications.forEach((med) => {
      // Mock prices based on medication
      const price = med.name.length * 10 + 50; // Simple mock pricing
      total += price * 30; // 30-day supply
    });
    if (deliveryType === 'delivery' && pharmacy) {
      total += pharmacy.deliveryFee;
    }
    return total;
  };

  const handleConfirmOrder = async () => {
    if (deliveryType === 'delivery' && !deliveryAddress) {
      Alert.alert('Dirección requerida', 'Por favor ingresa tu dirección de entrega');
      return;
    }

    try {
      const order = await createOrder({
        medicationIds,
        pharmacyId,
        deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? deliveryAddress : undefined,
        paymentMethodId: selectedPayment?.id,
        notes,
      });

      // Navigate to tracking screen
      navigation.navigate('PharmacyOrderTracking' as never, {
        orderId: order.id,
      } as never);
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el pedido. Por favor intenta de nuevo.');
    }
  };

  const formatEstimatedTime = () => {
    if (!pharmacy) return '';
    if (deliveryType === 'delivery') {
      return `${pharmacy.estimatedDeliveryTime.min}-${pharmacy.estimatedDeliveryTime.max} horas`;
    }
    return '1-2 horas';
  };

  const getPaymentLabel = (payment: PaymentMethod) => {
    switch (payment.type) {
      case 'cash':
        return 'Efectivo (al entregar)';
      case 'credit_card':
      case 'debit_card':
        return `Tarjeta terminada en ****${payment.cardLast4}`;
      case 'insurance':
        return payment.insuranceProvider || 'Seguro';
      default:
        return payment.type;
    }
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
            Confirmar pedido
          </Text>
        </View>
      </View>

      {ordersLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <ScrollView className="flex-1">
          {/* Pharmacy Info */}
          {pharmacy && (
            <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
              <View className="flex-row items-center mb-3">
                <View className="w-12 h-12 bg-bg-secondary rounded-lg mr-3 items-center justify-center">
                  <Text className="text-text-primary text-xl font-bold">
                    {pharmacy.name.charAt(0)}
                  </Text>
                </View>
                <View>
                  <Text className="text-text-primary font-bold">{pharmacy.name}</Text>
                  <Text className="text-text-secondary text-sm">{pharmacy.address}</Text>
                </View>
              </View>

              <View className="flex-row items-center pt-3 border-t border-border-light">
                <Text className="text-text-secondary mr-2">
                  {deliveryType === 'delivery' ? '🚚' : '📍'}
                </Text>
                <Text className="text-text-primary">
                  {deliveryType === 'delivery' ? 'Delivery a domicilio' : 'Recoger en tienda'}
                </Text>
              </View>

              <View className="flex-row items-center mt-2">
                <Text className="text-text-secondary mr-2">⏱️</Text>
                <Text className="text-text-primary">
                  Llegada estimada: {formatEstimatedTime()}
                </Text>
              </View>
            </View>
          )}

          {/* Medications */}
          <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
            <Text className="text-text-primary font-bold mb-3">Pedido:</Text>

            {orderMedications.map((medication) => {
              const price = medication.name.length * 10 + 50;
              const itemTotal = price * 30;

              return (
                <View key={medication.id} className="py-3 border-b border-border-light">
                  <View className="flex-row">
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
                      <Text className="text-text-primary font-medium">{medication.name}</Text>
                      <Text className="text-text-secondary text-sm">{medication.dosage}</Text>
                      <Text className="text-text-secondary text-sm mt-1">
                        Suministro para 30 días
                      </Text>
                    </View>

                    <Text className="text-text-primary font-medium">
                      ${itemTotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Delivery Fee */}
            {deliveryType === 'delivery' && pharmacy && (
              <View className="flex-row justify-between py-3">
                <Text className="text-text-secondary">Envío:</Text>
                <Text className="text-text-primary">
                  ${pharmacy.deliveryFee.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Total */}
            <View className="flex-row justify-between py-3 border-t border-border-light mt-2">
              <Text className="text-text-primary font-bold text-lg">Total:</Text>
              <Text className="text-primary font-bold text-lg">
                ${calculateTotal().toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Delivery Address */}
          {deliveryType === 'delivery' && (
            <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
              <Text className="text-text-primary font-bold mb-3">
                Dirección de entrega
              </Text>
              <TouchableOpacity className="border border-border-light rounded-lg p-3">
                <Text className="text-text-secondary">
                  {deliveryAddress || 'Ingresa tu dirección'}
                </Text>
              </TouchableOpacity>
              <TextInput
                className="border border-border-light rounded-lg p-3 mt-2"
                placeholder="Calle, número, colonia, CP"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
              />
            </View>
          )}

          {/* Payment Method */}
          <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
            <Text className="text-text-primary font-bold mb-3">
              Método de pago
            </Text>

            <View className="space-y-2">
              {/* Cash option */}
              <TouchableOpacity
                onPress={() =>
                  setSelectedPayment({
                    id: 'cash',
                    userId: '',
                    type: 'cash',
                    isDefault: false,
                    isActive: true,
                  } as PaymentMethod)
                }
                className={`flex-row items-center p-3 rounded-lg border ${
                  selectedPayment?.type === 'cash' && !selectedPayment?.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border-light'
                }`}
              >
                <View
                  className={`w-5 h-5 rounded-full border-2 mr-3 ${
                    selectedPayment?.type === 'cash' && !selectedPayment?.id
                      ? 'border-primary bg-primary'
                      : 'border-border-light'
                  }`}
                >
                  {selectedPayment?.type === 'cash' && !selectedPayment?.id && (
                    <View className="w-2.5 h-2.5 bg-white rounded-full self-center mt-0.5" />
                  )}
                </View>
                <Text className="text-text-primary flex-1">
                  Efectivo (al entregar)
                </Text>
              </TouchableOpacity>

              {/* Saved payment methods */}
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  onPress={() => setSelectedPayment(method)}
                  className={`flex-row items-center p-3 rounded-lg border ${
                    selectedPayment?.id === method.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border-light'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 mr-3 ${
                      selectedPayment?.id === method.id
                        ? 'border-primary bg-primary'
                        : 'border-border-light'
                    }`}
                  >
                    {selectedPayment?.id === method.id && (
                      <View className="w-2.5 h-2.5 bg-white rounded-full self-center mt-0.5" />
                    )}
                  </View>
                  <Text className="text-text-primary flex-1">
                    {getPaymentLabel(method)}
                  </Text>
                  {method.isDefault && (
                    <View className="bg-bg-secondary px-2 py-1 rounded">
                      <Text className="text-text-secondary text-xs">Predeterminado</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {/* Add new payment method */}
              <TouchableOpacity
                onPress={() => navigation.navigate('PharmacyPaymentMethods' as never)}
                className="flex-row items-center p-3 rounded-lg border border-dashed border-border-light"
              >
                <Text className="text-primary mr-2">+</Text>
                <Text className="text-primary">Agregar método de pago</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes */}
          <View className="bg-white mx-4 mt-4 mb-4 p-4 rounded-xl">
            <Text className="text-text-primary font-bold mb-3">
              Notas adicionales (opcional)
            </Text>
            <TextInput
              className="border border-border-light rounded-lg p-3"
              placeholder="Instrucciones especiales para la farmacia..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>
      )}

      {/* Confirm Button */}
      <View className="bg-white p-4 border-t border-border-light">
        <TouchableOpacity
          onPress={handleConfirmOrder}
          disabled={ordersLoading}
          className="bg-primary p-4 rounded-lg"
        >
          <Text className="text-white font-medium text-lg text-center">
            Confirmar pedido
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Add TextInput import
import { TextInput } from 'react-native';
