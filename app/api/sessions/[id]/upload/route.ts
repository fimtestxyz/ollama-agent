import { NextResponse } from "next/server";
import { addFile, getSession } from "@/lib/store";
import { extractText, ExtractError } from "@/lib/extract";

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

  const baseUrl = (form.get("baseUrl") as string | null) ?? "";
  const embedModel = (form.get("embedModel") as string | null) ?? "";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(file.name, buffer);
    if (!text.trim()) {
      return NextResponse.json(
        { error: `No readable text found in "${file.name}". It may be a scanned image.` },
        { status: 422 }
      );
    }
    const doc = await addFile(
      id,
      { name: file.name, size: file.size, mime: file.type },
      text,
      baseUrl,
      embedModel
    );
    return NextResponse.json({
      file: {
        id: doc.id,
        name: doc.name,
        size: doc.size,
        strategy: doc.strategy,
        preview: doc.preview,
      },
      charCount: text.length,
      chunkCount: doc.chunks.length,
    });
  } catch (err) {
    const status = err instanceof ExtractError ? 400 : 500;
    return NextResponse.json(
      { error: (err as Error).message || "Failed to process file" },
      { status }
    );
  }
}
