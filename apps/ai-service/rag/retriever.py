from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import numpy as np

from rag.vector_store import ChunkItem, VectorStore


BASE_DIR = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = BASE_DIR / "data" / "knowledge"

SOURCE_MAP = {
    "nutrition": {"source": "Nutrition Reference", "chapter": "Dietary Patterns", "section": "Low GI"},
    "ayurveda": {"source": "Charaka Samhita", "chapter": "Sutra Sthana", "section": "Ahara Vidhi"},
    "medical": {"source": "Clinical Safety Notes", "chapter": "Safety", "section": "Advisory"},
}


class Retriever:
    def __init__(self, top_k: int = 3) -> None:
        self.top_k = max(3, min(5, top_k))
        self.model = self._load_model()
        self.store = self._build_store()

    def _load_model(self):
        from sentence_transformers import SentenceTransformer  # type: ignore

        return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    def _infer_type(self, filename: str) -> str:
        name = filename.lower()
        if "nutrition" in name:
            return "nutrition"
        if "ayurveda" in name:
            return "ayurveda"
        return "medical"

    def _chunk_text(self, text: str, chunk_words: int = 260) -> List[str]:
        words = text.split()
        if not words:
            return []

        chunks: List[str] = []
        step = max(200, min(500, chunk_words))

        for i in range(0, len(words), step):
            chunk = words[i:i + step]
            if not chunk:
                continue
            chunks.append(" ".join(chunk))

        return chunks

    def _build_store(self) -> VectorStore:
        files = sorted(KNOWLEDGE_DIR.glob("*.txt"), key=lambda p: p.name)
        texts: List[str] = []
        items: List[ChunkItem] = []

        for file_path in files:
            content = file_path.read_text(encoding="utf-8")
            chunks = self._chunk_text(content)
            doc_type = self._infer_type(file_path.name)
            meta = SOURCE_MAP.get(doc_type, SOURCE_MAP["medical"])

            for idx, chunk in enumerate(chunks):
                chunk_id = f"{file_path.stem}_{idx}"
                items.append(
                    ChunkItem(
                        id=chunk_id,
                        text=chunk,
                        metadata={
                            "type": doc_type,
                            "source": meta["source"],
                            "chapter": meta["chapter"],
                            "section": meta["section"],
                        },
                    )
                )
                texts.append(chunk)

        if not texts:
            return VectorStore(dim=384)

        embeddings = self.model.encode(texts, normalize_embeddings=True)
        matrix = np.asarray(embeddings, dtype=np.float32)
        store = VectorStore(dim=matrix.shape[1])
        store.add(matrix, items)
        return store

    def retrieveContext(self, query: str) -> List[Dict[str, object]]:
        safe_query = (query or "").strip()
        if not safe_query:
            return []

        embedding = self.model.encode([safe_query], normalize_embeddings=True)[0]
        hits = self.store.search(embedding, top_k=self.top_k)

        results = []
        for hit in hits:
            metadata = hit.metadata if isinstance(hit.metadata, dict) else {}
            results.append(
                {
                    "id": hit.id,
                    "text": hit.text,
                    "source": metadata.get("source", "Unknown Source"),
                    "chapter": metadata.get("chapter", "Unknown Chapter"),
                    "section": metadata.get("section", "Unknown Section"),
                }
            )

        return results


_default_retriever: Retriever | None = None


def retrieveContext(query: str) -> List[Dict[str, object]]:
    global _default_retriever
    if _default_retriever is None:
        _default_retriever = Retriever(top_k=3)
    return _default_retriever.retrieveContext(query)
