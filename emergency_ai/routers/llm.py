"""
routers/llm.py
POST /llm/summary — Grok (xAI) / OpenAI-compatible LLM hospital handover summary + helper precautions.

Accepts patient details, image descriptions, transcripts, and vitals.
Returns two distinct outputs:
  - hospital_summary  : structured clinical handover note
  - helper_precautions: plain-language first-aid guidance for speech playback

The LLM does NOT invent diagnoses or treatments beyond the approved guidance library.
"""

import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Ensure root .env is loaded reliably regardless of working directory
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Clinician-approved first-aid guidance library
# Each entry is a concise, evidence-based precaution for ambulance helpers.
# The LLM selects relevant items; it cannot add new entries.
# ---------------------------------------------------------------------------

FIRST_AID_GUIDANCE_LIBRARY = """
APPROVED FIRST-AID PRECAUTIONS (select only relevant items):

GENERAL SAFETY:
- Do not move the patient unless they are in immediate danger.
- Keep the patient warm and still. Reassure them calmly.
- Do not give the patient food or water.
- Stay with the patient until the ambulance crew takes over.

AIRWAY / BREATHING:
- If unconscious and breathing, place in recovery position (on their side).
- If not breathing and you are trained, begin CPR (30 compressions, 2 breaths).
- Keep the airway clear; remove visible obstructions only if safe to do so.
- Do not tilt the neck if a spinal injury is suspected.

BLEEDING:
- Apply firm, direct pressure to the wound using a clean cloth or dressing.
- Do not remove an embedded object; press around it.
- Elevate a bleeding limb if no fracture is suspected.

SUSPECTED FRACTURE:
- Do not straighten or reposition a deformed limb.
- Support and immobilise the limb in the position found.
- Warn the patient not to bear weight.

HEAD / SPINAL INJURY:
- Keep the patient's head and neck still; do not allow them to sit up or move.
- If a helmet is worn, do not remove it.

BURNS:
- Cool the burn with cool (not cold) running water for at least 10 minutes.
- Do not apply ice, butter, or any home remedy.
- Cover loosely with a clean non-fluffy material.

SHOCK:
- Lay the patient flat and raise their legs approximately 30 cm if no injury prevents it.
- Keep them warm. Do not give fluids.

CHOKING (conscious):
- Encourage strong coughing. If ineffective, deliver up to 5 back blows between shoulder blades.
- Alternate with up to 5 abdominal thrusts if trained.

ALWAYS:
- Follow instructions from emergency dispatch.
- Defer to the ambulance crew on arrival.
- If uncertain, do nothing harmful and await professional guidance.
""".strip()

# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class VitalSigns(BaseModel):
    heart_rate_bpm: int | None = Field(None, description="Heart rate in beats per minute.")
    blood_pressure_mmhg: str | None = Field(None, description="e.g. '120/80'")
    spo2_percent: float | None = Field(None, description="Oxygen saturation %.")
    respiratory_rate_bpm: int | None = Field(None, description="Breaths per minute.")
    temperature_celsius: float | None = Field(None, description="Body temperature in °C.")
    gcs_score: int | None = Field(None, description="Glasgow Coma Scale (3–15).")


class SummaryRequest(BaseModel):
    patient_name: str | None = Field(None, description="Patient name or identifier.")
    patient_age: int | None = Field(None, description="Patient age in years.")
    patient_sex: str | None = Field(None, description="Patient sex (optional).")
    incident_description: str | None = Field(
        None,
        description="Brief description of the incident provided by the helper.",
        max_length=2000,
    )
    image_description: str | None = Field(
        None,
        description="Visible findings from Gemini image analysis.",
        max_length=4000,
    )
    audio_transcript: str | None = Field(
        None,
        description="Transcript of the helper's audio recording from ElevenLabs.",
        max_length=4000,
    )
    vital_signs: VitalSigns | None = Field(None, description="Available vital signs.")
    known_allergies: str | None = Field(None, description="Known allergies, if any.")
    known_medications: str | None = Field(None, description="Current medications, if known.")


class SummaryResponse(BaseModel):
    status: str
    hospital_summary: str
    helper_precautions: str
    missing_information: list[str]
    requires_clinical_review: bool
    model_used: str
    disclaimer: str


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/llm", tags=["LLM Processing"])


def _get_llm_config() -> tuple[str, str, str]:
    """
    Return (api_key, model, base_url).
    Supports xAI Grok and Groq endpoints depending on configuration.
    """
    # Re-read environment dynamically
    load_dotenv(dotenv_path=ENV_PATH)
    api_key = os.getenv("XAI_API_KEY", "").strip()
    model = os.getenv("XAI_MODEL", "openai/gpt-oss-120b").strip()
    explicit_base_url = os.getenv("XAI_BASE_URL", "").strip()

    if not api_key:
        logger.error("LLM API key is not configured.")
        raise HTTPException(
            status_code=503,
            detail="LLM API key is not configured. Set XAI_API_KEY in .env.",
        )

    if explicit_base_url:
        base_url = explicit_base_url.rstrip("/")
    elif api_key.startswith("gsk_"):
        # Key format belongs to Groq provider
        base_url = "https://api.groq.com/openai/v1"
    else:
        # Standard xAI Grok endpoint
        base_url = "https://api.x.ai/v1"

    return api_key, model, base_url


def _extract_upstream_error(resp: httpx.Response) -> str:
    """Extract a sanitized error message from upstream JSON or text without exposing sensitive data."""
    try:
        data = resp.json()
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, dict):
                return str(err.get("message") or err)
            elif isinstance(err, str):
                return err
            elif data.get("message"):
                return str(data["message"])
            elif data.get("detail"):
                return str(data["detail"])
    except Exception:
        pass

    text = resp.text.strip()
    if text:
        return text[:200]
    return f"HTTP error {resp.status_code}"


def _build_context(req: SummaryRequest) -> str:
    """Assemble structured context block from available request fields."""
    lines: list[str] = ["=== PATIENT INFORMATION ==="]

    lines.append(f"Name/ID     : {req.patient_name or 'Not provided'}")
    lines.append(f"Age         : {req.patient_age or 'Not provided'}")
    lines.append(f"Sex         : {req.patient_sex or 'Not provided'}")
    lines.append(f"Allergies   : {req.known_allergies or 'Not provided'}")
    lines.append(f"Medications : {req.known_medications or 'Not provided'}")

    if req.vital_signs:
        v = req.vital_signs
        lines.append("\n=== VITAL SIGNS ===")
        lines.append(f"Heart rate     : {v.heart_rate_bpm or 'Not measured'} bpm")
        lines.append(f"Blood pressure : {v.blood_pressure_mmhg or 'Not measured'}")
        lines.append(f"SpO2           : {v.spo2_percent or 'Not measured'}%")
        lines.append(f"Resp. rate     : {v.respiratory_rate_bpm or 'Not measured'} bpm")
        lines.append(f"Temperature    : {v.temperature_celsius or 'Not measured'} °C")
        lines.append(f"GCS score      : {v.gcs_score or 'Not assessed'}")
    else:
        lines.append("\n=== VITAL SIGNS ===\nNone provided.")

    lines.append("\n=== INCIDENT DESCRIPTION (Helper report) ===")
    lines.append(req.incident_description or "Not provided.")

    lines.append("\n=== IMAGE ANALYSIS (Gemini — visible findings only) ===")
    lines.append(req.image_description or "Not provided.")

    lines.append("\n=== AUDIO TRANSCRIPT (ElevenLabs) ===")
    lines.append(req.audio_transcript or "Not provided.")

    return "\n".join(lines)


SYSTEM_PROMPT = f"""
You are an AI assistant supporting emergency medical services.
You have two distinct tasks:

TASK A — HOSPITAL HANDOVER SUMMARY
Write a concise clinical handover note for the receiving hospital team.
Include:
- Patient demographics (as available)
- Mechanism of incident or chief complaint (as reported)
- Visible findings from image analysis (clearly attributed to AI image recognition)
- Available vital signs
- Missing information and data gaps
- Uncertainty: clearly flag AI-generated content as unconfirmed
- End with: CLINICAL REVIEW REQUIRED

Do NOT:
- Diagnose conditions or internal injuries
- Infer findings not present in the provided data
- Speculate about unseen pathology

TASK B — AMBULANCE HELPER PRECAUTIONS
Select ONLY relevant items from the approved first-aid guidance library provided below.
Write them as clear, concise spoken instructions suitable for audio playback.
Keep the total under 150 words.
Do NOT invent new medical instructions.
End with: "Await further instructions from emergency dispatch or the ambulance crew."

APPROVED FIRST-AID GUIDANCE LIBRARY:
{FIRST_AID_GUIDANCE_LIBRARY}

RESPONSE FORMAT (return exactly this structure):
---HOSPITAL_SUMMARY---
[Your hospital handover summary here]
---HELPER_PRECAUTIONS---
[Your selected first-aid precautions here]
---END---
""".strip()


def _parse_grok_response(raw: str) -> tuple[str, str]:
    """Extract hospital_summary and helper_precautions from model output."""
    summary = ""
    precautions = ""

    try:
        if "---HOSPITAL_SUMMARY---" in raw and "---HELPER_PRECAUTIONS---" in raw:
            summary_start = raw.index("---HOSPITAL_SUMMARY---") + len("---HOSPITAL_SUMMARY---")
            precautions_start = raw.index("---HELPER_PRECAUTIONS---")
            summary = raw[summary_start:precautions_start].strip()

            prec_start = precautions_start + len("---HELPER_PRECAUTIONS---")
            end_marker = raw.find("---END---", prec_start)
            if end_marker != -1:
                precautions = raw[prec_start:end_marker].strip()
            else:
                precautions = raw[prec_start:].strip()
        else:
            summary = raw.strip()
            precautions = (
                "Precautions could not be extracted. "
                "Please follow emergency dispatch instructions and await the ambulance crew."
            )
    except Exception:
        summary = raw.strip()
        precautions = (
            "Precautions could not be extracted. "
            "Please follow emergency dispatch instructions and await the ambulance crew."
        )

    return summary, precautions


def _identify_missing_info(req: SummaryRequest) -> list[str]:
    """Return a list of important fields that were not provided."""
    missing: list[str] = []
    if not req.patient_name:
        missing.append("Patient name/identifier")
    if req.patient_age is None:
        missing.append("Patient age")
    if not req.image_description:
        missing.append("Image analysis result")
    if not req.audio_transcript:
        missing.append("Audio transcript")
    if not req.vital_signs or all(
        v is None
        for v in [
            req.vital_signs.heart_rate_bpm,
            req.vital_signs.blood_pressure_mmhg,
            req.vital_signs.spo2_percent,
            req.vital_signs.respiratory_rate_bpm,
        ]
    ):
        missing.append("Vital signs")
    if not req.incident_description:
        missing.append("Incident description")
    return missing


@router.post(
    "/summary",
    response_model=SummaryResponse,
    summary="Generate hospital handover summary and helper precautions via LLM",
    description=(
        "Submit patient details, Gemini image description, ElevenLabs transcript, "
        "and available vital signs. "
        "The LLM generates a hospital handover summary and concise first-aid precautions "
        "for speech playback to the ambulance helper. "
        "Precautions are selected only from a clinician-approved guidance library."
    ),
)
async def generate_summary(request: SummaryRequest) -> SummaryResponse:
    # ------------------------------------------------------------------
    # 1. Build context & missing info check
    # ------------------------------------------------------------------
    context = _build_context(request)
    missing_info = _identify_missing_info(request)

    user_message = (
        f"Please generate the hospital handover summary and helper precautions "
        f"based on the following emergency patient data:\n\n{context}"
    )

    # ------------------------------------------------------------------
    # 2. Configure endpoint & payload
    # ------------------------------------------------------------------
    api_key, model_to_use, base_url = _get_llm_config()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_to_use,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.2,
        "max_tokens": 1500,
    }

    # ------------------------------------------------------------------
    # 3. Call LLM API with accurate error inspection
    # ------------------------------------------------------------------
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
    except (httpx.TimeoutException, TimeoutError) as exc:
        logger.error("LLM request timed out contacting %s", base_url)
        raise HTTPException(
            status_code=504,
            detail="LLM API request timed out.",
        ) from exc
    except httpx.RequestError as exc:
        logger.error("LLM network error contacting %s: %s", base_url, type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Network error contacting LLM provider.",
        ) from exc

    if resp.status_code != 200:
        error_msg = _extract_upstream_error(resp)
        logger.error("LLM upstream error (status %s, model %s): %s", resp.status_code, model_to_use, error_msg)

        if resp.status_code in (401, 403) or (resp.status_code == 400 and "api key" in error_msg.lower()):
            raise HTTPException(
                status_code=401,
                detail=f"LLM API authentication failed: {error_msg}",
            )
        if resp.status_code == 404 or "model_not_found" in error_msg.lower() or "does not exist" in error_msg.lower():
            raise HTTPException(
                status_code=404,
                detail=f"Configured LLM model '{model_to_use}' is not found or not accessible: {error_msg}",
            )
        if resp.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="LLM provider rate limit or quota exceeded. Please retry shortly.",
            )
        if resp.status_code == 400:
            raise HTTPException(
                status_code=400,
                detail=f"LLM request error: {error_msg}",
            )

        raise HTTPException(
            status_code=502,
            detail=f"LLM provider error (status {resp.status_code}): {error_msg}",
        )

    try:
        result = resp.json()
        raw_content: str = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        logger.error("Unexpected LLM response structure: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Unexpected response structure received from LLM provider.",
        ) from exc

    if not raw_content.strip():
        logger.error("LLM returned empty content.")
        raise HTTPException(
            status_code=502,
            detail="LLM provider returned empty response content.",
        )

    # ------------------------------------------------------------------
    # 4. Parse and return structured response
    # ------------------------------------------------------------------
    hospital_summary, helper_precautions = _parse_grok_response(raw_content)

    return SummaryResponse(
        status="success",
        hospital_summary=hospital_summary,
        helper_precautions=helper_precautions,
        missing_information=missing_info,
        requires_clinical_review=True,
        model_used=model_to_use,
        disclaimer=(
            "AI-generated content. "
            "Hospital summary must be reviewed by qualified clinical personnel before use. "
            "Helper precautions are selected from a clinician-approved guidance library only. "
            "Do not rely solely on this output for clinical decision-making."
        ),
    )
