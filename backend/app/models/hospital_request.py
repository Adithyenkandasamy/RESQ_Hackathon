"""SQLAlchemy model for hospital admission requests."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Text, Uuid
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import HospitalRequestStatus

if TYPE_CHECKING:
    from app.models.emergency import Emergency
    from app.models.hospital import Hospital


def utc_now() -> datetime:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


class HospitalRequest(Base):
    """Request sent to a hospital to accept an inbound emergency."""

    __tablename__ = "hospital_requests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    emergency_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("emergencies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[HospitalRequestStatus] = mapped_column(
        SAEnum(HospitalRequestStatus, native_enum=False, length=50),
        default=HospitalRequestStatus.PENDING,
        nullable=False,
    )
    response_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    response_deadline: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    emergency: Mapped[Emergency] = relationship("Emergency", back_populates="hospital_requests")
    hospital: Mapped[Hospital] = relationship("Hospital", back_populates="hospital_requests")

    __table_args__ = (
        Index("ix_hospital_requests_emergency_hospital", "emergency_id", "hospital_id"),
    )
