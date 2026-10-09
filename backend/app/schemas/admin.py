"""Schemas for administrative operations and system summaries."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AdminDashboardResponse(BaseModel):
    """Aggregated operational dashboard metrics for administrators.

    Does not expose sensitive patient-identifiable data.
    """

    model_config = ConfigDict(from_attributes=True)

    total_hospitals: int = Field(..., description="Count of registered hospitals")
    total_ambulances: int = Field(..., description="Count of registered ambulances")
    available_ambulances: int = Field(..., description="Count of operational AVAILABLE ambulances")
    active_emergencies: int = Field(..., description="Count of non-terminal emergencies")
    emergencies_by_status: dict[str, int] = Field(
        ..., description="Breakdown of emergency counts by status"
    )
    total_users: int = Field(..., description="Count of active user accounts")
