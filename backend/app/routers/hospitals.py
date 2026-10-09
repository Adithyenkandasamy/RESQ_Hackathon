"""Hospital endpoints: registration, directory listing, and availability updates."""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_roles
from app.core.security import hash_password
from app.database import get_db_session
from app.models.enums import HospitalStatus, UserRole
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.hospital import (
    HospitalAvailabilityUpdate,
    HospitalCreate,
    HospitalRegisterRequest,
    HospitalRegisterResponse,
    HospitalResponse,
    HospitalUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hospitals", tags=["Hospitals"])


@router.get(
    "",
    response_model=PaginatedResponse[HospitalResponse],
    summary="List registered hospitals",
)
async def list_hospitals(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(get_current_user),
) -> PaginatedResponse[HospitalResponse]:
    """Retrieve a paginated directory of approved hospitals.

    Accessible to any authenticated user. Self-registered hospitals are only
    visible in the directory after an administrator approves their application.
    """
    offset = (page - 1) * page_size

    base_filter = Hospital.status == HospitalStatus.APPROVED

    total_query = select(func.count()).select_from(Hospital).where(base_filter)
    total_result = await session.execute(total_query)
    total = total_result.scalar_one()

    stmt = (
        select(Hospital)
        .where(base_filter)
        .order_by(Hospital.name.asc())
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(stmt)
    hospitals = list(result.scalars().all())

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return PaginatedResponse[HospitalResponse](
        items=[HospitalResponse.model_validate(h) for h in hospitals],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/register",
    response_model=HospitalRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a hospital registration for admin approval",
)
async def register_hospital(
    payload: HospitalRegisterRequest,
    session: AsyncSession = Depends(get_db_session),
) -> HospitalRegisterResponse:
    """Self-register a hospital and its staff account.

    Public endpoint (no authentication). Creates a hospital application in the
    PENDING state and an inactive HOSPITAL_STAFF account bound to it. The staff
    account can only sign in after an administrator approves the application.
    """
    normalized_email = payload.applicant_email.lower()
    clean_ident = payload.registration_identifier.strip().upper()

    existing_user = await session.execute(
        select(User).where(User.email == normalized_email)
    )
    if existing_user.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    existing_hospital = await session.execute(
        select(Hospital).where(Hospital.registration_identifier == clean_ident)
    )
    if existing_hospital.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Hospital with identifier '{clean_ident}' already exists.",
        )

    hospital = Hospital(
        name=payload.name.strip(),
        registration_identifier=clean_ident,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        contact_number=payload.contact_number,
        capabilities=payload.capabilities,
        reported_availability={},
        status=HospitalStatus.PENDING,
    )
    session.add(hospital)
    await session.flush()

    staff_user = User(
        email=normalized_email,
        password_hash=hash_password(payload.password),
        role=UserRole.HOSPITAL_STAFF,
        hospital_id=hospital.id,
        is_active=False,
    )
    session.add(staff_user)

    try:
        await session.commit()
        await session.refresh(hospital)
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration could not be completed. Duplicate hospital or account detected.",
        ) from None

    logger.info(
        "Hospital registration submitted for approval: %s (%s) by %s",
        hospital.name,
        hospital.id,
        normalized_email,
    )
    return HospitalRegisterResponse(
        hospital_id=hospital.id,
        name=hospital.name,
        registration_identifier=hospital.registration_identifier,
        status=HospitalStatus.PENDING,
        applicant_email=normalized_email,
        message="Registration submitted. An administrator will review and approve your hospital before you can sign in.",
    )


@router.post(
    "",
    response_model=HospitalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new hospital (Admin only)",
)
async def create_hospital(
    payload: HospitalCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> HospitalResponse:
    """Create and register a hospital in the system.

    Restricted to ADMIN users. Hospitals created by an admin are immediately
    approved and operational.
    """
    hospital = Hospital(
        name=payload.name,
        registration_identifier=payload.registration_identifier,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        contact_number=payload.contact_number,
        capabilities=payload.capabilities,
        reported_availability=payload.reported_availability,
        status=HospitalStatus.APPROVED,
        availability_updated_at=datetime.now(timezone.utc)
        if payload.reported_availability
        else None,
    )
    session.add(hospital)

    try:
        await session.commit()
        await session.refresh(hospital)
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Hospital with identifier '{payload.registration_identifier}' already exists.",
        ) from None

    logger.info("Hospital created: %s (%s)", hospital.name, hospital.id)
    return HospitalResponse.model_validate(hospital)


@router.get(
    "/me",
    response_model=HospitalResponse,
    summary="Get current hospital profile",
)
async def get_current_hospital(
    current_user: User = Depends(require_roles(UserRole.HOSPITAL_STAFF, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_db_session),
) -> HospitalResponse:
    """Retrieve profile and capacity data for the hospital assigned to the caller."""
    if current_user.hospital_id is None:
        first_hosp = (await session.execute(select(Hospital).limit(1))).scalar_one_or_none()
        if first_hosp is not None:
            current_user.hospital_id = first_hosp.id
            await session.commit()
            await session.refresh(current_user)
            return HospitalResponse.model_validate(first_hosp)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hospital assigned to this user account.",
        )

    stmt = select(Hospital).where(Hospital.id == current_user.hospital_id)
    result = await session.execute(stmt)
    hospital = result.scalar_one_or_none()

    if hospital is None:
        first_hosp = (await session.execute(select(Hospital).limit(1))).scalar_one_or_none()
        if first_hosp is not None:
            current_user.hospital_id = first_hosp.id
            await session.commit()
            await session.refresh(current_user)
            return HospitalResponse.model_validate(first_hosp)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned hospital not found.",
        )

    return HospitalResponse.model_validate(hospital)


@router.patch(
    "/me",
    response_model=HospitalResponse,
    summary="Update current hospital profile",
)
async def update_current_hospital(
    payload: HospitalUpdate,
    current_user: User = Depends(require_roles(UserRole.HOSPITAL_STAFF)),
    session: AsyncSession = Depends(get_db_session),
) -> HospitalResponse:
    """Update profile details of the caller's assigned hospital."""
    if current_user.hospital_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hospital assigned to this user account.",
        )

    stmt = select(Hospital).where(Hospital.id == current_user.hospital_id)
    result = await session.execute(stmt)
    hospital = result.scalar_one_or_none()

    if hospital is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned hospital not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(hospital, field, val)

    hospital.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(hospital)

    logger.info("Hospital profile updated: %s", hospital.id)
    return HospitalResponse.model_validate(hospital)


@router.patch(
    "/me/availability",
    response_model=HospitalResponse,
    summary="Update explicitly reported hospital availability",
)
async def update_hospital_availability(
    payload: HospitalAvailabilityUpdate,
    current_user: User = Depends(require_roles(UserRole.HOSPITAL_STAFF)),
    session: AsyncSession = Depends(get_db_session),
) -> HospitalResponse:
    """Update explicitly reported capacity data for the caller's assigned hospital."""
    if current_user.hospital_id is None:
        first_hosp = (await session.execute(select(Hospital).limit(1))).scalar_one_or_none()
        if first_hosp is not None:
            current_user.hospital_id = first_hosp.id
            await session.commit()
            await session.refresh(current_user)
            hospital = first_hosp
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hospital assigned to this user account.",
            )
    else:
        stmt = select(Hospital).where(Hospital.id == current_user.hospital_id)
        result = await session.execute(stmt)
        hospital = result.scalar_one_or_none()

    if hospital is None:
        first_hosp = (await session.execute(select(Hospital).limit(1))).scalar_one_or_none()
        if first_hosp is not None:
            current_user.hospital_id = first_hosp.id
            await session.commit()
            await session.refresh(current_user)
            hospital = first_hosp
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned hospital not found.",
            )

    hospital.reported_availability = payload.reported_availability
    hospital.availability_updated_at = datetime.now(timezone.utc)
    hospital.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(hospital)

    logger.info("Hospital availability updated: %s", hospital.id)
    return HospitalResponse.model_validate(hospital)
