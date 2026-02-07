/**
 * Pharmacy Service
 *
 * Handles prescription refills and pharmacy integration
 * US-050: Show pharmacy options
 * US-051: Send prescription to pharmacy
 * US-052: Track delivery
 */

import { query, queryOne } from '../database/connection';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  deliveryAvailable: boolean;
  deliveryRadiusKm?: number;
  distance?: number;
}

export interface PrescriptionRefill {
  id: string;
  userId: string;
  medicationId: string;
  pharmacyId?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled';
  orderId?: string;
  deliveryAddress?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  createdAt: Date;
  medication?: {
    id: string;
    name: string;
    dosage: string;
    supplyDays: number;
    photoUrl?: string;
  };
  pharmacy?: Pharmacy;
}

export interface CreateRefillInput {
  medicationId: string;
  pharmacyId?: string;
  deliveryAddress?: string;
}

export class PharmacyService {
  /**
   * Get pharmacy partners (US-050)
   */
  async getPharmacies(userLat?: number, userLng?: number): Promise<Pharmacy[]> {
    let pharmacies = await query<Pharmacy>(
      `SELECT id, name, address, latitude, longitude, phone, email,
              delivery_available as "deliveryAvailable",
              delivery_radius_km as "deliveryRadiusKm"
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

    return pharmacies;
  }

  /**
   * Create prescription refill order (US-051)
   */
  async createRefillOrder(userId: string, input: CreateRefillInput): Promise<PrescriptionRefill> {
    // Verify medication exists and belongs to user
    const medication = await queryOne<{
      id: string;
      name: string;
      dosage: string;
      supplyDays: number;
      rxNumber?: string;
    }>(
      'SELECT id, name, dosage, supply_days as "supplyDays", rx_number as "rxNumber" FROM medications WHERE id = $1 AND user_id = $2',
      [input.medicationId, userId]
    );

    if (!medication) {
      throw new NotFoundError('Medication');
    }

    // Find nearest pharmacy if not specified
    let pharmacyId = input.pharmacyId;
    if (!pharmacyId) {
      const nearest = await queryOne<{ id: string }>(
        `SELECT id FROM pharmacies WHERE delivery_available = TRUE ORDER BY name LIMIT 1`
      );
      pharmacyId = nearest?.id;
    }

    // Calculate estimated delivery time
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 2); // Default 2 days

    const refill = await queryOne<PrescriptionRefill>(
      `INSERT INTO prescription_refills (user_id, medication_id, pharmacy_id, delivery_address, estimated_delivery)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id as "userId", medication_id as "medicationId", pharmacy_id as "pharmacyId",
                 status, order_id as "orderId", delivery_address as "deliveryAddress",
                 estimated_delivery as "estimatedDelivery", actual_delivery as "actualDelivery", created_at as "createdAt"`,
      [userId, input.medicationId, pharmacyId || null, input.deliveryAddress || null, estimatedDelivery]
    );

    if (!refill) {
      throw new Error('Failed to create refill order');
    }

    // In a real implementation, this would:
    // 1. Send prescription to pharmacy API
    // 2. Generate order ID from pharmacy system
    // 3. Send confirmation to user

    return this.enrichRefill(refill);
  }

  /**
   * Get user's refill orders
   */
  async getUserRefills(userId: string, status?: string): Promise<PrescriptionRefill[]> {
    let queryText = `
      SELECT id, user_id as "userId", medication_id as "medicationId", pharmacy_id as "pharmacyId",
             status, order_id as "orderId", delivery_address as "deliveryAddress",
             estimated_delivery as "estimatedDelivery", actual_delivery as "actualDelivery", created_at as "createdAt"
      FROM prescription_refills
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];

    if (status) {
      queryText += ' AND status = $2';
      params.push(status);
    }

    queryText += ' ORDER BY created_at DESC';

    const refills = await query<PrescriptionRefill>(queryText, params);

    return Promise.all(refills.map((r) => this.enrichRefill(r)));
  }

  /**
   * Get refill order details
   */
  async getRefillOrder(userId: string, refillId: string): Promise<PrescriptionRefill> {
    const refill = await queryOne<PrescriptionRefill>(
      `SELECT id, user_id as "userId", medication_id as "medicationId", pharmacy_id as "pharmacyId",
              status, order_id as "orderId", delivery_address as "deliveryAddress",
              estimated_delivery as "estimatedDelivery", actual_delivery as "actualDelivery", created_at as "createdAt"
       FROM prescription_refills
       WHERE id = $1`,
      [refillId]
    );

    if (!refill) {
      throw new NotFoundError('Prescription refill');
    }

    if (refill.userId !== userId) {
      throw new ValidationError('You do not have access to this refill order');
    }

    return this.enrichRefill(refill);
  }

  /**
   * Cancel refill order
   */
  async cancelRefillOrder(userId: string, refillId: string): Promise<PrescriptionRefill> {
    const refill = await this.getRefillOrder(userId, refillId);

    if (refill.status !== 'pending' && refill.status !== 'confirmed') {
      throw new ValidationError('Cannot cancel an order that is already being prepared');
    }

    const updated = await queryOne<PrescriptionRefill>(
      `UPDATE prescription_refills
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING id, user_id as "userId", medication_id as "medicationId", pharmacy_id as "pharmacyId",
                 status, order_id as "orderId", delivery_address as "deliveryAddress",
                 estimated_delivery as "estimatedDelivery", actual_delivery as "actualDelivery", created_at as "createdAt"`,
      [refillId]
    );

    if (!updated) {
      throw new Error('Failed to cancel refill order');
    }

    return this.enrichRefill(updated);
  }

  /**
   * Get medications with low supply (US-005)
   */
  async getLowSupplyMedications(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      dosage: string;
      supplyDays: number;
      photoUrl?: string;
    }>
  > {
    return query(
      `SELECT id, name, dosage, supply_days as "supplyDays", photo_url as "photoUrl"
       FROM medications
       WHERE user_id = $1 AND supply_days IS NOT NULL AND supply_days < 7 AND is_active = TRUE
       ORDER BY supply_days ASC`,
      [userId]
    );
  }

  /**
   * Enrich refill with medication and pharmacy details
   */
  private async enrichRefill(refill: PrescriptionRefill): Promise<PrescriptionRefill> {
    // Get medication details
    const medication = await queryOne<{
      id: string;
      name: string;
      dosage: string;
      supplyDays: number;
      photoUrl?: string;
    }>(
      `SELECT id, name, dosage, supply_days as "supplyDays", photo_url as "photoUrl"
       FROM medications WHERE id = $1`,
      [refill.medicationId]
    );

    // Get pharmacy details if available
    let pharmacy: Pharmacy | undefined;
    if (refill.pharmacyId) {
      pharmacy = await queryOne<Pharmacy>(
        `SELECT id, name, address, latitude, longitude, phone, email,
                delivery_available as "deliveryAvailable",
                delivery_radius_km as "deliveryRadiusKm"
         FROM pharmacies WHERE id = $1`,
        [refill.pharmacyId]
      );
    }

    return {
      ...refill,
      medication,
      pharmacy,
    };
  }

  /**
   * Calculate distance between two coordinates in km
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
