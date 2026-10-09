"""Structured logging and request-ID middleware.

Request IDs
-----------
Every incoming request is assigned a UUID request ID:

* If the client sends ``X-Request-ID`` and it is a valid UUID,
  that value is reused.
* Otherwise a new UUID4 is generated.
* The ID is returned in the ``X-Request-ID`` response header.
* The ID is attached to all log records emitted during the request.

Sensitive data (passwords, tokens, patient info) is never logged.
Health-check endpoints are logged at DEBUG to avoid noise.
"""

from __future__ import annotations

# ── Context var for the current request ID ───────────────────────
import contextvars
import logging
import sys
import uuid
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

# Paths that are logged at DEBUG level to avoid noise.
_QUIET_PATHS = frozenset({"/health/live", "/health/ready", "/robots.txt"})

REQUEST_ID_HEADER = "X-Request-ID"


# ── Log formatter ────────────────────────────────────────────────


class RequestIdFilter(logging.Filter):
    """Inject the current request ID into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get("-")  # noqa: B009
        return True


def setup_logging(level: str = "INFO") -> None:
    """Configure the root logger with a structured format."""
    fmt = "%(asctime)s | %(levelname)-8s | %(request_id)s | %(name)s | %(message)s"
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt))
    handler.addFilter(RequestIdFilter())

    root = logging.getLogger()
    root.setLevel(level.upper())
    # Remove any pre-existing handlers to avoid duplicate output.
    root.handlers.clear()
    root.addHandler(handler)


# ── Middleware ───────────────────────────────────────────────────


def _is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach a request ID to every request/response cycle."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Accept or generate request ID.
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        rid = incoming if _is_valid_uuid(incoming) else str(uuid.uuid4())
        request_id_ctx.set(rid)

        # Determine log level — quiet for health checks.
        log_level = logging.DEBUG if request.url.path in _QUIET_PATHS else logging.INFO

        logger = logging.getLogger("app.request")
        logger.log(log_level, "%s %s", request.method, request.url.path)

        try:
            response: Response = await call_next(request)
        except Exception:
            # Unhandled exception — build a safe 500 response here so the
            # request ID header is still attached.  The exception is logged
            # but NOT exposed to the client.
            logger.exception("Unhandled exception during %s %s", request.method, request.url.path)
            from starlette.responses import JSONResponse

            response = JSONResponse(
                status_code=500,
                content=build_error_body(
                    "INTERNAL_ERROR",
                    "An unexpected error occurred. Please try again later.",
                    request_id=rid,
                ),
            )

        response.headers[REQUEST_ID_HEADER] = rid
        logger.log(
            log_level,
            "%s %s → %s",
            request.method,
            request.url.path,
            response.status_code,
        )
        return response


def get_current_request_id() -> str:
    """Return the current request ID (or ``'-'`` outside a request)."""
    return request_id_ctx.get("-")


def build_error_body(code: str, message: str, request_id: str | None = None) -> dict[str, Any]:
    """Build the standard error response envelope.

    ``request_id`` is auto-detected from context when omitted.
    """
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id or get_current_request_id(),
        }
    }
