"""Pydantic schemas for the ERCS API."""

from app.schemas.admin import AdminDashboardResponse
from app.schemas.ambulance import (
    AmbulanceAvailabilityUpdate,
    AmbulanceCreate,
    AmbulanceResponse,
)
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.schemas.common import PaginatedResponse, PaginationParams
from app.schemas.emergency import (
    EmergencyCreate,
    EmergencyHistoryResponse,
    EmergencyLocationUpdate,
    EmergencyPatientUpdate,
    EmergencyResponse,
    EmergencyStatusUpdate,
)
from app.schemas.hospital import (
    HospitalAvailabilityUpdate,
    HospitalCreate,
    HospitalResponse,
    HospitalUpdate,
)

__all__ = [
    "AdminDashboardResponse",
    "AmbulanceAvailabilityUpdate",
    "AmbulanceCreate",
    "AmbulanceResponse",
    "EmergencyCreate",
    "EmergencyHistoryResponse",
    "EmergencyLocationUpdate",
    "EmergencyPatientUpdate",
    "EmergencyResponse",
    "EmergencyStatusUpdate",
    "HospitalAvailabilityUpdate",
    "HospitalCreate",
    "HospitalResponse",
    "HospitalUpdate",
    "LoginRequest",
    "PaginatedResponse",
    "PaginationParams",
    "TokenResponse",
    "UserResponse",
]
