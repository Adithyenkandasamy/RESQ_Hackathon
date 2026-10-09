"""Schemas for AI transcription, extraction, handover summary, and first-aid endpoints."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TranscriptionResponse(BaseModel):
    """Result of speech-to-text audio transcription."""

    transcription_id: str
    emergency_id: uuid.UUID
    transcript: str
    language: str | None = None
    processing_status: str


class ExtractionRequest(BaseModel):
    """Optional payload to extract observations from user-provided text instead of stored transcript."""

    model_config = ConfigDict(extra="forbid")

    text: str | None = Field(
        None, max_length=5000, description="Raw text or scene notes to extract observations from"
    )


class ObservationExtractionResponse(BaseModel):
    """Structured clinical observations extracted by AI."""

    incident_type: str | None = None
    reported_injuries: list[str] = Field(default_factory=list)
    reported_symptoms: list[str] = Field(default_factory=list)
    patient_responsiveness: str | None = None
    vital_signs: dict[str, Any] = Field(default_factory=dict)
    unknown_or_missing_info: list[str] = Field(default_factory=list)
    factual_summary: str
    model_used: str
    review_required: bool = True


class HandoverSummaryResponse(BaseModel):
    """Structured clinical handover draft."""

    summary_id: str
    incident_overview: str
    reported_symptoms_and_injuries: list[str] = Field(default_factory=list)
    recorded_vital_signs: dict[str, Any] = Field(default_factory=dict)
    actions_taken: list[str] = Field(default_factory=list)
    critical_unknowns: list[str] = Field(default_factory=list)
    is_ai_generated: bool = True
    review_status: str
    model_used: str


class FirstAidGuidanceResponse(BaseModel):
    """Constrained first-aid supportive guidance."""

    protocol_id: str | None = None
    protocol_version: str | None = None
    protocol_title: str | None = None
    guidance_steps: list[str] = Field(default_factory=list)
    critical_precautions: list[str] = Field(default_factory=list)
    disclaimer: str
    is_ai_generated: bool = True
    model_used: str


class ExtractionVerificationRequest(BaseModel):
    """Payload when crew reviews and approves extracted clinical observations."""

    model_config = ConfigDict(extra="forbid")

    verified_patient_info: dict[str, Any] = Field(
        default_factory=dict,
        description="Patient details and clinical observations verified by the attending crew",
    )
    crew_notes: str | None = Field(
        None,
        max_length=1000,
        description="Optional clinical notes or corrections from attending crew",
    )


class HandoverConfirmationRequest(BaseModel):
    """Payload when attending crew reviews, confirms, or annotates clinical handover draft."""

    model_config = ConfigDict(extra="forbid")

    approved: bool = Field(True, description="Whether the clinical handover draft is approved")
    crew_notes: str | None = Field(
        None,
        max_length=2000,
        description="Attending crew annotations or corrections to handover summary",
    )
