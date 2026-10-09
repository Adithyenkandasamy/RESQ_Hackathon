"""Health and readiness endpoints.

Endpoints
---------
``GET /health/live``
    Liveness probe — confirms the process is running.
    Always returns ``{"status": "ok"}`` with HTTP 200.
    Suitable for Kubernetes liveness probes and basic uptime checks.

``GET /health/ready``
    Readiness probe — confirms all required dependencies are available.
    Checks PostgreSQL connectivity when a database is configured.
    Returns HTTP 200 if ready, HTTP 503 if not.
    Never exposes credentials, hostnames, or exception details.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app import database
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["Health"])


@router.get(
    "/live",
    summary="Liveness probe",
    description=(
        "Indicates the application process is alive. Does not check downstream dependencies."
    ),
)
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/ready",
    summary="Readiness probe",
    description=(
        "Verifies that required dependencies (e.g. PostgreSQL) are available. "
        "Returns 503 if any required dependency is unhealthy."
    ),
)
async def readiness() -> dict[str, str | dict[str, str]]:
    settings = get_settings()
    checks: dict[str, str] = {}

    if settings.database_is_configured:
        db_ok = await database.check_connection()
        checks["database"] = "ok" if db_ok else "unavailable"
    else:
        # If DB is required (production) but not configured, that's unhealthy.
        if settings.is_production:
            checks["database"] = "not_configured"
        # In development, missing DB config is acceptable.

    # Determine overall status.
    all_ok = all(v == "ok" for v in checks.values())
    # If no checks were performed (dev, no DB), consider ready.
    if not checks:
        all_ok = True

    if not all_ok:
        from starlette.responses import JSONResponse

        return JSONResponse(  # type: ignore[return-value]
            status_code=503,
            content={"status": "unavailable", "checks": checks},
        )

    result: dict[str, str | dict[str, str]] = {"status": "ok"}
    if checks:
        result["checks"] = checks
    return result
