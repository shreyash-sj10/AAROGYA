from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np


@dataclass(frozen=True)
class ChunkItem:
    id: str
    text: str
    metadata: Dict[str, str]


class VectorStore:
    def __init__(self, dim: int) -> None:
        self.dim = dim
        self.items: List[ChunkItem] = []
        self.matrix = np.zeros((0, dim), dtype=np.float32)

        try:
            import faiss  # type: ignore

            self._faiss = faiss
            self.index = faiss.IndexFlatIP(dim)
        except Exception:
            self._faiss = None
            self.index = None

    def add(self, embeddings: Sequence[Sequence[float]], items: Sequence[ChunkItem]) -> None:
        if not embeddings or not items:
            return

        vectors = np.asarray(embeddings, dtype=np.float32)
        if vectors.ndim != 2 or vectors.shape[1] != self.dim:
            raise ValueError("Embedding shape mismatch")

        vectors = self._normalize(vectors)
        self.items.extend(items)

        if self.index is not None:
            self.index.add(vectors)
        else:
            self.matrix = np.vstack([self.matrix, vectors])

    def search(self, query_embedding: Sequence[float], top_k: int = 3) -> List[ChunkItem]:
        if not self.items:
            return []

        query = np.asarray(query_embedding, dtype=np.float32).reshape(1, -1)
        if query.shape[1] != self.dim:
            raise ValueError("Query embedding dimension mismatch")

        query = self._normalize(query)
        k = max(1, min(top_k, len(self.items)))

        if self.index is not None:
            scores, indices = self.index.search(query, k)
            flat_indices = indices[0].tolist()
        else:
            similarities = np.dot(self.matrix, query[0])
            ranked = np.argsort(-similarities, kind="mergesort")
            flat_indices = ranked[:k].tolist()

        return [self.items[i] for i in flat_indices if 0 <= i < len(self.items)]

    @staticmethod
    def _normalize(vectors: np.ndarray) -> np.ndarray:
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return vectors / norms


def load_store_from_index(index_path: str) -> VectorStore:
    import json

    path = Path(index_path)
    if not path.exists():
        return VectorStore(dim=384)

    rows = json.loads(path.read_text(encoding="utf-8"))
    if not rows:
        return VectorStore(dim=384)

    dim = len(rows[0].get("embedding", [])) or 384
    store = VectorStore(dim=dim)

    embeddings = []
    items: List[ChunkItem] = []

    for row in rows:
        embedding = row.get("embedding", [])
        if not isinstance(embedding, list) or len(embedding) != dim:
            continue
        chunk_id = str(row.get("id", "")).strip()
        text = str(row.get("text", "")).strip()
        metadata = row.get("metadata", {}) if isinstance(row.get("metadata", {}), dict) else {}
        if not chunk_id or not text:
            continue
        embeddings.append(embedding)
        items.append(ChunkItem(id=chunk_id, text=text, metadata=metadata))

    store.add(embeddings, items)
    return store
