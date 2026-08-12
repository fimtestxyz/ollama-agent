import math

import numpy as np

from . import config
from .text_utils import tokenize


def _cosine(a: list[float] | None, b: list[float] | None) -> float:
    if a is None or b is None or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def _lexical_sim(a: str, b: str) -> float:
    ta, tb = tokenize(a), tokenize(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    return 2 * inter / (len(ta) + len(tb))


def _pagerank_power(
    edges: list[tuple[int, int, float]],
    n: int,
    alpha: float = 0.85,
    max_iter: int = 200,
    tol: float = 1e-6,
) -> np.ndarray:
    """Weighted PageRank via power iteration (dense; chunk counts are small)."""
    mat = np.zeros((n, n))
    for i, j, w in edges:
        mat[i, j] += w
    for i in range(n):
        out = mat[i].sum()
        mat[i] = mat[i] / out if out > 0 else np.full(n, 1.0 / n)
    rank = np.full(n, 1.0 / n)
    for _ in range(max_iter):
        nxt = alpha * mat.T @ rank + (1.0 - alpha) / n
        if np.abs(nxt - rank).sum() < tol:
            rank = nxt
            break
        rank = nxt
    return rank


def pagerank_importances(texts: list[str], embeddings: list[list[float]] | None) -> list[float]:
    """Return normalized PageRank per chunk over the chunk graph.

    Edges: consecutive-chunk sequence links (weight 1) plus similarity edges
    between top-k neighbors above a threshold (embedding cosine, or lexical
    Dice similarity when embeddings are absent).
    """
    n = len(texts)
    if n == 0:
        return []
    if n == 1:
        return [1.0]

    def sim(a: int, b: int) -> float:
        if embeddings is not None:
            return _cosine(embeddings[a], embeddings[b])
        return _lexical_sim(texts[a], texts[b])

    edges: list[tuple[int, int, float]] = []
    for i in range(n - 1):  # sequence edges
        edges.append((i, i + 1, 1.0))
        edges.append((i + 1, i, 1.0))

    added: set[tuple[int, int]] = set()
    for i in range(n):
        scored = sorted(
            ((j, sim(i, j)) for j in range(n) if j != i),
            key=lambda t: t[1],
            reverse=True,
        )
        for j, s in scored[: config.SIM_NEIGHBORS]:
            if s >= config.SIM_EDGE_THRESHOLD and (i, j) not in added:
                added.add((i, j))
                added.add((j, i))
                edges.append((i, j, s))
                edges.append((j, i, s))

    ranks = _pagerank_power(edges, n)
    values = ranks.tolist()
    lo, hi = (min(values), max(values))
    if hi > lo:
        return [(v - lo) / (hi - lo) for v in values]
    return [1.0] * n