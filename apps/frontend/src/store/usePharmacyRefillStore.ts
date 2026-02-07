/**
 * SPEC-006: Pharmacy Refill Store
 *
 * Zustand store for pharmacy refill state management
 */

import { create } from 'zustand';
import type {
  PharmacyPartner,
  MedicationInventory,
  SupplyAlert,
  PharmacyOrder,
  PaymentMethod,
  AutoRefillSettings,
  DeliveryType,
} from '../types';
import { pharmacyRefillService } from '../services/pharmacyRefill';

interface PharmacyRefillState {
  // Pharmacy partners
  pharmacies: PharmacyPartner[];
  pharmaciesLoading: boolean;
  pharmaciesError: string | null;

  // Inventory
  inventory: MedicationInventory[];
  inventoryLoading: boolean;

  // Supply alerts
  alerts: SupplyAlert[];
  alertsLoading: boolean;

  // Orders
  orders: PharmacyOrder[];
  currentOrder: PharmacyOrder | null;
  orderHistory: PharmacyOrder[];
  ordersLoading: boolean;

  // Payment methods
  paymentMethods: PaymentMethod[];
  paymentMethodsLoading: boolean;

  // Auto-refill settings
  autoRefillSettings: AutoRefillSettings[];
  autoRefillLoading: boolean;

  // General state
  error: string | null;
  isRefreshing: boolean;

  // Actions
  loadPharmacies: (lat?: number, lng?: number) => Promise<void>;
  loadInventory: () => Promise<void>;
  loadAlerts: (includeAcknowledged?: boolean) => Promise<void>;
  checkAlerts: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  loadOrders: (status?: string) => Promise<void>;
  loadOrderHistory: () => Promise<void>;
  loadOrderById: (orderId: string) => Promise<void>;
  createOrder: (data: {
    medicationIds: string[];
    pharmacyId?: string;
    deliveryType: DeliveryType;
    deliveryAddress?: string;
    paymentMethodId?: string;
    notes?: string;
  }) => Promise<PharmacyOrder>;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;
  loadPaymentMethods: () => Promise<void>;
  addPaymentMethod: (data: {
    type: 'cash' | 'credit_card' | 'debit_card' | 'insurance';
    cardLast4?: string;
    cardBrand?: string;
    insuranceProvider?: string;
    isDefault?: boolean;
  }) => Promise<PaymentMethod>;
  deletePaymentMethod: (methodId: string) => Promise<void>;
  setDefaultPaymentMethod: (methodId: string) => Promise<void>;
  loadAutoRefillSettings: () => Promise<void>;
  updateAutoRefillSettings: (
    medicationId: string,
    data: {
      enabled: boolean;
      triggerDays?: number;
      preferredPharmacyId?: string;
      paymentMethodId?: string;
      confirmationRequired?: boolean;
    }
  ) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export const usePharmacyRefillStore = create<PharmacyRefillState>((set, get) => ({
  // Initial state
  pharmacies: [],
  pharmaciesLoading: false,
  pharmaciesError: null,
  inventory: [],
  inventoryLoading: false,
  alerts: [],
  alertsLoading: false,
  orders: [],
  currentOrder: null,
  orderHistory: [],
  ordersLoading: false,
  paymentMethods: [],
  paymentMethodsLoading: false,
  autoRefillSettings: [],
  autoRefillLoading: false,
  error: null,
  isRefreshing: false,

  // Pharmacy partners
  loadPharmacies: async (lat?: number, lng?: number) => {
    set({ pharmaciesLoading: true, pharmaciesError: null });
    try {
      const pharmacies = await pharmacyRefillService.partners.getPharmacies(lat, lng);
      set({ pharmacies, pharmaciesLoading: false });
    } catch (error: any) {
      set({
        pharmaciesError: error.error || 'Failed to load pharmacies',
        pharmaciesLoading: false,
      });
    }
  },

  // Inventory
  loadInventory: async () => {
    set({ inventoryLoading: true });
    try {
      const inventory = await pharmacyRefillService.inventory.getInventory();
      set({ inventory, inventoryLoading: false });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load inventory', inventoryLoading: false });
    }
  },

  // Supply alerts
  loadAlerts: async (includeAcknowledged = false) => {
    set({ alertsLoading: true });
    try {
      const alerts = await pharmacyRefillService.alerts.getAlerts(includeAcknowledged);
      set({ alerts, alertsLoading: false });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load alerts', alertsLoading: false });
    }
  },

  checkAlerts: async () => {
    try {
      const newAlerts = await pharmacyRefillService.alerts.checkAlerts();
      if (newAlerts.length > 0) {
        set((state) => ({ alerts: [...newAlerts, ...state.alerts] }));
      }
    } catch (error: any) {
      set({ error: error.error || 'Failed to check alerts' });
    }
  },

  acknowledgeAlert: async (alertId: string) => {
    try {
      await pharmacyRefillService.alerts.acknowledgeAlert(alertId);
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === alertId ? { ...a, acknowledged: true } : a
        ),
      }));
    } catch (error: any) {
      set({ error: error.error || 'Failed to acknowledge alert' });
      throw error;
    }
  },

  // Orders
  loadOrders: async (status?: string) => {
    set({ ordersLoading: true });
    try {
      const orders = await pharmacyRefillService.orders.getOrders({ status });
      set({ orders, ordersLoading: false });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load orders', ordersLoading: false });
    }
  },

  loadOrderHistory: async () => {
    set({ ordersLoading: true });
    try {
      const orderHistory = await pharmacyRefillService.orders.getOrderHistory(20);
      set({ orderHistory, ordersLoading: false });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load order history', ordersLoading: false });
    }
  },

  loadOrderById: async (orderId: string) => {
    set({ ordersLoading: true });
    try {
      const order = await pharmacyRefillService.orders.getOrderById(orderId);
      set({ currentOrder: order, ordersLoading: false });
    } catch (error: any) {
      set({ error: error.error || 'Failed to load order', ordersLoading: false });
      throw error;
    }
  },

  createOrder: async (data) => {
    set({ ordersLoading: true, error: null });
    try {
      const order = await pharmacyRefillService.orders.createOrder(data);
      set((state) => ({
        orders: [order, ...state.orders],
        currentOrder: order,
        ordersLoading: false,
      }));
      return order;
    } catch (error: any) {
      set({
        error: error.error || 'Failed to create order',
        ordersLoading: false,
      });
      throw error;
    }
  },

  cancelOrder: async (orderId: string, reason?: string) => {
    try {
      const order = await pharmacyRefillService.orders.cancelOrder(orderId, reason);
      set((state) => ({
        orders: state.orders.map((o) => (o.id === orderId ? order : o)),
        currentOrder: state.currentOrder?.id === orderId ? order : state.currentOrder,
      }));
    } catch (error: any) {
      set({ error: error.error || 'Failed to cancel order' });
      throw error;
    }
  },

  // Payment methods
  loadPaymentMethods: async () => {
    set({ paymentMethodsLoading: true });
    try {
      const methods = await pharmacyRefillService.payments.getPaymentMethods();
      set({ paymentMethods: methods, paymentMethodsLoading: false });
    } catch (error: any) {
      set({
        error: error.error || 'Failed to load payment methods',
        paymentMethodsLoading: false,
      });
    }
  },

  addPaymentMethod: async (data) => {
    try {
      const method = await pharmacyRefillService.payments.createPaymentMethod({
        ...data,
        cardToken: 'mock_token', // In production, get from payment processor
      });
      set((state) => ({
        paymentMethods: [...state.paymentMethods, method],
      }));
      return method;
    } catch (error: any) {
      set({ error: error.error || 'Failed to add payment method' });
      throw error;
    }
  },

  deletePaymentMethod: async (methodId: string) => {
    try {
      await pharmacyRefillService.payments.deletePaymentMethod(methodId);
      set((state) => ({
        paymentMethods: state.paymentMethods.filter((m) => m.id !== methodId),
      }));
    } catch (error: any) {
      set({ error: error.error || 'Failed to delete payment method' });
      throw error;
    }
  },

  setDefaultPaymentMethod: async (methodId: string) => {
    try {
      const method = await pharmacyRefillService.payments.setDefaultPaymentMethod(methodId);
      set((state) => ({
        paymentMethods: state.paymentMethods.map((m) =>
          m.id === methodId ? method : { ...m, isDefault: false }
        ),
      }));
    } catch (error: any) {
      set({ error: error.error || 'Failed to set default payment method' });
      throw error;
    }
  },

  // Auto-refill settings
  loadAutoRefillSettings: async () => {
    set({ autoRefillLoading: true });
    try {
      const settings = await pharmacyRefillService.autoRefill.getSettings();
      set({ autoRefillSettings: settings, autoRefillLoading: false });
    } catch (error: any) {
      set({
        error: error.error || 'Failed to load auto-refill settings',
        autoRefillLoading: false,
      });
    }
  },

  updateAutoRefillSettings: async (medicationId, data) => {
    try {
      const setting = await pharmacyRefillService.autoRefill.upsertSettings(
        medicationId,
        data
      );
      set((state) => {
        const index = state.autoRefillSettings.findIndex(
          (s) => s.medicationId === medicationId
        );
        if (index >= 0) {
          const updated = [...state.autoRefillSettings];
          updated[index] = setting;
          return { autoRefillSettings: updated };
        } else {
          return {
            autoRefillSettings: [...state.autoRefillSettings, setting],
          };
        }
      });
    } catch (error: any) {
      set({ error: error.error || 'Failed to update auto-refill settings' });
      throw error;
    }
  },

  // Refresh all data
  refresh: async () => {
    set({ isRefreshing: true });
    await Promise.all([
      get().loadPharmacies(),
      get().loadInventory(),
      get().loadAlerts(),
      get().loadOrders(),
      get().loadPaymentMethods(),
      get().loadAutoRefillSettings(),
    ]);
    set({ isRefreshing: false });
  },

  clearError: () => set({ error: null }),
}));
