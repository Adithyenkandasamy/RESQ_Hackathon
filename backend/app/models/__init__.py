"""Database models for the Emergency Response Coordination System."""

from app.database import Base
from app.models.ambulance import Ambulance
from app.models.emergency import Emergency
from app.models.emergency_history import EmergencyHistory
from app.models.enums import (
    ALLOWED_STATUS_TRANSITIONS,
    AmbulanceStatus,
    EmergencyStatus,
    HospitalRequestStatus,
    UserRole,
    can_transition,
)
from app.models.hospital import Hospital
from app.models.hospital_request import HospitalRequest
from app.models.user import User

__all__ = [
    "ALLOWED_STATUS_TRANSITIONS",
    "Ambulance",
    "AmbulanceStatus",
    "Base",
    "Emergency",
    "EmergencyHistory",
    "EmergencyStatus",
    "Hospital",
    "HospitalRequest",
    "HospitalRequestStatus",
    "User",
    "UserRole",
    "can_transition",
]
