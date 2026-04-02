from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import numpy as np

from rag.retriever import Retriever


BASE_DIR = Path(__file__).resolve().parent
OUT_PATH = BASE_DIR / "data" / "knowledge" / "index.json"


def main() -> None:
    retriever = Retriever(top_k=3)
    items = retriever.store.items

    rows: List[Dict[str, object]] = []
    if retriever.store.index is None:
        matrix = retriever.store.matrix
    else:
        # For faiss-backed store we recompute from texts for portable JSON index metadata.
        matrix = np.asarray(retriever.model.encode([i.text for i in items], normalize_embeddings=True), dtype=np.float32)

    for idx, item in enumerate(items):
        rows.append(
            {
                "id": item.id,
                "text": item.text,
                "metadata": item.metadata,
                "embedding": matrix[idx].tolist(),
            }
        )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(rows, ensure_ascii=True, indent=2), encoding="utf-8")
    print(f"Indexed {len(rows)} chunks -> {OUT_PATH}")


if __name__ == "__main__":
    main()
