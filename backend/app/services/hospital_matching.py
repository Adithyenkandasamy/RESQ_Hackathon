"""Deterministic, rules-based hospital matching service.

Evaluates and ranks registered hospitals based on:
1. Incident-to-hospital geographic distance (Haversine formula).
2. Clinical capability alignment (matching incident clinical requirements).
3. Explicitly reported availability (with conservative handling of UNKNOWN states).

This service strictly uses explainable algorithmic rules — no LLMs or stochastic matching.
"""

from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.emergency import Emergency
from app.models.hospital import Hospital

logger = logging.getLogger(__name__)

# Incident type to required clinical capability mappings
CLINICAL_REQUIREMENTS_MAP: dict[str, list[str]] = {
    "CARDIAC": ["CARDIAC_CARE", "ICU"],
    "CARDIAC_ARREST": ["CARDIAC_CARE", "ICU"],
    "TRAUMA": ["TRAUMA_LEVEL_1", "SURGERY"],
    "MVA": ["TRAUMA_LEVEL_1", "SURGERY"],
    "FALL": ["TRAUMA_LEVEL_1"],
    "BURN": ["BURN_UNIT", "TRAUMA_LEVEL_1"],
    "STROKE": ["STROKE_CENTER", "NEUROLOGY", "ICU"],
    "PEDIATRIC": ["PEDIATRIC", "NICU"],
    "RESPIRATORY": ["ICU"],
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two coordinates in kilometers."""
    earth_radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(earth_radius_km * c, 2)


@dataclass
class HospitalMatchResult:
    """Detailed score and explainability metrics for a matched hospital."""

    hospital_id: uuid.UUID
    hospital_name: str
    distance_km: float
    composite_score: float
    capability_score: float
    availability_score: float
    proximity_score: float
    matched_capabilities: list[str] = field(default_factory=list)
    availability_status: str = "UNKNOWN"
    eligible: bool = True
    explanation: str = ""


class HospitalMatchingService:
    """Service to evaluate and rank eligible registered hospitals for an emergency incident."""

    @classmethod
    def determine_clinical_requirements(cls, incident_type: str) -> list[str]:
        """Derive required capabilities based on normalized incident type."""
        normalized = incident_type.strip().upper()
        for key, reqs in CLINICAL_REQUIREMENTS_MAP.items():
            if key in normalized:
                return reqs
        return ["EMERGENCY"]

    @classmethod
    def calculate_proximity_score(cls, distance_km: float) -> float:
        """Score geographic proximity from 0.0 to 100.0.

        Proximity is a non-linear scoring function; straight-line distance
        is a heuristic and does not guarantee travel time.
        """
        if distance_km <= 5.0:
            return 100.0
        elif distance_km <= 15.0:
            return 85.0
        elif distance_km <= 30.0:
            return 65.0
        elif distance_km <= 50.0:
            return 45.0
        else:
            return max(0.0, 45.0 - (distance_km - 50.0))

    @classmethod
    def evaluate_availability(cls, reported_availability: dict[str, Any]) -> tuple[float, str]:
        """Score reported availability conservatively.

        Rules:
        - Explicitly not accepting -> 0.0 ("NOT_ACCEPTING")
        - Explicitly accepting with bed capacity -> 100.0 ("AVAILABLE")
        - Explicitly accepting without capacity numbers -> 80.0 ("ACCEPTING")
        - Missing or unspecified -> 50.0 ("CONSERVATIVE_UNKNOWN")
        """
        if not reported_availability:
            return 50.0, "CONSERVATIVE_UNKNOWN"

        accepting = reported_availability.get("accepting_patients")
        if accepting is False:
            return 0.0, "NOT_ACCEPTING"

        # Check explicit bed numbers if reported
        icu_beds = reported_availability.get(
            "icu_beds", reported_availability.get("icu_beds_available")
        )
        er_beds = reported_availability.get(
            "er_beds", reported_availability.get("er_beds_available")
        )

        has_beds = (isinstance(icu_beds, int) and icu_beds > 0) or (
            isinstance(er_beds, int) and er_beds > 0
        )

        if accepting is True and has_beds:
            return 100.0, "AVAILABLE"
        elif accepting is True:
            return 80.0, "ACCEPTING"
        elif has_beds:
            return 80.0, "CAPACITY_AVAILABLE"

        return 50.0, "CONSERVATIVE_UNKNOWN"

    @classmethod
    def evaluate_capabilities(
        cls, hospital_capabilities: list[str], required_capabilities: list[str]
    ) -> tuple[float, list[str]]:
        """Calculate clinical capability match percentage and list matched capabilities."""
        if not required_capabilities:
            return 100.0, []

        norm_hosp = {c.strip().upper() for c in hospital_capabilities}
        matched = [r for r in required_capabilities if r.strip().upper() in norm_hosp]

        score = (len(matched) / len(required_capabilities)) * 100.0
        return round(score, 2), matched

    @classmethod
    async def match_hospitals(
        cls,
        session: AsyncSession,
        emergency: Emergency,
        max_candidates: int = 3,
        search_radius_km: float = 50.0,
    ) -> list[HospitalMatchResult]:
        """Query registered hospitals and return top candidates ranked by composite score."""
        stmt = select(Hospital)
        result = await session.execute(stmt)
        all_hospitals = list(result.scalars().all())

        required_caps = cls.determine_clinical_requirements(emergency.incident_type)
        candidates: list[HospitalMatchResult] = []

        for hospital in all_hospitals:
            coords_available = (
                emergency.incident_latitude is not None and emergency.incident_longitude is not None
            )
            if coords_available:
                distance = haversine_distance(
                    emergency.incident_latitude,  # type: ignore[arg-type]
                    emergency.incident_longitude,  # type: ignore[arg-type]
                    hospital.latitude,
                    hospital.longitude,
                )
                if distance > search_radius_km:
                    continue
                prox_score = cls.calculate_proximity_score(distance)
            else:
                distance = 0.0
                prox_score = 50.0

            avail_score, avail_status = cls.evaluate_availability(hospital.reported_availability)

            # Exclude hospital if explicitly not accepting patients
            if avail_status == "NOT_ACCEPTING":
                continue

            cap_score, matched_caps = cls.evaluate_capabilities(
                hospital.capabilities, required_caps
            )

            # Composite Score: 40% capabilities, 35% availability, 25% proximity
            composite = round(
                (cap_score * 0.40) + (avail_score * 0.35) + (prox_score * 0.25),
                2,
            )

            explanation = (
                f"Distance: {distance}km {'(GPS verified)' if coords_available else '(Incident coords unrecorded)'} (score {prox_score}/100); "
                f"Availability: {avail_status} (score {avail_score}/100); "
                f"Capabilities matched: {matched_caps} of {required_caps} (score {cap_score}/100)."
            )

            candidates.append(
                HospitalMatchResult(
                    hospital_id=hospital.id,
                    hospital_name=hospital.name,
                    distance_km=distance,
                    composite_score=composite,
                    capability_score=cap_score,
                    availability_score=avail_score,
                    proximity_score=prox_score,
                    matched_capabilities=matched_caps,
                    availability_status=avail_status,
                    eligible=True,
                    explanation=explanation,
                )
            )

        # Sort descending by composite score, secondary sort ascending by distance
        candidates.sort(key=lambda c: (-c.composite_score, c.distance_km))
        return candidates[:max_candidates]
