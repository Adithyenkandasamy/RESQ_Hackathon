"""SQLAlchemy model for hospitals."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Float, Index, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import HospitalStatus

if TYPE_CHECKING:
    from app.models.emergency import Emergency
    from app.models.hospital_request import HospitalRequest
    from app.models.user import User


def utc_now() -> datetime:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


class Hospital(Base):
    """Registered hospital entity.

    Capabilities represent registered hospital facilities/specialties.
    Reported availability represents explicitly reported capacity (e.g. ICU beds).
    """

    __tablename__ = "hospitals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    registration_identifier: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    contact_number: Mapped[str] = mapped_column(String(50), nullable=False)

    # Registered capabilities (e.g. ["ICU", "TRAUMA_LEVEL_1", "CARDIAC_CARE", "BURN_UNIT"])
    capabilities: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Registration / verification lifecycle. New self-registrations are PENDING
    # until an administrator approves or rejects the application.
    status: Mapped[HospitalStatus] = mapped_column(
        SAEnum(HospitalStatus, native_enum=False, length=50),
        default=HospitalStatus.APPROVED,
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Explicitly reported availability (e.g. {"icu_beds_available": 3, "accepting_patients": true})
    reported_availability: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )
    availability_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    staff_members: Mapped[list[User]] = relationship(
        "User", back_populates="hospital", cascade="all, delete-orphan"
    )
    hospital_requests: Mapped[list[HospitalRequest]] = relationship(
        "HospitalRequest", back_populates="hospital", cascade="all, delete-orphan"
    )
    confirmed_emergencies: Mapped[list[Emergency]] = relationship(
        "Emergency", back_populates="confirmed_hospital"
    )

    __table_args__ = (Index("ix_hospitals_coords", "latitude", "longitude"),)
