import io
import os
import tempfile
from . import config

SUPPORTED = {".pdf", ".docx", ".txt", ".md", ".mdx"}


class ConvertError(Exception):
    pass


def is_supported(name: str) -> bool:
    return _ext(name) in SUPPORTED


def _ext(name: str) -> str:
    return os.path.splitext(name)[1].lower()


def to_markdown(name: str, data: bytes) -> str:
    """Convert an uploaded file's bytes to markdown text."""
    if len(data) > config.MAX_FILE_BYTES:
        raise ConvertError("File exceeds the 20 MB limit.")
    ext = _ext(name)

    if ext == ".pdf":
        return _pdf_to_md(data)
    if ext == ".docx":
        return _markitdown_to_md(data, ".docx")
    if ext in (".txt", ".md", ".mdx"):
        return data.decode("utf-8", errors="replace")
    if ext == ".doc":
        raise ConvertError(
            "Legacy .doc files aren't supported — save as .docx and re-upload."
        )
    raise ConvertError(
        "Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file."
    )


def _pdf_to_md(data: bytes) -> str:
    try:
        import pymupdf4llm
    except Exception as exc:  # pragma: no cover
        raise ConvertError("PDF support is not installed.") from exc
    try:
        return pymupdf4llm.to_markdown(data) or ""
    except Exception:
        # Some versions expect a file path or fitz.Document.
        import pymupdf

        with pymupdf.open(stream=data, filetype="pdf") as doc:
            return pymupdf4llm.to_markdown(doc) or ""


def _markitdown_to_md(data: bytes, ext: str) -> str:
    try:
        from markitdown import MarkItDown
    except Exception as exc:  # pragma: no cover
        raise ConvertError("DOCX support is not installed.") from exc
    md = MarkItDown()
    try:
        result = md.convert(io.BytesIO(data))
    except TypeError:
        # Fallback for versions that prefer a filename.
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            result = md.convert(tmp_path)
        finally:
            os.unlink(tmp_path)
    return getattr(result, "text_content", "") or ""