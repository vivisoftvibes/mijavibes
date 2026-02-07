-- Telemedicine Integration Module (SPEC-004)
-- This migration adds appointments, consultation notes, and video call support
-- Version: 1.2.0

-- ============================================================================
-- APPOINTMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES healthcare_providers(id),
  type VARCHAR(20) NOT NULL DEFAULT 'video',
  status VARCHAR(20) DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration INTEGER DEFAULT 20,
  reason TEXT NOT NULL,
  notes TEXT,
  health_data_snapshot JSONB,
  video_call_link TEXT,
  video_call_token TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_at TIMESTAMPTZ,
  calendar_event_id TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  no_show_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT appointments_type_check CHECK (type IN ('in_person', 'video', 'async_message')),
  CONSTRAINT appointments_status_check CHECK (status IN (
    'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
  ))
);

-- ============================================================================
-- APPOINTMENT AVAILABILITY SLOTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES healthcare_providers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  consultation_type VARCHAR(20) NOT NULL DEFAULT 'video',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT provider_availability_type_check CHECK (consultation_type IN ('in_person', 'video'))
);

-- ============================================================================
-- CONSULTATION NOTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultation_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES healthcare_providers(id),
  chief_complaint TEXT,
  subjective_notes TEXT,
  objective_notes TEXT,
  assessment TEXT,
  treatment_plan JSONB,
  follow_up_instructions TEXT,
  prescribed_medications JSONB,
  vitals_during_consultation JSONB,
  is_confidential BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HEALTH SUMMARY EXPORTS (PDF)
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  generated_by UUID REFERENCES users(id),
  period VARCHAR(10) NOT NULL,
  summary_data JSONB NOT NULL,
  pdf_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT health_summaries_period_check CHECK (period IN ('7d', '30d', '90d'))
);

-- ============================================================================
-- TREATMENT PLAN UPDATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS treatment_plan_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES users(id),
  medication_changes JSONB,
  new_measurement_frequencies JSONB,
  lifestyle_recommendations TEXT[],
  follow_up_scheduled_at TIMESTAMPTZ,
  follow_up_provider_id UUID REFERENCES healthcare_providers(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PAYMENT/INSURANCE FOR CONSULTATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultation_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  method VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  insurance_provider TEXT,
  insurance_member_id TEXT,
  insurance_pre_authorization TEXT,
  payment_gateway_transaction_id TEXT,
  payment_gateway_response JSONB,
  refunded_at TIMESTAMPTZ,
  refund_amount NUMERIC(10, 2),
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT consultation_payments_method_check CHECK (method IN ('insurance', 'credit_card', 'paypal', 'apple_pay', 'google_pay')),
  CONSTRAINT consultation_payments_status_check CHECK (status IN ('pending', 'processing', 'paid', 'refunded', 'failed'))
);

-- ============================================================================
-- VIDEO CALL SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES healthcare_providers(id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_sdk VARCHAR(20) DEFAULT 'agora',
  session_id TEXT NOT NULL,
  provider_token TEXT NOT NULL,
  user_token TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  recording_status VARCHAR(20) DEFAULT 'none',
  technical_issues JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT video_call_sessions_sdk_check CHECK (provider_sdk IN ('agora', 'twilio', 'daily')),
  CONSTRAINT video_call_sessions_recording_check CHECK (recording_status IN ('none', 'requested', 'processing', 'available', 'failed'))
);

-- ============================================================================
-- UPDATED AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_availability_updated_at
  BEFORE UPDATE ON provider_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultation_notes_updated_at
  BEFORE UPDATE ON consultation_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultation_payments_updated_at
  BEFORE UPDATE ON consultation_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEXES (Performance optimization)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_appointments_user_status ON appointments(user_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_status ON appointments(provider_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at)
  WHERE status IN ('scheduled', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_appointments_video_call ON appointments(video_call_link)
  WHERE video_call_link IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_availability_provider ON provider_availability(provider_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_provider_availability_available ON provider_availability(provider_id, is_available)
  WHERE is_available = TRUE;

CREATE INDEX IF NOT EXISTS idx_consultation_notes_appointment ON consultation_notes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_provider ON consultation_notes(provider_id);

CREATE INDEX IF NOT EXISTS idx_health_summaries_user ON health_summaries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_summaries_appointment ON health_summaries(appointment_id);

CREATE INDEX IF NOT EXISTS idx_treatment_plan_updates_appointment ON treatment_plan_updates(appointment_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plan_updates_user ON treatment_plan_updates(user_id);

CREATE INDEX IF NOT EXISTS idx_consultation_payments_appointment ON consultation_payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_payments_user_status ON consultation_payments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_video_call_sessions_appointment ON video_call_sessions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_video_call_sessions_user ON video_call_sessions(user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get available time slots for a provider on a given date
CREATE OR REPLACE FUNCTION get_provider_available_slots(
  p_provider_id UUID,
  p_date DATE,
  p_consultation_type VARCHAR DEFAULT 'video'
)
RETURNS TABLE (
  slot_time TIME,
  slot_end_time TIME,
  is_available BOOLEAN
) AS $$
DECLARE
  v_day_of_week INTEGER := EXTRACT(DOW FROM p_date);
BEGIN
  RETURN QUERY
  SELECT
    pa.start_time AS slot_time,
    pa.start_time + (pa.end_time - pa.start_time) AS slot_end_time,
    pa.is_available AND NOT EXISTS (
      SELECT 1 FROM appointments
      WHERE provider_id = p_provider_id
        AND type = p_consultation_type
        AND status IN ('scheduled', 'confirmed', 'in_progress')
        AND DATE(scheduled_at) = p_date
        AND scheduled_at::time = pa.start_time
    ) AS is_available
  FROM provider_availability pa
  WHERE pa.provider_id = p_provider_id
    AND pa.day_of_week = v_day_of_week
    AND pa.consultation_type = p_consultation_type
    AND pa.is_available = TRUE
  ORDER BY pa.start_time;
END;
$$ LANGUAGE plpgsql;

-- Get upcoming appointments for a user
CREATE OR REPLACE FUNCTION get_upcoming_appointments(p_user_id UUID)
RETURNS TABLE (
  appointment_id UUID,
  provider_name TEXT,
  provider_specialty TEXT,
  appointment_type VARCHAR(20),
  status VARCHAR(20),
  scheduled_at TIMESTAMPTZ,
  duration INTEGER,
  reason TEXT,
  video_call_link TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS appointment_id,
    hp.name AS provider_name,
    hp.specialty AS provider_specialty,
    a.type AS appointment_type,
    a.status,
    a.scheduled_at,
    a.duration,
    a.reason,
    a.video_call_link
  FROM appointments a
  JOIN healthcare_providers hp ON a.provider_id = hp.id
  WHERE a.user_id = p_user_id
    AND a.scheduled_at > NOW()
    AND a.status NOT IN ('cancelled', 'completed', 'no_show')
  ORDER BY a.scheduled_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Generate health summary data for a period
CREATE OR REPLACE FUNCTION generate_health_summary(
  p_user_id UUID,
  p_period VARCHAR DEFAULT '30d'
)
RETURNS TABLE (
  period VARCHAR,
  blood_pressure_summary JSONB,
  glucose_summary JSONB,
  medication_adherence JSONB,
  alerts_count BIGINT,
  medications_current JSONB
) AS $$
DECLARE
  v_interval INTERVAL := CASE p_period
    WHEN '7d' THEN INTERVAL '7 days'
    WHEN '30d' THEN INTERVAL '30 days'
    WHEN '90d' THEN INTERVAL '90 days'
    ELSE INTERVAL '30 days'
  END;
BEGIN
  RETURN QUERY
  SELECT
    p_period AS period,
    (
      SELECT jsonb_build_object(
        'average', jsonb_build_object(
          'systolic', ROUND(AVG(systolic)::numeric, 1),
          'diastolic', ROUND(AVG(diastolic)::numeric, 1)
        ),
        'highest', jsonb_build_object(
          'systolic', MAX(systolic),
          'diastolic', MAX(diastolic)
        ),
        'lowest', jsonb_build_object(
          'systolic', MIN(systolic),
          'diastolic', MIN(diastolic)
        ),
        'readings', COUNT(*)
      )
      FROM vital_signs
      WHERE user_id = p_user_id
        AND type = 'blood_pressure'
        AND measured_at >= NOW() - v_interval
    ) AS blood_pressure_summary,
    (
      SELECT jsonb_build_object(
        'average', ROUND(AVG(CAST(value AS NUMERIC)), 1),
        'highest', MAX(CAST(value AS NUMERIC)),
        'lowest', MIN(CAST(value AS NUMERIC)),
        'readings', COUNT(*)
      )
      FROM vital_signs
      WHERE user_id = p_user_id
        AND type = 'glucose'
        AND measured_at >= NOW() - v_interval
    ) AS glucose_summary,
    (
      SELECT jsonb_build_object(
        'onTime', ROUND(
          (COUNT(*) FILTER (WHERE status = 'taken')::numeric / NULLIF(COUNT(*), 0)) * 100,
          1
        ),
        'missed', COUNT(*) FILTER (WHERE status = 'skipped'),
        'total', COUNT(*)
      )
      FROM medication_logs
      WHERE user_id = p_user_id
        AND scheduled_at >= NOW() - v_interval
    ) AS medication_adherence,
    (
      SELECT COUNT(*)
      FROM emergency_alerts
      WHERE user_id = p_user_id
        AND created_at >= NOW() - v_interval
    ) AS alerts_count,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'dosage', dosage,
        'frequency', frequency,
        'times', times
      ))
      FROM medications
      WHERE user_id = p_user_id AND is_active = TRUE
    ) AS medications_current;
END;
$$ LANGUAGE plpgsql;

-- Check for consultation suggestions based on health trends
CREATE OR REPLACE FUNCTION check_consultation_suggestions(p_user_id UUID)
RETURNS TABLE (
  should_suggest BOOLEAN,
  suggestion_type TEXT,
  priority VARCHAR(10),
  message TEXT,
  suggested_specialty TEXT
) AS $$
BEGIN
  -- Check for concerning blood pressure pattern (3+ high readings in 7 days)
  RETURN QUERY
  SELECT
    TRUE AS should_suggest,
    'consultation_recommended'::TEXT AS suggestion_type,
    CASE
      WHEN MAX(systolic) > 160 OR MAX(diastolic) > 100 THEN 'high'::VARCHAR(10)
      ELSE 'medium'::VARCHAR(10)
    END AS priority,
    'Elevated blood pressure readings detected. Consider scheduling a consultation.' AS message,
    'Cardiologist' AS suggested_specialty
  FROM vital_signs
  WHERE user_id = p_user_id
    AND type = 'blood_pressure'
    AND measured_at >= NOW() - INTERVAL '7 days'
    AND (systolic >= 140 OR diastolic >= 90)
  HAVING COUNT(*) >= 3
  LIMIT 1;

  -- Check for elevated glucose pattern
  RETURN QUERY
  SELECT
    TRUE AS should_suggest,
    'consultation_recommended'::TEXT AS suggestion_type,
    CASE
      WHEN AVG(CAST(value AS NUMERIC)) > 200 THEN 'high'::VARCHAR(10)
      ELSE 'medium'::VARCHAR(10)
    END AS priority,
    'Elevated blood glucose levels detected. Consider scheduling a consultation.' AS message,
    'Endocrinologist' AS suggested_specialty
  FROM vital_signs
  WHERE user_id = p_user_id
    AND type = 'glucose'
    AND measured_at >= NOW() - INTERVAL '7 days'
    AND CAST(value AS NUMERIC) > 150
  HAVING COUNT(*) >= 3
  LIMIT 1;

  -- Check for poor medication adherence
  RETURN QUERY
  SELECT
    TRUE AS should_suggest,
    'medication_review'::TEXT AS suggestion_type,
    'medium'::VARCHAR(10) AS priority,
    'Medication adherence below 70%. Consider a medication review.' AS message,
    'General Practitioner' AS suggested_specialty
  FROM medication_logs
  WHERE user_id = p_user_id
    AND scheduled_at >= NOW() - INTERVAL '30 days'
  HAVING
    (COUNT(*) FILTER (WHERE status = 'taken')::NUMERIC / NULLIF(COUNT(*), 0)) * 100 < 70
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create view for appointment with provider details
CREATE OR REPLACE VIEW appointment_details AS
SELECT
  a.id,
  a.user_id,
  a.provider_id,
  a.type,
  a.status,
  a.scheduled_at,
  a.duration,
  a.reason,
  a.notes,
  a.video_call_link,
  a.reminder_sent,
  a.calendar_event_id,
  a.created_at,
  a.updated_at,
  hp.name AS provider_name,
  hp.specialty AS provider_specialty,
  hp.clinic_name AS provider_clinic_name,
  hp.phone AS provider_phone,
  hp.email AS provider_email,
  u.name AS user_name,
  u.email AS user_email,
  u.phone AS user_phone
FROM appointments a
JOIN healthcare_providers hp ON a.provider_id = hp.id
JOIN users u ON a.user_id = u.id;
