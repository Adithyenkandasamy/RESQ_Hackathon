"""Automated tests for Socket.IO authentication, room authorization, and event envelopes."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.core.security import create_access_token
from app.core.socket import (
    connect,
    create_event_envelope,
    join_room,
    sio,
)
from app.models.hospital import Hospital
from app.models.user import User


class TestSocketIOIntegration:
    """Test Socket.IO handshake auth, room access controls, and notification helpers."""

    def test_event_envelope_structure(self) -> None:
        envelope = create_event_envelope(
            event_type="emergency.status.updated",
            resource_id="123e4567-e89b-12d3-a456-426614174000",
            data={"status": "HOSPITAL_CONFIRMED"},
        )
        assert "event_id" in envelope
        assert envelope["event_type"] == "emergency.status.updated"
        assert envelope["resource_id"] == "123e4567-e89b-12d3-a456-426614174000"
        assert envelope["data"]["status"] == "HOSPITAL_CONFIRMED"
        assert "occurred_at" in envelope

    async def test_socket_connection_rejected_without_token(self) -> None:
        res = await connect(sid="test_sid", environ={}, auth=None)
        assert res is False

    async def test_socket_connection_rejected_with_invalid_token(self) -> None:
        res = await connect(sid="test_sid", environ={}, auth={"token": "invalid.jwt.token"})
        assert res is False

    async def test_socket_connection_accepted_with_valid_user(
        self,
        hospital_staff_user: User,
    ) -> None:
        token = create_access_token(
            {
                "sub": str(hospital_staff_user.id),
                "email": hospital_staff_user.email,
                "role": hospital_staff_user.role.value,
            }
        )
        with (
            patch("app.core.socket.get_user_for_socket", new_callable=AsyncMock) as mock_get_user,
            patch.object(sio, "save_session", new_callable=AsyncMock) as mock_save,
        ):
            mock_get_user.return_value = hospital_staff_user
            res = await connect(sid="valid_sid", environ={}, auth={"token": token})
            assert res is True
            mock_save.assert_called_once()
            args, _ = mock_save.call_args
            assert args[1]["user_id"] == str(hospital_staff_user.id)
            assert args[1]["hospital_id"] == str(hospital_staff_user.hospital_id)

    async def test_room_authorization_own_hospital_allowed(
        self,
        hospital_staff_user: User,
        sample_hospital: Hospital,
    ) -> None:
        session_data = {
            "user_id": str(hospital_staff_user.id),
            "role": "HOSPITAL_STAFF",
            "hospital_id": str(sample_hospital.id),
            "ambulance_id": None,
        }
        with (
            patch.object(sio, "get_session", new_callable=AsyncMock, return_value=session_data),
            patch.object(sio, "enter_room", new_callable=AsyncMock) as mock_enter,
        ):
            res = await join_room("test_sid", {"room": f"hospital:{sample_hospital.id}"})
            assert res["status"] == "ok"
            mock_enter.assert_called_once_with("test_sid", f"hospital:{sample_hospital.id}")

    async def test_room_authorization_other_hospital_denied(
        self,
        hospital_staff_user: User,
        other_hospital: Hospital,
    ) -> None:
        session_data = {
            "user_id": str(hospital_staff_user.id),
            "role": "HOSPITAL_STAFF",
            "hospital_id": "different-hospital-uuid",
            "ambulance_id": None,
        }
        with (
            patch.object(sio, "get_session", new_callable=AsyncMock, return_value=session_data),
            patch.object(sio, "enter_room", new_callable=AsyncMock) as mock_enter,
        ):
            res = await join_room("test_sid", {"room": f"hospital:{other_hospital.id}"})
            assert res["status"] == "error"
            assert "Unauthorized" in res["message"]
            mock_enter.assert_not_called()

    async def test_admin_can_join_any_room(
        self,
        admin_user: User,
        sample_hospital: Hospital,
    ) -> None:
        session_data = {
            "user_id": str(admin_user.id),
            "role": "ADMIN",
            "hospital_id": None,
            "ambulance_id": None,
        }
        with (
            patch.object(sio, "get_session", new_callable=AsyncMock, return_value=session_data),
            patch.object(sio, "enter_room", new_callable=AsyncMock) as mock_enter,
        ):
            res = await join_room("admin_sid", {"room": f"hospital:{sample_hospital.id}"})
            assert res["status"] == "ok"
            mock_enter.assert_called_once_with("admin_sid", f"hospital:{sample_hospital.id}")

    async def test_notify_emergency_created_broadcasts_to_admin_and_ambulance(self) -> None:
        import uuid
        from app.core.socket import notify_emergency_created

        em_id = uuid.uuid4()
        amb_id = uuid.uuid4()
        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            await notify_emergency_created(
                emergency_id=em_id,
                status="CREATED",
                incident_type="CARDIAC",
                assigned_ambulance_id=amb_id,
                incident_latitude=37.77,
                incident_longitude=-122.41,
            )
            assert mock_emit.call_count == 2
            rooms_called = [call.kwargs.get("room") for call in mock_emit.call_args_list]
            assert "admin" in rooms_called
            assert f"ambulance:{amb_id}" in rooms_called

            # Verify no patient PII is in payload
            for call in mock_emit.call_args_list:
                envelope = call.args[1]
                assert "patient_info" not in envelope["data"]
                assert "name" not in envelope["data"]
                assert envelope["data"]["emergency_id"] == str(em_id)

    async def test_notify_emergency_location_updated(self) -> None:
        import uuid
        from app.core.socket import notify_emergency_location_updated

        em_id = uuid.uuid4()
        amb_id = uuid.uuid4()
        hosp_id = uuid.uuid4()
        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            await notify_emergency_location_updated(
                emergency_id=em_id,
                incident_latitude=37.78,
                incident_longitude=-122.42,
                location_captured_at="2026-10-11T12:00:00Z",
                ambulance_id=amb_id,
                hospital_id=hosp_id,
            )
            rooms_called = [call.kwargs.get("room") for call in mock_emit.call_args_list]
            assert f"emergency:{em_id}" in rooms_called
            assert f"ambulance:{amb_id}" in rooms_called
            assert f"hospital:{hosp_id}" in rooms_called
            assert "admin" in rooms_called

    async def test_notify_ambulance_location_updated(self) -> None:
        import uuid
        from app.core.socket import notify_ambulance_location_updated

        amb_id = uuid.uuid4()
        em_id = uuid.uuid4()
        hosp_id = uuid.uuid4()
        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            await notify_ambulance_location_updated(
                ambulance_id=amb_id,
                latitude=37.79,
                longitude=-122.40,
                location_updated_at="2026-10-11T12:05:00Z",
                active_emergencies=[{"emergency_id": em_id, "hospital_id": hosp_id}],
            )
            rooms_called = [call.kwargs.get("room") for call in mock_emit.call_args_list]
            assert f"ambulance:{amb_id}" in rooms_called
            assert "admin" in rooms_called
            assert f"emergency:{em_id}" in rooms_called
            assert f"hospital:{hosp_id}" in rooms_called

    async def test_notify_handover_confirmed(self) -> None:
        import uuid
        from app.core.socket import notify_handover_confirmed

        em_id = uuid.uuid4()
        hosp_id = uuid.uuid4()
        amb_id = uuid.uuid4()
        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            await notify_handover_confirmed(
                emergency_id=em_id,
                review_status="CONFIRMED_BY_CREW",
                handover_summary={"situation": "Patient stable"},
                ambulance_id=amb_id,
                hospital_id=hosp_id,
            )
            rooms_called = [call.kwargs.get("room") for call in mock_emit.call_args_list]
            assert f"emergency:{em_id}" in rooms_called
            assert f"hospital:{hosp_id}" in rooms_called
            assert f"ambulance:{amb_id}" in rooms_called
            assert "admin" in rooms_called

    async def test_failed_db_transaction_does_not_produce_socket_event(
        self,
        client,
        ambulance_headers: dict[str, str],
    ) -> None:
        """Verify that when a database transaction fails, no success socket event is emitted."""
        with patch.object(sio, "emit", new_callable=AsyncMock) as mock_emit:
            # Send an invalid creation payload (missing incident_type or invalid data)
            resp = await client.post(
                "/api/v1/emergencies",
                json={
                    "incident_type": "",  # invalid
                },
                headers=ambulance_headers,
            )
            assert resp.status_code in (400, 422)
            # Ensure no socket events were emitted!
            mock_emit.assert_not_called()

