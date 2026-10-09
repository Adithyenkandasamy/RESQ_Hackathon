"""Administration endpoints: operational dashboard and administrative oversight."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_roles
from app.database import get_db_session
from app.models.ambulance import Ambulance
from app.models.emergency import Emergency
from app.models.enums import AmbulanceStatus, EmergencyStatus, HospitalStatus, UserRole
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.admin import AdminDashboardResponse
from app.schemas.hospital import (
    HospitalRegistrationDecision,
    HospitalRegistrationResponse,
    HospitalResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get(
    "/dashboard",
    response_model=AdminDashboardResponse,
    summary="Get administrative operational summary",
)
async def get_admin_dashboard(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> AdminDashboardResponse:
    """Provide an aggregated operational metrics summary for administrators.

    Does not return sensitive patient details.
    """
    # Count hospitals
    hosp_count = (await session.execute(select(func.count(Hospital.id)))).scalar_one()

    # Count ambulances
    amb_count = (await session.execute(select(func.count(Ambulance.id)))).scalar_one()

    # Count available ambulances
    avail_amb_count = (
        await session.execute(
            select(func.count(Ambulance.id)).where(
                Ambulance.operational_status == AmbulanceStatus.AVAILABLE
            )
        )
    ).scalar_one()

    # Count users
    user_count = (
        await session.execute(select(func.count(User.id)).where(User.is_active.is_(True)))
    ).scalar_one()

    # Emergencies by status
    status_query = select(Emergency.status, func.count(Emergency.id)).group_by(Emergency.status)
    status_rows = (await session.execute(status_query)).all()
    by_status: dict[str, int] = {s.value: 0 for s in EmergencyStatus}
    for row_status, count in status_rows:
        by_status[row_status.value] = count

    # Active emergencies (all non-terminal)
    terminal_statuses = {EmergencyStatus.HANDOVER_COMPLETED, EmergencyStatus.CANCELLED}
    active_count = sum(
        count for s, count in by_status.items() if EmergencyStatus(s) not in terminal_statuses
    )

    return AdminDashboardResponse(
        total_hospitals=hosp_count,
        total_ambulances=amb_count,
        available_ambulances=avail_amb_count,
        active_emergencies=active_count,
        emergencies_by_status=by_status,
        total_users=user_count,
    )


# ── Hospital registration approvals ──────────────────────────────────


async def _applicant_email_for_hospital(session: AsyncSession, hospital: Hospital) -> str | None:
    """Look up the staff account bound to a hospital (most recently created first)."""
    stmt = (
        select(User.email)
        .where(
            User.hospital_id == hospital.id,
            User.role == UserRole.HOSPITAL_STAFF,
        )
        .order_by(User.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


@router.get(
    "/hospital-registrations",
    response_model=list[HospitalRegistrationResponse],
    summary="List hospital registrations for administrative review",
)
async def list_hospital_registrations(
    hospital_status: HospitalStatus | None = Query(
        default=None, alias="status", description="Filter by registration status"
    ),
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[HospitalRegistrationResponse]:
    """Return hospitals grouped for review, defaulting to pending applications first."""
    stmt = select(Hospital)
    if hospital_status is not None:
        stmt = stmt.where(Hospital.status == hospital_status)

    # Pending first, then newest first
    stmt = stmt.order_by(
        Hospital.status == HospitalStatus.PENDING,
        Hospital.created_at.desc(),
    )
    result = await session.execute(stmt)
    hospitals = list(result.scalars().all())

    items: list[HospitalRegistrationResponse] = []
    for hospital in hospitals:
        items.append(
            HospitalRegistrationResponse(
                hospital=HospitalResponse.model_validate(hospital),
                applicant_email=await _applicant_email_for_hospital(session, hospital),
            )
        )
    return items


@router.post(
    "/hospital-registrations/{hospital_id}/approve",
    response_model=HospitalRegistrationResponse,
    summary="Approve a pending hospital registration",
)
async def approve_hospital_registration(
    hospital_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> HospitalRegistrationResponse:
    """Activate a hospital application, granting its staff login access."""
    hospital = await session.get(Hospital, hospital_id)
    if hospital is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital application not found.",
        )

    if hospital.status == HospitalStatus.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot approve a hospital that was previously rejected.",
        )

    hospital.status = HospitalStatus.APPROVED
    hospital.rejection_reason = None

    # Activate the staff accounts bound to this hospital
    staff_stmt = (
        select(User)
        .where(
            User.hospital_id == hospital.id,
            User.role == UserRole.HOSPITAL_STAFF,
            User.is_active.is_(False),
        )
    )
    staff_users = list((await session.execute(staff_stmt)).scalars().all())
    for staff_user in staff_users:
        staff_user.is_active = True

    await session.commit()
    await session.refresh(hospital)

    logger.info(
        "Hospital registration approved: %s (%s), activated %d staff account(s)",
        hospital.name,
        hospital.id,
        len(staff_users),
    )
    return HospitalRegistrationResponse(
        hospital=HospitalResponse.model_validate(hospital),
        applicant_email=await _applicant_email_for_hospital(session, hospital),
    )


@router.post(
    "/hospital-registrations/{hospital_id}/reject",
    response_model=HospitalRegistrationResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a pending hospital registration",
)
async def reject_hospital_registration(
    hospital_id: uuid.UUID,
    payload: HospitalRegistrationDecision | None = None,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> HospitalRegistrationResponse:
    """Reject a hospital application, keeping its staff account inactive."""
    hospital = await session.get(Hospital, hospital_id)
    if hospital is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital application not found.",
        )

    if hospital.status == HospitalStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot reject a hospital that has already been approved.",
        )

    reason = (payload.reason if payload else None) or "Application rejected."
    hospital.status = HospitalStatus.REJECTED
    hospital.rejection_reason = reason

    # Keep all bound staff accounts inactive so they cannot sign in
    staff_stmt = select(User).where(
        User.hospital_id == hospital.id,
        User.role == UserRole.HOSPITAL_STAFF,
        User.is_active.is_(True),
    )
    staff_users = list((await session.execute(staff_stmt)).scalars().all())
    for staff_user in staff_users:
        staff_user.is_active = False

    await session.commit()
    await session.refresh(hospital)

    logger.info(
        "Hospital registration rejected: %s (%s) reason=%s",
        hospital.name,
        hospital.id,
        reason,
    )
    return HospitalRegistrationResponse(
        hospital=HospitalResponse.model_validate(hospital),
        applicant_email=await _applicant_email_for_hospital(session, hospital),
    )
