from . import config
from .embed import embed_texts
from .graph import _cosine
from .text_utils import tokenize


def _lexical_sim(a: str, b: str) -> float:
    ta, tb = tokenize(a), tokenize(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    return 2 * inter / (len(ta) + len(tb))


def _chunk_rows(session_files: list[dict]) -> list[dict]:
    rows = []
    embed_available = False
    for f in session_files:
        embs = f.get("embeddings")
        pr = f.get("pagerank") or [0.0] * len(f["chunks"])
        for i, c in enumerate(f["chunks"]):
            rows.append(
                {
                    "text": c.get("text", ""),
                    "file": f.get("name", ""),
                    "pagerank": pr[i] if i < len(pr) else 0.0,
                    "embedding": embs[i] if embs and i < len(embs) else None,
                    "sim": 0.0,
                    "score": 0.0,
                }
            )
        if embs:
            embed_available = True
    return rows, embed_available


def retrieve(
    session_files: list[dict],
    query: str,
    base_url: str,
    embed_model: str,
    top_k: int | None = None,
) -> tuple[list[dict], str]:
    """Rank chunks with the hybrid score `sim_norm * (1 + ALPHA * pagerank)`."""
    rows, embed_available = _chunk_rows(session_files)
    if not rows:
        return [], "none"

    query_emb = None
    if embed_available and embed_model:
        got = embed_texts(base_url, embed_model, [query])
        query_emb = got[0] if got else None

    for r in rows:
        if query_emb is not None and r["embedding"] is not None:
            r["sim"] = _cosine(query_emb, r["embedding"])
        else:
            r["sim"] = _lexical_sim(query, r["text"])

    strategy = "embed" if query_emb is not None else "keyword"

    pool = sorted(rows, key=lambda r: r["sim"], reverse=True)[: config.CANDIDATES]
    sims = [r["sim"] for r in pool]
    lo, hi = (min(sims), max(sims)) if sims else (0.0, 0.0)

    for r in pool:
        sim_norm = (r["sim"] - lo) / (hi - lo) if hi > lo else 1.0
        r["score"] = sim_norm * (1.0 + config.ALPHA * r["pagerank"])

    ranked = sorted(pool, key=lambda r: r["score"], reverse=True)[
        : top_k or config.TOPK
    ]
    return [
        {
            "text": r["text"],
            "file": r["file"],
            "similarity": round(r["sim"], 4),
            "pagerank": round(r["pagerank"], 4),
            "score": round(r["score"], 4),
        }
        for r in ranked
    ], strategy