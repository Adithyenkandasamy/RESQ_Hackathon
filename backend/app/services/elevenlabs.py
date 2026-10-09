"""ElevenLabs speech-to-text integration for emergency audio transcription."""

from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".aac"}
ALLOWED_CONTENT_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/m4a",
    "audio/x-m4a",
    "audio/mp4",
    "audio/ogg",
    "audio/webm",
    "audio/flac",
    "audio/aac",
    "application/octet-stream",
}


def validate_audio_file(filename: str, content_type: str, file_size: int) -> None:
    """Validate upload filename extension, content type, and size."""
    settings = get_settings()

    if file_size > settings.MAX_AUDIO_UPLOAD_BYTES:
        max_mb = settings.MAX_AUDIO_UPLOAD_BYTES // (1024 * 1024)
        raise ValueError(f"Uploaded audio file exceeds maximum allowed size of {max_mb} MB.")

    import os

    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise ValueError(
            f"Unsupported audio file format '{ext}'. Allowed extensions: {sorted(ALLOWED_AUDIO_EXTENSIONS)}"
        )

    if content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Unsupported audio MIME type '{content_type}'.")


async def transcribe_audio_file(
    audio_bytes: bytes, filename: str, content_type: str
) -> dict[str, Any]:
    """Send audio bytes to ElevenLabs Speech-to-Text API and return transcription metadata.

    If the API key is not configured, provides a safe diagnostic response without crashing.
    """
    settings = get_settings()
    api_key = settings.ELEVENLABS_API_KEY.strip()

    if not api_key:
        logger.warning("ElevenLabs transcription skipped: ELEVENLABS_API_KEY is not configured.")
        return {
            "transcription_id": str(uuid.uuid4()),
            "transcript": "[Transcription service unavailable: API key not configured]",
            "language": "en",
            "processing_status": "SKIPPED_NO_API_KEY",
        }

    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {"xi-api-key": api_key}
    files = {"file": (filename, audio_bytes, content_type)}
    data = {"model_id": settings.ELEVENLABS_TRANSCRIPTION_MODEL}

    try:
        async with httpx.AsyncClient(timeout=settings.AI_REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, files=files, data=data)

        if response.status_code != 200:
            logger.error("ElevenLabs API error (%s): %s", response.status_code, response.text)
            return {
                "transcription_id": str(uuid.uuid4()),
                "transcript": "[Transcription error: provider returned error response]",
                "language": None,
                "processing_status": "PROVIDER_ERROR",
            }

        resp_data = response.json()
        transcript = resp_data.get("text", "")
        language = resp_data.get("language_code", "en")

        return {
            "transcription_id": str(uuid.uuid4()),
            "transcript": transcript,
            "language": language,
            "processing_status": "COMPLETED",
        }

    except httpx.TimeoutException:
        logger.warning("ElevenLabs transcription request timed out.")
        return {
            "transcription_id": str(uuid.uuid4()),
            "transcript": "[Transcription error: provider request timed out]",
            "language": None,
            "processing_status": "TIMEOUT",
        }
    except Exception as exc:
        logger.exception("Unexpected error during ElevenLabs transcription: %s", exc)
        return {
            "transcription_id": str(uuid.uuid4()),
            "transcript": "[Transcription error: internal provider communication failure]",
            "language": None,
            "processing_status": "FAILED",
        }
