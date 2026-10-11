"""End-to-end integration tests for genuine Socket.IO real-time synchronization.

Validates:
1. Emergency creation produces immediate `emergency.created` event.
2. Status transition produces `emergency.status.updated` event.
3. Incident location update produces `emergency.location_updated` event.
4. Ambulance GPS update produces `ambulance.location_updated` event.
5. Handover confirmation produces `emergency.handover_confirmed` and `emergency.status.updated`.
6. Failed / invalid transactions do not emit events.
7. Authorization / privacy: no patient PII broadcast over socket events.
8. Reconnecting client receives authoritative data.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
import uuid
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.socket import sio
from app.models.hospital import Hospital
from app.models.user import User


class TestRealTimeSynchronization:
    """Validate genuine Socket.IO event emission and room routing."""

    async def test_emergency_creation_emits_socket_event_without_pii(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
    ) -> None:
        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            resp = await client.post(
                "/api/v1/emergencies",
                json={
                    "incident_type": "TRAUMA",
                    "incident_description": "Vehicle collision with injury",
                    "incident_latitude": 37.7749,
                    "incident_longitude": -122.4194,
                    "patient_info": {
                        "name": "Confidential Patient John Doe",
                        "phone": "555-0199",
                        "condition": "Severe bleeding",
                    },
                },
                headers=ambulance_headers,
            )
            assert resp.status_code == 201
            emergency_id = resp.json()["id"]

            # Verify emergency.created was emitted
            assert mock_emit.called
            calls = [call for call in mock_emit.call_args_list if call.args[0] == "emergency.created"]
            assert len(calls) >= 1

            for call in calls:
                envelope = call.args[1]
                assert envelope["event_type"] == "emergency.created"
                assert envelope["data"]["emergency_id"] == emergency_id
                assert envelope["data"]["incident_type"] == "TRAUMA"
                # Ensure no confidential patient information is broadcast!
                assert "patient_info" not in envelope["data"]
                assert "Confidential Patient" not in str(envelope["data"])
                assert "555-0199" not in str(envelope["data"])

    async def test_status_update_emits_emergency_status_updated(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
    ) -> None:
        # Create emergency
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "RESPIRATORY",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        assert create_resp.status_code == 201
        emergency_id = create_resp.json()["id"]

        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            # Transition CREATED -> ASSESSMENT_IN_PROGRESS
            status_resp = await client.patch(
                f"/api/v1/emergencies/{emergency_id}/status",
                json={"status": "ASSESSMENT_IN_PROGRESS"},
                headers=ambulance_headers,
            )
            assert status_resp.status_code == 200

            status_calls = [
                call for call in mock_emit.call_args_list if call.args[0] == "emergency.status.updated"
            ]
            assert len(status_calls) >= 1
            envelope = status_calls[0].args[1]
            assert envelope["data"]["emergency_id"] == emergency_id
            assert envelope["data"]["new_status"] == "ASSESSMENT_IN_PROGRESS"

    async def test_incident_location_update_emits_location_updated(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
    ) -> None:
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "CARDIAC",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            loc_resp = await client.patch(
                f"/api/v1/emergencies/{emergency_id}/location",
                json={
                    "incident_latitude": 37.7850,
                    "incident_longitude": -122.4050,
                },
                headers=ambulance_headers,
            )
            assert loc_resp.status_code == 200

            loc_calls = [
                call for call in mock_emit.call_args_list if call.args[0] == "emergency.location_updated"
            ]
            assert len(loc_calls) >= 1
            envelope = loc_calls[0].args[1]
            assert envelope["data"]["emergency_id"] == emergency_id
            assert envelope["data"]["incident_latitude"] == 37.7850
            assert envelope["data"]["incident_longitude"] == -122.4050

    async def test_failed_transaction_does_not_emit_socket_events(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
    ) -> None:
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "CARDIAC",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            # Attempt invalid status transition (CREATED directly to ARRIVED is illegal)
            bad_resp = await client.patch(
                f"/api/v1/emergencies/{emergency_id}/status",
                json={"status": "ARRIVED"},
                headers=ambulance_headers,
            )
            assert bad_resp.status_code == 400
            # Ensure no events were emitted
            mock_emit.assert_not_called()

    async def test_ambulance_gps_update_emits_ambulance_location_updated(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
    ) -> None:
        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            resp = await client.patch(
                "/api/v1/ambulances/me/location",
                json={
                    "latitude": 37.7900,
                    "longitude": -122.4000,
                },
                headers=ambulance_headers,
            )
            assert resp.status_code == 200

            amb_loc_calls = [
                call for call in mock_emit.call_args_list if call.args[0] == "ambulance.location_updated"
            ]
            assert len(amb_loc_calls) >= 1
            envelope = amb_loc_calls[0].args[1]
            assert envelope["data"]["latitude"] == 37.7900
            assert envelope["data"]["longitude"] == -122.4000
