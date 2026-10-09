"""Phase 4 comprehensive integration, cross-tenant security, and end-to-end workflow tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx

from app.core.socket import join_room, sio
from app.models.ambulance import Ambulance
from app.models.enums import EmergencyStatus, HospitalRequestStatus
from app.models.hospital import Hospital
from app.models.user import User


class TestPhase4EndToEndAndSecurityWorkflows:
    """Comprehensive end-to-end workflow, data integrity, and security test suite."""

    async def test_cross_hospital_isolation_denies_unrelated_hospital(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        hospital_headers: dict[str, str],
        other_hospital_headers: dict[str, str],
        sample_hospital: Hospital,
        other_hospital: Hospital,
    ) -> None:
        """Verify that an unrelated hospital cannot access emergency data or destination."""
        # 1. Ambulance crew creates emergency
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "CARDIAC",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
                "patient_info": {"name": "Confidential Patient", "chief_complaint": "Chest Pain"},
            },
            headers=ambulance_headers,
        )
        assert create_resp.status_code == 201
        emergency_id = create_resp.json()["id"]

        # 2. Before any dispatch, sample_hospital (unrelated at this point) receives 403 Forbidden
        denied_get = await client.get(
            f"/api/v1/emergencies/{emergency_id}",
            headers=hospital_headers,
        )
        assert denied_get.status_code == 403
        assert "not associated with this emergency" in denied_get.json()["error"]["message"]

        # 3. Destination endpoint also denies unrelated hospital
        denied_dest = await client.get(
            f"/api/v1/emergencies/{emergency_id}/destination",
            headers=hospital_headers,
        )
        assert denied_dest.status_code == 403

        # 4. History endpoint denies unrelated hospital
        denied_hist = await client.get(
            f"/api/v1/emergencies/{emergency_id}/history",
            headers=hospital_headers,
        )
        assert denied_hist.status_code == 403

    async def test_dispatched_hospital_can_view_incident_details(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        hospital_headers: dict[str, str],
        sample_hospital: Hospital,
    ) -> None:
        """Verify that a hospital with an inbound admission request is authorized to view case details."""
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

        # Dispatch requests to matching hospitals
        await client.post(
            f"/api/v1/emergencies/{emergency_id}/match-hospitals",
            headers=ambulance_headers,
        )

        # Now sample_hospital has an inbound request -> can view emergency details
        allowed_get = await client.get(
            f"/api/v1/emergencies/{emergency_id}",
            headers=hospital_headers,
        )
        assert allowed_get.status_code == 200
        assert allowed_get.json()["id"] == emergency_id

    async def test_crew_observation_verification_and_handover_confirmation_workflow(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        hospital_headers: dict[str, str],
        sample_hospital: Hospital,
    ) -> None:
        """Verify the complete observation verification, handover draft review, and confirmed handover workflow."""
        # 1. Create emergency
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "STROKE",
                "incident_description": "Sudden facial droop and right-sided hemiparesis",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        # 2. Match and accept hospital
        await client.post(
            f"/api/v1/emergencies/{emergency_id}/match-hospitals",
            headers=ambulance_headers,
        )
        reqs = (await client.get("/api/v1/hospital-requests", headers=hospital_headers)).json()
        target_req = next(r for r in reqs if r["emergency_id"] == emergency_id)
        await client.post(
            f"/api/v1/hospital-requests/{target_req['id']}/accept",
            headers=hospital_headers,
        )

        # 3. Crew verifies extracted observations -> promoted to patient record
        verify_payload = {
            "verified_patient_info": {
                "blood_pressure": "160/95",
                "heart_rate": 88,
                "gcs_score": 14,
                "stroke_scale": "POSITIVE",
            },
            "crew_notes": "FAST protocol positive. Left hemispheric symptoms.",
        }
        verify_resp = await client.post(
            f"/api/v1/emergencies/{emergency_id}/ai/verify-extractions",
            json=verify_payload,
            headers=ambulance_headers,
        )
        assert verify_resp.status_code == 200
        patient_data = verify_resp.json()["patient_info"]
        assert patient_data["blood_pressure"] == "160/95"
        assert patient_data["observations_verified_by_crew"] is True

        # 4. Generate AI handover summary draft
        from app.services.groq import HandoverSummaryResult

        mock_draft = HandoverSummaryResult(
            summary_id="draft-summary-001",
            incident_overview="Acute stroke assessment",
            reported_symptoms_and_injuries=["Right-sided weakness", "Facial droop"],
            recorded_vital_signs={"blood_pressure": "160/95", "heart_rate": "88"},
            actions_taken=["High-flow oxygen", "Stroke alert notified"],
            critical_unknowns=["Exact last known normal time"],
            model_used="llama-3.3-70b-versatile",
            review_status="PENDING_CREW_REVIEW",
        )
        with patch("app.routers.emergencies.generate_handover", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_draft
            draft_resp = await client.post(
                f"/api/v1/emergencies/{emergency_id}/ai/handover-summary",
                headers=ambulance_headers,
            )
            assert draft_resp.status_code == 200

        # 5. Attending crew reviews and confirms handover summary
        confirm_resp = await client.post(
            f"/api/v1/emergencies/{emergency_id}/handover/confirm",
            json={
                "approved": True,
                "crew_notes": "Handover reviewed and verified with hospital triage nurse.",
            },
            headers=ambulance_headers,
        )
        assert confirm_resp.status_code == 200
        summary_res = confirm_resp.json()
        assert summary_res["review_status"] == "CONFIRMED_BY_CREW"

        # 6. Complete status transition workflow to HANDOVER_COMPLETED
        # HOSPITAL_CONFIRMED -> TRANSPORTING -> ARRIVED -> HANDOVER_COMPLETED
        await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "TRANSPORTING"},
            headers=ambulance_headers,
        )
        await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "ARRIVED"},
            headers=ambulance_headers,
        )
        handover_final = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "HANDOVER_COMPLETED", "reason": "Patient delivered to trauma bay 2"},
            headers=ambulance_headers,
        )
        assert handover_final.status_code == 200
        assert handover_final.json()["status"] == "HANDOVER_COMPLETED"

        # 7. Verify audit history captures all handover steps
        history_resp = await client.get(
            f"/api/v1/emergencies/{emergency_id}/history",
            headers=ambulance_headers,
        )
        assert history_resp.status_code == 200
        event_types = [h["event_type"] for h in history_resp.json()]
        assert "OBSERVATIONS_VERIFIED" in event_types
        assert "HANDOVER_SUMMARY_CONFIRMED" in event_types
        assert "STATUS_CHANGE" in event_types

    async def test_escalation_and_subsequent_dispatch_retry(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        hospital_headers: dict[str, str],
        sample_hospital: Hospital,
    ) -> None:
        """Verify that declining all requests triggers ESCALATION_REQUIRED and subsequent waves can be dispatched."""
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "BURN",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        # First dispatch wave
        await client.post(
            f"/api/v1/emergencies/{emergency_id}/match-hospitals",
            headers=ambulance_headers,
        )

        # Hospital declines request
        reqs = (await client.get("/api/v1/hospital-requests", headers=hospital_headers)).json()
        target_req = next(r for r in reqs if r["emergency_id"] == emergency_id)
        decline_resp = await client.post(
            f"/api/v1/hospital-requests/{target_req['id']}/decline",
            json={"reason": "Burn unit at full capacity"},
            headers=hospital_headers,
        )
        assert decline_resp.status_code == 200
        assert decline_resp.json()["status"] == "DECLINED"

        # Emergency must be in ESCALATION_REQUIRED
        emerg_check = (
            await client.get(f"/api/v1/emergencies/{emergency_id}", headers=ambulance_headers)
        ).json()
        assert emerg_check["status"] == "ESCALATION_REQUIRED"

        # Ambulance crew can trigger hospital matching retry from ESCALATION_REQUIRED
        retry_resp = await client.post(
            f"/api/v1/emergencies/{emergency_id}/match-hospitals",
            headers=ambulance_headers,
        )
        assert retry_resp.status_code == 200

    async def test_socket_room_security_denies_unauthorized_subscription(
        self,
        hospital_staff_user: User,
    ) -> None:
        """Verify that socket users cannot subscribe to rooms of other hospitals."""
        with (
            patch.object(sio, "get_session", new_callable=AsyncMock) as mock_get_sess,
            patch.object(sio, "enter_room", new_callable=AsyncMock) as mock_enter,
        ):
            mock_get_sess.return_value = {
                "user_id": str(hospital_staff_user.id),
                "role": hospital_staff_user.role.value,
                "hospital_id": str(hospital_staff_user.hospital_id),
                "ambulance_id": None,
            }

            # Attempt to join another hospital's room
            unauthorized_res = await join_room(
                sid="test_sid",
                data={"room": "hospital:00000000-0000-0000-0000-000000000000"},
            )
            assert unauthorized_res["status"] == "error"
            assert "Unauthorized" in unauthorized_res["message"]
            mock_enter.assert_not_called()

            # Attempt to join own hospital room -> succeeds
            authorized_res = await join_room(
                sid="test_sid",
                data={"room": f"hospital:{hospital_staff_user.hospital_id}"},
            )
            assert authorized_res["status"] == "ok"
            mock_enter.assert_called_once()
