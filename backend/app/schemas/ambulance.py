"""Schemas for ambulance management and operational status."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AmbulanceStatus


class AmbulanceCreate(BaseModel):
    """Payload to register an ambulance vehicle (Admin only)."""

    model_config = ConfigDict(extra="forbid")

    registration_identifier: str = Field(
        ..., min_length=2, max_length=100, description="Vehicle plate / identifier"
    )
    contact_number: str | None = Field(None, max_length=50)
    operational_status: AmbulanceStatus = Field(
        default=AmbulanceStatus.AVAILABLE,
        description="Initial operational status",
    )


class AmbulanceAvailabilityUpdate(BaseModel):
    """Payload to update operational availability."""

    model_config = ConfigDict(extra="forbid")

    operational_status: AmbulanceStatus = Field(
        ..., description="New operational status (AVAILABLE, BUSY, EN_ROUTE, OUT_OF_SERVICE)"
    )


class AmbulanceResponse(BaseModel):
    """Ambulance profile response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    registration_identifier: str
    contact_number: str | None = None
    operational_status: AmbulanceStatus
    created_at: datetime
    updated_at: datetime
