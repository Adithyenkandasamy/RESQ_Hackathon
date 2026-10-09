"""SQLAlchemy model for users."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Uuid
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.ambulance import Ambulance
    from app.models.emergency import Emergency
    from app.models.hospital import Hospital


def utc_now() -> datetime:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


class User(Base):
    """User account entity supporting role-based access control."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, native_enum=False, length=50), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Optional association with an organization or unit
    hospital_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True, index=True
    )
    ambulance_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("ambulances.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    hospital: Mapped[Hospital | None] = relationship("Hospital", back_populates="staff_members")
    ambulance: Mapped[Ambulance | None] = relationship("Ambulance", back_populates="crew_members")
    created_emergencies: Mapped[list[Emergency]] = relationship(
        "Emergency", back_populates="creator"
    )
