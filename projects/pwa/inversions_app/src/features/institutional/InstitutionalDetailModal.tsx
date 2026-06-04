// FIC: InstitutionalDetailModal — tabbed content modal with zones, trends, expiration, and positions. (EN)
// FIC: InstitutionalDetailModal — modal de contenido con pestañas: zonas, tendencias, vencimientos y posiciones. (ES)

import React, { useState } from "react";
import { ContentModal } from "../../components/ui/ContentModal";
import { MarkdownContent } from "../../components/ui/MarkdownContent";
import type { InstitutionalAnalysisResponse } from "../../services/institutional/institutionalApi";
import type { ConfluenceSignalRow } from "../../services/signals/confluenceTableApi";
import { ObservationsTab } from "../dashboard/ObservationsTab";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  data: InstitutionalAnalysisResponse | null;
  resumen?: string;
  signalRow?: ConfluenceSignalRow;
}

type Tab = "zones" | "trends" | "expiration" | "positions" | "observaciones";

const TAB_LABELS: Record<Tab, string> = {
  zones: "Zonas S/R",
  trends: "Tendencias",
  expiration: "Vencimientos",
  positions: "Posiciones 13F",
  observaciones: "Observaciones",
};

const statusIcon = (status: string): React.ReactNode => {
  if (status === "ok") return <span style={{ color: "var(--color-buy)", fontWeight: 700 }}>●</span>;
  if (status === "partial") return <span style={{ color: "var(--color-warning)", fontWeight: 700 }}>●</span>;
  return <span style={{ color: "var(--color-sell)", fontWeight: 700 }}>●</span>;
};

const strengthBar = (value: number) => {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
      <div
        style={{
          width: 60,
          height: 6,
          backgroundColor: "var(--color-surface-raised)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor:
              pct >= 70 ? "var(--color-buy)" : pct >= 40 ? "var(--color-hold)" : "var(--color-sell)",
            borderRadius: 3,
          }}
        />
      </div>
      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
        {(value).toFixed(2)}
      </span>
    </div>
  );
};

const trendBadge = (direction: "bullish" | "bearish" | "neutral") => {
  const config = {
    bullish: { color: "var(--color-buy)", label: "Bullish" },
    bearish: { color: "var(--color-sell)", label: "Bearish" },
    neutral: { color: "var(--color-text-muted)", label: "Neutral" },
  };
  return (
    <span
      style={{
        fontSize: "var(--font-size-sm)",
        fontWeight: 600,
        color: config[direction].color,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35em",
      }}
    >
      <span style={{ fontWeight: 700 }}>●</span>
      {config[direction].label}
    </span>
  );
};

export function InstitutionalDetailModal({ isOpen, onClose, ticker, data, resumen, signalRow }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("zones");

  const subtitle = data
    ? `Estado: ${data.analysis.overallStatus} · Resuelto: ${new Date(data.analysis.resolvedAt).toLocaleTimeString()}`
    : "";

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: "var(--space-xs) var(--space-md)",
    fontSize: "var(--font-size-sm)",
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "var(--color-accent)" : "var(--color-text-muted)",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: activeTab === tab ? `2px solid var(--color-accent)` : "2px solid transparent",
    cursor: "pointer",
    background: "none",
    transition: "color var(--duration-fast) var(--easing-standard)",
  });

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--space-xs) var(--space-sm)",
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid var(--color-border)",
  };

  const tdStyle: React.CSSProperties = {
    padding: "var(--space-xs) var(--space-sm)",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-border-subtle)",
  };

  return (
    <ContentModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${ticker} — Análisis Institucional`}
      subtitle={subtitle}
      data-testid="institutional-detail-modal"
    >
      {!data ? (
        <p style={{ color: "var(--color-text-muted)", textAlign: "center" }}>
          Sin datos disponibles para {ticker}.
        </p>
      ) : (
        <>
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginBottom: "var(--space-lg)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
              <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "zones" && (
            <div>
              {data.zones ? (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Precio</th>
                        <th style={thStyle}>Tipo</th>
                        <th style={thStyle}>Fuerza</th>
                        <th style={thStyle}>Confianza</th>
                        <th style={thStyle}>Vol. Acum.</th>
                        <th style={thStyle}>Liquidez</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.zones.all.map((z, i) => (
                        <tr key={i}>
                          <td style={tdStyle}>${z.price.toFixed(2)}</td>
                          <td style={{ ...tdStyle, color: z.type === "support" ? "var(--color-buy)" : "var(--color-sell)" }}>
                            {z.type === "support" ? "Soporte" : "Resistencia"}
                          </td>
                          <td style={tdStyle}>{strengthBar(z.strength)}</td>
                          <td style={tdStyle}>{strengthBar(z.confidence)}</td>
                          <td style={tdStyle}>{z.volumeCluster.toLocaleString()}</td>
                          <td style={{ ...tdStyle, textTransform: "capitalize" }}>{z.liquidity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ marginTop: "var(--space-md)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                    Velas analizadas: {data.zones.candlesAnalyzed} · ATR: {data.zones.atr.toFixed(2)} · Score institucional: {data.zones.institutionalScore.toFixed(2)}
                  </p>
                </>
              ) : (
                <p style={{ color: "var(--color-text-muted)" }}>Datos de zonas no disponibles.</p>
              )}

              {/* Source reports */}
              <div style={{ marginTop: "var(--space-lg)", display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                {data.sourceReports.map((s) => (
                  <span key={s.sourceId} style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                    {statusIcon(s.status)} {s.sourceId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeTab === "trends" && (
            <div>
              {data.trends ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>Dirección</p>
                    {trendBadge(data.trends.direction)}
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>SMA-50</p>
                    <p style={{ fontSize: "var(--font-size-base)", fontWeight: 600 }}>${data.trends.sma50.toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>SMA-200</p>
                    <p style={{ fontSize: "var(--font-size-base)", fontWeight: 600 }}>${data.trends.sma200.toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>Crossover</p>
                    <p style={{ fontSize: "var(--font-size-sm)" }}>
                      {data.trends.crossover
                        ? `${data.trends.crossover.type === "golden" ? "🟡 Golden Cross" : "💀 Death Cross"} · hace ${data.trends.crossover.daysAgo}d`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>Fuerza de tendencia</p>
                    {strengthBar(data.trends.trendStrength)}
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>Probabilidad de continuidad</p>
                    {strengthBar(data.trends.continuityProbability)}
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>Score institucional</p>
                    {strengthBar(data.trends.institutionalScore)}
                  </div>
                  <div>
                    <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>Correlación volumen</p>
                    <p style={{ fontSize: "var(--font-size-sm)" }}>{data.trends.volumeCorrelation.toFixed(3)} (Pearson)</p>
                  </div>
                </div>
              ) : (
                <p style={{ color: "var(--color-text-muted)" }}>Datos de tendencias no disponibles.</p>
              )}
            </div>
          )}

          {activeTab === "expiration" && (
            <div>
              {data.expiration ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
                    <div>
                      <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Régimen actual</p>
                      <p style={{ fontWeight: 600, textTransform: "capitalize" }}>{data.expiration.currentRegime}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Días para OpEx</p>
                      <p style={{ fontWeight: 600 }}>{data.expiration.daysToNextOpex}d</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Sesgo estacional</p>
                      <p style={{ fontWeight: 600, textTransform: "capitalize" }}>{data.expiration.expiryBias}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Skew</p>
                      <p style={{ fontWeight: 600 }}>{data.expiration.callPutSkew}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Theta</p>
                      <p style={{ fontWeight: 600 }}>{data.expiration.theta.toFixed(3)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Gamma</p>
                      <p style={{ fontWeight: 600 }}>{data.expiration.gamma.toFixed(3)}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
                    Próximos eventos:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    {data.expiration.events.slice(0, 8).map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "var(--space-xs) var(--space-sm)",
                          backgroundColor: "var(--color-surface-raised)",
                          borderRadius: "var(--radius-xs)",
                        }}
                      >
                        <span style={{ fontSize: "var(--font-size-sm)" }}>{ev.label}</span>
                        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{ev.date}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: "var(--color-text-muted)" }}>Datos de vencimientos no disponibles.</p>
              )}
            </div>
          )}

          {activeTab === "observaciones" && (
            <div>
              {signalRow ? (
                <ObservationsTab row={signalRow} />
              ) : (
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                  No hay datos de señal disponibles.
                </p>
              )}
            </div>
          )}

          {activeTab === "positions" && (
            <div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "var(--space-lg)" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fuente</th>
                    <th style={thStyle}>Count</th>
                    <th style={thStyle}>Notional</th>
                    <th style={thStyle}>Ownership</th>
                    <th style={thStyle}>Confianza</th>
                  </tr>
                </thead>
                <tbody>
                  {data.metrics && (
                    <tr>
                      <td style={tdStyle}>Consolidado</td>
                      <td style={tdStyle}>{data.metrics.openPositionsCount}</td>
                      <td style={tdStyle}>${(data.metrics.openPositionsNotional ?? 0).toLocaleString()}</td>
                      <td style={tdStyle}>{data.metrics.fundsOwnershipPct.toFixed(1)}%</td>
                      <td style={tdStyle}>—</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div style={{ display: "flex", gap: "var(--space-xl)" }}>
                <div>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Inflows</p>
                  <p style={{ fontWeight: 600, color: "var(--color-buy)" }}>${data.metrics?.inflows.toLocaleString()}M</p>
                </div>
                <div>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Outflows</p>
                  <p style={{ fontWeight: 600, color: "var(--color-sell)" }}>${data.metrics?.outflows.toLocaleString()}M</p>
                </div>
                <div>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Net Flow</p>
                  <p style={{ fontWeight: 600, color: (data.metrics?.netFlow ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                    ${data.metrics?.netFlow.toLocaleString()}M
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </ContentModal>
  );
}
