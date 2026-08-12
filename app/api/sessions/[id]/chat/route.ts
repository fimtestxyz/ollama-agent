import { NextResponse } from "next/server";
import {
  addMessage,
  buildContextText,
  getSession,
  retrieveContext,
  type Message,
} from "@/lib/store";
import {
  chatStream,
  normalizeBaseUrl,
  type OllamaChatMessage,
} from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MAX_HISTORY = 12;
const ERROR_MARKER = "\n\n[error]";

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
    ? await retrieveContext(id, userText, baseUrl, embedModel ?? "")
    : [];

  const history: OllamaChatMessage[] = session.messages
    .slice(-MAX_HISTORY)
    .map((m: Message) => ({ role: m.role, content: m.content }));

  const messages: OllamaChatMessage[] = [
    { role: "system", content: buildSystemPrompt(buildContextText(retrieved), hasFiles) },
    ...history,
  ];

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const delta of chatStream(baseUrl, model, messages)) {
          full += delta;
          controller.enqueue(encoder.encode(delta));
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
      if (full) await addMessage(id, { role: "assistant", content: full });
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
