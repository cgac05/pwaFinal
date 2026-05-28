import React from "react";

export interface CoreDefinition {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface CoreSelectorProps {
  cores: CoreDefinition[];
  onToggle: (coreId: string) => void;
}

/**
 * FIC: Selector for active analytical cores in dashboard confluence.
 * Allows operators to enable/disable strategy cores before refresh.
 *
 * FIC: Selector de cores analíticos activos en la confluencia del dashboard.
 * Permite a operadores habilitar/deshabilitar cores antes de refrescar.
 */
export function CoreSelector({ cores, onToggle }: CoreSelectorProps) {
  return (
    <section className="card">
      <h2 style={{ marginBottom: "0.75rem" }}>Cores analíticos</h2>
      <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {cores.map((core) => (
          <label
            key={core.id}
            style={{
              display: "block",
              background: core.enabled ? "rgba(56, 139, 253, 0.08)" : "var(--color-surface-raised)",
              border: `1px solid ${core.enabled ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-sm)",
              padding: "0.65rem 0.75rem",
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={core.enabled}
                onChange={() => onToggle(core.id)}
                style={{ width: 14, height: 14, accentColor: "var(--color-accent)", cursor: "pointer" }}
              />
              <strong style={{ color: core.enabled ? "var(--color-text)" : "var(--color-text-muted)", fontSize: "0.875rem" }}>
                {core.label}
              </strong>
              {/* FIC: Phase 5 T101 — toggle SI/NO explicito por PDF v1, reemplaza el flag "enabled" implicito. */}
              <span
                aria-label={`${core.label} ${core.enabled ? "SI" : "NO"}`}
                style={{
                  marginLeft: "auto",
                  background: core.enabled ? "var(--color-buy, #2ec27e)" : "var(--color-text-muted)",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "0.65rem",
                  padding: "0.1rem 0.4rem",
                  borderRadius: 3
                }}
              >
                {core.enabled ? "SI" : "NO"}
              </span>
            </div>
            <p style={{ marginTop: "0.3rem", fontSize: "0.75rem", paddingLeft: "1.4rem" }}>{core.description}</p>
          </label>
        ))}
      </div>
    </section>
  );
}
