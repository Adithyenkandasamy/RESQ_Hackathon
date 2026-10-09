# Emergency Response Coordination System — Backend

> **Phase 1: Backend Foundation and Configuration**

Production-minded FastAPI backend for the Emergency Response Coordination
System (ERCS).  This phase establishes the infrastructure foundation:
configuration management, database connectivity, health endpoints,
structured logging, error handling, and an in-memory cache.

---

## Technology Stack

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Framework      | FastAPI 0.115                        |
| Language       | Python ≥ 3.10                        |
| Database       | PostgreSQL (Aiven) via asyncpg       |
| ORM            | SQLAlchemy 2.x (async)               |
| Migrations     | Alembic                              |
| Config         | Pydantic Settings                    |
| Testing        | pytest + HTTPX                       |
| Linting        | Ruff                                 |
| Type checking  | mypy                                 |
| Package mgr    | uv                                   |

---

## Folder Structure

```
backend/
├── app/
│   ├── __init__.py          # Package marker
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Pydantic Settings configuration
│   ├── database.py          # Async SQLAlchemy engine + sessions
│   ├── core/
│   │   ├── __init__.py
│   │   ├── logging.py       # Structured logging + request-ID middleware
│   │   ├── errors.py        # Centralized exception handlers
│   │   └── cache.py         # In-process TTL cache
│   └── routers/
│       ├── __init__.py
│       └── health.py        # /health/live, /health/ready
├── tests/
│   ├── conftest.py          # Shared fixtures
│   ├── test_health.py       # Health / root / request-ID tests
│   ├── test_cache.py        # Cache unit tests
│   └── test_errors.py       # Error format tests
├── migrations/              # Alembic migration scripts
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── .env.example             # Environment template (NO secrets)
├── .gitignore
├── alembic.ini
├── pyproject.toml           # Dependencies + tool config
├── uv.lock                  # Locked dependency versions
├── Dockerfile
├── compose.yaml
└── README.md                # This file
```

---

## Prerequisites

- **Python** ≥ 3.10
- **uv** package manager — [install guide](https://docs.astral.sh/uv/)

---

## Local Environment Setup

### 1. Clone and navigate

```bash
git clone <repo-url>
cd backend
```

### 2. Create virtual environment and install dependencies

```bash
uv sync
```

This creates a `.venv/` directory and installs all dependencies
(including dev dependencies) from the lock file.

**Windows PowerShell:**

```powershell
uv sync
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

For local development **without** a database, leave `DATABASE_URL` empty.
The application starts fine; `/health/ready` will report ok (development
mode treats missing DB as acceptable).

For Aiven connectivity, set:

```
DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname?ssl=require
```

---

## Running the Application

### Development

```bash
uv run uvicorn app.main:app --reload
```

The server starts at `http://127.0.0.1:8000`.

- Interactive docs: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

**Windows PowerShell:**

```powershell
uv run uvicorn app.main:app --reload
```

### Production

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

In production (`APP_ENV=production`):
- Interactive docs (`/docs`, `/redoc`) are disabled.
- `DEBUG` should be `false`.
- `DATABASE_URL` **must** be configured.

---

## Running Tests

```bash
uv run pytest -v
```

Tests run entirely without a real database.  No Aiven credentials are
needed.

**Windows PowerShell:**

```powershell
uv run pytest -v
```

---

## Linting and Formatting (Ruff)

```bash
# Check
uv run ruff check .

# Fix auto-fixable issues
uv run ruff check --fix .

# Format
uv run ruff format .

# Check formatting without changes
uv run ruff format --check .
```

---

## Type Checking (mypy)

```bash
uv run mypy app/
```

---

## Alembic (Database Migrations)

Alembic reads `DATABASE_URL` from your `.env` / environment.

```bash
# Check current migration state
uv run alembic current

# Create a new migration (after defining models)
uv run alembic revision --autogenerate -m "description"

# Apply all pending migrations
uv run alembic upgrade head

# Rollback one migration
uv run alembic downgrade -1
```

---

## Testing Aiven Connectivity

To verify that your `DATABASE_URL` connects successfully to Aiven:

```bash
uv run python -c "
import asyncio
from app.config import get_settings
from app.database import init_engine, check_connection, close_engine

async def main():
    settings = get_settings()
    if not settings.database_is_configured:
        print('DATABASE_URL is not configured.')
        return
    init_engine(settings.DATABASE_URL)
    ok = await check_connection()
    print('Connection:', 'SUCCESS' if ok else 'FAILED')
    await close_engine()

asyncio.run(main())
"
```

> **Note:** Aiven connectivity has NOT been verified as part of this
> Phase 1 implementation.  Run the command above with a valid
> `DATABASE_URL` to confirm.

---

## Docker

### Build

```bash
docker build -t er-cs-backend .
```

### Run

```bash
docker run -p 8000:8000 --env-file .env er-cs-backend
```

### Docker Compose (local dev)

```bash
docker compose up --build
```

The compose file does **not** include a local PostgreSQL.
To use a database, set `DATABASE_URL` in your `.env` file.

---

## Health Endpoints

| Endpoint          | Purpose               | Response (healthy)    | Response (unhealthy) |
| ----------------- | --------------------- | --------------------- | -------------------- |
| `GET /`           | Service identity      | `200` name/version    | —                    |
| `GET /health/live`| Liveness probe        | `200 {"status":"ok"}` | —                    |
| `GET /health/ready`| Readiness probe      | `200 {"status":"ok"}` | `503`                |

**Liveness** confirms the process is running. It never checks downstream
services.

**Readiness** verifies that required dependencies (currently PostgreSQL)
are available.  In development mode, missing `DATABASE_URL` is acceptable.
In production, missing or unreachable DB causes a `503`.

Health responses never expose credentials, hostnames, or exception details.

---

## Logging and Request IDs

Every request is assigned a UUID request ID:

- If the client sends `X-Request-ID` with a valid UUID, it is reused.
- Otherwise, a new UUID4 is generated.
- The ID is returned in the `X-Request-ID` response header.
- The ID appears in all log records for that request.

Health-check requests are logged at `DEBUG` level to reduce noise.

Sensitive data (passwords, tokens, patient info) is never logged.

---

## Error Response Format

All errors use a consistent JSON envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

| HTTP Status | Code               | When                           |
| ----------- | ------------------ | ------------------------------ |
| 400         | `BAD_REQUEST`      | Malformed request              |
| 404         | `NOT_FOUND`        | Unknown path                   |
| 422         | `VALIDATION_ERROR` | Invalid request parameters     |
| 500         | `INTERNAL_ERROR`   | Unexpected server error        |
| 503         | `SERVICE_UNAVAILABLE`| Dependency unavailable       |

Stack traces are **never** sent to the client.  Full details are logged
server-side.

---

## Cache Limitations

The in-process TTL cache (`app.core.cache.TTLCache`) is suitable only
for temporary, non-critical data:

- **Entries disappear** when the process restarts.
- **Multiple workers** do NOT share cache contents.
- **Stale data** — cached values can become outdated.
- **Never** use for emergency records, hospital assignments, or other
  critical state.

---

## CORS Configuration

Allowed origins are read from `CORS_ORIGINS` (comma-separated):

```
# Development
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# Production — use your real deployed domains
CORS_ORIGINS=https://hospital.yourdomain.com,https://admin.yourdomain.com
```

Wildcard (`*`) is NOT used with credentials.

CORS is transport-level security only — it does not replace
authentication or authorization.

**Production:** Set `CORS_ORIGINS` to your actual deployed frontend
domains.  Do not leave development origins in production.

---

## robots.txt

`GET /robots.txt` returns:

```
User-agent: *
Disallow: /
```

This is crawler guidance only.  It does not provide security.
Served with `Content-Type: text/plain`.

---

## Production Security Notes

1. Set `APP_ENV=production` and `DEBUG=false`.
2. Configure `DATABASE_URL` with your Aiven credentials.
3. Set `CORS_ORIGINS` to actual production domains.
4. Interactive docs (`/docs`, `/redoc`) are disabled in production.
5. TLS certificate verification is always enabled for database
   connections — never disabled.
6. Never commit `.env` files with real credentials.
7. Use Kubernetes/Docker secrets or environment injection for secrets.

---

## Deferred to Later Phases

The following are intentionally **not** implemented in Phase 1:

- User authentication and authorization (JWT, etc.)
- Emergency workflow (create, triage, dispatch)
- Hospital matching and assignment
- Socket.IO real-time event handling
- ElevenLabs speech transcription integration
- Groq AI processing integration
- Business database models (emergencies, hospitals, ambulances)
- Redis caching layer
- File upload / media handling
- Rate limiting
- Admin dashboard API
