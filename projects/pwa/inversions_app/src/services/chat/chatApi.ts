// FIC: Chat API service — sends questions to POST /api/chat/explain with instrument context and 15s timeout.
// FIC: Servicio de API de chat — envía preguntas a POST /api/chat/explain con contexto del instrumento y timeout de 15s.

import { getAuthHeaders } from "../signals/signalApi";

export interface ChatRequest {
  symbol: string;
  timeframe: string;
  question: string;
  context?: string;
}

export interface ChatResponse {
  explanation: string;
  model?: string;
  cached?: boolean;
}

/** Contexto del dashboard para enriquecer análisis de opciones / Dashboard context to enrich options analysis */
export interface OptionsAnalysisDashboardContext {
  fundamental?: {
    verdict: "VIABLE" | "NEUTRAL" | "NOT_VIABLE";
    overallScore: number;
    recommendation: string;
    source?: string;
    sector?: string;
    industry?: string;
    marketCap?: number;
    pe?: number;
    pb?: number;
    ps?: number;
    roe?: number;
    debtToEquity?: number;
    eps?: number;
    epsGrowth?: number;
    dividendYield?: number;
    revenueGrowth?: number;
    volatility?: number;
    beta?: number;
    change52w?: number;
  };
  confluence?: {
    callCount: number;
    putCount: number;
    holdCount: number;
    avgScore: number;
    dominantTrend: "ALCISTA" | "BAJISTA" | "LATERAL";
    topSignals: Array<{
      core: string;
      subCore?: string;
      tipoSenal: "CALL" | "PUT" | "HOLD";
      score: number;
      observacionSummary: string;
    }>;
  };
  ohlc?: {
    timeframe: string;
    lastClose: number;
    recentTrend: "ALCISTA" | "BAJISTA" | "LATERAL";
  };
}

export interface OptionsAnalysisQARequest {
  ticker: string;
  question: string;
  selectedStrategy?: string;
  strikePrice: number;
  currentPrice: number;
  premiumPerContract: number;
  numberOfContracts: number;
  expirationDate: string;
  availableCapital: number;
  assumptions?: {
    impliedVolatility?: number;
    timeDecayModel?: "LINEAR" | "EXPONENTIAL";
    interestRate?: number;
  };
  /** Contexto estructurado del dashboard para análisis determinístico enriquecido */
  dashboardContext?: OptionsAnalysisDashboardContext;
}

export interface OptionsAnalysisQAResponse {
  answer: string;
  intent: string;
  strategyFocus?: string;
  disclaimer: string;
}

export interface FundamentalCopilotRequest {
  ticker: string;
  question: string;
  strategy?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface FundamentalCopilotResponse {
  answer: string;
  disclaimer: string;
  sourceContext: string[];
  reasoningTrace: string[];
}

const TIMEOUT_MS = 15_000;

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  let signal: AbortSignal | undefined;
  try {
    signal = AbortSignal.timeout(TIMEOUT_MS);
  } catch {
    // FIC: AbortSignal.timeout not supported in all environments — proceed without timeout.
    // FIC: AbortSignal.timeout no soportado en todos los entornos — proceder sin timeout.
  }

  const res = await fetch("/api/chat/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(req),
    signal,
  }).catch((err: unknown) => {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("El asistente tardó demasiado. Intenta de nuevo.");
    }
    throw new Error("Error de red. Verifica tu conexión.");
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? "Solicitud inválida. Verifica símbolo y pregunta.");
  }
  if (res.status === 404) {
    throw new Error("No hay datos disponibles para este instrumento.");
  }
  if (res.status === 429) {
    throw new Error("Límite de consultas alcanzado. Intenta en 1 minuto.");
  }
  if (!res.ok) {
    throw new Error("El asistente no está disponible. Intenta de nuevo.");
  }

  return res.json() as Promise<ChatResponse>;
}

export async function sendOptionsAnalysisQA(req: OptionsAnalysisQARequest): Promise<OptionsAnalysisQAResponse> {
  let signal: AbortSignal | undefined;
  try {
    signal = AbortSignal.timeout(20_000);
  } catch {
    // AbortSignal.timeout not supported in all environments.
  }

  const res = await fetch("/api/team-03/options/analysis-qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  }).catch((err: unknown) => {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("El análisis de opciones tardó demasiado. Intenta de nuevo.");
    }
    throw new Error("Error de red. Verifica tu conexión.");
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Error al analizar opciones (HTTP ${res.status}).`);
  }

  return res.json() as Promise<OptionsAnalysisQAResponse>;
}

export async function sendFundamentalCopilotMessage(req: FundamentalCopilotRequest): Promise<FundamentalCopilotResponse> {
  let signal: AbortSignal | undefined;
  try {
    signal = AbortSignal.timeout(30_000);
  } catch {
    // AbortSignal.timeout not supported in all environments.
  }

  const res = await fetch("/api/team-03/ai/fundamental/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  }).catch((err: unknown) => {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("El copilot tardó demasiado. Intenta de nuevo.");
    }
    throw new Error("Error de red. Verifica tu conexión.");
  });

  if (!res.ok) {
    throw new Error(`El copilot fundamental no está disponible (HTTP ${res.status}).`);
  }

  return res.json() as Promise<FundamentalCopilotResponse>;
}
