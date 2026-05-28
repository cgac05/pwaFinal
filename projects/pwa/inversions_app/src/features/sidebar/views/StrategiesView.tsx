// FIC: StrategiesView — options strategy calculator cards (Short Put, Long Put, Short Call, Long Call).
// FIC: StrategiesView — cards de calculadora de estrategias de opciones (Short Put, Long Put, Short Call, Long Call).

import React, { useState } from "react";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Shield, ArrowDown } from "lucide-react";

interface StrategyConfig {
  id: "short-put" | "long-put" | "short-call" | "long-call";
  name: string;
  icon: React.ReactNode;
  description: string;
  riskProfile: "limited" | "unlimited";
  sentiment: "bullish" | "bearish" | "neutral";
  endpoint: string;
}

const STRATEGIES: StrategyConfig[] = [
  {
    id: "short-put",
    name: "Short Put",
    icon: <ArrowDown size={16} />,
    description: "Venta de put. Obligación de comprar al strike. Profit = prima cobrada.",
    riskProfile: "limited",
    sentiment: "bullish",
    endpoint: "/api/team-03/options/calculate",
  },
  {
    id: "long-put",
    name: "Long Put",
    icon: <TrendingDown size={16} />,
    description: "Compra de put. Derecho a vender al strike. Protección ante caídas.",
    riskProfile: "limited",
    sentiment: "bearish",
    endpoint: "/api/team-03/options/calculate",
  },
  {
    id: "short-call",
    name: "Short Call",
    icon: <TrendingUp size={16} />,
    description: "Venta de call. Obligación de vender al strike. Ingreso de prima.",
    riskProfile: "unlimited",
    sentiment: "bearish",
    endpoint: "/api/team-03/options/calculate",
  },
  {
    id: "long-call",
    name: "Long Call",
    icon: <Shield size={16} />,
    description: "Compra de call. Derecho a comprar al strike. Apalancamiento alcista.",
    riskProfile: "limited",
    sentiment: "bullish",
    endpoint: "/api/team-03/options/calculate",
  },
];

interface StrategyForm {
  ticker: string;
  strikePrice: string;
  premium: string;
  quantity: string;
  expirationDate: string;
}

interface StrategyResult {
  strategy?: {
    maxProfit?: number | string;
    maxLoss?: number | string;
    breakeven?: number | string;
    netPremium?: number | string;
  };
}

export function StrategiesView() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, StrategyForm>>({});
  const [results, setResults] = useState<Record<string, StrategyResult>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getForm = (id: string): StrategyForm =>
    forms[id] ?? { ticker: "AAPL", strikePrice: "", premium: "", quantity: "1", expirationDate: "" };

  const setFormField = (id: string, field: keyof StrategyForm, value: string) => {
    setForms((prev) => ({ ...prev, [id]: { ...getForm(id), [field]: value } }));
  };

  const calculate = async (strategy: StrategyConfig) => {
    const form = getForm(strategy.id);
    if (!form.strikePrice || !form.premium) {
      setErrors((prev) => ({ ...prev, [strategy.id]: "Strike y prima son requeridos." }));
      return;
    }
    setLoadingId(strategy.id);
    setErrors((prev) => ({ ...prev, [strategy.id]: "" }));
    try {
      const direction = strategy.id.startsWith("long") ? "long" : "short";
      const optionType = strategy.id.endsWith("put") ? "put" : "call";
      const res = await fetch(strategy.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.ticker.toUpperCase(),
          optionType,
          direction,
          strikePrice: Number(form.strikePrice),
          premium: Number(form.premium),
          quantity: Number(form.quantity || 1),
          expirationDate: form.expirationDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? "calculation_failed");
      }
      const data = (await res.json()) as StrategyResult;
      setResults((prev) => ({ ...prev, [strategy.id]: data }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [strategy.id]: err instanceof Error ? err.message : "Error al calcular." }));
    } finally {
      setLoadingId(null);
    }
  };

  const sentimentColor = (s: StrategyConfig["sentiment"]) =>
    s === "bullish" ? "var(--color-buy)" : s === "bearish" ? "var(--color-sell)" : "var(--color-text-muted)";

  const fmtResult = (v: number | string | undefined): string => {
    if (v == null) return "—";
    if (typeof v === "string") return v;
    return `$${v.toFixed(2)}`;
  };

  return (
    <div style={{ padding: "var(--space-sm)", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      {STRATEGIES.map((strategy) => {
        const isExpanded = expandedId === strategy.id;
        const form = getForm(strategy.id);
        const result = results[strategy.id];
        const isLoading = loadingId === strategy.id;
        const errorMsg = errors[strategy.id];

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
            {/* Card header */}
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
                <span style={{ color: sentimentColor(strategy.sentiment), flexShrink: 0 }}>{strategy.icon}</span>
                <span style={{ fontWeight: "var(--font-weight-emphasis)", fontSize: "var(--font-size-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {strategy.name}
                </span>
              </div>
              <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>

            {/* Expanded form + result */}
            {isExpanded && (
              <div style={{ padding: "var(--space-xs) var(--space-sm) var(--space-sm)", borderTop: "1px solid var(--color-border-subtle)", display: "grid", gap: "var(--space-xs)" }}>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", lineHeight: 1.5, margin: 0 }}>
                  {strategy.description}
                </p>
                <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--font-size-xs)", background: "var(--color-accent-subtle)", color: "var(--color-accent)", borderRadius: "var(--radius-pill)", padding: "1px var(--space-sm)" }}>
                    Riesgo {strategy.riskProfile === "limited" ? "limitado" : "ilimitado"}
                  </span>
                  <span style={{ fontSize: "var(--font-size-xs)", color: sentimentColor(strategy.sentiment), borderRadius: "var(--radius-pill)", padding: "1px var(--space-sm)", border: `1px solid ${sentimentColor(strategy.sentiment)}40` }}>
                    {strategy.sentiment}
                  </span>
                </div>

                {/* Input form */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", marginTop: "0.25rem" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ticker</span>
                    <input
                      value={form.ticker}
                      onChange={(e) => setFormField(strategy.id, "ticker", e.target.value.toUpperCase())}
                      placeholder="AAPL"
                      style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Strike $</span>
                    <input
                      type="number"
                      value={form.strikePrice}
                      onChange={(e) => setFormField(strategy.id, "strikePrice", e.target.value)}
                      placeholder="150"
                      style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Prima $</span>
                    <input
                      type="number"
                      value={form.premium}
                      onChange={(e) => setFormField(strategy.id, "premium", e.target.value)}
                      placeholder="2.50"
                      style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cantidad</span>
                    <input
                      type="number"
                      value={form.quantity}
                      onChange={(e) => setFormField(strategy.id, "quantity", e.target.value)}
                      placeholder="1"
                      style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                    />
                  </label>
                </div>

                <button
                  onClick={() => void calculate(strategy)}
                  disabled={isLoading}
                  style={{
                    marginTop: "0.25rem",
                    background: "var(--color-accent)",
                    color: "#000",
                    fontWeight: 700,
                    fontSize: "var(--font-size-xs)",
                    border: 0,
                    borderRadius: "var(--radius-sm)",
                    padding: "0.35rem 0.75rem",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.6 : 1,
                    alignSelf: "flex-start",
                  }}
                >
                  {isLoading ? "Calculando…" : "▶ Calcular"}
                </button>

                {errorMsg && (
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-sell)", margin: 0 }}>{errorMsg}</p>
                )}

                {result?.strategy && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", marginTop: "0.25rem" }}>
                    {[
                      ["Max. Profit", fmtResult(result.strategy.maxProfit)],
                      ["Max. Loss", fmtResult(result.strategy.maxLoss)],
                      ["Breakeven", fmtResult(result.strategy.breakeven)],
                      ["Prima neta", fmtResult(result.strategy.netPremium)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-xs)", padding: "0.25rem 0.4rem" }}>
                        <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                        <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 800, color: "var(--color-text)" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
