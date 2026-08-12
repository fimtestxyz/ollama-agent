import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "store.json");

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  usage?: { input: number; output: number };
};

export type FileDoc = {
  id: string;
  name: string;
  size: number;
  mime: string;
  strategy: "embed" | "fulltext";
  charCount: number;
  chunkCount: number;
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
    const data = JSON.stringify(rawStore(), null, 2);
    const tmpPath = DATA_FILE + ".tmp";
    fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
      .then(() => fs.writeFile(tmpPath, data, "utf-8"))
      .then(() => fs.rename(tmpPath, DATA_FILE))
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

export type AddFileParams = {
  name: string;
  size: number;
  mime: string;
  strategy: FileDoc["strategy"];
  charCount: number;
  chunkCount: number;
  preview: string;
};

export async function addFileRecord(
  sessionId: string,
  params: AddFileParams
): Promise<FileDoc> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  const file: FileDoc = { id: uid(), ...params };
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
/*  Public views                                                       */
/* ------------------------------------------------------------------ */

export type RetrievedChunk = {
  text: string;
  file: string;
  score: number;
  strategy: "embed" | "fulltext";
};

export type PublicFile = {
  id: string;
  name: string;
  size: number;
  strategy: FileDoc["strategy"];
  charCount: number;
  chunkCount: number;
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
      charCount: f.charCount,
      chunkCount: f.chunkCount,
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
