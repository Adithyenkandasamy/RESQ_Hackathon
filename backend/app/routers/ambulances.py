"""Ambulance endpoints: profile retrieval and operational availability updates."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_roles
from app.database import get_db_session
from app.models.ambulance import Ambulance
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.ambulance import (
    AmbulanceAvailabilityUpdate,
    AmbulanceResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ambulances", tags=["Ambulances"])


@router.get(
    "/me",
    response_model=AmbulanceResponse,
    summary="Get current ambulance profile",
)
async def get_current_ambulance(
    current_user: User = Depends(require_roles(UserRole.AMBULANCE_CREW)),
    session: AsyncSession = Depends(get_db_session),
) -> AmbulanceResponse:
    """Retrieve operational profile of the ambulance assigned to the authenticated crew."""
    if current_user.ambulance_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ambulance assigned to this user account.",
        )

    stmt = select(Ambulance).where(Ambulance.id == current_user.ambulance_id)
    result = await session.execute(stmt)
    ambulance = result.scalar_one_or_none()

    if ambulance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned ambulance not found.",
        )

    return AmbulanceResponse.model_validate(ambulance)


@router.patch(
    "/me/availability",
    response_model=AmbulanceResponse,
    summary="Update ambulance operational availability",
)
async def update_ambulance_availability(
    payload: AmbulanceAvailabilityUpdate,
    current_user: User = Depends(require_roles(UserRole.AMBULANCE_CREW)),
    session: AsyncSession = Depends(get_db_session),
) -> AmbulanceResponse:
    """Update operational readiness/availability of the assigned ambulance."""
    if current_user.ambulance_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ambulance assigned to this user account.",
        )

    stmt = select(Ambulance).where(Ambulance.id == current_user.ambulance_id)
    result = await session.execute(stmt)
    ambulance = result.scalar_one_or_none()

    if ambulance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned ambulance not found.",
        )

    ambulance.operational_status = payload.operational_status
    ambulance.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(ambulance)

    logger.info(
        "Ambulance %s operational status updated to: %s",
        ambulance.id,
        ambulance.operational_status.value,
    )
    return AmbulanceResponse.model_validate(ambulance)
