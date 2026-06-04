// FIC: LeftPanel — dedicated watchlist panel; other sidebar views moved to dashboard sections. (EN)
// FIC: LeftPanel — panel exclusivo del watchlist; otras vistas del sidebar se mueven a secciones del dashboard. (ES)

import React from "react";
import { useAppShellStore } from "../../store/appShell";
import { WatchlistView } from "./views/WatchlistView";

export function LeftPanel() {
  const { toggleLeftPanel } = useAppShellStore();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "0 var(--space-sm)",
          height: "var(--nav-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span
          style={{
            fontWeight: "var(--font-weight-emphasis)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Watchlist
        </span>
        <button
          onClick={toggleLeftPanel}
          aria-label="Colapsar panel"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontSize: "var(--font-size-sm)",
            padding: "2px 4px",
            lineHeight: 1,
          }}
        >
          ‹
        </button>
      </div>

      {/* Watchlist always visible */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <WatchlistView />
      </div>
    </div>
  );
}
