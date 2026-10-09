# ERCS — Emergency Response Coordination System

ERCS is an end-to-end, high-reliability emergency response coordination platform integrating emergency ambulances, regional hospital triage centers, and central administrative dispatch.

The frontend consists of **four standalone, zero-dependency HTML/JS/CSS applications** that connect directly to the FastAPI + PostgreSQL (Aiven) backend with real-time Socket.IO synchronization, ElevenLabs audio transcription, and Groq clinical intelligence.

---

## 🚀 Standalone Frontend Applications

Each application is a self-contained HTML file built with modern Vanilla CSS (dark theme, glassmorphism, responsive design), native JavaScript, Leaflet.js mapping, and Socket.IO client:

| File | Purpose | Target User / Role |
| :--- | :--- | :--- |
| **[`admin-dashboard.html`](admin-dashboard.html)** | Central command dashboard: real-time tactical map, operational stats, emergency monitor, hospital registration, and applicant review queues. | Central Dispatch / Administrator (`ADMIN`) |
| **[`hospital-portal.html`](hospital-portal.html)** | Hospital emergency triage gateway: real-time emergency dispatch requests, concurrency-safe accept/decline, live capacity management, and incoming patient handover. | Hospital ER Staff (`HOSPITAL_STAFF`) |
| **[`ambulance-portal.html`](ambulance-portal.html)** | Mobile field crew station: GPS/manual incident creation, scene voice recording (ElevenLabs), Groq AI clinical extraction, hospital routing, navigation, and handover. | Field Crew Paramedics (`AMBULANCE_CREW`) |
| **[`api-testing.html`](api-testing.html)** | Interactive testing console matching the exact OpenAPI contract, with one-click token generators and live Socket.IO event monitor. | QA Engineers & Integrators |

---

## 🔒 Core Business Model & Security Rules

1. **Backend Controls State & Authorization**:
   - The frontend never grants operational permissions. All actions (creating emergencies, updating bed availability, dispatching requests, accepting hospital beds) require cryptographically signed JWT tokens verified by FastAPI backend dependencies (`require_roles`).
   - A pending or rejected account cannot gain operational privileges simply by tampering with local client state.
2. **Concurrency-Safe Hospital Allocations**:
   - When an emergency is dispatched, candidates receive simultaneous requests. The backend uses atomic database locking (`SELECT ... FOR UPDATE`) so that only the first accepting hospital is confirmed. Late acceptances receive a standard `409 Conflict`.
3. **Confirmed Destination Invariant**:
   - Ambulances are never shown an unconfirmed hospital destination. Google Maps turn-by-turn navigation is enabled strictly when a single hospital has been officially confirmed by the backend.
4. **Defensible Outcome Metrics**:
   - The platform strictly reports reliable operational metrics ("emergencies coordinated", "patients transported", "completed handovers"). It does not fabricate life-saved claims without clinical survival data.

---

## 🔑 Demo & Test Credentials

The backend database (`resq_db` on Aiven) is provisioned with verified seed accounts for immediate evaluation:

| Role | Email | Password | Assigned Entity |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@ercs.org` | `Admin123!` | System-wide access |
| **Hospital Staff** | `hospital@ercs.org` | `Hospital123!` | Metro General Trauma Center (`HOSP-METRO-01`) |
| **Ambulance Crew** | `ambulance@ercs.org` | `Ambulance123!` | Unit `AMB-UNIT-101` |

*(All three portals include 1-click credential pre-fills for rapid evaluation).*

---

## 🛠️ Local Serving & Browser Instructions

Because the applications communicate with the backend on `http://localhost:8000` via JavaScript `fetch` and WebSocket connections, they should be served through a local HTTP server to avoid browser `file://` origin security restrictions.

### Option 1: Serve via Python HTTP Server (Recommended)
From the repository root directory:
```bash
python3 -m http.server 3000
```
Open your browser and navigate to:
- **Admin Dashboard**: [http://localhost:3000/admin-dashboard.html](http://localhost:3000/admin-dashboard.html)
- **Hospital Portal**: [http://localhost:3000/hospital-portal.html](http://localhost:3000/hospital-portal.html)
- **Ambulance Portal**: [http://localhost:3000/ambulance-portal.html](http://localhost:3000/ambulance-portal.html)
- **API Testing Console**: [http://localhost:3000/api-testing.html](http://localhost:3000/api-testing.html)

### Option 2: Live Server (VS Code / Extension)
Right-click any HTML file in VS Code and choose **"Open with Live Server"** (runs on port 5500).

### Backend CORS Configuration
The backend is pre-configured in `.env` to allow incoming browser requests from common development ports:
`http://localhost:3000`, `http://localhost:5500`, `http://localhost:8000`, `http://localhost:8080`, `http://localhost:5173`.

---

## 📡 Real-Time Socket.IO Architecture

The backend provides authenticated Socket.IO rooms at `/socket.io`:
- `admin`: System-wide event broadcast (`emergency.status.updated`, `hospital.assigned`, `hospital_request.created`).
- `hospital:{hospital_id}`: Targeted inbound triage requests (`hospital_request.created`, `hospital.assigned`).
- `ambulance:{ambulance_id}`: Destination confirmations (`hospital.assigned`, `emergency.status.updated`).
- `emergency:{emergency_id}`: Field incident lifecycle and clinical progress.

---

## 📋 Comprehensive Endpoint Coverage Report

This report documents every ERCS business requirement against the actual FastAPI backend implementation.

### 1. Supported Endpoints

| Category | Method | Path | Backend Handler | Portal Support |
| :--- | :--- | :--- | :--- | :--- |
| **Health** | `GET` | `/health/live` | `app/routers/health.py` | Full |
| **Health** | `GET` | `/health/ready` | `app/routers/health.py` | Full |
| **Auth** | `POST` | `/api/v1/auth/login` | `app/routers/auth.py` | Full (JWT Token Issuance) |
| **Auth** | `GET` | `/api/v1/auth/me` | `app/routers/auth.py` | Full (Role Verification) |
| **Admin** | `GET` | `/api/v1/admin/dashboard` | `app/routers/admin.py` | Full (Metrics Aggregation) |
| **Hospitals** | `GET` | `/api/v1/hospitals` | `app/routers/hospitals.py` | Full (Directory Listing) |
| **Hospitals** | `POST` | `/api/v1/hospitals` | `app/routers/hospitals.py` | Full (Admin Registration) |
| **Hospitals** | `GET` | `/api/v1/hospitals/me` | `app/routers/hospitals.py` | Full (Staff Profile) |
| **Hospitals** | `PATCH` | `/api/v1/hospitals/me` | `app/routers/hospitals.py` | Full (Staff Profile Update) |
| **Hospitals** | `PATCH` | `/api/v1/hospitals/me/availability` | `app/routers/hospitals.py` | Full (ER & ICU Bed Counts) |
| **Ambulances**| `GET` | `/api/v1/ambulances/me` | `app/routers/ambulances.py` | Full (Vehicle Profile) |
| **Ambulances**| `PATCH` | `/api/v1/ambulances/me/availability` | `app/routers/ambulances.py` | Full (Availability Toggle) |
| **Emergencies**| `POST`| `/api/v1/emergencies` | `app/routers/emergencies.py` | Full (Creation & Geolocation) |
| **Emergencies**| `GET` | `/api/v1/emergencies` | `app/routers/emergencies.py` | Full (Paginated List) |
| **Emergencies**| `GET` | `/api/v1/emergencies/{id}` | `app/routers/emergencies.py` | Full (Incident Details) |
| **Emergencies**| `PATCH`| `/api/v1/emergencies/{id}/status` | `app/routers/emergencies.py` | Full (Lifecycle State Machine)|
| **Emergencies**| `PATCH`| `/api/v1/emergencies/{id}/location` | `app/routers/emergencies.py` | Full (GPS Updates) |
| **Emergencies**| `PATCH`| `/api/v1/emergencies/{id}/patient` | `app/routers/emergencies.py` | Full (Triage & Demographics) |
| **Emergencies**| `GET` | `/api/v1/emergencies/{id}/history` | `app/routers/emergencies.py` | Full (Audit Trail) |
| **Emergencies**| `POST`| `/api/v1/emergencies/{id}/match-hospitals` | `app/routers/emergencies.py` | Full (Matching Protocol) |
| **Emergencies**| `GET` | `/api/v1/emergencies/{id}/requests` | `app/routers/emergencies.py` | Full (Dispatched Requests) |
| **Emergencies**| `GET` | `/api/v1/emergencies/{id}/destination` | `app/routers/emergencies.py` | Full (Confirmed Hospital) |
| **AI / Voice** | `POST`| `/api/v1/emergencies/{id}/transcription` | `app/routers/emergencies.py` | Full (ElevenLabs Scribe v1) |
| **AI / Voice** | `POST`| `/api/v1/emergencies/{id}/ai/extract` | `app/routers/emergencies.py` | Full (Groq Clinical NLP) |
| **AI / Voice** | `POST`| `/api/v1/emergencies/{id}/ai/verify-extractions` | `app/routers/emergencies.py` | Full (Crew Verification) |
| **AI / Voice** | `POST`| `/api/v1/emergencies/{id}/ai/handover-summary` | `app/routers/emergencies.py` | Full (Groq Handover Draft) |
| **AI / Voice** | `POST`| `/api/v1/emergencies/{id}/handover/confirm` | `app/routers/emergencies.py` | Full (Crew Confirmation) |
| **AI / Voice** | `POST`| `/api/v1/emergencies/{id}/ai/first-aid` | `app/routers/emergencies.py` | Full (Constrained Protocols) |
| **Hospital Reqs** | `GET` | `/api/v1/hospital-requests` | `app/routers/hospital_requests.py` | Full (Inbound Triage List) |
| **Hospital Reqs** | `POST`| `/api/v1/hospital-requests/{id}/accept` | `app/routers/hospital_requests.py` | Full (Concurrency-Safe Lock) |
| **Hospital Reqs** | `POST`| `/api/v1/hospital-requests/{id}/decline` | `app/routers/hospital_requests.py` | Full (Rejection with Reason) |

---

### 2. Missing Backend Endpoints & Frontend Handling

In adherence with requirements to never claim unsupported backend features work, the following gaps in the FastAPI backend were identified and transparently addressed in the frontend design:

| Missing Backend Capability | Gap Description | Frontend Handling / Invariant |
| :--- | :--- | :--- |
| **Public Self-Registration** (`POST /api/v1/auth/register/*`) | The backend lacks public unauthenticated self-registration routes. Only `POST /api/v1/hospitals` (Admin only) exists. | The registration forms intake application details into a localized application queue and display clear feedback: *"Application queued for administrative audit."* The Admin Dashboard features an Applicant Review Board allowing administrators to review and provision them into PostgreSQL via `POST /api/v1/hospitals`. |
| **Registration Approval Endpoint** (`PATCH /api/v1/admin/registrations/*`) | The backend user schema relies on `is_active: bool` without a dedicated `RegistrationApplication` table. | Admin review actions invoke backend provisioning for approved entities and store formal rejection reasons locally with audit logs. Unapproved accounts cannot log in to gain operational permissions. |
| **Accreditation Document Binary Storage** (`POST /api/v1/hospitals/documents`) | The backend provides multipart upload for audio recordings (`/transcription`), but lacks generic PDF/document object storage. | Hospital Portal provides a document intake validator that previews file metadata, computes cryptographic file digests client-side, and badges documents as ready for external auditing. |
| **Continuous GPS Telemetry Tracking** | Continuous polling GPS tracking is intentionally not supported to conserve battery and bandwidth. | Location is captured discrete-time via HTML5 Geolocation API upon incident creation and manual coordinate updates via `PATCH /emergencies/{id}/location`. |