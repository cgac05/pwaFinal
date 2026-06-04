// FIC: Institutional data service — multi-source resolver with LRU cache, rate limiting, and observation merge. (EN)
// FIC: Servicio de datos institucionales — resolvedor multi-fuente con caché LRU, rate limiting y merge de observaciones. (ES)

import type {
  InstitutionalAnalysisContract,
  InstitutionalFlowSnapshot,
  InstitutionalLiquidity,
  InstitutionalAnalysisPeriod,
} from "./institutionalContract";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_CACHE_TTL_MS = 300_000;      // 5 minutes / 5 minutos
export const DEFAULT_CACHE_MAX_ENTRIES = 250;
export const DEFAULT_SOURCE_TIMEOUT_MS = 12_000;  // 12 seconds / 12 segundos
const RATE_LIMIT_WINDOW_MS = 60_000;              // 1 minute sliding window / ventana deslizante de 1 minuto

// ─── Types ────────────────────────────────────────────────────────────────────

// FIC: Normalized output from a single institutional data source. (EN)
// FIC: Salida normalizada de una fuente de datos institucional. (ES)
export interface InstitutionalSourceObservation {
  sourceId: string;
  /** Confidence score [0.00, 0.95] — never 1.0 / Score de confianza [0.00, 0.95] — nunca 1.0 */
  confidence: number;
  fundsOwnershipPct?: number;
  volume?: number;
  flows?: InstitutionalFlowSnapshot;
  openPositions?: { count: number; notional?: number };
  liquidity?: InstitutionalLiquidity;
  status: "ok" | "partial" | "failed";
  asOf?: string; // ISO timestamp of the data
  rawSourceData?: Record<string, unknown>;
}

// FIC: Parser function type — must never reject, return null on failure. (EN)
// FIC: Tipo de función parser — nunca debe rechazar, retorna null en caso de error. (ES)
export type ParseFn = (
  ticker: string,
  period: InstitutionalAnalysisPeriod,
  fetchImpl: typeof globalThis.fetch
) => Promise<InstitutionalSourceObservation | null>;

// FIC: Configuration for a single institutional data source. (EN)
// FIC: Configuración de una fuente de datos institucional. (ES)
export interface DataSourceConfig {
  sourceId: string;
  priority: number; // lower = higher priority / menor = mayor prioridad
  cacheTtlMs?: number;
  rateLimit?: { maxRequests: number; windowMs?: number };
  parse: ParseFn;
}

// FIC: Overall status of a resolve() call (EN)
// FIC: Estado global de una llamada a resolve() (ES)
export type OverallStatus = "ok" | "partial" | "all_failed";

// FIC: Result returned by resolve() with merged observations. (EN)
// FIC: Resultado retornado por resolve() con observaciones fusionadas. (ES)
export interface InstitutionalResolveResult {
  ticker: string;
  period: InstitutionalAnalysisPeriod;
  observations: InstitutionalSourceObservation[];
  merged: Omit<InstitutionalSourceObservation, "sourceId" | "status"> & { sourceIds: string[] };
  overallStatus: OverallStatus;
  usedSourceIds: string[];
  cacheHit: boolean;
  resolvedAt: string;
}

// ─── Private cache / rate-limit internals ─────────────────────────────────────

interface CacheEntry {
  observation: InstitutionalSourceObservation;
  expiresAt: number;
}

interface RateLimitState {
  timestamps: number[]; // request timestamps in current window
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// FIC: Normalize a percentage value: if ≤1 multiply by 100, else use directly. (EN)
// FIC: Normaliza un porcentaje: si ≤1 multiplica por 100, si >1 usa directo. (ES)
export function normalizePercentage(value: number): number {
  return value <= 1 ? value * 100 : value;
}

// FIC: Returns the higher of two liquidity levels (high > medium > low). (EN)
// FIC: Retorna el nivel de liquidez más alto (high > medium > low). (ES)
function highestLiquidity(a?: InstitutionalLiquidity, b?: InstitutionalLiquidity): InstitutionalLiquidity | undefined {
  const rank: Record<InstitutionalLiquidity, number> = { low: 0, medium: 1, high: 2 };
  if (a === undefined) return b;
  if (b === undefined) return a;
  return rank[a] >= rank[b] ? a : b;
}

// FIC: Score a merged observation based on the number of significant signals. (EN)
// FIC: Puntúa una observación fusionada según el número de señales significativas. (ES)
function scoreConfidence(obs: Partial<InstitutionalSourceObservation>): number {
  let count = 0;
  if ((obs.fundsOwnershipPct ?? 0) > 0) count++;
  if ((obs.volume ?? 0) > 0) count++;
  if ((obs.flows?.inflows ?? 0) > 0) count++;
  if ((obs.flows?.outflows ?? 0) > 0) count++;
  if ((obs.openPositions?.count ?? 0) > 0) count++;
  if (count >= 4) return 0.95;
  if (count === 3) return 0.85;
  if (count === 2) return 0.70;
  return 0.55;
}

// FIC: Merge multiple source observations into a single normalized view. (EN)
// FIC: Fusiona múltiples observaciones de fuentes en una vista normalizada. (ES)
function mergeObservations(
  observations: InstitutionalSourceObservation[]
): InstitutionalResolveResult["merged"] {
  const successful = observations.filter((o) => o.status !== "failed");
  // Sort by confidence descending — highest-confidence source wins categorical fields
  const sorted = [...successful].sort((a, b) => b.confidence - a.confidence);

  // fundsOwnershipPct → AVERAGE
  const ownershipValues = sorted.filter((o) => o.fundsOwnershipPct !== undefined).map((o) => o.fundsOwnershipPct!);
  const fundsOwnershipPct = ownershipValues.length > 0
    ? ownershipValues.reduce((s, v) => s + v, 0) / ownershipValues.length
    : undefined;

  // volume → MAX
  const volumes = sorted.filter((o) => o.volume !== undefined).map((o) => o.volume!);
  const volume = volumes.length > 0 ? Math.max(...volumes) : undefined;

  // flows → SUM inflows and outflows
  let flows: InstitutionalFlowSnapshot | undefined;
  const flowObs = sorted.filter((o) => o.flows !== undefined);
  if (flowObs.length > 0) {
    flows = {
      inflows: flowObs.reduce((s, o) => s + (o.flows?.inflows ?? 0), 0),
      outflows: flowObs.reduce((s, o) => s + (o.flows?.outflows ?? 0), 0),
      asOf: flowObs[0].flows!.asOf, // most-recent source's timestamp
    };
  }

  // openPositions → MAX count
  const posObs = sorted.filter((o) => o.openPositions !== undefined);
  const openPositions = posObs.length > 0
    ? posObs.reduce((best, o) => (o.openPositions!.count > best.count ? o.openPositions! : best), posObs[0].openPositions!)
    : undefined;

  // liquidity → HIGHEST
  const liquidity = sorted.reduce<InstitutionalLiquidity | undefined>(
    (acc, o) => highestLiquidity(acc, o.liquidity),
    undefined
  );

  const merged = { fundsOwnershipPct, volume, flows, openPositions, liquidity };
  const confidence = Math.min(scoreConfidence(merged), 0.95);
  const sourceIds = sorted.map((o) => o.sourceId);

  return { ...merged, confidence, sourceIds };
}

// ─── Main service class ───────────────────────────────────────────────────────

// FIC: Multi-source institutional data service with LRU cache and per-source rate limiting. (EN)
// FIC: Servicio de datos institucionales multi-fuente con caché LRU y rate limiting por fuente. (ES)
export class InstitutionalDataService {
  private readonly sources: DataSourceConfig[];
  private readonly cacheTtlMs: number;
  private readonly cacheMaxEntries: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly rateLimits = new Map<string, RateLimitState>();

  constructor(
    sources: DataSourceConfig[],
    cacheTtlMs: number = DEFAULT_CACHE_TTL_MS,
    cacheMaxEntries: number = DEFAULT_CACHE_MAX_ENTRIES,
    fetchImpl: typeof globalThis.fetch = globalThis.fetch
  ) {
    // Sort sources by priority ascending (1 = highest priority)
    this.sources = [...sources].sort((a, b) => a.priority - b.priority);
    this.cacheTtlMs = cacheTtlMs;
    this.cacheMaxEntries = cacheMaxEntries;
    this.fetchImpl = fetchImpl;
  }

  // FIC: Resolve all sources for a given contract and return merged result. (EN)
  // FIC: Resuelve todas las fuentes para un contrato dado y retorna el resultado fusionado. (ES)
  async resolve(contract: InstitutionalAnalysisContract): Promise<InstitutionalResolveResult> {
    const settled = await Promise.allSettled(
      this.sources.map((source) => this.resolveSingleSource(source, contract.ticker, contract.period))
    );

    const observations: InstitutionalSourceObservation[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value !== null) {
        observations.push(result.value);
      }
    }

    const successful = observations.filter((o) => o.status !== "failed");
    const overallStatus: OverallStatus =
      observations.length === 0 || successful.length === 0
        ? "all_failed"
        : successful.length < observations.length
        ? "partial"
        : "ok";

    return {
      ticker: contract.ticker,
      period: contract.period,
      observations,
      merged: mergeObservations(observations),
      overallStatus,
      usedSourceIds: successful.map((o) => o.sourceId),
      cacheHit: false,
      resolvedAt: new Date().toISOString(),
    };
  }

  // FIC: Resolve a single source: checks cache → rate limit → fetch+parse. Never rejects. (EN)
  // FIC: Resuelve una fuente individual: caché → rate limit → fetch+parse. Nunca rechaza. (ES)
  async resolveSingleSource(
    source: DataSourceConfig,
    ticker: string,
    period: InstitutionalAnalysisPeriod
  ): Promise<InstitutionalSourceObservation | null> {
    // FIC: Include period in cache key so different periods don't share the same observation. (EN)
    // FIC: Incluir period en la clave de caché para que distintos períodos no compartan la misma observación. (ES)
    const cacheKey = `${source.sourceId}:${ticker}:${period}`;

    // Check cache first
    const cached = this.getFromCache(cacheKey, source.cacheTtlMs ?? this.cacheTtlMs);
    if (cached) return { ...cached.observation, status: cached.observation.status };

    // Check rate limit
    if (!this.checkRateLimit(source)) {
      return {
        sourceId: source.sourceId,
        confidence: 0,
        status: "failed",
        asOf: new Date().toISOString(),
      };
    }

    try {
      // Apply timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_SOURCE_TIMEOUT_MS);

      let observation: InstitutionalSourceObservation | null = null;
      try {
        observation = await source.parse(ticker, period, this.fetchImpl);
      } finally {
        clearTimeout(timeoutId);
      }

      if (observation) {
        this.addToCache(cacheKey, observation, source.cacheTtlMs ?? this.cacheTtlMs);
        return observation;
      }

      return {
        sourceId: source.sourceId,
        confidence: 0,
        status: "failed",
        asOf: new Date().toISOString(),
      };
    } catch {
      return {
        sourceId: source.sourceId,
        confidence: 0,
        status: "failed",
        asOf: new Date().toISOString(),
      };
    }
  }

  // ─── LRU Cache ─────────────────────────────────────────────────────────────

  private addToCache(key: string, observation: InstitutionalSourceObservation, ttlMs: number): void {
    // FIC: Move existing key to end (most-recently-used position) before re-inserting. (EN)
    // FIC: Mueve la clave existente al final (posición más reciente) antes de reinsertar. (ES)
    if (this.cache.has(key)) this.cache.delete(key);

    // LRU eviction: remove oldest entry when over capacity
    if (this.cache.size >= this.cacheMaxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { observation, expiresAt: Date.now() + ttlMs });
  }

  private getFromCache(key: string, ttlMs: number): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Move to most-recently-used (end of Map)
    this.cache.delete(key);
    this.cache.set(key, { ...entry, expiresAt: Date.now() + ttlMs });
    return entry;
  }

  // ─── Rate Limiting ─────────────────────────────────────────────────────────

  // FIC: Sliding-window rate limiter — returns false if the source is over its limit. (EN)
  // FIC: Rate limiter de ventana deslizante — retorna false si la fuente superó su límite. (ES)
  private checkRateLimit(source: DataSourceConfig): boolean {
    if (!source.rateLimit) return true;

    const windowMs = source.rateLimit.windowMs ?? RATE_LIMIT_WINDOW_MS;
    const maxRequests = source.rateLimit.maxRequests;
    const now = Date.now();

    if (!this.rateLimits.has(source.sourceId)) {
      this.rateLimits.set(source.sourceId, { timestamps: [] });
    }

    const state = this.rateLimits.get(source.sourceId)!;
    // Purge timestamps outside the current window
    state.timestamps = state.timestamps.filter((t) => now - t < windowMs);

    if (state.timestamps.length >= maxRequests) return false;

    state.timestamps.push(now);
    return true;
  }
}

// ─── 6 Embedded Parsers (synthetic / stub implementations) ───────────────────
// FIC: These embedded parsers generate deterministic synthetic data based on ticker char-code seed.
// FIC: Estos parsers generan datos sintéticos deterministas basados en el seed de códigos de char del ticker.
// Real parsers (T1004–T1007) replace these in production via bootstrap.ts.

function tickerSeed(ticker: string): number {
  return ticker.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

// FIC: Embedded SEC 13F parser stub — synthetic institutional ownership. (EN)
// FIC: Parser embebido SEC 13F — propiedad institucional sintética. (ES)
export const embeddedSec13fParser: ParseFn = async (ticker, period) => {
  const seed = tickerSeed(ticker);
  const periodFactor = period === "intraday" ? 0.5 : period === "daily" ? 1 : period === "weekly" ? 1.2 : 1.5;
  const fundsOwnershipPct = 18 + (seed % 34) * periodFactor * 0.5;
  const volume = 900_000 + seed * 850 * periodFactor;
  const inflows = volume * 0.34;
  const outflows = volume * 0.18;
  return {
    sourceId: "sec_edgar_13f",
    confidence: 0.80,
    fundsOwnershipPct: normalizePercentage(fundsOwnershipPct),
    volume,
    flows: { inflows, outflows, asOf: new Date().toISOString() },
    openPositions: { count: 30 + (seed % 70) },
    liquidity: volume >= 2_000_000 ? "high" : volume >= 1_200_000 ? "medium" : "low",
    status: "ok",
    asOf: new Date().toISOString(),
  };
};

// FIC: Embedded FINRA short interest parser stub — synthetic short interest data. (EN)
// FIC: Parser embebido FINRA — datos sintéticos de interés corto. (ES)
export const embeddedFinraParser: ParseFn = async (ticker, period) => {
  const seed = tickerSeed(ticker);
  const periodFactor = period === "intraday" ? 0.8 : 1;
  const shortInterest = 500_000 + seed * 300 * periodFactor;
  const notional = shortInterest * 2.3;
  return {
    sourceId: "finra_short_interest",
    confidence: 0.70,
    volume: shortInterest,
    flows: {
      inflows: shortInterest * 0.5,
      outflows: shortInterest * 0.25,
      asOf: new Date().toISOString(),
    },
    openPositions: { count: 5 + (seed % 20), notional },
    liquidity: shortInterest >= 1_000_000 ? "medium" : "low",
    status: "ok",
    asOf: new Date().toISOString(),
  };
};

// FIC: Embedded Unusual Whales options flow parser stub. (EN)
// FIC: Parser embebido de flujo de opciones Unusual Whales. (ES)
export const embeddedUnusualWhalesParser: ParseFn = async (ticker) => {
  const seed = tickerSeed(ticker);
  const volume = 200_000 + seed * 150;
  return {
    sourceId: "unusual_whales",
    confidence: 0.65,
    volume,
    flows: {
      inflows: volume * 0.6,
      outflows: volume * 0.3,
      asOf: new Date().toISOString(),
    },
    liquidity: "medium",
    status: "ok",
    asOf: new Date().toISOString(),
  };
};

// FIC: Embedded Finviz institutional ownership parser stub. (EN)
// FIC: Parser embebido de propiedad institucional Finviz. (ES)
export const embeddedFinvizParser: ParseFn = async (ticker) => {
  const seed = tickerSeed(ticker);
  const fundsOwnershipPct = 20 + (seed % 40);
  return {
    sourceId: "finviz",
    confidence: 0.60,
    fundsOwnershipPct: normalizePercentage(fundsOwnershipPct),
    openPositions: { count: 10 + (seed % 30) },
    status: "ok",
    asOf: new Date().toISOString(),
  };
};

// FIC: Embedded Yahoo Finance options flow parser stub. (EN)
// FIC: Parser embebido de flujo de opciones Yahoo Finance. (ES)
export const embeddedYahooOptionsParser: ParseFn = async (ticker) => {
  const seed = tickerSeed(ticker);
  const callVol = 50_000 + seed * 100;
  const putVol = 30_000 + seed * 80;
  return {
    sourceId: "yahoo_options_flow",
    confidence: 0.55,
    volume: callVol + putVol,
    flows: {
      inflows: callVol,
      outflows: putVol,
      asOf: new Date().toISOString(),
    },
    status: "ok",
    asOf: new Date().toISOString(),
  };
};

// FIC: Embedded Yahoo Finance institutional ownership parser stub. (EN)
// FIC: Parser embebido de propiedad institucional Yahoo Finance. (ES)
export const embeddedYahooInstitutionalParser: ParseFn = async (ticker) => {
  const seed = tickerSeed(ticker);
  const ownership = 25 + (seed % 30);
  return {
    sourceId: "yahoo_institutional",
    confidence: 0.55,
    fundsOwnershipPct: normalizePercentage(ownership),
    openPositions: { count: 500 + (seed % 200) },
    status: "ok",
    asOf: new Date().toISOString(),
  };
};
