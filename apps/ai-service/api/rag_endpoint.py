from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel

from rag.generator import generateExplanation
from rag.retriever import retrieveContext


router = APIRouter()


class RAGRequest(BaseModel):
    query: str
    session_id: str
    context: Dict[str, Any]
    retrieved_documents: Dict[str, Any] | None = None


def _success(data: Dict[str, Any], fallback: bool = False, reason: str = "ok", mode: str = "normal") -> Dict[str, Any]:
    return {
        "success": True,
        "data": data,
        "error": None,
        "meta": {
            "fallback": fallback,
            "reason": reason,
            "mode": mode,
        },
    }


def _run_pipeline(query: str, context: Dict[str, Any], retrieved_documents: Dict[str, Any]):
    enriched = f"query={query}; context={context}; retrieved_documents={retrieved_documents}"
    chunks = retrieveContext(enriched)
    result = generateExplanation(enriched, chunks)

    explanation = result.get("explanation", "") if isinstance(result, dict) else ""
    sources = result.get("sources", []) if isinstance(result, dict) else []

    return {
        "explanation": explanation if isinstance(explanation, str) else "",
        "sources": sources if isinstance(sources, list) else [],
    }


@router.post("/ai/rag")
def ai_rag(payload: RAGRequest):
    query = payload.query.strip()
    session_id = payload.session_id.strip()
    context = payload.context if isinstance(payload.context, dict) else {}
    docs = payload.retrieved_documents if isinstance(payload.retrieved_documents, dict) else {}

    if not query or not session_id or not context:
        return _success({"explanation": "", "sources": []}, fallback=True, reason="no_context", mode="fallback")

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_run_pipeline, query, context, docs)
            data = future.result(timeout=2.0)

            explanation = str(data.get("explanation", "")).strip() if isinstance(data, dict) else ""
            if not explanation:
                return _success({"explanation": "", "sources": []}, fallback=True, reason="no_context", mode="fallback")

            return _success(data, fallback=False, reason="ok", mode="normal")
    except FutureTimeoutError:
        return _success({"explanation": "", "sources": []}, fallback=True, reason="timeout", mode="fallback")
    except Exception:
        return _success({"explanation": "", "sources": []}, fallback=True, reason="error", mode="fallback")
