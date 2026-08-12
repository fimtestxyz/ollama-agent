"use client";

import { useEffect, useRef } from "react";
import { IconSend, IconStop, IconUpload } from "./icons";

export default function Composer({
  value,
  onChange,
  onSend,
  onUpload,
  onStop,
  streaming,
  uploading,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onUpload: (file: File) => void;
  onStop: () => void;
  streaming: boolean;
  uploading: boolean;
  disabled: boolean;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="composer">
      <div className="composer-box">
        <textarea
          ref={ta}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message Herdr…"
        />
        <button
          className="icon-btn"
          title="Upload a document (PDF, DOCX, TXT, MD)"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <IconUpload size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.mdx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        {streaming ? (
          <button className="btn-send stop" title="Stop generating" onClick={onStop}>
            <IconStop size={16} />
          </button>
        ) : (
          <button
            className="btn-send"
            title="Send"
            onClick={onSend}
            disabled={disabled || !value.trim()}
          >
            <IconSend size={17} />
          </button>
        )}
      </div>
      <div className="composer-hint">
        Enter to send · Shift+Enter for a new line · Ollama runs locally
      </div>
    </div>
  );
}
