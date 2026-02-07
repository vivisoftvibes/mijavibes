/**
 * SPEC-006: Order Tracking Screen
 *
 * Screen 4: Order Tracking
 * Shows real-time order status updates and delivery tracking
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePharmacyRefillStore } from '../store/usePharmacyRefillStore';
import type { PharmacyOrder, PrescriptionRefillStatus } from '../types';

type RouteParams = {
  PharmacyOrderTracking: {
    orderId: string;
  };
};

type StatusStep = {
  key: PrescriptionRefillStatus;
  label: string;
  icon: string;
};

const STATUS_STEPS: StatusStep[] = [
  { key: 'pending', label: 'Pedido confirmado', icon: '✓' },
  { key: 'confirmed', label: 'Preparando', icon: '✓' },
  { key: 'preparing', label: 'Listo para enviar', icon: '✓' },
  { key: 'ready', label: 'En camino', icon: '⏳' },
  { key: 'shipped', label: 'En entrega', icon: '⏳' },
  { key: 'delivered', label: 'Entregado', icon: '📦' },
];

export const PharmacyOrderTrackingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PharmacyOrderTracking'>>();
  const { orderId } = route.params;

  const {
    currentOrder,
    ordersLoading,
    loadOrderById,
    cancelOrder,
  } = usePharmacyRefillStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrderDetails();
    // Set up refresh interval
    const interval = setInterval(() => {
      if (currentOrder?.status !== 'delivered' && currentOrder?.status !== 'cancelled') {
        loadOrderDetails();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      await loadOrderById(orderId);
    } catch (error) {
      // Error handled by store
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrderDetails();
    setRefreshing(false);
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar pedido',
      '¿Estás seguro de que deseas cancelar este pedido?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelOrder(orderId, 'Cancelled by user');
            } catch (error) {
              Alert.alert('Error', 'No se pudo cancelar el pedido');
            }
          },
        },
      ]
    );
  };

  const handleContactDriver = () => {
    // In production, this would open phone or messaging app
    Alert.alert('Contactar repartidor', 'Funcionalidad próximamente disponible');
  };

  const getStatusIndex = () => {
    if (!currentOrder) return 0;
    const index = STATUS_STEPS.findIndex((step) => step.key === currentOrder.status);
    return index >= 0 ? index : 0;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  };

  const getEstimatedTime = () => {
    if (!currentOrder?.estimatedDelivery) return '';
    const date = new Date(currentOrder.estimatedDelivery);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins <= 0) return 'Llegando muy pronto';
    if (diffMins < 60) return `En aproximadamente ${diffMins} minutos`;
    return `Aproximadamente a las ${date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  if (ordersLoading && !currentOrder) {
    return (
      <View className="flex-1 bg-bg-secondary items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-text-secondary mt-4">Cargando pedido...</Text>
      </View>
    );
  }

  if (!currentOrder) {
    return (
      <View className="flex-1 bg-bg-secondary items-center justify-center p-8">
        <Text className="text-text-secondary text-center">
          No se pudo encontrar la información del pedido
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-primary px-6 py-3 rounded-lg mt-4"
        >
          <Text className="text-white font-medium">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStatusIndex = getStatusIndex();
  const isCancelled = currentOrder.status === 'cancelled';
  const isDelivered = currentOrder.status === 'delivered';
  const canCancel = ['pending', 'confirmed', 'preparing'].includes(currentOrder.status);

  return (
    <View className="flex-1 bg-bg-secondary">
      {/* Header */}
      <View className="bg-white pt-safe pb-4 px-4 border-b border-border-light">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
            <Text className="text-text-primary text-2xl">{'←'}</Text>
          </TouchableOpacity>
          <Text className="text-text-primary text-xl font-bold">
            Seguimiento del pedido
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={{
          refreshing,
          onRefresh: handleRefresh,
        }}
      >
        {/* Status Banner */}
        <View
          className={`p-4 ${
            isCancelled
              ? 'bg-error'
              : isDelivered
              ? 'bg-success'
              : 'bg-info'
          }`}
        >
          <View className="flex-row items-center">
            <Text className="text-white text-2xl mr-3">
              {isCancelled ? '✕' : isDelivered ? '✓' : '📍'}
            </Text>
            <View className="flex-1">
              <Text className="text-white font-bold text-lg">
                {isCancelled
                  ? 'Pedido cancelado'
                  : isDelivered
                  ? 'Pedido entregado'
                  : currentOrder.deliveryType === 'delivery'
                  ? 'Tu pedido está en camino'
                  : 'Tu pedido está siendo preparado'}
              </Text>
              {!isCancelled && !isDelivered && (
                <Text className="text-white/80">
                  {getEstimatedTime()}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Order ID */}
        <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-text-secondary text-sm">Número de pedido</Text>
              <Text className="text-text-primary font-bold text-lg">
                {currentOrder.orderId || currentOrder.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
            <View className="text-right">
              <Text className="text-text-secondary text-sm">Fecha</Text>
              <Text className="text-text-primary">
                {formatDateTime(currentOrder.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Timeline */}
        <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
          <Text className="text-text-primary font-bold mb-4">Estado del pedido</Text>

          {STATUS_STEPS.slice(0, currentOrder.deliveryType === 'pickup' ? 4 : 6).map((step, index) => {
            const isComplete = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;

            return (
              <View key={step.key} className="flex-row mb-4">
                <View className="items-center mr-4">
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      isComplete ? 'bg-success' : 'bg-bg-secondary'
                    }`}
                  >
                    <Text className="text-white text-sm">{step.icon}</Text>
                  </View>
                  {index < STATUS_STEPS.length - 1 && (
                    <View
                      className={`w-0.5 h-8 ${
                        isComplete ? 'bg-success' : 'bg-border-light'
                      }`}
                    />
                  )}
                </View>

                <View className="flex-1 pb-4">
                  <Text
                    className={`font-medium ${
                      isCurrent ? 'text-primary' : 'text-text-primary'
                    }`}
                  >
                    {step.label}
                  </Text>
                  <Text className="text-text-secondary text-sm">
                    {isComplete ? 'Completado' : 'Pendiente'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Pharmacy Info */}
        {currentOrder.pharmacy && (
          <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
            <Text className="text-text-primary font-bold mb-3">Farmacia</Text>
            <Text className="text-text-primary">{currentOrder.pharmacy.name}</Text>
            <Text className="text-text-secondary text-sm">
              {currentOrder.pharmacy.address}
            </Text>
            {currentOrder.pharmacy.phone && (
              <TouchableOpacity
                onPress={() => {
                  // In production, call the pharmacy
                  Alert.alert('Llamar', `¿Llamar a ${currentOrder.pharmacy?.phone}?`);
                }}
                className="mt-3 bg-primary/10 p-3 rounded-lg"
              >
                <Text className="text-primary text-center font-medium">
                  📞 Contactar farmacia
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Order Items */}
        {currentOrder.items && currentOrder.items.length > 0 && (
          <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
            <Text className="text-text-primary font-bold mb-3">Productos</Text>
            {currentOrder.items.map((item, index) => (
              <View
                key={index}
                className="flex-row justify-between py-2 border-b border-border-light last:border-0"
              >
                <Text className="text-text-primary">{item.name}</Text>
                <Text className="text-text-secondary">x{item.quantity}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Driver Location (for delivery) */}
        {currentOrder.deliveryType === 'delivery' &&
          ['shipped', 'delivered'].includes(currentOrder.status) && (
            <View className="bg-white mx-4 mt-4 p-4 rounded-xl">
              <Text className="text-text-primary font-bold mb-3">
                Ubicación del repartidor
              </Text>

              {/* Map placeholder */}
              <View className="bg-bg-secondary rounded-lg h-40 items-center justify-center mb-3">
                <Text className="text-text-secondary">Mapa de ubicación</Text>
              </View>

              <TouchableOpacity
                onPress={handleContactDriver}
                className="bg-primary p-3 rounded-lg"
              >
                <Text className="text-white text-center font-medium">
                  📞 Contactar repartidor
                </Text>
              </TouchableOpacity>
            </View>
          )}

        {/* Cancel Button */}
        {canCancel && (
          <View className="mx-4 mt-4 mb-8">
            <TouchableOpacity
              onPress={handleCancel}
              className="bg-error/10 p-4 rounded-lg border border-error"
            >
              <Text className="text-error text-center font-medium">
                Cancelar pedido
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
