import { NextResponse } from "next/server";
import { removeFile } from "@/lib/store";
import { PY_BACKEND_URL } from "@/lib/py";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const ok = await removeFile(id, fileId);
  if (!ok) return NextResponse.json({ error: "File not found" }, { status: 404 });
  fetch(`${PY_BACKEND_URL}/session/${id}/files/${fileId}`, {
    method: "DELETE",
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}