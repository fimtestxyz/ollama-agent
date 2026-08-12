import { NextResponse } from "next/server";
import { adoptLegacySessions, getPrefs, setPrefs } from "@/lib/store";
import { getUserId } from "@/lib/auth";
import { auth, isAuthConfigured } from "@/auth";

export const runtime = "nodejs";

export async function GET() {
  let userId: string;
  try {
    userId = await getUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // One-time migration: the configured OWNER_EMAIL adopting their legacy
  // anonymous sessions happens right after their first sign-in.
  if (isAuthConfigured()) {
    const session = await auth();
    const adopted = await adoptLegacySessions(userId, session?.user?.email ?? undefined);
    if (adopted > 0) {
      return NextResponse.json({ prefs: await getPrefs(userId), adopted });
    }
  }

  const prefs = await getPrefs(userId);
  return NextResponse.json({ prefs });
}

export async function PUT(req: Request) {
  let userId: string;
  try {
    userId = await getUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let patch: Record<string, unknown>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const prefs = await setPrefs(userId, patch as Parameters<typeof setPrefs>[1]);
  return NextResponse.json({ prefs });
}