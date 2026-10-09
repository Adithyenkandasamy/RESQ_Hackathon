# Emergency Response Coordination System — Backend

> **Phase 3: Hospital Matching, Socket.IO, and AI Integration**

Production-minded FastAPI backend for the Emergency Response Coordination
System (ERCS). Building upon the Phase 1 foundation and Phase 2 data/auth models,
Phase 3 implements rules-based hospital matching, persistent admission requests,
concurrency-safe destination hospital assignment, ASGI-mounted Socket.IO real-time
notifications, ElevenLabs voice transcription, Groq clinical observation extraction,
handover summarization, and clinically constrained first-aid guidance.

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

---

## Emergency Lifecycle & State Transitions

The system enforces an explicit state transition machine:

```
[CREATED] ──► [ASSESSMENT_IN_PROGRESS] ──► [SEARCHING_HOSPITAL]
   │                       │                       │
   ▼                       ▼                       ▼
[CANCELLED]             [CANCELLED]             [CANCELLED]
   ▲                       ▲                       ▲
   │                       │                       │
   │               [ACCEPTANCE_PENDING]            │
   │                       │                       │
   │                       ▼                       │
   │              [HOSPITAL_CONFIRMED]             │
   │                       │                       │
   │                       ▼                       │
   │                 [TRANSPORTING]                │
   │                       │                       │
   │                       ▼                       │
   │                   [ARRIVED]                   │
   │                       │                       │
   │                       ▼                       │
   │             [HANDOVER_COMPLETED]              │
   │                                               │
   └── [ESCALATION_REQUIRED] ◄─────────────────────┘
```

- Invalid transitions return HTTP `400 Bad Request` with details on allowed next states.
- Every state transition automatically writes an immutable record to `emergency_history`.

---

## OpenAPI Export

To export the OpenAPI schema from the actual application:

```bash
uv run python scripts/export_openapi.py --out openapi.json
```

The exported schema is generated directly from the live FastAPI routes and metadata.

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

---

## Database Migrations

Apply Alembic migrations to your database:

```bash
uv run alembic upgrade head
```

Generate SQL script for review without touching the live database:

```bash
uv run alembic upgrade head --sql
```

---

## Error Response Format

All error responses use the standard envelope:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid transition from 'CREATED' to 'HANDOVER_COMPLETED'. Allowed target states: ['ASSESSMENT_IN_PROGRESS', 'CANCELLED'].",
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Deferred to Later Phases

The following are intentionally **not** implemented in Phase 2:
- Socket.IO real-time event streaming
- Groq AI processing integration
- ElevenLabs voice transcription
- Automated multi-criteria hospital matching algorithm
- Redis distributed cache / session store
- Kafka / Celery message queues
