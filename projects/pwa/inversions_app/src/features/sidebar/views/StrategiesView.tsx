// FIC: StrategiesView — static options strategy cards with accordion detail (Iron Condor, Collar Put, Married Put).
// FIC: StrategiesView — cards estáticas de estrategias de opciones con acordeón de detalle (Iron Condor, Collar Put, Married Put).

import React, { useState } from "react";
import { Shield, TrendingUp, Lock, ChevronDown, ChevronUp } from "lucide-react";

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

export function StrategiesView() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
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
                <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--font-size-xs)", background: "var(--color-accent-subtle)", color: "var(--color-accent)", borderRadius: "var(--radius-pill)", padding: "1px var(--space-sm)" }}>
                    Riesgo {strategy.riskProfile === "limited" ? "limitado" : "ilimitado"}
                  </span>
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
  );
}
