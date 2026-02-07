# Deployment Guide - SaludAlDía

Complete deployment guide for SaludAlDía chronic health management app.

---

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐  │
│  │  Frontend   │      │   Backend   │      │  Supabase   │  │
│  │ (React Nat) │ ───> │  (Node.js)  │ ───> │ (PostgreSQL)│  │
│  │   EAS/Expo  │      │   Railway   │      │    Cloud    │  │
│  └─────────────┘      └─────────────┘      └─────────────┘  │
│                                                              │
│  External Services:                                          │
│  - Firebase (Push Notifications)                            │
│  - Agora/Twilio (Video Calls)                               │
│  - Twilio (SMS)                                             │
│  - Pharmacy APIs                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Setup (Supabase)

### Step 1.1: Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Configure:
   - **Name**: `saluddalia-db`
   - **Database Password**: [Generate strong password - SAVE IT!]
   - **Region**: Choose closest to your users
   - **Pricing**: Free tier to start

### Step 1.2: Get Connection Details

From your Supabase dashboard:

```
Settings → API → Project URL
→ Project URL: https://xxxxx.supabase.co
→ anon/public key: eyJhbGc...

Settings → Database → Connection String
→ URI: postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

### Step 1.3: Run Migrations

```bash
# From project root
cd /root/mijavibes/mijavibes

# Install backend dependencies first
cd apps/backend && npm install

# Run migrations
npm run migrate
```

Or run manually in Supabase SQL Editor:

```sql
-- Copy contents of:
-- database/migrations/001_initial_schema.sql
-- database/migrations/002_emergency_alerts_system.sql
-- database/migrations/003_telemedicine_integration.sql
-- database/migrations/004_pharmacy_refill_system.sql
```

### Step 1.4: Configure Row Level Security (RLS)

In Supabase SQL Editor:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own medications" ON medications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own vital_signs" ON vital_signs
  FOR SELECT USING (user_id = auth.uid());
```

---

## Phase 2: Backend Deployment (Railway)

### Step 2.1: Install Railway CLI

```bash
npm install -g @railway/cli
```

### Step 2.2: Login to Railway

```bash
railway login
```

### Step 2.3: Initialize Project

```bash
cd /root/mijavibes/mijavibes/apps/backend
railway init
```

### Step 2.4: Configure Environment Variables

```bash
railway variables set PORT=3000
railway variables set NODE_ENV=production

# Supabase
railway variables set SUPABASE_URL=https://xxxxx.supabase.co
railway variables set SUPABASE_ANON_KEY=eyJhbGc...
railway variables set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # From Supabase Settings → API

# JWT
railway variables set JWT_SECRET=your-super-secret-jwt-key
railway variables set JWT_EXPIRES_IN=7d

# Emergency (Escalation)
railway variables set ESCALATION_API_KEY=random-api-key

# Twilio (for SMS)
railway variables set TWILIO_ACCOUNT_SID=ACxxxxx
railway variables set TWILIO_AUTH_TOKEN=xxxxx
railway variables set TWILIO_PHONE_NUMBER=+1234567890

# Firebase (for Push)
railway variables set FIREBASE_PROJECT_ID=xxxxx
railway variables set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
railway variables set FIREBASE_CLIENT_EMAIL=xxxxx

# Agora (for Video)
railway variables set AGORA_APP_ID=xxxxx
railway variables set AGORA_APP_CERT=xxxxx
```

### Step 2.5: Deploy

```bash
railway up
railway domain
```

Save the deployed URL: `https://saluddalia-backend.up.railway.app`

---

## Phase 3: Frontend Setup (React Native with Expo)

### Step 3.1: Install Dependencies

```bash
cd /root/mijavibes/mijavibes/apps/frontend
npm install
```

### Step 3.2: Configure Environment Variables

Create `apps/frontend/.env`:

```bash
# API
EXPO_PUBLIC_API_URL=https://saluddalia-backend.up.railway.app

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Agora
EXPO_PUBLIC_AGORA_APP_ID=xxxxx

# Sentry (Error tracking)
EXPO_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### Step 3.3: Configure app.json

Create `apps/frontend/app.json`:

```json
{
  "expo": {
    "name": "SaludAlDía",
    "slug": "saluddalia",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0066CC"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.softvibes.saluddalia",
      "permissions": [
        "LOCATION_WHEN_IN_USE",
        "BLUETOOTH_PERIPHERAL",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "android": {
      "package": "com.softvibes.saluddalia",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "BLUETOOTH",
        "BLUETOOTH_ADMIN",
        "BLUETOOTH_SCAN",
        "BLUETOOTH_CONNECT",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-ble",
      "expo-location"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

---

## Phase 4: Build Mobile Apps (EAS Build)

### Step 4.1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 4.2: Login to Expo

```bash
cd /root/mijavibes/mijavibes/apps/frontend
eas login
```

### Step 4.3: Configure EAS

Create `apps/frontend/eas.json`:

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

### Step 4.4: Build Android APK

```bash
eas build --platform android --profile production
```

### Step 4.5: Build iOS IPA

```bash
eas build --platform ios --profile production
```

---

## Phase 5: External Services Setup

### 5.1 Firebase (Push Notifications)

1. Go to https://console.firebase.google.com
2. Create project: `saluddalia-app`
3. Add Android app:
   - Package: `com.softvibes.saluddalia`
   - Download `google-services.json`
4. Add iOS app:
   - Bundle ID: `com.softvibes.saluddalia`
   - Download `GoogleService-Info.plist`
5. Generate Private Key for Service Account

### 5.2 Twilio (SMS Notifications)

1. Go to https://www.twilio.com/console
2. Get Account SID and Auth Token
3. Buy a phone number
4. Configure in Railway environment variables

### 5.3 Agora (Video Calls)

1. Go to https://console.agora.io
2. Create project: `saluddalia-video`
3. Get App ID and Certificate
4. Configure in environment variables

---

## Phase 6: Cron Job for Escalation

### Option A: Railway Cron

```bash
railway add cron
```

Configure to run every minute calling:
```
https://saluddalia-backend.up.railway.app/api/emergency/_internal/escalate
```

### Option B: External Cron (cron-job.org)

1. Go to https://cron-job.org
2. Add job:
   - URL: `https://saluddalia-backend.up.railway.app/api/emergency/_internal/escalate`
   - Execution: Every minute
   - Header: `X-escalation-api-key: your-api-key`

---

## Deployment Checklist

| Phase | Task | Status |
|-------|------|--------|
| **Database** | Create Supabase project | ⬜ |
| **Database** | Run migrations | ⬜ |
| **Database** | Configure RLS policies | ⬜ |
| **Backend** | Create Railway project | ⬜ |
| **Backend** | Set environment variables | ⬜ |
| **Backend** | Deploy backend | ⬜ |
| **Frontend** | Create Expo app | ⬜ |
| **Frontend** | Set environment variables | ⬜ |
| **Frontend** | Configure permissions | ⬜ |
| **Frontend** | Build Android APK | ⬜ |
| **Frontend** | Build iOS IPA | ⬜ |
| **Services** | Configure Firebase | ⬜ |
| **Services** | Configure Twilio | ⬜ |
| **Services** | Configure Agora | ⬜ |
| **Services** | Setup escalation cron | ⬜ |

---

## Quick Start (Local Testing)

```bash
# Terminal 1 - Backend
cd apps/backend
npm install
cp .env.example .env  # Edit with your values
npm run migrate
npm run dev

# Terminal 2 - Frontend
cd apps/frontend
npm install
cp .env.example .env  # Edit with your values
npx expo start
```

---

## URLs After Deployment

| Service | URL |
|---------|-----|
| Backend API | `https://saluddalia-backend.up.railway.app` |
| Supabase Dashboard | `https://supabase.com/dashboard/project/xxxxx` |
| Firebase Console | `https://console.firebase.google.com/project/saluddalia-app` |
| Railway Dashboard | `https://railway.app/project/xxxxx` |
| Expo Dashboard | `https://expo.dev` |

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
railway logs

# Redeploy
railway up --force
```

### Frontend build fails
```bash
# Clear cache
rm -rf node_modules
npm install
eas build --clean
```

### Migration errors
```bash
# Check Supabase logs
# Run migrations manually in SQL Editor
```

---

For more help, check:
- Railway Docs: https://docs.railway.app
- Supabase Docs: https://supabase.com/docs
- Expo EAS Docs: https://docs.expo.dev/eas
