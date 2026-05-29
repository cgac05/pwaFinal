// FIC: Phase 5 T099 — boton EJECUTAR SIMULACION (amarillo, CTA principal del PDF v1).

import React from "react";

interface Props {
  loading: boolean;
  onClick: () => void;
  disabled?: boolean;
  loadingText?: string;
}

export function ExecuteSimulationButton({ loading, onClick, disabled, loadingText }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: "var(--color-accent, #ffd43b)",
        color: "#000",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "0.75rem 1.5rem",
        border: 0,
        borderRadius: "var(--radius-sm, 4px)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
      }}
    >
      {loading ? (loadingText || "Ejecutando…") : "▶ Ejecutar Simulacion"}
    </button>
  );
}

export default ExecuteSimulationButton;
