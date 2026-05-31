import React, { useEffect, useMemo, useState } from "react";
import { Play, Shield } from "lucide-react";
import { ContentModal } from "../../../components/ui/ContentModal";
import { getMarketQuotes } from "../../../services/signals/marketApi";
import { useSignalStore } from "../../../store/signals";
import { postOptionsCalculate, type OptionStrategyResult } from "../../../services/fundamental/fundamentalApi";

export type CoreOptionStrategy = "LONG_CALL" | "LONG_PUT" | "SHORT_CALL" | "SHORT_PUT";

interface Props {
  open: boolean;
  strategy: CoreOptionStrategy;
  ticker: string;
  onClose: () => void;
  onCalculated?: (analysis: OptionStrategyAnalysis) => void;
}

export interface OptionStrategyFormState {
  ticker: string;
  currentPrice: string;
  strikePrice: string;
  premium: string;
  contracts: string;
  expiration: string;
  capital: string;
  impliedVolatility: string;
  thetaDecay: "LINEAR" | "EXPONENTIAL";
  riskFreeRate: string;
}

export interface StrategyResult {
  maxProfit: number | "Ilimitado";
  maxLoss: number | "Ilimitado";
  breakeven: number;
  netPremium: number;
  requiredMargin: number;
  scenarioAtm: number;
  scenarioPlus5: number;
  scenarioMinus5: number;
}

export interface OptionStrategyAnalysis {
  strategy: CoreOptionStrategy;
  ticker: string;
  params: OptionStrategyFormState;
  result: StrategyResult;
  payoffPoints: Array<{ underlyingPrice: number; pnl: number }>;
  calculatedAt: string;
}

const STRATEGY_COPY: Record<CoreOptionStrategy, {
  title: string;
  optionType: "CALL" | "PUT";
  direction: "LONG" | "SHORT";
  description: string;
  risk: "limitado" | "ilimitado";
  bias: "bullish" | "bearish";
  premiumLabel: string;
}> = {
  LONG_CALL: {
    title: "Long Call",
    optionType: "CALL",
    direction: "LONG",
    description: "Compra de call. Derecho a comprar al strike.",
    risk: "limitado",
    bias: "bullish",
    premiumLabel: "Prima pagada $",
  },
  LONG_PUT: {
    title: "Long Put",
    optionType: "PUT",
    direction: "LONG",
    description: "Compra de put. Derecho a vender al strike.",
    risk: "limitado",
    bias: "bearish",
    premiumLabel: "Prima pagada $",
  },
  SHORT_CALL: {
    title: "Short Call",
    optionType: "CALL",
    direction: "SHORT",
    description: "Venta de call. Recibes prima, pero asumes riesgo si el precio sube.",
    risk: "ilimitado",
    bias: "bearish",
    premiumLabel: "Prima recibida $",
  },
  SHORT_PUT: {
    title: "Short Put",
    optionType: "PUT",
    direction: "SHORT",
    description: "Venta de put. Recibes prima, pero puedes ser asignado si el precio cae.",
    risk: "limitado",
    bias: "bullish",
    premiumLabel: "Prima recibida $",
  },
};

const OPTION_STRATEGY_OPTIONS: Array<{ value: CoreOptionStrategy; label: string }> = [
  { value: "LONG_CALL", label: "LONG CALL" },
  { value: "LONG_PUT", label: "LONG PUT" },
  { value: "SHORT_CALL", label: "SHORT CALL" },
  { value: "SHORT_PUT", label: "SHORT PUT" },
];

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ivToPercent(iv: number | undefined): string | undefined {
  if (typeof iv !== "number" || !Number.isFinite(iv) || iv <= 0) return undefined;
  const percent = iv <= 1 ? iv * 100 : iv;
  return Number(percent.toFixed(2)).toString();
}

function toFiniteMoney(value: number | "Ilimitado"): number | null {
  return value === "Ilimitado" ? null : value;
}

function formatMoney(value: number | "Ilimitado"): string {
  return value === "Ilimitado" ? value : `$${value.toFixed(2)}`;
}

function payoff(
  strategy: CoreOptionStrategy,
  priceAtExpiration: number,
  strike: number,
  premium: number,
  contracts: number
): number {
  const multiplier = contracts * 100;
  const callIntrinsic = Math.max(priceAtExpiration - strike, 0) * multiplier;
  const putIntrinsic = Math.max(strike - priceAtExpiration, 0) * multiplier;
  const totalPremium = premium * multiplier;

  if (strategy === "LONG_CALL") return callIntrinsic - totalPremium;
  if (strategy === "LONG_PUT") return putIntrinsic - totalPremium;
  if (strategy === "SHORT_CALL") return totalPremium - callIntrinsic;
  return totalPremium - putIntrinsic;
}

function resultFromApi(result: OptionStrategyResult): StrategyResult {
  const netPremium = result.premium * result.quantity * 100;
  return {
    maxProfit: result.maxProfit === null ? "Ilimitado" : result.maxProfit,
    maxLoss: result.maxLoss === null ? "Ilimitado" : result.maxLoss,
    breakeven: result.breakEvenPrice,
    netPremium,
    requiredMargin: result.requiredMargin,
    scenarioAtm: result.scenarioAtm.profitLoss,
    scenarioPlus5: result.scenarioPlus5.profitLoss,
    scenarioMinus5: result.scenarioMinus5.profitLoss,
  };
}

function formFromApi(currentForm: OptionStrategyFormState, result: OptionStrategyResult): OptionStrategyFormState {
  return {
    ...currentForm,
    currentPrice: result.scenarioAtm.priceAtScenario.toFixed(2),
    premium: result.premium.toString(),
    contracts: result.quantity.toString(),
    impliedVolatility:
      typeof result.assumptions.impliedVolatility === "number"
        ? Number(result.assumptions.impliedVolatility.toFixed(2)).toString()
        : currentForm.impliedVolatility,
  };
}

function buildPayoffPoints(strategy: CoreOptionStrategy, form: OptionStrategyFormState): Array<{ underlyingPrice: number; pnl: number }> {
  const current = Math.max(toNumber(form.currentPrice), 1);
  const strike = toNumber(form.strikePrice);
  const premium = toNumber(form.premium);
  const contracts = Math.max(1, toNumber(form.contracts));
  const min = Math.max(0.01, current * 0.7);
  const max = current * 1.3;
  const steps = 24;

  return Array.from({ length: steps + 1 }, (_, index) => {
    const underlyingPrice = min + ((max - min) * index) / steps;
    return {
      underlyingPrice: Number(underlyingPrice.toFixed(2)),
      pnl: payoff(strategy, underlyingPrice, strike, premium, contracts),
    };
  });
}

export function optionStrategyResultToApiShape(analysis: OptionStrategyAnalysis) {
  const { strategy, params, result, ticker } = analysis;
  const direction = strategy.startsWith("LONG") ? "LONG" : "SHORT";
  const optionType = strategy.endsWith("CALL") ? "CALL" : "PUT";
  const premium = toNumber(params.premium);
  const quantity = Math.max(1, toNumber(params.contracts));

  return {
    ticker,
    optionType,
    direction,
    premium,
    quantity,
    breakEvenPrice: result.breakeven,
    maxProfit: toFiniteMoney(result.maxProfit),
    maxLoss: toFiniteMoney(result.maxLoss),
    requiredMargin: result.requiredMargin,
    scenarioAtm: {
      priceMovement: "ATM",
      priceAtScenario: toNumber(params.currentPrice),
      profitLoss: result.scenarioAtm,
      roi: result.netPremium > 0 ? (result.scenarioAtm / result.netPremium) * 100 : 0,
    },
    scenarioPlus5: {
      priceMovement: "+5%",
      priceAtScenario: toNumber(params.currentPrice) * 1.05,
      profitLoss: result.scenarioPlus5,
      roi: result.netPremium > 0 ? (result.scenarioPlus5 / result.netPremium) * 100 : 0,
    },
    scenarioMinus5: {
      priceMovement: "-5%",
      priceAtScenario: toNumber(params.currentPrice) * 0.95,
      profitLoss: result.scenarioMinus5,
      roi: result.netPremium > 0 ? (result.scenarioMinus5 / result.netPremium) * 100 : 0,
    },
    riskAdjustedReturn: result.netPremium > 0 && typeof result.maxProfit === "number" ? result.maxProfit / result.netPremium : 0,
    probabilityItm: 0,
    warnings: [] as string[],
    calculatedAt: analysis.calculatedAt,
    calculationVersion: "frontend-1.0",
    assumptions: {
      impliedVolatility: toNumber(params.impliedVolatility),
      timeDecayModel: params.thetaDecay,
      interestRate: toNumber(params.riskFreeRate),
    },
  };
}

export function OptionStrategyParamsModal({ open, strategy, ticker, onClose, onCalculated }: Props) {
  const { selectedStrike } = useSignalStore();
  const meta = STRATEGY_COPY[strategy];
  const selectedStrikeMatchesStrategy =
    !!selectedStrike &&
    ((meta.optionType === "CALL" && selectedStrike.type === "call") ||
      (meta.optionType === "PUT" && selectedStrike.type === "put"));
  const [form, setForm] = useState<OptionStrategyFormState>({
    ticker,
    currentPrice: "",
    strikePrice: "100",
    premium: "",
    contracts: "1",
    expiration: isoPlusDays(30),
    capital: "",
    impliedVolatility: "",
    thetaDecay: "LINEAR",
    riskFreeRate: "4",
  });
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setForm((prev) => {
      const nextTicker = ticker.toUpperCase();

      return {
        ...prev,
        ticker: nextTicker,
        currentPrice: selectedStrikeMatchesStrategy && selectedStrike.underlyingPrice && selectedStrike.underlyingPrice > 0
          ? selectedStrike.underlyingPrice.toFixed(2)
          : prev.currentPrice,
        strikePrice: selectedStrikeMatchesStrategy ? String(selectedStrike.strike) : prev.strikePrice,
        premium: selectedStrikeMatchesStrategy && selectedStrike.premium > 0 ? String(selectedStrike.premium) : "",
        expiration: selectedStrikeMatchesStrategy && selectedStrike.expiration ? selectedStrike.expiration : prev.expiration,
        impliedVolatility: selectedStrikeMatchesStrategy ? (ivToPercent(selectedStrike.iv) ?? prev.impliedVolatility) : prev.impliedVolatility,
        riskFreeRate: selectedStrikeMatchesStrategy && typeof selectedStrike.estimatedRiskFreeRate === "number"
          ? Number(selectedStrike.estimatedRiskFreeRate.toFixed(2)).toString()
          : prev.riskFreeRate,
      };
    });
    setResult(null);
  }, [open, ticker, selectedStrike, selectedStrikeMatchesStrategy]);

  useEffect(() => {
    if (!open || !form.ticker) return;

    let cancelled = false;
    setPriceLoading(true);
    setPriceError(null);

    getMarketQuotes([form.ticker])
      .then((data) => {
        if (cancelled) return;
        const quote = data.quotes.find((q) => q.symbol === form.ticker.toUpperCase());
        if (!quote || quote.price <= 0) {
          setPriceError("Precio no disponible");
          return;
        }
        setForm((prev) => ({
          ...prev,
          currentPrice: quote.price.toFixed(2),
          strikePrice: selectedStrikeMatchesStrategy ? prev.strikePrice : quote.price.toFixed(0),
        }));
      })
      .catch(() => {
        if (!cancelled) setPriceError("No se pudo cargar precio");
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, form.ticker, selectedStrikeMatchesStrategy]);

  const canCalculate = useMemo(() => {
    return toNumber(form.strikePrice) > 0 && toNumber(form.contracts) > 0 && !calculating;
  }, [form.strikePrice, form.contracts, calculating]);

  const update = (field: keyof OptionStrategyFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setResult(null);
    setCalculationError(null);
  };

  const calculateAndPublish = async () => {
    setCalculating(true);
    setCalculationError(null);
    try {
      const apiResult = await postOptionsCalculate({
        ticker: form.ticker.toUpperCase(),
        optionType: meta.optionType,
        direction: meta.direction,
        strikePrice: toNumber(form.strikePrice),
        quantity: Math.max(1, toNumber(form.contracts)),
        capitalAvailable: toNumber(form.capital) > 0 ? toNumber(form.capital) : undefined,
        riskTolerance: "MEDIUM",
        assumptions: {
          timeDecayModel: form.thetaDecay,
          interestRate: toNumber(form.riskFreeRate),
        },
      });
      const resolvedForm = formFromApi(form, apiResult);
      const nextResult = resultFromApi(apiResult);
    setResult(nextResult);
    onCalculated?.({
      strategy,
        ticker: resolvedForm.ticker.toUpperCase(),
        params: resolvedForm,
      result: nextResult,
        payoffPoints: buildPayoffPoints(strategy, resolvedForm),
        calculatedAt: apiResult.calculatedAt,
    });
    onClose();
    } catch (error) {
      setCalculationError(error instanceof Error ? error.message : "No se pudo calcular con datos reales");
    } finally {
      setCalculating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--color-surface)",
    color: "var(--color-text)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    padding: "7px 10px",
    fontSize: "var(--font-size-sm)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: 0,
  };

  const labelTextStyle: React.CSSProperties = {
    fontSize: "var(--font-size-xs)",
    color: "var(--color-text-muted)",
    fontWeight: 700,
    textTransform: "uppercase",
  };

  const metricCard = (label: string, value: string) => (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-surface-raised)",
        padding: "var(--space-sm)",
        minHeight: 58,
      }}
    >
      <div style={{ ...labelTextStyle, fontSize: "10px", marginBottom: 4 }}>{label}</div>
      <strong style={{ fontSize: "var(--font-size-sm)" }}>{value}</strong>
    </div>
  );

  return (
    <ContentModal
      isOpen={open}
      onClose={onClose}
      title={meta.title}
      subtitle={meta.description}
      width="520px"
      data-testid="option-strategy-params-modal"
    >
      <div style={{ display: "grid", gap: "var(--space-md)" }}>
        <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center", flexWrap: "wrap" }}>
          <Shield size={16} color="var(--color-buy)" />
          <span style={{ color: "var(--color-accent)", background: "var(--color-accent-subtle)", borderRadius: "var(--radius-pill)", padding: "2px 10px", fontSize: "var(--font-size-xs)", fontWeight: 700 }}>
            Riesgo {meta.risk}
          </span>
          <span style={{ color: meta.bias === "bullish" ? "var(--color-buy)" : "var(--color-sell)", fontSize: "var(--font-size-xs)", fontWeight: 700 }}>
            {meta.bias}
          </span>
          {selectedStrikeMatchesStrategy && (
            <span style={{ color: "var(--color-buy)", background: "rgba(0,168,126,0.12)", borderRadius: "var(--radius-pill)", padding: "2px 10px", fontSize: "var(--font-size-xs)", fontWeight: 700 }}>
              Datos de option chain
            </span>
          )}
          <span style={{ color: "var(--color-buy)", background: "rgba(0,168,126,0.12)", borderRadius: "var(--radius-pill)", padding: "2px 10px", fontSize: "var(--font-size-xs)", fontWeight: 700 }}>
            Calculo backend real
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-sm)" }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Ticker</span>
            <input style={inputStyle} value={form.ticker} onChange={(e) => update("ticker", e.target.value.toUpperCase())} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Precio actual {priceLoading ? "(cargando)" : priceError ? `(${priceError})` : ""}</span>
            <input style={inputStyle} type="number" step="0.01" value={form.currentPrice} onChange={(e) => update("currentPrice", e.target.value)} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Strike $</span>
            <input style={inputStyle} type="number" step="0.01" value={form.strikePrice} onChange={(e) => update("strikePrice", e.target.value)} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>{meta.premiumLabel}</span>
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.premium} onChange={(e) => update("premium", e.target.value)} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Cantidad</span>
            <input style={inputStyle} type="number" min="1" step="1" value={form.contracts} onChange={(e) => update("contracts", e.target.value)} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Expiracion</span>
            <input style={inputStyle} type="date" value={form.expiration} onChange={(e) => update("expiration", e.target.value)} />
          </label>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Capital $</span>
            <input style={inputStyle} type="number" min="0" step="100" value={form.capital} onChange={(e) => update("capital", e.target.value)} />
          </label>
        </div>

        <fieldset style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sm)", padding: "var(--space-sm)", margin: 0 }}>
          <legend style={{ ...labelTextStyle, padding: "0 var(--space-xs)" }}>Supuestos avanzados</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-sm)" }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Vol. implicita %</span>
              <input style={inputStyle} type="number" min="0" step="0.1" value={form.impliedVolatility} onChange={(e) => update("impliedVolatility", e.target.value)} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Theta decay</span>
              <select style={inputStyle} value={form.thetaDecay} onChange={(e) => update("thetaDecay", e.target.value)}>
                <option value="LINEAR">LINEAR</option>
                <option value="EXPONENTIAL">EXPONENTIAL</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Tasa interes %</span>
              <input style={inputStyle} type="number" min="0" step="0.1" value={form.riskFreeRate} onChange={(e) => update("riskFreeRate", e.target.value)} />
            </label>
          </div>
        </fieldset>

        {calculationError && (
          <div style={{ color: "var(--color-sell)", fontSize: "var(--font-size-xs)", fontWeight: 700 }}>
            {calculationError}
          </div>
        )}

        <button
          type="button"
          disabled={!canCalculate}
          onClick={calculateAndPublish}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: canCalculate ? "var(--color-accent)" : "var(--color-surface-raised)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "0.65rem 1rem",
            fontSize: "var(--font-size-sm)",
            fontWeight: 700,
            cursor: canCalculate ? "pointer" : "not-allowed",
          }}
        >
          <Play size={13} fill="currentColor" strokeWidth={0} />
          {calculating ? "Calculando..." : "Calcular con datos reales"}
        </button>
      </div>
    </ContentModal>
  );
}

export { OPTION_STRATEGY_OPTIONS };
