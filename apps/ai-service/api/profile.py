from __future__ import annotations

import json
from typing import Any, Dict

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


def _parse_profile(raw_text: str) -> Dict[str, Any]:
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

    return {
        "risk_flags": safe_flags,
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
        return _failure("LLM_UNAVAILABLE", "LLM returned empty response")

    try:
        data = _parse_profile(raw)
        return _success(data)
    except (json.JSONDecodeError, ValueError, TypeError) as error:
        return _failure("INVALID_PROFILE_JSON", str(error))
