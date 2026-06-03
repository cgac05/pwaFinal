// FIC: Shared store for technical-indicator toggles — single source of truth synced
// FIC: between the chart (SuperChart, "arriba") and the simulation panel (SimulationControlPanel, "abajo").
// FIC: Store compartido para los toggles de indicadores técnicos — fuente única de verdad
// FIC: sincronizada entre el gráfico (SuperChart, "arriba") y el panel de simulación (SimulationControlPanel, "abajo").

import { useSyncExternalStore } from "react";
import type { SubCoreIndicador } from "../services/signals/confluenceTableApi";

// FIC: The five canonical technical indicators shared by chart and simulation panel. (EN)
// FIC: Los cinco indicadores técnicos canónicos compartidos por gráfico y panel. (ES)
export const ALL_INDICATORS: SubCoreIndicador[] = ["RSI", "MACD", "EMA", "ADX", "BB"];

export type IndicatorState = Record<SubCoreIndicador, boolean>;

const STORAGE_KEY = "inversions.indicators.active";

// FIC: All indicators start DISABLED; the user opts in explicitly (matches prior panel default). (EN)
// FIC: Todos los indicadores arrancan DESHABILITADOS; el usuario los activa explícitamente. (ES)
function defaultState(): IndicatorState {
  return ALL_INDICATORS.reduce(
    (acc, k) => ({ ...acc, [k]: false }),
    {} as IndicatorState,
  );
}

// FIC: Read persisted state, tolerating legacy/partial shapes and bad JSON. (EN)
// FIC: Lee el estado persistido, tolerando formas legadas/parciales y JSON inválido. (ES)
function loadState(): IndicatorState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacy() ?? defaultState();
    const parsed = JSON.parse(raw) as Partial<IndicatorState>;
    const base = defaultState();
    for (const k of ALL_INDICATORS) {
      if (typeof parsed[k] === "boolean") base[k] = parsed[k] as boolean;
    }
    return base;
  } catch {
    return defaultState();
  }
}

// FIC: One-time migration from SuperChart's old "superchart_indicators" key (rsi/macd/bb). (EN)
// FIC: Migración única desde la antigua clave "superchart_indicators" del SuperChart (rsi/macd/bb). (ES)
function migrateLegacy(): IndicatorState | null {
  try {
    const legacy = window.localStorage.getItem("superchart_indicators");
    if (!legacy) return null;
    const old = JSON.parse(legacy) as { rsi?: boolean; macd?: boolean; bb?: boolean };
    const base = defaultState();
    if (typeof old.rsi === "boolean") base.RSI = old.rsi;
    if (typeof old.macd === "boolean") base.MACD = old.macd;
    if (typeof old.bb === "boolean") base.BB = old.bb;
    return base;
  } catch {
    return null;
  }
}

// FIC: useSyncExternalStore needs a fresh object reference per update to detect changes. (EN)
// FIC: useSyncExternalStore necesita una nueva referencia de objeto por actualización. (ES)
let state: IndicatorState = loadState();

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): IndicatorState {
  return state;
}

// FIC: Imperative setters usable outside React too. (EN)
// FIC: Setters imperativos usables también fuera de React. (ES)
export function setIndicator(key: SubCoreIndicador, value: boolean): void {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  persist();
  emit();
}

export function toggleIndicator(key: SubCoreIndicador): void {
  setIndicator(key, !state[key]);
}

export function getIndicatorState(): IndicatorState {
  return state;
}

// FIC: React hook — both chart and panel consume this so toggles stay in sync (US: arriba↔abajo). (EN)
// FIC: Hook de React — gráfico y panel lo consumen para mantener los toggles sincronizados. (ES)
export function useIndicatorStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    indicators: snapshot,
    setIndicator,
    toggleIndicator,
  };
}
