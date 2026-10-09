"""FastAPI application entry point.

Start the development server with::

    uvicorn app.main:app --reload

Production (no reload, no debug)::

    uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from app.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import RequestIdMiddleware, setup_logging
from app.core.socket import sio
from app.routers import (
    admin,
    ambulances,
    auth,
    emergencies,
    health,
    hospital_requests,
    hospitals,
)

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup and shutdown lifecycle."""
    settings: Settings = get_settings()
    setup_logging(settings.LOG_LEVEL)
    logger.info(
        "Starting %s (env=%s, debug=%s)",
        settings.APP_NAME,
        settings.APP_ENV,
        settings.DEBUG,
    )

    # Initialise the database engine only when configured.
    if settings.database_is_configured:
        from app.database import init_engine

        init_engine(settings.DATABASE_URL)

    yield  # ← application runs here

    # Shutdown: release database connections.
    from app.database import close_engine

    await close_engine()
    logger.info("Application shutdown complete.")


# ── Application factory ──────────────────────────────────────────


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()

    # In production, disable interactive docs by default.
    docs_url: str | None = "/docs"
    redoc_url: str | None = "/redoc"
    openapi_url: str | None = "/openapi.json"
    if settings.is_production:
        docs_url = None
        redoc_url = None
        openapi_url = None

    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Backend API for the Emergency Response Coordination System.",
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )

    # ── Middleware (order matters: last added = first executed) ──
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=r"^https?://.*$" if not settings.is_production else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(RequestIdMiddleware)

    # ── Exception handlers ──────────────────────────────────────
    register_exception_handlers(application)

    # ── Routers ─────────────────────────────────────────────────
    application.include_router(health.router)
    application.include_router(auth.router, prefix=settings.API_V1_PREFIX)
    application.include_router(hospitals.router, prefix=settings.API_V1_PREFIX)
    application.include_router(ambulances.router, prefix=settings.API_V1_PREFIX)
    application.include_router(emergencies.router, prefix=settings.API_V1_PREFIX)
    application.include_router(hospital_requests.router, prefix=settings.API_V1_PREFIX)
    application.include_router(admin.router, prefix=settings.API_V1_PREFIX)

    # ── Root endpoint ───────────────────────────────────────────
    @application.get(
        "/",
        summary="Root — service identity",
        description="Returns basic information about the running service.",
    )
    async def root() -> dict[str, str]:
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
        }

    # ── robots.txt ──────────────────────────────────────────────
    @application.get(
        "/robots.txt",
        summary="Robots exclusion",
        description="Instructs web crawlers not to index the API.",
        response_class=PlainTextResponse,
    )
    async def robots_txt() -> PlainTextResponse:
        return PlainTextResponse(
            "User-agent: *\nDisallow: /\n",
            media_type="text/plain",
        )

    return application


# The FastAPI application instance
fastapi_app = create_app()

# The global ASGI application instance combining FastAPI and Socket.IO for uvicorn
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")
