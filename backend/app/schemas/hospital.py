"""Schemas for hospital management and availability."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import HospitalStatus


class HospitalCreate(BaseModel):
    """Payload to register a new hospital (Admin only)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=2, max_length=255)
    registration_identifier: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=5, max_length=500)
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90")
    longitude: float = Field(
        ..., ge=-180.0, le=180.0, description="Longitude between -180 and 180"
    )
    contact_number: str = Field(..., min_length=5, max_length=50)
    capabilities: list[str] = Field(
        default_factory=list,
        description="Registered facilities/specialties, e.g. ['ICU', 'TRAUMA_LEVEL_1']",
    )
    reported_availability: dict[str, Any] = Field(
        default_factory=dict,
        description="Initial reported capacity, e.g. {'icu_beds': 5, 'accepting_patients': true}",
    )


class HospitalUpdate(BaseModel):
    """Payload to update hospital profile details."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(None, min_length=2, max_length=255)
    address: str | None = Field(None, min_length=5, max_length=500)
    latitude: float | None = Field(None, ge=-90.0, le=90.0)
    longitude: float | None = Field(None, ge=-180.0, le=180.0)
    contact_number: str | None = Field(None, min_length=5, max_length=50)
    capabilities: list[str] | None = Field(
        None,
        description="Registered facilities/specialties",
    )


class HospitalAvailabilityUpdate(BaseModel):
    """Payload to update explicitly reported hospital availability."""

    model_config = ConfigDict(extra="forbid")

    reported_availability: dict[str, Any] = Field(
        ...,
        description="Explicitly maintained availability data (e.g. {'icu_beds': 4, 'accepting': true})",
    )


class HospitalResponse(BaseModel):
    """Public hospital representation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    registration_identifier: str
    address: str
    latitude: float
    longitude: float
    contact_number: str
    capabilities: list[str]
    status: HospitalStatus = HospitalStatus.APPROVED
    rejection_reason: str | None = None
    reported_availability: dict[str, Any]
    availability_updated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class HospitalRegisterRequest(BaseModel):
    """Payload for a hospital to self-register and request approval.

    Creates a PENDING hospital application plus an associated (inactive)
    HOSPITAL_STAFF account. Staff can only sign in after an administrator
    approves the application.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=2, max_length=255)
    registration_identifier: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=5, max_length=500)
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90")
    longitude: float = Field(
        ..., ge=-180.0, le=180.0, description="Longitude between -180 and 180"
    )
    contact_number: str = Field(..., min_length=5, max_length=50)
    capabilities: list[str] = Field(
        default_factory=list,
        description="Registered facilities/specialties, e.g. ['ICU', 'TRAUMA_LEVEL_1']",
    )
    applicant_email: EmailStr = Field(..., description="Staff account email for login")
    password: str = Field(
        ..., min_length=8, description="Staff account password (minimum 8 chars)"
    )


class HospitalRegisterResponse(BaseModel):
    """Confirmation returned after a hospital submits its registration."""

    hospital_id: uuid.UUID
    name: str
    registration_identifier: str
    status: HospitalStatus = HospitalStatus.PENDING
    applicant_email: str
    message: str


class HospitalRegistrationDecision(BaseModel):
    """Admin decision payload for a pending hospital application."""

    model_config = ConfigDict(extra="forbid")

    reason: str | None = Field(None, max_length=500, description="Required when rejecting")


class HospitalRegistrationResponse(BaseModel):
    """Admin-facing view of a hospital application with its applicant account."""

    hospital: HospitalResponse
    applicant_email: str | None = None
