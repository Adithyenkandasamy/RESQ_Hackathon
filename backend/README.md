# Emergency Response Coordination System — Backend

> **Phase 4: Integration, Security, Reliability, Testing, and Deployment**

Production-minded FastAPI backend for the Emergency Response Coordination
System (ERCS). Building upon the Phase 1 foundation, Phase 2 data/auth models,
and Phase 3 real-time and AI integrations, Phase 4 hardens cross-tenant security,
guarantees single-hospital concurrency, protects confidential patient records,
validates complete emergency-to-handover lifecycles, and provides containerized
production deployment workflows.

---

## Technology Stack

| Layer          | Technology                                   |
| -------------- | -------------------------------------------- |
| Framework      | FastAPI 0.115 + python-socketio (ASGI App)   |
| Language       | Python ≥ 3.10 (3.14 compatible)              |
| Database       | PostgreSQL (Aiven) via asyncpg               |
| ORM            | SQLAlchemy 2.x (async)                       |
| Migrations     | Alembic 1.16                                 |
| Real-Time      | Socket.IO (ASGI mounted with JWT auth)       |
| Speech-to-Text | ElevenLabs API                               |
| AI Extraction  | Groq API (LLaMA-3 / JSON-mode validation)    |
| Authentication | JWT (PyJWT) + Argon2id (argon2-cffi)         |
| Validation     | Pydantic v2 + Pydantic Settings              |
| Testing        | pytest + HTTPX + aiosqlite (isolated)        |
| Linting & Types| Ruff + mypy (strict)                         |
| Package mgr    | uv                                           |

---

## Phase 3 Features

### 1. Deterministic Hospital Matching
- **Algorithm**: Rules-based scoring using incident coordinates, hospital coordinates (Haversine formula), reported capability overlap, and explicit operational availability.
- **Scoring**:
  - Distance score: scaled `max(0, 100 - (distance_km * 2.5))` (up to 40km reach).
  - Capability score: +20 points per matched clinical capability required by the incident.
  - Availability modifier: `AVAILABLE` (+25 points), `FULL` (-100 points), `UNKNOWN` (0 points, conservative treatment).
- **Ranking**: Sorted by composite match score descending. Hospitals with missing coordinates or zero score are excluded.

### 2. Persistent Admission Requests & Single Hospital Assignment
- **State Machine**: Requests transition through `PENDING` -> `ACCEPTED`, `DECLINED`, `EXPIRED`, or `CANCELLED`.
- **Concurrency Control**: Exclusive row-level locking on the `Emergency` record (`with_for_update()`) ensures that when multiple hospitals accept nearly simultaneously:
  1. The winning transaction commits acceptance and updates emergency status to `HOSPITAL_CONFIRMED`.
  2. All other pending requests for the emergency are automatically set to `CANCELLED`.
  3. The competing transaction unblocks, identifies that the emergency has already been confirmed, and returns `409 Conflict`.

### 3. Socket.IO Real-Time Notifications
- ASGI mounted directly on FastAPI without separate microservices.
- Handshake authenticated via Bearer JWT token in auth payload or HTTP headers.
- **Room Authorization**:
  - `hospital:{hospital_id}`: Hospital staff assigned to that hospital ID.
  - `ambulance:{ambulance_id}`: Crew members assigned to that ambulance ID.
  - `emergency:{emergency_id}`: Authorized assigned crew or target hospital staff.
  - `admin`: System administrators.
- **Event Types**:
  - `hospital_request.created`
  - `hospital_request.accepted`
  - `hospital_request.declined`
  - `hospital_request.expired`
  - `hospital.assigned`
  - `emergency.status.updated`
- **Envelope Format**:
  ```json
  {
    "event_id": "uuid",
    "event_type": "hospital.assigned",
    "occurred_at": "2026-10-10T00:00:00Z",
    "resource_id": "emergency_id",
    "data": { ... }
  }
  ```
- Events are emitted strictly **post-commit**. REST remains the authoritative source of truth.

### 4. Non-Blocking AI Services
- **ElevenLabs Speech Transcription** (`POST /api/v1/emergencies/{id}/transcription`):
  - Validates audio format (`audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/webm`, `audio/aac`) and size (max 25 MB).
  - Calls ElevenLabs asynchronously without blocking dispatch.
- **Groq Clinical Observation Extraction** (`POST /api/v1/emergencies/{id}/ai/extract`):
  - Extracts structured clinical observations into a validated Pydantic model (`EmergencyExtractionResult`).
  - Distinguishes reported observations from verified clinical findings; never fabricates missing vitals.
- **Groq Handover Summary** (`POST /api/v1/emergencies/{id}/ai/handover-summary`):
  - Generates concise draft handover summaries from recorded case details.
  - Explicitly marked as AI-generated and requiring medical review.
- **Constrained First-Aid Guidance** (`POST /api/v1/emergencies/{id}/ai/first-aid`):
  - Uses an explicitly maintained, clinically reviewed catalog of first-aid protocols (`find_approved_protocol`).
  - Constrains LLM generation to approved protocols only, preventing invented medication, dosages, or unvetted procedures.

---

## API Endpoints (Phase 3 Additions)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/emergencies/{id}/match-hospitals` | Ambulance Crew, Admin | Run matching and dispatch requests |
| GET | `/api/v1/emergencies/{id}/destination` | Authorized Staff | Get confirmed destination hospital |
| GET | `/api/v1/hospital-requests` | Hospital Staff, Admin | List hospital requests for own hospital |
| GET | `/api/v1/hospital-requests/{id}` | Hospital Staff, Admin | View request details |
| POST | `/api/v1/hospital-requests/{id}/accept` | Hospital Staff | Concurrency-safe acceptance |
| POST | `/api/v1/hospital-requests/{id}/decline` | Hospital Staff | Decline admission request |
| POST | `/api/v1/emergencies/{id}/transcription` | Ambulance Crew, Hospital, Admin | Transcribe incident audio |
| POST | `/api/v1/emergencies/{id}/ai/extract` | Ambulance Crew, Hospital, Admin | Structured clinical extraction |
| POST | `/api/v1/emergencies/{id}/ai/handover-summary` | Ambulance Crew, Hospital, Admin | Generate handover summary draft |
| POST | `/api/v1/emergencies/{id}/ai/first-aid` | Ambulance Crew, Hospital, Admin | Constrained first-aid guidance |

---

## Configuration Variables

```ini
# AI & Speech Configuration
ELEVENLABS_API_KEY=""
ELEVENLABS_TRANSCRIPTION_MODEL="scribe_v1"
GROQ_API_KEY=""
GROQ_MODEL="llama-3.3-70b-versatile"
AI_REQUEST_TIMEOUT_SECONDS=30.0
MAX_AUDIO_UPLOAD_BYTES=26214400 # 25 MB

# Hospital Dispatch Configuration
HOSPITAL_RESPONSE_TIMEOUT_SECONDS=180
MAX_DISPATCH_HOSPITALS_PER_WAVE=3
```

---

## Automated Testing & Quality Checks

Run the automated test suite (runs 100% against an isolated in-memory test database):

```bash
uv run pytest
```

Run code formatting and lint checks:

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy app
```

Export the updated OpenAPI specification:

```bash
uv run python scripts/export_openapi.py --out openapi.json
```

---

## Database Migrations

Apply Alembic migrations to PostgreSQL:

```bash
uv run alembic upgrade head
```

Migrations:
- `adbc4e6f26e3`: Initial Phase 2 tables and schemas.
- `4d621ebca70a`: Phase 3 hospital request response deadlines, cancelled status, and emergency AI metadata.


### Roles
- `ADMIN`: Full administrative management. Can register hospitals, view system-wide statistics, create and inspect all emergencies.
- `HOSPITAL_STAFF`: Associated with a specific `hospital_id`. Can retrieve and update their own hospital profile and reported availability. Cannot access other hospitals or ambulance operational controls.
- `AMBULANCE_CREW`: Associated with a specific `ambulance_id`. Can retrieve and update their assigned vehicle operational readiness, create emergencies, report vitals and scene coordinates, and transition states for assigned incidents.

### Authentication Flow
1. **Login**: Client sends `POST /api/v1/auth/login` with `{"email": "...", "password": "..."}`.
2. **Verification**: Password verified using Argon2id. Disabled accounts (`is_active=False`) are rejected.
3. **Token**: Generates signed JWT bearer token containing `sub` (user UUID), `email`, and `role`.
4. **Requests**: Client attaches `Authorization: Bearer <token>` in HTTP headers.
5. **Profile**: `GET /api/v1/auth/me` returns current user profile (never exposing password hashes or tokens).

---

## Safe Provisioning of the Initial Administrator

Do not use default or hardcoded credentials. To create the first administrator safely:

```bash
# Interactive prompt (masks password input securely):
uv run python scripts/create_admin.py --email admin@ercs.org

# Or non-interactive (CI / deployment automation):
uv run python scripts/create_admin.py --email admin@ercs.org --password "YourStrongPassword123!"
```

---

## API Endpoints (`/api/v1`)

### Authentication
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token.
- `GET  /api/v1/auth/me` — Retrieve profile of the authenticated caller.

### Hospitals
- `GET   /api/v1/hospitals` — List registered hospitals (paginated, accessible to authenticated users).
- `POST  /api/v1/hospitals` — Register new hospital (restricted to `ADMIN`).
- `GET   /api/v1/hospitals/me` — Retrieve profile of assigned hospital (`HOSPITAL_STAFF`).
- `PATCH /api/v1/hospitals/me` — Update assigned hospital details (`HOSPITAL_STAFF`).
- `PATCH /api/v1/hospitals/me/availability` — Update explicitly reported availability (`HOSPITAL_STAFF`).

### Ambulances
- `GET   /api/v1/ambulances/me` — Retrieve operational profile of assigned vehicle (`AMBULANCE_CREW`).
- `PATCH /api/v1/ambulances/me/availability` — Update operational status (`AMBULANCE_CREW`).

### Emergencies
- `POST  /api/v1/emergencies` — Create emergency incident (`AMBULANCE_CREW`, `ADMIN`).
- `GET   /api/v1/emergencies` — List accessible emergencies (role-scoped, paginated).
- `GET   /api/v1/emergencies/{emergency_id}` — Retrieve emergency by ID (role-authorized).
- `PATCH /api/v1/emergencies/{emergency_id}/patient` — Update patient scene observations (partial details allowed).
- `PATCH /api/v1/emergencies/{emergency_id}/location` — Update coordinates with capture timestamp (validated bounds).
- `PATCH /api/v1/emergencies/{emergency_id}/status` — Transition emergency lifecycle status.
- `GET   /api/v1/emergencies/{emergency_id}/history` — Retrieve chronological audit trail.

### Administration
- `GET   /api/v1/admin/dashboard` — Aggregated operational metrics summary (`ADMIN` only). No sensitive patient data is exposed.

### Phase 3 & 4 Dispatch, Real-Time, and AI
- `POST  /api/v1/emergencies/{id}/match-hospitals` — Evaluate matching criteria and dispatch hospital admission requests.
- `GET   /api/v1/emergencies/{id}/assignment` — Retrieve confirmed destination hospital.
- `GET   /api/v1/emergencies/{id}/destination` — Alias for confirmed destination hospital.
- `GET   /api/v1/emergencies/{id}/requests` — Retrieve all requests dispatched for this emergency.
- `GET   /api/v1/hospital-requests` — List admission requests for caller's hospital.
- `GET   /api/v1/hospital-requests/{id}` — Retrieve hospital request details.
- `POST  /api/v1/hospital-requests/{id}/accept` — Concurrency-safe acceptance (`409 Conflict` on competing losers).
- `POST  /api/v1/hospital-requests/{id}/decline` — Decline admission request (triggers escalation when all decline).
- `POST  /api/v1/emergencies/{id}/transcription` — Transcribe incident audio via ElevenLabs.
- `POST  /api/v1/emergencies/{id}/ai/extract` — Extract structured clinical observations via Groq (LLaMA-3).
- `POST  /api/v1/emergencies/{id}/ai/verify-extractions` — Attending crew verifies and promotes extracted observations to verified patient record.
- `POST  /api/v1/emergencies/{id}/ai/handover-summary` — Generate clinical handover summary draft via Groq.
- `POST  /api/v1/emergencies/{id}/handover/confirm` — Attending crew reviews, confirms, and approves handover summary.
- `POST  /api/v1/emergencies/{id}/ai/first-aid` — Constrained first-aid guidance from approved clinical protocol catalog.

---

## Socket.IO Event Contract & Authorization

All Socket.IO connections run on the unified ASGI application at path `/socket.io`.

### Handshake Authentication
Supply JWT bearer token in connection auth payload:
```json
{
  "token": "<JWT_ACCESS_TOKEN>"
}
```
Or via HTTP header `Authorization: Bearer <token>`.

### Room Authorization
- `hospital:{hospital_id}`: Hospital staff assigned to that hospital ID.
- `ambulance:{ambulance_id}`: Crew members assigned to that ambulance ID.
- `emergency:{emergency_id}`: Only assigned ambulance crew, confirmed hospital staff, or candidate hospital staff with an active admission request. Unrelated clients are strictly rejected.
- `admin`: Administrators only.

### Event Envelope
```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "hospital.assigned",
  "occurred_at": "2026-10-10T00:00:00Z",
  "resource_id": "emergency_uuid",
  "data": { ... }
}
```

---

## Production Docker Deployment

### Build Production Image
```bash
docker build -t er-cs-backend:prod .
```

PowerShell:
```powershell
docker build -t er-cs-backend:prod .
```

### Run Production Container
```bash
docker run -d \
  --name ercs-backend \
  -p 8000:8000 \
  --env-file .env \
  --restart unless-stopped \
  er-cs-backend:prod
```

PowerShell:
```powershell
docker run -d `
  --name ercs-backend `
  -p 8000:8000 `
  --env-file .env `
  --restart unless-stopped `
  er-cs-backend:prod
```

---

## Deployment & Rollback Procedures

### Deployment Checklist
1. Verify Aiven PostgreSQL connectivity and credentials.
2. Run automated test suite: `uv run pytest`.
3. Verify linting and static typing: `uv run ruff check .` and `uv run mypy app`.
4. Apply database migrations: `uv run alembic upgrade head`.
5. Verify health probes: `curl http://localhost:8000/health/live` and `curl http://localhost:8000/health/ready`.
6. Export updated OpenAPI contract: `uv run python scripts/export_openapi.py --out openapi.json`.

### Rollback Procedure
If an issue occurs in production:
1. **Application Rollback**:
   Deploy the previous Docker image tag or git revision:
   ```bash
   docker stop ercs-backend && docker rm ercs-backend
   docker run -d --name ercs-backend -p 8000:8000 --env-file .env er-cs-backend:<PREVIOUS_TAG>
   ```
2. **Database Migration Downgrade**:
   To revert the most recent migration safely:
   ```bash
   uv run alembic downgrade -1
   ```
   Or target a specific revision:
   ```bash
   uv run alembic downgrade adbc4e6f26e3
   ```

---

## Known Limitations & Architecture Notes

1. **In-Memory Socket.IO**: The application uses an in-memory Socket.IO server. For horizontal multi-instance scaling, a pub/sub manager (e.g. Redis) is required. On a single container instance, uvicorn runs with `--workers 1` to ensure event coherence across all connected clients.
2. **Proximity Calculation**: Hospital matching calculates straight-line spherical distance via the Haversine formula. Actual road travel times vary based on traffic conditions and can be integrated with external routing engines (OSRM) in subsequent releases.
3. **Lazy Expiration**: Hospital request response deadlines are enforced on accept and retrieve operations. A background scheduled task worker can be added for automated retry waves without manual crew polling.

