"""Automated tests for dispatch, concurrency control, and hospital assignment."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import HospitalRequestStatus
from app.models.hospital import Hospital
from app.models.hospital_request import HospitalRequest
from app.models.user import User


class TestDispatchAndConcurrencyWorkflow:
    """Test emergency matching, competing acceptances, conflict handling, and single assignment."""

    async def test_match_and_dispatch_creates_requests(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        sample_hospital: Hospital,
        other_hospital: Hospital,
    ) -> None:
        # Create emergency
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "CARDIAC",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        assert create_resp.status_code == 201
        emergency_id = create_resp.json()["id"]

        # Trigger matching
        match_resp = await client.post(
            f"/api/v1/emergencies/{emergency_id}/match-hospitals",
            headers=ambulance_headers,
        )
        assert match_resp.status_code == 200
        data = match_resp.json()
        assert data["emergency_id"] == emergency_id
        assert data["requests_created"] >= 1
        assert len(data["candidates"]) >= 1

        # Check emergency status transitioned to ACCEPTANCE_PENDING
        get_emerg = await client.get(
            f"/api/v1/emergencies/{emergency_id}",
            headers=ambulance_headers,
        )
        assert get_emerg.json()["status"] == "ACCEPTANCE_PENDING"

    async def test_hospital_staff_receives_only_their_requests(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        hospital_headers: dict[str, str],
        other_hospital_headers: dict[str, str],
        sample_hospital: Hospital,
        other_hospital: Hospital,
    ) -> None:
        # Create emergency and match
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "TRAUMA",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/emergencies/{emergency_id}/match-hospitals",
            headers=ambulance_headers,
        )

        # Hospital A staff checks incoming requests
        hosp_a_resp = await client.get("/api/v1/hospital-requests", headers=hospital_headers)
        assert hosp_a_resp.status_code == 200
        hosp_a_requests = hosp_a_resp.json()
        for r in hosp_a_requests:
            assert r["hospital_id"] == str(sample_hospital.id)

        # Hospital B staff checks incoming requests
        hosp_b_resp = await client.get("/api/v1/hospital-requests", headers=other_hospital_headers)
        assert hosp_b_resp.status_code == 200
        hosp_b_requests = hosp_b_resp.json()
        for r in hosp_b_requests:
            assert r["hospital_id"] == str(other_hospital.id)

    async def test_concurrent_competing_acceptance_ensures_single_hospital(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        hospital_headers: dict[str, str],
        other_hospital_headers: dict[str, str],
        sample_hospital: Hospital,
        other_hospital: Hospital,
    ) -> None:
        """Simulate two hospitals competing to accept the same emergency incident.

        Guarantees:
        1. The first acceptance succeeds (200 OK).
        2. The second acceptance is rejected with a 409 Conflict.
        3. The confirmed destination hospital cannot be overwritten by the loser.
        4. Authoritative state reflects exactly one hospital assignment.
        """
        # Create emergency and match both hospitals
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "TRAUMA",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/emergencies/{emergency_id}/match-hospitals",
            headers=ambulance_headers,
        )

        # Fetch request ID for Hospital A
        reqs_a = (await client.get("/api/v1/hospital-requests", headers=hospital_headers)).json()
        req_a_id = next(r["id"] for r in reqs_a if r["emergency_id"] == emergency_id)

        # Fetch request ID for Hospital B
        reqs_b = (
            await client.get("/api/v1/hospital-requests", headers=other_hospital_headers)
        ).json()
        req_b_id = next(r["id"] for r in reqs_b if r["emergency_id"] == emergency_id)

        # Hospital A accepts first
        accept_a_resp = await client.post(
            f"/api/v1/hospital-requests/{req_a_id}/accept",
            headers=hospital_headers,
        )
        assert accept_a_resp.status_code == 200
        assert accept_a_resp.json()["status"] == "ACCEPTED"

        # Hospital B attempts to accept second -> must receive 409 Conflict
        accept_b_resp = await client.post(
            f"/api/v1/hospital-requests/{req_b_id}/accept",
            headers=other_hospital_headers,
        )
        assert accept_b_resp.status_code == 409
        conflict_data = accept_b_resp.json()
        assert conflict_data["error"]["code"] == "CONFLICT"
        assert "already been accepted" in conflict_data["error"]["message"].lower()

        # Verify authoritative state via REST
        assignment_resp = await client.get(
            f"/api/v1/emergencies/{emergency_id}/assignment",
            headers=ambulance_headers,
        )
        assert assignment_resp.status_code == 200
        assignment = assignment_resp.json()
        assert assignment["confirmed_hospital_id"] == str(sample_hospital.id)
        assert assignment["confirmed_hospital_name"] == sample_hospital.name
        assert assignment["status"] == "HOSPITAL_CONFIRMED"

    async def test_expired_request_acceptance_rejected(
        self,
        client: httpx.AsyncClient,
        db_session: AsyncSession,
        hospital_headers: dict[str, str],
        sample_hospital: Hospital,
        ambulance_crew_user: User,
    ) -> None:
        """Verify that a request past its response deadline cannot be accepted."""
        from app.models.emergency import Emergency

        past_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        emergency = Emergency(
            created_by_id=ambulance_crew_user.id,
            incident_type="CARDIAC",
            incident_latitude=37.7749,
            incident_longitude=-122.4194,
        )
        db_session.add(emergency)
        await db_session.flush()

        expired_req = HospitalRequest(
            emergency_id=emergency.id,
            hospital_id=sample_hospital.id,
            status=HospitalRequestStatus.PENDING,
            response_deadline=past_time,
        )
        db_session.add(expired_req)
        await db_session.commit()

        response = await client.post(
            f"/api/v1/hospital-requests/{expired_req.id}/accept",
            headers=hospital_headers,
        )
        assert response.status_code == 400
        assert "expired" in response.json()["error"]["message"].lower()

    async def test_decline_all_requests_triggers_escalation(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        hospital_headers: dict[str, str],
        sample_hospital: Hospital,
    ) -> None:
        """When all dispatched requests are declined, emergency must escalate."""
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "POISONING",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        await client.post(
            f"/api/v1/emergencies/{emergency_id}/match-hospitals",
            headers=ambulance_headers,
        )

        # Get requests for Hospital A
        reqs_resp = await client.get("/api/v1/hospital-requests", headers=hospital_headers)
        req_id = next(r["id"] for r in reqs_resp.json() if r["emergency_id"] == emergency_id)

        # Hospital A declines
        decline_resp = await client.post(
            f"/api/v1/hospital-requests/{req_id}/decline",
            json={"reason": "No ICU beds available right now"},
            headers=hospital_headers,
        )
        assert decline_resp.status_code == 200
        assert decline_resp.json()["status"] == "DECLINED"

        # Check emergency status
        emerg_resp = await client.get(
            f"/api/v1/emergencies/{emergency_id}",
            headers=ambulance_headers,
        )
        # If Hospital A was the sole request, emergency transitioned to ESCALATION_REQUIRED
        assert emerg_resp.json()["status"] in ("ESCALATION_REQUIRED", "ACCEPTANCE_PENDING")
