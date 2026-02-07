/**
 * SPEC-006: Pharmacy Refill Routes
 *
 * Comprehensive API endpoints for pharmacy refill system:
 * - Pharmacy partner management
 * - Medication inventory tracking
 * - Supply alerts
 * - Order placement and tracking
 * - Payment methods
 * - Auto-refill settings
 * - Webhook handling
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody, validateParams, validateQuery } from '../middleware/validator';
import { pharmacyRefillService } from '../services/PharmacyRefillService';
import { logAuditEvent } from '../utils/logger';
import { logger } from '../utils/logger';

export const pharmacyRefillRouter = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createOrderSchema = z.object({
  medicationIds: z.array(z.string().uuid()).min(1),
  pharmacyId: z.string().uuid().optional(),
  deliveryType: z.enum(['delivery', 'pickup']),
  deliveryAddress: z.string().optional(),
  deliveryLatitude: z.number().optional(),
  deliveryLongitude: z.number().optional(),
  scheduledFor: z.coerce.date().optional(),
  paymentMethodId: z.string().uuid().optional(),
  prescriptionUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(500).optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled']),
  notes: z.string().max(500).optional(),
});

const driverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const createPaymentMethodSchema = z.object({
  type: z.enum(['cash', 'credit_card', 'debit_card', 'insurance']),
  isDefault: z.boolean().optional(),
  cardLast4: z.string().length(4).optional(),
  cardBrand: z.enum(['visa', 'mastercard', 'amex']).optional(),
  cardExpiryMonth: z.number().min(1).max(12).optional(),
  cardExpiryYear: z.number().min(new Date().getFullYear()).optional(),
  cardToken: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  insuranceMemberId: z.string().optional(),
});

const autoRefillSettingsSchema = z.object({
  enabled: z.boolean(),
  triggerDays: z.number().min(1).max(30).optional(),
  preferredPharmacyId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid().optional(),
  confirmationRequired: z.boolean().optional(),
});

const updateInventorySchema = z.object({
  currentSupply: z.number().min(0).max(365).optional(),
  lastRefillDate: z.coerce.date().optional(),
  nextRefillDate: z.coerce.date().optional(),
  preferredPharmacyId: z.string().uuid().optional(),
});

const orderIdSchema = z.object({
  orderId: z.string().uuid(),
});

const alertIdSchema = z.object({
  alertId: z.string().uuid(),
});

const paymentMethodIdSchema = z.object({
  methodId: z.string().uuid(),
});

// ============================================================================
// Pharmacy Partners
// ============================================================================

/**
 * GET /api/pharmacy-refill/partners
 * Get all pharmacy partners sorted by distance
 */
pharmacyRefillRouter.get(
  '/partners',
  authenticate,
  asyncHandler(async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    const pharmacies = await pharmacyRefillService.getPharmacies(
      isNaN(lat) ? undefined : lat,
      isNaN(lng) ? undefined : lng
    );

    logAuditEvent(req.user!.id, 'pharmacy.partners.list', undefined, {
      count: pharmacies.length,
    });

    res.json({ pharmacies });
  })
);

/**
 * GET /api/pharmacy-refill/partners/:pharmacyId
 * Get pharmacy partner details
 */
pharmacyRefillRouter.get(
  '/partners/:pharmacyId',
  authenticate,
  validateParams(z.object({ pharmacyId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const { pharmacyId } = req.params;

    const pharmacy = await pharmacyRefillService.getPharmacyById(pharmacyId);

    logAuditEvent(req.user!.id, 'pharmacy.partner.view', pharmacyId);

    res.json({ pharmacy });
  })
);

// ============================================================================
// Medication Inventory
// ============================================================================

/**
 * GET /api/pharmacy-refill/inventory
 * Get user's medication inventory
 */
pharmacyRefillRouter.get(
  '/inventory',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const inventory = await pharmacyRefillService.getInventory(userId);

    res.json({ inventory });
  })
);

/**
 * PUT /api/pharmacy-refill/inventory/:medicationId
 * Update medication inventory
 */
pharmacyRefillRouter.put(
  '/inventory/:medicationId',
  authenticate,
  validateParams(z.object({ medicationId: z.string().uuid() })),
  validateBody(updateInventorySchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;

    const inventory = await pharmacyRefillService.updateInventory(
      userId,
      medicationId,
      req.body
    );

    logAuditEvent(userId, 'pharmacy.inventory.updated', medicationId, req.body);

    res.json({ inventory });
  })
);

// ============================================================================
// Supply Alerts
// ============================================================================

/**
 * GET /api/pharmacy-refill/alerts
 * Get user's supply alerts
 */
pharmacyRefillRouter.get(
  '/alerts',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const includeAcknowledged = req.query.includeAcknowledged === 'true';

    const alerts = await pharmacyRefillService.getSupplyAlerts(
      userId,
      includeAcknowledged
    );

    res.json({ alerts });
  })
);

/**
 * POST /api/pharmacy-refill/alerts/check
 * Check and create supply alerts for low supply medications
 */
pharmacyRefillRouter.post(
  '/alerts/check',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const newAlerts = await pharmacyRefillService.checkAndCreateSupplyAlerts(userId);

    logAuditEvent(userId, 'pharmacy.alerts.checked', undefined, {
      newAlerts: newAlerts.length,
    });

    res.json({ alerts: newAlerts });
  })
);

/**
 * POST /api/pharmacy-refill/alerts/:alertId/acknowledge
 * Acknowledge a supply alert
 */
pharmacyRefillRouter.post(
  '/alerts/:alertId/acknowledge',
  authenticate,
  validateParams(alertIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { alertId } = req.params;

    const alert = await pharmacyRefillService.acknowledgeSupplyAlert(
      userId,
      alertId
    );

    logAuditEvent(userId, 'pharmacy.alert.acknowledged', alertId);

    res.json({ alert });
  })
);

// ============================================================================
// Orders
// ============================================================================

/**
 * POST /api/pharmacy-refill/orders
 * Create a new pharmacy order
 */
pharmacyRefillRouter.post(
  '/orders',
  authenticate,
  validateBody(createOrderSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const order = await pharmacyRefillService.createOrder(userId, req.body);

    logAuditEvent(userId, 'pharmacy.order.created', order.id, {
      medicationIds: req.body.medicationIds,
      pharmacyId: req.body.pharmacyId,
      deliveryType: req.body.deliveryType,
    });

    res.status(201).json({ order });
  })
);

/**
 * GET /api/pharmacy-refill/orders
 * Get user's orders
 */
pharmacyRefillRouter.get(
  '/orders',
  authenticate,
  validateQuery(
    z.object({
      status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled']).optional(),
      limit: z.coerce.number().min(1).max(100).optional(),
      offset: z.coerce.number().min(0).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { status, limit, offset } = req.query;

    const orders = await pharmacyRefillService.getOrders(userId, {
      status: status as any,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    logAuditEvent(userId, 'pharmacy.orders.list', undefined, {
      count: orders.length,
      status,
    });

    res.json({ orders });
  })
);

/**
 * GET /api/pharmacy-refill/orders/history
 * Get order history
 */
pharmacyRefillRouter.get(
  '/orders/history',
  authenticate,
  validateQuery(z.object({ limit: z.coerce.number().min(1).max(100).optional() })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const orders = await pharmacyRefillService.getOrderHistory(userId, limit);

    res.json({ orders });
  })
);

/**
 * GET /api/pharmacy-refill/orders/:orderId
 * Get order details
 */
pharmacyRefillRouter.get(
  '/orders/:orderId',
  authenticate,
  validateParams(orderIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { orderId } = req.params;

    const order = await pharmacyRefillService.getOrderById(userId, orderId);

    logAuditEvent(userId, 'pharmacy.order.view', orderId);

    res.json({ order });
  })
);

/**
 * GET /api/pharmacy-refill/orders/:orderId/status-history
 * Get order status history
 */
pharmacyRefillRouter.get(
  '/orders/:orderId/status-history',
  authenticate,
  validateParams(orderIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { orderId } = req.params;

    // Verify user has access to this order
    await pharmacyRefillService.getOrderById(userId, orderId);

    const history = await pharmacyRefillService.getOrderStatusHistory(orderId);

    res.json({ history });
  })
);

/**
 * PATCH /api/pharmacy-refill/orders/:orderId/status
 * Update order status (for pharmacy webhooks)
 */
pharmacyRefillRouter.patch(
  '/orders/:orderId/status',
  authenticate,
  validateParams(orderIdSchema),
  validateBody(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { orderId } = req.params;
    const { status, notes } = req.body;

    const order = await pharmacyRefillService.updateOrderStatus(
      userId,
      orderId,
      status,
      notes
    );

    logAuditEvent(userId, 'pharmacy.order.status_updated', orderId, {
      status,
      notes,
    });

    res.json({ order });
  })
);

/**
 * POST /api/pharmacy-refill/orders/:orderId/cancel
 * Cancel an order
 */
pharmacyRefillRouter.post(
  '/orders/:orderId/cancel',
  authenticate,
  validateParams(orderIdSchema),
  validateBody(z.object({ reason: z.string().max(500).optional() })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await pharmacyRefillService.cancelOrder(userId, orderId, reason);

    logAuditEvent(userId, 'pharmacy.order.cancelled', orderId, { reason });

    res.json({ order });
  })
);

/**
 * PUT /api/pharmacy-refill/orders/:orderId/driver-location
 * Update driver location
 */
pharmacyRefillRouter.put(
  '/orders/:orderId/driver-location',
  authenticate,
  validateParams(orderIdSchema),
  validateBody(driverLocationSchema),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { latitude, longitude } = req.body;

    await pharmacyRefillService.updateDriverLocation(orderId, latitude, longitude);

    logAuditEvent(req.user!.id, 'pharmacy.order.driver_location_updated', orderId, {
      latitude,
      longitude,
    });

    res.json({ success: true });
  })
);

// ============================================================================
// Payment Methods
// ============================================================================

/**
 * GET /api/pharmacy-refill/payment-methods
 * Get user's payment methods
 */
pharmacyRefillRouter.get(
  '/payment-methods',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const methods = await pharmacyRefillService.getPaymentMethods(userId);

    res.json({ paymentMethods: methods });
  })
);

/**
 * POST /api/pharmacy-refill/payment-methods
 * Create a new payment method
 */
pharmacyRefillRouter.post(
  '/payment-methods',
  authenticate,
  validateBody(createPaymentMethodSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const method = await pharmacyRefillService.createPaymentMethod(userId, req.body);

    logAuditEvent(userId, 'pharmacy.payment_method.created', method.id, {
      type: req.body.type,
    });

    res.status(201).json({ paymentMethod: method });
  })
);

/**
 * DELETE /api/pharmacy-refill/payment-methods/:methodId
 * Delete a payment method
 */
pharmacyRefillRouter.delete(
  '/payment-methods/:methodId',
  authenticate,
  validateParams(paymentMethodIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { methodId } = req.params;

    await pharmacyRefillService.deletePaymentMethod(userId, methodId);

    logAuditEvent(userId, 'pharmacy.payment_method.deleted', methodId);

    res.status(204).send();
  })
);

/**
 * POST /api/pharmacy-refill/payment-methods/:methodId/set-default
 * Set default payment method
 */
pharmacyRefillRouter.post(
  '/payment-methods/:methodId/set-default',
  authenticate,
  validateParams(paymentMethodIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { methodId } = req.params;

    const method = await pharmacyRefillService.setDefaultPaymentMethod(
      userId,
      methodId
    );

    logAuditEvent(userId, 'pharmacy.payment_method.set_default', methodId);

    res.json({ paymentMethod: method });
  })
);

// ============================================================================
// Auto-Refill Settings
// ============================================================================

/**
 * GET /api/pharmacy-refill/auto-refill
 * Get user's auto-refill settings
 */
pharmacyRefillRouter.get(
  '/auto-refill',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const settings = await pharmacyRefillService.getAutoRefillSettings(userId);

    res.json({ settings });
  })
);

/**
 * GET /api/pharmacy-refill/auto-refill/:medicationId
 * Get auto-refill settings for a specific medication
 */
pharmacyRefillRouter.get(
  '/auto-refill/:medicationId',
  authenticate,
  validateParams(z.object({ medicationId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;

    const setting = await pharmacyRefillService.getAutoRefillSetting(
      userId,
      medicationId
    );

    res.json({ setting });
  })
);

/**
 * PUT /api/pharmacy-refill/auto-refill/:medicationId
 * Upsert auto-refill settings for a medication
 */
pharmacyRefillRouter.put(
  '/auto-refill/:medicationId',
  authenticate,
  validateParams(z.object({ medicationId: z.string().uuid() })),
  validateBody(autoRefillSettingsSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { medicationId } = req.params;

    const setting = await pharmacyRefillService.upsertAutoRefillSetting(
      userId,
      medicationId,
      req.body
    );

    logAuditEvent(userId, 'pharmacy.auto_refill.updated', medicationId, req.body);

    res.json({ setting });
  })
);

/**
 * POST /api/pharmacy-refill/auto-refill/process
 * Process auto-refills (admin endpoint)
 */
pharmacyRefillRouter.post(
  '/auto-refill/process',
  authenticate,
  asyncHandler(async (req, res) => {
    // TODO: Add admin role check
    const orders = await pharmacyRefillService.processAutoRefills();

    logger.info('Auto-refill processing completed', {
      orderCount: orders.length,
    });

    res.json({ orders, count: orders.length });
  })
);

// ============================================================================
// Webhook Endpoints (for pharmacy partners)
// ============================================================================

/**
 * POST /api/pharmacy-refill/webhook/:pharmacyId
 * Receive webhook events from pharmacy partners
 */
pharmacyRefillRouter.post(
  '/webhook/:pharmacyId',
  asyncHandler(async (req, res) => {
    const { pharmacyId } = req.params;
    const { eventType, orderId, status, data } = req.body;

    // Log webhook event
    logger.info('Received pharmacy webhook', {
      pharmacyId,
      eventType,
      orderId,
      status,
    });

    // Store webhook event for processing
    await logAuditEvent(
      undefined,
      'pharmacy.webhook.received',
      orderId,
      { pharmacyId, eventType, status }
    );

    // Process based on event type
    if (eventType === 'order.status_updated' && orderId && status) {
      // Find the order by external order ID
      // This would require a query to find by order_id column
      // For now, just acknowledge receipt
    }

    res.status(200).json({ received: true });
  })
);
