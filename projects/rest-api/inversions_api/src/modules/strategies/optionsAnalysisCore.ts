import type { OptionStrategyOutput } from "./optionsStrategyContract";

export type StrategyKey = "LONG_CALL" | "LONG_PUT" | "SHORT_CALL" | "SHORT_PUT";

export interface StrategiesSnapshot {
  longCall: OptionStrategyOutput;
  longPut: OptionStrategyOutput;
  shortCall: OptionStrategyOutput;
  shortPut: OptionStrategyOutput;
}

export interface DashboardContext {
  verdict?: unknown;
  score?: number;
  trend?: string;
}

export interface OptionsQARequest {
  ticker: string;
  question: string;
  strategies: StrategiesSnapshot;
  selectedStrategy?: StrategyKey;
  currentPrice: number;
  dashboardContext?: DashboardContext;
}

export interface OptionsQAResponse {
  ticker: string;
  intent: "comparison" | "risk" | "breakeven" | "general";
  strategyFocus?: StrategyKey;
  answer: string;
  highlights: string[];
  generatedAt: string;
}

const STRATEGY_ACCESSORS: Record<StrategyKey, keyof StrategiesSnapshot> = {
  LONG_CALL: "longCall",
  LONG_PUT: "longPut",
  SHORT_CALL: "shortCall",
  SHORT_PUT: "shortPut"
};

function detectIntent(question: string): OptionsQAResponse["intent"] {
  const q = question.toLowerCase();
  if (q.includes("riesgo") || q.includes("loss") || q.includes("perdida")) return "risk";
  if (q.includes("break") || q.includes("equilibrio")) return "breakeven";
  if (q.includes("compar") || q.includes("mejor")) return "comparison";
  return "general";
}

function money(value: number): string {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : "Ilimitado";
}

export function generateOptionsAnswer(request: OptionsQARequest): OptionsQAResponse {
  const intent = detectIntent(request.question);
  const focusKey = request.selectedStrategy;
  const focus = focusKey ? request.strategies[STRATEGY_ACCESSORS[focusKey]] : undefined;
  const candidates = Object.entries(STRATEGY_ACCESSORS).map(([key, prop]) => ({
    key: key as StrategyKey,
    strategy: request.strategies[prop]
  }));
  const bestRiskAdjusted = [...candidates].sort(
    (a, b) => b.strategy.riskAdjustedReturn - a.strategy.riskAdjustedReturn
  )[0];

  const target = focus ?? bestRiskAdjusted.strategy;
  const strategyName = focusKey ?? bestRiskAdjusted.key;
  const answer =
    intent === "risk"
      ? `${strategyName} en ${request.ticker} tiene perdida maxima ${money(target.maxLoss)} y margen requerido ${money(target.requiredMargin)}.`
      : intent === "breakeven"
      ? `${strategyName} alcanza break-even cerca de ${money(target.breakEvenPrice)}.`
      : `${strategyName} es la referencia principal para ${request.ticker} con retorno ajustado por riesgo ${target.riskAdjustedReturn.toFixed(2)}.`;

  return {
    ticker: request.ticker,
    intent,
    strategyFocus: strategyName,
    answer,
    highlights: [
      `Precio actual: ${money(request.currentPrice)}`,
      `Max profit: ${money(target.maxProfit)}`,
      `Probabilidad ITM: ${(target.probabilityItm * 100).toFixed(1)}%`
    ],
    generatedAt: new Date().toISOString()
  };
}
