"""Automated tests for AI speech transcription, Groq observation extraction, and first-aid guidance."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx

from app.services.first_aid_protocols import find_approved_protocol
from app.services.groq import (
    EmergencyExtractionResult,
    HandoverSummaryResult,
)


class TestAIExtractionAndTranscription:
    """Test AI services with mock provider responses and defensive failure handling."""

    async def test_transcription_rejects_unsupported_file_extension(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
    ) -> None:
        # Create emergency
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

        # Upload invalid text file
        files = {"file": ("malicious.exe", b"not-audio-bytes", "application/octet-stream")}
        resp = await client.post(
            f"/api/v1/emergencies/{emergency_id}/transcription",
            files=files,
            headers=ambulance_headers,
        )
        assert resp.status_code == 422
        body = resp.json()
        err_msg = body.get("error", {}).get("message", "") or str(body.get("details", ""))
        assert "Unsupported audio file format" in err_msg

    async def test_transcription_success_with_mocked_provider(
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

        mock_result = {
            "transcription_id": "mock-transcription-123",
            "transcript": "65 year old male collapsed, bystander CPR underway, pulse absent.",
            "language": "en",
            "processing_status": "COMPLETED",
        }

        with patch(
            "app.routers.emergencies.transcribe_audio_file", new_callable=AsyncMock
        ) as mock_trans:
            mock_trans.return_value = mock_result
            files = {"file": ("scene_audio.mp3", b"\xff\xfb\x90\x44" * 100, "audio/mpeg")}
            resp = await client.post(
                f"/api/v1/emergencies/{emergency_id}/transcription",
                files=files,
                headers=ambulance_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["transcript"] == mock_result["transcript"]
            assert data["processing_status"] == "COMPLETED"

    async def test_groq_observation_extraction_success(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
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

        mock_extraction = EmergencyExtractionResult(
            incident_type="MVA",
            reported_injuries=["Laceration to forehead", "Right wrist deformity"],
            reported_symptoms=["Severe pain", "Dizziness"],
            patient_responsiveness="Alert and oriented x 3",
            vital_signs={"bp": "130/85", "hr": 92},
            unknown_or_missing_info=["Past medical history", "Medication list"],
            factual_summary="Two vehicle collision at intersection. Driver sustained forehead laceration.",
            model_used="mock-groq-model",
            review_required=True,
        )

        with patch(
            "app.routers.emergencies.extract_observations", new_callable=AsyncMock
        ) as mock_extract:
            mock_extract.return_value = mock_extraction
            resp = await client.post(
                f"/api/v1/emergencies/{emergency_id}/ai/extract",
                json={
                    "text": "Two vehicle collision, driver bleeding from head with deformed right wrist."
                },
                headers=ambulance_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["incident_type"] == "MVA"
            assert "Laceration to forehead" in data["reported_injuries"]
            assert data["vital_signs"]["bp"] == "130/85"
            assert data["review_required"] is True

    async def test_groq_handover_summary_generation(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
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

        mock_handover = HandoverSummaryResult(
            summary_id="mock-summary-001",
            incident_overview="Acute onset right-sided weakness and slurred speech 45 mins prior.",
            reported_symptoms_and_injuries=["Right hemiparesis", "Facial droop", "Dysarthria"],
            recorded_vital_signs={"bp": "165/95", "blood_glucose": "110 mg/dL"},
            actions_taken=[
                "FAST assessment conducted",
                "Airway maintained",
                "Transport initiated",
            ],
            critical_unknowns=["Exact time last known normal", "Anticoagulant medication status"],
            is_ai_generated=True,
            review_status="PENDING_STAFF_REVIEW",
            model_used="mock-groq-model",
        )

        with patch(
            "app.routers.emergencies.generate_handover", new_callable=AsyncMock
        ) as mock_gen:
            mock_gen.return_value = mock_handover
            resp = await client.post(
                f"/api/v1/emergencies/{emergency_id}/ai/handover-summary",
                headers=ambulance_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_ai_generated"] is True
            assert "Right hemiparesis" in data["reported_symptoms_and_injuries"]
            assert data["review_status"] == "PENDING_STAFF_REVIEW"

    async def test_constrained_first_aid_guidance_for_known_protocol(
        self,
        client: httpx.AsyncClient,
        ambulance_headers: dict[str, str],
    ) -> None:
        create_resp = await client.post(
            "/api/v1/emergencies",
            json={
                "incident_type": "CARDIAC_ARREST",
                "incident_latitude": 37.7749,
                "incident_longitude": -122.4194,
            },
            headers=ambulance_headers,
        )
        emergency_id = create_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/emergencies/{emergency_id}/ai/first-aid",
            headers=ambulance_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["protocol_id"] == "PROTO-CARD-001"
        assert len(data["guidance_steps"]) > 0
        assert "SUPPORTIVE GUIDANCE ONLY" in data["disclaimer"]

    def test_first_aid_catalog_returns_none_for_unknown_incident(self) -> None:
        proto = find_approved_protocol("ALIEN_INVASION_INCIDENT")
        assert proto is None
