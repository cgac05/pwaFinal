// FIC: Explainability matrix — Revolut tokens applied: muted headers, alternating rows, verdict colors.
// FIC: Matriz de explicabilidad — tokens Revolut aplicados: encabezados muted, filas alternadas, colores de veredicto.

import type { DashboardSignalCard } from "../../services/signals/signalApi";

interface ExplainabilityTableProps {
  cards: DashboardSignalCard[];
}

/**
 * FIC: Explainability matrix with score, confidence and evidence source count.
 * Supports audit and operator decision with concise transparent metrics.
 *
 * FIC: Matriz de explicabilidad con score, confianza y conteo de fuentes de evidencia.
 * Soporta auditoría y decisión de operador con métricas concisas y transparentes.
 */
export function ExplainabilityTable({ cards }: ExplainabilityTableProps) {
  return (
    <section className="card">
      <h2 style={{ marginBottom: "0.75rem" }}>Explicabilidad</h2>
      <div style={{ overflow: "auto", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-sm)" }}>
          <thead>
            <tr style={{ background: "var(--color-surface)" }}>
              {["Instrumento", "Señal", "Score", "Confianza", "Fuentes"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "0.6rem 0.75rem",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: "var(--font-weight-emphasis)",
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    borderBottom: "1px solid var(--color-border)"
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map((card, idx) => {
              const verdictColor =
                card.signal === "BUY" ? "var(--color-buy)" :
                card.signal === "SELL" ? "var(--color-sell)" :
                "var(--color-hold)";

              return (
                <tr
                  key={card.signalId}
                  style={{ background: idx % 2 === 1 ? "var(--color-surface-raised)" : "var(--color-surface)" }}
                >
                  <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <strong style={{ fontWeight: "var(--font-weight-emphasis)" }}>{card.instrument}</strong>
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <span style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "var(--font-weight-bold)",
                      color: verdictColor,
                      background: `color-mix(in srgb, ${verdictColor} 12%, transparent)`,
                      borderRadius: "var(--radius-xs)",
                      padding: "0.1rem 0.4rem"
                    }}>
                      {card.signal}
                    </span>
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text)" }}>
                    {card.confluenceScore}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text)" }}>
                    {Math.round(card.confidence * 100)}%
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", borderBottom: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)" }}>
                    {card.evidence.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
