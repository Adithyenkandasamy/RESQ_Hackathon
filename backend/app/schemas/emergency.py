"""Schemas for emergency management, patient updates, and audit history."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import EmergencyStatus


class EmergencyCreate(BaseModel):
    """Payload to register a new emergency incident."""

    model_config = ConfigDict(extra="ignore")

    incident_type: str = Field(
        ..., min_length=2, max_length=100, description="Type of incident (e.g. TRAUMA, CARDIAC)"
    )
    incident_description: str | None = Field(
        None, max_length=1000, description="Optional incident description from caller or scene"
    )
    patient_info: dict[str, Any] = Field(
        default_factory=dict,
        description="Scene patient observations; unknown details permitted, no diagnosis required",
    )
    incident_latitude: float = Field(
        ..., ge=-90.0, le=90.0, description="Latitude between -90 and 90"
    )
    incident_longitude: float = Field(
        ..., ge=-180.0, le=180.0, description="Longitude between -180 and 180"
    )
    location_captured_at: datetime | None = Field(
        None, description="Timestamp when coordinates were acquired; defaults to now"
    )
    assigned_ambulance_id: uuid.UUID | None = Field(
        None, description="Optional ambulance assigned at creation (admin override)"
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "incident_type" not in data and "severity_level" in data:
                data["incident_type"] = data["severity_level"]
            if "incident_latitude" not in data and "latitude" in data:
                data["incident_latitude"] = data["latitude"]
            if "incident_longitude" not in data and "longitude" in data:
                data["incident_longitude"] = data["longitude"]
            if "incident_description" not in data and "location_description" in data:
                data["incident_description"] = data["location_description"]
        return data


class EmergencyPatientUpdate(BaseModel):
    """Payload to update patient observations from the scene or en route."""

    model_config = ConfigDict(extra="ignore")

    patient_info: dict[str, Any] = Field(
        ...,
        description="Updated patient observations (e.g. vitals, consciousness, apparent injuries)",
    )


class EmergencyLocationUpdate(BaseModel):
    """Payload to update incident coordinates with an explicit capture timestamp."""

    model_config = ConfigDict(extra="ignore")

    incident_latitude: float = Field(..., ge=-90.0, le=90.0)
    incident_longitude: float = Field(..., ge=-180.0, le=180.0)
    location_captured_at: datetime | None = Field(
        None, description="Timestamp of the location acquisition; defaults to current time"
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "incident_latitude" not in data and "latitude" in data:
                data["incident_latitude"] = data["latitude"]
            if "incident_longitude" not in data and "longitude" in data:
                data["incident_longitude"] = data["longitude"]
        return data


class EmergencyStatusUpdate(BaseModel):
    """Payload to request an explicit, authorized state transition."""

    model_config = ConfigDict(extra="ignore")

    status: EmergencyStatus = Field(..., description="Target lifecycle state")
    reason: str | None = Field(
        None, max_length=500, description="Optional reason or context for the transition"
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "reason" not in data and "notes" in data:
                data["reason"] = data["notes"]
        return data


class EmergencyResponse(BaseModel):
    """Emergency incident representation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_by_id: uuid.UUID
    assigned_ambulance_id: uuid.UUID | None = None
    confirmed_hospital_id: uuid.UUID | None = None
    incident_type: str
    incident_description: str | None = None
    patient_info: dict[str, Any]
    incident_latitude: float
    incident_longitude: float
    location_captured_at: datetime
    status: EmergencyStatus
    latitude: float | None = None
    longitude: float | None = None
    severity_level: str | None = None
    location_description: str | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def populate_aliases(self) -> EmergencyResponse:
        self.latitude = self.incident_latitude
        self.longitude = self.incident_longitude
        self.severity_level = self.incident_type
        self.location_description = self.incident_description
        return self


class EmergencyHistoryResponse(BaseModel):
    """Audit log entry for an emergency."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    emergency_id: uuid.UUID
    actor_user_id: uuid.UUID | None = None
    event_type: str
    previous_status: str | None = None
    new_status: str | None = None
    details: dict[str, Any] | None = None
    created_at: datetime
