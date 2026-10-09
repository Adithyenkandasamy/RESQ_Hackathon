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
