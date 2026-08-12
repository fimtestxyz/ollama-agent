"use client";

import { useEffect, useRef, useState } from "react";
import { IconBolt, IconCheck, IconChevron } from "./icons";

export default function ModelPicker({
  models,
  value,
  onChange,
  disabled,
}: {
  models: string[];
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = models.filter((m) => m.toLowerCase().includes(q));
  const exact = models.includes(value);

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className="model-trigger"
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        disabled={disabled}
      >
        <IconBolt size={14} />
        <span className="mt-label">{value || "Select model"}</span>
        <IconChevron size={14} className={open ? "chev-up" : ""} />
      </button>

      {open && (
        <div className="popover left">
          <input
            className="model-search"
            autoFocus
            placeholder="Search or type a model…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="pop-label">Models</div>
          <div className="pop-scroll">
            {filtered.map((m) => (
              <button
                key={m}
                className={`pop-item${m === value ? " selected" : ""}`}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
              >
                <span className="pi-name">{m}</span>
                {m === value && <IconCheck size={16} />}
              </button>
            ))}
            {!filtered.length && !q && (
              <div className="pop-empty">
                No models found. Run{" "}
                <code>ollama pull llama3.2</code> in a terminal, then refresh.
              </div>
            )}
          </div>
          {q && !filtered.includes(q) && (
            <>
              <div className="pop-divider" />
              <button
                className="pop-item"
                onClick={() => {
                  onChange(q);
                  setOpen(false);
                }}
              >
                Use “{q}”
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
