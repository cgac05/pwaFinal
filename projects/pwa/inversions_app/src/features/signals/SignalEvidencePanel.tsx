// FIC: Signal evidence panel — section per core with accent color, Revolut typography tokens.
// FIC: Panel de evidencia de señal — sección por core con color de acento, tokens de tipografía Revolut.

import type { SourceVerdict } from "../../services/signals/signalApi";

interface SignalEvidencePanelProps {
  evidence: SourceVerdict[];
}

const CORE_COLORS: Record<string, string> = {
  technical:    "var(--color-accent)",
  options:      "var(--color-buy)",
  flow:         "#a78bfa",
  news:         "var(--color-hold)",
  ai:           "var(--color-warning)"
};

function coreColor(sourceId: string): string {
  const key = sourceId.toLowerCase();
  for (const [pattern, color] of Object.entries(CORE_COLORS)) {
    if (key.includes(pattern)) return color;
  }
  return "var(--color-text-muted)";
}

export function SignalEvidencePanel({ evidence }: SignalEvidencePanelProps) {
  if (evidence.length === 0) {
    return (
      <p style={{ color: "var(--color-text-muted)", fontStyle: "italic", fontSize: "var(--font-size-sm)" }}>
        No hay evidencia disponible para este instrumento.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--space-sm)" }}>
      {evidence.map((item) => {
        const accentColor = coreColor(item.sourceId);
        const verdictColor =
          item.verdict === "BUY" ? "var(--color-buy)" :
          item.verdict === "SELL" ? "var(--color-sell)" :
          "var(--color-hold)";

        return (
          <li
            key={item.sourceId}
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-subtle)",
              borderLeft: `3px solid ${accentColor}`,
              borderRadius: "var(--radius-md)",
              padding: "0.65rem var(--space-md)",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "0.25rem var(--space-md)",
              alignItems: "start"
            }}
          >
            <div>
              {/* FIC: Source name uses emphasis font weight per Revolut heading style. */}
              {/* FIC: Nombre de fuente usa peso de tipografía énfasis según estilo de encabezado Revolut. */}
              <strong style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: "var(--font-weight-emphasis)",
                textTransform: "capitalize",
                color: accentColor
              }}>
                {item.sourceId}
              </strong>
              <p style={{ marginTop: "0.2rem", fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                {item.rationale}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "block", fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-sm)", color: verdictColor }}>
                {item.verdict}
              </span>
              <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                {Math.round(item.confidence * 100)}%
              </small>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
