"use client";

import React from "react";

export interface NextNavProps {
  /** When true, renders in a light/themed variant; false renders the default dark nav. */
  theme?: boolean;
}

/**
 * Top navigation bar for Herdr.
 * Accepts a `theme` prop to toggle between dark and light variants.
 */
export default function NextNav({ theme = false }: NextNavProps) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.5rem",
        background: theme
          ? "rgba(255,255,255,0.08)"
          : "rgba(0,0,0,0.35)",
        backdropFilter: "blur(12px)",
        borderBottom: theme
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: "0.5rem",
        marginBottom: "0.5rem",
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: "1.1rem",
          letterSpacing: "0.04em",
          color: theme ? "var(--fg, #e8e8ed)" : "var(--fg, #e8e8ed)",
        }}
      >
        herdr
      </span>
    </nav>
  );
}
