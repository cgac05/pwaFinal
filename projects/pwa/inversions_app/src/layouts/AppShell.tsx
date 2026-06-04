// FIC: AppShell layout — VS Code-style 3-zone grid: activity bar, left panel, main content.
// FIC: Layout AppShell — cuadrícula de 3 zonas estilo VS Code: barra de actividad, panel izquierdo, contenido principal.

import React, { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer } from "../components/ui/Drawer";
import { useAppShellStore } from "../store/appShell";

interface AppShellProps {
  activityBar: React.ReactNode;
  leftPanel: React.ReactNode;
  main: React.ReactNode;
}

const TABLET_BREAKPOINT = 1023;

export function AppShell({ activityBar, leftPanel, main }: AppShellProps) {
  const { leftPanelCollapsed } = useAppShellStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const leftWidth = leftPanelCollapsed ? "0px" : "var(--left-panel-width)";

  return (
    <div
      data-testid="app-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--color-bg)",
        overflow: "hidden",
      }}
    >
      {/* ── 4-zone body ── */}
      <div
        data-testid="app-shell-body"
        style={{ display: "flex", flex: 1, overflow: "hidden" }}
      >
        {/* Zone 1: Activity Bar — always visible */}
        <div
          data-testid="app-shell-activity-bar"
          style={{
            width: "var(--activity-bar-width)",
            flexShrink: 0,
            background: "var(--color-surface)",
            borderRight: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {activityBar}
        </div>

        {/* Zone 2: Left panel — collapses via width transition, resizes main content */}
        <div
          data-testid="app-shell-left-panel"
          style={{
            width: leftWidth,
            flexShrink: 0,
            overflow: "hidden",
            transition: "width 0.25s ease",
            background: "var(--color-surface)",
            borderRight: "1px solid var(--color-border)",
          }}
          className="app-shell-left-panel"
        >
          {leftPanel}
        </div>

        {/* Zone 3: Main content — flex:1, resizes when left panel opens/closes */}
        <main
          data-testid="app-shell-main"
          style={{ flex: 1, overflow: "auto", minWidth: 0 }}
        >
          {main}
        </main>
      </div>

      {/* ── Tablet: left panel as Drawer (overlay, no grid reduction) ── */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="left"
        width="var(--left-panel-width)"
        title="Panel"
      >
        {leftPanel}
      </Drawer>

      {/* ── Responsive: hide left panel on tablet, show activity bar only ── */}
      <style>{`
        @media (max-width: ${TABLET_BREAKPOINT}px) {
          .app-shell-left-panel {
            display: none !important;
          }
          .app-shell-menu-btn {
            display: flex !important;
          }
        }
      `}</style>

      {/* ── Tablet menu button — opens Drawer, hidden on desktop ── */}
      <button
        className="app-shell-menu-btn btn-ghost"
        onClick={() => setDrawerOpen(true)}
        aria-label="Abrir panel"
        style={{
          position: "fixed",
          top: "var(--space-sm, 0.5rem)",
          left: "calc(var(--activity-bar-width) + var(--space-sm, 0.5rem))",
          zIndex: 800,
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          width: "2rem",
          height: "2rem",
          padding: 0,
        }}
      >
        <Menu size={18} />
      </button>
    </div>
  );
}
