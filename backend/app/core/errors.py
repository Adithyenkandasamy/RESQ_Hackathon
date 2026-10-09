"""Centralized exception handlers for the FastAPI application.

All error responses use the standard envelope::

    {
        "error": {
            "code": "ERROR_CODE",
            "message": "Human-readable message.",
            "request_id": "uuid"
        }
    }

In production, internal details and stack traces are never exposed.
Diagnostic information is logged server-side.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

from app.core.logging import build_error_body, get_current_request_id

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the FastAPI application."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        """Handle standard HTTP exceptions (404, 403, etc.)."""
        code = _status_to_code(exc.status_code)
        return JSONResponse(
            status_code=exc.status_code,
            content=build_error_body(code, str(exc.detail)),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Handle Pydantic request-validation errors.

        Returns a 422 with a safe description of which fields failed.
        Full details are logged server-side but not sent to the client.
        """
        logger.warning("Validation error [%s]: %s", get_current_request_id(), exc.errors())
        # Build a list of field-level messages safe for the client.
        details = []
        for err in exc.errors():
            loc = " → ".join(str(part) for part in err.get("loc", []))
            details.append(f"{loc}: {err.get('msg', 'invalid')}")

        return JSONResponse(
            status_code=422,
            content=build_error_body(
                "VALIDATION_ERROR",
                "Request validation failed.",
            )
            | {"details": details},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Catch-all for unexpected errors.

        Logs the full traceback but returns a safe 500 to the client.
        """
        logger.exception("Unhandled exception [%s]: %s", get_current_request_id(), exc)
        return JSONResponse(
            status_code=500,
            content=build_error_body(
                "INTERNAL_ERROR",
                "An unexpected error occurred. Please try again later.",
            ),
        )


# ── Helpers ──────────────────────────────────────────────────────

_STATUS_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


def _status_to_code(status: int) -> str:
    return _STATUS_CODES.get(status, f"HTTP_{status}")
