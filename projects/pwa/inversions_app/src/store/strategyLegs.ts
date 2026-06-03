// FIC: Shared store for picking complex-strategy legs (Iron Condor & co.) from the option chain
// FIC: via right-click. The chain writes each leg's strike+premium here; the strategy modal reads
// FIC: them on open. Purely additive — the strategy definition (e.g. 2 puts + 2 calls) is NOT changed.
// FIC: Store compartido para elegir las patas de estrategias complejas (Iron Condor, etc.) desde la
// FIC: cadena de opciones con clic derecho. La cadena escribe el strike+prima de cada pata aquí; el
// FIC: modal de estrategia las lee al abrir. Aditivo — la definición (ej. 2 puts + 2 calls) NO cambia.

import { useSyncExternalStore } from "react";

export interface StrategyLeg {
  strike: number;
  tipo: "put" | "call";
  posicion: "long" | "short";
  premium: number;
}

// FIC: Canonical leg patterns per complex strategy — mirror the modal's fixed definitions. (EN)
// FIC: Patrones canónicos de patas por estrategia compleja — reflejan las definiciones fijas del modal. (ES)
export const COMPLEX_LEG_PATTERNS: Record<string, Array<{ tipo: "put" | "call"; posicion: "long" | "short" }>> = {
  IRON_CONDOR: [
    { tipo: "put", posicion: "long" },
    { tipo: "put", posicion: "short" },
    { tipo: "call", posicion: "short" },
    { tipo: "call", posicion: "long" },
  ],
  IRON_BUTTERFLY: [
    { tipo: "put", posicion: "long" },
    { tipo: "put", posicion: "short" },
    { tipo: "call", posicion: "short" },
    { tipo: "call", posicion: "long" },
  ],
  CONDOR: [
    { tipo: "call", posicion: "long" },
    { tipo: "call", posicion: "short" },
    { tipo: "call", posicion: "short" },
    { tipo: "call", posicion: "long" },
  ],
  BUTTERFLY_SPREAD: [
    { tipo: "call", posicion: "long" },
    { tipo: "call", posicion: "short" },
    { tipo: "call", posicion: "long" },
  ],
};

export function isComplexLegStrategy(strategy: string): boolean {
  return strategy in COMPLEX_LEG_PATTERNS;
}

function patternFor(strategy: string): StrategyLeg[] {
  const pattern = COMPLEX_LEG_PATTERNS[strategy] ?? [];
  return pattern.map((p) => ({ ...p, strike: 0, premium: 0 }));
}

interface StrategyLegsState {
  strategy: string;
  legs: StrategyLeg[];
}

let state: StrategyLegsState = { strategy: "", legs: [] };

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot(): StrategyLegsState {
  return state;
}

// FIC: Point the store at a strategy; resets the slots to that pattern (empty strikes). (EN)
// FIC: Apunta el store a una estrategia; reinicia los slots a ese patrón (strikes vacíos). (ES)
export function setLegsStrategy(strategy: string): void {
  if (state.strategy === strategy) return;
  state = { strategy, legs: patternFor(strategy) };
  emit();
}

// FIC: Assign a chain row's strike + premium to leg `index` (tipo/posición stay fixed by pattern). (EN)
// FIC: Asigna el strike + prima de una fila de la cadena a la pata `index` (tipo/posición fijos). (ES)
export function assignLeg(index: number, strike: number, premium: number): void {
  if (index < 0 || index >= state.legs.length) return;
  state = {
    ...state,
    legs: state.legs.map((l, i) => (i === index ? { ...l, strike, premium } : l)),
  };
  emit();
}

export function clearLegs(): void {
  state = { strategy: state.strategy, legs: patternFor(state.strategy) };
  emit();
}

export function getLegsSnapshot(): StrategyLegsState {
  return state;
}

export function useStrategyLegsStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snapshot, setLegsStrategy, assignLeg, clearLegs };
}
