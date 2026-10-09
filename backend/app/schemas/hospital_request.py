"""Schemas for hospital admission requests, matching candidates, and assignment confirmation."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import HospitalRequestStatus


class HospitalRequestResponse(BaseModel):
    """Public representation of an emergency admission request to a hospital."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    emergency_id: uuid.UUID
    hospital_id: uuid.UUID
    status: HospitalRequestStatus
    response_reason: str | None = None
    created_at: datetime
    response_deadline: datetime
    responded_at: datetime | None = None


class HospitalRequestDeclinePayload(BaseModel):
    """Payload when a hospital declines an admission request."""

    model_config = ConfigDict(extra="forbid")

    reason: str | None = Field(
        None, max_length=500, description="Optional clinical or operational reason for declining"
    )


class HospitalMatchCandidateResponse(BaseModel):
    """Hospital match candidate scored by the rules-based matching service."""

    hospital_id: uuid.UUID
    hospital_name: str
    distance_km: float
    composite_score: float
    capability_score: float
    availability_score: float
    proximity_score: float
    matched_capabilities: list[str]
    availability_status: str
    explanation: str


class HospitalMatchResponse(BaseModel):
    """Result of triggering rules-based matching for an emergency."""

    emergency_id: uuid.UUID
    candidates: list[HospitalMatchCandidateResponse]
    requests_created: int


class ConfirmedAssignmentResponse(BaseModel):
    """Authoritative confirmed destination hospital for an emergency."""

    emergency_id: uuid.UUID
    confirmed_hospital_id: uuid.UUID | None
    confirmed_hospital_name: str | None = None
    status: str
