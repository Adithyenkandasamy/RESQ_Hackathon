"""Hospital admission request endpoints: listing, concurrency-safe acceptance, and decline."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.socket import (
    notify_emergency_status_updated,
    notify_hospital_assigned,
    notify_hospital_request_accepted,
    notify_hospital_request_declined,
)
from app.database import get_db_session
from app.models.emergency import Emergency
from app.models.emergency_history import EmergencyHistory
from app.models.enums import EmergencyStatus, HospitalRequestStatus, UserRole
from app.models.hospital import Hospital
from app.models.hospital_request import HospitalRequest
from app.models.user import User
from app.schemas.hospital_request import (
    HospitalRequestDeclinePayload,
    HospitalRequestResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hospital-requests", tags=["Hospital Requests"])


def _verify_hospital_staff_for_request(request: HospitalRequest, user: User) -> None:
    """Verify that caller is authorized staff for the targeted hospital."""
    if user.role == UserRole.ADMIN:
        return

    if user.role != UserRole.HOSPITAL_STAFF or user.hospital_id != request.hospital_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to respond for this hospital.",
        )


@router.get(
    "",
    response_model=list[HospitalRequestResponse],
    summary="List admission requests for current hospital",
)
async def list_hospital_requests(
    status_filter: HospitalRequestStatus | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[HospitalRequestResponse]:
    """Retrieve hospital admission requests.

    Hospital staff only see requests directed to their assigned hospital.
    Administrators can see all requests.
    """
    stmt = select(HospitalRequest)

    if current_user.role == UserRole.HOSPITAL_STAFF:
        if current_user.hospital_id is None:
            return []
        stmt = stmt.where(HospitalRequest.hospital_id == current_user.hospital_id)
    elif current_user.role == UserRole.ADMIN:
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role not authorized to access hospital admission requests.",
        )

    if status_filter is not None:
        stmt = stmt.where(HospitalRequest.status == status_filter)

    stmt = stmt.order_by(HospitalRequest.created_at.desc())
    result = await session.execute(stmt)
    requests = list(result.scalars().all())

    return [HospitalRequestResponse.model_validate(r) for r in requests]


@router.get(
    "/{request_id}",
    response_model=HospitalRequestResponse,
    summary="Get hospital admission request details",
)
async def get_hospital_request(
    request_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HospitalRequestResponse:
    """Retrieve details of a specific hospital request."""
    stmt = select(HospitalRequest).where(HospitalRequest.id == request_id)
    result = await session.execute(stmt)
    req = result.scalar_one_or_none()

    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital admission request not found.",
        )

    _verify_hospital_staff_for_request(req, current_user)
    return HospitalRequestResponse.model_validate(req)


@router.post(
    "/{request_id}/accept",
    response_model=HospitalRequestResponse,
    summary="Accept an inbound emergency admission request (Concurrency Safe)",
)
async def accept_hospital_request(
    request_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HospitalRequestResponse:
    """Accept an emergency request with strict PostgreSQL row-level concurrency locking.

    Guarantees that competing concurrent acceptance attempts from multiple hospitals
    will safely result in exactly one winning destination assignment and a 409 Conflict
    for losing requests.
    """
    # 1. Fetch hospital request
    stmt_req = select(HospitalRequest).where(HospitalRequest.id == request_id)
    result_req = await session.execute(stmt_req)
    req = result_req.scalar_one_or_none()

    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital admission request not found.",
        )

    _verify_hospital_staff_for_request(req, current_user)

    now = datetime.now(timezone.utc)

    # Idempotent return if already accepted by this hospital
    if req.status == HospitalRequestStatus.ACCEPTED:
        return HospitalRequestResponse.model_validate(req)

    # If request was already cancelled, check if another hospital won the assignment
    if req.status == HospitalRequestStatus.CANCELLED:
        stmt_e = select(Emergency).where(Emergency.id == req.emergency_id)
        res_e = await session.execute(stmt_e)
        emerg_obj = res_e.scalar_one_or_none()
        if emerg_obj is not None and emerg_obj.confirmed_hospital_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Emergency has already been accepted by another hospital.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot accept request in 'CANCELLED' state.",
        )

    # Reject if request is expired or declined
    if req.status in (
        HospitalRequestStatus.DECLINED,
        HospitalRequestStatus.EXPIRED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept request in '{req.status.value}' state.",
        )

    # Check response deadline
    deadline = req.response_deadline
    if deadline is not None and deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if deadline is not None and deadline < now:
        req.status = HospitalRequestStatus.EXPIRED
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admission request response deadline has expired.",
        )

    # 2. Acquire exclusive row-level lock on the Emergency record
    # This prevents any concurrent transaction from modifying the emergency assignment.
    stmt_emerg = select(Emergency).where(Emergency.id == req.emergency_id).with_for_update()
    result_emerg = await session.execute(stmt_emerg)
    emergency = result_emerg.scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated emergency incident not found.",
        )

    # 3. Verify single hospital assignment guarantee
    if emergency.confirmed_hospital_id is not None:
        # A competing hospital has already successfully committed acceptance
        req.status = HospitalRequestStatus.CANCELLED
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Emergency has already been accepted by another hospital.",
        )

    # Fetch hospital name for audit and notifications
    stmt_hosp = select(Hospital).where(Hospital.id == req.hospital_id)
    hosp_res = await session.execute(stmt_hosp)
    hospital = hosp_res.scalar_one()

    # 4. Commit winning assignment within the transaction
    req.status = HospitalRequestStatus.ACCEPTED
    req.responded_at = now

    old_status = emergency.status
    emergency.confirmed_hospital_id = req.hospital_id
    emergency.status = EmergencyStatus.HOSPITAL_CONFIRMED
    emergency.updated_at = now

    # Cancel all other pending requests for this emergency
    cancel_stmt = (
        update(HospitalRequest)
        .where(
            HospitalRequest.emergency_id == emergency.id,
            HospitalRequest.id != req.id,
            HospitalRequest.status == HospitalRequestStatus.PENDING,
        )
        .values(status=HospitalRequestStatus.CANCELLED)
    )
    await session.execute(cancel_stmt)

    # Record in emergency audit history
    history_entry = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="HOSPITAL_ASSIGNMENT",
        previous_status=old_status.value,
        new_status=EmergencyStatus.HOSPITAL_CONFIRMED.value,
        details={
            "confirmed_hospital_id": str(hospital.id),
            "hospital_name": hospital.name,
            "request_id": str(req.id),
        },
    )
    session.add(history_entry)

    # Commit all state changes atomically
    await session.commit()
    await session.refresh(req)

    logger.info(
        "Emergency %s successfully assigned to hospital %s (%s)",
        emergency.id,
        hospital.name,
        hospital.id,
    )

    # 5. Emit real-time Socket.IO notifications AFTER transaction commit
    await notify_hospital_request_accepted(
        hospital_id=req.hospital_id,
        request_id=req.id,
        emergency_id=emergency.id,
    )
    await notify_hospital_assigned(
        emergency_id=emergency.id,
        hospital_id=hospital.id,
        hospital_name=hospital.name,
        ambulance_id=emergency.assigned_ambulance_id,
    )
    await notify_emergency_status_updated(
        emergency_id=emergency.id,
        new_status=EmergencyStatus.HOSPITAL_CONFIRMED.value,
        ambulance_id=emergency.assigned_ambulance_id,
        hospital_id=hospital.id,
    )

    return HospitalRequestResponse.model_validate(req)


@router.post(
    "/{request_id}/decline",
    response_model=HospitalRequestResponse,
    summary="Decline an inbound emergency admission request",
)
async def decline_hospital_request(
    request_id: uuid.UUID,
    payload: HospitalRequestDeclinePayload | None = None,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HospitalRequestResponse:
    """Decline an admission request. Idempotent if already declined."""
    stmt_req = select(HospitalRequest).where(HospitalRequest.id == request_id)
    result_req = await session.execute(stmt_req)
    req = result_req.scalar_one_or_none()

    if req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital admission request not found.",
        )

    _verify_hospital_staff_for_request(req, current_user)

    # Idempotent response if already declined
    if req.status == HospitalRequestStatus.DECLINED:
        return HospitalRequestResponse.model_validate(req)

    if req.status == HospitalRequestStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot decline a request that has already been accepted.",
        )

    now = datetime.now(timezone.utc)
    reason = payload.reason if payload else None

    req.status = HospitalRequestStatus.DECLINED
    req.response_reason = reason
    req.responded_at = now

    # Check if this was the last pending request for this emergency
    stmt_pending = select(HospitalRequest).where(
        HospitalRequest.emergency_id == req.emergency_id,
        HospitalRequest.id != req.id,
        HospitalRequest.status == HospitalRequestStatus.PENDING,
    )
    pending_res = await session.execute(stmt_pending)
    remaining_pending = list(pending_res.scalars().all())

    # Fetch emergency to check if already confirmed
    stmt_emerg = select(Emergency).where(Emergency.id == req.emergency_id)
    emerg_res = await session.execute(stmt_emerg)
    emergency = emerg_res.scalar_one()

    # If no pending requests left and hospital is unconfirmed, escalate
    if not remaining_pending and emergency.confirmed_hospital_id is None:
        emergency.status = EmergencyStatus.ESCALATION_REQUIRED
        emergency.updated_at = now

        history_entry = EmergencyHistory(
            emergency_id=emergency.id,
            actor_user_id=current_user.id,
            event_type="DISPATCH_ESCALATION",
            previous_status=EmergencyStatus.ACCEPTANCE_PENDING.value,
            new_status=EmergencyStatus.ESCALATION_REQUIRED.value,
            details={"reason": "All dispatched hospital requests declined"},
        )
        session.add(history_entry)

    await session.commit()
    await session.refresh(req)

    logger.info("Hospital request %s declined by hospital %s", req.id, req.hospital_id)

    # Emit Socket.IO notification after commit
    await notify_hospital_request_declined(
        hospital_id=req.hospital_id,
        request_id=req.id,
        emergency_id=emergency.id,
        reason=reason,
    )
    if emergency.status == EmergencyStatus.ESCALATION_REQUIRED:
        await notify_emergency_status_updated(
            emergency_id=emergency.id,
            new_status=EmergencyStatus.ESCALATION_REQUIRED.value,
            ambulance_id=emergency.assigned_ambulance_id,
        )

    return HospitalRequestResponse.model_validate(req)
