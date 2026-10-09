"""Administration endpoints: operational dashboard and administrative oversight."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_roles
from app.database import get_db_session
from app.models.ambulance import Ambulance
from app.models.emergency import Emergency
from app.models.enums import AmbulanceStatus, EmergencyStatus, UserRole
from app.models.hospital import Hospital
from app.models.user import User
from app.schemas.admin import AdminDashboardResponse

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
