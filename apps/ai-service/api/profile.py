from __future__ import annotations

import json
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel

from core.llm_wrapper import call_llm


router = APIRouter()


class ProfileRequest(BaseModel):
    text: str


def _success(data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "success": True,
        "data": data,
        "error": None,
    }


def _failure(error_type: str, message: str) -> Dict[str, Any]:
    return {
        "success": False,
        "data": None,
        "error": {
            "type": error_type,
            "message": message,
        },
    }


def _normalize_dosha(dosha: Dict[str, Any]) -> Dict[str, float]:
    vata = max(0.0, float(dosha.get("vata", 0.0) or 0.0))
    pitta = max(0.0, float(dosha.get("pitta", 0.0) or 0.0))
    kapha = max(0.0, float(dosha.get("kapha", 0.0) or 0.0))
    total = vata + pitta + kapha
    if total <= 0:
        return {"vata": 0.34, "pitta": 0.33, "kapha": 0.33}
    nv = round(vata / total, 6)
    np = round(pitta / total, 6)
    return {"vata": nv, "pitta": np, "kapha": round(1 - nv - np, 6)}


def _infer_goals_and_symptoms(text: str) -> Dict[str, List[str]]:
    normalized = (text or "").strip().lower()
    goals: List[str] = []
    symptoms: List[str] = []

    if any(token in normalized for token in ["weight", "fat", "obese", "loss"]):
        goals.append("GOAL_WEIGHT_LOSS")
    if any(token in normalized for token in ["sugar", "glucose", "diabetes"]):
        goals.append("GOAL_GLUCOSE_CONTROL")
    if not goals:
        goals.append("GOAL_MAINTENANCE")

    if any(token in normalized for token in ["acidity", "acid", "heartburn", "burning"]):
        symptoms.append("acidity")
    if any(token in normalized for token in ["bloating", "bloated", "gas"]):
        symptoms.append("bloating")
    if any(token in normalized for token in ["fatigue", "tired", "low energy"]):
        symptoms.append("fatigue")

    return {
        "goals": list(dict.fromkeys(goals)),
        "symptoms": list(dict.fromkeys(symptoms)),
    }


def _parse_profile(raw_text: str, original_text: str) -> Dict[str, Any]:
    parsed = json.loads(raw_text)

    if not isinstance(parsed, dict):
        raise ValueError("Profile output is not a JSON object")

    risk_flags = parsed.get("risk_flags")
    dosha_estimate = parsed.get("dosha_estimate")
    confidence = parsed.get("confidence")

    if not isinstance(risk_flags, list) or not isinstance(dosha_estimate, dict):
        raise ValueError("Profile JSON missing required keys")

    safe_flags = [str(flag).strip() for flag in risk_flags if isinstance(flag, str) and str(flag).strip()]
    safe_confidence = max(0.0, min(1.0, float(confidence if isinstance(confidence, (int, float)) else 0.0)))
    inferred = _infer_goals_and_symptoms(original_text)

    return {
        "risk_flags": safe_flags,
        "goals": inferred["goals"],
        "symptoms": inferred["symptoms"],
        "dosha_estimate": _normalize_dosha(dosha_estimate),
        "confidence": safe_confidence,
    }


@router.post("/ai/profile")
def ai_profile(payload: ProfileRequest):
    text = payload.text.strip()
    if not text:
        return _failure("INVALID_INPUT", "text is required")

    prompt = "\n".join([
        "Extract structured health profile from input.",
        "Return STRICT JSON ONLY with exact keys:",
        "{",
        '  "risk_flags": [],',
        '  "dosha_estimate": {"vata": number, "pitta": number, "kapha": number},',
        '  "confidence": number',
        "}",
        "Rules:",
        "- No extra text",
        "- No markdown",
        "- No explanation",
        "- confidence in [0,1]",
        "- dosha values non-negative",
        f"User input: {text}",
    ])

    raw = call_llm(prompt)
    if not raw:
        inferred = _infer_goals_and_symptoms(text)
        return _success({
            "risk_flags": [],
            "goals": inferred["goals"],
            "symptoms": inferred["symptoms"],
            "dosha_estimate": {"vata": 0.34, "pitta": 0.33, "kapha": 0.33},
            "confidence": 0.3,
        })

    try:
        data = _parse_profile(raw, text)
        return _success(data)
    except (json.JSONDecodeError, ValueError, TypeError) as error:
        return _failure("INVALID_PROFILE_JSON", str(error))
