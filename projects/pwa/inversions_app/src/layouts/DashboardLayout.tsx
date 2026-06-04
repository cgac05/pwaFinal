// FIC: Responsive dashboard layout — 2-column grid on desktop ≥1024px, single column on tablet with drawer.
// FIC: Layout responsivo del dashboard — grid 2 columnas en desktop ≥1024px, columna única en tablet con drawer.

import React from "react";
import { Drawer } from "../components/ui/Drawer";

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  nav: React.ReactNode;
  main: React.ReactNode;
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
}

export function DashboardLayout({
  sidebar,
  nav,
  main,
  drawerOpen = false,
  onDrawerClose
}: DashboardLayoutProps) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <header style={{
        height: "var(--nav-height)",
        flexShrink: 0,
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 var(--space-lg)"
      }}>
        {nav}
      </header>

      {/* Body: sidebar + main on desktop, main only on tablet */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "var(--sidebar-width) 1fr",
          minHeight: 0
        }}
        className="dashboard-layout-body"
      >
        {/* Sidebar — hidden on tablet via CSS */}
        <aside
          className="dashboard-sidebar"
          style={{
            background: "var(--color-surface)",
            borderRight: "1px solid var(--color-border)",
            overflowY: "auto",
            height: "100%"
          }}
        >
          {sidebar}
        </aside>

        {/* Main content */}
        <main style={{ overflow: "auto", padding: "var(--space-lg)" }}>
          {main}
        </main>
      </div>

      {/* Tablet drawer for sidebar */}
      <Drawer
        isOpen={drawerOpen}
        onClose={onDrawerClose ?? (() => {})}
        position="left"
        width="var(--sidebar-width)"
        title="Watchlist"
      >
        {sidebar}
      </Drawer>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 1023px) {
          .dashboard-layout-body {
            grid-template-columns: 1fr !important;
          }
          .dashboard-sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
