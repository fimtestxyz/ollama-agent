import { NextResponse } from "next/server";
import {
  addMessage,
  buildContextText,
  getSession,
  type Message,
  type RetrievedChunk,
} from "@/lib/store";
import {
  chatStream,
  normalizeBaseUrl,
  type OllamaChatMessage,
} from "@/lib/ollama";
import { PY_BACKEND_URL } from "@/lib/py";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MAX_HISTORY = 12;
const ERROR_MARKER = "\n\n[error]";

async function fetchPythonContext(
  sessionId: string,
  query: string,
  baseUrl: string,
  embedModel: string
): Promise<RetrievedChunk[]> {
  try {
    const res = await fetch(`${PY_BACKEND_URL}/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        query,
        base_url: baseUrl,
        embed_model: embedModel,
        top_k: 6,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const strategy: "embed" | "fulltext" =
      data.strategy === "embed" ? "embed" : "fulltext";
    return (data.chunks ?? []).map((c: { text: string; file: string; score: number }) => ({
      text: c.text,
      file: c.file,
      score: c.score,
      strategy,
    }));
  } catch {
    return []; // Python offline → answer from general knowledge.
  }
}

function buildSystemPrompt(context: string, hasFiles: boolean): string {
  const base =
    "You are Herdr, a helpful AI assistant. Answer clearly, accurately, and in the same language the user writes in.";
  if (!hasFiles) return base;
  if (!context.trim()) {
    return (
      base +
      "\n\nThe user has uploaded documents. No relevant excerpt matched this question, so answer from general knowledge and note that the documents don't obviously cover it."
    );
  }
  return (
    base +
    "\n\nThe user uploaded documents. Ground your answer in these excerpts when they're relevant; if the answer isn't in them, say so plainly.\n\n" +
    "Relevant document excerpts:\n\n" +
    context
  );
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;

  let body: { baseUrl?: string; model?: string; content?: string; embedModel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { model, content, embedModel } = body;
  const baseUrl = normalizeBaseUrl(body.baseUrl ?? "");

  if (!model) return NextResponse.json({ error: "No model selected" }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const userText = content.trim();
  await addMessage(id, { role: "user", content: userText });

  const hasFiles = session.files.length > 0;
  const retrieved = hasFiles
    ? await fetchPythonContext(id, userText, baseUrl, embedModel ?? "")
    : [];

  const history: OllamaChatMessage[] = session.messages
    .slice(-MAX_HISTORY)
    .map((m: Message) => ({ role: m.role, content: m.content }));

  const messages: OllamaChatMessage[] = [
    { role: "system", content: buildSystemPrompt(buildContextText(retrieved), hasFiles) },
    ...history,
  ];

  const encoder = new TextEncoder();
  const USAGE_MARKER = "\n\n[usage]";
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let usage: { input: number; output: number } | undefined;
      try {
        for await (const chunk of chatStream(baseUrl, model, messages)) {
          if (chunk.delta) {
            full += chunk.delta;
            controller.enqueue(encoder.encode(chunk.delta));
          }
          if (chunk.usage) usage = chunk.usage;
        }
        if (usage) {
          controller.enqueue(
            encoder.encode(USAGE_MARKER + JSON.stringify(usage) + "[/usage]\n")
          );
        }
        controller.close();
      } catch (err) {
        const message = (err as Error).message || "Stream failed";
        if (full) await addMessage(id, { role: "assistant", content: full });
        controller.enqueue(
          encoder.encode(ERROR_MARKER + " " + message + "[/error]\n")
        );
        controller.close();
        return;
      }
      if (full) await addMessage(id, { role: "assistant", content: full, usage });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
