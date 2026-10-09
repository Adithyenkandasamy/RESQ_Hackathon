"""SQLAlchemy model for emergency incidents."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import EmergencyStatus

if TYPE_CHECKING:
    from app.models.ambulance import Ambulance
    from app.models.emergency_history import EmergencyHistory
    from app.models.hospital import Hospital
    from app.models.hospital_request import HospitalRequest
    from app.models.user import User


def utc_now() -> datetime:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


class Emergency(Base):
    """Emergency incident entity managing patient and coordination states."""

    __tablename__ = "emergencies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Actor relationships
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    assigned_ambulance_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("ambulances.id", ondelete="SET NULL"), nullable=True, index=True
    )
    confirmed_hospital_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Incident details
    incident_type: Mapped[str] = mapped_column(String(100), nullable=False)
    incident_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Patient info: flexible JSON allowing unknown/partial scene details
    # E.g. {"name": null, "age": null, "gender": null, "notes": "Unconscious adult found on road"}
    patient_info: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Geolocation with capture timestamp
    incident_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    incident_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_captured_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=True
    )

    # Lifecycle status
    status: Mapped[EmergencyStatus] = mapped_column(
        SAEnum(EmergencyStatus, native_enum=False, length=50),
        default=EmergencyStatus.CREATED,
        nullable=False,
        index=True,
    )

    # Phase 3 AI artifacts (non-blocking, persisted for review)
    transcription: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    ai_extractions: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON, default=list, nullable=True
    )
    handover_summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    creator: Mapped[User] = relationship("User", back_populates="created_emergencies")
    assigned_ambulance: Mapped[Ambulance | None] = relationship(
        "Ambulance", back_populates="assigned_emergencies"
    )
    confirmed_hospital: Mapped[Hospital | None] = relationship(
        "Hospital", back_populates="confirmed_emergencies"
    )
    history_entries: Mapped[list[EmergencyHistory]] = relationship(
        "EmergencyHistory",
        back_populates="emergency",
        cascade="all, delete-orphan",
        order_by="EmergencyHistory.created_at.desc()",
    )
    hospital_requests: Mapped[list[HospitalRequest]] = relationship(
        "HospitalRequest",
        back_populates="emergency",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "incident_latitude >= -90.0 AND incident_latitude <= 90.0",
            name="chk_emergency_latitude",
        ),
        CheckConstraint(
            "incident_longitude >= -180.0 AND incident_longitude <= 180.0",
            name="chk_emergency_longitude",
        ),
        Index("ix_emergencies_status_created_at", "status", "created_at"),
    )
