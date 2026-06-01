// FIC: StrategiesView — strategy cards with accordion detail and "Configurar" button to open CoverageStrategyModal.
// FIC: StrategiesView — cards de estrategias con acordeón y botón "Configurar" para abrir CoverageStrategyModal.

import React, { useState } from "react";
import { Shield, TrendingUp, Lock, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { CoverageStrategyModal } from "../../coverage/CoverageStrategyModal";

interface Strategy {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  riskProfile: "limited" | "unlimited";
  marketContext: string;
}

const STRATEGIES: Strategy[] = [
  {
    id: "iron-condor",
    name: "Iron Condor",
    icon: <TrendingUp size={18} />,
    description: "Venta simultánea de call spread y put spread. Profit máximo en mercado lateral.",
    riskProfile: "limited",
    marketContext: "Mercado lateral, baja volatilidad implícita",
  },
  {
    id: "collar-put",
    name: "Collar Put",
    icon: <Shield size={18} />,
    description: "Compra de put protectora financiada con venta de call. Limita upside y downside.",
    riskProfile: "limited",
    marketContext: "Posición larga existente que se quiere proteger",
  },
  {
    id: "married-put",
    name: "Married Put",
    icon: <Lock size={18} />,
    description: "Compra de acción + compra de put. Seguro contra caídas.",
    riskProfile: "limited",
    marketContext: "Alcista con necesidad de protección ante evento de riesgo",
  },
];

const STRATEGY_KIND_MAP: Record<string, "protective_put" | "married_put" | "collar_put" | "covered_straddle"> = {
  "collar-put": "collar_put",
  "married-put": "married_put",
  "iron-condor": "protective_put", // closest TEAM-05 equivalent for Iron Condor
};

export function StrategiesView() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<"protective_put" | "married_put" | "collar_put" | "covered_straddle">("collar_put");

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const openModal = (strategyId: string) => {
    setModalKind(STRATEGY_KIND_MAP[strategyId] ?? "protective_put");
    setModalOpen(true);
  };

  return (
    <>
      <div style={{ padding: "var(--space-sm)", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {STRATEGIES.map((strategy) => {
          const isExpanded = expandedId === strategy.id;
          return (
            <div
              key={strategy.id}
              style={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
              }}
            >
              {/* Card header — clickable accordion trigger */}
              <button
                onClick={() => toggle(strategy.id)}
                aria-expanded={isExpanded}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-xs)",
                  padding: "var(--space-xs) var(--space-sm)",
                  background: "none",
                  border: "none",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", flex: 1, minWidth: 0 }}>
                  <span style={{ color: "var(--color-accent)", flexShrink: 0 }}>{strategy.icon}</span>
                  <span style={{ fontWeight: "var(--font-weight-emphasis)", fontSize: "var(--font-size-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {strategy.name}
                  </span>
                </div>
                <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {/* Accordion detail */}
              {isExpanded && (
                <div style={{ padding: "var(--space-xs) var(--space-sm) var(--space-sm)", borderTop: "1px solid var(--color-border-subtle)" }}>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: "var(--space-xs)" }}>
                    {strategy.description}
                  </p>
                  <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "var(--font-size-xs)", background: "var(--color-accent-subtle)", color: "var(--color-accent)", borderRadius: "var(--radius-pill)", padding: "1px var(--space-sm)" }}>
                      Riesgo {strategy.riskProfile === "limited" ? "limitado" : "ilimitado"}
                    </span>
                    {/* FIC: "Configurar" button opens CoverageStrategyModal for this strategy. (EN) */}
                    {/* FIC: Botón "Configurar" abre CoverageStrategyModal para esta estrategia. (ES) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openModal(strategy.id); }}
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                        background: "rgba(73,79,223,0.12)",
                        border: "1px solid rgba(73,79,223,0.3)",
                        borderRadius: "var(--radius-xs)",
                        color: "var(--color-accent)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: 600,
                        padding: "2px var(--space-xs)",
                        cursor: "pointer",
                      }}
                    >
                      <Settings size={11} />
                      Configurar
                    </button>
                  </div>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-xs)", lineHeight: 1.4 }}>
                    📅 {strategy.marketContext}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <CoverageStrategyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialKind={modalKind}
      />
    </>
  );
}
