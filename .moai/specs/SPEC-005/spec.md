# SPEC-005: Caregiver Mode Module

**Parent:** SPEC-001
**Module:** Family/Caregiver Patient Monitoring
**Version:** 1.0.0
**Date:** 2026-02-07

---

## 1. Overview

Caregiver Mode allows family members or professional caregivers to monitor patients remotely, receive alerts about medication adherence and vital signs, and take action when needed.

---

## 2. User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| PRIMARY_CAREGIVER | Main family caregiver | Full access, can add other caregivers |
| SECONDARY_CAREGIVER | Additional family members | View only, receive alerts |
| PROFESSIONAL_CAREGIVER | Paid healthcare worker | Full access during assigned hours |
| HEALTHCARE_PROVIDER | Medical professional | View health data, no daily alerts |

---

## 3. User Stories (EARS Format)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| CG-001 | WHEN caregiver logs in, THE SYSTEM SHALL display monitored patients | - Patient cards with current status<br>- Quick action buttons<br>- Last update timestamp |
| CG-002 | WHEN patient misses medication, THE SYSTEM SHALL notify caregiver | - Real-time push notification<br>- Medication details included<br>- Action buttons: Call, Mark as Skipped |
| CG-003 | WHEN patient has abnormal vital, THE SYSTEM SHALL alert caregiver | - Immediate notification<br- Vital value vs normal range<br- Trend indicator (rising/falling) |
| CG-004 | WHEN caregiver taps patient card, THE SYSTEM SHALL show detailed view | - Medication status (today/week)<br>- Recent vital signs<br>- Recent alerts<br>- Activity timeline |
| CG-005 | WHEN caregiver needs to contact patient, THE SYSTEM SHALL provide quick actions | - Call button (phone)<br>- Video call option<br>- Send message |
| CG-006 | WHERE multiple caregivers monitor same patient, THE SYSTEM SHALL coordinate notifications | - Primary gets first notification<br>- Secondary notified after 5 min if no response<br>- Notification log visible to all |
| CG-007 | WHEN caregiver takes action, THE SYSTEM SHALL log it | - Action timestamped<br>- Which caregiver responded<br>- Action taken |
| CG-008 | WHERE professional caregiver assigned, THE SYSTEM SHALL respect scheduled hours | - Notifications only during shifts<br>- Handoff between caregivers<br- Shift notes |

---

## 4. Caregiver Dashboard

### 4.1 Patient Card

```
┌─────────────────────────────────────────────────┐
│  [Photo]  Manuel Gómez           🟢 All Good    │
│           Age: 72                                   │
│                                                   │
│  💊 Medications    2/3 taken                      │
│     ⏰ Lisinopril  ✓ 8:00 AM                      │
│     ⏰ Metformin   ✓ 8:00 AM                      │
│     ⏰ Atorvastatin ⏳ 8:00 PM                     │
│                                                   │
│  📊 Vital Signs                                   │
│     ❤️ BP: 130/85 mmHg (9:30 AM)                  │
│     🩸 Glucose: 95 mg/dL (7:00 AM)                │
│                                                   │
│  📱 Last seen: 15 min ago                         │
│                                                   │
│  [Call] [Message] [View Details]                 │
└─────────────────────────────────────────────────┘
```

### 4.2 Patient Detail View

```
┌─────────────────────────────────────────────────┐
│  ←         Manuel Gómez                          │
├─────────────────────────────────────────────────┤
│                                                  │
│  📋 Today's Status                               │
│  ┌───────────────────────────────────────────┐  │
│  │  ✅ 2 of 3 medications taken              │  │
│  │  ✅ Vitals within normal range            │  │
│  │  ✅ No alerts today                       │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  💊 Medications (Today)                          │
│  ┌───────────────────────────────────────────┐  │
│  │  ✓ Lisinopril 10mg - 8:00 AM             │  │
│  │  ✓ Metformin 500mg - 8:00 AM             │  │
│  │  ⏳ Atorvastatin 20mg - 8:00 PM           │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  📊 Recent Vitals                                │
│  ┌───────────────────────────────────────────┐  │
│  │  Blood Pressure Chart                     │  │
│  │  ██████████████████████                   │  │
│  │                                             │  │
│  │  Glucose Chart                             │  │
│  │  ██████████████████████                   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  🔔 Recent Alerts                                │
│  ┌───────────────────────────────────────────┐  │
│  │  🟡 High BP (Jan 15) - Resolved           │  │
│  │  🟠 Missed dose (Jan 12) - Acknowledged   │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  📞 Quick Actions                                │
│  ┌───────────────────────────────────────────┐  │
│  │  [📱 Call] [💬 Message] [📹 Video]         │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 5. Data Models

```typescript
interface CaregiverRelationship {
  id: string;
  patientId: string;
  caregiverId: string;
  role: 'primary' | 'secondary' | 'professional';
  status: 'pending' | 'active' | 'paused' | 'ended';
  permissions: {
    viewVitals: boolean;
    viewMedications: boolean;
    receiveAlerts: boolean;
    modifySchedule: boolean;
    contactPatient: boolean;
  };
  notificationPreferences: {
    medicationMissed: boolean;
    vitalAbnormal: boolean;
    emergencyAlerts: boolean;
    quietHours: {
      enabled: boolean;
      start: string; // HH:mm
      end: string; // HH:mm
    };
  };
  professionalSchedule?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  createdAt: Date;
  endedAt?: Date;
}

interface CaregiverAction {
  id: string;
  patientId: string;
  caregiverId: string;
  alertId?: string;
  type: 'acknowledged' | 'called_patient' | 'called_emergency' | 'marked_skipped' | 'added_note';
  notes?: string;
  createdAt: Date;
}

interface PatientStatus {
  patientId: string;
  timestamp: Date;
  medications: {
    scheduled: number;
    taken: number;
    missed: number;
    pending: number;
  };
  vitals: {
    lastBP?: { value: string; timestamp: Date; abnormal: boolean };
    lastGlucose?: { value: number; timestamp: Date; abnormal: boolean };
  };
  recentActivity: {
    type: string;
    description: string;
    timestamp: Date;
  }[];
  status: 'all_good' | 'attention_needed' | 'critical';
}
```

---

## 6. Notification Routing Logic

```
┌─────────────────────────────────────────────────────────────┐
│                     ALERT TRIGGERED                          │
│                  Type: MEDICATION_MISSED                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────┐
          │     Get Active Caregivers           │
          └─────────────────────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────┐
          │     Sort by Priority & Availability │
          └─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
  ┌─────────────────┐             ┌─────────────────┐
  │ Primary Care-   │             │ In Shift Pro-   │
  │ giver           │             │ fessional       │
  └─────────────────┘             └─────────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────┐
          │     Send Notification               │
          │     (with 5-min response timer)     │
          └─────────────────────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────┐
          │     Wait for Response               │
          └─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
      Response received               No response
            │                               │
            ▼                               ▼
  ┌─────────────────┐             ┌─────────────────┐
  │  Log Response   │             │  Notify Next    │
  │  Stop Escalation│             │  Caregiver      │
  └─────────────────┘             └─────────────────┘
```

---

## 7. Privacy & Consent

### 7.1 Patient Consent Required

- Adding a new caregiver
- Granting access permissions
- Sharing health data
- Location tracking

### 7.2 Caregiver Agreement

Caregivers must agree to:
- Use patient data only for care purposes
- Maintain confidentiality
- Respect patient autonomy
- Report changes in patient condition

---

## 8. Caregiver Onboarding

1. **Invitation**: Patient invites via phone/email
2. **Registration**: Caregiver creates account
3. **Consent**: Patient grants permissions
4. **Tutorial**: Guided walkthrough of features
5. **Test**: Test notification sent

---

**Dependencies:** SPEC-001 (Core App), SPEC-003 (Emergency Alerts)
