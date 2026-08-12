"use client";

import { IconDoc, IconX } from "./icons";
import { formatBytes } from "./format";
import type { UiFile } from "./types";

export default function FileChips({
  files,
  uploadingName,
  onRemove,
}: {
  files: UiFile[];
  uploadingName?: string | null;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="files-row">
      {files.map((f) => (
        <div key={f.id} className="file-chip" title={f.preview}>
          <IconDoc size={15} />
          <span className="fc-name">{f.name}</span>
          <span className="fc-strategy">
            {formatBytes(f.size)}
            {f.strategy === "embed" ? " · indexed" : " · text"}
          </span>
          <button className="fc-x" title="Remove from context" onClick={() => onRemove(f.id)}>
            <IconX size={13} />
          </button>
        </div>
      ))}
      {uploadingName && (
        <div className="file-chip">
          <IconDoc size={15} />
          <span className="fc-name">{uploadingName}</span>
          <span className="fc-strategy">indexing…</span>
        </div>
      )}
    </div>
  );
}
