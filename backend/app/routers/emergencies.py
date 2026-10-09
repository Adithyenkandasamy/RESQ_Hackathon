"""Emergency management endpoints: creation, retrieval, updates, and audit history."""

from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.auth import get_current_user
from app.core.socket import (
    notify_emergency_status_updated,
    notify_hospital_request_created,
)
from app.database import get_db_session
from app.models.emergency import Emergency
from app.models.emergency_history import EmergencyHistory
from app.models.enums import (
    ALLOWED_STATUS_TRANSITIONS,
    EmergencyStatus,
    HospitalRequestStatus,
    UserRole,
    can_transition,
)
from app.models.hospital import Hospital
from app.models.hospital_request import HospitalRequest
from app.models.user import User
from app.schemas.ai import (
    ExtractionRequest,
    ExtractionVerificationRequest,
    FirstAidGuidanceResponse,
    HandoverConfirmationRequest,
    HandoverSummaryResponse,
    ObservationExtractionResponse,
    TranscriptionResponse,
)
from app.schemas.common import PaginatedResponse
from app.schemas.emergency import (
    EmergencyCreate,
    EmergencyHistoryResponse,
    EmergencyLocationUpdate,
    EmergencyPatientUpdate,
    EmergencyResponse,
    EmergencyStatusUpdate,
)
from app.schemas.hospital_request import (
    ConfirmedAssignmentResponse,
    HospitalMatchCandidateResponse,
    HospitalMatchResponse,
    HospitalRequestResponse,
)
from app.services.elevenlabs import transcribe_audio_file, validate_audio_file
from app.services.groq import (
    extract_observations,
    generate_first_aid,
    generate_handover,
)
from app.services.hospital_matching import HospitalMatchingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/emergencies", tags=["Emergencies"])


async def _check_emergency_access(emergency: Emergency, user: User, session: AsyncSession) -> None:
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
        if user.hospital_id is not None:
            # 1. Confirmed destination hospital always has full access
            if emergency.confirmed_hospital_id == user.hospital_id:
                return
            # 2. Candidate hospital with dispatched admission request
            stmt_req = select(HospitalRequest.id).where(
                HospitalRequest.emergency_id == emergency.id,
                HospitalRequest.hospital_id == user.hospital_id,
            )
            req_res = await session.execute(stmt_req)
            if req_res.scalar_one_or_none() is not None:
                return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Your hospital is not associated with this emergency case.",
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


def _build_emergency_response(emergency: Emergency) -> EmergencyResponse:
    """Build response with distinctly separated location types and AI artifacts."""
    resp = EmergencyResponse.model_validate(emergency)
    state = inspect(emergency)
    amb = state.dict.get("assigned_ambulance")
    if amb is not None and getattr(amb, "latitude", None) is not None:
        resp.ambulance_latitude = amb.latitude
        resp.ambulance_longitude = amb.longitude
        resp.ambulance_location_updated_at = amb.location_updated_at

    hosp = state.dict.get("confirmed_hospital")
    if hosp is not None and getattr(hosp, "name", None) is not None:
        resp.hospital_name = hosp.name
        resp.hospital_latitude = hosp.latitude
        resp.hospital_longitude = hosp.longitude
    return resp


async def _run_post_booking_ai(emergency_id: uuid.UUID) -> None:
    """Background task to run structured observation extraction and handover summaries with Groq."""
    try:
        from app.database import get_db_session

        async for session in get_db_session():
            stmt = (
                select(Emergency)
                .options(
                    selectinload(Emergency.assigned_ambulance),
                    selectinload(Emergency.confirmed_hospital),
                )
                .where(Emergency.id == emergency_id)
            )
            emergency = (await session.execute(stmt)).scalar_one_or_none()
            if not emergency:
                return

            source_text = emergency.incident_description or f"Incident: {emergency.incident_type}"
            if emergency.transcription and emergency.transcription.get("transcript"):
                source_text = f"{source_text}. Audio transcript: {emergency.transcription['transcript']}"

            # Extract structured observations without overwriting coordinates or patient facts
            extraction = await extract_observations(source_text)
            if emergency.ai_extractions is None:
                emergency.ai_extractions = []
            emergency.ai_extractions.append(extraction.model_dump())

            # Prepare initial handover summary draft
            context = {
                "incident_type": emergency.incident_type,
                "incident_description": emergency.incident_description,
                "patient_info": emergency.patient_info,
                "status": emergency.status.value,
                "incident_latitude": emergency.incident_latitude,
                "incident_longitude": emergency.incident_longitude,
            }
            handover = await generate_handover(context)
            emergency.handover_summary = handover.model_dump()
            emergency.updated_at = datetime.now(timezone.utc)

            await session.commit()
            logger.info("Post-booking AI extraction completed for emergency %s", emergency_id)
            break
    except Exception as exc:
        logger.warning("Post-booking AI background processing notice: %s", exc)


@router.post(
    "",
    response_model=EmergencyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new emergency incident",
)
async def create_emergency(
    payload: EmergencyCreate,
    background_tasks: BackgroundTasks,
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

    captured_at = payload.location_captured_at or (
        datetime.now(timezone.utc) if payload.incident_latitude is not None else None
    )

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

    # Eager load relationships for response
    stmt_reload = (
        select(Emergency)
        .options(
            selectinload(Emergency.assigned_ambulance),
            selectinload(Emergency.confirmed_hospital),
        )
        .where(Emergency.id == emergency.id)
    )
    reloaded = (await session.execute(stmt_reload)).scalar_one()

    # Trigger post-booking AI background task asynchronously
    background_tasks.add_task(_run_post_booking_ai, emergency.id)

    logger.info("Emergency incident created: %s by user %s", emergency.id, current_user.id)
    return _build_emergency_response(reloaded)


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
        from sqlalchemy import or_

        req_subquery = select(HospitalRequest.emergency_id).where(
            HospitalRequest.hospital_id == current_user.hospital_id
        )
        base_query = base_query.where(
            or_(
                Emergency.confirmed_hospital_id == current_user.hospital_id,
                Emergency.id.in_(req_subquery),
            )
        )
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

    # Query page items with eager loaded distinct locations
    stmt = (
        base_query.options(
            selectinload(Emergency.assigned_ambulance),
            selectinload(Emergency.confirmed_hospital),
        )
        .order_by(Emergency.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(stmt)
    emergencies = list(result.scalars().all())

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return PaginatedResponse[EmergencyResponse](
        items=[_build_emergency_response(e) for e in emergencies],
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
    stmt = (
        select(Emergency)
        .options(
            selectinload(Emergency.assigned_ambulance),
            selectinload(Emergency.confirmed_hospital),
        )
        .where(Emergency.id == emergency_id)
    )
    result = await session.execute(stmt)
    emergency = result.scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    await _check_emergency_access(emergency, current_user, session)
    return _build_emergency_response(emergency)


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
    return _build_emergency_response(emergency)


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
    return _build_emergency_response(emergency)


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
    return _build_emergency_response(emergency)


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

    await _check_emergency_access(emergency, current_user, session)

    hist_stmt = (
        select(EmergencyHistory)
        .where(EmergencyHistory.emergency_id == emergency_id)
        .order_by(EmergencyHistory.created_at.asc())
    )
    hist_result = await session.execute(hist_stmt)
    entries = list(hist_result.scalars().all())

    return [EmergencyHistoryResponse.model_validate(h) for h in entries]


# ── Phase 3: Hospital Matching & Dispatch ───────────────────────


@router.post(
    "/{emergency_id}/match-hospitals",
    response_model=HospitalMatchResponse,
    summary="Trigger rules-based hospital matching and dispatch admission requests",
)
async def match_and_dispatch_hospitals(
    emergency_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HospitalMatchResponse:
    """Evaluate and rank eligible registered hospitals using deterministic rules-based matching.

    Creates persistent HospitalRequest records and notifies receiving hospital dashboards via Socket.IO.
    """
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    result = await session.execute(stmt)
    emergency = result.scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_update_permission(emergency, current_user)

    if emergency.confirmed_hospital_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Emergency already has a confirmed destination hospital.",
        )

    settings = get_settings()

    # Run deterministic matching
    candidates = await HospitalMatchingService.match_hospitals(
        session=session,
        emergency=emergency,
        max_candidates=settings.HOSPITAL_MATCH_MAX_CANDIDATES,
        search_radius_km=settings.HOSPITAL_MATCH_SEARCH_RADIUS_KM,
    )

    now = datetime.now(timezone.utc)
    deadline = now + timedelta(seconds=settings.HOSPITAL_RESPONSE_TIMEOUT_SECONDS)

    candidate_responses: list[HospitalMatchCandidateResponse] = []
    created_count = 0

    if not candidates:
        # No eligible hospitals within radius -> transition to ESCALATION_REQUIRED
        emergency.status = EmergencyStatus.ESCALATION_REQUIRED
        emergency.updated_at = now

        hist = EmergencyHistory(
            emergency_id=emergency.id,
            actor_user_id=current_user.id,
            event_type="MATCHING_FAILED",
            previous_status=emergency.status.value,
            new_status=EmergencyStatus.ESCALATION_REQUIRED.value,
            details={"reason": "No eligible registered hospitals found within search radius"},
        )
        session.add(hist)
        await session.commit()

        await notify_emergency_status_updated(
            emergency_id=emergency.id,
            new_status=EmergencyStatus.ESCALATION_REQUIRED.value,
            ambulance_id=emergency.assigned_ambulance_id,
        )

        return HospitalMatchResponse(
            emergency_id=emergency.id,
            candidates=[],
            requests_created=0,
        )

    # Eligible hospitals found -> transition to ACCEPTANCE_PENDING
    old_status = emergency.status
    emergency.status = EmergencyStatus.ACCEPTANCE_PENDING
    emergency.updated_at = now

    hist_dispatch = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="DISPATCH_REQUESTS_SENT",
        previous_status=old_status.value,
        new_status=EmergencyStatus.ACCEPTANCE_PENDING.value,
        details={"candidate_count": len(candidates)},
    )
    session.add(hist_dispatch)

    # Persist durable hospital request records
    created_requests: list[HospitalRequest] = []
    for cand in candidates:
        candidate_responses.append(
            HospitalMatchCandidateResponse(
                hospital_id=cand.hospital_id,
                hospital_name=cand.hospital_name,
                distance_km=cand.distance_km,
                composite_score=cand.composite_score,
                capability_score=cand.capability_score,
                availability_score=cand.availability_score,
                proximity_score=cand.proximity_score,
                matched_capabilities=cand.matched_capabilities,
                availability_status=cand.availability_status,
                explanation=cand.explanation,
            )
        )

        # Check if a pending or accepted request already exists for this hospital
        chk_stmt = select(HospitalRequest).where(
            HospitalRequest.emergency_id == emergency.id,
            HospitalRequest.hospital_id == cand.hospital_id,
            HospitalRequest.status.in_(
                [
                    HospitalRequestStatus.PENDING,
                    HospitalRequestStatus.ACCEPTED,
                ]
            ),
        )
        existing = (await session.execute(chk_stmt)).scalar_one_or_none()

        if existing is None:
            new_req = HospitalRequest(
                emergency_id=emergency.id,
                hospital_id=cand.hospital_id,
                status=HospitalRequestStatus.PENDING,
                response_deadline=deadline,
            )
            session.add(new_req)
            created_requests.append(new_req)
            created_count += 1

    await session.commit()

    # Emit Socket.IO events after commit
    for req in created_requests:
        await notify_hospital_request_created(
            hospital_id=req.hospital_id,
            request_id=req.id,
            emergency_id=emergency.id,
            incident_type=emergency.incident_type,
            response_deadline=deadline.isoformat(),
        )

    await notify_emergency_status_updated(
        emergency_id=emergency.id,
        new_status=EmergencyStatus.ACCEPTANCE_PENDING.value,
        ambulance_id=emergency.assigned_ambulance_id,
    )

    logger.info(
        "Hospital matching completed for %s: %d candidates, %d requests dispatched",
        emergency.id,
        len(candidates),
        created_count,
    )

    return HospitalMatchResponse(
        emergency_id=emergency.id,
        candidates=candidate_responses,
        requests_created=created_count,
    )


@router.get(
    "/{emergency_id}/requests",
    response_model=list[HospitalRequestResponse],
    summary="List admission requests dispatched for an emergency",
)
async def get_emergency_requests(
    emergency_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> list[HospitalRequestResponse]:
    """Retrieve all hospital requests generated for this emergency incident."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    emergency = (await session.execute(stmt)).scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    await _check_emergency_access(emergency, current_user, session)

    req_stmt = (
        select(HospitalRequest)
        .where(HospitalRequest.emergency_id == emergency_id)
        .order_by(HospitalRequest.created_at.desc())
    )
    requests = list((await session.execute(req_stmt)).scalars().all())

    return [HospitalRequestResponse.model_validate(r) for r in requests]


@router.get(
    "/{emergency_id}/assignment",
    response_model=ConfirmedAssignmentResponse,
    summary="Retrieve confirmed hospital assignment for an emergency",
)
@router.get(
    "/{emergency_id}/destination",
    response_model=ConfirmedAssignmentResponse,
    summary="Retrieve confirmed hospital destination for an emergency",
    include_in_schema=True,
)
async def get_emergency_assignment(
    emergency_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ConfirmedAssignmentResponse:
    """Retrieve the authoritative confirmed destination hospital."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    emergency = (await session.execute(stmt)).scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    await _check_emergency_access(emergency, current_user, session)

    hospital_name: str | None = None
    if emergency.confirmed_hospital_id:
        h_stmt = select(Hospital.name).where(Hospital.id == emergency.confirmed_hospital_id)
        hospital_name = (await session.execute(h_stmt)).scalar_one_or_none()

    return ConfirmedAssignmentResponse(
        emergency_id=emergency.id,
        confirmed_hospital_id=emergency.confirmed_hospital_id,
        confirmed_hospital_name=hospital_name,
        status=emergency.status.value,
    )


# ── Phase 3: AI Speech Transcription & Clinical Extraction ───────


@router.post(
    "/{emergency_id}/transcription",
    response_model=TranscriptionResponse,
    summary="Transcribe emergency radio/voice audio with ElevenLabs",
)
async def transcribe_emergency_audio(
    emergency_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> TranscriptionResponse:
    """Upload and transcribe scene audio recording. Non-blocking to dispatch."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    emergency = (await session.execute(stmt)).scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_update_permission(emergency, current_user)

    audio_bytes = await file.read()
    filename = file.filename or "recording.wav"
    content_type = file.content_type or "audio/wav"

    try:
        validate_audio_file(filename, content_type, len(audio_bytes))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from None

    # Transcribe via ElevenLabs service
    result = await transcribe_audio_file(audio_bytes, filename, content_type)

    # Persist transcript metadata on emergency
    emergency.transcription = {
        "transcription_id": result["transcription_id"],
        "transcript": result["transcript"],
        "language": result["language"],
        "status": result["processing_status"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    emergency.updated_at = datetime.now(timezone.utc)

    history_entry = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="AUDIO_TRANSCRIBED",
        details={
            "transcription_id": result["transcription_id"],
            "status": result["processing_status"],
        },
    )
    session.add(history_entry)

    await session.commit()

    return TranscriptionResponse(
        transcription_id=result["transcription_id"],
        emergency_id=emergency.id,
        transcript=result["transcript"],
        language=result["language"],
        processing_status=result["processing_status"],
    )


@router.post(
    "/{emergency_id}/ai/extract",
    response_model=ObservationExtractionResponse,
    summary="Extract structured clinical observations with Groq AI",
)
async def extract_emergency_observations(
    emergency_id: uuid.UUID,
    payload: ExtractionRequest | None = None,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> ObservationExtractionResponse:
    """Convert raw text or scene description into validated structured observations."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    emergency = (await session.execute(stmt)).scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    await _check_emergency_access(emergency, current_user, session)

    # Determine input text source
    source_text: str = ""
    if payload and payload.text:
        source_text = payload.text
    elif emergency.transcription and emergency.transcription.get("transcript"):
        source_text = emergency.transcription["transcript"]
    elif emergency.incident_description:
        source_text = emergency.incident_description
    else:
        source_text = f"Incident: {emergency.incident_type}"

    extraction = await extract_observations(source_text)

    # Store extracted observations for review
    if emergency.ai_extractions is None:
        emergency.ai_extractions = []
    emergency.ai_extractions.append(extraction.model_dump())
    emergency.updated_at = datetime.now(timezone.utc)

    await session.commit()

    return ObservationExtractionResponse.model_validate(extraction.model_dump())


@router.post(
    "/{emergency_id}/ai/handover-summary",
    response_model=HandoverSummaryResponse,
    summary="Generate clinical handover summary draft with Groq AI",
)
async def generate_emergency_handover_summary(
    emergency_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HandoverSummaryResponse:
    """Generate concise clinical handover draft for receiving hospital staff."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    emergency = (await session.execute(stmt)).scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    await _check_emergency_access(emergency, current_user, session)

    context = {
        "incident_type": emergency.incident_type,
        "incident_description": emergency.incident_description,
        "patient_info": emergency.patient_info,
        "status": emergency.status.value,
        "incident_latitude": emergency.incident_latitude,
        "incident_longitude": emergency.incident_longitude,
    }

    handover = await generate_handover(context)

    emergency.handover_summary = handover.model_dump()
    emergency.updated_at = datetime.now(timezone.utc)

    await session.commit()

    return HandoverSummaryResponse.model_validate(handover.model_dump())


@router.post(
    "/{emergency_id}/ai/first-aid",
    response_model=FirstAidGuidanceResponse,
    summary="Retrieve constrained first-aid supportive guidance from approved protocols",
)
async def get_emergency_first_aid_guidance(
    emergency_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> FirstAidGuidanceResponse:
    """Get supportive scene first-aid guidance constrained strictly by approved protocols."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    emergency = (await session.execute(stmt)).scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    await _check_emergency_access(emergency, current_user, session)

    guidance = await generate_first_aid(emergency.incident_type)
    return FirstAidGuidanceResponse.model_validate(guidance.model_dump())


@router.post(
    "/{emergency_id}/ai/verify-extractions",
    response_model=EmergencyResponse,
    summary="Review and verify AI-extracted clinical observations by attending crew",
)
async def verify_emergency_extractions(
    emergency_id: uuid.UUID,
    payload: ExtractionVerificationRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> EmergencyResponse:
    """Promote AI-extracted observations to verified patient record after crew review."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    emergency = (await session.execute(stmt)).scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_update_permission(emergency, current_user)

    now = datetime.now(timezone.utc)
    updated_info = dict(emergency.patient_info or {})
    updated_info.update(payload.verified_patient_info)
    if payload.crew_notes:
        updated_info["crew_review_notes"] = payload.crew_notes
    updated_info["observations_verified_by_crew"] = True
    updated_info["verified_at"] = now.isoformat()
    emergency.patient_info = updated_info

    # Mark extractions as reviewed
    if emergency.ai_extractions:
        for ext in emergency.ai_extractions:
            ext["reviewed_by_crew"] = True
            ext["reviewed_at"] = now.isoformat()

    emergency.updated_at = now

    hist = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="OBSERVATIONS_VERIFIED",
        details={
            "verified_fields": list(payload.verified_patient_info.keys()),
            "crew_notes": payload.crew_notes,
        },
    )
    session.add(hist)

    await session.commit()
    await session.refresh(emergency)

    logger.info("Crew verified AI extractions for emergency: %s", emergency.id)
    return _build_emergency_response(emergency)


@router.post(
    "/{emergency_id}/handover/confirm",
    response_model=HandoverSummaryResponse,
    summary="Confirm and approve clinical handover summary by attending crew",
)
async def confirm_handover_summary(
    emergency_id: uuid.UUID,
    payload: HandoverConfirmationRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> HandoverSummaryResponse:
    """Attending crew reviews, edits, and approves clinical handover summary for receiving hospital."""
    stmt = select(Emergency).where(Emergency.id == emergency_id)
    emergency = (await session.execute(stmt)).scalar_one_or_none()

    if emergency is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency incident not found.",
        )

    _check_emergency_update_permission(emergency, current_user)

    if not emergency.handover_summary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No handover summary exists to confirm. Generate handover draft first.",
        )

    now = datetime.now(timezone.utc)
    summary_data = dict(emergency.handover_summary)
    summary_data["review_status"] = "CONFIRMED_BY_CREW" if payload.approved else "REJECTED_BY_CREW"
    summary_data["confirmed_at"] = now.isoformat()
    summary_data["confirmed_by_id"] = str(current_user.id)
    if payload.crew_notes:
        summary_data["crew_notes"] = payload.crew_notes

    emergency.handover_summary = summary_data
    emergency.updated_at = now

    hist = EmergencyHistory(
        emergency_id=emergency.id,
        actor_user_id=current_user.id,
        event_type="HANDOVER_SUMMARY_CONFIRMED",
        details={
            "approved": payload.approved,
            "crew_notes": payload.crew_notes,
        },
    )
    session.add(hist)

    await session.commit()

    # Emit real-time notification to confirmed hospital room if hospital is confirmed
    if emergency.confirmed_hospital_id:
        from app.core.socket import create_event_envelope, sio

        envelope = create_event_envelope(
            event_type="emergency.handover_confirmed",
            resource_id=str(emergency.id),
            data={
                "emergency_id": str(emergency.id),
                "review_status": summary_data["review_status"],
                "handover_summary": summary_data,
            },
        )
        await sio.emit(
            "emergency.handover_confirmed",
            envelope,
            room=f"hospital:{emergency.confirmed_hospital_id}",
        )

    return HandoverSummaryResponse.model_validate(summary_data)
