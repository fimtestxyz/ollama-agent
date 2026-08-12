import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from . import converters
from .chunker import chunk_markdown
from .embed import embed_texts
from .graph import pagerank_importances
from .index import index
from .ranking import retrieve
from .schemas import ProcessResp, RetrieveReq, RetrieveResp

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


def _index_markdown(
    session_id: str,
    name: str,
    markdown: str,
    size: int,
    mime: str,
    base_url: str,
    embed_model: str,
) -> tuple[dict, ProcessResp]:
    chunks = chunk_markdown(markdown)
    if not chunks:
        raise HTTPException(status_code=422, detail="Extracted text produced no chunks.")

    texts = [c["text"] for c in chunks]
    embeddings = embed_texts(base_url, embed_model, texts)
    pagerank = pagerank_importances(texts, embeddings)
    strategy = "embed" if embeddings else "fulltext"

    entry = {
        "file_id": uuid.uuid4().hex,
        "name": name,
        "size": size,
        "mime": mime,
        "markdown": markdown,
        "char_count": len(markdown),
        "chunk_count": len(chunks),
        "strategy": strategy,
        "chunks": chunks,
        "embeddings": embeddings,
        "pagerank": pagerank,
        "preview": markdown[:200],
    }
    index.add_file(session_id, entry)

    return entry, ProcessResp(
        file_id=entry["file_id"],
        name=entry["name"],
        size=entry["size"],
        mime=entry["mime"],
        char_count=entry["char_count"],
        chunk_count=entry["chunk_count"],
        strategy=strategy,
        preview=entry["preview"],
    )


@router.post("/process", response_model=ProcessResp)
async def process_file(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    base_url: str = Form("http://localhost:11434"),
    embed_model: str = Form(""),
) -> ProcessResp:
    data = await file.read()
    name = file.filename or "file"
    try:
        markdown = converters.to_markdown(name, data)
    except converters.ConvertError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not markdown.strip():
        raise HTTPException(
            status_code=422,
            detail=f'No readable text found in "{name}". It may be a scanned image.',
        )
    _, resp = _index_markdown(
        session_id, name, markdown, len(data), file.content_type or "", base_url, embed_model
    )
    return resp


class ProcessTextReq(BaseModel):
    session_id: str
    name: str = "document.md"
    markdown: str
    base_url: str = "http://localhost:11434"
    embed_model: str = ""


@router.post("/process_text", response_model=ProcessResp)
def process_text(req: ProcessTextReq) -> ProcessResp:
    """Backfill/utility endpoint: index markdown that already exists as text."""
    markdown = req.markdown.strip()
    if not markdown:
        raise HTTPException(status_code=422, detail="No text provided.")
    _, resp = _index_markdown(
        req.session_id,
        req.name,
        markdown,
        len(markdown.encode("utf-8")),
        "text/markdown",
        req.base_url,
        req.embed_model,
    )
    return resp


@router.post("/retrieve", response_model=RetrieveResp)
def retrieve_chunks(req: RetrieveReq) -> RetrieveResp:
    files = index.session_files(req.session_id)
    chunks, strategy = retrieve(files, req.query, req.base_url, req.embed_model, req.top_k)
    return RetrieveResp(chunks=chunks, strategy=strategy)


@router.delete("/session/{session_id}/files/{file_id}")
def delete_file(session_id: str, file_id: str) -> dict:
    ok = index.remove_file(session_id, file_id)
    if not ok:
        raise HTTPException(status_code=404, detail="File index entry not found")
    return {"ok": True}


@router.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict:
    index.remove_session(session_id)
    return {"ok": True}