// FIC: Institutional analysis store — holds per-ticker results using useSyncExternalStore pattern. (EN)
// FIC: Store de análisis institucional — almacena resultados por ticker usando el patrón useSyncExternalStore. (ES)

import { useSyncExternalStore } from "react";
import type {
  InstitutionalAnalysisResponse,
  InstitutionalZone,
} from "../services/institutional/institutionalApi";

// ─── State ────────────────────────────────────────────────────────────────────

interface InstitutionalStoreState {
  /** Results keyed by uppercase ticker symbol */
  results: Record<string, InstitutionalAnalysisResponse>;
  /** Loading state keyed by ticker */
  loading: Record<string, boolean>;
  /** Error messages keyed by ticker */
  errors: Record<string, string | null>;
}

type Listener = () => void;

const listeners = new Set<Listener>();

let state: InstitutionalStoreState = {
  results: {},
  loading: {},
  errors: {},
};

let snapshot: InstitutionalStoreState = { ...state };

function emit(): void {
  snapshot = { ...state };
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): InstitutionalStoreState {
  return snapshot;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function setInstitutionalLoading(ticker: string, loading: boolean): void {
  state = { ...state, loading: { ...state.loading, [ticker.toUpperCase()]: loading } };
  emit();
}

export function setInstitutionalResult(ticker: string, result: InstitutionalAnalysisResponse): void {
  const key = ticker.toUpperCase();
  state = {
    ...state,
    results: { ...state.results, [key]: result },
    loading: { ...state.loading, [key]: false },
    errors: { ...state.errors, [key]: null },
  };
  emit();
}

export function setInstitutionalError(ticker: string, error: string): void {
  const key = ticker.toUpperCase();
  state = {
    ...state,
    loading: { ...state.loading, [key]: false },
    errors: { ...state.errors, [key]: error },
  };
  emit();
}

export function clearInstitutionalResults(): void {
  state = { results: {}, loading: {}, errors: {} };
  emit();
}

// ─── Derived selectors ────────────────────────────────────────────────────────

// FIC: Nearest zone to a given price — used for the confluence table column. (EN)
// FIC: Zona más cercana a un precio dado — usada para la columna de la tabla de confluencia. (ES)
export function getNearestZone(
  zones: InstitutionalZone[],
  price: number
): InstitutionalZone | null {
  if (zones.length === 0) return null;
  return zones.reduce((nearest, zone) =>
    Math.abs(zone.price - price) < Math.abs(nearest.price - price) ? zone : nearest
  );
}

// FIC: Build a compact observation summary for the ChatPanel context injection. (EN)
// FIC: Construye un resumen compacto de observación para la inyección de contexto en ChatPanel. (ES)
export function getObservationSummary(ticker: string): string | null {
  const result = state.results[ticker.toUpperCase()];
  if (!result) return null;

  const trend = result.trends;
  const zones = result.zones;
  const exp = result.expiration;
  const metrics = result.metrics;

  const parts: string[] = [];

  if (trend) {
    parts.push(`Tendencia: ${trend.direction} (SMA50=${trend.sma50.toFixed(2)}, SMA200=${trend.sma200.toFixed(2)})`);
    if (trend.crossover) parts.push(`Crossover: ${trend.crossover.type} hace ${trend.crossover.daysAgo}d`);
  }

  if (zones) {
    const supportCount = zones.support.length;
    const resistanceCount = zones.resistance.length;
    parts.push(`Zonas: ${supportCount} soporte, ${resistanceCount} resistencia`);
    if (zones.support.length > 0) parts.push(`Soporte clave: $${zones.support[0].price.toFixed(2)}`);
    if (zones.resistance.length > 0) parts.push(`Resistencia clave: $${zones.resistance[0].price.toFixed(2)}`);
  }

  if (exp) {
    parts.push(`Vencimiento: régimen=${exp.currentRegime}, ${exp.daysToNextOpex}d para OpEx, sesgo=${exp.expiryBias}`);
  }

  if (metrics) {
    parts.push(`Ownership institucional: ${metrics.fundsOwnershipPct.toFixed(1)}%, NetFlow: $${metrics.netFlow.toLocaleString()}`);
  }

  return parts.length > 0 ? `[TEAM-05 Institucional — ${ticker}] ${parts.join(". ")}` : null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// FIC: React hook to subscribe to institutional store state. (EN)
// FIC: Hook de React para suscribirse al estado del store institucional. (ES)
export function useInstitutionalStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...snapshot,
    setLoading: setInstitutionalLoading,
    setResult: setInstitutionalResult,
    setError: setInstitutionalError,
    clear: clearInstitutionalResults,
    getObservationSummary,
    getNearestZone,
  };
}
