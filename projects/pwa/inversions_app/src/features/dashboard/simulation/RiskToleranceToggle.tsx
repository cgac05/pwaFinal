// FIC: Phase 5 T099 — toggle BAJO/MEDIO/ALTO de tolerancia de riesgo (PDF v1).

import React from "react";

interface Props {
  value: "BAJO" | "MEDIO" | "ALTO";
  onChange: (v: "BAJO" | "MEDIO" | "ALTO") => void;
}

const OPTIONS: Array<"BAJO" | "MEDIO" | "ALTO"> = ["BAJO", "MEDIO", "ALTO"];

export function RiskToleranceToggle({ value, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Tolerancia Riesgo</span>
      <div role="radiogroup" aria-label="Tolerancia de riesgo" style={{ display: "flex", gap: "0.25rem" }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={value === opt}
            onClick={() => onChange(opt)}
            style={{
              flex: 1,
              padding: "0.35rem 0.5rem",
              border: "1px solid var(--color-border)",
              background: value === opt ? "var(--color-accent, #ffd43b)" : "transparent",
              color: value === opt ? "#000" : "var(--color-text)",
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: "var(--radius-sm, 4px)"
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default RiskToleranceToggle;
