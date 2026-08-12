import { NextResponse } from "next/server";
import { addFileRecord, getSession } from "@/lib/store";
import { extractText, ExtractError, isSupported, MAX_FILE_BYTES } from "@/lib/extract";
import { PY_BACKEND_URL } from "@/lib/py";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file field provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit.` },
      { status: 413 }
    );
  }

  const baseUrl = (form.get("baseUrl") as string | null) ?? "";
  const embedModel = (form.get("embedModel") as string | null) ?? "";

  /* Primary path — Python backend converts to markdown, embeds, and runs
     PageRank over the chunk graph. */
  try {
    const fd = new FormData();
    fd.append("session_id", id);
    fd.append("file", file, file.name);
    if (baseUrl) fd.append("base_url", baseUrl);
    if (embedModel) fd.append("embed_model", embedModel);
    const res = await fetch(`${PY_BACKEND_URL}/process`, {
      method: "POST",
      body: fd,
      signal: AbortSignal.timeout(180_000),
    });
    if (res.ok) {
      const data = await res.json();
      const doc = await addFileRecord(id, {
        name: data.name,
        size: data.size,
        mime: data.mime,
        strategy: data.strategy === "embed" ? "embed" : "fulltext",
        charCount: data.char_count,
        chunkCount: data.chunk_count,
        preview: data.preview,
      });
      return NextResponse.json({
        file: {
          id: doc.id,
          name: doc.name,
          size: doc.size,
          strategy: doc.strategy,
          preview: doc.preview,
        },
        charCount: data.char_count,
        chunkCount: data.chunk_count,
      });
    }
    let detail = "Document processing failed";
    try {
      const d = await res.json();
      detail = d.detail || detail;
    } catch {}
    return NextResponse.json({ error: detail }, { status: res.status >= 500 ? 502 : res.status });
  } catch {
    // Python backend unreachable — fall through to the Node fallback.
  }

  /* Fallback — Node extraction stores a plain full-text record. */
  try {
    if (!isSupported(file.name)) {
      return NextResponse.json(
        { error: "Python backend is offline, and this file type isn't supported by the built-in fallback." },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(file.name, buffer);
    if (!text.trim()) {
      return NextResponse.json(
        { error: `No readable text found in "${file.name}". It may be a scanned image.` },
        { status: 422 }
      );
    }
    const doc = await addFileRecord(id, {
      name: file.name,
      size: file.size,
      mime: file.type,
      strategy: "fulltext",
      charCount: text.length,
      chunkCount: 1,
      preview: text.slice(0, 200),
    });
    return NextResponse.json({
      file: { id: doc.id, name: doc.name, size: doc.size, strategy: doc.strategy, preview: doc.preview },
      charCount: text.length,
      chunkCount: 1,
    });
  } catch (err) {
    const status = err instanceof ExtractError ? 400 : 500;
    return NextResponse.json(
      { error: (err as Error).message || "Failed to process file" },
      { status }
    );
  }
}