"""Automated tests for deterministic, rules-based hospital matching service."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.emergency import Emergency
from app.models.hospital import Hospital
from app.models.user import User
from app.services.hospital_matching import (
    HospitalMatchingService,
    haversine_distance,
)


class TestHospitalMatchingService:
    """Test deterministic rules-based hospital evaluation and ranking."""

    def test_haversine_distance_calculation(self) -> None:
        # Distance between SF Ferry Building and Golden Gate Bridge (~7.5 km)
        dist = haversine_distance(37.7955, -122.3937, 37.8199, -122.4783)
        assert 7.0 <= dist <= 8.5

        # Same coordinate -> 0.0 km
        assert haversine_distance(37.7749, -122.4194, 37.7749, -122.4194) == 0.0

    async def test_matching_ranks_by_capabilities_and_proximity(
        self,
        db_session: AsyncSession,
        sample_hospital: Hospital,
        other_hospital: Hospital,
        ambulance_crew_user: User,
    ) -> None:
        # sample_hospital has CARDIAC_CARE, ICU and is at (37.7749, -122.4194)
        # other_hospital has PEDIATRIC, BURN_UNIT and is at (37.7850, -122.4050)

        cardiac_emergency = Emergency(
            created_by_id=ambulance_crew_user.id,
            incident_type="CARDIAC_ARREST",
            incident_latitude=37.7750,
            incident_longitude=-122.4190,
            patient_info={"vitals": "pulse absent"},
        )
        db_session.add(cardiac_emergency)
        await db_session.commit()

        candidates = await HospitalMatchingService.match_hospitals(
            session=db_session,
            emergency=cardiac_emergency,
            max_candidates=5,
        )

        assert len(candidates) >= 1
        # sample_hospital must rank #1 because it has CARDIAC_CARE + ICU and is < 1km away
        top_candidate = candidates[0]
        assert top_candidate.hospital_id == sample_hospital.id
        assert top_candidate.composite_score > 80.0
        assert "CARDIAC_CARE" in top_candidate.matched_capabilities
        assert top_candidate.distance_km < 1.0

    async def test_matching_excludes_hospital_not_accepting_patients(
        self,
        db_session: AsyncSession,
        ambulance_crew_user: User,
    ) -> None:
        diverting_hospital = Hospital(
            name="Diverting Medical Center",
            registration_identifier="HOSP-DIVERT-999",
            address="99 Divert Way",
            latitude=37.7750,
            longitude=-122.4190,
            contact_number="+1-555-9999",
            capabilities=["ICU", "TRAUMA_LEVEL_1"],
            reported_availability={"accepting_patients": False, "reason": "Full capacity"},
        )
        db_session.add(diverting_hospital)
        await db_session.commit()

        emergency = Emergency(
            created_by_id=ambulance_crew_user.id,
            incident_type="TRAUMA",
            incident_latitude=37.7750,
            incident_longitude=-122.4190,
        )
        db_session.add(emergency)
        await db_session.commit()

        candidates = await HospitalMatchingService.match_hospitals(
            session=db_session,
            emergency=emergency,
        )

        candidate_ids = [c.hospital_id for c in candidates]
        assert diverting_hospital.id not in candidate_ids

    async def test_unknown_availability_handled_conservatively(
        self,
        db_session: AsyncSession,
        ambulance_crew_user: User,
    ) -> None:
        unreported_hospital = Hospital(
            name="Unreported Status Hospital",
            registration_identifier="HOSP-UNREP-888",
            address="88 Quiet Ave",
            latitude=37.7750,
            longitude=-122.4190,
            contact_number="+1-555-8888",
            capabilities=["EMERGENCY"],
            reported_availability={},  # Empty/unknown
        )
        db_session.add(unreported_hospital)
        await db_session.commit()

        emergency = Emergency(
            created_by_id=ambulance_crew_user.id,
            incident_type="EMERGENCY",
            incident_latitude=37.7750,
            incident_longitude=-122.4190,
        )
        db_session.add(emergency)
        await db_session.commit()

        candidates = await HospitalMatchingService.match_hospitals(
            session=db_session,
            emergency=emergency,
        )

        matched = next(c for c in candidates if c.hospital_id == unreported_hospital.id)
        assert matched.availability_status == "CONSERVATIVE_UNKNOWN"
        assert matched.availability_score == 50.0  # Conservative middle-tier score

    async def test_hospitals_outside_search_radius_excluded(
        self,
        db_session: AsyncSession,
        ambulance_crew_user: User,
    ) -> None:
        far_hospital = Hospital(
            name="Faraway Regional Hospital",
            registration_identifier="HOSP-FAR-777",
            address="77 Faraway Highway",
            latitude=38.5816,  # Sacramento (~120 km away from SF)
            longitude=-121.4944,
            contact_number="+1-555-7777",
            capabilities=["ICU", "TRAUMA_LEVEL_1"],
            reported_availability={"accepting_patients": True},
        )
        db_session.add(far_hospital)
        await db_session.commit()

        sf_emergency = Emergency(
            created_by_id=ambulance_crew_user.id,
            incident_type="TRAUMA",
            incident_latitude=37.7749,
            incident_longitude=-122.4194,
        )
        db_session.add(sf_emergency)
        await db_session.commit()

        candidates = await HospitalMatchingService.match_hospitals(
            session=db_session,
            emergency=sf_emergency,
            search_radius_km=50.0,
        )

        candidate_ids = [c.hospital_id for c in candidates]
        assert far_hospital.id not in candidate_ids
