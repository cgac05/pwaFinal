// FIC: ActivityBar — VS Code-style vertical navigation bar with keyboard support and section toggle.
// FIC: ActivityBar — barra de navegación vertical estilo VS Code con soporte de teclado y toggle de sección.

import React from "react";
import { List } from "lucide-react";
import { useAppShellStore } from "../store/appShell";

const iconButtonStyle = (isActive: boolean): React.CSSProperties => ({
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
  cursor: "pointer",
  transition: "color var(--duration-fast) var(--easing-standard)",
  outline: "none",
  flexShrink: 0,
});

export function ActivityBar() {
  const { leftPanelCollapsed, toggleLeftPanel } = useAppShellStore();

  const isWatchlistActive = !leftPanelCollapsed;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        height: "100%",
        paddingTop: "var(--space-sm)",
        paddingBottom: "var(--space-sm)",
      }}
    >
      {/* Watchlist toggle — only navigation icon */}
      <nav aria-label="Navegación principal" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <button
          onClick={toggleLeftPanel}
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Watchlist"
          aria-pressed={isWatchlistActive}
          title="Watchlist"
          tabIndex={0}
          style={iconButtonStyle(isWatchlistActive)}
        >
          <List size={20} />
        </button>
      </nav>
    </div>
  );
}
