from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from fastapi import APIRouter
from pydantic import BaseModel

from rag.generator import generateExplanation
from rag.retriever import retrieveContext


router = APIRouter()


class RAGExplainRequest(BaseModel):
    query: str


def _run_pipeline(query: str):
    chunks = retrieveContext(query)
    result = generateExplanation(query, chunks)
    explanation = result.get("explanation", "") if isinstance(result, dict) else ""
    sources = result.get("sources", []) if isinstance(result, dict) else []

    return {
        "explanation": explanation if isinstance(explanation, str) else "",
        "sources": sources if isinstance(sources, list) else [],
    }


@router.post("/rag/explain")
def rag_explain(payload: RAGExplainRequest):
    query = payload.query.strip()
    if not query:
        return {"explanation": "", "sources": []}

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_run_pipeline, query)
            return future.result(timeout=2.0)
    except (FutureTimeoutError, Exception):
        return {"explanation": "", "sources": []}
