// FIC: LeftPanel — collapsible sidebar container routing content by active AppShell section.
// FIC: LeftPanel — contenedor colapsable del sidebar que enruta el contenido según la sección activa del AppShell.

import React from "react";
import { useAppShellStore } from "../../store/appShell";
import { WatchlistView } from "./views/WatchlistView";
import { AnalysisCategoriesView } from "./views/AnalysisCategoriesView";
import { StrategiesView } from "./views/StrategiesView";

const SECTION_TITLES: Record<string, string> = {
  watchlist: "Watchlist",
  analysis: "Análisis",
  strategies: "Estrategias",
};

export function LeftPanel() {
  const { activeSection } = useAppShellStore();

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
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {SECTION_TITLES[activeSection] ?? activeSection}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeSection === "watchlist" && <WatchlistView />}
        {activeSection === "analysis" && <AnalysisCategoriesView />}
        {activeSection === "strategies" && <StrategiesView />}
      </div>
    </div>
  );
}
