-- SaludAlDía Database Schema
-- HIPAA: All tables include proper indexes and constraints
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  date_of_birth DATE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  profile_photo_url TEXT,
  role TEXT DEFAULT 'patient', -- patient, caregiver, admin
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MEDICATIONS
-- ============================================================================
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL, -- daily, twice_daily, as_needed, etc.
  times TIME[] NOT NULL, -- Array of times for reminders
  photo_url TEXT,
  supply_days INTEGER,
  rx_number TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MEDICATION LOGS
-- ============================================================================
CREATE TABLE medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  taken_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, taken, skipped
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- VITAL SIGNS
-- ============================================================================
CREATE TABLE vital_signs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- blood_pressure, glucose, weight, temperature
  systolic INTEGER, -- For blood pressure
  diastolic INTEGER, -- For blood pressure
  value TEXT, -- For other types
  unit TEXT NOT NULL, -- mmHg, mg/dL, kg, °C
  additional_data JSONB DEFAULT '{}', -- {fasting: true, meal_time: "before"}
  source TEXT DEFAULT 'manual', -- manual, bluetooth_device
  device_id TEXT,
  measured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CAREGIVER RELATIONSHIPS
-- ============================================================================
CREATE TABLE caregiver_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, caregiver_id)
);

-- ============================================================================
-- EMERGENCY ALERTS
-- ============================================================================
CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- critical_bp, critical_glucose, no_response, manual
  vital_sign_id UUID REFERENCES vital_signs(id),
  status TEXT DEFAULT 'active', -- active, acknowledged, resolved, false_alarm
  location_lat FLOAT,
  location_lng FLOAT,
  escalation_level INTEGER DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EMERGENCY NOTIFICATIONS
-- ============================================================================
CREATE TABLE emergency_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES emergency_alerts(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id),
  recipient_type TEXT NOT NULL, -- caregiver, emergency_service, healthcare_provider
  recipient_contact TEXT NOT NULL, -- phone number or email
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HEALTHCARE PROVIDERS
-- ============================================================================
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

-- ============================================================================
-- USER-PROVIDER RELATIONSHIPS
-- ============================================================================
CREATE TABLE user_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES healthcare_providers(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider_id)
);

-- ============================================================================
-- PHARMACY PARTNERS
-- ============================================================================
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

-- ============================================================================
-- PRESCRIPTION REFILLS
-- ============================================================================
CREATE TABLE prescription_refills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  pharmacy_id UUID REFERENCES pharmacies(id),
  status TEXT DEFAULT 'pending', -- pending, confirmed, preparing, delivered, cancelled
  order_id TEXT,
  delivery_address TEXT,
  estimated_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PUSH NOTIFICATIONS
-- ============================================================================
CREATE TABLE push_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- medication_reminder, vital_alert, emergency, etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG (HIPAA Requirement)
-- ============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (Performance optimization)
-- ============================================================================
CREATE INDEX idx_medication_logs_user_scheduled ON medication_logs(user_id, scheduled_at DESC);
CREATE INDEX idx_medication_logs_medication_scheduled ON medication_logs(medication_id, scheduled_at DESC);
CREATE INDEX idx_vital_signs_user_type_measured ON vital_signs(user_id, type, measured_at DESC);
CREATE INDEX idx_vital_signs_user_measured ON vital_signs(user_id, measured_at DESC);
CREATE INDEX idx_emergency_alerts_user_status ON emergency_alerts(user_id, status, created_at DESC);
CREATE INDEX idx_emergency_notifications_alert_status ON emergency_notifications(alert_id, status);
CREATE INDEX idx_caregiver_relationships_caregiver ON caregiver_relationships(caregiver_id);
CREATE INDEX idx_caregiver_relationships_patient ON caregiver_relationships(patient_id);
CREATE INDEX idx_push_notifications_user_status ON push_notifications(user_id, status, scheduled_for);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC) IF NOT EXISTS;
CREATE INDEX idx_audit_logs_action_created ON audit_logs(action, created_at DESC) IF NOT EXISTS;

-- ============================================================================
-- UPDATED AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get today's medications for a user
CREATE OR REPLACE FUNCTION get_todays_medications(p_user_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  medication_id UUID,
  medication_name TEXT,
  dosage TEXT,
  photo_url TEXT,
  scheduled_time TIME,
  log_id UUID,
  status TEXT,
  taken_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS medication_id,
    m.name AS medication_name,
    m.dosage,
    m.photo_url,
    UNNEST(m.times) AS scheduled_time,
    ml.id AS log_id,
    ml.status,
    ml.taken_at
  FROM medications m
  CROSS JOIN LATERAL UNNEST(m.times) AS scheduled_time
  LEFT JOIN LATERAL (
    SELECT id, status, taken_at
    FROM medication_logs
    WHERE medication_id = m.id
      AND user_id = p_user_id
      AND DATE(scheduled_at) = p_date
      AND EXTRACT(HOUR FROM scheduled_at) = EXTRACT(HOUR FROM scheduled_time)
    LIMIT 1
  ) ml ON true
  WHERE m.user_id = p_user_id
    AND m.is_active = TRUE
  ORDER BY scheduled_time;
END;
$$ LANGUAGE plpgsql;

-- Check if vital sign is abnormal
CREATE OR REPLACE FUNCTION check_vital_sign_abnormal(
  p_type TEXT,
  p_systolic INTEGER,
  p_diastolic INTEGER,
  p_value TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Blood pressure thresholds
  IF p_type = 'blood_pressure' THEN
    IF p_systolic > 180 OR p_diastolic > 120 THEN
      RETURN TRUE; -- Critical
    END IF;
    IF p_systolic > 140 OR p_diastolic > 90 THEN
      RETURN TRUE; -- Warning
    END IF;
  END IF;

  -- Glucose thresholds
  IF p_type = 'glucose' THEN
    IF CAST(p_value AS INTEGER) < 70 OR CAST(p_value AS INTEGER) > 400 THEN
      RETURN TRUE; -- Critical
    END IF;
    IF CAST(p_value AS INTEGER) > 130 THEN
      RETURN TRUE; -- Warning
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Get patient's caregivers
CREATE OR REPLACE FUNCTION get_patient_caregivers(p_patient_id UUID)
RETURNS TABLE (
  caregiver_id UUID,
  caregiver_name TEXT,
  caregiver_email TEXT,
  caregiver_phone TEXT,
  is_primary BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS caregiver_id,
    c.name AS caregiver_name,
    c.email AS caregiver_email,
    c.phone AS caregiver_phone,
    cr.is_primary
  FROM caregiver_relationships cr
  JOIN users c ON cr.caregiver_id = c.id
  WHERE cr.patient_id = p_patient_id
    AND c.is_active = TRUE
  ORDER BY cr.is_primary DESC, c.name;
END;
$$ LANGUAGE plpgsql;
