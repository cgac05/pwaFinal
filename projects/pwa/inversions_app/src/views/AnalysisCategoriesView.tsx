// FIC: AnalysisCategoriesView — chip selector for analysis categories, filters main dashboard sections.
// FIC: AnalysisCategoriesView — selector de chips de categoría de análisis, filtra secciones del dashboard principal.

import React from "react";
import { useAppShellStore, type AnalysisCategory } from "../store/appShell";

interface ChipConfig {
  id: AnalysisCategory;
  label: string;
}

const CHIPS: ChipConfig[] = [
  { id: "technical", label: "Técnico" },
  { id: "institutional", label: "Institucional" },
  { id: "fundamental", label: "Fundamental" },
  { id: "news", label: "Noticias" },
  { id: "ai", label: "IA" },
];

export function AnalysisCategoriesView() {
  const { analysisCategory, setAnalysisCategory } = useAppShellStore();

  return (
    <div style={{ padding: "var(--space-sm)", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      {CHIPS.map(({ id, label }) => {
        const isActive = analysisCategory === id;
        return (
          <button
            key={id}
            onClick={() => setAnalysisCategory(id)}
            aria-pressed={isActive}
            style={{
              background: isActive ? "var(--color-accent-subtle)" : "var(--color-surface-raised)",
              border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-sm)",
              color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
              cursor: "pointer",
              fontWeight: isActive ? "var(--font-weight-emphasis)" : "var(--font-weight-body)",
              fontSize: "var(--font-size-sm)",
              padding: "var(--space-xs) var(--space-sm)",
              textAlign: "left",
              transition: "background var(--duration-fast) var(--easing-standard), color var(--duration-fast) var(--easing-standard)",
              width: "100%",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
