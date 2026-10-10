"""Clinically reviewed, approved first-aid protocol catalog.

Strictly maintained source material for supportive emergency scene guidance.
Does NOT prescribe medication or dosages. Does NOT replace qualified medical care.
"""

from __future__ import annotations

from typing import Any

APPROVED_PROTOCOLS: dict[str, dict[str, Any]] = {
    "CARDIAC": {
        "protocol_id": "PROTO-CARD-001",
        "version": "1.2",
        "title": "Adult Unresponsive / CPR Supportive Protocol",
        "approved_material": (
            "1. Check for scene safety. Check responsiveness and normal breathing. "
            "2. If unresponsive and not breathing normally, begin chest compressions immediately. "
            "3. Push hard and fast in the center of the chest at 100-120 compressions per minute. "
            "4. Allow the chest to fully recoil between compressions. "
            "5. If an Automated External Defibrillator (AED) is available, turn it on and follow voice prompts. "
            "6. Continue CPR until emergency medical personnel arrive or the patient shows obvious signs of life."
        ),
        "precautions": [
            "Do not stop compressions for more than 10 seconds.",
            "Do not give oral fluids or medications.",
            "Avoid excessive ventilation.",
        ],
    },
    "TRAUMA": {
        "protocol_id": "PROTO-TRAUMA-002",
        "version": "1.1",
        "title": "Severe External Hemorrhage & Trauma Support",
        "approved_material": (
            "1. Apply continuous, firm direct pressure to the bleeding wound using clean gauze or cloth. "
            "2. If bleeding does not stop and wound is on an extremity, apply a commercial tourniquet 2-3 inches above the wound. "
            "3. Keep the patient calm, warm, and lying flat to prevent hypothermia and shock. "
            "4. Do not remove penetrating objects from wounds; stabilize them in place. "
            "5. If spinal injury is suspected (high-velocity impact, fall from height), minimize head and neck movement."
        ),
        "precautions": [
            "Do not release direct pressure to check if bleeding has stopped.",
            "Do not attempt to push exposed organs or deep tissues back into wounds.",
            "Do not apply tourniquets over joints.",
        ],
    },
    "BURN": {
        "protocol_id": "PROTO-BURN-003",
        "version": "1.0",
        "title": "Thermal Burn Supportive Care",
        "approved_material": (
            "1. Remove patient from the heat source and ensure scene safety. "
            "2. Cool the burn immediately with cool or lukewarm clean running water for 10-20 minutes. "
            "3. Remove restrictive items like rings or tight clothing before swelling begins, but do not pull stuck clothing. "
            "4. Cover the burn loosely with clean, non-adherent sterile dressing or clean plastic wrap. "
            "5. Keep the patient warm to prevent hypothermia."
        ),
        "precautions": [
            "Never apply ice or freezing cold water to burns.",
            "Never apply butter, oils, ointments, or home remedies.",
            "Never break intact burn blisters.",
        ],
    },
    "STROKE": {
        "protocol_id": "PROTO-STROKE-004",
        "version": "1.0",
        "title": "Suspected Acute Stroke (FAST) Supportive Care",
        "approved_material": (
            "1. Assess FAST signs: Facial drooping, Arm weakness, Slurred speech, Time of symptom onset. "
            "2. Note the exact time the patient was last known to be well/symptom-free. "
            "3. Keep the patient in a comfortable position with head elevated slightly (approx. 15-30 degrees) if conscious. "
            "4. If patient becomes unresponsive or vomits, place them in the recovery position (on their side). "
            "5. Maintain clear airway."
        ),
        "precautions": [
            "Never give anything to eat, drink, or swallow (high aspiration risk).",
            "Do not administer aspirin or any medication prior to hospital imaging.",
        ],
    },
    "SEIZURE": {
        "protocol_id": "PROTO-SEIZ-005",
        "version": "1.1",
        "title": "Active Seizure Management & Post-Ictal Care",
        "approved_material": (
            "1. Clear the surrounding area of hard, sharp, or dangerous objects. "
            "2. Protect the head by placing something soft underneath. "
            "3. Time the duration of the seizure. "
            "4. Once active jerking stops, gently turn the patient onto their side into the recovery position to keep airway clear. "
            "5. Stay with the patient until fully awake and oriented."
        ),
        "precautions": [
            "Never hold the person down or restrain their movements.",
            "Never put anything in the person's mouth.",
            "Do not offer water or food until fully alert.",
        ],
    },
}


def find_approved_protocol(incident_type: str) -> dict[str, Any] | None:
    """Select approved first-aid protocol by incident type or clinical context keywords."""
    normalized = incident_type.strip().upper()
    for key, protocol in APPROVED_PROTOCOLS.items():
        if key in normalized:
            return protocol

    # Keyword mappings for real-world field descriptions
    trauma_keywords = [
        "ACCIDENT", "CRASH", "BIKE", "FALL", "BLEED", "HEMORRHAGE", "CUT",
        "INJURY", "WOUND", "FRACTURE", "HIT", "MOTOR", "ROAD", "COLLISION",
        "HEAD", "LEG", "SCRA", "TRAUMA", "விபத்து", "காயம்", "விழுந்"
    ]
    if any(kw in normalized for kw in trauma_keywords):
        return APPROVED_PROTOCOLS["TRAUMA"]

    cardiac_keywords = ["CARDIAC", "HEART", "CHEST", "CPR", "PULSE", "ARREST", "UNRESPONSIVE", "BREATH"]
    if any(kw in normalized for kw in cardiac_keywords):
        return APPROVED_PROTOCOLS["CARDIAC"]

    stroke_keywords = ["STROKE", "PARALYSIS", "SPEECH", "FAST", "FACIAL", "DROOP", "NUMB"]
    if any(kw in normalized for kw in stroke_keywords):
        return APPROVED_PROTOCOLS["STROKE"]

    burn_keywords = ["BURN", "FIRE", "SCALD", "ACID", "THERMAL", "ELECTRICAL"]
    if any(kw in normalized for kw in burn_keywords):
        return APPROVED_PROTOCOLS["BURN"]

    seizure_keywords = ["SEIZURE", "CONVULSION", "EPILEPSY", "FITS", "JERK"]
    if any(kw in normalized for kw in seizure_keywords):
        return APPROVED_PROTOCOLS["SEIZURE"]

    return None
