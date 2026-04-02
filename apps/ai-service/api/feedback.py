from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel

from core.llm_wrapper import call_llm


router = APIRouter()


class FeedbackRequest(BaseModel):
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


@router.post("/ai/feedback")
def ai_feedback(payload: FeedbackRequest):
    text = payload.text.strip()
    if not text:
        return _failure("INVALID_INPUT", "text is required")

    prompt = "\n".join([
        "Classify user feedback.",
        "Return STRICT JSON only:",
        '{"feedback_type":"LIKE|DISLIKE|REPLACE","target":"string"}',
        "No extra text.",
        f"Input: {text}",
    ])

    raw = call_llm(prompt)
    if not raw:
        return _failure("LLM_UNAVAILABLE", "LLM returned empty response")

    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as error:
        return _failure("INVALID_FEEDBACK_JSON", str(error))

    if not isinstance(parsed, dict):
        return _failure("INVALID_FEEDBACK_JSON", "feedback output is not JSON object")

    feedback_type = str(parsed.get("feedback_type", "")).strip().upper()
    target = str(parsed.get("target", "")).strip()

    if feedback_type not in {"LIKE", "DISLIKE", "REPLACE"}:
        return _failure("INVALID_FEEDBACK_TYPE", "feedback_type must be LIKE, DISLIKE, or REPLACE")

    return _success({
        "feedback_type": feedback_type,
        "target": target,
    })
