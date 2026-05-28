// FIC: Core selector — Revolut chip toggle style with accent active state and CSS vars.
// FIC: Selector de cores — estilo toggle chip Revolut con estado activo acento y CSS vars.

interface CoreDefinition {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface CoreSelectorProps {
  cores: CoreDefinition[];
  onToggle: (coreId: string) => void;
}

export type { CoreDefinition };

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
      <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {cores.map((core) => (
          <button
            key={core.id}
            onClick={() => onToggle(core.id)}
            aria-pressed={core.enabled}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: core.enabled ? "var(--color-accent-subtle)" : "var(--color-surface-raised)",
              border: `1px solid ${core.enabled ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-md)",
              padding: "0.65rem 0.75rem",
              cursor: "pointer",
              transition: "background var(--duration-fast) var(--easing-standard), border-color var(--duration-fast) var(--easing-standard)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <strong style={{
                color: core.enabled ? "var(--color-text)" : "var(--color-text-muted)",
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-emphasis)"
              }}>
                {core.label}
              </strong>
              {/* FIC: SI/NO explicit toggle badge — required by constitution §10 (PDF v1). */}
              {/* FIC: Badge de toggle explícito SI/NO — requerido por constitución §10 (PDF v1). */}
              <span
                aria-label={`${core.label} ${core.enabled ? "SI" : "NO"}`}
                style={{
                  marginLeft: "auto",
                  background: core.enabled ? "var(--color-buy)" : "var(--color-text-muted)",
                  color: "#000",
                  fontWeight: "var(--font-weight-bold)",
                  fontSize: "var(--font-size-xs)",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "var(--radius-xs)"
                }}
              >
                {core.enabled ? "SI" : "NO"}
              </span>
            </div>
            <p style={{ marginTop: "0.3rem", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {core.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
