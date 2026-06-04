// FIC: Institutional analysis contract — types, guards, and factory for institutional data. (EN)
// FIC: Contrato de análisis institucional — tipos, guards y factory para datos institucionales. (ES)

/** Supported analysis periods / Períodos de análisis soportados */
export type InstitutionalAnalysisPeriod = "intraday" | "daily" | "weekly" | "monthly" | "quarterly";

/** Supported investment horizons / Horizontes de inversión soportados */
export type InstitutionalHorizon = "short" | "medium" | "long";

/** Supported liquidity levels / Niveles de liquidez soportados */
export type InstitutionalLiquidity = "low" | "medium" | "high";

// FIC: Hardcoded validation constants (EN)
// FIC: Constantes de validación hardcodeadas (ES)
const SUPPORTED_PERIODS: InstitutionalAnalysisPeriod[] = ["intraday", "daily", "weekly", "monthly", "quarterly"];
const SUPPORTED_HORIZONS: InstitutionalHorizon[] = ["short", "medium", "long"];
const SUPPORTED_LIQUIDITY: InstitutionalLiquidity[] = ["low", "medium", "high"];

/** Institutional capital flows snapshot / Snapshot de flujos institucionales */
export interface InstitutionalFlowSnapshot {
  inflows: number;
  outflows: number;
  asOf: string; // ISO timestamp
}

/** Open institutional positions snapshot / Snapshot de posiciones institucionales abiertas */
export interface InstitutionalOpenPositionsSnapshot {
  count: number;
  notional?: number;
}

/** Main contract for all institutional engines / Contrato principal para todos los engines institucionales */
export interface InstitutionalAnalysisContract {
  analysisId: string;
  ticker: string;
  instrument?: string;
  strike?: number;
  period: InstitutionalAnalysisPeriod;
  volume: number;
  liquidity: InstitutionalLiquidity;
  horizon: InstitutionalHorizon;
  /** Percentage of shares held by institutional funds (0–100) */
  fundsOwnershipPct: number;
  flows: InstitutionalFlowSnapshot;
  openPositions: InstitutionalOpenPositionsSnapshot;
  sourceIds?: string[];
  requestedAt: string; // ISO timestamp
}

// FIC: Type guard — non-empty string (EN)
// FIC: Type guard — cadena no vacía (ES)
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// FIC: Type guard — finite number (EN)
// FIC: Type guard — número finito (ES)
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// FIC: Type guard for InstitutionalFlowSnapshot (EN)
// FIC: Type guard para InstitutionalFlowSnapshot (ES)
export function isInstitutionalFlowSnapshot(value: unknown): value is InstitutionalFlowSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return isFiniteNumber(v.inflows) && isFiniteNumber(v.outflows) && isNonEmptyString(v.asOf);
}

// FIC: Type guard for InstitutionalOpenPositionsSnapshot (EN)
// FIC: Type guard para InstitutionalOpenPositionsSnapshot (ES)
export function isInstitutionalOpenPositionsSnapshot(value: unknown): value is InstitutionalOpenPositionsSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return isFiniteNumber(v.count) && (v.notional === undefined || isFiniteNumber(v.notional));
}

// FIC: Type guard for the full InstitutionalAnalysisContract (EN)
// FIC: Type guard para el contrato completo InstitutionalAnalysisContract (ES)
export function isInstitutionalAnalysisContract(value: unknown): value is InstitutionalAnalysisContract {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isNonEmptyString(v.analysisId) &&
    isNonEmptyString(v.ticker) &&
    SUPPORTED_PERIODS.includes(v.period as InstitutionalAnalysisPeriod) &&
    isFiniteNumber(v.volume) &&
    SUPPORTED_LIQUIDITY.includes(v.liquidity as InstitutionalLiquidity) &&
    SUPPORTED_HORIZONS.includes(v.horizon as InstitutionalHorizon) &&
    isFiniteNumber(v.fundsOwnershipPct) &&
    (v.fundsOwnershipPct as number) >= 0 &&
    (v.fundsOwnershipPct as number) <= 100 &&
    isInstitutionalFlowSnapshot(v.flows) &&
    isInstitutionalOpenPositionsSnapshot(v.openPositions) &&
    isNonEmptyString(v.requestedAt)
  );
}

// FIC: Factory — creates a validated InstitutionalAnalysisContract or throws on invalid input (EN)
// FIC: Factory — crea un InstitutionalAnalysisContract validado o lanza error si la entrada es inválida (ES)
export function createInstitutionalAnalysisContract(
  input: Partial<InstitutionalAnalysisContract>
): InstitutionalAnalysisContract {
  const contract: InstitutionalAnalysisContract = {
    analysisId: isNonEmptyString(input.analysisId) ? input.analysisId : crypto.randomUUID(),
    ticker: input.ticker?.toUpperCase() ?? "",
    instrument: input.instrument,
    strike: input.strike,
    period: SUPPORTED_PERIODS.includes(input.period as InstitutionalAnalysisPeriod)
      ? (input.period as InstitutionalAnalysisPeriod)
      : "daily",
    volume: isFiniteNumber(input.volume) ? input.volume : 0,
    liquidity: SUPPORTED_LIQUIDITY.includes(input.liquidity as InstitutionalLiquidity)
      ? (input.liquidity as InstitutionalLiquidity)
      : "medium",
    horizon: SUPPORTED_HORIZONS.includes(input.horizon as InstitutionalHorizon)
      ? (input.horizon as InstitutionalHorizon)
      : "medium",
    fundsOwnershipPct: isFiniteNumber(input.fundsOwnershipPct)
      ? Math.max(0, Math.min(100, input.fundsOwnershipPct))
      : 0,
    flows: isInstitutionalFlowSnapshot(input.flows)
      ? input.flows
      : { inflows: 0, outflows: 0, asOf: new Date().toISOString() },
    openPositions: isInstitutionalOpenPositionsSnapshot(input.openPositions)
      ? input.openPositions
      : { count: 0 },
    sourceIds: Array.isArray(input.sourceIds) ? input.sourceIds : undefined,
    requestedAt: isNonEmptyString(input.requestedAt) ? input.requestedAt : new Date().toISOString(),
  };

  if (!isNonEmptyString(contract.ticker)) {
    throw new Error("InstitutionalAnalysisContract: ticker is required");
  }

  return contract;
}
