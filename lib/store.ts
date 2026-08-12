import { promises as fs } from "fs";
import path from "path";
import { embed } from "./ollama";

const DATA_FILE = path.join(process.cwd(), "data", "store.json");

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type Chunk = {
  text: string;
  embedding?: number[];
};

export type FileDoc = {
  id: string;
  name: string;
  size: number;
  mime: string;
  strategy: "embed" | "fulltext";
  chunks: Chunk[];
  preview: string;
};

export type Session = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  files: FileDoc[];
};

type StoreShape = {
  sessions: Session[];
};

export const CONTEXT_BUDGET = 8000;

/* ------------------------------------------------------------------ */
/*  Singleton + persistence                                            */
/* ------------------------------------------------------------------ */

const GLOBAL_KEY = "__herdr_store__";
type Global = typeof globalThis & { [GLOBAL_KEY]?: StoreShape };

function rawStore(): StoreShape {
  return (globalThis as Global)[GLOBAL_KEY] ?? { sessions: [] };
}

let loadPromise: Promise<void> | null = null;

function load(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // If this process already has the store in memory (e.g. after a dev
    // hot-reload), never clobber it with older file contents.
    if ((globalThis as Global)[GLOBAL_KEY]) return;
    try {
      const text = await fs.readFile(DATA_FILE, "utf-8");
      const parsed = JSON.parse(text) as StoreShape;
      if (Array.isArray(parsed.sessions)) {
        (globalThis as Global)[GLOBAL_KEY] = {
          sessions: parsed.sessions.map((s) => ({
            ...s,
            messages: s.messages ?? [],
            files: s.files ?? [],
          })),
        };
      }
    } catch {
      // First run or corrupted file — start fresh.
    }
  })();
  return loadPromise;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
      .then(() =>
        fs.writeFile(DATA_FILE, JSON.stringify(rawStore(), null, 2), "utf-8")
      )
      .catch(() => {});
  }, 400);
}

/* ------------------------------------------------------------------ */
/*  Session API                                                        */
/* ------------------------------------------------------------------ */

export function uid(): string {
  return crypto.randomUUID();
}

function sortNewestFirst(store: StoreShape) {
  store.sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function listSessions() {
  await load();
  return rawStore().sessions;
}

export async function createSession(name?: string): Promise<Session> {
  await load();
  const now = new Date().toISOString();
  const session: Session = {
    id: uid(),
    name: name?.trim() || "New Chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
    files: [],
  };
  rawStore().sessions.push(session);
  scheduleSave();
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  await load();
  return rawStore().sessions.find((s) => s.id === id) ?? null;
}

export async function deleteSession(id: string): Promise<boolean> {
  await load();
  const store = rawStore();
  const i = store.sessions.findIndex((s) => s.id === id);
  if (i === -1) return false;
  store.sessions.splice(i, 1);
  scheduleSave();
  return true;
}

export async function renameSession(id: string, name: string): Promise<void> {
  const session = await getSession(id);
  if (!session) return;
  session.name = name.trim() || "New Chat";
  touch(session);
}

function touch(session: Session) {
  session.updatedAt = new Date().toISOString();
  sortNewestFirst(rawStore());
  scheduleSave();
}

export async function addMessage(
  sessionId: string,
  message: Omit<Message, "id" | "createdAt">
): Promise<Message> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  const full: Message = {
    ...message,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  session.messages.push(full);
  if (session.name === "New Chat" && message.role === "user") {
    session.name =
      message.content.slice(0, 40).replace(/\s+/g, " ").trim() || "New Chat";
  }
  touch(session);
  return full;
}

/* ------------------------------------------------------------------ */
/*  Files                                                              */
/* ------------------------------------------------------------------ */

function chunkText(text: string, size = 1500, overlap = 150): string[] {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return [];
  if (normalized.length <= size) return [normalized];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= size) {
      current += (current ? "\n\n" : "") + para;
    } else {
      if (current) chunks.push(current);
      if (para.length > size) {
        let i = 0;
        while (i < para.length) {
          chunks.push(para.slice(i, i + size));
          i += size - overlap;
        }
        current = "";
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function addFile(
  sessionId: string,
  meta: { name: string; size: number; mime: string },
  text: string,
  baseUrl: string,
  embedModel: string
): Promise<FileDoc> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");

  const chunks = chunkText(text);
  let strategy: FileDoc["strategy"] = "fulltext";
  const indexed: Chunk[] = [];

  if (chunks.length && embedModel) {
    try {
      const embeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += 16) {
        const batch = chunks.slice(i, i + 16);
        const result = await embed(baseUrl, embedModel, batch);
        embeddings.push(...result);
        if (result.length !== batch.length) throw new Error("embed count mismatch");
      }
      if (embeddings.length === chunks.length) {
        indexed.push(...chunks.map((text, i) => ({ text, embedding: embeddings[i] })));
        strategy = "embed";
      }
    } catch {
      // Embedding unavailable (model missing / not pulled) → fulltext fallback.
    }
  }

  if (indexed.length === 0) {
    indexed.push(...chunks.map((text) => ({ text })));
  }

  const file: FileDoc = {
    id: uid(),
    ...meta,
    strategy,
    chunks: indexed,
    preview: text.slice(0, 200),
  };
  session.files.push(file);
  touch(session);
  return file;
}

export async function removeFile(
  sessionId: string,
  fileId: string
): Promise<boolean> {
  const session = await getSession(sessionId);
  if (!session) return false;
  const i = session.files.findIndex((f) => f.id === fileId);
  if (i === -1) return false;
  session.files.splice(i, 1);
  touch(session);
  return true;
}

/* ------------------------------------------------------------------ */
/*  Retrieval                                                          */
/* ------------------------------------------------------------------ */

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function keywordScore(text: string, query: string): number {
  const q = tokenize(query);
  if (!q.length) return 0;
  const terms = new Set(tokenize(text));
  let hits = 0;
  for (const w of q) if (terms.has(w)) hits++;
  return hits / q.length;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export type RetrievedChunk = {
  text: string;
  file: string;
  score: number;
  strategy: "embed" | "fulltext";
};

export async function retrieveContext(
  sessionId: string,
  query: string,
  baseUrl: string,
  embedModel: string,
  topK = 6
): Promise<RetrievedChunk[]> {
  const session = await getSession(sessionId);
  if (!session || !session.files.length) return [];

  const allChunks = session.files.flatMap((f) =>
    f.chunks.map((c) => ({
      text: c.text,
      file: f.name,
      strategy: f.strategy,
      embedding: c.embedding,
    }))
  );
  if (!allChunks.length) return [];

  const embedChunks = allChunks.filter((c) => c.embedding);
  const textChunks = allChunks.filter((c) => !c.embedding);

  if (embedChunks.length && embedModel) {
    try {
      const [q] = await embed(baseUrl, embedModel, [query]);
      if (q) {
        const scored = embedChunks.map((c) => ({
          ...c,
          score: cosine(q, c.embedding!),
        }));
        scored.push(...textChunks.map((c) => ({ ...c, score: keywordScore(c.text, query) })));
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
      }
    } catch {
      // Fall through to keyword-only retrieval.
    }
  }

  const scored = allChunks.map((c) => ({ ...c, score: keywordScore(c.text, query) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((c) => c.score > 0);
}

export type PublicFile = {
  id: string;
  name: string;
  size: number;
  strategy: FileDoc["strategy"];
  preview: string;
};

export type PublicSession = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  files: PublicFile[];
};

export function publicSession(session: Session): PublicSession {
  return {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages,
    files: session.files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      strategy: f.strategy,
      preview: f.preview,
    })),
  };
}

export function buildContextText(chunks: RetrievedChunk[]): string {
  let budget = CONTEXT_BUDGET;
  const parts: string[] = [];
  for (const c of chunks) {
    const block = `[${c.file}]\n${c.text}`;
    if (budget <= 0) break;
    parts.push(block.slice(0, budget));
    budget -= block.length;
  }
  return parts.join("\n\n---\n\n");
}
