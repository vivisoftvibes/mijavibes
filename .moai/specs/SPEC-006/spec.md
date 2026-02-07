# SPEC-006: Pharmacy Refill Module

**Parent:** SPEC-001
**Module:** Medication Delivery Integration
**Version:** 1.0.0
**Date:** 2026-02-07

---

## 1. Overview

The Pharmacy Refill module allows patients to order medication refills from partnered pharmacies with home delivery. It integrates with the medication inventory system to suggest refills before running out.

---

## 2. User Stories (EARS Format)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| PR-001 | WHEN medication supply is low (< 7 days), THE SYSTEM SHALL alert user | - Notification on app opening<br>- Banner on medication card<br>- "Surtir receta" button |
| PR-002 | WHEN user taps "Surtir receta", THE SYSTEM SHALL show pharmacy options | - Nearest partnered pharmacies first<br>- Delivery vs pickup options<br>- Price comparison |
| PR-003 | WHEN user selects pharmacy, THE SYSTEM SHALL prepare order | - Auto-filled with registered medications<br>- Quantity based on remaining supply<br>- Prescription validation |
| PR-004 | WHEN order is confirmed, THE SYSTEM SHALL send to pharmacy | - Order transmitted via API<br>- Confirmation number generated<br>- Estimated delivery time |
| PR-005 | DURING delivery, THE SYSTEM SHALL track order status | - Real-time status updates<br>- Delivery driver location (if available)<br>- Delivery notifications |
| PR-006 | WHEN delivery is complete, THE SYSTEM SHALL update inventory | - Supply days updated<br>- Next refill date calculated<br>- Payment processed |

---

## 3. Pharmacy Integration

### 3.1 Supported Pharmacy Partners

| Pharmacy | Delivery | API Integration | Coverage |
|----------|----------|-----------------|----------|
| Farmacia del Ahorro | ✅ | Direct API | National |
| Benavides | ✅ | Direct API | National |
| Guadalajara | ✅ | Direct API | National |
| San Pablo | ✅ | Manual Fax | Regional |
| Similar | ❌ | Manual | Pickup only |

### 3.2 Pharmacy API Schema

```typescript
interface PharmacyPartner {
  id: string;
  name: string;
  logoUrl: string;
  integrationType: 'direct_api' | 'manual_fax' | 'email';
  apiEndpoint?: string;
  apiKey?: string;
  deliveryAvailable: boolean;
  deliveryRadiusKm?: number;
  deliveryFee: number;
  minimumOrder: number;
  estimatedDeliveryTime: {
    min: number; // hours
    max: number; // hours
  };
  operatingHours: {
    [key: string]: { open: string; close: string };
  };
}

interface PharmacyOrder {
  orderId: string;
  pharmacyId: string;
  patientId: string;
  items: PharmacyOrderItem[];
  delivery: {
    type: 'delivery' | 'pickup';
    address?: string;
    latitude?: number;
    longitude?: number;
    scheduledAt?: Date;
  };
  payment: {
    method: 'cash' | 'card' | 'insurance';
    amount: number;
    insuranceInfo?: InsuranceInfo;
  };
  prescriptionFiles?: string[]; // URLs to prescription images
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
  estimatedDelivery?: Date;
  trackingUrl?: string;
  createdAt: Date;
  confirmedAt?: Date;
  deliveredAt?: Date;
}

interface PharmacyOrderItem {
  medicationId: string;
  name: string;
  dosage: string;
  quantity: number; // days supply
  rxNumber?: string;
  requiresPrescription: boolean;
  price?: number;
}
```

---

## 4. Inventory Management

### 4.1 Supply Tracking

```typescript
interface MedicationInventory {
  medicationId: string;
  userId: string;
  currentSupply: number; // days remaining
  lastRefillDate: Date;
  nextRefillDate?: Date;
  refillReminderSent: boolean;
  autoRefillEnabled: boolean;
  preferredPharmacyId?: string;
}

interface SupplyAlert {
  medicationId: string;
  medicationName: string;
  daysRemaining: number;
  urgency: 'critical' | 'warning' | 'info';
  suggestedRefillDate: Date;
}
```

### 4.2 Supply Thresholds

| Days Remaining | Alert Type | Action |
|----------------|------------|--------|
| 0-3 | Critical | Immediate refill needed, emergency supply |
| 4-7 | Warning | Refill recommended, order now |
| 8-14 | Info | Refill available, plan ahead |

---

## 5. Order Flow

```
┌─────────────────┐
│  User triggers  │
│  "Surtir"       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Show Pharmacy  │
│  Options        │
│  (sorted by     │
│   distance)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Selects   │
│  Pharmacy       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Review Order   │
│  - Medications  │
│  - Quantities   │
│  - Delivery/Pickup
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Payment Method │
│  - Insurance    │
│  - Card         │
│  - Cash on Delivery
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Confirm Order  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send to        │
│  Pharmacy API   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Track Order    │
│  Status Updates │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Delivery /     │
│  Pickup         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Confirm        │
│  Receipt        │
│  Update         │
│  Inventory      │
└─────────────────┘
```

---

## 6. UI/UX Specifications

### 6.1 "Surtir Receta" Flow

**Screen 1: Low Supply Alert**
```
┌─────────────────────────────────────────────────┐
│  ⚠️  Medicamento por agotarse                   │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  [Pill Photo]                             │  │
│  │  Lisinopril 10mg                          │  │
│  │                                           │  │
│  │  Quedan 3 días de suministro              │  │
│  │                                           │  │
│  │  📊 Última surtido: 15 Ene 2026           │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  [Surtir receta ahora]                           │
│  [Recordar más tarde]                           │
└─────────────────────────────────────────────────┘
```

**Screen 2: Pharmacy Selection**
```
┌─────────────────────────────────────────────────┐
│  ← Seleccionar farmacia                         │
├─────────────────────────────────────────────────┤
│                                                  │
│  📍 Usando tu ubicación                          │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  🏥 Farmacia del Ahorro         0.8 km    │  │
│  │     🚚 Delivery disponible               │  │
│  │     💲 $45 MXN envío                    │  │
│  │     ⏱️  2-4 horas                       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  🏥 Farmacias Benavides          1.2 km    │  │
│  │     🚚 Delivery disponible               │  │
│  │     💲 $35 MXN envío                    │  │
│  │     ⏱️  3-5 horas                       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  🏥 Farmacia Guadalajara          2.5 km   │  │
│  │     🚚 Recoger en tienda                 │  │
│  │     💲 Gratis                             │  │
│  │     ⏱️  Listo en 1 hora                  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  [Ver más farmacias...]                          │
└─────────────────────────────────────────────────┘
```

**Screen 3: Order Review**
```
┌─────────────────────────────────────────────────┐
│  ← Confirmar pedido                             │
├─────────────────────────────────────────────────┤
│                                                  │
│  🏥 Farmacia del Ahorro                          │
│  📍 Av. Principal #123                           │
│  🚚 Delivery a domicilio                         │
│  ⏱️  Llegada estimada: 4:00 - 6:00 PM           │
│                                                  │
│  ─────────────────────────────────────────────  │
│  Pedido:                                         │
│                                                  │
│  • Lisinopril 10mg                               │
│    Suministro para 30 días                       │
│    💲 $150.00                                    │
│                                                  │
│  • Metformina 500mg                              │
│    Suministro para 30 días                       │
│    💲 $85.00                                     │
│                                                  │
│  ─────────────────────────────────────────────  │
│  Envío:                              $45.00     │
│  ─────────────────────────────────────────────  │
│  Total:                             $280.00     │
│                                                  │
│  💳 Método de pago:                              │
│    ⦿ Efectivo (al entregar)                     │
│    ○ Tarjeta terminada en ****4242               │
│    ○ Seguro Popular                              │
│                                                  │
│  [Confirmar pedido]                              │
└─────────────────────────────────────────────────┘
```

**Screen 4: Order Tracking**
```
┌─────────────────────────────────────────────────┐
│  ← Seguimiento del pedido                       │
├─────────────────────────────────────────────────┤
│                                                  │
│  📍 Tu pedido está en camino                    │
│  Llegada estimada: 4:30 PM                      │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  ✓  Pedido confirmado     2:15 PM        │  │
│  │  ✓  Preparando            2:30 PM        │  │
│  │  ⏳  En camino             3:45 PM        │  │
│  │  ⏸️  Entregado                             │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  📍 Ubicación del repartidor              │  │
│  │  [Map showing driver location]            │  │
│  │                                           │  │
│  │  📞 Contactar repartidor                  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  [Cancelar pedido]                               │
└─────────────────────────────────────────────────┘
```

---

## 7. Payment Integration

```typescript
interface PaymentMethod {
  id: string;
  userId: string;
  type: 'cash' | 'credit_card' | 'debit_card' | 'insurance';
  isDefault: boolean;
  cardDetails?: {
    last4: string;
    brand: 'visa' | 'mastercard' | 'amex';
    expiryMonth: number;
    expiryYear: number;
  };
  insuranceDetails?: {
    provider: string;
    policyNumber: string;
    memberId: string;
  };
}

interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

---

## 8. Insurance Integration

For patients with health insurance:

1. **Validate Coverage**: Check if medication is covered
2. **Calculate Copay**: Show patient's portion
3. **Submit Claim**: Auto-submit to insurance
4. **Track Status**: Monitor claim approval

---

## 9. Auto-Refill Feature

Optional feature for maintenance medications:

```typescript
interface AutoRefillSettings {
  medicationId: string;
  enabled: boolean;
  triggerDays: number; // Refill when X days remaining
  preferredPharmacyId: string;
  paymentMethodId: string;
  confirmationRequired: boolean; // Require approval before ordering
}
```

**Flow:**
1. When supply reaches trigger threshold
2. Create order with preferred pharmacy
3. If confirmation required: send notification
4. If no response within 24h: cancel order
5. If confirmation not required: auto-confirm

---

## 10. Error Handling

| Error | Recovery |
|-------|----------|
| Pharmacy API down | Queue order, retry in 5 min |
| Out of stock | Suggest alternative pharmacy |
| Prescription expired | Alert user to contact doctor |
| Delivery address invalid | Prompt for correction |
| Payment failed | Retry, offer alternative methods |

---

**Dependencies:** SPEC-001 (Core App)
**Related:** SPEC-004 (Telemedicine - for prescription updates)
