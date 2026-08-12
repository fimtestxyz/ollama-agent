import { NextResponse } from "next/server";
import { createSession, listSessions } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      updatedAt: s.updatedAt,
      messageCount: s.messages.length,
      fileCount: s.files.length,
      preview: s.messages[s.messages.length - 1]?.content.slice(0, 60) ?? "",
    })),
  });
}

export async function POST(req: Request) {
  let name: string | undefined;
  try {
    const body = await req.json();
    name = body?.name;
  } catch {
    // name optional
  }
  const session = await createSession(name);
  return NextResponse.json({ session }, { status: 201 });
}
