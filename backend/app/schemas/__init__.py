"""Pydantic schemas for the ERCS API."""

from app.schemas.admin import AdminDashboardResponse
from app.schemas.ai import (
    ExtractionRequest,
    ExtractionVerificationRequest,
    FirstAidGuidanceResponse,
    HandoverConfirmationRequest,
    HandoverSummaryResponse,
    ObservationExtractionResponse,
    TranscriptionResponse,
)
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
from app.schemas.hospital_request import (
    ConfirmedAssignmentResponse,
    HospitalMatchCandidateResponse,
    HospitalMatchResponse,
    HospitalRequestDeclinePayload,
    HospitalRequestResponse,
)

__all__ = [
    "AdminDashboardResponse",
    "AmbulanceAvailabilityUpdate",
    "AmbulanceCreate",
    "AmbulanceResponse",
    "ConfirmedAssignmentResponse",
    "EmergencyCreate",
    "EmergencyHistoryResponse",
    "EmergencyLocationUpdate",
    "EmergencyPatientUpdate",
    "EmergencyResponse",
    "EmergencyStatusUpdate",
    "ExtractionRequest",
    "ExtractionVerificationRequest",
    "FirstAidGuidanceResponse",
    "HandoverConfirmationRequest",
    "HandoverSummaryResponse",
    "HospitalAvailabilityUpdate",
    "HospitalCreate",
    "HospitalMatchCandidateResponse",
    "HospitalMatchResponse",
    "HospitalRequestDeclinePayload",
    "HospitalRequestResponse",
    "HospitalResponse",
    "HospitalUpdate",
    "LoginRequest",
    "ObservationExtractionResponse",
    "PaginatedResponse",
    "PaginationParams",
    "TokenResponse",
    "TranscriptionResponse",
    "UserResponse",
]

