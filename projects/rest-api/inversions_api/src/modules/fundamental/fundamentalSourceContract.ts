/**
 * T003-T077: Contrato de parámetros de análisis fundamental
 * Define tipos TypeScript para cada métrica financiera y metadatos asociados.
 * Implementa preservación de integridad de datos y precisión numérica.
 *
 * T003-T077: Fundamental analysis parameters contract
 * Defines TypeScript types for financial metrics and associated metadata.
 * Implements data integrity preservation and numerical precision.
 */

/**
 * T003a: Tipos de datos para cada métrica financiera
 */

export interface MarketCapData {
  value: number; // En USD, precisión a centavos (0.01)
  currency: string; // e.g., "USD"
  timestamp: string; // ISO 8601 timestamp cuando se obtuvo
}

export interface SalesData {
  annualRevenue: number; // En USD
  quarterlyRevenue: number; // Último trimestre disponible
  revenueGrowthPercent: number; // YoY % change, precisión a 0.01%
  timestamp: string;
}

export interface DividendData {
  annualDividendPerShare: number; // USD, precisión 0.01
  dividendYieldPercent: number; // %, precisión 0.01%
  payoutRatio: number; // %, 0-100
  lastPaymentDate: string; // ISO date
  exDividendDate: string; // ISO date
  timestamp: string;
}

export interface PriceHistory {
  currentPrice: number; // USD, precisión 0.01
  priceChange52WeekPercent: number; // %, precisión 0.01%
  priceHigh52Week: number; // USD
  priceLow52Week: number; // USD
  avgVolume10Day: number; // # de shares
  timestamp: string;
}

export interface FinancialRatio {
  roe: number; // Return on Equity %, precisión 0.01%
  peRatio: number; // Price-to-Earnings, precisión 0.01
  pbRatio: number; // Price-to-Book
  psRatio: number; // Price-to-Sales
  debtToEquity: number; // Razón D/E, precisión 0.01
  timestamp: string;
}

export interface EmployeeCount {
  count: number; // Total employees
  countEstimated: boolean; // Flag si es estimación
  timestamp: string;
}

export interface BetaMetric {
  value: number; // Beta vs. S&P 500, precisión 0.01
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  calculationMethod: string; // e.g., "60-month rolling"
  timestamp: string;
}

export interface EpsData {
  eps: number; // Earnings per share, USD, precisión 0.01
  epsGrowthYoYPercent: number; // %, precisión 0.01%
  timestamp: string;
}

export interface VolatilityMetric {
  annualizedVolatility: number; // %, precisión 0.01% (e.g., 35.42)
  lookbackDays: number; // e.g., 252 (1 year), 60, 30
  calculationMethod: string; // e.g., "historical", "iv_implied"
  timestamp: string;
}

export interface SectorClassification {
  sector: string; // e.g., "Technology", "Healthcare", "Energy"
  industry: string; // e.g., "Software", "Pharmaceuticals", "Oil & Gas"
  subIndustry: string; // e.g., "Application Software"
  timestamp: string;
}

export interface CountryCode {
  isoCode: string; // e.g., "US", "CA", "GB"
  primaryListing: string; // Exchange, e.g., "NASDAQ", "NYSE", "TSX"
  timestamp: string;
}

/**
 * T003b, T003c: Metadatos de integridad y trazabilidad
 */
export interface FundamentalDataMetadata {
  sourceId: string; // e.g., "finviz", "yahoo_finance", "alphavantage"
  fetchTimestamp: string; // ISO 8601 cuando se obtuvo
  dataVersion: string; // e.g., "v1.0"
  assumptions: {
    volatilityCalculationMethod: string; // e.g., "60-month rolling", "IV implied"
    lookbackPeriod: number; // días
    riskFreeRate: number; // %, para cálculos Black-Scholes future
    marketIndexBench: string; // e.g., "SPX" para Beta
  };
  quality: {
    completenessPercent: number; // 0-100, % de campos populated
    lastValidation: string; // ISO timestamp
  };
}

/**
 * T003a: Contrato principal de análisis fundamental
 * Agrupa todas las métricas y metadatos en una estructura única.
 */
export interface FundamentalAnalysisData {
  // Identificador del activo
  ticker: string; // e.g., "AAPL"
  companyName: string;

  // Métricas financieras
  metrics: {
    marketCap?: MarketCapData;
    sales?: SalesData;
    dividend?: DividendData;
    priceHistory?: PriceHistory;
    financialRatios?: FinancialRatio;
    employees?: EmployeeCount;
    beta?: BetaMetric;
    eps?: EpsData;
    volatility?: VolatilityMetric;
    sector?: SectorClassification;
    country?: CountryCode;
  };

  // Metadatos
  metadata: FundamentalDataMetadata;

  // Campos para auditoría
  auditTrail?: {
    createdAt: string;
    lastUpdated: string;
    requestId?: string; // Para rastreo distribuido
  };
}

/**
 * T003b: Especificación de campos obligatorios vs opcionales
 * Campos CRÍTICOS (rechazo si >5% faltantes): ticker, price, volume volatility
 * Campos IMPORTANTES (warning si faltantes): ROE, P/E, Beta, Dividend
 * Campos OPCIONALES: employees, detailed sector info
 */
export const CRITICAL_FIELDS: Array<keyof FundamentalAnalysisData["metrics"]> = [
  "priceHistory",
  "volatility"
];

export const IMPORTANT_FIELDS: Array<keyof FundamentalAnalysisData["metrics"]> = [
  "financialRatios",
  "beta",
  "eps",
  "marketCap"
];

export const OPTIONAL_FIELDS: Array<keyof FundamentalAnalysisData["metrics"]> = [
  "employees",
  "sector",
  "country"
];

/**
 * T003c: Validador de precisión numérica
 * Asegura que no se pierda precisión en conversiones.
 */
export const PRECISION_RULES = {
  currency: 0.01, // $0.01
  percentage: 0.01, // 0.01%
  ratio: 0.01, // 0.01x
  volume: 1, // 1 share
  volatility: 0.01, // 0.01%
  price: 0.01 // $0.01
} as const;

/**
 * T003e: Helper para validación de completitud de datos
 */
export function calculateDataCompleteness(data: FundamentalAnalysisData): number {
  const metrics = data.metrics;
  const metricsCount = Object.keys(metrics).length;
  const populatedCount = Object.values(metrics).filter((m) => m !== undefined).length;

  if (metricsCount === 0) return 0;
  return Math.round((populatedCount / metricsCount) * 100);
}

/**
 * T003e: Helper para detectar datos faltantes críticos
 * Retorna true si hay más del 5% de datos críticos faltantes
 */
export function hasCriticalDataGaps(data: FundamentalAnalysisData): boolean {
  const criticalMetrics = CRITICAL_FIELDS;
  const missingCount = criticalMetrics.filter((field) => data.metrics[field] === undefined).length;

  if (criticalMetrics.length === 0) return false;
  const missingPercent = (missingCount / criticalMetrics.length) * 100;

  return missingPercent > 5;
}

/**
 * Tipo para resultados de validación
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  completenessPercent: number;
}
