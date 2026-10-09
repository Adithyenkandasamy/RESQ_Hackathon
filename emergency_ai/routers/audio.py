"""
routers/audio.py
POST /audio/transcribe — ElevenLabs Scribe speech-to-text.
POST /audio/speak      — ElevenLabs TTS using voice ID 5klqvwuBHYwcS99jLmDR.

This router does NOT generate or modify medical instructions.
Text-to-speech is used solely to vocalise precaution text supplied by the LLM router.
"""

import logging
import os
from typing import Annotated

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Body, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_STT_MODEL: str = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2")
ELEVENLABS_TTS_MODEL: str = os.getenv("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "5klqvwuBHYwcS99jLmDR")
MAX_AUDIO_SIZE_BYTES: int = int(os.getenv("MAX_AUDIO_SIZE_MB", "20")) * 1024 * 1024

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

ALLOWED_AUDIO_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/ogg",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/flac",
    "audio/aac",
}

# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class TranscriptionResponse(BaseModel):
    status: str
    transcript: str
    language_detected: str | None
    model_used: str
    disclaimer: str


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _elevenlabs_headers() -> dict[str, str]:
    if not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs API key is not configured. Set ELEVENLABS_API_KEY in .env.",
        )
    return {"xi-api-key": ELEVENLABS_API_KEY}


def _extract_elevenlabs_error_message(resp: httpx.Response) -> str:
    """Extract descriptive error message from ElevenLabs JSON responses."""
    try:
        data = resp.json()
        detail = data.get("detail", {})
        if isinstance(detail, dict):
            return detail.get("message") or str(detail)
        elif isinstance(detail, str):
            return detail
    except Exception:
        pass
    return f"Status {resp.status_code}"



# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/audio", tags=["Audio Processing"])


# ── Transcription ──────────────────────────────────────────────────────────


@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    summary="Transcribe helper audio recording via ElevenLabs Scribe",
    description=(
        "Upload the ambulance helper's audio recording. "
        "ElevenLabs Scribe converts it to text. "
        "The transcript preserves the original meaning and distinguishes "
        "reported observations from confirmed findings."
    ),
)
async def transcribe_audio(
    file: Annotated[
        UploadFile,
        File(
            description=(
                "Audio recording (MP3, WAV, OGG, WEBM, MP4/M4A, FLAC, AAC). Max 20 MB."
            )
        ),
    ],
) -> TranscriptionResponse:
    # ------------------------------------------------------------------
    # 1. Validate MIME type with filename fallback
    # ------------------------------------------------------------------
    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()

    if content_type not in ALLOWED_AUDIO_MIME_TYPES:
        if filename.endswith((".mp3", ".mpeg")):
            content_type = "audio/mpeg"
        elif filename.endswith(".wav"):
            content_type = "audio/wav"
        elif filename.endswith(".ogg"):
            content_type = "audio/ogg"
        elif filename.endswith(".webm"):
            content_type = "audio/webm"
        elif filename.endswith((".m4a", ".mp4")):
            content_type = "audio/mp4"
        elif filename.endswith(".flac"):
            content_type = "audio/flac"
        elif filename.endswith(".aac"):
            content_type = "audio/aac"
        else:
            raise HTTPException(
                status_code=415,
                detail=(
                    f"Unsupported audio format '{content_type}'. "
                    f"Allowed: {', '.join(sorted(ALLOWED_AUDIO_MIME_TYPES))}."
                ),
            )

    # ------------------------------------------------------------------
    # 2. Read and validate file size
    # ------------------------------------------------------------------
    audio_bytes: bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")
    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        max_mb = MAX_AUDIO_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Audio file exceeds the maximum allowed size of {max_mb} MB.",
        )

    # ------------------------------------------------------------------
    # 3. Call ElevenLabs Scribe STT
    # ------------------------------------------------------------------
    headers = _elevenlabs_headers()
    files_payload = {
        "file": (file.filename or "audio.mp3", audio_bytes, content_type),
    }
    data_payload = {
        "model_id": ELEVENLABS_STT_MODEL,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{ELEVENLABS_BASE_URL}/speech-to-text",
                headers=headers,
                files=files_payload,
                data=data_payload,
            )
    except httpx.RequestError as exc:
        logger.error("ElevenLabs STT network error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=504,
            detail="Network error or timeout contacting ElevenLabs STT API.",
        ) from exc

    if resp.status_code in (401, 403):
        msg = _extract_elevenlabs_error_message(resp)
        logger.error("ElevenLabs authentication/permission error: %s", msg)
        raise HTTPException(
            status_code=401,
            detail=f"ElevenLabs authentication error: {msg}",
        )

    if resp.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="ElevenLabs STT rate limit or quota reached. Please retry shortly.",
        )

    if resp.status_code != 200:
        msg = _extract_elevenlabs_error_message(resp)
        logger.error("ElevenLabs STT error %s: %s", resp.status_code, msg)
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs STT API error (status {resp.status_code}): {msg}",
        )

    result = resp.json()
    transcript: str = result.get("text", "").strip()
    if not transcript:
        raise HTTPException(
            status_code=502,
            detail="ElevenLabs STT returned an empty transcript. Audio may be inaudible or unsupported.",
        )

    language_detected: str | None = result.get("language_code") or result.get("language")

    return TranscriptionResponse(
        status="success",
        transcript=transcript,
        language_detected=language_detected,
        model_used=ELEVENLABS_STT_MODEL,
        disclaimer=(
            "This transcript reflects the ambulance helper's verbal report. "
            "Reported observations have not been clinically confirmed. "
            "All information requires review by qualified medical personnel."
        ),
    )


class SpeakRequest(BaseModel):
    precaution_text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Plain-language first-aid precaution text from the LLM router.",
        json_schema_extra={
            "example": "Apply firm, direct pressure to the wound using a clean cloth. Keep the patient still and await the ambulance."
        },
    )


# ── Text-to-speech ─────────────────────────────────────────────────────────


@router.post(
    "/speak",
    response_class=Response,
    summary="Convert first-aid precaution text to speech via ElevenLabs TTS",
    description=(
        "Submit precaution text generated by the LLM router. "
        "ElevenLabs TTS converts it to audio using voice ID 5klqvwuBHYwcS99jLmDR. "
        "Returns audio/mpeg binary. "
        "This endpoint does NOT generate or modify medical instructions."
    ),
    responses={
        200: {
            "content": {"audio/mpeg": {}},
            "description": "MP3 audio of the precaution text.",
        },
        400: {"description": "Invalid or empty precaution text."},
        429: {"description": "ElevenLabs rate limit reached."},
        502: {"description": "ElevenLabs TTS API error."},
        503: {"description": "ElevenLabs API key not configured."},
    },
)
async def speak_precautions(request: SpeakRequest) -> Response:
    # ------------------------------------------------------------------
    # 1. Basic input validation
    # ------------------------------------------------------------------
    text = request.precaution_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="precaution_text must not be empty.")

    # ------------------------------------------------------------------
    # 2. Call ElevenLabs TTS
    # ------------------------------------------------------------------
    headers = _elevenlabs_headers()
    headers["Content-Type"] = "application/json"
    headers["Accept"] = "audio/mpeg"

    payload = {
        "text": text,
        "model_id": ELEVENLABS_TTS_MODEL,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }

    tts_url = f"{ELEVENLABS_BASE_URL}/text-to-speech/{ELEVENLABS_VOICE_ID}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(tts_url, headers=headers, json=payload)
    except httpx.RequestError as exc:
        logger.error("ElevenLabs TTS network error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=504,
            detail="Network error or timeout contacting ElevenLabs TTS API.",
        ) from exc

    if resp.status_code in (401, 403):
        msg = _extract_elevenlabs_error_message(resp)
        logger.error("ElevenLabs TTS auth/permission error: %s", msg)
        raise HTTPException(
            status_code=401,
            detail=f"ElevenLabs authentication error: {msg}",
        )

    if resp.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="ElevenLabs TTS rate limit or quota reached. Please retry shortly.",
        )

    if resp.status_code != 200:
        msg = _extract_elevenlabs_error_message(resp)
        logger.error("ElevenLabs TTS error %s: %s", resp.status_code, msg)
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs TTS API error (status {resp.status_code}): {msg}",
        )

    audio_content = resp.content
    if not audio_content:
        raise HTTPException(
            status_code=502,
            detail="ElevenLabs TTS returned empty audio. Generation failed.",
        )

    return Response(
        content=audio_content,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": 'attachment; filename="precautions.mp3"',
            "X-Voice-ID": ELEVENLABS_VOICE_ID,
            "X-TTS-Model": ELEVENLABS_TTS_MODEL,
        },
    )
