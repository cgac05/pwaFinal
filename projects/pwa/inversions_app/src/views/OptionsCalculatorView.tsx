// FIC: StrategiesView ÔÇö options strategy calculator cards (Short Put, Long Put, Short Call, Long Call).
// FIC: StrategiesView ÔÇö cards de calculadora de estrategias de opciones (Short Put, Long Put, Short Call, Long Call).

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Shield, ArrowDown } from "lucide-react";
import { useSignalStore } from "../store/signals";
import { useAppShellStore } from "../store/appShell";

type StrategyId = "short-put" | "long-put" | "short-call" | "long-call" | "calendar-spread" | "diagonal-spread";
type StrategyName = "Short Put" | "Long Put" | "Short Call" | "Long Call" | "Calendar Spread" | "Diagonal Spread";

interface StrategyConfig {
  id: StrategyId;
  name: StrategyName;
  icon: React.ReactNode;
  description: string;
  riskProfile: "limited" | "unlimited";
  sentiment: "bullish" | "bearish" | "neutral";
  endpoint: string;
  strategyKind?: "single-leg" | "term-spread";
}

const STRATEGIES: StrategyConfig[] = [
  {
    id: "short-put",
    name: "Short Put",
    icon: <ArrowDown size={16} />,
    description: "Venta de put. Obligaci+¦n de comprar al strike. Profit = prima cobrada.",
    riskProfile: "limited",
    sentiment: "bullish",
    endpoint: "/api/team-03/options/calculate",
    strategyKind: "single-leg",
  },
  {
    id: "long-put",
    name: "Long Put",
    icon: <TrendingDown size={16} />,
    description: "Compra de put. Derecho a vender al strike. Protecci+¦n ante ca+¡das.",
    riskProfile: "limited",
    sentiment: "bearish",
    endpoint: "/api/team-03/options/calculate",
    strategyKind: "single-leg",
  },
  {
    id: "short-call",
    name: "Short Call",
    icon: <TrendingUp size={16} />,
    description: "Venta de call. Obligaci+¦n de vender al strike. Ingreso de prima.",
    riskProfile: "unlimited",
    sentiment: "bearish",
    endpoint: "/api/team-03/options/calculate",
    strategyKind: "single-leg",
  },
  {
    id: "long-call",
    name: "Long Call",
    icon: <Shield size={16} />,
    description: "Compra de call. Derecho a comprar al strike. Apalancamiento alcista.",
    riskProfile: "limited",
    sentiment: "bullish",
    endpoint: "/api/team-03/options/calculate",
    strategyKind: "single-leg",
  },
  {
    id: "calendar-spread",
    name: "Calendar Spread",
    icon: <Shield size={16} />,
    description: "Estructura temporal: misma strike, expiraci+¦n corta vendida y expiraci+¦n larga comprada.",
    riskProfile: "limited",
    sentiment: "neutral",
    endpoint: "/api/v1/strategies/term/calendar",
    strategyKind: "term-spread",
  },
  {
    id: "diagonal-spread",
    name: "Diagonal Spread",
    icon: <TrendingUp size={16} />,
    description: "Estructura temporal con strikes y expiraciones diferentes para sesgo direccional.",
    riskProfile: "limited",
    sentiment: "neutral",
    endpoint: "/api/v1/strategies/term/diagonal",
    strategyKind: "term-spread",
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
  optionStyle: "call" | "put";
  longStrikePrice: string;
  longPremium: string;
  longExpirationDate: string;
  riskFreeRate: string;
  shortIv: string;
  longIv: string;
}

interface StrategyResult {
  strategy?: {
    maxProfit?: number | string;
    maxLoss?: number | string;
    breakEven?: number | string;
    breakeven?: number | string;
    netPremium?: number | string;
  };
  term?: any;
}

interface MarketQuoteResponse {
  quotes: Array<{
    symbol: string;
    price: number;
  }>;
}

interface FundamentalProfileResponse {
  metrics?: {
    volatility?: number;
  };
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
  const { selectedOptionsStrategy, setSelectedInstrument, setSelectedOptionsStrategy, setOptionsStrategyParams } = useSignalStore();
  const { setAnalysisCategory } = useAppShellStore();
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
      setAnalysisCategory("technical");
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
      interestRate: "4",
      optionStyle: "call",
      longStrikePrice: "",
      longPremium: "",
      longExpirationDate: "",
      riskFreeRate: "0.05",
      shortIv: "0.25",
      longIv: "0.30"
    };

  const setFormField = (id: string, field: keyof StrategyForm, value: string) => {
    setForms((prev) => ({ ...prev, [id]: { ...getForm(id), [field]: value } }));
  };

  const setActiveTickerContext = (ticker: string) => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    const instrument = instruments.find((item) => item.symbol === symbol);
    setSelectedInstrument({
      symbol,
      name: instrument?.name,
      category: instrument?.category ?? "options"
    });
  };

  const setTickerField = (id: string, value: string) => {
    const ticker = value.toUpperCase();
    setActiveTickerContext(ticker);
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

    setActiveTickerContext(ticker);
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
        throw new Error("La API no devolvi+¦ precio para ese ticker.");
      }

      let volatilityEstimate = "";
      try {
        const fundamentalRes = await fetch(`/api/team-03/fundamental/${encodeURIComponent(ticker)}`);
        if (fundamentalRes.ok) {
          const fundamentalData = (await fundamentalRes.json()) as FundamentalProfileResponse;
          const volatility = fundamentalData.metrics?.volatility;
          if (typeof volatility === "number" && Number.isFinite(volatility) && volatility > 0) {
            volatilityEstimate = volatility.toFixed(2);
          }
        }
      } catch {
        // Keep the user's current volatility assumption when fundamentals are unavailable.
      }

      setForms((prev) => {
        const nextForm = prev[id] ?? getForm(id);
        return {
          ...prev,
          [id]: {
            ...nextForm,
            ticker,
            currentPrice: quote.price.toFixed(2),
            strikePrice: Math.round(quote.price).toString(),
            impliedVolatility: volatilityEstimate || nextForm.impliedVolatility
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


  const isTermSpread = (strategy: StrategyConfig): boolean => strategy.strategyKind === "term-spread";

  const parsePositiveNumber = (value: string): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const formatApiError = (payload: any, fallback: string): string => {
    if (Array.isArray(payload?.details) && payload.details.length > 0) {
      return payload.details
        .map((detail: any) => detail?.message ?? String(detail))
        .join(" ");
    }
    return payload?.error ?? fallback;
  };

  const validateTermSpreadForm = (strategy: StrategyConfig, form: StrategyForm): string | null => {
    const longStrike = strategy.id === "calendar-spread" ? form.strikePrice : form.longStrikePrice;
    const requiredFields = [
      [form.ticker.trim(), "ticker"],
      [form.strikePrice, "strike corto"],
      [longStrike, strategy.id === "calendar-spread" ? "strike comun" : "strike largo"],
      [form.premium, "prima corta"],
      [form.longPremium, "prima larga"],
      [form.quantity, "cantidad"],
      [form.expirationDate, "expiracion corta"],
      [form.longExpirationDate, "expiracion larga"],
    ];
    const missing = requiredFields.find(([value]) => !String(value).trim());
    if (missing) {
      return `Falta capturar ${missing[1]}.`;
    }

    if (!parsePositiveNumber(form.strikePrice)) return "El strike corto debe ser mayor a 0.";
    if (!parsePositiveNumber(longStrike)) return strategy.id === "calendar-spread" ? "El strike comun debe ser mayor a 0." : "El strike largo debe ser mayor a 0.";
    if (!parsePositiveNumber(form.premium)) return "La prima corta debe ser mayor a 0.";
    if (!parsePositiveNumber(form.longPremium)) return "La prima larga debe ser mayor a 0.";
    if (!parsePositiveNumber(form.quantity)) return "La cantidad de contratos debe ser mayor a 0.";

    const shortExpiration = new Date(form.expirationDate).getTime();
    const longExpiration = new Date(form.longExpirationDate).getTime();
    if (!Number.isFinite(shortExpiration)) return "La expiracion corta no tiene un formato valido.";
    if (!Number.isFinite(longExpiration)) return "La expiracion larga no tiene un formato valido.";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (shortExpiration < today.getTime()) return "La expiracion corta no puede estar en el pasado.";
    if (longExpiration <= shortExpiration) return "La expiracion larga debe ser posterior a la expiracion corta.";
    if ((longExpiration - shortExpiration) / 86_400_000 < 7) return "La expiracion larga debe estar al menos 7 dias despues de la corta.";

    return null;
  };

  const calculateTermSpread = async (strategy: StrategyConfig, form: StrategyForm) => {
    const validationError = validateTermSpreadForm(strategy, form);
    if (validationError) {
      setErrors((prev) => ({ ...prev, [strategy.id]: validationError }));
      return;
    }

    const longStrike = strategy.id === "calendar-spread" ? form.strikePrice : form.longStrikePrice;
    const shortStrikeValue = Number(form.strikePrice);
    const longStrikeValue = Number(longStrike);
    const shortPremiumValue = Number(form.premium);
    const longPremiumValue = Number(form.longPremium);
    const contractsValue = Number(form.quantity || 1);

    setLoadingId(strategy.id);
    setErrors((prev) => ({ ...prev, [strategy.id]: "" }));

    try {
      const optionStyle = form.optionStyle;
      const endpoint = `${strategy.endpoint}/${optionStyle}`;
      const body = {
        underlying: form.ticker.toUpperCase(),
        riskFreeRate: Number(form.riskFreeRate || 0.05),
        ivCurve: [
          { dte: 30, iv: Number(form.shortIv || 0.25) },
          { dte: 90, iv: Number(form.longIv || 0.30) }
        ],
        legs: [
          {
            strike: shortStrikeValue,
            expiration: form.expirationDate,
            premium: shortPremiumValue,
            contracts: contractsValue,
            optionStyle
          },
          {
            strike: longStrikeValue,
            expiration: form.longExpirationDate,
            premium: longPremiumValue,
            contracts: contractsValue,
            optionStyle
          }
        ]
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(formatApiError(err, "term_strategy_failed"));
      }

      const data = await res.json();
      setResults((prev) => ({ ...prev, [strategy.id]: { term: data } }));
      setOptionsStrategyParams({
        ticker: form.ticker.toUpperCase(),
        strikePrice: Number(form.strikePrice),
        currentPrice: Number(form.currentPrice || form.strikePrice),
        premiumPerContract: Number(form.premium),
        numberOfContracts: Number(form.quantity || 1),
        expirationDate: form.expirationDate,
        availableCapital: Number(form.availableCapital || 0),
        assumptions: {
          impliedVolatility: Number(form.shortIv || 0.25) * 100,
          timeDecayModel: form.timeDecayModel,
          interestRate: Number(form.riskFreeRate || 0.05) * 100,
        },
      });
    } catch (err) {
      setErrors((prev) => ({ ...prev, [strategy.id]: err instanceof Error ? err.message : "Error al calcular estrategia temporal." }));
    } finally {
      setLoadingId(null);
    }
  };

  const calculate = async (strategy: StrategyConfig) => {
    setSelectedOptionsStrategy({ id: strategy.id, name: strategy.name });
    const form = getForm(strategy.id);
    if (form.ticker.trim()) {
      setActiveTickerContext(form.ticker);
    }
    if (isTermSpread(strategy)) {
      await calculateTermSpread(strategy, form);
      return;
    }
    if (!form.strikePrice || !form.premium || !form.quantity || !form.expirationDate || !form.availableCapital) {
      setErrors((prev) => ({ ...prev, [strategy.id]: "Strike, prima, contratos, expiraci+¦n y capital son requeridos." }));
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
      setOptionsStrategyParams({
        ticker: form.ticker.toUpperCase(),
        strikePrice: Number(form.strikePrice),
        currentPrice: Number(form.currentPrice || form.strikePrice),
        premiumPerContract: Number(form.premium),
        numberOfContracts: Number(form.quantity || 1),
        expirationDate: form.expirationDate,
        availableCapital: Number(form.availableCapital),
        assumptions: {
          impliedVolatility: Number(form.impliedVolatility || 25),
          timeDecayModel: form.timeDecayModel,
          interestRate: Number(form.interestRate || 4),
        },
      });
    } catch (err) {
      setErrors((prev) => ({ ...prev, [strategy.id]: err instanceof Error ? err.message : "Error al calcular." }));
    } finally {
      setLoadingId(null);
    }
  };

  const sentimentColor = (s: StrategyConfig["sentiment"]) =>
    s === "bullish" ? "var(--color-buy)" : s === "bearish" ? "var(--color-sell)" : "var(--color-accent)";

  const fmtNumber = (value: unknown, digits = 2): string => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : "ÔÇö";
  };

  

  const fmtResult = (v: number | string | undefined): string => {
    if (v == null) return "ÔÇö";
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
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{isTermSpread(strategy) ? "Strike corto $" : "Strike $"}</span>
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
                      {isTermSpread(strategy) ? "Prima corta $" : strategy.id.startsWith("long") ? "Prima pagada $" : "Prima recibida $"}
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
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{isTermSpread(strategy) ? "Exp. corta" : "Expiraci+¦n"}</span>
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

                {isTermSpread(strategy) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tipo</span>
                      <select value={form.optionStyle} onChange={(e) => setFormField(strategy.id, "optionStyle", e.target.value)} style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}>
                        <option value="call">Call</option>
                        <option value="put">Put</option>
                      </select>
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Strike largo $</span>
                      <input type="number" value={strategy.id === "calendar-spread" ? form.strikePrice : form.longStrikePrice} disabled={strategy.id === "calendar-spread"} onChange={(e) => setFormField(strategy.id, "longStrikePrice", e.target.value)} placeholder={strategy.id === "calendar-spread" ? "Mismo strike" : "105"} style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem", opacity: strategy.id === "calendar-spread" ? 0.75 : 1 }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Prima larga $</span>
                      <input type="number" value={form.longPremium} onChange={(e) => setFormField(strategy.id, "longPremium", e.target.value)} placeholder="5.00" style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Exp. larga</span>
                      <input type="date" value={form.longExpirationDate} onChange={(e) => setFormField(strategy.id, "longExpirationDate", e.target.value)} style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }} />
                    </label>
                  </div>
                )}

                <details style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-xs)", padding: "0.35rem 0.45rem" }}>
                  <summary style={{ cursor: "pointer", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", fontWeight: 700, textTransform: "uppercase" }}>
                    Supuestos avanzados
                  </summary>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", marginTop: "0.4rem" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vol. impl+¡cita/est. %</span>
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
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tasa inter+®s %</span>
                      <input
                        type="number"
                        value={isTermSpread(strategy) ? form.riskFreeRate : form.interestRate}
                        onChange={(e) => setFormField(strategy.id, isTermSpread(strategy) ? "riskFreeRate" : "interestRate", e.target.value)}
                        placeholder={isTermSpread(strategy) ? "0.05" : "4"}
                        style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }}
                      />
                    </label>
                    {isTermSpread(strategy) && (
                      <>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                          <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>IV corta</span>
                          <input type="number" value={form.shortIv} onChange={(e) => setFormField(strategy.id, "shortIv", e.target.value)} placeholder="0.25" style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }} />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "var(--font-size-xs)" }}>
                          <span style={{ color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>IV larga</span>
                          <input type="number" value={form.longIv} onChange={(e) => setFormField(strategy.id, "longIv", e.target.value)} placeholder="0.30" style={{ fontSize: "var(--font-size-xs)", padding: "0.2rem 0.4rem" }} />
                        </label>
                      </>
                    )}
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
                  {isLoading ? "CalculandoÔÇª" : "ÔûÂ Calcular"}
                </button>

                {errorMsg && (
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-sell)", margin: 0 }}>{errorMsg}</p>
                )}

                {result?.term && (
                  <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.25rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem" }}>
                      {[
                        ["Estructura", result.term.structureName ?? result.term.strategy],
                        ["Variante", String(result.term.variant ?? form.optionStyle).toUpperCase()],
                        ["Theta neta", fmtNumber(result.term.analysis?.netTheta ?? result.term.analysis?.greeks?.theta)],
                        ["Vega neta", fmtNumber(result.term.analysis?.greeks?.vega ?? result.term.report?.riskMetrics?.netVega)],
                        ["Delta", fmtNumber(result.term.analysis?.greeks?.delta ?? result.term.report?.riskMetrics?.netDelta, 3)],
                        ["Gamma", fmtNumber(result.term.analysis?.greeks?.gamma ?? result.term.report?.riskMetrics?.netGamma, 3)],
                        ["DTE corto", result.term.analysis?.shortDte ?? "ÔÇö"],
                        ["DTE largo", result.term.analysis?.longDte ?? "ÔÇö"],
                        ["PoP", result.term.report?.riskMetrics?.probabilityOfProfit != null ? `${fmtNumber(result.term.report.riskMetrics.probabilityOfProfit * 100, 1)}%` : "ÔÇö"],
                        ["Stress peor", fmtResult(result.term.report?.riskMetrics?.stressTestMaxLoss)],
                      ].map(([label, value]) => (
                        <div key={label} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-xs)", padding: "0.25rem 0.4rem" }}>
                          <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                          <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 800, color: "var(--color-text)" }}>{String(value)}</div>
                        </div>
                      ))}
                    </div>
                    {Array.isArray(result.term.report?.stressTests) && result.term.report.stressTests.length > 0 && (
                      <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-xs)", padding: "0.35rem 0.45rem" }}>
                        <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.25rem" }}>Stress tests</div>
                        {result.term.report.stressTests.slice(0, 3).map((stress: any) => (
                          <div key={stress.label} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.7rem" }}>
                            <span>{stress.label}</span>
                            <strong>{fmtResult(stress.pnl)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
