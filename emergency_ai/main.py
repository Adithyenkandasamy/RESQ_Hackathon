"""
main.py — Emergency AI Module
FastAPI application entry-point.

Registers three routers:
  /image  — Gemini vision analysis
  /audio  — ElevenLabs STT transcription + TTS speech
  /llm    — Grok hospital handover summary + helper precautions

Run:
    uvicorn main:app --reload --port 8000

Swagger UI:
    http://127.0.0.1:8000/docs
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load .env before importing routers so env vars are available at module level
load_dotenv()

from routers import audio, image, llm  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    """Log configuration summary on startup (no secrets logged)."""
    logger.info("=== Emergency AI Module starting up ===")
    logger.info("Gemini model   : %s", os.getenv("GEMINI_MODEL", "NOT SET"))
    logger.info("ElevenLabs STT : %s", os.getenv("ELEVENLABS_STT_MODEL", "NOT SET"))
    logger.info("ElevenLabs TTS : %s", os.getenv("ELEVENLABS_TTS_MODEL", "NOT SET"))
    logger.info("ElevenLabs voice ID : %s", os.getenv("ELEVENLABS_VOICE_ID", "NOT SET"))
    logger.info("xAI model      : %s", os.getenv("XAI_MODEL", "NOT SET"))
    logger.info(
        "GEMINI_API_KEY  : %s",
        "configured" if os.getenv("GEMINI_API_KEY") else "MISSING",
    )
    logger.info(
        "ELEVENLABS_API_KEY : %s",
        "configured" if os.getenv("ELEVENLABS_API_KEY") else "MISSING",
    )
    logger.info(
        "XAI_API_KEY     : %s",
        "configured" if os.getenv("XAI_API_KEY") else "MISSING",
    )
    logger.info("Max image size : %s MB", os.getenv("MAX_IMAGE_SIZE_MB", "10"))
    logger.info("Max audio size : %s MB", os.getenv("MAX_AUDIO_SIZE_MB", "20"))
    logger.info("Swagger UI     : http://127.0.0.1:8000/docs")
    logger.info("=======================================")
    yield
    logger.info("=== Emergency AI Module shutting down ===")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Emergency AI Module",
    description=(
        "AI-powered FastAPI service for ambulance and hospital emergency management.\n\n"
        "**Three processing modules:**\n"
        "- **Image analysis** — Gemini vision (visible findings only, no diagnoses)\n"
        "- **Audio processing** — ElevenLabs Scribe STT + TTS\n"
        "- **LLM processing** — Grok hospital handover summary + helper precautions\n\n"
        "**Typical workflow:**\n"
        "1. Upload patient image → `POST /image/analyze`\n"
        "2. Upload audio recording → `POST /audio/transcribe`\n"
        "3. Send all findings → `POST /llm/summary` → receive hospital summary + precautions text\n"
        "4. Send precautions text → `POST /audio/speak` → receive MP3 for helper playback\n\n"
        "> ⚠️ All AI outputs require clinical review. "
        "Do not rely solely on this module for clinical decision-making."
    ),
    version="1.0.0",
    contact={
        "name": "resQ Emergency Management",
    },
    license_info={
        "name": "Proprietary",
    },
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS (restrict in production to your frontend domain)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(image.router)
app.include_router(audio.router)
app.include_router(llm.router)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str
    version: str
    endpoints: dict[str, str]
    api_keys_configured: dict[str, bool]


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Service liveness check",
    description="Returns service status and a summary of API key configuration (no key values).",
)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        service="Emergency AI Module",
        version="1.0.0",
        endpoints={
            "image_analyze": "POST /image/analyze",
            "audio_transcribe": "POST /audio/transcribe",
            "audio_speak": "POST /audio/speak",
            "llm_summary": "POST /llm/summary",
            "health": "GET /health",
            "docs": "GET /docs",
        },
        api_keys_configured={
            "gemini": bool(os.getenv("GEMINI_API_KEY")),
            "elevenlabs": bool(os.getenv("ELEVENLABS_API_KEY")),
            "xai_grok": bool(os.getenv("XAI_API_KEY")),
        },
    )
