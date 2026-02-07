# SPEC-003: Emergency Alerts System

**Parent:** SPEC-001
**Module:** Emergency Detection & Notification
**Version:** 1.0.0
**Date:** 2026-02-07

---

## 1. Overview

The Emergency Alerts System monitors patient vital signs and medication adherence, triggering appropriate escalation protocols when critical conditions are detected.

---

## 2. Alert Types

| Alert Type | Trigger Condition | Severity | Recipients |
|------------|-------------------|----------|------------|
| CRITICAL_BP | BP > 180/120 or < 90/60 | CRITICAL | Caregiver, Emergency Services |
| CRITICAL_GLUCOSE | Glucose < 70 or > 400 mg/dL | CRITICAL | Caregiver, Emergency Services |
| MEDICATION_MISSED | No confirmation within 2 hours | WARNING | Caregiver |
| NO_RESPONSE | No activity for 24h + missed check-in | HIGH | Caregiver, Emergency Services |
| MANUAL_TRIGGER | User presses SOS button | CRITICAL | All contacts, Emergency Services |
| IRREGULAR_PATTERN | Abnormal trend (3 consecutive high readings) | WARNING | Caregiver, Healthcare Provider |

---

## 3. Escalation Protocol

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALERT TRIGGERED                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Initial Alert  │
                    │  (Immediate)    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Wait 5 min     │
                    │  for response   │
                    └─────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
          Response received          No response
                │                           │
                ▼                           ▼
    ┌───────────────────┐         ┌─────────────────┐
    │  Alert Resolved   │         │  Escalate to    │
    │  (Log event)      │         │  Secondary      │
    └───────────────────┘         │  Contacts       │
                                  └─────────────────┘
                                            │
                                            ▼
                                  ┌─────────────────┐
                                  │  Wait 5 more    │
                                  │  minutes        │
                                  └─────────────────┘
                                            │
                              ┌─────────────┴─────────────┐
                              │                           │
                        Response received          No response
                              │                           │
                              ▼                           ▼
                  ┌───────────────────┐         ┌─────────────────┐
                  │  Alert Resolved   │         │  CALL Emergency │
                  │  (Log event)      │         │  Services +     │
                  └───────────────────┘         │  Share Location │
                                                └─────────────────┘
```

---

## 4. User Stories (EARS Format)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| EA-001 | WHEN vital sign reaches critical level, THE SYSTEM SHALL immediately trigger alert | - Alert sent within 10 seconds<br>- Includes all relevant data (values, timestamp) |
| EA-002 | WHEN alert is triggered, THE SYSTEM SHALL send push notification to caregivers | - Push notification with sound<br>- In-app notification<br>- SMS fallback if no response |
| EA-003 | WHERE alert remains unacknowledged, THE SYSTEM SHALL escalate | - Secondary contacts notified after 5 min<br>- Emergency services notified after 10 min |
| EA-004 | WHEN emergency services are notified, THE SYSTEM SHALL include location | - GPS coordinates<br>- Address if available<br>- Contact info for user |
| EA-005 | WHEN user responds to alert, THE SYSTEM SHALL stop escalation | - Response timestamp logged<br>- All contacts notified of resolution |
| EA-006 | WHERE user triggers manual SOS, THE SYSTEM SHALL bypass escalation | - Immediate notification to ALL contacts<br>- Emergency services called immediately |

---

## 5. Notification Channels

| Channel | Use Case | Priority |
|---------|----------|----------|
| Push Notification | All alerts | Primary |
| In-App Alert | App is open | Primary |
| SMS | No push response after 2 min | Secondary |
| Phone Call | Critical alerts, no SMS response | Tertiary |
| Email | Non-critical alerts, audit log | Informational |

---

## 6. Technical Implementation

```typescript
interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  severity: 'critical' | 'high' | 'warning';
  data: {
    vitalSign?: VitalSign;
    medication?: Medication;
    location?: Location;
  };
  status: 'active' | 'acknowledged' | 'escalated' | 'resolved';
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

interface EscalationRule {
  alertType: AlertType;
  tier: number;
  waitTimeMinutes: number;
  recipients: Recipient[];
  actions: AlertAction[];
}

class EmergencyService {
  async triggerAlert(alert: Alert): Promise<void>
  async acknowledgeAlert(alertId: string, userId: string): Promise<void>
  async resolveAlert(alertId: string, userId: string): Promise<void>
  async escalateAlert(alertId: string): Promise<void>
  checkPendingAlerts(): Promise<void> // Run every minute
}
```

---

## 7. Emergency Contact Management

```typescript
interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relationship: 'caregiver' | 'family' | 'healthcare_provider' | 'emergency_services';
  phone: string;
  email?: string;
  priority: 1 | 2 | 3; // 1 = primary
  notificationMethods: ('push' | 'sms' | 'call' | 'email')[];
  availableHours?: { start: string; end: string }[];
}
```

---

## 8. Configuration

Thresholds are user-configurable with recommended defaults:

| Metric | Danger Low | Warning Low | Normal | Warning High | Danger High |
|--------|------------|-------------|--------|--------------|-------------|
| Systolic BP | < 90 | 90-100 | 100-130 | 131-140 | > 140 |
| Diastolic BP | < 60 | 60-65 | 65-85 | 86-90 | > 90 |
| Glucose (fasting) | < 70 | 70-80 | 80-100 | 101-125 | > 125 |
| Glucose (post-meal) | - | - | < 140 | 140-180 | > 180 |

---

**Dependencies:** SPEC-001 (Core App), SPEC-002 (IoT Integration)
