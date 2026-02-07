# SPEC-001: SaludAlDía - Chronic Health Management App

**Project:** SaludAlDía
**Version:** 1.0.0
**Date:** 2026-02-07
**Author:** SoftVibes Lab
**Methodology:** DDD (Domain-Driven Development)

---

## 1. Executive Summary

SaludAlDía is a mobile application designed to help chronic patients (diabetes, hypertension) manage their medication intake and monitor vital signs. The primary target audience is older adults who often forget to take their medications.

### Key Value Propositions
- **Medication Adherence:** Never miss a dose with smart reminders
- **Health Monitoring:** Track blood pressure and glucose levels
- **IoT Integration:** Connect with Bluetooth-enabled medical devices
- **Emergency Response:** Automatic alerts for critical health events
- **Caregiver Support:** Family members can monitor patients remotely
- **Telemedicine:** Connect with healthcare professionals
- **Pharmacy Refill:** One-click medication delivery from partnered pharmacies

---

## 2. User Stories (EARS Format)

### 2.1 Epic 1: Medication Management

| ID | Requirement (EARS) | Acceptance Criteria |
|----|-------------------|---------------------|
| US-001 | **WHEN** the user opens the app **THE SYSTEM SHALL** display today's medication reminders | - Shows list of medications scheduled for today<br>- Each medication shows: name, time, dosage, photo<br>- Visual indicator for pending vs taken medications |
| US-002 | **WHEN** a medication reminder is due **THE SYSTEM SHALL** send a push notification | - Notification includes medication name and photo<br>- Vibration pattern for accessibility<br>- Sound alert configurable |
| US-003 | **WHEN** the user taps "Ya lo tomé" **THE SYSTEM SHALL** mark medication as taken | - Updates UI to show medication taken<br>- Records timestamp<br>- Syncs with cloud backend |
| US-004 | **WHERE** the user adds a new medication **THE SYSTEM SHALL** allow photo upload | - Camera integration for photo capture<br>- Gallery selection option<br>- Photo storage optimization |
| US-005 | **WHEN** medication inventory is low **THE SYSTEM SHALL** alert the user | - Alert when < 7 days supply remaining<br>- "Surtir receta" button available<br>- Integration with pharmacy partners |

### 2.2 Epic 2: Vital Signs Tracking

| ID | Requirement (EARS) | Acceptance Criteria |
|----|-------------------|---------------------|
| US-010 | **WHEN** user selects "Registrar presión" **THE SYSTEM SHALL** display input form | - Fields for systolic/diastolic values<br>- Unit display: mmHg<br>- Date/time picker |
| US-011 | **WHEN** user selects "Registrar glucosa" **THE SYSTEM SHALL** display input form | - Field for glucose value<br>- Unit display: mg/dL<br>- Fasting/post-meal toggle |
| US-012 | **WHERE** a Bluetooth device is available **THE SYSTEM SHALL** allow connection | - Device discovery via Bluetooth<br>- Auto-connect to paired devices<br>- Manual measurement sync |
| US-013 | **WHEN** vital sign is abnormal **THE SYSTEM SHALL** show warning | - Thresholds: BP > 140/90, Glucose > 130 mg/dL fasting<br>- Color-coded indicators<br>- Suggestion to consult doctor |
| US-014 | **WHEN** user views "Estadísticas de salud" **THE SYSTEM SHALL** display history | - Chart for blood pressure trends<br>- Chart for glucose trends<br>- Last 7/30/90 day views |

### 2.3 Epic 3: Emergency Alerts

| ID | Requirement (EARS) | Acceptance Criteria |
|----|-------------------|---------------------|
| US-020 | **WHEN** vital sign reaches critical level **THE SYSTEM SHALL** trigger emergency protocol | - Critical BP: > 180/120 or < 90/60<br>- Critical Glucose: < 70 or > 400 mg/dL<br>- Immediate alert to emergency contacts |
| US-021 | **WHEN** emergency is triggered **THE SYSTEM SHALL** send notifications to | - Primary caregiver<br>- Emergency services (if enabled)<br>- Healthcare provider |
| US-022 | **WHERE** user is unresponsive **THE SYSTEM SHALL** escalate alerts | - No response after 5 minutes: notify secondary contacts<br>- No response after 10 minutes: notify emergency services<br>- Share location with contacts |

### 2.4 Epic 4: Caregiver Mode

| ID | Requirement (EARS) | Acceptance Criteria |
|----|-------------------|---------------------|
| US-030 | **WHEN** caregiver logs in **THE SYSTEM SHALL** display monitored patients | - List of linked patients<br>- Status indicators for each patient<br>- Quick access to patient details |
| US-031 | **WHEN** patient misses medication **THE SYSTEM SHALL** notify caregiver | - Real-time notification<br>- Medication details included<br>- Action options: call patient, mark as skipped |
| US-032 | **WHEN** patient has abnormal vital **THE SYSTEM SHALL** alert caregiver | - Immediate notification<br>- Vital sign details and trend<br>- Recommendation to contact patient/doctor |
| US-033 | **WHERE** multiple caregivers exist **THE SYSTEM SHALL** support coordinated care | - Primary and secondary caregivers<br>- Notification routing rules<br>- Activity log |

### 2.5 Epic 5: Telemedicine Integration

| ID | Requirement (EARS) | Acceptance Criteria |
|----|-------------------|---------------------|
| US-040 | **WHEN** health data indicates concern **THE SYSTEM SHALL** suggest consultation | - Based on trends (e.g., rising BP)<br>- "Consultar con médico" button<br>- Available doctors list |
| US-041 | **WHEN** user requests consultation **THE SYSTEM SHALL** show available options | - In-person appointment scheduling<br>- Video call booking<br>- Doctor profiles and specialties |
| US-042 | **WHERE** consultation is completed **THE SYSTEM SHALL** update treatment plan | - Medication adjustments<br>- New measurement schedules<br>- Follow-up reminders |

### 2.6 Epic 6: Pharmacy Integration

| ID | Requirement (EARS) | Acceptance Criteria |
|----|-------------------|---------------------|
| US-050 | **WHEN** user taps "Surtir receta" **THE SYSTEM SHALL** show pharmacy options | - Nearest partnered pharmacies<br>- Delivery options<br>- Price comparison |
| US-051 | **WHEN** pharmacy is selected **THE SYSTEM SHALL** send prescription | - Based on registered medications<br>- Quantity based on remaining supply<br>- Insurance information if available |
| US-052 | **WHEN** order is confirmed **THE SYSTEM SHALL** track delivery | - Order status updates<br>- Estimated delivery time<br>- Delivery notifications |

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Mobile Frontend** | React Native | Cross-platform (iOS/Android), large ecosystem |
| **UI Components** | NativeWind | Tailwind-like styling for React Native |
| **State Management** | Zustand + React Query | Lightweight, server state management |
| **Backend** | Node.js + Express | Proven stack, easy deployment |
| **Database** | PostgreSQL (Supabase) | Relational data, real-time capabilities |
| **Authentication** | Supabase Auth | Built-in user management |
| **Storage** | Supabase Storage | Medication photos, documents |
| **Push Notifications** | Firebase Cloud Messaging | Cross-platform push notifications |
| **Bluetooth LE** | react-native-ble-plx | BLE device connection |
| **Video Calls** | Agora/Twilio | Telemedicine video infrastructure |

### 3.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React Native)                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  Home   │ │  Meds   │ │ Vitals  │ │  Stats  │ │Caregivr │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    STATE MANAGEMENT (Zustand)                   │
├─────────────────────────────────────────────────────────────────┤
│                    API LAYER (React Query)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Node.js/Express)              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │   Auth  │ │  Meds   │ │ Vitals  │ │  Alert  │ │ Pharma  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  BLE    │ │  Push   │ │  Video  │ │ Payment │ │  SMS    │  │
│  │ Service │ │ Service │ │ Service │ │ Gateway │ │ Service │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (Supabase)                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   PostgreSQL    │ │    Storage      │ │    Auth         │   │
│  │   (User Data)   │ │  (Med Photos)   │ │  (JWT Tokens)   │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │   BLE   │ │ Pharmacy│ │ Doctors │ │Payment  │ │Emergency│  │
│  │ Devices │ │   API   │ │  API    │ │ Gateway │ │ Services│  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  name TEXT NOT NULL,
  date_of_birth DATE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medications
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  time TIME NOT NULL,
  photo_url TEXT,
  supply_days INTEGER,
  rx_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medication Logs
CREATE TABLE medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  taken_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, taken, skipped
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vital Signs
CREATE TABLE vital_signs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- blood_pressure, glucose
  value TEXT NOT NULL, -- "120/80" or "95"
  unit TEXT NOT NULL, -- mmHg or mg/dL
  additional_data JSONB, -- {fasting: true, meal_time: "before"}
  source TEXT DEFAULT 'manual', -- manual, bluetooth_device
  device_id TEXT,
  measured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caregiver Relationships
CREATE TABLE caregiver_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, caregiver_id)
);

-- Emergency Alerts
CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- critical_bp, critical_glucose, no_response, manual
  vital_sign_id UUID REFERENCES vital_signs(id),
  status TEXT DEFAULT 'active', -- active, acknowledged, resolved, false_alarm
  location_lat FLOAT,
  location_lng FLOAT,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Healthcare Providers
CREATE TABLE healthcare_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  specialty TEXT,
  clinic_name TEXT,
  phone TEXT,
  email TEXT,
  consultation_type TEXT[], -- in_person, online
  availability JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Provider Relationships
CREATE TABLE user_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES healthcare_providers(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider_id)
);

-- Pharmacy Partners
CREATE TABLE pharmacies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude FLOAT,
  longitude FLOAT,
  phone TEXT,
  email TEXT,
  delivery_available BOOLEAN DEFAULT FALSE,
  delivery_radius_km FLOAT,
  api_endpoint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescription Refills
CREATE TABLE prescription_refills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  pharmacy_id UUID REFERENCES pharmacies(id),
  status TEXT DEFAULT 'pending', -- pending, confirmed, preparing, delivered, cancelled
  order_id TEXT,
  delivery_address TEXT,
  estimated_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_medication_logs_user_scheduled ON medication_logs(user_id, scheduled_at);
CREATE INDEX idx_vital_signs_user_type_measured ON vital_signs(user_id, type, measured_at DESC);
CREATE INDEX idx_emergency_alerts_user_status ON emergency_alerts(user_id, status);
CREATE INDEX idx_caregiver_relationships_caregiver ON caregiver_relationships(caregiver_id);
```

---

## 4. UI/UX Specifications

### 4.1 Design Principles
- **Accessibility First:** Large buttons, high contrast, voice commands
- **Simple Navigation:** Maximum 3 taps to any feature
- **Visual Cues:** Color-coded status, clear iconography
- **Offline Support:** Core features work without internet

### 4.2 Color Palette
| Purpose | Color | Hex |
|---------|-------|-----|
| Primary | Blue | #0066CC |
| Success | Green | #22C55E |
| Warning | Yellow | #F59E0B |
| Danger | Red | #EF4444 |
| Neutral | Gray | #6B7280 |
| Background | White/Light Gray | #FFFFFF / #F3F4F6 |

### 4.3 Typography
| Element | Font | Size |
|---------|------|------|
| Headings | System Bold | 24-28px |
| Body | System Regular | 16-18px |
| Captions | System Regular | 12-14px |
| Buttons | System Medium | 16-20px |

### 4.4 Screen Definitions

| Screen | Description | Key Components |
|--------|-------------|----------------|
| Home | Dashboard | Today's summary, quick actions, alerts |
| Medications | Medication list | Medication cards, add/edit, photo upload |
| Add Medication | Form | Name, dosage, frequency, time, photo |
| Record BP | Input form | Systolic, diastolic, device connection |
| Record Glucose | Input form | Value, fasting toggle, device connection |
| Health Stats | Charts | BP trend, glucose trend, date range |
| Caregiver Home | Patient list | Patient cards, status indicators |
| Caregiver Detail | Patient info | Medication status, vitals, activity |
| Emergency | Alert screen | Alert type, actions, contacts |
| Telemedicine | Doctor list | Available doctors, booking |
| Pharmacy | Medication refill | Pharmacy selection, delivery |

---

## 5. Quality Gates (TRUST 5)

### 5.1 Tested
- Unit tests for all business logic (85%+ coverage)
- Integration tests for API endpoints
- E2E tests for critical user flows
- Bluetooth device testing matrix

### 5.2 Readable
- ESLint + Prettier for code formatting
- TypeScript strict mode
- Clear naming conventions
- Comprehensive code comments

### 5.3 Unified
- Component library (NativeWind components)
- Consistent error handling
- Standardized API responses
- Design system documentation

### 5.4 Secured
- HIPAA compliance for health data
- Data encryption at rest and in transit
- Secure authentication (JWT)
- Input validation and sanitization
- Privacy policy and consent management

### 5.5 Trackable
- Conventional commits
- Sentry for error tracking
- Analytics for feature usage
- Audit logs for health data access

---

## 6. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Medication Adherence | > 90% | % of doses taken on time |
| User Retention (30-day) | > 80% | % of users active after 30 days |
| App Rating | > 4.5 | App Store/Play Store rating |
| Critical Alert Response | < 5 min | Avg time to caregiver response |
| System Uptime | > 99.9% | Service availability |

---

## 7. Implementation Phases

### Phase 1: MVP (4-6 weeks)
- User registration and authentication
- Medication management (add, edit, reminders)
- Manual vital sign recording
- Basic health statistics

### Phase 2: IoT & Alerts (3-4 weeks)
- Bluetooth device integration
- Emergency alert system
- Caregiver mode (basic)

### Phase 3: Telemedicine & Pharmacy (3-4 weeks)
- Doctor consultation booking
- Pharmacy integration
- Prescription refill

### Phase 4: Enhanced Features (2-3 weeks)
- Advanced analytics
- Video consultations
- Multi-language support

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| BLE device compatibility | High | Medium | Support popular devices, fallback to manual |
| HIPAA compliance | High | Low | Consult compliance expert, use HIPAA-ready services |
| User adoption (elderly) | High | Medium | User testing with target demographic, tutorials |
| Pharmacy API availability | Medium | Medium | Multiple pharmacy partners, manual fallback |

---

## 9. References
- HIPAA Privacy Rule: https://www.hhs.gov/hipaa/index.html
- Bluetooth LE Guidelines: https://www.bluetooth.com/
- FDA Digital Health Guidelines: https://www.fda.gov/medical-devices/digital-health

---

**Document Status:** DRAFT
**Next Steps:** Review with stakeholders, begin Phase 1 implementation
