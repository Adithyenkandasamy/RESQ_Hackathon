"""Automated tests for emergency lifecycle, transitions, history, and scoping."""

from __future__ import annotations

import httpx

from app.models.ambulance import Ambulance


class TestEmergencyEndpoints:
    """Test emergency creation, retrieval, updates, and state transitions."""

    async def test_create_emergency_by_ambulance_crew(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        sample_ambulance: Ambulance,
    ) -> None:
        payload = {
            "incident_type": "CARDIAC_ARREST",
            "incident_description": "Elderly male collapsed at bus stop",
            "patient_info": {
                "estimated_age": 70,
                "gender": "male",
                "notes": "CPR in progress",
            },
            "incident_latitude": 37.7749,
            "incident_longitude": -122.4194,
        }
        response = await client.post(
            "/api/v1/emergencies", json=payload, headers=ambulance_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["incident_type"] == "CARDIAC_ARREST"
        assert data["status"] == "CREATED"
        assert data["assigned_ambulance_id"] == str(sample_ambulance.id)
        assert data["incident_latitude"] == 37.7749
        assert data["incident_longitude"] == -122.4194

    async def test_create_emergency_coordinate_validation(
        self, client: httpx.AsyncClient, ambulance_headers: dict[str, str]
    ) -> None:
        # Invalid latitude (> 90)
        invalid_lat_payload = {
            "incident_type": "TRAUMA",
            "incident_latitude": 95.0,
            "incident_longitude": 50.0,
        }
        resp1 = await client.post(
            "/api/v1/emergencies", json=invalid_lat_payload, headers=ambulance_headers
        )
        assert resp1.status_code == 422
        assert resp1.json()["error"]["code"] == "VALIDATION_ERROR"

        # Invalid longitude (< -180)
        invalid_lon_payload = {
            "incident_type": "TRAUMA",
            "incident_latitude": 45.0,
            "incident_longitude": -185.0,
        }
        resp2 = await client.post(
            "/api/v1/emergencies", json=invalid_lon_payload, headers=ambulance_headers
        )
        assert resp2.status_code == 422
        assert resp2.json()["error"]["code"] == "VALIDATION_ERROR"

    async def test_hospital_staff_cannot_create_emergency(
        self, client: httpx.AsyncClient, hospital_headers: dict[str, str]
    ) -> None:
        payload = {
            "incident_type": "TRAUMA",
            "incident_latitude": 37.7749,
            "incident_longitude": -122.4194,
        }
        response = await client.post("/api/v1/emergencies", json=payload, headers=hospital_headers)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN"

    async def test_update_patient_information(
        self, client: httpx.AsyncClient, ambulance_headers: dict[str, str]
    ) -> None:
        # Create emergency
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "FALL",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        # Update patient info (can be partial / unknown details)
        update_payload = {
            "patient_info": {
                "name": "Jane Doe",
                "blood_pressure": "120/80",
                "conscious": True,
            }
        }
        patch_resp = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/patient",
            json=update_payload,
            headers=ambulance_headers,
        )
        assert patch_resp.status_code == 200
        data = patch_resp.json()
        assert data["patient_info"]["name"] == "Jane Doe"
        assert data["patient_info"]["blood_pressure"] == "120/80"

    async def test_update_incident_location(
        self, client: httpx.AsyncClient, ambulance_headers: dict[str, str]
    ) -> None:
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "MVA",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        update_payload = {
            "incident_latitude": 37.7800,
            "incident_longitude": -122.4100,
            "location_captured_at": "2026-10-09T18:00:00Z",
        }
        patch_resp = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/location",
            json=update_payload,
            headers=ambulance_headers,
        )
        assert patch_resp.status_code == 200
        data = patch_resp.json()
        assert data["incident_latitude"] == 37.7800
        assert data["incident_longitude"] == -122.4100

    async def test_valid_status_transition_workflow(
        self, client: httpx.AsyncClient, ambulance_headers: dict[str, str]
    ) -> None:
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "STROKE",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        # Step 1: CREATED -> ASSESSMENT_IN_PROGRESS
        r1 = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "ASSESSMENT_IN_PROGRESS", "reason": "Arrived at scene"},
            headers=ambulance_headers,
        )
        assert r1.status_code == 200
        assert r1.json()["status"] == "ASSESSMENT_IN_PROGRESS"

        # Step 2: ASSESSMENT_IN_PROGRESS -> SEARCHING_HOSPITAL
        r2 = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "SEARCHING_HOSPITAL"},
            headers=ambulance_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "SEARCHING_HOSPITAL"

        # Step 3: SEARCHING_HOSPITAL -> ACCEPTANCE_PENDING
        r3 = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "ACCEPTANCE_PENDING"},
            headers=ambulance_headers,
        )
        assert r3.status_code == 200
        assert r3.json()["status"] == "ACCEPTANCE_PENDING"

        # Step 4: ACCEPTANCE_PENDING -> HOSPITAL_CONFIRMED
        r4 = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "HOSPITAL_CONFIRMED"},
            headers=ambulance_headers,
        )
        assert r4.status_code == 200
        assert r4.json()["status"] == "HOSPITAL_CONFIRMED"

        # Step 5: HOSPITAL_CONFIRMED -> TRANSPORTING
        r5 = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "TRANSPORTING"},
            headers=ambulance_headers,
        )
        assert r5.status_code == 200
        assert r5.json()["status"] == "TRANSPORTING"

        # Step 6: TRANSPORTING -> ARRIVED
        r6 = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "ARRIVED"},
            headers=ambulance_headers,
        )
        assert r6.status_code == 200
        assert r6.json()["status"] == "ARRIVED"

        # Step 7: ARRIVED -> HANDOVER_COMPLETED
        r7 = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "HANDOVER_COMPLETED"},
            headers=ambulance_headers,
        )
        assert r7.status_code == 200
        assert r7.json()["status"] == "HANDOVER_COMPLETED"

    async def test_invalid_status_transition_rejected(
        self, client: httpx.AsyncClient, ambulance_headers: dict[str, str]
    ) -> None:
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

        # Attempt forbidden transition: CREATED -> HANDOVER_COMPLETED
        resp = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "HANDOVER_COMPLETED"},
            headers=ambulance_headers,
        )
        assert resp.status_code == 400
        data = resp.json()
        assert data["error"]["code"] == "BAD_REQUEST"
        assert "Invalid transition" in data["error"]["message"]

    async def test_emergency_history_audit_trail(
        self, client: httpx.AsyncClient, ambulance_headers: dict[str, str]
    ) -> None:
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

        # Update patient
        await client.patch(
            f"/api/v1/emergencies/{emergency_id}/patient",
            json={"patient_info": {"burn_degree": "2nd"}},
            headers=ambulance_headers,
        )

        # Update location
        await client.patch(
            f"/api/v1/emergencies/{emergency_id}/location",
            json={"incident_latitude": 37.7800, "incident_longitude": -122.4200},
            headers=ambulance_headers,
        )

        # Transition status
        await client.patch(
            f"/api/v1/emergencies/{emergency_id}/status",
            json={"status": "ASSESSMENT_IN_PROGRESS", "reason": "Patient triaged"},
            headers=ambulance_headers,
        )

        # Fetch history
        hist_resp = await client.get(
            f"/api/v1/emergencies/{emergency_id}/history",
            headers=ambulance_headers,
        )
        assert hist_resp.status_code == 200
        history = hist_resp.json()
        assert len(history) == 4  # CREATED + PATIENT_UPDATE + LOCATION_UPDATE + STATUS_CHANGE
        events = [h["event_type"] for h in history]
        assert events == ["CREATED", "PATIENT_UPDATE", "LOCATION_UPDATE", "STATUS_CHANGE"]

    async def test_cross_ambulance_crew_access_denied(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        other_ambulance_headers: dict[str, str],
    ) -> None:
        # Crew 1 creates an emergency
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "SEIZURE",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        # Crew 2 attempts to retrieve Crew 1's emergency -> 403 Forbidden
        get_resp = await client.get(
            f"/api/v1/emergencies/{emergency_id}",
            headers=other_ambulance_headers,
        )
        assert get_resp.status_code == 403
        assert get_resp.json()["error"]["code"] == "FORBIDDEN"

        # Crew 2 attempts to update Crew 1's emergency -> 403 Forbidden
        patch_resp = await client.patch(
            f"/api/v1/emergencies/{emergency_id}/patient",
            json={"patient_info": {"tampered": True}},
            headers=other_ambulance_headers,
        )
        assert patch_resp.status_code == 403
        assert patch_resp.json()["error"]["code"] == "FORBIDDEN"

    async def test_admin_can_access_any_emergency(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
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

        # Admin accesses emergency created by ambulance crew
        admin_get_resp = await client.get(
            f"/api/v1/emergencies/{emergency_id}",
            headers=admin_headers,
        )
        assert admin_get_resp.status_code == 200
        assert admin_get_resp.json()["id"] == emergency_id
