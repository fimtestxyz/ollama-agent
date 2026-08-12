"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconGear, IconMoon, IconRefresh, IconSun } from "./icons";
import type { Settings } from "./types";

export default function SettingsPopover({
  settings,
  onApply,
  connected,
  testing,
  onTest,
  onRefreshModels,
}: {
  settings: Settings;
  onApply: (patch: Partial<Settings>) => void;
  connected: boolean | null;
  testing: boolean;
  onTest: () => void;
  onRefreshModels: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [embedModel, setEmbedModel] = useState(settings.embedModel);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setBaseUrl(settings.baseUrl);
      setEmbedModel(settings.embedModel);
    }
  }, [open, settings.baseUrl, settings.embedModel]);

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

  const save = () => {
    onApply({
      baseUrl: baseUrl.trim() || "http://localhost:11434",
      embedModel: embedModel.trim() || "nomic-embed-text",
    });
    setOpen(false);
  };

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        className="icon-btn"
        title="Settings"
        onClick={() => setOpen((o) => !o)}
      >
        <IconGear size={18} />
      </button>
      {open && (
        <div className="popover settings">
          <div className="pop-label">Ollama</div>
          <div className="field">
            <label>Server URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label>Embedding model</label>
            <input
              value={embedModel}
              onChange={(e) => setEmbedModel(e.target.value)}
              placeholder="nomic-embed-text"
              spellCheck={false}
            />
            <span className="hint">
              Used to index uploaded documents. Run{" "}
              <code>ollama pull nomic-embed-text</code> if missing — uploads
              fall back to keyword matching until it's available.
            </span>
          </div>
          <div className="setting-row">
            <div>
              <div className="lbl">Connection</div>
              <div className="sub">
                {connected === null
                  ? "Not checked yet"
                  : connected
                    ? "Ollama is reachable"
                    : "Ollama not reachable"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="icon-btn"
                title="Test connection"
                onClick={onTest}
                disabled={testing}
              >
                {testing ? (
                  <IconRefresh size={16} className="spin" />
                ) : (
                  <IconCheck size={16} />
                )}
              </button>
              <button
                className="icon-btn"
                title="Refresh models"
                onClick={onRefreshModels}
              >
                <IconRefresh size={16} />
              </button>
            </div>
          </div>
          <div className="pop-divider" />
          <div className="setting-row">
            <div>
              <div className="lbl">Appearance</div>
              <div className="sub">Theme</div>
            </div>
            <div className="theme-toggle">
              <button
                className={settings.theme === "light" ? "on" : ""}
                title="Light"
                onClick={() => onApply({ theme: "light" })}
              >
                <IconSun size={15} />
              </button>
              <button
                className={settings.theme === "dark" ? "on" : ""}
                title="Dark"
                onClick={() => onApply({ theme: "dark" })}
              >
                <IconMoon size={15} />
              </button>
            </div>
          </div>
          <div style={{ padding: "8px 6px 4px" }}>
            <button className="btn-ghost" style={{ width: "100%" }} onClick={save}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
