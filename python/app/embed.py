import httpx

from . import config


def embed_texts(base_url: str, model: str, texts: list[str]) -> list[list[float]] | None:
    """Embed a list of texts via Ollama /api/embed.

    Returns None when embeddings are unavailable (no model pulled, server
    down, or a batch mismatch) so callers can fall back to lexical ranking.
    """
    if not model or not texts:
        return None
    url = base_url.rstrip("/") + "/api/embed"
    out: list[list[float]] = []
    try:
        with httpx.Client(timeout=120) as client:
            for i in range(0, len(texts), config.EMBED_BATCH):
                batch = texts[i : i + config.EMBED_BATCH]
                resp = client.post(url, json={"model": model, "input": batch})
                resp.raise_for_status()
                data = resp.json()
                embs = data.get("embeddings")
                if not embs or len(embs) != len(batch):
                    return None
                out.extend(embs)
        return out
    except Exception:
        return None