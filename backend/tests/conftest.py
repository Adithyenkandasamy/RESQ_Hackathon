"""Pytest configuration and shared test fixtures.

All tests run without a real database.  The ``test_client`` fixture
provides an ``httpx.AsyncClient`` connected to the FastAPI test app.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import FastAPI

from app.main import create_app


@pytest.fixture
def settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set minimal environment variables for testing.

    DATABASE_URL is left empty so no real DB connection is attempted.
    """
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")


@pytest.fixture
def app(settings_env: None) -> FastAPI:
    """Create a fresh FastAPI application for each test."""
    return create_app()


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    """Async test client connected to the test application."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


@pytest.fixture
def mock_db_check_ok() -> Any:
    """Patch database.check_connection to return True."""
    with patch("app.routers.health.database.check_connection", new_callable=AsyncMock) as m:
        m.return_value = True
        yield m


@pytest.fixture
def mock_db_check_fail() -> Any:
    """Patch database.check_connection to return False."""
    with patch("app.routers.health.database.check_connection", new_callable=AsyncMock) as m:
        m.return_value = False
        yield m
