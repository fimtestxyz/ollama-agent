import { NextResponse } from "next/server";
import { removeFile } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const ok = await removeFile(id, fileId);
  if (!ok) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
