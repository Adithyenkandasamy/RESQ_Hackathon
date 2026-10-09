"""SQLAlchemy model for ambulances."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import AmbulanceStatus

if TYPE_CHECKING:
    from app.models.emergency import Emergency
    from app.models.user import User


def utc_now() -> datetime:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


class Ambulance(Base):
    """Ambulance vehicle entity."""

    __tablename__ = "ambulances"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    registration_identifier: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    contact_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    operational_status: Mapped[AmbulanceStatus] = mapped_column(
        SAEnum(AmbulanceStatus, native_enum=False, length=50),
        default=AmbulanceStatus.AVAILABLE,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    crew_members: Mapped[list[User]] = relationship(
        "User", back_populates="ambulance"
    )
    assigned_emergencies: Mapped[list[Emergency]] = relationship(
        "Emergency", back_populates="assigned_ambulance"
    )
