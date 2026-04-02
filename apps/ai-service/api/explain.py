from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel

from core.llm_wrapper import call_llm
from rag.retriever import retrieveContext
from rag.generator import generateExplanation


router = APIRouter()


class ExplainRequest(BaseModel):
    context: Dict[str, Any]
    reasoning: Dict[str, Any]


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


def _safe_citations(raw_sources: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    citations: List[Dict[str, str]] = []
    for source in raw_sources:
        if not isinstance(source, dict):
            continue
        source_name = str(source.get("source", "")).strip()
        chapter = str(source.get("chapter", "")).strip()
        text_id = str(source.get("text_id", source.get("id", ""))).strip()
        if source_name and chapter:
            citations.append(
                {
                    "text_id": text_id,
                    "source": source_name,
                    "chapter": chapter,
                }
            )
    return citations


@router.post("/ai/explain")
def ai_explain(payload: ExplainRequest):
    safe_context = payload.context if isinstance(payload.context, dict) else {}
    safe_reasoning = payload.reasoning if isinstance(payload.reasoning, dict) else {}

    query = f"context={safe_context}; reasoning={safe_reasoning}"
    chunks = retrieveContext(query)
    base = generateExplanation(query, chunks)

    explanation = str(base.get("explanation", "")).strip() if isinstance(base, dict) else ""
    citations = _safe_citations(base.get("sources", []) if isinstance(base, dict) else [])

    if explanation:
        prompt = "\n".join([
            "Use ONLY the provided context.",
            "No hallucination. No external facts.",
            "Return one concise explanation sentence.",
            "Append citation in format: (Source: Charaka Samhita, Chapter X) where applicable.",
            f"Context: {chunks[:3]}",
            f"Reasoning: {safe_reasoning}",
        ])
        llm_text = call_llm(prompt)
        if isinstance(llm_text, str) and llm_text.strip():
            explanation = llm_text.strip()

    if not explanation:
        return _failure("NO_EXPLANATION", "Could not build grounded explanation")

    return _success({
        "explanation": explanation,
        "citations": citations,
    })
