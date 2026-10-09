"""Automated tests for hospital management and capacity reporting."""

from __future__ import annotations

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.hospital import Hospital
from app.models.user import User


class TestHospitalEndpoints:
    """Test hospital listing, creation, and profile/availability updates."""

    async def test_list_hospitals_paginated(
        self,
        client: httpx.AsyncClient,
        sample_hospital: Hospital,
        other_hospital: Hospital,
        admin_headers: dict[str, str],
    ) -> None:
        response = await client.get("/api/v1/hospitals?page=1&page_size=10", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert data["total_pages"] == 1

    async def test_list_hospitals_unauthenticated(
        self, client: httpx.AsyncClient, sample_hospital: Hospital
    ) -> None:
        response = await client.get("/api/v1/hospitals")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"

    async def test_admin_create_hospital_success(
        self, client: httpx.AsyncClient, admin_headers: dict[str, str]
    ) -> None:
        payload = {
            "name": "City Children's Hospital",
            "registration_identifier": "HOSP-CHILD-003",
            "address": "77 Kids Way, Metro City",
            "latitude": 37.7650,
            "longitude": -122.4200,
            "contact_number": "+1-555-0300",
            "capabilities": ["PEDIATRIC", "NICU"],
            "reported_availability": {"er_beds": 8, "accepting_patients": True},
        }
        response = await client.post("/api/v1/hospitals", json=payload, headers=admin_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["registration_identifier"] == payload["registration_identifier"]
        assert data["capabilities"] == ["PEDIATRIC", "NICU"]
        assert data["reported_availability"]["er_beds"] == 8

    async def test_admin_create_hospital_duplicate_identifier_conflict(
        self,
        client: httpx.AsyncClient,
        sample_hospital: Hospital,
        admin_headers: dict[str, str],
    ) -> None:
        payload = {
            "name": "Duplicate Identifier Hospital",
            "registration_identifier": sample_hospital.registration_identifier,
            "address": "123 Test St",
            "latitude": 37.7000,
            "longitude": -122.4000,
            "contact_number": "+1-555-9999",
        }
        response = await client.post("/api/v1/hospitals", json=payload, headers=admin_headers)
        assert response.status_code == 409
        data = response.json()
        assert data["error"]["code"] == "CONFLICT"
        assert "already exists" in data["error"]["message"]

    async def test_hospital_staff_cannot_create_hospital(
        self, client: httpx.AsyncClient, hospital_headers: dict[str, str]
    ) -> None:
        payload = {
            "name": "Unauthorized Hospital",
            "registration_identifier": "HOSP-UNAUTH-001",
            "address": "123 Nowhere St",
            "latitude": 37.7000,
            "longitude": -122.4000,
            "contact_number": "+1-555-0000",
        }
        response = await client.post("/api/v1/hospitals", json=payload, headers=hospital_headers)
        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "FORBIDDEN"

    async def test_get_current_hospital_me(
        self,
        client: httpx.AsyncClient,
        sample_hospital: Hospital,
        hospital_headers: dict[str, str],
    ) -> None:
        response = await client.get("/api/v1/hospitals/me", headers=hospital_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(sample_hospital.id)
        assert data["name"] == sample_hospital.name
        assert data["registration_identifier"] == sample_hospital.registration_identifier

    async def test_update_current_hospital_profile(
        self,
        client: httpx.AsyncClient,
        sample_hospital: Hospital,
        hospital_headers: dict[str, str],
    ) -> None:
        update_payload = {
            "name": "Metro General Hospital - Renamed",
            "contact_number": "+1-555-9999",
        }
        response = await client.patch(
            "/api/v1/hospitals/me", json=update_payload, headers=hospital_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Metro General Hospital - Renamed"
        assert data["contact_number"] == "+1-555-9999"

    async def test_update_current_hospital_availability(
        self,
        client: httpx.AsyncClient,
        sample_hospital: Hospital,
        hospital_headers: dict[str, str],
    ) -> None:
        avail_payload = {
            "reported_availability": {
                "icu_beds_available": 1,
                "er_beds_available": 0,
                "accepting_patients": False,
            }
        }
        response = await client.patch(
            "/api/v1/hospitals/me/availability", json=avail_payload, headers=hospital_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["reported_availability"]["icu_beds_available"] == 1
        assert data["reported_availability"]["accepting_patients"] is False
        assert data["availability_updated_at"] is not None

    async def test_hospital_staff_without_hospital_returns_404(
        self, client: httpx.AsyncClient, db_session: AsyncSession
    ) -> None:
        unassigned_staff = User(
            email="unassigned.staff@ercs.org",
            password_hash=hash_password("Pass123!"),
            role=UserRole.HOSPITAL_STAFF,
            is_active=True,
            hospital_id=None,
        )
        db_session.add(unassigned_staff)
        await db_session.commit()

        from app.core.security import create_access_token

        token = create_access_token(
            {
                "sub": str(unassigned_staff.id),
                "email": unassigned_staff.email,
                "role": unassigned_staff.role.value,
            }
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.get("/api/v1/hospitals/me", headers=headers)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    async def test_cross_hospital_isolation(
        self,
        client: httpx.AsyncClient,
        sample_hospital: Hospital,
        other_hospital: Hospital,
        hospital_headers: dict[str, str],
        other_hospital_headers: dict[str, str],
    ) -> None:
        """Hospital A staff updates their hospital, Hospital B staff updates theirs.

        Each staff member's PATCH only modifies their own hospital and does not affect the other.
        """
        # Staff A updates hospital A
        resp_a = await client.patch(
            "/api/v1/hospitals/me/availability",
            json={"reported_availability": {"icu_beds": 10}},
            headers=hospital_headers,
        )
        assert resp_a.status_code == 200
        assert resp_a.json()["id"] == str(sample_hospital.id)

        # Staff B updates hospital B
        resp_b = await client.patch(
            "/api/v1/hospitals/me/availability",
            json={"reported_availability": {"icu_beds": 2}},
            headers=other_hospital_headers,
        )
        assert resp_b.status_code == 200
        assert resp_b.json()["id"] == str(other_hospital.id)

        # Check Hospital A's availability was not altered by B
        check_a = await client.get("/api/v1/hospitals/me", headers=hospital_headers)
        assert check_a.json()["reported_availability"]["icu_beds"] == 10
