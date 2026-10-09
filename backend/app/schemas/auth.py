"""Schemas for authentication and user accounts."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    """User credentials for logging in."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(..., description="Registered user email address")
    password: str = Field(..., min_length=1, description="Account password")


class TokenResponse(BaseModel):
    """JWT bearer access token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token validity in seconds")


class UserResponse(BaseModel):
    """Public user profile response (safe, no secrets)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: UserRole
    is_active: bool
    hospital_id: uuid.UUID | None = None
    ambulance_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
