"""Enumerations and status transition rules for ERCS.

Defines roles, ambulance operational states, emergency workflow states,
and hospital request states, along with validated emergency state transitions.
"""

from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    """Initial system user roles."""

    ADMIN = "ADMIN"
    HOSPITAL_STAFF = "HOSPITAL_STAFF"
    AMBULANCE_CREW = "AMBULANCE_CREW"


class AmbulanceStatus(str, Enum):
    """Operational status of an ambulance."""

    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    EN_ROUTE = "EN_ROUTE"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"


class HospitalRequestStatus(str, Enum):
    """Status of a hospital dispatch/admission request."""

    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"


class EmergencyStatus(str, Enum):
    """Central lifecycle statuses for an emergency incident."""

    CREATED = "CREATED"
    ASSESSMENT_IN_PROGRESS = "ASSESSMENT_IN_PROGRESS"
    SEARCHING_HOSPITAL = "SEARCHING_HOSPITAL"
    ACCEPTANCE_PENDING = "ACCEPTANCE_PENDING"
    HOSPITAL_CONFIRMED = "HOSPITAL_CONFIRMED"
    TRANSPORTING = "TRANSPORTING"
    ARRIVED = "ARRIVED"
    HANDOVER_COMPLETED = "HANDOVER_COMPLETED"
    CANCELLED = "CANCELLED"
    ESCALATION_REQUIRED = "ESCALATION_REQUIRED"


# Explicit, authorized emergency state transitions.
# Any transition not listed here is prohibited and will be rejected.
ALLOWED_STATUS_TRANSITIONS: dict[EmergencyStatus, set[EmergencyStatus]] = {
    EmergencyStatus.CREATED: {
        EmergencyStatus.ASSESSMENT_IN_PROGRESS,
        EmergencyStatus.CANCELLED,
    },
    EmergencyStatus.ASSESSMENT_IN_PROGRESS: {
        EmergencyStatus.SEARCHING_HOSPITAL,
        EmergencyStatus.ESCALATION_REQUIRED,
        EmergencyStatus.CANCELLED,
    },
    EmergencyStatus.SEARCHING_HOSPITAL: {
        EmergencyStatus.ACCEPTANCE_PENDING,
        EmergencyStatus.ESCALATION_REQUIRED,
        EmergencyStatus.CANCELLED,
    },
    EmergencyStatus.ACCEPTANCE_PENDING: {
        EmergencyStatus.HOSPITAL_CONFIRMED,
        EmergencyStatus.SEARCHING_HOSPITAL,
        EmergencyStatus.ESCALATION_REQUIRED,
        EmergencyStatus.CANCELLED,
    },
    EmergencyStatus.HOSPITAL_CONFIRMED: {
        EmergencyStatus.TRANSPORTING,
        EmergencyStatus.ESCALATION_REQUIRED,
        EmergencyStatus.CANCELLED,
    },
    EmergencyStatus.TRANSPORTING: {
        EmergencyStatus.ARRIVED,
        EmergencyStatus.ESCALATION_REQUIRED,
        EmergencyStatus.CANCELLED,
    },
    EmergencyStatus.ARRIVED: {
        EmergencyStatus.HANDOVER_COMPLETED,
        EmergencyStatus.ESCALATION_REQUIRED,
    },
    # Terminal states have no outbound transitions
    EmergencyStatus.HANDOVER_COMPLETED: set(),
    EmergencyStatus.CANCELLED: set(),
    EmergencyStatus.ESCALATION_REQUIRED: {
        EmergencyStatus.SEARCHING_HOSPITAL,
        EmergencyStatus.HOSPITAL_CONFIRMED,
        EmergencyStatus.TRANSPORTING,
        EmergencyStatus.CANCELLED,
    },
}


def can_transition(current: EmergencyStatus, target: EmergencyStatus) -> bool:
    """Return True if the state transition from current to target is allowed."""
    allowed = ALLOWED_STATUS_TRANSITIONS.get(current, set())
    return target in allowed
