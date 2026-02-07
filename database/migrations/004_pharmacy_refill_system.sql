-- SPEC-006: Pharmacy Refill Module Database Schema
-- Extends pharmacy functionality with comprehensive order management,
-- medication inventory tracking, auto-refill, and payment integration

-- ============================================================================
-- PHARMACY PARTNERS EXTENSION
-- ============================================================================
-- Add columns to existing pharmacies table for enhanced integration
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS integration_type TEXT DEFAULT 'direct_api', -- direct_api, manual_fax, email
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_order DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_delivery_min INTEGER, -- hours
  ADD COLUMN IF NOT EXISTS estimated_delivery_max INTEGER, -- hours
  ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}';

-- ============================================================================
-- MEDICATION INVENTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS medication_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  current_supply INTEGER NOT NULL DEFAULT 0, -- days remaining
  last_refill_date TIMESTAMPTZ,
  next_refill_date TIMESTAMPTZ,
  refill_reminder_sent BOOLEAN DEFAULT FALSE,
  auto_refill_enabled BOOLEAN DEFAULT FALSE,
  preferred_pharmacy_id UUID REFERENCES pharmacies(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, medication_id)
);

-- Supply alerts table
CREATE TABLE IF NOT EXISTS supply_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  days_remaining INTEGER NOT NULL,
  urgency TEXT NOT NULL, -- critical, warning, info
  suggested_refill_date TIMESTAMPTZ,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-refill settings
CREATE TABLE IF NOT EXISTS auto_refill_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT FALSE,
  trigger_days INTEGER DEFAULT 7, -- Refill when X days remaining
  preferred_pharmacy_id UUID REFERENCES pharmacies(id),
  payment_method_id UUID,
  confirmation_required BOOLEAN DEFAULT TRUE,
  last_auto_fill_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, medication_id)
);

-- ============================================================================
-- PHARMACY ORDERS (Enhanced)
-- ============================================================================
-- Recreate prescription_refills with enhanced fields
DROP TABLE IF EXISTS prescription_refills CASCADE;

CREATE TABLE prescription_refills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  pharmacy_id UUID REFERENCES pharmacies(id),
  status TEXT DEFAULT 'pending', -- pending, confirmed, preparing, ready, shipped, delivered, cancelled
  order_id TEXT, -- External pharmacy order ID

  -- Delivery information
  delivery_type TEXT DEFAULT 'pickup', -- delivery, pickup
  delivery_address TEXT,
  delivery_latitude FLOAT,
  delivery_longitude FLOAT,
  scheduled_for TIMESTAMPTZ,

  -- Items (can support multiple medications)
  items JSONB DEFAULT '[]', -- Array of {medicationId, name, dosage, quantity, rxNumber, requiresPrescription, price}

  -- Payment information
  payment_method TEXT, -- cash, card, insurance
  payment_amount DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, refunded
  payment_transaction_id TEXT,

  -- Insurance details
  insurance_provider TEXT,
  insurance_member_id TEXT,
  insurance_claim_id TEXT,
  insurance_copay DECIMAL(10,2),

  -- Tracking
  estimated_delivery TIMESTAMPTZ,
  tracking_url TEXT,
  tracking_number TEXT,
  driver_location JSONB, -- {latitude, longitude, updated_at}

  -- Timestamps
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Prescriptions
  prescription_urls TEXT[], -- Array of prescription image URLs

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ORDER STATUS HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacy_order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES prescription_refills(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PAYMENT METHODS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- cash, credit_card, debit_card, insurance
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Card details (tokenized)
  card_last4 TEXT,
  card_brand TEXT, -- visa, mastercard, amex
  card_expiry_month INTEGER,
  card_expiry_year INTEGER,
  card_token TEXT, -- Payment processor token

  -- Insurance details
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  insurance_member_id TEXT,
  insurance_group_number TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PHARMACY API LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacy_api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID REFERENCES pharmacies(id),
  order_id UUID REFERENCES prescription_refills(id),
  endpoint TEXT,
  request_method TEXT,
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WEBHOOK EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS pharmacy_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID REFERENCES pharmacies(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_medication_inventory_user ON medication_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_inventory_medication ON medication_inventory(medication_id);
CREATE INDEX IF NOT EXISTS idx_supply_alerts_user_urgency ON supply_alerts(user_id, urgency, acknowledged);
CREATE INDEX IF NOT EXISTS idx_auto_refill_settings_user ON auto_refill_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_prescription_refills_user_status ON prescription_refills(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_refills_pharmacy_status ON prescription_refills(pharmacy_id, status);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON pharmacy_order_status_history(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pharmacy_api_logs_order ON pharmacy_api_logs(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_pharmacy_processed ON pharmacy_webhook_events(pharmacy_id, processed, created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Check and create supply alerts
CREATE OR REPLACE FUNCTION check_supply_alerts()
RETURNS TABLE (
  user_id UUID,
  medication_id UUID,
  medication_name TEXT,
  days_remaining INTEGER,
  urgency TEXT
) AS $$
DECLARE
  inventory_record RECORD;
  alert_exists BOOLEAN;
BEGIN
  FOR inventory_record IN
    SELECT mi.user_id, mi.medication_id, m.name, mi.current_supply
    FROM medication_inventory mi
    JOIN medications m ON mi.medication_id = m.id
    WHERE mi.current_supply <= 14
  LOOP
    -- Check if unacknowledged alert already exists
    SELECT EXISTS(
      SELECT 1 FROM supply_alerts
      WHERE medication_id = inventory_record.medication_id
        AND acknowledged = FALSE
      LIMIT 1
    ) INTO alert_exists;

    IF NOT alert_exists THEN
      INSERT INTO supply_alerts (
        user_id, medication_id, medication_name, days_remaining, urgency, suggested_refill_date
      ) VALUES (
        inventory_record.user_id,
        inventory_record.medication_id,
        inventory_record.name,
        inventory_record.current_supply,
        CASE
          WHEN inventory_record.current_supply <= 3 THEN 'critical'
          WHEN inventory_record.current_supply <= 7 THEN 'warning'
          ELSE 'info'
        END,
        NOW() + INTERVAL '1 day'
      );

      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Get order summary with all related data
CREATE OR REPLACE FUNCTION get_pharmacy_order_details(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  status TEXT,
  items JSONB,
  pharmacy_name TEXT,
  pharmacy_address TEXT,
  pharmacy_phone TEXT,
  delivery_type TEXT,
  delivery_address TEXT,
  estimated_delivery TIMESTAMPTZ,
  tracking_number TEXT,
  payment_amount DECIMAL,
  payment_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.user_id,
    pr.status,
    pr.items,
    p.name AS pharmacy_name,
    p.address AS pharmacy_address,
    p.phone AS pharmacy_phone,
    pr.delivery_type,
    pr.delivery_address,
    pr.estimated_delivery,
    pr.tracking_number,
    pr.payment_amount,
    pr.payment_status,
    pr.created_at
  FROM prescription_refills pr
  LEFT JOIN pharmacies p ON pr.pharmacy_id = p.id
  WHERE pr.id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- Process auto-refill orders
CREATE OR REPLACE FUNCTION process_auto_refills()
RETURNS TABLE (
  order_id UUID,
  user_id UUID,
  medication_id UUID
) AS $$
DECLARE
  autofill_record RECORD;
  new_order_id UUID;
BEGIN
  FOR autofill_record IN
    SELECT
      ars.user_id,
      ars.medication_id,
      ars.preferred_pharmacy_id,
      ars.payment_method_id,
      ars.trigger_days,
      mi.current_supply
    FROM auto_refill_settings ars
    JOIN medication_inventory mi ON ars.medication_id = mi.medication_id AND ars.user_id = mi.user_id
    WHERE ars.enabled = TRUE
      AND mi.current_supply <= ars.trigger_days
      AND (ars.last_auto_fill_date IS NULL OR ars.last_auto_fill_date < NOW() - INTERVAL '7 days')
  LOOP
    -- Create refill order
    INSERT INTO prescription_refills (
      user_id, medication_id, pharmacy_id, status,
      payment_method, auto_fill_enabled, trigger_threshold
    ) VALUES (
      autofill_record.user_id,
      autofill_record.medication_id,
      autofill_record.preferred_pharmacy_id,
      'pending',
      COALESCE(
        (SELECT type FROM payment_methods WHERE id = autofill_record.payment_method_id),
        'cash'
      ),
      TRUE,
      autofill_record.trigger_days
    ) RETURNING id INTO new_order_id;

    -- Update last auto-fill date
    UPDATE auto_refill_settings
    SET last_auto_fill_date = NOW()
    WHERE user_id = autofill_record.user_id
      AND medication_id = autofill_record.medication_id;

    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on new tables
CREATE TRIGGER update_medication_inventory_updated_at BEFORE UPDATE ON medication_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auto_refill_settings_updated_at BEFORE UPDATE ON auto_refill_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescription_refills_updated_at BEFORE UPDATE ON prescription_refills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA - Pharmacy Partners
-- ============================================================================
INSERT INTO pharmacies (
  name, address, latitude, longitude, phone, email,
  delivery_available, delivery_radius_km, delivery_fee,
  integration_type, estimated_delivery_min, estimated_delivery_max,
  operating_hours
) VALUES
  (
    'Farmacia del Ahorro',
    'Av. Reforma #222, Cuauhtémoc, CDMX',
    19.4326, -99.1332,
    '55-1234-5678',
    'contacto@farmaciadelahorro.com',
    TRUE, 15, 45.00,
    'direct_api', 2, 4,
    '{"monday": {"open": "08:00", "close": "22:00"}, "tuesday": {"open": "08:00", "close": "22:00"}, "wednesday": {"open": "08:00", "close": "22:00"}, "thursday": {"open": "08:00", "close": "22:00"}, "friday": {"open": "08:00", "close": "22:00"}, "saturday": {"open": "09:00", "close": "21:00"}, "sunday": {"open": "09:00", "close": "20:00"}}'::jsonb
  ),
  (
    'Farmacias Benavides',
    'Av. Insurgentes #888, CDMX',
    19.4250, -99.1450,
    '55-2345-6789',
    'servicio@benavides.com.mx',
    TRUE, 20, 35.00,
    'direct_api', 3, 5,
    '{"monday": {"open": "07:00", "close": "23:00"}, "tuesday": {"open": "07:00", "close": "23:00"}, "wednesday": {"open": "07:00", "close": "23:00"}, "thursday": {"open": "07:00", "close": "23:00"}, "friday": {"open": "07:00", "close": "23:00"}, "saturday": {"open": "08:00", "close": "22:00"}, "sunday": {"open": "08:00", "close": "21:00"}}'::jsonb
  ),
  (
    'Farmacia Guadalajara',
    'Av. Universidad #100, CDMX',
    19.4380, -99.1450,
    '55-3456-7890',
    'ventas@farmaciasguadalajara.com.mx',
    TRUE, 10, 0.00,
    'direct_api', 1, 2,
    '{"monday": {"open": "08:00", "close": "21:00"}, "tuesday": {"open": "08:00", "close": "21:00"}, "wednesday": {"open": "08:00", "close": "21:00"}, "thursday": {"open": "08:00", "close": "21:00"}, "friday": {"open": "08:00", "close": "21:00"}, "saturday": {"open": "09:00", "close": "20:00"}, "sunday": {"open": "10:00", "close": "19:00"}}'::jsonb
  ),
  (
    'Farmacia San Pablo',
    'Calle 5 de Mayo #50, CDMX',
    19.4330, -99.1400,
    '55-4567-8901',
    'contacto@sanpablo.com.mx',
    TRUE, 5, 40.00,
    'manual_fax', 4, 6,
    '{"monday": {"open": "09:00", "close": "20:00"}, "tuesday": {"open": "09:00", "close": "20:00"}, "wednesday": {"open": "09:00", "close": "20:00"}, "thursday": {"open": "09:00", "close": "20:00"}, "friday": {"open": "09:00", "close": "20:00"}, "saturday": {"open": "10:00", "close": "18:00"}, "sunday": {"open": "closed", "close": "closed"}}'::jsonb
  ),
  (
    'Farmacias Similares',
    'Av. Guerrero #200, CDMX',
    19.4400, -99.1500,
    '55-5678-9012',
    'info@similares.com.mx',
    FALSE, NULL, 0.00,
    'manual', 0, 0,
    '{"monday": {"open": "08:00", "close": "22:00"}, "tuesday": {"open": "08:00", "close": "22:00"}, "wednesday": {"open": "08:00", "close": "22:00"}, "thursday": {"open": "08:00", "close": "22:00"}, "friday": {"open": "08:00", "close": "22:00"}, "saturday": {"open": "09:00", "close": "21:00"}, "sunday": {"open": "09:00", "close": "20:00"}}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE medication_inventory IS 'Tracks medication supply levels and refill settings';
COMMENT ON TABLE supply_alerts IS 'Alerts for low medication supply';
COMMENT ON TABLE auto_refill_settings IS 'Configuration for automatic medication refills';
COMMENT ON TABLE payment_methods IS 'User payment methods for pharmacy orders';
COMMENT ON TABLE pharmacy_api_logs IS 'Audit log for pharmacy API communications';
COMMENT ON TABLE pharmacy_webhook_events IS 'Incoming webhook events from pharmacy partners';
COMMENT ON TABLE pharmacy_order_status_history IS 'History of order status changes';
