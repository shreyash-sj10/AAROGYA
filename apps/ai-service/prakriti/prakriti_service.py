from __future__ import annotations

import hashlib
import random
from typing import Dict, List, Mapping


DOSHAS: List[str] = ["vata", "pitta", "kapha"]

ANSWER_TO_DOSHA: Dict[str, Dict[str, str]] = {
    "body_build": {"thin": "vata", "medium": "pitta", "heavy": "kapha"},
    "skin": {"dry": "vata", "warm_oily": "pitta", "thick_cool": "kapha"},
    "appetite": {"irregular": "vata", "strong": "pitta", "slow": "kapha"},
    "energy": {"variable": "vata", "intense": "pitta", "stable": "kapha"},
    "nature": {"anxious": "vata", "irritable": "pitta", "calm": "kapha"},
    "sleep": {"light": "vata", "moderate": "pitta", "deep": "kapha"},
    "climate": {"warm": "vata", "cool": "pitta", "dry": "kapha"},
    "food_response": {"bloated": "vata", "acidic": "pitta", "sluggish": "kapha"},
    "work_style": {"inconsistent": "vata", "intense": "pitta", "steady": "kapha"},
    "weight": {"lose": "vata", "stable": "pitta", "gain": "kapha"},
}

SYMPTOM_HINTS: Dict[str, Dict[str, float]] = {
    "bloating": {"vata": 0.25},
    "constipation": {"vata": 0.3},
    "dry_skin": {"vata": 0.25},
    "acidity": {"pitta": 0.3},
    "heartburn": {"pitta": 0.25},
    "irritability": {"pitta": 0.2},
    "sluggishness": {"kapha": 0.25},
    "weight_gain": {"kapha": 0.3},
    "water_retention": {"kapha": 0.2},
}


def _normalized(scores: Mapping[str, float]) -> Dict[str, float]:
    vata = max(0.0, float(scores.get("vata", 0.0)))
    pitta = max(0.0, float(scores.get("pitta", 0.0)))
    kapha = max(0.0, float(scores.get("kapha", 0.0)))
    total = vata + pitta + kapha
    if total <= 0:
        return {"vata": 1.0 / 3.0, "pitta": 1.0 / 3.0, "kapha": 1.0 / 3.0}

    nv = vata / total
    np = pitta / total
    nk = 1.0 - nv - np
    return {"vata": nv, "pitta": np, "kapha": nk}


def _seed_from_answers(answers: Mapping[str, str], symptoms: List[str]) -> int:
    answer_blob = "|".join([f"{key}:{answers.get(key, '')}" for key in sorted(ANSWER_TO_DOSHA.keys())])
    symptom_blob = "|".join(sorted([entry.strip().lower() for entry in symptoms if isinstance(entry, str)]))
    digest = hashlib.sha256(f"{answer_blob}::{symptom_blob}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def _build_synthetic_weights() -> Dict[str, Dict[str, Dict[str, float]]]:
    rng = random.Random(42)
    weights: Dict[str, Dict[str, Dict[str, float]]] = {}
    for question, mapping in ANSWER_TO_DOSHA.items():
        weights[question] = {}
        for answer, dominant in mapping.items():
            entry = {"vata": 0.18, "pitta": 0.18, "kapha": 0.18}
            entry[dominant] += 0.64
            entry["vata"] += rng.uniform(-0.03, 0.03)
            entry["pitta"] += rng.uniform(-0.03, 0.03)
            entry["kapha"] += rng.uniform(-0.03, 0.03)
            weights[question][answer] = _normalized(entry)
    return weights


SYNTHETIC_WEIGHTS = _build_synthetic_weights()


def estimate_prakriti_ml(answers: Mapping[str, str], symptoms: List[str] | None = None) -> Dict[str, float]:
    safe_symptoms = symptoms if isinstance(symptoms, list) else []
    scores = {"vata": 0.0, "pitta": 0.0, "kapha": 0.0}

    for question, answer_weights in SYNTHETIC_WEIGHTS.items():
        answer = answers.get(question)
        if answer in answer_weights:
            w = answer_weights[answer]
            scores["vata"] += float(w["vata"])
            scores["pitta"] += float(w["pitta"])
            scores["kapha"] += float(w["kapha"])

    for raw in safe_symptoms:
        symptom = raw.strip().lower()
        if not symptom:
            continue
        hints = SYMPTOM_HINTS.get(symptom)
        if not hints:
            continue
        for dosha, weight in hints.items():
            scores[dosha] += float(weight)

    rng = random.Random(_seed_from_answers(answers, safe_symptoms))
    scores["vata"] += rng.uniform(-0.06, 0.06)
    scores["pitta"] += rng.uniform(-0.06, 0.06)
    scores["kapha"] += rng.uniform(-0.06, 0.06)

    return _normalized(scores)
