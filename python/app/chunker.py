import re

from . import config

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


def _lineage(heading: list[str]) -> str:
    return " > ".join(h for h in heading if h)


def _split_long(text: str, chunk_chars: int, overlap: int) -> list[str]:
    """Hard-split a single oversized block with a sliding tail overlap."""
    if len(text) <= chunk_chars:
        return [text]
    parts: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_chars
        parts.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
        if start >= end:
            break
    return parts


def chunk_markdown(md: str) -> list[dict]:
    """Split markdown into one chunk per heading section, carrying heading
    lineage. Oversized sections are hard-split with overlap.

    Returns [{"id": int, "heading": str, "text": str}].
    """
    chunk_chars = config.CHUNK_CHARS
    overlap = config.OVERLAP

    # Group lines into sections; heading lines define the stack, bodies hold
    # the content beneath them (heading line itself excluded to avoid dupes).
    sections: list[tuple[list[str], str]] = []
    heading: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        nonlocal buf
        text = "\n".join(buf).strip()
        if text:
            sections.append((list(heading), text))
        buf = []

    for line in md.splitlines():
        m = _HEADING_RE.match(line)
        if m:
            flush()
            level = len(m.group(1))
            heading = heading[: level - 1] + [m.group(2).strip()]
        else:
            buf.append(line)
    flush()

    # One chunk per section, prefixing the heading lineage.
    packed: list[tuple[str, str]] = []
    for head_stack, body in sections:
        head = _lineage(head_stack)
        block = body
        if head:
            block = f"### {head}\n\n{body}"
        if len(block) > chunk_chars:
            for piece in _split_long(block, chunk_chars, overlap):
                packed.append((head, piece.strip()))
        else:
            packed.append((head, block.strip()))

    return [
        {"id": i, "heading": head, "text": text}
        for i, (head, text) in enumerate(packed)
        if text
    ]