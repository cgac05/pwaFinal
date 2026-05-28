// FIC: Phase 5 T099 — selector de estrategia canonica del PDF v1.

import React from "react";
import { CANONICAL_ESTRATEGIAS } from "../../../services/signals/confluenceTableApi";

interface Props {
  value: string;
  onChange: (estrategia: string) => void;
}

export function StrategySelector({ value, onChange }: Props) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Estrategia</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {CANONICAL_ESTRATEGIAS.map((estrategia) => (
          <option key={estrategia} value={estrategia}>
            {estrategia.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export default StrategySelector;
