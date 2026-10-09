"""Automated tests for hospital self-registration and admin approval workflow."""

from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import HospitalStatus, UserRole
from app.models.hospital import Hospital
from app.models.user import User


def _registration_payload(suffix: str = "001") -> dict[str, object]:
    return {
        "name": f"Riverside Medical Center {suffix}",
        "registration_identifier": f"HOSP-RIVER-{suffix}",
        "address": "10 Riverside Drive, Metro City",
        "latitude": 37.7800,
        "longitude": -122.4100,
        "contact_number": "+1-555-0400",
        "capabilities": ["ICU", "TRAUMA_LEVEL_2"],
        "applicant_email": f"admin.riverside{suffix}@hospital.org",
        "password": "SecureHospitalPass1!",
    }


class TestHospitalRegistration:
    """Hospital self-registration creates a PENDING application and inactive staff."""

    async def test_public_registration_creates_pending_hospital(
        self, client: httpx.AsyncClient, db_session: AsyncSession
    ) -> None:
        response = await client.post(
            "/api/v1/hospitals/register", json=_registration_payload()
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "PENDING"
        assert data["registration_identifier"] == "HOSP-RIVER-001"
        assert data["applicant_email"] == "admin.riverside001@hospital.org"

        hospital = (
            await db_session.execute(
                select(Hospital).where(
                    Hospital.registration_identifier == "HOSP-RIVER-001"
                )
            )
        ).scalar_one()
        assert hospital.status == HospitalStatus.PENDING

        staff = (
            await db_session.execute(
                select(User).where(
                    User.email == "admin.riverside001@hospital.org"
                )
            )
        ).scalar_one()
        assert staff.role == UserRole.HOSPITAL_STAFF
        assert staff.is_active is False
        assert staff.hospital_id == hospital.id

    async def test_registration_pending_hospital_hidden_from_directory(
        self,
        client: httpx.AsyncClient,
        admin_headers: dict[str, str],
    ) -> None:
        await client.post("/api/v1/hospitals/register", json=_registration_payload("002"))
        response = await client.get("/api/v1/hospitals", headers=admin_headers)
        assert response.status_code == 200
        identifiers = [h["registration_identifier"] for h in response.json()["items"]]
        assert "HOSP-RIVER-002" not in identifiers

    async def test_registration_duplicate_email_conflict(
        self, client: httpx.AsyncClient, db_session: AsyncSession
    ) -> None:
        first = await client.post(
            "/api/v1/hospitals/register", json=_registration_payload("003")
        )
        assert first.status_code == 201

        duplicate = _registration_payload("004")
        duplicate["applicant_email"] = "admin.riverside003@hospital.org"
        response = await client.post("/api/v1/hospitals/register", json=duplicate)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "CONFLICT"

    async def test_registration_duplicate_identifier_conflict(
        self, client: httpx.AsyncClient
    ) -> None:
        await client.post("/api/v1/hospitals/register", json=_registration_payload("005"))
        duplicate = _registration_payload("006")
        duplicate["registration_identifier"] = "HOSP-RIVER-005"
        response = await client.post("/api/v1/hospitals/register", json=duplicate)
        assert response.status_code == 409

    async def test_pending_staff_cannot_login(
        self, client: httpx.AsyncClient
    ) -> None:
        await client.post("/api/v1/hospitals/register", json=_registration_payload("007"))
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin.riverside007@hospital.org",
                "password": "SecureHospitalPass1!",
            },
        )
        assert response.status_code == 401
        assert "pending" in response.json()["error"]["message"].lower()


class TestHospitalRegistrationApproval:
    """Admin review actions gate hospital staff login access."""

    async def test_admin_sees_pending_registrations(
        self,
        client: httpx.AsyncClient,
        admin_headers: dict[str, str],
    ) -> None:
        await client.post("/api/v1/hospitals/register", json=_registration_payload("010"))
        response = await client.get(
            "/api/v1/admin/hospital-registrations?status=PENDING",
            headers=admin_headers,
        )
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1
        assert items[0]["hospital"]["registration_identifier"] == "HOSP-RIVER-010"
        assert items[0]["applicant_email"] == "admin.riverside010@hospital.org"

    async def test_approval_activates_staff_and_allows_login(
        self,
        client: httpx.AsyncClient,
        admin_headers: dict[str, str],
    ) -> None:
        created = await client.post(
            "/api/v1/hospitals/register", json=_registration_payload("011")
        )
        hospital_id = created.json()["hospital_id"]

        approve = await client.post(
            f"/api/v1/admin/hospital-registrations/{hospital_id}/approve",
            headers=admin_headers,
        )
        assert approve.status_code == 200
        assert approve.json()["hospital"]["status"] == "APPROVED"

        login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin.riverside011@hospital.org",
                "password": "SecureHospitalPass1!",
            },
        )
        assert login.status_code == 200
        assert "access_token" in login.json()

        # Approved hospital now appears in the directory
        directory = await client.get("/api/v1/hospitals", headers=admin_headers)
        identifiers = [h["registration_identifier"] for h in directory.json()["items"]]
        assert "HOSP-RIVER-011" in identifiers

    async def test_rejection_keeps_staff_locked_out(
        self,
        client: httpx.AsyncClient,
        admin_headers: dict[str, str],
    ) -> None:
        created = await client.post(
            "/api/v1/hospitals/register", json=_registration_payload("012")
        )
        hospital_id = created.json()["hospital_id"]

        reject = await client.post(
            f"/api/v1/admin/hospital-registrations/{hospital_id}/reject",
            json={"reason": "Incomplete accreditation documents."},
            headers=admin_headers,
        )
        assert reject.status_code == 200
        assert reject.json()["hospital"]["status"] == "REJECTED"
        assert (
            reject.json()["hospital"]["rejection_reason"]
            == "Incomplete accreditation documents."
        )

        login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "admin.riverside012@hospital.org",
                "password": "SecureHospitalPass1!",
            },
        )
        assert login.status_code == 401
        assert "not approved" in login.json()["error"]["message"].lower()

    async def test_non_admin_cannot_review_registrations(
        self,
        client: httpx.AsyncClient,
        hospital_headers: dict[str, str],
    ) -> None:
        response = await client.get(
            "/api/v1/admin/hospital-registrations", headers=hospital_headers
        )
        assert response.status_code == 403

    async def test_approving_unknown_hospital_returns_404(
        self,
        client: httpx.AsyncClient,
        admin_headers: dict[str, str],
    ) -> None:
        response = await client.post(
            "/api/v1/admin/hospital-registrations/00000000-0000-0000-0000-000000000000/approve",
            headers=admin_headers,
        )
        assert response.status_code == 404
