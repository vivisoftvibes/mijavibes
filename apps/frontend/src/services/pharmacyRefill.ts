/**
 * SPEC-006: Pharmacy Refill Service
 *
 * Frontend service for pharmacy refill operations
 */

import { apiClient } from './api';
import type {
  PharmacyPartner,
  MedicationInventory,
  SupplyAlert,
  PharmacyOrder,
  PaymentMethod,
  AutoRefillSettings,
  DeliveryType,
} from '../types';

// ============================================================================
// Pharmacy Partners
// ============================================================================

export const pharmacyPartnerService = {
  /**
   * Get pharmacy partners sorted by distance
   */
  async getPharmacies(lat?: number, lng?: number): Promise<PharmacyPartner[]> {
    const params: Record<string, string> = {};
    if (lat !== undefined) params.lat = lat.toString();
    if (lng !== undefined) params.lng = lng.toString();

    const response = await apiClient.get('/pharmacy-refill/partners', { params });
    return response.data.pharmacies;
  },

  /**
   * Get pharmacy partner details
   */
  async getPharmacyById(pharmacyId: string): Promise<PharmacyPartner> {
    const response = await apiClient.get(`/pharmacy-refill/partners/${pharmacyId}`);
    return response.data.pharmacy;
  },
};

// ============================================================================
// Medication Inventory
// ============================================================================

export const medicationInventoryService = {
  /**
   * Get user's medication inventory
   */
  async getInventory(): Promise<MedicationInventory[]> {
    const response = await apiClient.get('/pharmacy-refill/inventory');
    return response.data.inventory;
  },

  /**
   * Get inventory for a specific medication
   */
  async getMedicationInventory(medicationId: string): Promise<MedicationInventory | null> {
    const inventory = await this.getInventory();
    return inventory.find((i) => i.medicationId === medicationId) || null;
  },

  /**
   * Update medication inventory
   */
  async updateInventory(
    medicationId: string,
    data: {
      currentSupply?: number;
      lastRefillDate?: Date;
      nextRefillDate?: Date;
      preferredPharmacyId?: string;
    }
  ): Promise<MedicationInventory> {
    const response = await apiClient.put(
      `/pharmacy-refill/inventory/${medicationId}`,
      data
    );
    return response.data.inventory;
  },
};

// ============================================================================
// Supply Alerts
// ============================================================================

export const supplyAlertService = {
  /**
   * Get user's supply alerts
   */
  async getAlerts(includeAcknowledged = false): Promise<SupplyAlert[]> {
    const response = await apiClient.get('/pharmacy-refill/alerts', {
      params: { includeAcknowledged },
    });
    return response.data.alerts;
  },

  /**
   * Check and create supply alerts for low supply medications
   */
  async checkAlerts(): Promise<SupplyAlert[]> {
    const response = await apiClient.post('/pharmacy-refill/alerts/check');
    return response.data.alerts;
  },

  /**
   * Acknowledge a supply alert
   */
  async acknowledgeAlert(alertId: string): Promise<SupplyAlert> {
    const response = await apiClient.post(
      `/pharmacy-refill/alerts/${alertId}/acknowledge`
    );
    return response.data.alert;
  },
};

// ============================================================================
// Pharmacy Orders
// ============================================================================

export const pharmacyOrderService = {
  /**
   * Create a new pharmacy order
   */
  async createOrder(data: {
    medicationIds: string[];
    pharmacyId?: string;
    deliveryType: DeliveryType;
    deliveryAddress?: string;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    scheduledFor?: Date;
    paymentMethodId?: string;
    prescriptionUrls?: string[];
    notes?: string;
  }): Promise<PharmacyOrder> {
    const response = await apiClient.post('/pharmacy-refill/orders', data);
    return response.data.order;
  },

  /**
   * Get user's orders
   */
  async getOrders(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PharmacyOrder[]> {
    const response = await apiClient.get('/pharmacy-refill/orders', {
      params: filters,
    });
    return response.data.orders;
  },

  /**
   * Get order history
   */
  async getOrderHistory(limit = 20): Promise<PharmacyOrder[]> {
    const response = await apiClient.get('/pharmacy-refill/orders/history', {
      params: { limit },
    });
    return response.data.orders;
  },

  /**
   * Get order details
   */
  async getOrderById(orderId: string): Promise<PharmacyOrder> {
    const response = await apiClient.get(`/pharmacy-refill/orders/${orderId}`);
    return response.data.order;
  },

  /**
   * Get order status history
   */
  async getOrderStatusHistory(orderId: string): Promise<
    Array<{ status: string; notes?: string; createdAt: string }>
  > {
    const response = await apiClient.get(
      `/pharmacy-refill/orders/${orderId}/status-history`
    );
    return response.data.history;
  },

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    notes?: string
  ): Promise<PharmacyOrder> {
    const response = await apiClient.patch(
      `/pharmacy-refill/orders/${orderId}/status`,
      { status, notes }
    );
    return response.data.order;
  },

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<PharmacyOrder> {
    const response = await apiClient.post(
      `/pharmacy-refill/orders/${orderId}/cancel`,
      { reason }
    );
    return response.data.order;
  },

  /**
   * Update driver location
   */
  async updateDriverLocation(
    orderId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    await apiClient.put(`/pharmacy-refill/orders/${orderId}/driver-location`, {
      latitude,
      longitude,
    });
  },
};

// ============================================================================
// Payment Methods
// ============================================================================

export const paymentMethodService = {
  /**
   * Get user's payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await apiClient.get('/pharmacy-refill/payment-methods');
    return response.data.paymentMethods;
  },

  /**
   * Create a new payment method
   */
  async createPaymentMethod(data: {
    type: 'cash' | 'credit_card' | 'debit_card' | 'insurance';
    isDefault?: boolean;
    cardLast4?: string;
    cardBrand?: string;
    cardExpiryMonth?: number;
    cardExpiryYear?: number;
    cardToken?: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
    insuranceMemberId?: string;
  }): Promise<PaymentMethod> {
    const response = await apiClient.post(
      '/pharmacy-refill/payment-methods',
      data
    );
    return response.data.paymentMethod;
  },

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(methodId: string): Promise<void> {
    await apiClient.delete(`/pharmacy-refill/payment-methods/${methodId}`);
  },

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(methodId: string): Promise<PaymentMethod> {
    const response = await apiClient.post(
      `/pharmacy-refill/payment-methods/${methodId}/set-default`
    );
    return response.data.paymentMethod;
  },
};

// ============================================================================
// Auto-Refill Settings
// ============================================================================

export const autoRefillService = {
  /**
   * Get user's auto-refill settings
   */
  async getSettings(): Promise<AutoRefillSettings[]> {
    const response = await apiClient.get('/pharmacy-refill/auto-refill');
    return response.data.settings;
  },

  /**
   * Get auto-refill settings for a specific medication
   */
  async getMedicationSettings(
    medicationId: string
  ): Promise<AutoRefillSettings | null> {
    const response = await apiClient.get(
      `/pharmacy-refill/auto-refill/${medicationId}`
    );
    return response.data.setting;
  },

  /**
   * Upsert auto-refill settings for a medication
   */
  async upsertSettings(
    medicationId: string,
    data: {
      enabled: boolean;
      triggerDays?: number;
      preferredPharmacyId?: string;
      paymentMethodId?: string;
      confirmationRequired?: boolean;
    }
  ): Promise<AutoRefillSettings> {
    const response = await apiClient.put(
      `/pharmacy-refill/auto-refill/${medicationId}`,
      data
    );
    return response.data.setting;
  },
};

// ============================================================================
// Combined service exports
// ============================================================================

export const pharmacyRefillService = {
  partners: pharmacyPartnerService,
  inventory: medicationInventoryService,
  alerts: supplyAlertService,
  orders: pharmacyOrderService,
  payments: paymentMethodService,
  autoRefill: autoRefillService,
};

// Legacy compatibility
export const pharmacyService = {
  /**
   * Get pharmacy partners (legacy)
   */
  async getPharmacies(lat?: number, lng?: number) {
    return pharmacyPartnerService.getPharmacies(lat, lng);
  },

  /**
   * Create refill order (legacy)
   */
  async createRefill(data: {
    medicationId: string;
    pharmacyId?: string;
    deliveryAddress?: string;
  }) {
    return pharmacyOrderService.createOrder({
      medicationIds: [data.medicationId],
      pharmacyId: data.pharmacyId,
      deliveryType: data.deliveryAddress ? 'delivery' : 'pickup',
      deliveryAddress: data.deliveryAddress,
    });
  },

  /**
   * Get refill orders (legacy)
   */
  async getRefills(status?: string) {
    return pharmacyOrderService.getOrders({ status });
  },

  /**
   * Get low supply medications (legacy)
   */
  async getLowSupplyMedications() {
    const inventory = await medicationInventoryService.getInventory();
    return inventory
      .filter((i) => i.currentSupply < 7)
      .map((i) => ({
        id: i.medicationId,
        name: '', // Would need to fetch medication details
        dosage: '',
        supplyDays: i.currentSupply,
      }));
  },
};
