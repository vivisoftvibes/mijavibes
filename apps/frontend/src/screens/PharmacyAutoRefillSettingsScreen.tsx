/**
 * SPEC-006: Auto-Refill Settings Screen
 *
 * Screen for configuring auto-refill settings for medications
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePharmacyRefillStore } from '../store/usePharmacyRefillStore';
import { useMedicationStore } from '../store/useMedicationStore';
import type { AutoRefillSettings, PharmacyPartner, PaymentMethod } from '../types';

type RouteParams = {
  PharmacyAutoRefillSettings: {
    medicationId: string;
  };
};

export const PharmacyAutoRefillSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PharmacyAutoRefillSettings'>>();
  const { medicationId } = route.params;

  const {
    pharmacies,
    paymentMethods,
    autoRefillSettings,
    autoRefillLoading,
    loadPharmacies,
    loadPaymentMethods,
    loadAutoRefillSettings,
    updateAutoRefillSettings,
  } = usePharmacyRefillStore();

  const { medications } = useMedicationStore();

  const [enabled, setEnabled] = useState(false);
  const [triggerDays, setTriggerDays] = useState(7);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyPartner | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(true);
  const [saving, setSaving] = useState(false);

  const medication = medications.find((m) => m.id === medicationId);
  const settings = autoRefillSettings.find((s) => s.medicationId === medicationId);

  useEffect(() => {
    // Load required data
    Promise.all([loadPharmacies(), loadPaymentMethods(), loadAutoRefillSettings()]);
  }, []);

  useEffect(() => {
    // Set form values from existing settings
    if (settings) {
      setEnabled(settings.enabled);
      setTriggerDays(settings.triggerDays);
      setConfirmationRequired(settings.confirmationRequired);

      if (settings.preferredPharmacyId) {
        const pharmacy = pharmacies.find((p) => p.id === settings.preferredPharmacyId);
        setSelectedPharmacy(pharmacy || null);
      }

      if (settings.paymentMethodId) {
        const payment = paymentMethods.find((pm) => pm.id === settings.paymentMethodId);
        setSelectedPayment(payment || null);
      }
    }
  }, [settings, pharmacies, paymentMethods]);

  const handleSave = async () => {
    if (!enabled) {
      try {
        setSaving(true);
        await updateAutoRefillSettings(medicationId, {
          enabled: false,
          triggerDays: 7,
        });
        Alert.alert('Éxito', 'Configuración guardada correctamente');
        navigation.goBack();
      } catch (error) {
        Alert.alert('Error', 'No se pudo guardar la configuración');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Validate required fields
    if (!selectedPharmacy) {
      Alert.alert('Farmacia requerida', 'Por favor selecciona una farmacia preferida');
      return;
    }

    try {
      setSaving(true);
      await updateAutoRefillSettings(medicationId, {
        enabled,
        triggerDays,
        preferredPharmacyId: selectedPharmacy.id,
        paymentMethodId: selectedPayment?.id,
        confirmationRequired,
      });
      Alert.alert('Éxito', 'Auto-surtido configurado correctamente');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const getUrgencyLabel = (days: number) => {
    if (days <= 3) return 'Crítico (0-3 días)';
    if (days <= 7) return 'Urgente (4-7 días)';
    return 'Con tiempo (8+ días)';
  };

  if (autoRefillLoading && !settings) {
    return (
      <View className="flex-1 bg-bg-secondary items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-secondary">
      {/* Header */}
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-text-primary text-2xl">{'←'}</Text>
          </TouchableOpacity>
          <Text className="text-text-primary text-xl font-bold">
            Auto-surtido
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Medication Info */}
        {medication && (
          <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
            <Text className="text-text-secondary text-sm mb-1">Medicamento</Text>
            <Text className="text-text-primary font-bold text-lg">{medication.name}</Text>
            <Text className="text-text-secondary">{medication.dosage}</Text>
          </View>
        )}

        {/* Enable Auto-Refill */}
        <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-text-primary font-bold">Activar auto-surtido</Text>
              <Text className="text-text-secondary text-sm">
                Pedir receta automáticamente cuando quede poco suministro
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {enabled && (
          <>
            {/* Trigger Days */}
            <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
              <Text className="text-text-primary font-bold mb-3">
                ¿Cuándo pedir el surtido?
              </Text>
              <Text className="text-text-secondary text-sm mb-4">
                Pedir automáticamente cuando queden estos días de suministro
              </Text>

              <View className="space-y-2">
                {[3, 5, 7, 10, 14].map((days) => (
                  <TouchableOpacity
                    key={days}
                    onPress={() => setTriggerDays(days)}
                    className={`flex-row items-center p-3 rounded-lg border ${
                      triggerDays === days
                        ? 'border-primary bg-primary/5'
                        : 'border-border-light'
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 mr-3 ${
                        triggerDays === days
                          ? 'border-primary bg-primary'
                          : 'border-border-light'
                      }`}
                    >
                      {triggerDays === days && (
                        <View className="w-2.5 h-2.5 bg-white rounded-full self-center mt-0.5" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-text-primary">{days} días restantes</Text>
                      <Text className="text-text-secondary text-xs">
                        {getUrgencyLabel(days)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preferred Pharmacy */}
            <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
              <Text className="text-text-primary font-bold mb-3">
                Farmacia preferida
              </Text>
              <Text className="text-text-secondary text-sm mb-3">
                Selecciona la farmacia para tus pedidos automáticos
              </Text>

              {pharmacies.slice(0, 5).map((pharmacy) => (
                <TouchableOpacity
                  key={pharmacy.id}
                  onPress={() => setSelectedPharmacy(pharmacy)}
                  className={`flex-row items-center p-3 rounded-lg border mb-2 ${
                    selectedPharmacy?.id === pharmacy.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border-light'
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 mr-3 ${
                      selectedPharmacy?.id === pharmacy.id
                        ? 'border-primary bg-primary'
                        : 'border-border-light'
                    }`}
                  >
                    {selectedPharmacy?.id === pharmacy.id && (
                      <View className="w-2.5 h-2.5 bg-white rounded-full self-center mt-0.5" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-primary">{pharmacy.name}</Text>
                    {pharmacy.distance && (
                      <Text className="text-text-secondary text-xs">
                        {pharmacy.distance} km de distancia
                      </Text>
                    )}
                  </View>
                  {pharmacy.deliveryAvailable ? (
                    <Text className="text-success text-xs">🚚 Delivery</Text>
                  ) : (
                    <Text className="text-text-secondary text-xs">Solo recoger</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Payment Method */}
            <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
              <Text className="text-text-primary font-bold mb-3">
                Método de pago
              </Text>
              <Text className="text-text-secondary text-sm mb-3">
                Selecciona cómo pagar los pedidos automáticos
              </Text>

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
                className={`flex-row items-center p-3 rounded-lg border mb-2 ${
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

              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  onPress={() => setSelectedPayment(method)}
                  className={`flex-row items-center p-3 rounded-lg border mb-2 ${
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
                    {method.type === 'credit_card' || method.type === 'debit_card'
                      ? `Tarjeta ****${method.cardLast4}`
                      : method.insuranceProvider || 'Seguro'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Confirmation Required */}
            <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-text-primary font-bold">
                    Requerir confirmación
                  </Text>
                  <Text className="text-text-secondary text-sm">
                    Enviarte notificación antes de hacer el pedido
                  </Text>
                </View>
                <Switch
                  value={confirmationRequired}
                  onValueChange={setConfirmationRequired}
                  trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {!confirmationRequired && (
                <View className="mt-3 bg-warning/10 p-3 rounded-lg">
                  <Text className="text-warning text-sm">
                    ⚠️ Sin confirmación, el pedido se hará automáticamente
                  </Text>
                </View>
              )}
            </View>

            {/* Info Box */}
            <View className="bg-info/10 mx-4 mt-4 p-4 rounded-xl">
              <Text className="text-info font-bold mb-2">¿Cómo funciona?</Text>
              <Text className="text-text-secondary text-sm">
                Cuando tu suministro reach {triggerDays} días o menos, crearemos
                automáticamente un pedido en {selectedPharmacy?.name || 'tu farmacia'}.
                {confirmationRequired
                  ? ' Recibirás una notificación para confirmar antes de procesar.'
                  : ' El pedido se procesará sin necesidad de confirmación.'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Save Button */}
      <View className="bg-white p-4 border-t border-border-light">
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-primary p-4 rounded-lg"
        >
          <Text className="text-white font-medium text-lg text-center">
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
