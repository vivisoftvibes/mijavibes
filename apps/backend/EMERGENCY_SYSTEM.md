# Emergency Alerts System - Implementation Summary (SPEC-003)

## Overview

The Emergency Alerts System is a complete implementation of SPEC-003 with the following features:

### Implemented Features

| Feature ID | Description | Status |
|------------|-------------|--------|
| EA-001 | Alert triggering for critical BP and glucose | Complete |
| EA-002 | Multi-channel notifications (Push, SMS, Email) | Complete (stubbed) |
| EA-003 | Escalation rules (5min -> secondary, 10min -> emergency) | Complete |
| EA-004 | Location sharing for emergencies | Complete |
| EA-005 | Alert acknowledgment stops escalation | Complete |
| EA-006 | Manual SOS bypasses escalation | Complete |

## Backend Implementation

### Files Modified/Created

1. **apps/backend/src/services/EmergencyService.ts** (Complete rewrite)
   - Alert types: `critical_bp`, `critical_glucose`, `medication_missed`, `no_response`, `manual_trigger`, `irregular_pattern`
   - Notification channels: `push`, `sms`, `email`, `call`
   - Escalation levels: 0 (primary), 1 (secondary, 5min), 2 (emergency services, 10min)
   - Methods for alert creation, acknowledgment, resolution
   - Escalation job implementation
   - User-configurable thresholds

2. **apps/backend/src/routes/emergency.ts** (Updated)
   - `POST /api/emergency/alerts` - Create alert
   - `POST /api/emergency/sos` - Trigger SOS (bypasses escalation)
   - `GET /api/emergency/alerts` - Get alerts (with status filter)
   - `GET /api/emergency/alerts/active` - Get active alerts
   - `GET /api/emergency/alerts/:alertId` - Get alert with notifications
   - `POST /api/emergency/alerts/:alertId/acknowledge` - Acknowledge (stops escalation)
   - `POST /api/emergency/alerts/:alertId/resolve` - Resolve alert
   - `GET /api/emergency/contacts` - Get emergency contacts
   - `GET /api/emergency/thresholds` - Get user thresholds
   - `PUT /api/emergency/thresholds` - Update user thresholds
   - `POST /api/emergency/_internal/escalate` - Cron job endpoint

3. **apps/backend/src/services/VitalSignsService.ts** (Updated)
   - Automatic alert triggering on critical BP readings (>180/120 or <90/60)
   - Automatic alert triggering on critical glucose (<70 or >400 mg/dL)
   - Irregular pattern detection (3 consecutive high readings)

4. **apps/backend/src/utils/emergencyCron.ts** (New)
   - Escalation check runner
   - Cron job configuration examples

### Database Schema Requirements

The following tables are required (add to migrations):

```sql
-- Emergency alerts table
CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  vital_sign_id UUID REFERENCES vital_signs(id),
  medication_id UUID REFERENCES medications(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  location_lat FLOAT,
  location_lng FLOAT,
  location_address TEXT,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  notes TEXT,
  was_false_alarm BOOLEAN DEFAULT FALSE,
  bypass_escalation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency notifications table
CREATE TABLE emergency_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES emergency_alerts(id),
  recipient_contact_id UUID,
  recipient_type VARCHAR(50) NOT NULL,
  recipient_contact VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User alert thresholds table
CREATE TABLE user_alert_thresholds (
  user_id UUID PRIMARY KEY REFERENCES users(id),
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
  glucose_warning_high_post_meal INTEGER DEFAULT 180
);

-- Indexes for performance
CREATE INDEX idx_emergency_alerts_user_status ON emergency_alerts(user_id, status);
CREATE INDEX idx_emergency_alerts_escalation ON emergency_alerts(escalation_level, escalated_at);
CREATE INDEX idx_emergency_notifications_alert ON emergency_notifications(alert_id);
```

## Frontend Implementation

### Files Modified/Created

1. **apps/frontend/src/screens/EmergencyScreen.tsx** (Complete rewrite)
   - Large SOS button (200x200 circular)
   - Active alert display with escalation timer
   - Alert acknowledgment/resolution actions
   - Location services integration
   - Emergency contacts list with quick call
   - Quick 911 call button

2. **apps/frontend/src/services/api.ts** (Updated)
   - `emergencyService.createAlert()` - Create alert
   - `emergencyService.triggerSOS()` - Quick SOS endpoint
   - `emergencyService.getActiveAlerts()` - Get active alerts
   - `emergencyService.acknowledgeAlert()` - Acknowledge
   - `emergencyService.resolveAlert()` - Resolve
   - `emergencyService.getContacts()` - Get contacts
   - `emergencyService.getThresholds()` - Get thresholds
   - `emergencyService.updateThresholds()` - Update thresholds

3. **apps/frontend/src/types/index.ts** (Updated)
   - `EmergencyAlert` interface with all new fields
   - `EmergencyContact` interface
   - `EmergencyNotification` interface
   - `AlertThresholds` interface
   - New alert types: `medication_missed`, `manual_trigger`, `irregular_pattern`

## Production Configuration

### Environment Variables

Add these to your environment:

```bash
# Escalation API Key (protect internal endpoints)
ESCALATION_API_KEY=your-random-api-key-here

# Twilio (for SMS and voice calls)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Firebase Cloud Messaging (for push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# SendGrid (for email notifications)
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=alerts@salud-aldia.com

# Emergency Services Integration (optional)
RAPIDSOS_API_KEY=your-rapidsos-key  # For 911 integration
```

### Notification Service Integration

The notification methods are currently stubbed with logging. To enable actual notifications:

1. **SMS (Twilio)**: Replace `sendSMSNotification()` with actual Twilio API calls
2. **Push (FCM)**: Replace `sendPushNotification()` with Firebase Admin SDK calls
3. **Email**: Replace `sendEmailNotification()` with SendGrid/AWS SES calls
4. **Voice**: Replace `sendPhoneCall()` with Twilio Programmable Voice calls

### Cron Job Setup

Set up the escalation cron job to run every minute:

**Option 1: Simple cron**
```bash
crontab -e
# Add:
* * * * * cd /path/to/app && npm run escalation:check >> /var/log/escalation.log 2>&1
```

**Option 2: PM2 cron**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'escalation-check',
    script: './dist/utils/emergencyCron.js',
    cron_restart: '* * * * *',
  }]
};
```

**Option 3: Kubernetes CronJob**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: escalation-check
spec:
  schedule: "* * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: escalation
            image: salud-aldia:latest
            command: ["node", "dist/utils/emergencyCron.js"]
```

## Testing

### Manual Testing

1. **Trigger Critical BP Alert**
   - Record BP: 185/125 (should trigger alert)
   - Verify alert created in database
   - Verify notifications sent (check logs)

2. **Trigger SOS**
   - Open Emergency screen
   - Press SOS button
   - Verify alert created with bypass_escalation=true

3. **Test Escalation**
   - Create an alert
   - Wait 5 minutes (or manually call escalation endpoint)
   - Verify escalation level increased to 1
   - Wait another 5 minutes
   - Verify escalation level increased to 2

4. **Test Acknowledgment**
   - Create an alert
   - Acknowledge via app
   - Verify escalation stopped

## Security Considerations

1. **HIPAA Compliance**: All emergency events are logged for audit trail
2. **Authentication**: All endpoints require valid JWT token
3. **Rate Limiting**: Consider adding rate limiting for alert creation
4. **API Key Protection**: Internal escalation endpoints use API key
5. **Data Minimization**: Only share necessary location data with contacts

## Monitoring

Monitor these metrics:

- Alert creation rate (alerts per hour/day)
- Average time to acknowledgment
- Escalation rate (percentage of alerts that escalate)
- Notification delivery success rate
- False alarm rate

## Future Enhancements

1. **Video verification**: Allow user to record video during emergency
2. **Medical profile sharing**: Include conditions, medications, allergies
3. **Hospital finder**: Direct to nearest ER based on location
4. **Caregiver app**: Separate app for caregivers to receive alerts
5. **Wearable integration**: Fall detection, heart rate alerts
