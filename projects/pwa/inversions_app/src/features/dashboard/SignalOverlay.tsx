// FIC: Signal overlay cards with Revolut design tokens — animated confluence score, verdict colors.
// FIC: Tarjetas de overlay de señales con tokens Revolut — score de confluencia animado, colores de veredicto.

import type { DashboardSignalCard } from "../../services/signals/signalApi";
import { useAnimatedValue } from "../../hooks/useAnimatedValue";

interface SignalOverlayProps {
  cards: DashboardSignalCard[];
  onCardClick?: (card: DashboardSignalCard) => void;
}

function verdictColor(signal: DashboardSignalCard["signal"]): string {
  if (signal === "BUY") return "var(--color-buy)";
  if (signal === "SELL") return "var(--color-sell)";
  return "var(--color-hold)";
}

function riskColor(risk: DashboardSignalCard["riskLevel"]): string {
  if (risk === "LOW") return "var(--color-buy)";
  if (risk === "HIGH") return "var(--color-sell)";
  return "var(--color-hold)";
}

interface ScoreBarProps {
  score: number;
}

function ScoreBar({ score }: ScoreBarProps) {
  const animated = useAnimatedValue(score, { decimals: 0 });
  const color = animated >= 70 ? "var(--color-buy)" : animated >= 45 ? "var(--color-hold)" : "var(--color-sell)";

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Confluencia</span>
        <span style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-bold)", color }}>{animated}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--color-border)" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(100, Math.max(0, score))}%`,
          borderRadius: 2,
          background: color,
          transition: "width var(--duration-normal) var(--easing-standard)"
        }} />
      </div>
    </div>
  );
}

/**
 * FIC: Visual overlay for confluence signals by instrument/core confidence.
 * Provides quick operational scan for BUY/SELL/HOLD at a glance.
 *
 * FIC: Overlay visual de señales de confluencia por instrumento/confianza de core.
 * Provee escaneo operativo rápido de BUY/SELL/HOLD de un vistazo.
 */
export function SignalOverlay({ cards, onCardClick }: SignalOverlayProps) {
  return (
    <section>
      <h2 style={{ marginBottom: "0.75rem" }}>Overlay de señales</h2>
      <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {cards.map((card) => (
          <article
            key={card.signalId}
            onClick={() => onCardClick?.(card)}
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-md)",
              cursor: onCardClick ? "pointer" : undefined,
              boxShadow: "var(--shadow-card)"
            }}
            title={`Timing D: ${card.metadata?.timing_d ?? "n/a"} | Timing H: ${card.metadata?.timing_h ?? "n/a"} | Stop: ${card.metadata?.stop ?? "n/a"} | Objetivo: ${card.metadata?.objetivo ?? "n/a"}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-lg)", letterSpacing: "0.04em" }}>{card.instrument}</div>
                <div style={{ marginTop: "0.25rem", fontSize: "var(--font-size-xs)", color: riskColor(card.riskLevel) }}>
                  Riesgo {card.riskLevel}
                </div>
              </div>
              <span style={{
                background: `color-mix(in srgb, ${verdictColor(card.signal)} 15%, transparent)`,
                color: verdictColor(card.signal),
                border: `1px solid color-mix(in srgb, ${verdictColor(card.signal)} 40%, transparent)`,
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--font-size-xs)",
                fontWeight: "var(--font-weight-bold)",
                padding: "0.2rem 0.6rem",
                letterSpacing: "0.05em"
              }}>
                {card.signal}
              </span>
            </div>

            <ScoreBar score={card.confluenceScore} />

            <div style={{ marginTop: "0.6rem", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                Confianza: <strong style={{ color: "var(--color-text)" }}>{Math.round(card.confidence * 100)}%</strong>
              </span>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                {card.activeCores.length} cores
              </span>
            </div>

            {/* FIC: Indicator summary badges using Revolut color tokens. */}
            {/* FIC: Badges de resumen de indicadores usando tokens de color Revolut. */}
            <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              <span style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)", borderRadius: "var(--radius-xs)", padding: "0.1rem 0.4rem", fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-emphasis)" }}>
                Timing {card.metadata?.timing_d ?? "-"}
              </span>
              <span style={{ background: "rgba(176, 144, 0, 0.12)", color: "var(--color-hold)", borderRadius: "var(--radius-xs)", padding: "0.1rem 0.4rem", fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-emphasis)" }}>
                Div {card.metadata?.divergencia ?? "-"}
              </span>
              <span style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)", borderRadius: "var(--radius-xs)", padding: "0.1rem 0.4rem", fontSize: "var(--font-size-xs)" }}>
                Z {card.metadata?.z_extrema ?? "-"}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
