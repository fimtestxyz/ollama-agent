"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import ChatView from "./ChatView";
import Composer from "./Composer";
import FileChips from "./FileChips";
import ModelPicker from "./ModelPicker";
import SettingsPopover from "./SettingsPopover";
import { IconMenu, IconPencil, IconX } from "./icons";
import { formatTokens } from "./format";
import { DEFAULT_SETTINGS, type Settings, type SessionSummary, type UiMessage, type UiSession } from "./types";

const LS_SETTINGS = "herdr-settings";
const LS_MODEL = "herdr-model";
const LS_SESSION = "herdr-session";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

type ToastState = { msg: string; kind: "info" | "error" } | null;

export default function ChatApp() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<UiSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeIdRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  const settingsRef = useRef(settings);
  const sessionRef = useRef(session);
  const abortRef = useRef<AbortController | null>(null);

  activeIdRef.current = activeId;
  modelRef.current = model;
  settingsRef.current = settings;
  sessionRef.current = session;

  useEffect(() => {
    const apply = (t: Settings["theme"]) =>
      document.documentElement.setAttribute("data-theme", t);
    apply(settings.theme);
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  /* ---------------- loading sessions / models ---------------- */

  const loadSummaries = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSummaries(data.sessions);
        return data.sessions as SessionSummary[];
      }
    } catch {}
    return [] as SessionSummary[];
  }, []);

  const loadModels = useCallback(async () => {
    const baseUrl = settingsRef.current.baseUrl;
    try {
      const res = await fetch(`/api/models?baseUrl=${encodeURIComponent(baseUrl)}`);
      if (res.ok) {
        const data = await res.json();
        const names: string[] = data.models ?? [];
        setModels(names);
        setConnected(true);
        setModel((cur) => {
          if (cur && names.includes(cur)) return cur;
          const saved = localStorage.getItem(LS_MODEL);
          if (saved && names.includes(saved)) return saved;
          if (names.length) return names[0];
          return cur || "";
        });
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const [sessions] = await Promise.all([loadSummaries(), loadModels()]);
    // If the active session was deleted externally, clear it.
    if (activeIdRef.current) {
      const still = sessions.some((s) => s.id === activeIdRef.current);
      if (!still) setActiveId(null);
    }
  }, [loadSummaries, loadModels]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const testConnection = useCallback(async () => {
    setTesting(true);
    const baseUrl = settingsRef.current.baseUrl;
    try {
      const res = await fetch(
        `/api/models?baseUrl=${encodeURIComponent(baseUrl)}`
      );
      setConnected(res.ok);
      if (res.ok) {
        const data = await res.json();
        const names: string[] = data.models ?? [];
        setModels(names);
        setToast({ msg: `Connected — ${names.length} model${names.length === 1 ? "" : "s"} found`, kind: "info" });
      } else {
        setToast({ msg: "Could not reach Ollama", kind: "error" });
      }
    } catch {
      setConnected(false);
      setToast({ msg: "Could not reach Ollama", kind: "error" });
    } finally {
      setTesting(false);
    }
  }, []);

  /* ---------------- session selection ---------------- */

  const openSession = useCallback(async (id: string) => {
    setActiveId(id);
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setSession(data.session as UiSession);
      setEditingName(false);
    } catch {
      setToast({ msg: "Could not load that conversation", kind: "error" });
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const createNew = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActiveId(data.session.id);
      setSession({ ...data.session, messages: [], files: [] } as UiSession);
      setSummaries((prev) => [
        {
          id: data.session.id,
          name: data.session.name,
          updatedAt: data.session.updatedAt,
          messageCount: 0,
          fileCount: 0,
          preview: "",
        },
        ...prev,
      ]);
      try {
        localStorage.setItem(LS_SESSION, data.session.id);
      } catch {}
    } catch {
      setToast({ msg: "Failed to create a conversation", kind: "error" });
    }
  }, []);

  useEffect(() => {
    const initial = async () => {
      await refreshAll();
      const savedId = localStorage.getItem(LS_SESSION);
      const sessions = await loadSummaries();
      if (savedId && sessions.some((s) => s.id === savedId)) {
        openSession(savedId);
      } else if (sessions.length) {
        openSession(sessions[0].id);
      }
    };
    initial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) return;
      if (streaming && abortRef.current) abortRef.current.abort();
      openSession(id);
      try {
        localStorage.setItem(LS_SESSION, id);
      } catch {}
    },
    [streaming, openSession]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const target = id;
      await fetch(`/api/sessions/${target}`, { method: "DELETE" });
      if (target === activeIdRef.current) {
        setActiveId(null);
        setSession(null);
      }
      setSummaries((prev) => prev.filter((s) => s.id !== target));
    },
    []
  );

  /* ---------------- model / settings ---------------- */

  const applySettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        return next;
      });
      if (patch.baseUrl) {
        // Server reachable at a new address → refetch models.
        setTimeout(loadModels, 0);
      }
    },
    [loadModels]
  );

  const handleModel = useCallback((m: string) => {
    setModel(m);
    try {
      localStorage.setItem(LS_MODEL, m);
    } catch {}
  }, []);

  /* ---------------- upload ---------------- */

  const handleUpload = useCallback(
    async (file: File) => {
      const id = activeIdRef.current;
      if (!id) {
        setToast({ msg: "Create a conversation before uploading files", kind: "error" });
        return;
      }
      setUploadingName(file.name);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("baseUrl", settingsRef.current.baseUrl);
        fd.append("embedModel", settingsRef.current.embedModel);
        const res = await fetch(`/api/sessions/${id}/upload`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }
        setSession((prev) =>
          prev ? { ...prev, files: [...prev.files, data.file] } : prev
        );
        setSummaries((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, fileCount: s.fileCount + 1 } : s
          )
        );
        setToast({
          msg:
            data.file.strategy === "embed"
              ? `Indexed ${data.file.name} (${data.chunkCount} chunks)`
              : `Added ${data.file.name} as text context`,
          kind: "info",
        });
      } catch (err) {
        setToast({ msg: (err as Error).message, kind: "error" });
      } finally {
        setUploadingName(null);
      }
    },
    []
  );

  const handleRemoveFile = useCallback(
    async (fileId: string) => {
      const id = activeIdRef.current;
      if (!id) return;
      const res = await fetch(`/api/sessions/${id}/files/${fileId}`, { method: "DELETE" });
      if (res.ok) {
        setSession((prev) =>
          prev ? { ...prev, files: prev.files.filter((f) => f.id !== fileId) } : prev
        );
        setSummaries((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, fileCount: Math.max(0, s.fileCount - 1) } : s
          )
        );
      }
    },
    []
  );

  /* ---------------- chat ---------------- */

  const send = useCallback(async () => {
    const id = activeIdRef.current;
    const text = input.trim();
    const mdl = modelRef.current;
    if (!id || !text || streaming) return;

    const userMsg: UiMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const botId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const botMsg: UiMessage = {
      id: botId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "streaming",
    };

    setInput("");
    setStreaming(true);
    setSession((prev) =>
      prev ? { ...prev, messages: [...prev.messages, userMsg, botMsg] } : prev
    );

    const controller = new AbortController();
    abortRef.current = controller;

    const finalize = (overrides: Partial<UiMessage>) => {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === botId ? { ...m, ...overrides } : m
              ),
            }
          : prev
      );
    };

    try {
      const res = await fetch(`/api/sessions/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: settingsRef.current.baseUrl,
          model: mdl,
          embedModel: settingsRef.current.embedModel,
          content: text,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let detail = "Ollama request failed";
        try {
          const data = await res.json();
          detail = data.error || detail;
        } catch {}
        setSession((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === botId
                    ? {
                        ...m,
                        status: "error",
                        error: detail,
                        createdAt: new Date().toISOString(),
                      }
                    : m
                ),
              }
            : prev
        );
        setStreaming(false);
        return;
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let errored = false;
      let usage: { input: number; output: number } | undefined;
      let buf = "";

      const updateContent = () => {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === botId ? { ...m, content: acc } : m
                ),
              }
            : prev
        );
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const errIdx = buf.indexOf("\n\n[error]");
          if (errIdx !== -1) {
            acc += buf.slice(0, errIdx);
            errored = true;
            break;
          }
          const useIdx = buf.indexOf("\n\n[usage]");
          if (useIdx !== -1) {
            acc += buf.slice(0, useIdx);
            const m = buf.slice(useIdx).match(/\[usage\](.*?)\[\/usage\]/);
            if (m) {
              try {
                usage = JSON.parse(m[1]);
              } catch {}
            }
            break;
          }
          // Flush content, keeping a small tail so a split marker still matches.
          const safe = Math.max(0, buf.length - 200);
          acc += buf.slice(0, safe);
          buf = buf.slice(safe);
          updateContent();
        }
      } finally {
        reader.releaseLock();
      }

      if (errored) {
        finalize({
          content: acc,
          status: acc ? undefined : "error",
          error: acc ? undefined : "The model stopped unexpectedly.",
        });
      } else {
        finalize({ status: undefined, ...(usage ? { usage } : {}) });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User pressed stop — keep whatever streamed, clear the caret.
        finalize({ status: undefined });
      } else {
        finalize({
          status: "error",
          error: (err as Error).message,
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming]);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
    // The current assistant bubble (empty or partial) stays as-is.
  }, []);

  /* ---------------- misc ---------------- */

  const handleRename = useCallback(async () => {
    const id = activeIdRef.current;
    const name = nameDraft.trim();
    if (id && name) {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setSession((prev) => (prev ? { ...prev, name } : prev));
      setSummaries((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    }
    setEditingName(false);
  }, [nameDraft]);

  const busy = streaming || uploadingName !== null;

  const totals = (session?.messages ?? []).reduce(
    (t, m) => {
      if (m.usage) {
        t.input += m.usage.input;
        t.output += m.usage.output;
      }
      return t;
    },
    { input: 0, output: 0 }
  );

  const collapseOnChatClick = useCallback(() => {
    setSidebarOpen((o) => (o ? false : o));
  }, []);

  return (
    <div className="app">
      <Sidebar
        summaries={summaries}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={createNew}
        onDelete={handleDelete}
        connected={connected}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
      />

      <main className="main">
        <div className="topbar">
          <button
            className="icon-btn"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <IconMenu size={18} />
          </button>
          {editingName ? (
            <input
              className="session-title"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <button
              className="session-title"
              title="Rename conversation"
              onClick={() => {
                setNameDraft(session?.name ?? "");
                setEditingName(true);
              }}
            >
              {session?.name ?? "Herdr"}
              <IconPencil size={12} style={{ marginLeft: 6, color: "var(--text-3)" }} />
            </button>
          )}

          <div className="topbar-spacer" />

          {session && (totals.input || totals.output) && (
            <span className="tokens-stat" title="Tokens used in this conversation">
              <span className="t-in">{formatTokens(totals.input)} in</span>
              <span className="t-dot">·</span>
              <span className="t-out">{formatTokens(totals.output)} out</span>
            </span>
          )}

          <ModelPicker
            models={models}
            value={model}
            onChange={handleModel}
            disabled={streaming}
          />
          <SettingsPopover
            settings={settings}
            onApply={applySettings}
            connected={connected}
            testing={testing}
            onTest={testConnection}
            onRefreshModels={loadModels}
          />
        </div>

        <div className="chat-region" onClick={collapseOnChatClick}>
          <div style={{ padding: "10px 20px 0" }}>
            <div style={{ maxWidth: 780, margin: "0 auto" }}>
              {session && session.files.length > 0 && (
                <FileChips
                  files={session.files}
                  uploadingName={uploadingName}
                  onRemove={handleRemoveFile}
                />
              )}
            </div>
          </div>

          {loadingSession ? (
            <div className="empty">
              <span className="msg-thinking">
                Loading
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            </div>
          ) : (
            <ChatView messages={session?.messages ?? []} currentModel={model} />
          )}
        </div>

        <div className="composer-wrap">
          <Composer
            value={input}
            onChange={setInput}
            onSend={send}
            onUpload={handleUpload}
            onStop={handleStop}
            streaming={streaming}
            uploading={uploadingName !== null}
            disabled={!model}
          />
        </div>
      </main>

      {toast && (
        <div className={`toast${toast.kind === "error" ? " err" : ""}`}>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button className="t-x" onClick={() => setToast(null)}>
            <IconX size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
