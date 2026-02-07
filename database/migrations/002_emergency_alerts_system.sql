-- Emergency Alerts System Enhancements (SPEC-003)
-- This migration adds the new fields and tables required for the emergency alerts system
-- Version: 1.1.0

-- Add new columns to emergency_alerts table
ALTER TABLE emergency_alerts
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'warning',
  ADD COLUMN IF NOT EXISTS medication_id UUID REFERENCES medications(id),
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS was_false_alarm BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bypass_escalation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update the type constraint to include new alert types
ALTER TABLE emergency_alerts
  DROP CONSTRAINT IF EXISTS emergency_alerts_type_check;

ALTER TABLE emergency_alerts
  ADD CONSTRAINT emergency_alerts_type_check
  CHECK (type IN ('critical_bp', 'critical_glucose', 'medication_missed', 'no_response', 'manual_trigger', 'irregular_pattern'));

-- Update the status constraint
ALTER TABLE emergency_alerts
  DROP CONSTRAINT IF EXISTS emergency_alerts_status_check;

ALTER TABLE emergency_alerts
  ADD CONSTRAINT emergency_alerts_status_check
  CHECK (status IN ('active', 'acknowledged', 'escalated', 'resolved', 'false_alarm'));

-- Update the severity constraint
ALTER TABLE emergency_alerts
  ADD CONSTRAINT emergency_alerts_severity_check
  CHECK (severity IN ('critical', 'high', 'warning'));

-- Add indexes for escalation queries
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_escalation
  ON emergency_alerts(escalation_level, escalated_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_user_escalation
  ON emergency_alerts(user_id, escalation_level, status);

-- Add index for medication alerts
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_medication
  ON emergency_alerts(medication_id)
  WHERE medication_id IS NOT NULL;

-- Update emergency_notifications table with new columns
ALTER TABLE emergency_notifications
  ADD COLUMN IF NOT EXISTS recipient_contact_id UUID,
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'push',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add channel constraint
ALTER TABLE emergency_notifications
  ADD CONSTRAINT emergency_notifications_channel_check
  CHECK (channel IN ('push', 'sms', 'email', 'call'));

-- Add index for notification status tracking
CREATE INDEX IF NOT EXISTS idx_emergency_notifications_status
  ON emergency_notifications(status, created_at);

-- Create user_alert_thresholds table
CREATE TABLE IF NOT EXISTS user_alert_thresholds (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bp_critical_high_sys INTEGER DEFAULT 180,
  bp_critical_high_dia INTEGER DEFAULT 120,
  bp_warning_high_sys INTEGER DEFAULT 140,
  bp_warning_high_dia INTEGER DEFAULT 90,
  bp_critical_low_sys INTEGER DEFAULT 90,
  bp_critical_low_dia INTEGER DEFAULT 60,
  glucose_critical_low INTEGER DEFAULT 70,
  glucose_warning_low INTEGER DEFAULT 80,
  glucose_critical_high INTEGER DEFAULT 400,
  glucose_warning_high_fasting INTEGER DEFAULT 125,
  glucose_warning_high_post_meal INTEGER DEFAULT 180,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at trigger for user_alert_thresholds
CREATE TRIGGER update_user_alert_thresholds_updated_at
  BEFORE UPDATE ON user_alert_thresholds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create updated_at trigger for emergency_alerts
CREATE TRIGGER update_emergency_alerts_updated_at
  BEFORE UPDATE ON emergency_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to check for irregular patterns (3 consecutive high readings)
CREATE OR REPLACE FUNCTION check_irregular_bp_patterns(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  high_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO high_count
  FROM (
    SELECT measured_at, systolic, diastolic
    FROM vital_signs
    WHERE user_id = p_user_id
      AND type = 'blood_pressure'
      AND measured_at > NOW() - INTERVAL '7 days'
      AND (systolic >= 140 OR diastolic >= 90)
    ORDER BY measured_at DESC
    LIMIT 3
  ) sub;

  RETURN high_count >= 3;
END;
$$ LANGUAGE plpgsql;

-- Create function to escalate alerts
CREATE OR REPLACE FUNCTION escalate_alert_if_needed()
RETURNS TABLE (
  alert_id UUID,
  user_id UUID,
  old_level INTEGER,
  new_level INTEGER
) AS $$
BEGIN
  -- Escalate from level 0 to 1 (5 minutes)
  RETURN QUERY
  UPDATE emergency_alerts
  SET escalation_level = 1,
      escalated_at = NOW(),
      status = 'escalated',
      updated_at = NOW()
  WHERE escalation_level = 0
    AND status = 'active'
    AND created_at < NOW() - INTERVAL '5 minutes'
    AND bypass_escalation = FALSE
  RETURNING
    id,
    user_id,
    0,
    1;

  -- Escalate from level 1 to 2 (10 minutes total)
  RETURN QUERY
  UPDATE emergency_alerts
  SET escalation_level = 2,
      escalated_at = NOW(),
      status = 'escalated',
      updated_at = NOW()
  WHERE escalation_level = 1
    AND status IN ('active', 'escalated')
    AND escalated_at < NOW() - INTERVAL '5 minutes'
    AND bypass_escalation = FALSE
  RETURNING
    id,
    user_id,
    1,
    2;
END;
$$ LANGUAGE plpgsql;
