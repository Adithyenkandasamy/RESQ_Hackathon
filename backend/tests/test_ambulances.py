"""Automated tests for ambulance operations and availability."""

from __future__ import annotations

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.ambulance import Ambulance
from app.models.enums import UserRole
from app.models.user import User


class TestAmbulanceEndpoints:
    """Test ambulance crew retrieval and availability updates."""

    async def test_get_current_ambulance_me(
        self,
        client: httpx.AsyncClient,
        sample_ambulance: Ambulance,
        ambulance_headers: dict[str, str],
    ) -> None:
        response = await client.get("/api/v1/ambulances/me", headers=ambulance_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(sample_ambulance.id)
        assert data["registration_identifier"] == sample_ambulance.registration_identifier
        assert data["operational_status"] == "AVAILABLE"

    async def test_update_ambulance_availability(
        self,
        client: httpx.AsyncClient,
        sample_ambulance: Ambulance,
        ambulance_headers: dict[str, str],
    ) -> None:
        payload = {"operational_status": "BUSY"}
        response = await client.patch(
            "/api/v1/ambulances/me/availability", json=payload, headers=ambulance_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["operational_status"] == "BUSY"

    async def test_crew_without_ambulance_returns_404(
        self, client: httpx.AsyncClient, db_session: AsyncSession
    ) -> None:
        unassigned_crew = User(
            email="unassigned.crew@ercs.org",
            password_hash=hash_password("Pass123!"),
            role=UserRole.AMBULANCE_CREW,
            is_active=True,
            ambulance_id=None,
        )
        db_session.add(unassigned_crew)
        await db_session.commit()

        from app.core.security import create_access_token

        token = create_access_token(
            {
                "sub": str(unassigned_crew.id),
                "email": unassigned_crew.email,
                "role": unassigned_crew.role.value,
            }
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get("/api/v1/ambulances/me", headers=headers)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    async def test_hospital_staff_cannot_access_ambulance_endpoints(
        self, client: httpx.AsyncClient, hospital_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/ambulances/me", headers=hospital_headers)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN"

    async def test_unauthenticated_ambulance_access_denied(
        self, client: httpx.AsyncClient
    ) -> None:
        response = await client.get("/api/v1/ambulances/me")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"
