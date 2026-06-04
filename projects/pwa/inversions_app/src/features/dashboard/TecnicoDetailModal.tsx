import React, { useState } from "react";
import { ContentModal } from "../../components/ui/ContentModal";
import type { ConfluenceSignalRow } from "../../services/signals/confluenceTableApi";
import { ObservationsTab } from "./ObservationsTab";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  signalRow?: ConfluenceSignalRow;
  activeStrategy?: string;
}

type Tab = "panel" | "canonica";

const TAB_LABELS: Record<Tab, string> = {
  panel: "Panel Estructurado",
  canonica: "Observaciones",
};

export function TecnicoDetailModal({ isOpen, onClose, ticker, signalRow, activeStrategy }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("panel");

  if (!signalRow) return null;

  const subtitle = `Estado: ${signalRow.estado} · Resuelto: ${new Date(signalRow.computed_at).toLocaleTimeString()}`;

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

  // Parse evidencia_refs: ["trend:ALCISTA", "adx:28.7", ...]
  const ev: Record<string, string> = {};
  for (const ref of (signalRow.evidencia_refs ?? [])) {
    const i = ref.indexOf(":");
    if (i > 0) ev[ref.slice(0, i)] = ref.slice(i + 1);
  }
  const met = signalRow.observacion?.metricas ?? {};
  const trendColor = signalRow.tendencia === "ALCISTA" ? "var(--color-buy)"
    : signalRow.tendencia === "BAJISTA" ? "var(--color-sell)"
      : "var(--color-text-muted)";
  const subCard = {
    background: "var(--color-surface-raised)", borderRadius: "var(--radius-sm)",
    padding: "0.75rem 1rem", border: "1px solid var(--color-border-subtle)"
  };
  const subTitle = {
    fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.07em", color: "var(--color-accent)", marginBottom: "0.5rem"
  };
  const dataRow = (label: string, value: React.ReactNode, color?: string) => (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "2px 0",
      borderBottom: "1px solid var(--color-border-subtle)", fontSize: "0.75rem"
    }}>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? "var(--color-text)" }}>{value}</span>
    </div>
  );

  return (
    <ContentModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${ticker} — ANÁLISIS TÉCNICO`}
      subtitle={subtitle}
    >
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

      <div style={{ flex: 1, overflowY: "auto", minHeight: 400 }}>
        {activeTab === "panel" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem"
          }}>
            {/* Tendencia */}
            <div style={subCard}>
              <div style={subTitle}>Tendencia</div>
              {dataRow("Detectada", ev.trend ?? signalRow.tendencia, trendColor)}
              {dataRow("Fuerza", ev.trendStrength ?? (met.TREND_STRENGTH as string) ?? "—")}
            </div>
            {/* Momentum */}
            <div style={subCard}>
              <div style={subTitle}>Momentum</div>
              {dataRow("ADX", ev.adx ? `${ev.adx}` : "—")}
              {dataRow("Interpretación",
                Number(ev.adx ?? 0) >= 40 ? "Muy fuerte" :
                  Number(ev.adx ?? 0) >= 25 ? "Fuerte" :
                    Number(ev.adx ?? 0) >= 15 ? "Débil" : "Sin tendencia")}
              {dataRow("Líneas", `${ev.trendLines ?? "0"} totales`)}
            </div>
            {/* Medias */}
            <div style={subCard}>
              <div style={subTitle}>Medias Móviles</div>
              {dataRow("EMA50", met.SMA_50 ? `$${Number(met.SMA_50).toFixed(2)}` : "—")}
              {dataRow("Último cierre", signalRow.precio > 0 ? `$${signalRow.precio.toFixed(2)}` : "—")}
              {dataRow("Candles analizadas", met.CANDLES_ANALYZED ?? "—")}
            </div>
            {/* Soportes */}
            <div style={subCard}>
              <div style={subTitle}>Soportes</div>
              {dataRow("Cantidad", ev.supports ?? (met.SOPORTES as string) ?? "0",
                Number(ev.supports ?? 0) > 0 ? "var(--color-buy)" : undefined)}
            </div>
            {/* Resistencias */}
            <div style={subCard}>
              <div style={subTitle}>Resistencias</div>
              {dataRow("Cantidad", ev.resistances ?? (met.RESISTENCIAS as string) ?? "0",
                Number(ev.resistances ?? 0) > 0 ? "var(--color-sell)" : undefined)}
            </div>
            {/* Métricas */}
            <div style={subCard}>
              <div style={subTitle}>Métricas</div>
              {Object.entries(met).map(([k, v]) => dataRow(k, String(v)))}
              {Object.keys(met).length === 0 && (
                <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>Sin métricas</span>
              )}
            </div>
          </div>
        )}

        {activeTab === "canonica" && (
          <div>
            <ObservationsTab row={signalRow} activeStrategy={activeStrategy} />
          </div>
        )}
      </div>
    </ContentModal>
  );
}
