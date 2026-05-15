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


def _first_sentence(text: str) -> str:
    stripped = (text or "").strip()
    if not stripped:
        return ""
    segment = stripped.split(".")[0].strip()
    if not segment:
        return ""
    return f"{segment}."


def _ensure_minimum_structure(lines: List[str], query: str) -> List[str]:
    safe_lines = [line.strip() for line in lines if isinstance(line, str) and line.strip()]

    while len(safe_lines) < 3:
        if len(safe_lines) == 0:
            safe_lines.append("Ayurveda explains this through dosha balance and digestive strength.")
        elif len(safe_lines) == 1:
            safe_lines.append("Your question is interpreted using the provided context and available references.")
        else:
            safe_lines.append(f"For '{(query or '').strip()}', the guidance remains contextual and evidence-grounded.")

    return safe_lines[:3]


def generateExplanation(query: str, contextChunks: List[Dict[str, object]]) -> Dict[str, object]:
    safe_query = (query or "").strip()
    safe_chunks = _to_safe_chunks(contextChunks)

    if not safe_query or not safe_chunks:
        return {"explanation": "", "sources": []}

    citations = []
    structural_lines: List[str] = []

    for chunk in safe_chunks[:3]:
        base_sentence = _first_sentence(str(chunk.get("text", "")))
        chapter = str(chunk.get("chapter", "")).strip() or "Unknown"
        source = str(chunk.get("source", "")).strip() or "Unknown"
        if base_sentence:
            structural_lines.append(f"{base_sentence} Source context: {source}, Chapter {chapter}.")

        citations.append(
            {
                "text_id": str(chunk.get("id", "")).strip(),
                "source": source,
                "chapter": chapter,
            }
        )

    lines = _ensure_minimum_structure(structural_lines, safe_query)

    explanation = " ".join(lines).strip()

    return {
        "explanation": explanation,
        "sources": citations,
    }
