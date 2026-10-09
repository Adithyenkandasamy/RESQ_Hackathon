"""Emergency management endpoints: creation, retrieval, updates, and audit history."""

from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_db_session
from app.models.emergency import Emergency
from app.models.emergency_history import EmergencyHistory
from app.models.enums import (
    ALLOWED_STATUS_TRANSITIONS,
    EmergencyStatus,
    UserRole,
    can_transition,
)
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.emergency import (
    EmergencyCreate,
    EmergencyHistoryResponse,
    EmergencyLocationUpdate,
    EmergencyPatientUpdate,
    EmergencyResponse,
    EmergencyStatusUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/emergencies", tags=["Emergencies"])


def _check_emergency_access(emergency: Emergency, user: User) -> None:
    """Verify that the user has permission to view this emergency incident."""
    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.AMBULANCE_CREW:
        if emergency.created_by_id == user.id or (
            user.ambulance_id is not None and emergency.assigned_ambulance_id == user.ambulance_id
        ):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not assigned to this emergency case.",
        )

    if user.role == UserRole.HOSPITAL_STAFF:
        if user.hospital_id is not None and emergency.confirmed_hospital_id == user.hospital_id:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: This emergency is not confirmed for your hospital.",
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied for this role.",
    )


def _check_emergency_update_permission(emergency: Emergency, user: User) -> None:
    """Verify that the user has permission to modify this emergency incident."""
    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.AMBULANCE_CREW:
        if emergency.created_by_id == user.id or (
            user.ambulance_id is not None and emergency.assigned_ambulance_id == user.ambulance_id
        ):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot modify an emergency not assigned to your crew.",
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Hospital staff and unauthorized roles cannot modify field emergency data directly.",
    )


@router.post(
    "",
    response_model=EmergencyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new emergency incident",
)
async def create_emergency(
    payload: EmergencyCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EmergencyResponse:
    """Create an emergency case.

    Permitted for AMBULANCE_CREW and ADMIN users.
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.AMBULANCE_CREW):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ambulance crew and administrators can report emergency cases.",
        )

    assigned_ambulance_id = (
        payload.assigned_ambulance_id
        if current_user.role == UserRole.ADMIN
        else current_user.ambulance_id
    )

    captured_at = payload.location_captured_at or datetime.now(timezone.utc)

    emergency = Emergency(
        created_by_id=current_user.id,
        assigned_ambulance_id=assigned_ambulance_id,
        incident_type=payload.incident_type,
        incident_description=payload.incident_description,
        patient_info=payload.patient_info,
        incident_latitude=payload.incident_latitude,
        incident_longitude=payload.incident_longitude,
        location_captured_at=captured_at,
        status=EmergencyStatus.CREATED,
    )
    session.add(emergency)
    await session.flush()  # Generate emergency.id

    # Create initial audit log entry
    history_entry = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="CREATED",
        new_status=EmergencyStatus.CREATED.value,
        details={"incident_type": emergency.incident_type},
    )
    session.add(history_entry)

    await session.commit()
    await session.refresh(emergency)

    logger.info("Emergency incident created: %s by user %s", emergency.id, current_user.id)
    return EmergencyResponse.model_validate(emergency)


@router.get(
    "",
    response_model=PaginatedResponse[EmergencyResponse],
    summary="List accessible emergency incidents",
)
async def list_emergencies(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: EmergencyStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[EmergencyResponse]:
    """Retrieve emergencies accessible to the authenticated user."""
    offset = (page - 1) * page_size

    base_query = select(Emergency)

    # Apply role scoping
    if current_user.role == UserRole.ADMIN:
        pass  # Admins can view all emergencies
    elif current_user.role == UserRole.AMBULANCE_CREW:
        conditions = [Emergency.created_by_id == current_user.id]
        if current_user.ambulance_id is not None:
            conditions.append(Emergency.assigned_ambulance_id == current_user.ambulance_id)
        from sqlalchemy import or_

        base_query = base_query.where(or_(*conditions))
    elif current_user.role == UserRole.HOSPITAL_STAFF:
        if current_user.hospital_id is None:
            # Not associated with a hospital - cannot see any emergencies
            return PaginatedResponse[EmergencyResponse](
                items=[], total=0, page=page, page_size=page_size, total_pages=0
            )
        base_query = base_query.where(Emergency.confirmed_hospital_id == current_user.hospital_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role not authorized to list emergencies.",
        )

    if status_filter is not None:
        base_query = base_query.where(Emergency.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    # Query page items
    stmt = base_query.order_by(Emergency.created_at.desc()).offset(offset).limit(page_size)
    result = await session.execute(stmt)
    emergencies = list(result.scalars().all())

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return PaginatedResponse[EmergencyResponse](
        items=[EmergencyResponse.model_validate(e) for e in emergencies],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/{emergency_id}",
    response_model=EmergencyResponse,
    summary="Retrieve an emergency incident by ID",
)
async def get_emergency(
    emergency_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EmergencyResponse:
    """Retrieve details for a specific emergency incident."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    result = await session.execute(stmt)
    emergency = result.scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_access(emergency, current_user)
    return EmergencyResponse.model_validate(emergency)


@router.patch(
    "/{emergency_id}/patient",
    response_model=EmergencyResponse,
    summary="Update patient information",
)
async def update_patient_info(
    emergency_id: uuid.UUID,
    payload: EmergencyPatientUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EmergencyResponse:
    """Update patient observations for an emergency."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    result = await session.execute(stmt)
    emergency = result.scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_update_permission(emergency, current_user)

    emergency.patient_info = payload.patient_info
    emergency.updated_at = datetime.now(timezone.utc)

    history_entry = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="PATIENT_UPDATE",
        details={"updated_keys": list(payload.patient_info.keys())},
    )
    session.add(history_entry)

    await session.commit()
    await session.refresh(emergency)

    logger.info("Patient info updated for emergency %s by user %s", emergency.id, current_user.id)
    return EmergencyResponse.model_validate(emergency)


@router.patch(
    "/{emergency_id}/location",
    response_model=EmergencyResponse,
    summary="Update incident coordinates",
)
async def update_location(
    emergency_id: uuid.UUID,
    payload: EmergencyLocationUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EmergencyResponse:
    """Update scene coordinates and location capture timestamp."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    result = await session.execute(stmt)
    emergency = result.scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_update_permission(emergency, current_user)

    captured_at = payload.location_captured_at or datetime.now(timezone.utc)
    emergency.incident_latitude = payload.incident_latitude
    emergency.incident_longitude = payload.incident_longitude
    emergency.location_captured_at = captured_at
    emergency.updated_at = datetime.now(timezone.utc)

    history_entry = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="LOCATION_UPDATE",
        details={
            "latitude": payload.incident_latitude,
            "longitude": payload.incident_longitude,
            "captured_at": captured_at.isoformat(),
        },
    )
    session.add(history_entry)

    await session.commit()
    await session.refresh(emergency)

    logger.info("Location updated for emergency %s by user %s", emergency.id, current_user.id)
    return EmergencyResponse.model_validate(emergency)


@router.patch(
    "/{emergency_id}/status",
    response_model=EmergencyResponse,
    summary="Transition emergency status",
)
async def update_status(
    emergency_id: uuid.UUID,
    payload: EmergencyStatusUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EmergencyResponse:
    """Transition emergency lifecycle status following validated transition rules."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    result = await session.execute(stmt)
    emergency = result.scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_update_permission(emergency, current_user)

    current_status = emergency.status
    target_status = payload.status

    if not can_transition(current_status, target_status):
        allowed = ALLOWED_STATUS_TRANSITIONS.get(current_status, set())
        allowed_names = sorted(s.value for s in allowed)
        logger.warning(
            "Invalid status transition requested for %s: %s -> %s",
            emergency.id,
            current_status.value,
            target_status.value,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid transition from '{current_status.value}' to '{target_status.value}'. "
                f"Allowed target states: {allowed_names or 'None (terminal state)'}."
            ),
        )

    emergency.status = target_status
    emergency.updated_at = datetime.now(timezone.utc)

    history_entry = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="STATUS_CHANGE",
        previous_status=current_status.value,
        new_status=target_status.value,
        details={"reason": payload.reason} if payload.reason else None,
    )
    session.add(history_entry)

    await session.commit()
    await session.refresh(emergency)

    logger.info(
        "Status transitioned for emergency %s: %s -> %s by user %s",
        emergency.id,
        current_status.value,
        target_status.value,
        current_user.id,
    )
    return EmergencyResponse.model_validate(emergency)


@router.get(
    "/{emergency_id}/history",
    response_model=list[EmergencyHistoryResponse],
    summary="Retrieve audit and lifecycle history",
)
async def get_emergency_history(
    emergency_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[EmergencyHistoryResponse]:
    """Retrieve chronological audit trail of state changes and modifications."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    result = await session.execute(stmt)
    emergency = result.scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_access(emergency, current_user)

    hist_stmt = (
        select(EmergencyHistory)
        .where(EmergencyHistory.emergency_id == emergency_id)
        .order_by(EmergencyHistory.created_at.asc())
    )
    hist_result = await session.execute(hist_stmt)
    entries = list(hist_result.scalars().all())

    return [EmergencyHistoryResponse.model_validate(h) for h in entries]
