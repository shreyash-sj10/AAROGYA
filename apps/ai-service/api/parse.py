from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict


router = APIRouter()


class ParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str


class ParseData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symptoms: List[str]


class ParseError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    message: str


class ParseEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    data: Optional[ParseData]
    error: Optional[ParseError]


SYMPTOM_KEYWORDS: Dict[str, List[str]] = {
    "acidity": ["acidity", "acid", "heartburn", "burning"],
    "bloating": ["bloating", "bloated", "gas", "flatulence"],
    "constipation": ["constipation", "hard stool"],
    "fatigue": ["fatigue", "tired", "low energy", "weakness"],
    "indigestion": ["indigestion", "upset stomach", "poor digestion"],
}


def _extract_symptoms(text: str) -> List[str]:
    normalized = (text or "").strip().lower()
    if not normalized:
        return []

    found: List[str] = []
    for symptom, patterns in SYMPTOM_KEYWORDS.items():
        if any(pattern in normalized for pattern in patterns):
            found.append(symptom)

    return list(dict.fromkeys(found))


@router.post("/parse", response_model=ParseEnvelope)
def parse_text(payload: ParseRequest) -> Dict[str, Any] | JSONResponse:
    try:
        return {
            "success": True,
            "data": {
                "symptoms": _extract_symptoms(payload.text),
            },
            "error": None,
        }
    except Exception as error:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "error": {
                    "type": "PARSE_ERROR",
                    "message": str(error),
                },
            },
        )
