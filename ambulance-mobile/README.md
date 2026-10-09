# ERCS — Ambulance Crew Mobile Application

Production-oriented ambulance crew mobile application built with **Expo**, **React Native**, and **TypeScript**, connecting directly to the **ERCS FastAPI + PostgreSQL backend**.

Designed with a clean healthcare aesthetic: **White + Medical Blue (`#2563EB`) + Subtle Green (`#16A34A`)**.

---

## 📱 Features

- **Crew Authentication & Unit Onboarding**:
  - Paramedic crew login with password visibility toggle.
  - Crew & vehicle registration (`POST /api/v1/auth/register-crew`).
  - Secure JWT bearer token management using **Expo SecureStore**.
- **Home Operational Station**:
  - Live unit call sign and paramedic credentials.
  - Operational availability toggle (`AVAILABLE`, `OFF_DUTY`, `BUSY`).
  - Prominent **"START EMERGENCY"** primary action.
  - Active incident card with direct mission routing.
- **Multi-Step Emergency Creation**:
  - Step 1: Incident severity (`CRITICAL`, `URGENT`, `STANDARD`) and scene description.
  - Step 2: Patient demographics (age, gender, chief complaint, observed symptoms).
  - Step 3: Required clinical capabilities (Trauma Center, Cardiac Cath Lab, ICU).
  - Step 4: Device GPS location capture via **Expo Location** with manual coordinate fallback.
- **Voice AI & Clinical Assessment**:
  - Audio voice description recording via **Expo AV**.
  - Direct speech-to-text transcription via backend **ElevenLabs**.
  - Structured clinical entity extraction via backend **Groq LLM**.
  - Paramedic crew verification and locking of clinical observations.
  - Protocol-constrained emergency safety precautions.
- **Hospital Matching & Live Dispatch**:
  - Candidate hospital matching dispatch.
  - Real-time updates via **Socket.IO** (`hospital.assigned`, `emergency.status.updated`).
  - Confirmed hospital destination display with address and contact phone.
  - External **Google Maps** turn-by-turn navigation.
- **Mission Lifecycle & Patient Handover**:
  - Authorized state transitions (`DISPATCHED` -> `EN_ROUTE_SCENE` -> `ON_SCENE` -> `EN_ROUTE_HOSPITAL` -> `AT_HOSPITAL`).
  - Automated Groq AI handover summary drafting.
  - Final patient transfer confirmation at hospital ER (`POST /handover/confirm`).
- **Shift History & Audit Log**:
  - Completed emergency records and verified handover notes.

---

## 🛠️ Tech Stack & Dependencies

- **Framework**: Expo SDK 57 (React Native 0.86, React 19)
- **Language**: TypeScript (Strict mode enabled)
- **Navigation**: Expo Router (File-based routing)
- **Icons**: Lucide React Native (`lucide-react-native`)
- **Security**: Expo SecureStore (`expo-secure-store`)
- **Audio & Media**: Expo AV (`expo-av`), Expo Image Picker (`expo-image-picker`)
- **Geolocation**: Expo Location (`expo-location`)
- **Mapping**: Cross-platform tactical Leaflet map via `react-native-webview`
- **Real-Time**: Socket.IO client (`socket.io-client`)
- **Testing**: Jest & ts-jest

---

## 🚀 Running the Application

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **FastAPI Backend**: Running at `http://localhost:8000`

### 2. Environment Configuration
Create `.env` inside `ambulance-mobile/` (or copy from `.env.example`):
```bash
cp .env.example .env
```
Set the API base URL depending on your target device:
```env
# For Web or iOS Simulator:
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000

# For Android Emulator:
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000

# For Physical Phone (Expo Go on your Wi-Fi):
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XX:8000
```

### 3. Install Dependencies
```bash
cd ambulance-mobile
npm install
```

### 4. Start the Application
- **Run on Web**:
  ```bash
  npm run web
  ```
- **Run on Android**:
  ```bash
  npm run android
  ```
- **Run on iOS**:
  ```bash
  npm run ios
  ```

---

## 🧪 Running Automated Tests

Run unit and integration tests covering authentication, token security, emergency workflows, Groq AI extraction, and Socket.IO listeners:
```bash
npx jest
```

Run TypeScript compilation checks:
```bash
npx tsc --noEmit
```

---

## 🔑 Pre-Seeded Test Credentials

Use these verified credentials or click **"Use Verified Demo Crew Credentials"** on the login screen:
- **Email**: `ambulance@ercs.org`
- **Password**: `Ambulance123!`
- **Unit Call Sign**: `AMB-UNIT-101`
