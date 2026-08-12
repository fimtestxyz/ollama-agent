"use client";

import { IconPlus, IconSparkles, IconTrash } from "./icons";
import { formatTime } from "./format";
import type { SessionSummary } from "./types";

export default function Sidebar({
  summaries,
  activeId,
  onSelect,
  onNew,
  onDelete,
  connected,
}: {
  summaries: SessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  connected: boolean | null;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <span className="brand-mark">
            <IconSparkles size={15} />
          </span>
          Herdr
        </div>
        <button className="btn-new" onClick={onNew}>
          <IconPlus size={16} />
          New chat
        </button>
      </div>

      <div className="session-list">
        {summaries.map((s) => (
          <div
            key={s.id}
            className={`session-item${s.id === activeId ? " active" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="session-meta">
              <div className="session-name">{s.name}</div>
              <div className="session-preview">
                {s.preview ||
                  (s.fileCount
                    ? `${s.fileCount} file${s.fileCount > 1 ? "s" : ""}`
                    : "No messages yet")}
              </div>
            </div>
            <span className="session-time">{formatTime(s.updatedAt)}</span>
            <button
              className="session-delete"
              title="Delete conversation"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
            >
              <IconTrash size={15} />
            </button>
          </div>
        ))}
        {!summaries.length && (
          <div className="session-empty">
            <p>No conversations yet.</p>
            <p className="sub">Start one with “New chat”.</p>
          </div>
        )}
      </div>

      <div className="sidebar-foot">
        <div className="conn">
          <span
            className={`conn-dot ${connected === true ? "on" : connected === false ? "off" : ""}`}
          />
          <span className="conn-text">
            {connected === null
              ? "Checking connection…"
              : connected
                ? "Ollama connected"
                : "Ollama offline"}
          </span>
        </div>
      </div>
    </aside>
  );
}
