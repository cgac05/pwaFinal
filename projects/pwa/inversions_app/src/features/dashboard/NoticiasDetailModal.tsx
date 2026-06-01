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
  panel: "Impacto y NLP",
  canonica: "Observaciones",
};

export function NoticiasDetailModal({ isOpen, onClose, ticker, signalRow, activeStrategy }: Props) {
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

  const met = signalRow.observacion?.metricas ?? {};
  
  const strengthColor = (val: number) => {
    if (val >= 0.5) return "var(--color-buy)";
    if (val <= -0.5) return "var(--color-sell)";
    return "var(--color-text-muted)";
  };

  const subCard = {
    background: "var(--color-surface-raised)", borderRadius: "var(--radius-sm)",
    padding: "0.75rem 1rem", border: "1px solid var(--color-border-subtle)",
    display: "flex", flexDirection: "column" as const, gap: "0.5rem"
  };
  const subTitle = {
    fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.07em", color: "var(--color-accent)", marginBottom: "0.25rem"
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
      title={`${ticker} — ANÁLISIS DE NOTICIAS`}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            
            {/* Header / Titular */}
            <div style={subCard}>
              <div style={subTitle}>Titular Analizado</div>
              <p style={{ fontSize: "0.85rem", margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                {signalRow.observacion?.objetivo || "Sin titular disponible"}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {/* Veredicto */}
              <div style={subCard}>
                <div style={subTitle}>Veredicto NLP</div>
                {dataRow("Señal de NLP", signalRow.tipoSenal, signalRow.tipoSenal === "CALL" ? "var(--color-buy)" : signalRow.tipoSenal === "PUT" ? "var(--color-sell)" : undefined)}
                {dataRow("Impacto de Sentimiento", Number(met.SENTIMIENTO ?? 0).toFixed(2), strengthColor(Number(met.SENTIMIENTO ?? 0)))}
                {dataRow("Tendencia", signalRow.tendencia)}
              </div>

              {/* Fuentes */}
              <div style={subCard}>
                <div style={subTitle}>Calidad de Fuente</div>
                {dataRow("Proveedor", met.PROVEEDOR as string ?? signalRow.fuente ?? "Desconocido")}
                {dataRow("Confianza de AI", `${Math.round(Number(met.CONFIANZA ?? 0) * 100)}%`)}
                {dataRow("Credibilidad", `${Math.round(Number(met.CREDIBILIDAD ?? 0) * 100)}%`)}
              </div>
            </div>

            {/* Resumen */}
            <div style={subCard}>
              <div style={subTitle}>Resumen / Rationale</div>
              <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
                {signalRow.observacion?.senal || "Resumen no provisto."}
              </p>
            </div>

            {/* URL */}
            {signalRow.evidencia_refs?.[0] && (
              <div style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
                <a href={signalRow.evidencia_refs[0]} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)", textDecoration: "none", fontWeight: 600 }}>
                  Ver artículo original ↗
                </a>
              </div>
            )}
            
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
