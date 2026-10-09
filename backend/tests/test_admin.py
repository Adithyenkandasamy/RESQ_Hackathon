"""Automated tests for administrative endpoints and dashboard metrics."""

from __future__ import annotations

import httpx

from app.models.ambulance import Ambulance
from app.models.hospital import Hospital


class TestAdminEndpoints:
    """Test administrative dashboard summary and role restrictions."""

    async def test_admin_dashboard_metrics(
        self,
        client: httpx.AsyncClient,
        admin_headers: dict[str, str],
        sample_hospital: Hospital,
        other_hospital: Hospital,
        sample_ambulance: Ambulance,
        ambulance_headers: dict[str, str],
    ) -> None:
        # Create an emergency using ambulance headers
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

        response = await client.get("/api/v1/admin/dashboard", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()

        assert data["total_hospitals"] == 2
        assert data["total_ambulances"] == 1
        assert data["available_ambulances"] == 1
        assert data["active_emergencies"] == 1
        assert "CREATED" in data["emergencies_by_status"]
        assert data["emergencies_by_status"]["CREATED"] == 1
        assert data["total_users"] >= 2

        # Verify no patient details leaked
        assert "patient" not in str(data).lower()
        assert "incident_description" not in data

    async def test_hospital_staff_cannot_access_admin_dashboard(
        self, client: httpx.AsyncClient, hospital_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/admin/dashboard", headers=hospital_headers)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN"

    async def test_ambulance_crew_cannot_access_admin_dashboard(
        self, client: httpx.AsyncClient, ambulance_headers: dict[str, str]
    ) -> None:
        response = await client.get("/api/v1/admin/dashboard", headers=ambulance_headers)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN"

    async def test_unauthenticated_cannot_access_admin_dashboard(
        self, client: httpx.AsyncClient
    ) -> None:
        response = await client.get("/api/v1/admin/dashboard")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"
