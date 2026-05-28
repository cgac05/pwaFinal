// FIC: StrategiesView — options strategy calculator cards (Short Put, Long Put, Short Call, Long Call).
// FIC: StrategiesView — cards de calculadora de estrategias de opciones (Short Put, Long Put, Short Call, Long Call).

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Shield, ArrowDown } from "lucide-react";
import { useSignalStore } from "../../../store/signals";

type StrategyId = "short-put" | "long-put" | "short-call" | "long-call";
type StrategyName = "Short Put" | "Long Put" | "Short Call" | "Long Call";

interface StrategyConfig {
  id: StrategyId;
  name: StrategyName;
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
  currentPrice: string;
  strikePrice: string;
  premium: string;
  quantity: string;
  expirationDate: string;
  availableCapital: string;
  impliedVolatility: string;
  timeDecayModel: "LINEAR" | "EXPONENTIAL";
  interestRate: string;
}

interface StrategyResult {
  strategy?: {
    maxProfit?: number | string;
    maxLoss?: number | string;
    breakEven?: number | string;
    breakeven?: number | string;
    netPremium?: number | string;
  };
}

interface MarketQuoteResponse {
  quotes: Array<{
    symbol: string;
    price: number;
  }>;
}

interface InstrumentCatalogItem {
  symbol: string;
  name: string;
  category: string;
}

interface InstrumentCatalogResponse {
  instruments: InstrumentCatalogItem[];
}

const FALLBACK_INSTRUMENTS: InstrumentCatalogItem[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", category: "indices" },
  { symbol: "QQQ", name: "Invesco QQQ", category: "indices" },
  { symbol: "AAPL", name: "Apple Inc", category: "stocks" },
  { symbol: "MSFT", name: "Microsoft Corp", category: "stocks" },
  { symbol: "ES=F", name: "E-Mini S&P 500", category: "futures" },
  { symbol: "NQ=F", name: "E-Mini Nasdaq 100", category: "futures" },
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "forex" },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", category: "forex" },
  { symbol: "BTCUSD", name: "Bitcoin", category: "cripto" },
  { symbol: "ETHUSD", name: "Ethereum", category: "cripto" },
  { symbol: "US10Y", name: "US 10Y Treasury", category: "bonos" },
  { symbol: "VIX", name: "Volatility Index", category: "references_idx" }
];

export function StrategiesView() {
  const { selectedOptionsStrategy, setSelectedOptionsStrategy } = useSignalStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, StrategyForm>>({});
  const [results, setResults] = useState<Record<string, StrategyResult>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<InstrumentCatalogItem[]>(FALLBACK_INSTRUMENTS);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadInstruments = async () => {
      try {
        const res = await fetch("/api/catalogs/instruments");
        if (!res.ok) return;
        const data = (await res.json()) as InstrumentCatalogResponse;
        if (Array.isArray(data.instruments) && data.instruments.length > 0) {
          setInstruments(data.instruments);
        }
      } catch {
        // Fallback list remains available.
      }
    };

    void loadInstruments();
  }, []);

  const toggle = (id: string) => {
    const strategy = STRATEGIES.find((item) => item.id === id);
    if (strategy) {
      setSelectedOptionsStrategy({ id: strategy.id, name: strategy.name });
    }
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getForm = (id: string): StrategyForm =>
    forms[id] ?? {
      ticker: "AAPL",
      currentPrice: "",
      strikePrice: "",
      premium: "",
      quantity: "1",
      expirationDate: "",
      availableCapital: "10000",
      impliedVolatility: "25",
      timeDecayModel: "LINEAR",
      interestRate: "4"
    };

  const setFormField = (id: string, field: keyof StrategyForm, value: string) => {
    setForms((prev) => ({ ...prev, [id]: { ...getForm(id), [field]: value } }));
  };

  const setTickerField = (id: string, value: string) => {
    const ticker = value.toUpperCase();
    setForms((prev) => {
      const form = prev[id] ?? getForm(id);
      return {
        ...prev,
        [id]: {
          ...form,
          ticker,
          currentPrice: ticker === form.ticker ? form.currentPrice : "",
          strikePrice: ticker === form.ticker ? form.strikePrice : ""
        }
      };
    });
  };

  const fetchQuote = async (id: string): Promise<void> => {
    const form = getForm(id);
    const ticker = form.ticker.trim().toUpperCase();
    if (!ticker) return;

    setQuoteLoadingId(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));

    try {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(ticker)}`);
      if (!res.ok) {
        throw new Error("No se pudo cargar precio actual.");
      }

      const data = (await res.json()) as MarketQuoteResponse;
      const quote = data.quotes.find((item) => item.symbol === ticker) ?? data.quotes[0];
      if (!quote || !Number.isFinite(quote.price)) {
        throw new Error("La API no devolvió precio para ese ticker.");
      }

      setForms((prev) => {
        const nextForm = prev[id] ?? getForm(id);
        return {
          ...prev,
          [id]: {
            ...nextForm,
            ticker,
            currentPrice: quote.price.toFixed(2),
            strikePrice: Math.round(quote.price).toString()
          }
        };
      });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Error al cargar precio."
      }));
    } finally {
      setQuoteLoadingId(null);
    }
  };

  const calculate = async (strategy: StrategyConfig) => {
    setSelectedOptionsStrategy({ id: strategy.id, name: strategy.name });
    const form = getForm(strategy.id);
    if (!form.strikePrice || !form.premium || !form.quantity || !form.expirationDate || !form.availableCapital) {
      setErrors((prev) => ({ ...prev, [strategy.id]: "Strike, prima, contratos, expiración y capital son requeridos." }));
      return;
    }
    setLoadingId(strategy.id);
    setErrors((prev) => ({ ...prev, [strategy.id]: "" }));
    try {
      const direction = strategy.id.startsWith("long") ? "long" : "short";
      const optionType = strategy.id.endsWith("put") ? "put" : "call";
      const daysToExpiration = Math.max(1, Math.ceil((new Date(form.expirationDate).getTime() - Date.now()) / 86_400_000));
      const res = await fetch(strategy.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.ticker.toUpperCase(),
          optionType,
          direction,
          strikePrice: Number(form.strikePrice),
          currentPrice: Number(form.currentPrice || form.strikePrice),
          premium: Number(form.premium),
          premiumPerContract: Number(form.premium),
          quantity: Number(form.quantity || 1),
          numberOfContracts: Number(form.quantity || 1),
          expirationDate: form.expirationDate,
          daysToExpiration,
          capitalAvailable: Number(form.availableCapital),
          availableCapital: Number(form.availableCapital),
          riskTolerance: "medium",
          assumptions: {
            impliedVolatility: Number(form.impliedVolatility || 25),
            timeDecayModel: form.timeDecayModel,
            interestRate: Number(form.interestRate || 4)
          }
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

  const fmtMetric = (
    strategyId: StrategyId,
    metric: "maxProfit" | "maxLoss",
    value: number | string | undefined
  ): string => {
    if (value == null) {
      if (strategyId === "long-call" && metric === "maxProfit") return "Ilimitado";
      if (strategyId === "short-call" && metric === "maxLoss") return "Ilimitado";
    }
    return fmtResult(value);
  };

  const calculateNetPremium = (form: StrategyForm): number => {
    return Number(form.premium || 0) * Number(form.quantity || 1) * 100;
  };

  return (
    <div style={{ padding: "var(--space-sm)", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      <datalist id="strategy-ticker-options">
        {instruments.map((instrument) => (
          <option
            key={`${instrument.category}-${instrument.symbol}`}
            value={instrument.symbol}
            label={`${instrument.name} (${instrument.category})`}
          />
        ))}
      </datalist>
      {STRATEGIES.map((strategy) => {
        const isExpanded = expandedId === strategy.id;
        const isSelected = selectedOptionsStrategy?.id === strategy.id;
        const form = getForm(strategy.id);
        const result = results[strategy.id];
        const isLoading = loadingId === strategy.id;
        const isQuoteLoading = quoteLoadingId === strategy.id;
        const errorMsg = errors[strategy.id];

        return (
          <div
            key={strategy.id}
            style={{
              background: "var(--color-surface-raised)",
              border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-border)"}`,
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
                      list="strategy-ticker-options"
                      value={form.ticker}
                      onChange={(e) => setTickerField(strategy.id, e.target.value)}
                      onBlur={() => void fetchQuote(strategy.id)}
                      placeholder="Selecciona ticker"
                      style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Precio actual $</span>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <input
                        type="number"
                        value={form.currentPrice}
                        onChange={(e) => setFormField(strategy.id, "currentPrice", e.target.value)}
                        placeholder="Auto"
                        style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem", minWidth: 0, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => void fetchQuote(strategy.id)}
                        disabled={isQuoteLoading}
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.2rem 0.35rem",
                          borderRadius: "var(--radius-xs)",
                          border: "1px solid var(--color-border)",
                          background: "var(--color-bg)",
                          color: "var(--color-text)",
                          cursor: isQuoteLoading ? "not-allowed" : "pointer"
                        }}
                      >
                        {isQuoteLoading ? "..." : "Auto"}
                      </button>
                    </div>
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
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {strategy.id.startsWith("long") ? "Prima pagada $" : "Prima recibida $"}
                    </span>
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
                      min="1"
                      step="1"
                      value={form.quantity}
                      onChange={(e) => setFormField(strategy.id, "quantity", e.target.value)}
                      placeholder="1"
                      style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Expiración</span>
                    <input
                      type="date"
                      value={form.expirationDate}
                      onChange={(e) => setFormField(strategy.id, "expirationDate", e.target.value)}
                      style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Capital $</span>
                    <input
                      type="number"
                      value={form.availableCapital}
                      onChange={(e) => setFormField(strategy.id, "availableCapital", e.target.value)}
                      placeholder="10000"
                      style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                    />
                  </label>
                </div>

                <details style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-xs)", padding: "0.35rem 0.45rem" }}>
                  <summary style={{ cursor: "pointer", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", fontWeight: 700, textTransform: "uppercase" }}>
                    Supuestos avanzados
                  </summary>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", marginTop: "0.4rem" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vol. implícita %</span>
                      <input
                        type="number"
                        value={form.impliedVolatility}
                        onChange={(e) => setFormField(strategy.id, "impliedVolatility", e.target.value)}
                        placeholder="25"
                        style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Theta decay</span>
                      <select
                        value={form.timeDecayModel}
                        onChange={(e) => setFormField(strategy.id, "timeDecayModel", e.target.value as StrategyForm["timeDecayModel"])}
                        style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                      >
                        <option value="LINEAR">LINEAR</option>
                        <option value="EXPONENTIAL">EXPONENTIAL</option>
                      </select>
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tasa interés %</span>
                      <input
                        type="number"
                        value={form.interestRate}
                        onChange={(e) => setFormField(strategy.id, "interestRate", e.target.value)}
                        placeholder="4"
                        style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                      />
                    </label>
                  </div>
                </details>

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
                      ["Max. Profit", fmtMetric(strategy.id, "maxProfit", result.strategy.maxProfit)],
                      ["Max. Loss", fmtMetric(strategy.id, "maxLoss", result.strategy.maxLoss)],
                      ["Breakeven", fmtResult(result.strategy.breakEven ?? result.strategy.breakeven)],
                      ["Prima neta", fmtResult(result.strategy.netPremium ?? calculateNetPremium(form))],
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
