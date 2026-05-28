// FIC: AppShell layout — VS Code-style 4-zone grid: activity bar, left panel, main content, chat panel.
// FIC: Layout AppShell — cuadrícula de 4 zonas estilo VS Code: barra de actividad, panel izquierdo, contenido principal, panel de chat.

import React from "react";
import { Drawer } from "../components/ui/Drawer";
import { useAppShellStore } from "../store/appShell";

interface AppShellProps {
  activityBar: React.ReactNode;
  leftPanel: React.ReactNode;
  main: React.ReactNode;
  chatPanel: React.ReactNode;
}

const TABLET_BREAKPOINT = 1023;

export function AppShell({ activityBar, leftPanel, main, chatPanel }: AppShellProps) {
  const { leftPanelCollapsed, chatPanelCollapsed } = useAppShellStore();

  const leftWidth = leftPanelCollapsed ? "0px" : "var(--left-panel-width)";
  const chatWidth = chatPanelCollapsed ? "0px" : "min(var(--chat-panel-width), calc(100vw - var(--activity-bar-width) - var(--space-md)))";

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
        style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}
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

        {/* Zone 3: Main content — flex:1, resizes when either panel opens/closes */}
        <main
          data-testid="app-shell-main"
          style={{ flex: 1, overflow: "auto", minWidth: 0, width: 0 }}
        >
          {main}
        </main>

        {/* Zone 4: Chat panel — collapses via width transition, resizes main content */}
        <div
          data-testid="app-shell-chat-panel"
          style={{
            width: chatWidth,
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
            transform: chatPanelCollapsed ? "translateX(100%)" : "translateX(0)",
            transition: "width 0.25s ease, transform 0.25s ease",
            background: "var(--color-surface)",
            borderLeft: "1px solid var(--color-border)",
            boxShadow: chatPanelCollapsed ? "none" : "-16px 0 40px rgba(0, 0, 0, 0.32)",
            pointerEvents: chatPanelCollapsed ? "none" : "auto",
            zIndex: 30,
          }}
          className="app-shell-chat-panel"
        >
          {chatPanel}
        </div>
      </div>

      {/* ── Tablet: left panel as Drawer (overlay, no grid reduction) ── */}
      <Drawer
        isOpen={false}
        onClose={() => {}}
        position="left"
        width="var(--left-panel-width)"
        title="Panel"
      >
        {leftPanel}
      </Drawer>

      {/* ── Responsive: hide zone 2 & 4 from grid on tablet, show activity bar only ── */}
      <style>{`
        @media (max-width: ${TABLET_BREAKPOINT}px) {
          .app-shell-left-panel,
          .app-shell-chat-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
