"""
routers/image.py
POST /image/analyze — Gemini vision analysis of patient images.

Accepts an uploaded image, validates format and size, detects MIME type from actual
magic bytes, and queries Gemini vision for visible findings (location, appearance,
uncertainty) without diagnosing.
"""

import logging
import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
MAX_IMAGE_SIZE_BYTES: int = int(os.getenv("MAX_IMAGE_SIZE_MB", "10")) * 1024 * 1024

SUPPORTED_MIME_TYPES: set[str] = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/heic",
}

# ---------------------------------------------------------------------------
# MIME Sniffing via File Magic Bytes
# ---------------------------------------------------------------------------


def detect_image_mime(data: bytes) -> str | None:
    """Determine image MIME type by inspecting leading magic bytes."""
    if len(data) < 4:
        return None
    # JPEG: starts with FF D8 FF
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    # PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    # GIF: GIF87a or GIF89a
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    # WEBP: RIFF....WEBP
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    # BMP: starts with BM
    if data.startswith(b"BM"):
        return "image/bmp"
    # TIFF: II*\x00 (little-endian) or MM\x00* (big-endian)
    if data.startswith(b"II*\x00") or data.startswith(b"MM\x00*"):
        return "image/tiff"
    # HEIC / HEIF / ISO Base Media File Format
    if len(data) >= 12 and data[4:8] == b"ftyp":
        major_brand = data[8:12].lower()
        if major_brand in (b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"):
            return "image/heic"
    return None


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

VISION_SYSTEM_PROMPT = """
You are an AI assistant supporting emergency medical personnel.
Describe ONLY what is visibly observable in the image.

Strict guidelines:
- Detail observable physical findings: specific anatomical locations, visual appearance (e.g. lacerations, bleeding, burns, swelling, bruising, discoloration, posture, visible objects).
- Explicitly note any visual uncertainty caused by camera angle, obstruction, blur, or lighting conditions.
- Do NOT provide a medical diagnosis of underlying disease or internal trauma.
- Do NOT make definitive assertions of injury severity.
- If no patient or visible physical findings are present, state that fact clearly.
- Maintain a concise, objective clinical observational tone.
""".strip()

VISION_USER_PROMPT = (
    "Please describe the visible physical findings in this patient image. "
    "Identify the anatomical location, observable visual appearance of any injuries or marks, "
    "and any points of uncertainty. Do not provide a diagnosis."
)

# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class DebugInfo(BaseModel):
    detected_mime_type: str
    file_size_bytes: int
    configured_model: str
    model_used: str
    model_returned_text: bool


class ImageAnalysisResponse(BaseModel):
    status: str
    image_description: str
    uncertainty_notes: str
    requires_clinical_review: bool
    model_used: str
    debug: DebugInfo | None = None


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/image", tags=["Image Analysis"])


def _get_gemini_client() -> genai.Client:
    """Return an authenticated Gemini client; raise HTTP 503 if API key is missing."""
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        logger.error("Gemini API call failed: GEMINI_API_KEY is not configured.")
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured. Set GEMINI_API_KEY in .env.",
        )
    return genai.Client(api_key=key)


@router.post(
    "/analyze",
    response_model=ImageAnalysisResponse,
    summary="Analyze a patient image with Gemini vision",
    description=(
        "Upload a patient image taken by an ambulance helper. "
        "Gemini describes visible findings only (anatomical location, visual appearance, "
        "observable marks, uncertainty) without diagnosing. "
        "Returns HTTP 200 with structured JSON, or explicit error codes on failures."
    ),
)
async def analyze_image(
    file: Annotated[
        UploadFile,
        File(description="Patient image (JPEG, PNG, WEBP, GIF, BMP, HEIC, TIFF). Max 10 MB."),
    ],
    debug: Annotated[
        bool,
        Query(description="Temporary debug flag: returns MIME type, size, model, and text-check metadata without sensitive data."),
    ] = False,
) -> ImageAnalysisResponse:
    # ------------------------------------------------------------------
    # 1. Read bytes directly from uploaded file
    # ------------------------------------------------------------------
    try:
        image_bytes: bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded image bytes: %s", type(exc).__name__)
        raise HTTPException(status_code=400, detail="Failed to read uploaded image file.") from exc

    file_size = len(image_bytes)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")

    if file_size > MAX_IMAGE_SIZE_BYTES:
        max_mb = MAX_IMAGE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the maximum allowed size of {max_mb} MB.",
        )

    # ------------------------------------------------------------------
    # 2. Determine and validate image MIME type from actual file content
    # ------------------------------------------------------------------
    detected_mime = detect_image_mime(image_bytes)
    if not detected_mime or detected_mime not in SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported or unrecognized image content. "
                f"Supported types: {', '.join(sorted(SUPPORTED_MIME_TYPES))}."
            ),
        )

    # ------------------------------------------------------------------
    # 3. Model selection & Gemini client initialization
    # ------------------------------------------------------------------
    client = _get_gemini_client()
    configured_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite").strip()
    model_to_use = configured_model

    image_part = genai_types.Part.from_bytes(
        data=image_bytes,
        mime_type=detected_mime,
    )

    generate_config = genai_types.GenerateContentConfig(
        system_instruction=VISION_SYSTEM_PROMPT,
        safety_settings=[
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE,
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE,
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE,
            ),
            genai_types.SafetySetting(
                category=genai_types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=genai_types.HarmBlockThreshold.BLOCK_NONE,
            ),
        ],
    )

    contents = [
        image_part,
        genai_types.Part.from_text(text=VISION_USER_PROMPT),
    ]

    # ------------------------------------------------------------------
    # 4. Call Gemini vision API with targeted error handling
    # ------------------------------------------------------------------
    response = None
    try:
        response = client.models.generate_content(
            model=model_to_use,
            contents=contents,
            config=generate_config,
        )
    except genai_errors.APIError as exc:
        # Check if configured model cannot be accessed by this account (404 / unavailable)
        if (
            configured_model == "gemini-2.5-flash-lite"
            and (exc.code == 404 or "not available" in str(exc.message).lower())
        ):
            logger.warning(
                "Configured model '%s' is unavailable for this account. Falling back to 'gemini-3.5-flash-lite'.",
                configured_model,
            )
            model_to_use = "gemini-3.5-flash-lite"
            try:
                response = client.models.generate_content(
                    model=model_to_use,
                    contents=contents,
                    config=generate_config,
                )
            except genai_errors.APIError as sub_exc:
                _handle_gemini_api_error(sub_exc, model_to_use)
            except Exception as sub_exc:
                logger.error("Gemini API call failed with unexpected error [%s]", type(sub_exc).__name__)
                raise HTTPException(
                    status_code=502,
                    detail=f"Gemini vision API request failed: {type(sub_exc).__name__}.",
                ) from sub_exc
        else:
            _handle_gemini_api_error(exc, model_to_use)
    except TimeoutError as exc:
        logger.error("Gemini vision request timed out.")
        raise HTTPException(
            status_code=504,
            detail="Gemini vision request timed out.",
        ) from exc
    except Exception as exc:
        logger.error("Gemini API call failed with unexpected exception [%s]", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail=f"Gemini vision API request failed: {type(exc).__name__}.",
        ) from exc

    # ------------------------------------------------------------------
    # 5. Validate model response text — DO NOT fabricate generic success
    # ------------------------------------------------------------------
    raw_text = None
    if response:
        try:
            if hasattr(response, "text") and response.text:
                raw_text = response.text.strip()
        except Exception:
            raw_text = None

        # Inspect candidate parts if top-level text is empty
        if not raw_text and getattr(response, "candidates", None):
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    candidate_parts = [
                        p.text for p in candidate.content.parts if getattr(p, "text", None)
                    ]
                    candidate_text = "".join(candidate_parts).strip()
                    if candidate_text:
                        raw_text = candidate_text
                        break

    if not raw_text:
        # Identify block or finish reason for clean error reporting
        block_detail = "Empty response received from vision model."
        if getattr(response, "prompt_feedback", None) and getattr(response.prompt_feedback, "block_reason", None):
            block_detail = f"Content blocked by vision provider (reason: {response.prompt_feedback.block_reason})."
        elif getattr(response, "candidates", None) and response.candidates:
            c = response.candidates[0]
            if getattr(c, "finish_reason", None):
                block_detail = f"Model generation halted without text (finish reason: {c.finish_reason})."

        logger.error("Gemini image analysis produced no usable text for model %s: %s", model_to_use, block_detail)
        raise HTTPException(
            status_code=502,
            detail=f"Gemini vision processing error: {block_detail}",
        )

    # ------------------------------------------------------------------
    # 6. Assemble structured output
    # ------------------------------------------------------------------
    urgent_keywords = (
        "urgent", "bleeding", "unconscious", "unresponsive", "severe",
        "critical", "laceration", "wound", "burn", "cyanosis", "fracture",
    )
    requires_review = any(kw in raw_text.lower() for kw in urgent_keywords)

    uncertainty_notes = (
        "AI image analysis describes observable findings only. "
        "This output does not constitute a medical diagnosis. "
        "All findings must be reviewed by qualified clinical personnel."
    )

    debug_data = None
    if debug:
        debug_data = DebugInfo(
            detected_mime_type=detected_mime,
            file_size_bytes=file_size,
            configured_model=configured_model,
            model_used=model_to_use,
            model_returned_text=True,
        )

    return ImageAnalysisResponse(
        status="success",
        image_description=raw_text,
        uncertainty_notes=uncertainty_notes,
        requires_clinical_review=requires_review,
        model_used=model_to_use,
        debug=debug_data,
    )


# ---------------------------------------------------------------------------
# Error Mapping Helper
# ---------------------------------------------------------------------------


def _handle_gemini_api_error(exc: genai_errors.APIError, model_name: str) -> None:
    """Map Google GenAI API errors to appropriate HTTP status codes without leaking secrets."""
    code = getattr(exc, "code", None)
    msg = str(getattr(exc, "message", exc))

    logger.error("Gemini API error (code=%s, model=%s): %s", code, model_name, msg)

    if code in (401, 403) or "API_KEY_INVALID" in msg:
        raise HTTPException(
            status_code=401,
            detail="Gemini API authentication failed. Verify API key configuration.",
        )
    if code == 429 or "RESOURCE_EXHAUSTED" in msg:
        raise HTTPException(
            status_code=429,
            detail="Gemini API rate limit or quota exceeded. Please retry shortly.",
        )
    if code == 404 or "NOT_FOUND" in msg:
        raise HTTPException(
            status_code=502,
            detail=f"Configured Gemini model '{model_name}' is not found or not accessible.",
        )
    if code == 504 or "DEADLINE_EXCEEDED" in msg:
        raise HTTPException(
            status_code=504,
            detail="Gemini API request timed out.",
        )

    raise HTTPException(
        status_code=502,
        detail=f"Gemini API request failed with status {code}: {msg}",
    )
