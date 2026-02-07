/**
 * SPEC-006: Pharmacy Refill Service
 *
 * Comprehensive pharmacy refill system with:
 * - Medication inventory tracking
 * - Low supply alerts
 * - Pharmacy partner management
 * - Order placement and tracking
 * - Payment integration (cash, card, insurance)
 * - Auto-refill functionality
 * - Delivery/pickup options
 * - Order status updates and tracking
 */

import { query, queryOne, transaction } from '../database/connection';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type PharmacyIntegrationType = 'direct_api' | 'manual_fax' | 'email' | 'manual';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
export type DeliveryType = 'delivery' | 'pickup';
export type PaymentMethodType = 'cash' | 'credit_card' | 'debit_card' | 'insurance';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type SupplyAlertUrgency = 'critical' | 'warning' | 'info';

export interface PharmacyPartner {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  logoUrl?: string;
  integrationType: PharmacyIntegrationType;
  apiEndpoint?: string;
  deliveryAvailable: boolean;
  deliveryRadiusKm?: number;
  deliveryFee: number;
  minimumOrder: number;
  estimatedDeliveryTime: {
    min: number;
    max: number;
  };
  operatingHours: Record<string, { open: string; close: string } | { open: string; close: string }[]>;
  distance?: number;
}

export interface MedicationInventory {
  id: string;
  userId: string;
  medicationId: string;
  currentSupply: number;
  lastRefillDate?: Date;
  nextRefillDate?: Date;
  refillReminderSent: boolean;
  autoRefillEnabled: boolean;
  preferredPharmacyId?: string;
}

export interface SupplyAlert {
  id: string;
  userId: string;
  medicationId: string;
  medicationName: string;
  daysRemaining: number;
  urgency: SupplyAlertUrgency;
  suggestedRefillDate: Date;
  acknowledged: boolean;
  createdAt: Date;
}

export interface PharmacyOrderItem {
  medicationId: string;
  name: string;
  dosage: string;
  quantity: number;
  rxNumber?: string;
  requiresPrescription: boolean;
  price?: number;
}

export interface PharmacyOrder {
  id: string;
  userId: string;
  medicationId?: string; // Legacy: single medication
  pharmacyId?: string;
  status: OrderStatus;
  orderId?: string; // External pharmacy order ID

  // Delivery
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  scheduledFor?: Date;

  // Items (multi-medication support)
  items: PharmacyOrderItem[];

  // Payment
  paymentMethod?: PaymentMethodType;
  paymentAmount?: number;
  paymentStatus: PaymentStatus;
  paymentTransactionId?: string;

  // Insurance
  insuranceProvider?: string;
  insuranceMemberId?: string;
  insuranceClaimId?: string;
  insuranceCopay?: number;

  // Tracking
  estimatedDelivery?: Date;
  trackingUrl?: string;
  trackingNumber?: string;
  driverLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: Date;
  };

  // Timestamps
  confirmedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;

  // Prescriptions
  prescriptionUrls?: string[];

  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  // Enriched data
  pharmacy?: PharmacyPartner;
  medication?: {
    id: string;
    name: string;
    dosage: string;
    photoUrl?: string;
  };
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  isActive: boolean;
  cardLast4?: string;
  cardBrand?: string;
  cardExpiryMonth?: number;
  cardExpiryYear?: number;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceMemberId?: string;
}

export interface AutoRefillSettings {
  id: string;
  userId: string;
  medicationId: string;
  enabled: boolean;
  triggerDays: number;
  preferredPharmacyId?: string;
  paymentMethodId?: string;
  confirmationRequired: boolean;
  lastAutoFillDate?: Date;
}

export interface CreateOrderInput {
  medicationIds: string[]; // Support multiple medications
  pharmacyId?: string;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  scheduledFor?: Date;
  paymentMethodId?: string;
  prescriptionUrls?: string[];
  notes?: string;
}

export interface CreateOrderItemInput {
  medicationId: string;
  quantity?: number;
}

// ============================================================================
// Pharmacy Partner Adapter Interface
// ============================================================================

interface PharmacyAdapter {
  name: string;
  createOrder(order: PharmacyOrder): Promise<{ orderId: string; estimatedDelivery?: Date }>;
  getOrderStatus(orderId: string): Promise<OrderStatus>;
  cancelOrder(orderId: string): Promise<boolean>;
}

// ============================================================================
// Direct API Adapters for Major Pharmacy Chains
// ============================================================================

class FarmaciaDelAhorroAdapter implements PharmacyAdapter {
  name = 'Farmacia del Ahorro';

  async createOrder(order: PharmacyOrder): Promise<{ orderId: string; estimatedDelivery?: Date }> {
    // Simulated API call - in production, integrate with actual pharmacy API
    const orderId = `FDA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Created order via Farmacia del Ahorro API', { orderId, items: order.items.length });

    // Estimate delivery based on delivery type
    const estimatedDelivery = new Date();
    estimatedDelivery.setHours(estimatedDelivery.getHours() + (order.deliveryType === 'delivery' ? 3 : 2));

    return { orderId, estimatedDelivery };
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    // In production, call pharmacy API to get real status
    // For now, return confirmed status
    return 'confirmed';
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    logger.info('Cancelled order via Farmacia del Ahorro API', { orderId });
    return true;
  }
}

class BenavidesAdapter implements PharmacyAdapter {
  name = 'Farmacias Benavides';

  async createOrder(order: PharmacyOrder): Promise<{ orderId: string; estimatedDelivery?: Date }> {
    const orderId = `BEN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Created order via Benavides API', { orderId, items: order.items.length });

    const estimatedDelivery = new Date();
    estimatedDelivery.setHours(estimatedDelivery.getHours() + (order.deliveryType === 'delivery' ? 4 : 3));

    return { orderId, estimatedDelivery };
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    return 'confirmed';
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    logger.info('Cancelled order via Benavides API', { orderId });
    return true;
  }
}

class GuadalajaraAdapter implements PharmacyAdapter {
  name = 'Farmacia Guadalajara';

  async createOrder(order: PharmacyOrder): Promise<{ orderId: string; estimatedDelivery?: Date }> {
    const orderId = `GUAD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Created order via Guadalajara API', { orderId, items: order.items.length });

    const estimatedDelivery = new Date();
    estimatedDelivery.setHours(estimatedDelivery.getHours() + 1); // Faster pickup

    return { orderId, estimatedDelivery };
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    return 'confirmed';
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    logger.info('Cancelled order via Guadalajara API', { orderId });
    return true;
  }
}

class ManualFaxAdapter implements PharmacyAdapter {
  name = 'Manual/Fax';

  async createOrder(order: PharmacyOrder): Promise<{ orderId: string; estimatedDelivery?: Date }> {
    const orderId = `FAX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Order queued for fax transmission', { orderId, pharmacyId: order.pharmacyId });

    // Queue for manual fax transmission
    const estimatedDelivery = new Date();
    estimatedDelivery.setHours(estimatedDelivery.getHours() + 24);

    return { orderId, estimatedDelivery };
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    return 'pending';
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    logger.info('Cancelled faxed order', { orderId });
    return true;
  }
}

class ManualAdapter implements PharmacyAdapter {
  name = 'Manual (Pickup Only)';

  async createOrder(order: PharmacyOrder): Promise<{ orderId: string; estimatedDelivery?: Date }> {
    const orderId = `MAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Order created for manual pickup', { orderId, pharmacyId: order.pharmacyId });

    const estimatedDelivery = new Date();
    estimatedDelivery.setHours(estimatedDelivery.getHours() + 2);

    return { orderId, estimatedDelivery };
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    return 'pending';
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    return true;
  }
}

// ============================================================================
// Adapter Factory
// ============================================================================

class PharmacyAdapterFactory {
  private adapters: Map<PharmacyIntegrationType, new () => PharmacyAdapter> = new Map([
    ['direct_api', FarmaciaDelAhorroAdapter],
    ['manual_fax', ManualFaxAdapter],
    ['manual', ManualAdapter],
  ]);

  getAdapter(integrationType: PharmacyIntegrationType, pharmacyName?: string): PharmacyAdapter {
    // Specific pharmacy overrides
    if (pharmacyName?.includes('Benavides')) {
      return new BenavidesAdapter();
    }
    if (pharmacyName?.includes('Guadalajara')) {
      return new GuadalajaraAdapter();
    }
    if (pharmacyName?.includes('Ahorro')) {
      return new FarmaciaDelAhorroAdapter();
    }

    const AdapterClass = this.adapters.get(integrationType);
    if (!AdapterClass) {
      return new ManualAdapter();
    }
    return new AdapterClass();
  }
}

// ============================================================================
// Main Service
// ============================================================================

export class PharmacyRefillService {
  private adapterFactory = new PharmacyAdapterFactory();

  // ==========================================================================
  // Pharmacy Partners
  // ==========================================================================

  async getPharmacies(userLat?: number, userLng?: number): Promise<PharmacyPartner[]> {
    let pharmacies = await query<PharmacyPartner>(
      `SELECT id, name, address, latitude, longitude, phone, email,
              logo_url as "logoUrl",
              integration_type as "integrationType",
              api_endpoint as "apiEndpoint",
              delivery_available as "deliveryAvailable",
              delivery_radius_km as "deliveryRadiusKm",
              delivery_fee as "deliveryFee",
              minimum_order as "minimumOrder",
              estimated_delivery_min as "estimatedDeliveryMin",
              estimated_delivery_max as "estimatedDeliveryMax",
              operating_hours as "operatingHours"
       FROM pharmacies
       ORDER BY name`
    );

    // Calculate distance if user location provided
    if (userLat !== undefined && userLng !== undefined) {
      pharmacies = pharmacies.map((p) => {
        if (p.latitude && p.longitude) {
          p.distance = this.calculateDistance(userLat, userLng, p.latitude, p.longitude);
        }
        return p;
      }).sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }

    // Transform to include nested estimatedDeliveryTime object
    return pharmacies.map((p) => ({
      ...p,
      estimatedDeliveryTime: {
        min: p.estimatedDeliveryMin || 2,
        max: p.estimatedDeliveryMax || 4,
      },
    })) as PharmacyPartner[];
  }

  async getPharmacyById(pharmacyId: string): Promise<PharmacyPartner> {
    const pharmacy = await queryOne<PharmacyPartner>(
      `SELECT id, name, address, latitude, longitude, phone, email,
              logo_url as "logoUrl",
              integration_type as "integrationType",
              api_endpoint as "apiEndpoint",
              delivery_available as "deliveryAvailable",
              delivery_radius_km as "deliveryRadiusKm",
              delivery_fee as "deliveryFee",
              minimum_order as "minimumOrder",
              estimated_delivery_min as "estimatedDeliveryMin",
              estimated_delivery_max as "estimatedDeliveryMax",
              operating_hours as "operatingHours"
       FROM pharmacies WHERE id = $1`,
      [pharmacyId]
    );

    if (!pharmacy) {
      throw new NotFoundError('Pharmacy');
    }

    return {
      ...pharmacy,
      estimatedDeliveryTime: {
        min: pharmacy.estimatedDeliveryMin || 2,
        max: pharmacy.estimatedDeliveryMax || 4,
      },
    } as PharmacyPartner;
  }

  // ==========================================================================
  // Medication Inventory
  // ==========================================================================

  async getInventory(userId: string): Promise<MedicationInventory[]> {
    return query<MedicationInventory>(
      `SELECT id, user_id as "userId", medication_id as "medicationId",
              current_supply as "currentSupply",
              last_refill_date as "lastRefillDate",
              next_refill_date as "nextRefillDate",
              refill_reminder_sent as "refillReminderSent",
              auto_refill_enabled as "autoRefillEnabled",
              preferred_pharmacy_id as "preferredPharmacyId"
       FROM medication_inventory
       WHERE user_id = $1
       ORDER BY current_supply ASC`,
      [userId]
    );
  }

  async getMedicationInventory(userId: string, medicationId: string): Promise<MedicationInventory | null> {
    return queryOne<MedicationInventory>(
      `SELECT id, user_id as "userId", medication_id as "medicationId",
              current_supply as "currentSupply",
              last_refill_date as "lastRefillDate",
              next_refill_date as "nextRefillDate",
              refill_reminder_sent as "refillReminderSent",
              auto_refill_enabled as "autoRefillEnabled",
              preferred_pharmacy_id as "preferredPharmacyId"
       FROM medication_inventory
       WHERE user_id = $1 AND medication_id = $2`,
      [userId, medicationId]
    );
  }

  async updateInventory(
    userId: string,
    medicationId: string,
    data: {
      currentSupply?: number;
      lastRefillDate?: Date;
      nextRefillDate?: Date;
      preferredPharmacyId?: string;
    }
  ): Promise<MedicationInventory> {
    // Check if inventory exists
    const existing = await this.getMedicationInventory(userId, medicationId);

    if (existing) {
      const updated = await queryOne<MedicationInventory>(
        `UPDATE medication_inventory
         SET current_supply = COALESCE($3, current_supply),
             last_refill_date = COALESCE($4, last_refill_date),
             next_refill_date = COALESCE($5, next_refill_date),
             preferred_pharmacy_id = COALESCE($6, preferred_pharmacy_id)
         WHERE user_id = $1 AND medication_id = $2
         RETURNING id, user_id as "userId", medication_id as "medicationId",
                   current_supply as "currentSupply",
                   last_refill_date as "lastRefillDate",
                   next_refill_date as "nextRefillDate",
                   refill_reminder_sent as "refillReminderSent",
                   auto_refill_enabled as "autoRefillEnabled",
                   preferred_pharmacy_id as "preferredPharmacyId"`,
        [userId, medicationId, data.currentSupply, data.lastRefillDate, data.nextRefillDate, data.preferredPharmacyId]
      );

      if (!updated) {
        throw new Error('Failed to update inventory');
      }
      return updated;
    } else {
      const created = await queryOne<MedicationInventory>(
        `INSERT INTO medication_inventory (
          user_id, medication_id, current_supply, last_refill_date,
          next_refill_date, preferred_pharmacy_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id as "userId", medication_id as "medicationId",
                  current_supply as "currentSupply",
                  last_refill_date as "lastRefillDate",
                  next_refill_date as "nextRefillDate",
                  refill_reminder_sent as "refillReminderSent",
                  auto_refill_enabled as "autoRefillEnabled",
                  preferred_pharmacy_id as "preferredPharmacyId"`,
        [userId, medicationId, data.currentSupply || 30, data.lastRefillDate, data.nextRefillDate, data.preferredPharmacyId]
      );

      if (!created) {
        throw new Error('Failed to create inventory');
      }
      return created;
    }
  }

  // ==========================================================================
  // Supply Alerts
  // ==========================================================================

  async getSupplyAlerts(userId: string, includeAcknowledged = false): Promise<SupplyAlert[]> {
    let queryText = `
      SELECT id, user_id as "userId", medication_id as "medicationId",
             medication_name as "medicationName", days_remaining as "daysRemaining",
             urgency, suggested_refill_date as "suggestedRefillDate",
             acknowledged, acknowledged_at as "acknowledgedAt", created_at as "createdAt"
      FROM supply_alerts
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];

    if (!includeAcknowledged) {
      queryText += ' AND acknowledged = FALSE';
    }

    queryText += ' ORDER BY urgency DESC, days_remaining ASC';

    return query<SupplyAlert>(queryText, params);
  }

  async acknowledgeSupplyAlert(userId: string, alertId: string): Promise<SupplyAlert> {
    const updated = await queryOne<SupplyAlert>(
      `UPDATE supply_alerts
       SET acknowledged = TRUE, acknowledged_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id as "userId", medication_id as "medicationId",
                 medication_name as "medicationName", days_remaining as "daysRemaining",
                 urgency, suggested_refill_date as "suggestedRefillDate",
                 acknowledged, acknowledged_at as "acknowledgedAt", created_at as "createdAt"`,
      [alertId, userId]
    );

    if (!updated) {
      throw new NotFoundError('Supply alert');
    }

    return updated;
  }

  async checkAndCreateSupplyAlerts(userId: string): Promise<SupplyAlert[]> {
    // Get low supply medications
    const lowSupplyMeds = await query<
      { medicationId: string; name: string; supplyDays: number }
    >(
      `SELECT m.id as "medicationId", m.name, COALESCE(mi.current_supply, m.supply_days, 0) as "supplyDays"
       FROM medications m
       LEFT JOIN medication_inventory mi ON mi.medication_id = m.id
       WHERE m.user_id = $1 AND m.is_active = TRUE
         AND COALESCE(mi.current_supply, m.supply_days, 0) <= 14`,
      [userId]
    );

    const newAlerts: SupplyAlert[] = [];

    for (const med of lowSupplyMeds) {
      // Check if unacknowledged alert already exists
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM supply_alerts
         WHERE medication_id = $1 AND acknowledged = FALSE
         LIMIT 1`,
        [med.medicationId]
      );

      if (!existing) {
        const urgency: SupplyAlertUrgency =
          med.supplyDays <= 3 ? 'critical' : med.supplyDays <= 7 ? 'warning' : 'info';

        const alert = await queryOne<SupplyAlert>(
          `INSERT INTO supply_alerts (
            user_id, medication_id, medication_name, days_remaining, urgency, suggested_refill_date
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, user_id as "userId", medication_id as "medicationId",
                    medication_name as "medicationName", days_remaining as "daysRemaining",
                    urgency, suggested_refill_date as "suggestedRefillDate",
                    acknowledged, created_at as "createdAt"`,
          [userId, med.medicationId, med.name, med.supplyDays, urgency, new Date()]
        );

        if (alert) {
          newAlerts.push(alert);
        }
      }
    }

    return newAlerts;
  }

  // ==========================================================================
  // Pharmacy Orders
  // ==========================================================================

  async createOrder(userId: string, input: CreateOrderInput): Promise<PharmacyOrder> {
    return transaction(async (client) => {
      // Verify medications exist and belong to user
      const medications = await client.query(
        `SELECT id, name, dosage, rx_number as "rxNumber", photo_url as "photoUrl", supply_days
         FROM medications WHERE id = ANY($1) AND user_id = $2 AND is_active = TRUE`,
        [input.medicationIds, userId]
      );

      if (medications.rows.length === 0) {
        throw new NotFoundError('Medications');
      }

      // Determine pharmacy
      let pharmacyId = input.pharmacyId;
      if (!pharmacyId) {
        // Use preferred pharmacy from first medication's inventory
        const preferred = await client.query(
          `SELECT preferred_pharmacy_id FROM medication_inventory
           WHERE medication_id = $1 AND user_id = $2`,
          [input.medicationIds[0], userId]
        );
        pharmacyId = preferred.rows[0]?.preferred_pharmacy_id;

        // Still no pharmacy? Find nearest
        if (!pharmacyId) {
          const nearest = await client.query(
            `SELECT id FROM pharmacies WHERE delivery_available = TRUE ORDER BY name LIMIT 1`
          );
          pharmacyId = nearest.rows[0]?.id;
        }
      }

      // Get pharmacy details
      const pharmacyResult = await client.query(
        `SELECT * FROM pharmacies WHERE id = $1`,
        [pharmacyId]
      );
      const pharmacy = pharmacyResult.rows[0];

      if (!pharmacy) {
        throw new NotFoundError('Pharmacy');
      }

      // Get payment method if specified
      let paymentMethod: PaymentMethodType | undefined;
      if (input.paymentMethodId) {
        const pmResult = await client.query(
          `SELECT type FROM payment_methods WHERE id = $1 AND user_id = $2 AND is_active = TRUE`,
          [input.paymentMethodId, userId]
        );
        if (pmResult.rows.length > 0) {
          paymentMethod = pmResult.rows[0].type;
        }
      }

      // Build order items
      const items: PharmacyOrderItem[] = medications.rows.map((m: any) => ({
        medicationId: m.id,
        name: m.name,
        dosage: m.dosage,
        quantity: 30, // Default 30-day supply
        rxNumber: m.rxNumber,
        requiresPrescription: !!m.rxNumber,
      }));

      // Calculate estimated delivery
      const estimatedDelivery = new Date();
      const hours = input.deliveryType === 'delivery'
        ? (pharmacy.estimated_delivery_min + pharmacy.estimated_delivery_max) / 2
        : 2;
      estimatedDelivery.setHours(estimatedDelivery.getHours() + hours);

      // Insert order
      const orderResult = await client.query(
        `INSERT INTO prescription_refills (
          user_id, pharmacy_id, medication_id, status,
          delivery_type, delivery_address, delivery_latitude, delivery_longitude, scheduled_for,
          items, payment_method, prescription_urls, notes,
          estimated_delivery
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          userId,
          pharmacyId,
          input.medicationIds[0], // Primary medication for legacy support
          'pending',
          input.deliveryType,
          input.deliveryAddress,
          input.deliveryLatitude,
          input.deliveryLongitude,
          input.scheduledFor,
          JSON.stringify(items),
          paymentMethod || 'cash',
          input.prescriptionUrls,
          input.notes,
          estimatedDelivery,
        ]
      );

      const order = orderResult.rows[0];

      // Get pharmacy adapter and create external order
      const adapter = this.adapterFactory.getAdapter(
        pharmacy.integration_type,
        pharmacy.name
      );

      try {
        const externalOrder = await adapter.createOrder({
          ...order,
          items,
        });

        // Update with external order ID
        await client.query(
          `UPDATE prescription_refills
           SET order_id = $1, status = 'confirmed', confirmed_at = NOW()
           WHERE id = $2`,
          [externalOrder.orderId, order.id]
        );

        order.order_id = externalOrder.orderId;
        order.status = 'confirmed';
        order.confirmed_at = new Date();
        if (externalOrder.estimatedDelivery) {
          order.estimated_delivery = externalOrder.estimatedDelivery;
        }
      } catch (error) {
        logger.error('Failed to create external order', { error, orderId: order.id });
        // Order remains pending
      }

      // Log status change
      await client.query(
        `INSERT INTO pharmacy_order_status_history (order_id, status, notes)
         VALUES ($1, $2, $3)`,
        [order.id, order.status, 'Order created via API']
      );

      return this.enrichOrder(order);
    });
  }

  async getOrders(
    userId: string,
    filters?: {
      status?: OrderStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<PharmacyOrder[]> {
    let queryText = `
      SELECT id, user_id as "userId", medication_id as "medicationId",
             pharmacy_id as "pharmacyId", status, order_id as "orderId",
             delivery_type as "deliveryType", delivery_address as "deliveryAddress",
             delivery_latitude as "deliveryLatitude", delivery_longitude as "deliveryLongitude",
             scheduled_for as "scheduledFor", items,
             payment_method as "paymentMethod", payment_amount as "paymentAmount",
             payment_status as "paymentStatus", payment_transaction_id as "paymentTransactionId",
             insurance_provider, insurance_member_id as "insuranceMemberId",
             insurance_claim_id as "insuranceClaimId", insurance_copay as "insuranceCopay",
             estimated_delivery as "estimatedDelivery", tracking_url as "trackingUrl",
             tracking_number as "trackingNumber", driver_location as "driverLocation",
             confirmed_at as "confirmedAt", shipped_at as "shippedAt",
             delivered_at as "deliveredAt", cancelled_at as "cancelledAt",
             cancellation_reason as "cancellationReason",
             prescription_urls as "prescriptionUrls", notes,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM prescription_refills
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];

    if (filters?.status) {
      queryText += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    queryText += ` ORDER BY created_at DESC`;

    if (filters?.limit) {
      queryText += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }
    if (filters?.offset) {
      queryText += ` OFFSET $${params.length + 1}`;
      params.push(filters.offset);
    }

    const orders = await query<PharmacyOrder>(queryText, params);

    return Promise.all(orders.map((o) => this.enrichOrder(o)));
  }

  async getOrderById(userId: string, orderId: string): Promise<PharmacyOrder> {
    const order = await queryOne<PharmacyOrder>(
      `SELECT id, user_id as "userId", medication_id as "medicationId",
             pharmacy_id as "pharmacyId", status, order_id as "orderId",
             delivery_type as "deliveryType", delivery_address as "deliveryAddress",
             delivery_latitude as "deliveryLatitude", delivery_longitude as "deliveryLongitude",
             scheduled_for as "scheduledFor", items,
             payment_method as "paymentMethod", payment_amount as "paymentAmount",
             payment_status as "paymentStatus", payment_transaction_id as "paymentTransactionId",
             insurance_provider, insurance_member_id as "insuranceMemberId",
             insurance_claim_id as "insuranceClaimId", insurance_copay as "insuranceCopay",
             estimated_delivery as "estimatedDelivery", tracking_url as "trackingUrl",
             tracking_number as "trackingNumber", driver_location as "driverLocation",
             confirmed_at as "confirmedAt", shipped_at as "shippedAt",
             delivered_at as "deliveredAt", cancelled_at as "cancelledAt",
             cancellation_reason as "cancellationReason",
             prescription_urls as "prescriptionUrls", notes,
             created_at as "createdAt", updated_at as "updatedAt"
       FROM prescription_refills
       WHERE id = $1`,
      [orderId]
    );

    if (!order) {
      throw new NotFoundError('Order');
    }

    if (order.userId !== userId) {
      throw new ValidationError('You do not have access to this order');
    }

    return this.enrichOrder(order);
  }

  async updateOrderStatus(
    userId: string,
    orderId: string,
    status: OrderStatus,
    notes?: string
  ): Promise<PharmacyOrder> {
    const order = await this.getOrderById(userId, orderId);

    // Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'shipped', 'cancelled'],
      ready: ['shipped', 'delivered', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      throw new ValidationError(`Invalid status transition from ${order.status} to ${status}`);
    }

    // Update order
    const updates: string[] = ['status = $2'];
    const params: unknown[] = [orderId, status];

    if (status === 'confirmed' && !order.confirmedAt) {
      updates.push('confirmed_at = NOW()');
    }
    if (status === 'shipped' && !order.shippedAt) {
      updates.push('shipped_at = NOW()');
    }
    if (status === 'delivered' && !order.deliveredAt) {
      updates.push('delivered_at = NOW()');
      // Update inventory on delivery
      await this.updateInventoryAfterDelivery(userId, order);
    }
    if (status === 'cancelled' && !order.cancelledAt) {
      updates.push('cancelled_at = NOW()');
    }

    params.push(`Status updated to ${status}${notes ? ': ' + notes : ''}`);

    const updated = await queryOne<PharmacyOrder>(
      `UPDATE prescription_refills
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING id, user_id as "userId", medication_id as "medicationId",
                 pharmacy_id as "pharmacyId", status, order_id as "orderId",
                 delivery_type as "deliveryType", delivery_address as "deliveryAddress",
                 delivery_latitude as "deliveryLatitude", delivery_longitude as "deliveryLongitude",
                 scheduled_for as "scheduledFor", items,
                 payment_method as "paymentMethod", payment_amount as "paymentAmount",
                 payment_status as "paymentStatus", payment_transaction_id as "paymentTransactionId",
                 insurance_provider, insurance_member_id as "insuranceMemberId",
                 insurance_claim_id as "insuranceClaimId", insurance_copay as "insuranceCopay",
                 estimated_delivery as "estimatedDelivery", tracking_url as "trackingUrl",
                 tracking_number as "trackingNumber", driver_location as "driverLocation",
                 confirmed_at as "confirmedAt", shipped_at as "shippedAt",
                 delivered_at as "deliveredAt", cancelled_at as "cancelledAt",
                 cancellation_reason as "cancellationReason",
                 prescription_urls as "prescriptionUrls", notes,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      params
    );

    if (!updated) {
      throw new Error('Failed to update order status');
    }

    // Log status change
    await query(
      `INSERT INTO pharmacy_order_status_history (order_id, status, notes)
       VALUES ($1, $2, $3)`,
      [orderId, status, notes]
    );

    return this.enrichOrder(updated!);
  }

  async cancelOrder(userId: string, orderId: string, reason?: string): Promise<PharmacyOrder> {
    const order = await this.getOrderById(userId, orderId);

    if (!['pending', 'confirmed', 'preparing'].includes(order.status)) {
      throw new ValidationError('Cannot cancel an order that is already being shipped or delivered');
    }

    // Try to cancel with pharmacy
    if (order.pharmacyId && order.orderId) {
      const pharmacy = await queryOne<{ integration_type: string; name: string }>(
        'SELECT integration_type, name FROM pharmacies WHERE id = $1',
        [order.pharmacyId]
      );

      if (pharmacy) {
        const adapter = this.adapterFactory.getAdapter(
          pharmacy.integration_type as PharmacyIntegrationType,
          pharmacy.name
        );
        await adapter.cancelOrder(order.orderId!);
      }
    }

    const cancelled = await queryOne<PharmacyOrder>(
      `UPDATE prescription_refills
       SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2
       WHERE id = $1
       RETURNING id, user_id as "userId", medication_id as "medicationId",
                 pharmacy_id as "pharmacyId", status, order_id as "orderId",
                 delivery_type as "deliveryType", delivery_address as "deliveryAddress",
                 delivery_latitude as "deliveryLatitude", delivery_longitude as "deliveryLongitude",
                 scheduled_for as "scheduledFor", items,
                 payment_method as "paymentMethod", payment_amount as "paymentAmount",
                 payment_status as "paymentStatus", payment_transaction_id as "paymentTransactionId",
                 insurance_provider, insurance_member_id as "insuranceMemberId",
                 insurance_claim_id as "insuranceClaimId", insurance_copay as "insuranceCopay",
                 estimated_delivery as "estimatedDelivery", tracking_url as "trackingUrl",
                 tracking_number as "trackingNumber", driver_location as "driverLocation",
                 confirmed_at as "confirmedAt", shipped_at as "shippedAt",
                 delivered_at as "deliveredAt", cancelled_at as "cancelledAt",
                 cancellation_reason as "cancellationReason",
                 prescription_urls as "prescriptionUrls", notes,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [orderId, reason || 'Cancelled by user']
    );

    if (!cancelled) {
      throw new Error('Failed to cancel order');
    }

    // Log status change
    await query(
      `INSERT INTO pharmacy_order_status_history (order_id, status, notes)
       VALUES ($1, $2, $3)`,
      [orderId, 'cancelled', reason || 'Cancelled by user']
    );

    return this.enrichOrder(cancelled);
  }

  async updateDriverLocation(
    orderId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    await query(
      `UPDATE prescription_refills
       SET driver_location = jsonb_build_object(
         'latitude', $1,
         'longitude', $2,
         'updatedAt', NOW()
       )
       WHERE id = $3`,
      [latitude, longitude, orderId]
    );
  }

  // ==========================================================================
  // Payment Methods
  // ==========================================================================

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return query<PaymentMethod>(
      `SELECT id, user_id as "userId", type, is_default as "isDefault", is_active as "isActive",
              card_last4 as "cardLast4", card_brand as "cardBrand",
              card_expiry_month as "cardExpiryMonth", card_expiry_year as "cardExpiryYear",
              insurance_provider, insurance_policy_number as "insurancePolicyNumber",
              insurance_member_id as "insuranceMemberId"
       FROM payment_methods
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
  }

  async createPaymentMethod(
    userId: string,
    data: {
      type: PaymentMethodType;
      isDefault?: boolean;
      cardLast4?: string;
      cardBrand?: string;
      cardExpiryMonth?: number;
      cardExpiryYear?: number;
      cardToken?: string;
      insuranceProvider?: string;
      insurancePolicyNumber?: string;
      insuranceMemberId?: string;
    }
  ): Promise<PaymentMethod> {
    return transaction(async (client) => {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await client.query(
          `UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1`,
          [userId]
        );
      }

      const result = await client.query(
        `INSERT INTO payment_methods (
          user_id, type, is_default, is_active,
          card_last4, card_brand, card_expiry_month, card_expiry_year, card_token,
          insurance_provider, insurance_policy_number, insurance_member_id
        ) VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, user_id as "userId", type, is_default as "isDefault", is_active as "isActive",
                  card_last4 as "cardLast4", card_brand as "cardBrand",
                  card_expiry_month as "cardExpiryMonth", card_expiry_year as "cardExpiryYear",
                  insurance_provider, insurance_policy_number as "insurancePolicyNumber",
                  insurance_member_id as "insuranceMemberId"`,
        [
          userId,
          data.type,
          data.isDefault || false,
          data.cardLast4,
          data.cardBrand,
          data.cardExpiryMonth,
          data.cardExpiryYear,
          data.cardToken,
          data.insuranceProvider,
          data.insurancePolicyNumber,
          data.insuranceMemberId,
        ]
      );

      return result.rows[0];
    });
  }

  async deletePaymentMethod(userId: string, methodId: string): Promise<void> {
    await query(
      `UPDATE payment_methods SET is_active = FALSE WHERE id = $1 AND user_id = $2`,
      [methodId, userId]
    );
  }

  async setDefaultPaymentMethod(userId: string, methodId: string): Promise<PaymentMethod> {
    return transaction(async (client) => {
      await client.query(
        `UPDATE payment_methods SET is_default = FALSE WHERE user_id = $1`,
        [userId]
      );

      const result = await client.query(
        `UPDATE payment_methods SET is_default = TRUE WHERE id = $1 AND user_id = $2
         RETURNING id, user_id as "userId", type, is_default as "isDefault", is_active as "isActive",
                   card_last4 as "cardLast4", card_brand as "cardBrand",
                   card_expiry_month as "cardExpiryMonth", card_expiry_year as "cardExpiryYear",
                   insurance_provider, insurance_policy_number as "insurancePolicyNumber",
                   insurance_member_id as "insuranceMemberId"`,
        [methodId, userId]
      );

      if (!result.rows[0]) {
        throw new NotFoundError('Payment method');
      }

      return result.rows[0];
    });
  }

  // ==========================================================================
  // Auto-Refill Settings
  // ==========================================================================

  async getAutoRefillSettings(userId: string): Promise<AutoRefillSettings[]> {
    return query<AutoRefillSettings>(
      `SELECT id, user_id as "userId", medication_id as "medicationId",
              enabled, trigger_days as "triggerDays",
              preferred_pharmacy_id as "preferredPharmacyId",
              payment_method_id as "paymentMethodId",
              confirmation_required as "confirmationRequired",
              last_auto_fill_date as "lastAutoFillDate"
       FROM auto_refill_settings
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
  }

  async getAutoRefillSetting(
    userId: string,
    medicationId: string
  ): Promise<AutoRefillSettings | null> {
    return queryOne<AutoRefillSettings>(
      `SELECT id, user_id as "userId", medication_id as "medicationId",
              enabled, trigger_days as "triggerDays",
              preferred_pharmacy_id as "preferredPharmacyId",
              payment_method_id as "paymentMethodId",
              confirmation_required as "confirmationRequired",
              last_auto_fill_date as "lastAutoFillDate"
       FROM auto_refill_settings
       WHERE user_id = $1 AND medication_id = $2`,
      [userId, medicationId]
    );
  }

  async upsertAutoRefillSetting(
    userId: string,
    medicationId: string,
    data: {
      enabled: boolean;
      triggerDays?: number;
      preferredPharmacyId?: string;
      paymentMethodId?: string;
      confirmationRequired?: boolean;
    }
  ): Promise<AutoRefillSettings> {
    const existing = await this.getAutoRefillSetting(userId, medicationId);

    if (existing) {
      const updated = await queryOne<AutoRefillSettings>(
        `UPDATE auto_refill_settings
         SET enabled = $3, trigger_days = COALESCE($4, trigger_days),
             preferred_pharmacy_id = COALESCE($5, preferred_pharmacy_id),
             payment_method_id = COALESCE($6, payment_method_id),
             confirmation_required = COALESCE($7, confirmation_required)
         WHERE user_id = $1 AND medication_id = $2
         RETURNING id, user_id as "userId", medication_id as "medicationId",
                   enabled, trigger_days as "triggerDays",
                   preferred_pharmacy_id as "preferredPharmacyId",
                   payment_method_id as "paymentMethodId",
                   confirmation_required as "confirmationRequired",
                   last_auto_fill_date as "lastAutoFillDate"`,
        [
          userId,
          medicationId,
          data.enabled,
          data.triggerDays,
          data.preferredPharmacyId,
          data.paymentMethodId,
          data.confirmationRequired,
        ]
      );

      if (!updated) {
        throw new Error('Failed to update auto-refill settings');
      }
      return updated;
    } else {
      const created = await queryOne<AutoRefillSettings>(
        `INSERT INTO auto_refill_settings (
          user_id, medication_id, enabled, trigger_days,
          preferred_pharmacy_id, payment_method_id, confirmation_required
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id as "userId", medication_id as "medicationId",
                  enabled, trigger_days as "triggerDays",
                  preferred_pharmacy_id as "preferredPharmacyId",
                  payment_method_id as "paymentMethodId",
                  confirmation_required as "confirmationRequired",
                  last_auto_fill_date as "lastAutoFillDate"`,
        [
          userId,
          medicationId,
          data.enabled,
          data.triggerDays || 7,
          data.preferredPharmacyId,
          data.paymentMethodId,
          data.confirmationRequired ?? true,
        ]
      );

      if (!created) {
        throw new Error('Failed to create auto-refill settings');
      }
      return created;
    }
  }

  async processAutoRefills(): Promise<PharmacyOrder[]> {
    // Get medications that need auto-refill
    const needsRefill = await query<{
      userId: string;
      medicationId: string;
      currentSupply: number;
      triggerDays: number;
      preferredPharmacyId: string | null;
      paymentMethodId: string | null;
      lastAutoFillDate: Date | null;
    }>(
      `SELECT ars.user_id, ars.medication_id,
              COALESCE(mi.current_supply, 0) as "currentSupply",
              ars.trigger_days as "triggerDays",
              ars.preferred_pharmacy_id as "preferredPharmacyId",
              ars.payment_method_id as "paymentMethodId",
              ars.last_auto_fill_date as "lastAutoFillDate"
       FROM auto_refill_settings ars
       LEFT JOIN medication_inventory mi ON mi.medication_id = ars.medication_id AND mi.user_id = ars.user_id
       WHERE ars.enabled = TRUE
         AND COALESCE(mi.current_supply, 0) <= ars.trigger_days
         AND (ars.last_auto_fill_date IS NULL OR ars.last_auto_fill_date < NOW() - INTERVAL '7 days')`
    );

    const orders: PharmacyOrder[] = [];

    for (const item of needsRefill) {
      try {
        const order = await this.createOrder(item.userId, {
          medicationIds: [item.medicationId],
          pharmacyId: item.preferredPharmacyId || undefined,
          deliveryType: 'delivery',
          paymentMethodId: item.paymentMethodId || undefined,
        });

        // Update last auto-fill date
        await query(
          `UPDATE auto_refill_settings SET last_auto_fill_date = NOW()
           WHERE user_id = $1 AND medication_id = $2`,
          [item.userId, item.medicationId]
        );

        orders.push(order);
      } catch (error) {
        logger.error('Failed to process auto-refill', { error, item });
      }
    }

    return orders;
  }

  // ==========================================================================
  // Order History
  // ==========================================================================

  async getOrderHistory(userId: string, limit = 20): Promise<PharmacyOrder[]> {
    return this.getOrders(userId, { limit });
  }

  async getOrderStatusHistory(orderId: string): Promise<
    Array<{ status: string; notes?: string; createdAt: Date }>
  > {
    return query(
      `SELECT status, notes, created_at as "createdAt"
       FROM pharmacy_order_status_history
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId]
    );
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private async enrichOrder(order: PharmacyOrder): Promise<PharmacyOrder> {
    // Get pharmacy details
    if (order.pharmacyId) {
      order.pharmacy = await queryOne<PharmacyPartner>(
        `SELECT id, name, address, latitude, longitude, phone, email,
                logo_url as "logoUrl",
                integration_type as "integrationType",
                delivery_available as "deliveryAvailable",
                delivery_radius_km as "deliveryRadiusKm",
                delivery_fee as "deliveryFee",
                minimum_order as "minimumOrder",
                estimated_delivery_min as "estimatedDeliveryMin",
                estimated_delivery_max as "estimatedDeliveryMax",
                operating_hours as "operatingHours"
         FROM pharmacies WHERE id = $1`,
        [order.pharmacyId]
      ).then((p) => p ? {
        ...p,
        estimatedDeliveryTime: {
          min: p.estimatedDeliveryMin || 2,
          max: p.estimatedDeliveryMax || 4,
        },
      } as PharmacyPartner : undefined);
    }

    // Get medication details (legacy single medication)
    if (order.medicationId) {
      order.medication = await queryOne<{
        id: string;
        name: string;
        dosage: string;
        photoUrl?: string;
      }>(
        `SELECT id, name, dosage, photo_url as "photoUrl" FROM medications WHERE id = $1`,
        [order.medicationId]
      );
    }

    return order;
  }

  private async updateInventoryAfterDelivery(userId: string, order: PharmacyOrder): Promise<void> {
    // Update supply days based on delivered items
    for (const item of order.items) {
      await query(
        `UPDATE medication_inventory
         SET current_supply = current_supply + $1,
             last_refill_date = NOW(),
             next_refill_date = NOW() + INTERVAL '1 day' * ($1 + 7)
         WHERE user_id = $1 AND medication_id = $2`,
        [item.quantity, userId, item.medicationId]
      );
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Export singleton instance
export const pharmacyRefillService = new PharmacyRefillService();
