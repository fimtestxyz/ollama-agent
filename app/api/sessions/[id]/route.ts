import { NextResponse } from "next/server";
import {
  deleteSession,
  getSession,
  publicSession,
  renameSession,
} from "@/lib/store";
import { PY_BACKEND_URL } from "@/lib/py";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ session: publicSession(session) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteSession(id);
  if (!ok) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  fetch(`${PY_BACKEND_URL}/session/${id}`, { method: "DELETE" }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let name: string | undefined;
  try {
    const body = await req.json();
    name = body?.name;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await renameSession(id, name ?? "");
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ session: publicSession(session) });
}
