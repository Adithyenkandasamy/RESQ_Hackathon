"""Tests for centralized error handling."""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI


@pytest.mark.anyio
async def test_404_returns_standard_error_format(client: httpx.AsyncClient) -> None:
    """A request to a nonexistent path returns the standard error envelope."""
    resp = await client.get("/nonexistent/path")
    assert resp.status_code == 404
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"
    assert "request_id" in data["error"]


@pytest.mark.anyio
async def test_validation_error_returns_422(app: FastAPI, client: httpx.AsyncClient) -> None:
    """A request with invalid query params triggers a 422 validation error."""
    from fastapi import Query

    # Add a temporary route that requires a typed query param.
    @app.get("/test-validation")
    async def _needs_int(value: int = Query(...)) -> dict[str, int]:
        return {"value": value}

    resp = await client.get("/test-validation?value=not_a_number")
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "request_id" in data["error"]


@pytest.mark.anyio
async def test_unhandled_exception_returns_safe_500(
    app: FastAPI, client: httpx.AsyncClient
) -> None:
    """An unhandled exception returns a generic 500 — no stack trace."""

    @app.get("/test-crash")
    async def _crash() -> None:
        raise RuntimeError("SECRET_DB_PASSWORD_LEAK")

    resp = await client.get("/test-crash")
    assert resp.status_code == 500
    data = resp.json()
    assert data["error"]["code"] == "INTERNAL_ERROR"
    # The secret must NOT appear in the response body.
    assert "SECRET_DB_PASSWORD_LEAK" not in resp.text
    assert "request_id" in data["error"]


@pytest.mark.anyio
async def test_robots_txt_content_type(client: httpx.AsyncClient) -> None:
    """GET /robots.txt returns text/plain with disallow-all."""
    resp = await client.get("/robots.txt")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "Disallow: /" in resp.text
