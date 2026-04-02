from __future__ import annotations

from typing import Dict, List


def _to_safe_chunks(context_chunks: List[Dict[str, object]]) -> List[Dict[str, object]]:
    safe_chunks: List[Dict[str, object]] = []
    for chunk in context_chunks or []:
        if not isinstance(chunk, dict):
            continue
        chunk_id = str(chunk.get("id", "")).strip()
        text = str(chunk.get("text", "")).strip()
        source = str(chunk.get("source", "")).strip()
        chapter = str(chunk.get("chapter", "")).strip()
        section = str(chunk.get("section", "")).strip()

        if chunk_id and text and source:
            safe_chunks.append(
                {
                    "id": chunk_id,
                    "text": text,
                    "source": source,
                    "chapter": chapter,
                    "section": section,
                }
            )
    return safe_chunks


def generateExplanation(query: str, contextChunks: List[Dict[str, object]]) -> Dict[str, object]:
    safe_query = (query or "").strip()
    safe_chunks = _to_safe_chunks(contextChunks)

    if not safe_query or not safe_chunks:
        return {"explanation": "", "sources": []}

    lines = []
    citations = []

    for chunk in safe_chunks[:3]:
        sentence = chunk["text"].split(".")[0].strip()
        if sentence:
            lines.append(f"{sentence} (Source: {chunk['source']}, Chapter {chunk['chapter']})")

        citations.append(
            {
                "text_id": chunk["id"],
                "source": chunk["source"],
                "chapter": chunk["chapter"],
            }
        )

    explanation = " ".join(lines).strip()

    return {
        "explanation": explanation,
        "sources": citations,
    }
