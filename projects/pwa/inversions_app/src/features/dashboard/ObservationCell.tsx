// FIC: Phase 5 T096 — render estructurado de SignalObservation (Objetivo/Señal/Explicacion + metricas).

import React from "react";
import type { SignalObservation } from "../../services/signals/confluenceTableApi";

interface Props {
  observation: any;
}

export function ObservationCell({ observation }: Props) {
  if (typeof observation === "string") {
    return (
      <div style={{ fontSize: "0.8rem", lineHeight: 1.35, minWidth: 220 }}>
        {observation}
      </div>
    );
  }

  if (!observation) return null;

  const metricas = observation.metricas || {};
  const entries = Object.entries(metricas).filter(([, v]) => v !== undefined && v !== null);
  
  return (
    <div style={{ fontSize: "0.8rem", lineHeight: 1.35, minWidth: 220 }}>
      {observation.objetivo && <div><strong>Objetivo:</strong> {observation.objetivo}</div>}
      {observation.senal && <div><strong>Señal:</strong> {observation.senal}</div>}
      {observation.explicacion && <div><strong>Explicación:</strong> {observation.explicacion}</div>}
      {entries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.3rem" }}>
          {entries.map(([k, v]) => (
            <span
              key={k}
              style={{
                background: "var(--color-surface-raised, #1c1f26)",
                borderRadius: "var(--radius-sm, 4px)",
                padding: "0.1rem 0.4rem",
                fontSize: "0.7rem"
              }}
            >
              {k}: {String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default ObservationCell;
