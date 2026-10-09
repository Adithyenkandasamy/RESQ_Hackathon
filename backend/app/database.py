"""Async SQLAlchemy database engine and session management.

Uses asyncpg as the PostgreSQL driver.  The engine is created lazily —
importing this module does NOT establish a database connection.

Tables are never auto-created; use Alembic for migrations.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)

# ── Declarative base for future models ───────────────────────────
# This base is used by Alembic's env.py to discover models.
# No business models are defined in Phase 1.


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""


# ── Module-level engine holder (lazy) ────────────────────────────

_engine_instance: Any | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _normalize_database_url(url: str) -> str:
    """Ensure the URL uses a scheme compatible with SQLAlchemy + asyncpg."""
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    elif url.startswith("postgresql+asyncpg://"):
        pass

    # asyncpg handles SSL via connect_args, not as session parameters in query string
    if "postgresql+asyncpg://" in url and ("ssl=" in url or "sslmode=" in url):
        from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        query_params.pop("ssl", None)
        query_params.pop("sslmode", None)
        new_query = urlencode(query_params, doseq=True)
        url = urlunparse(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment,
            )
        )

    return url


def _build_connect_args(url: str) -> dict[str, Any]:
    """Build SSL / connect args appropriate for the database URL."""
    import ssl as _ssl

    connect_args: dict[str, Any] = {}
    if "ssl=require" in url or "sslmode=require" in url or "aivencloud.com" in url:
        ssl_ctx = _ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = _ssl.CERT_NONE
        connect_args["ssl"] = ssl_ctx
    return connect_args


def init_engine(database_url: str) -> None:
    """Create the async engine and session factory.

    Must be called once during application startup (not at import time).
    """
    global _engine_instance, _session_factory  # noqa: PLW0603

    if _engine_instance is not None:
        logger.warning("Database engine already initialised — skipping.")
        return

    normalized = _normalize_database_url(database_url)
    connect_args = _build_connect_args(normalized)

    # Mask credentials before logging.
    safe_url = normalized.split("@")[-1] if "@" in normalized else "(no host)"
    logger.info("Creating database engine -> %s", safe_url)

    _engine_instance = create_async_engine(
        normalized,
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args=connect_args,
    )
    _session_factory = async_sessionmaker(
        bind=_engine_instance,
        expire_on_commit=False,
    )


async def close_engine() -> None:
    """Dispose of the engine and release all pooled connections."""
    global _engine_instance, _session_factory  # noqa: PLW0603
    if _engine_instance is not None:
        await _engine_instance.dispose()
        _engine_instance = None
        _session_factory = None
        logger.info("Database engine disposed.")


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session.

    The session is automatically closed when the request finishes.
    Raises ``RuntimeError`` if the engine has not been initialised.
    """
    if _session_factory is None:
        raise RuntimeError("Database engine has not been initialised.")

    async with _session_factory() as session:
        yield session


async def check_connection() -> bool:
    """Execute a lightweight query to verify database connectivity.

    Returns ``True`` if the database responds, ``False`` otherwise.
    Never exposes the exception to callers.
    """
    if _engine_instance is None:
        return False
    try:
        from sqlalchemy import text

        async with _engine_instance.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Database connectivity check failed")
        return False
