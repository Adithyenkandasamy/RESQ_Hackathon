# Emergency Response Coordination System — Backend

> **Phase 2: Database Models, Authentication, and Core APIs**

Production-minded FastAPI backend for the Emergency Response Coordination
System (ERCS). Building upon the Phase 1 foundation, Phase 2 implements
database models, secure JWT authentication with Argon2 password hashing,
role-based and organization-scoped authorization, core CRUD APIs, an
audited emergency lifecycle state machine, and administrative oversight.

---

## Technology Stack

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Framework      | FastAPI 0.115                        |
| Language       | Python ≥ 3.10 (3.14 compatible)      |
| Database       | PostgreSQL (Aiven) via asyncpg       |
| ORM            | SQLAlchemy 2.x (async)               |
| Migrations     | Alembic 1.16                         |
| Authentication | JWT (PyJWT) + Argon2id (argon2-cffi) |
| Validation     | Pydantic v2 + Pydantic Settings      |
| Testing        | pytest + HTTPX + aiosqlite (isolated)|
| Linting & Types| Ruff + mypy (strict)                 |
| Package mgr    | uv                                   |

---

## Folder Structure

```
backend/
├── app/
│   ├── __init__.py          # Package marker
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Pydantic Settings configuration + JWT configs
│   ├── database.py          # Async SQLAlchemy engine + sessions
│   ├── core/
│   │   ├── __init__.py
│   │   ├── logging.py       # Structured logging + request-ID middleware
│   │   ├── errors.py        # Centralized exception handlers
│   │   ├── cache.py         # In-process TTL cache
│   │   ├── security.py      # Argon2 password hashing + JWT token handling
│   │   └── auth.py          # FastAPI dependencies: get_current_user, require_roles
│   ├── models/
│   │   ├── __init__.py      # Exported models & Base
│   │   ├── enums.py         # UserRole, AmbulanceStatus, EmergencyStatus, etc.
│   │   ├── user.py          # User account model
│   │   ├── hospital.py      # Hospital model
│   │   ├── ambulance.py     # Ambulance model
│   │   ├── emergency.py     # Emergency incident model
│   │   ├── hospital_request.py # Hospital admission request model
│   │   └── emergency_history.py # Emergency audit trail model
│   ├── schemas/
│   │   ├── __init__.py      # Exported Pydantic schemas
│   │   ├── common.py        # PaginationParams & PaginatedResponse[T]
│   │   ├── auth.py          # LoginRequest, TokenResponse, UserResponse
│   │   ├── hospital.py      # HospitalCreate, HospitalUpdate, HospitalResponse
│   │   ├── ambulance.py     # AmbulanceAvailabilityUpdate, AmbulanceResponse
│   │   ├── emergency.py     # EmergencyCreate, EmergencyPatientUpdate, etc.
│   │   └── admin.py         # AdminDashboardResponse
│   └── routers/
│       ├── __init__.py
│       ├── health.py        # /health/live, /health/ready
│       ├── auth.py          # /api/v1/auth/login, /api/v1/auth/me
│       ├── hospitals.py     # /api/v1/hospitals endpoints
│       ├── ambulances.py    # /api/v1/ambulances/me endpoints
│       ├── emergencies.py   # /api/v1/emergencies endpoints & transitions
│       └── admin.py         # /api/v1/admin/dashboard
├── migrations/              # Alembic migration scripts
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── adbc4e6f26e3_phase2_initial_schema.py
├── scripts/
│   ├── export_openapi.py    # Export application OpenAPI spec to openapi.json
│   └── create_admin.py      # Safe CLI utility to provision admin accounts
├── tests/
│   ├── conftest.py          # In-memory SQLite async test database fixtures
│   ├── test_health.py       # Health / root / request-ID tests
│   ├── test_cache.py        # Cache unit tests
│   ├── test_errors.py       # Error format tests
│   ├── test_auth.py         # Auth, JWT, login, disabled user tests
│   ├── test_hospitals.py    # Hospital CRUD, scoping, availability tests
│   ├── test_ambulances.py   # Ambulance profile & availability tests
│   ├── test_emergencies.py  # Emergency lifecycle, transitions, history tests
│   └── test_admin.py        # Admin dashboard and role-restriction tests
├── openapi.json             # Exported OpenAPI schema
├── pyproject.toml           # Dependencies + tool config
├── uv.lock                  # Locked dependency versions
├── Dockerfile
├── compose.yaml
└── README.md                # This file
```

---

## Authentication and Roles

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
