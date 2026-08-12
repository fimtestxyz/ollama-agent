import { NextResponse } from "next/server";
import { listModels } from "@/lib/ollama";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const baseUrl = new URL(req.url).searchParams.get("baseUrl") ?? "";
  try {
    const models = await listModels(baseUrl);
    return NextResponse.json({ models: models.map((m) => m.name) });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
