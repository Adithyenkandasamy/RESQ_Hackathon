"""Tests for health and root endpoints."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest

# ── Root endpoint ────────────────────────────────────────────────


@pytest.mark.anyio
async def test_root_returns_service_info(client: httpx.AsyncClient) -> None:
    """GET / returns name, version, and status."""
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Emergency Response Coordination System"
    assert data["version"] == "0.1.0"
    assert data["status"] == "running"


# ── Liveness ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_liveness_returns_ok(client: httpx.AsyncClient) -> None:
    """GET /health/live always returns 200 {"status": "ok"}."""
    resp = await client.get("/health/live")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ── Readiness ────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_readiness_ok_without_database(client: httpx.AsyncClient) -> None:
    """In development with no DATABASE_URL, readiness is ok."""
    resp = await client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.anyio
async def test_readiness_ok_with_healthy_database(
    client: httpx.AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    mock_db_check_ok: Any,
) -> None:
    """When DB is configured and healthy, readiness is ok."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    resp = await client.get("/health/ready")
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_readiness_503_when_database_unavailable(
    monkeypatch: pytest.MonkeyPatch,
    settings_env: None,
) -> None:
    """When DB is configured but unreachable, readiness returns 503."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")

    from app.main import create_app

    app = create_app()
    with patch(
        "app.routers.health.database.check_connection",
        new_callable=AsyncMock,
        return_value=False,
    ):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as ac:
            resp = await ac.get("/health/ready")
    assert resp.status_code == 503
    data = resp.json()
    assert data["status"] == "unavailable"
    # Must NOT contain any credential / hostname info.
    resp_text = resp.text
    assert "password" not in resp_text.lower()


# ── Request ID ───────────────────────────────────────────────────


@pytest.mark.anyio
async def test_request_id_generated_when_absent(client: httpx.AsyncClient) -> None:
    """Response must contain X-Request-ID even if client didn't send one."""
    resp = await client.get("/")
    rid = resp.headers.get("X-Request-ID")
    assert rid is not None
    # Must be a valid UUID.
    import uuid

    uuid.UUID(rid)


@pytest.mark.anyio
async def test_request_id_echoed_when_valid(client: httpx.AsyncClient) -> None:
    """A valid UUID sent by the client is echoed back."""
    import uuid

    sent_id = str(uuid.uuid4())
    resp = await client.get("/", headers={"X-Request-ID": sent_id})
    assert resp.headers["X-Request-ID"] == sent_id


@pytest.mark.anyio
async def test_request_id_replaced_when_invalid(client: httpx.AsyncClient) -> None:
    """An invalid X-Request-ID is replaced with a new UUID."""
    import uuid

    resp = await client.get("/", headers={"X-Request-ID": "not-a-uuid"})
    rid = resp.headers["X-Request-ID"]
    assert rid != "not-a-uuid"
    uuid.UUID(rid)  # must be valid
