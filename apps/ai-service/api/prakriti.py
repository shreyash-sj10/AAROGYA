from __future__ import annotations

from typing import Dict, List, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from prakriti.prakriti_service import estimate_prakriti_ml


router = APIRouter()


class PrakritiAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body_build: Literal["thin", "medium", "heavy"]
    skin: Literal["dry", "warm_oily", "thick_cool"]
    appetite: Literal["irregular", "strong", "slow"]
    energy: Literal["variable", "intense", "stable"]
    nature: Literal["anxious", "irritable", "calm"]
    sleep: Literal["light", "moderate", "deep"]
    climate: Literal["warm", "cool", "dry"]
    food_response: Literal["bloated", "acidic", "sluggish"]
    work_style: Literal["inconsistent", "intense", "steady"]
    weight: Literal["lose", "stable", "gain"]


class PrakritiRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: PrakritiAnswers
    symptoms: List[str] = []


class PrakritiResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vata: float
    pitta: float
    kapha: float


@router.post("/ml/prakriti", response_model=PrakritiResponse)
def estimate_prakriti(payload: PrakritiRequest) -> Dict[str, float]:
    result = estimate_prakriti_ml(payload.answers.model_dump(), payload.symptoms)
    return {
        "vata": float(result["vata"]),
        "pitta": float(result["pitta"]),
        "kapha": float(result["kapha"]),
    }
