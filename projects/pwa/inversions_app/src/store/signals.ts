// FIC: Lightweight global store for dashboard signal selection and runtime modes.
// FIC: Store global ligero para seleccion de senales y modos runtime del dashboard.

import { useSyncExternalStore } from "react";

export interface SelectedInstrument {
  symbol: string;
  name?: string;
  category?: string;
}

export interface SelectedSignal {
  id?: string;
  signalId?: string;
  symbol?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

// FIC: Strike selected from OptionChainTable — shared via store so CoverageStrategyModal can read it. (EN)
// FIC: Strike seleccionado de OptionChainTable — compartido via store para que CoverageStrategyModal lo lea. (ES)
export interface SelectedStrike {
  strike: number;
  type: "call" | "put";
  premium: number;
  iv: number;
  expiration?: string;
  underlyingPrice?: number;
  callPremium?: number;
  putPremium?: number;
  estimatedRiskFreeRate?: number;
}

export interface SelectedOptionsStrategy {
  id: "short-put" | "long-put" | "short-call" | "long-call" | "calendar-spread" | "diagonal-spread";
  name: "Short Put" | "Long Put" | "Short Call" | "Long Call" | "Calendar Spread" | "Diagonal Spread";
}

export interface OptionsStrategyParams {
  ticker: string;
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
}

type RuntimeMode = "online" | "offline";
type OperationalMode = "demo" | "real";

interface SignalStoreState {
  selectedInstrument?: SelectedInstrument;
  selectedSignal?: SelectedSignal;
  selectedStrike?: SelectedStrike;
  selectedOptionsStrategy?: SelectedOptionsStrategy;
  optionsStrategyParams?: OptionsStrategyParams;
  runtimeMode: RuntimeMode;
  operationalMode: OperationalMode;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const initialRuntimeMode =
  (typeof window !== "undefined" &&
    (window.localStorage.getItem("inversions.runtime.mode") as RuntimeMode | null)) ||
  "online";

const initialOperationalMode =
  (typeof window !== "undefined" &&
    (window.localStorage.getItem("inversions.runtime.operational") as OperationalMode | null)) ||
  "demo";

// useSyncExternalStore requires a new object reference on each update so React detects the change.
let state: SignalStoreState = {
  selectedInstrument: undefined,
  selectedSignal: undefined,
  runtimeMode: initialRuntimeMode,
  operationalMode: initialOperationalMode
};

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SignalStoreState {
  return state;
}

export function useSignalStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...snapshot,
    setSelectedInstrument: (instrument: SelectedInstrument) => {
      state = { ...state, selectedInstrument: instrument };
      emit();
    },
    setSelectedSignal: (signal: SelectedSignal) => {
      state = { ...state, selectedSignal: signal };
      emit();
    },
    setSelectedStrike: (strike: SelectedStrike | undefined) => {
      // TEMP-LOG [Punto 3 — signals store] valor que se persiste
      console.log("[WHEEL-AUDIT][3-signals store] setSelectedStrike →", strike);
      state = { ...state, selectedStrike: strike };
      emit();
    },
    setSelectedOptionsStrategy: (strategy: SelectedOptionsStrategy) => {
      state = { ...state, selectedOptionsStrategy: strategy };
      emit();
    },
    setOptionsStrategyParams: (params: OptionsStrategyParams) => {
      state = { ...state, optionsStrategyParams: params };
      emit();
    },
    setRuntimeMode: (mode: RuntimeMode) => {
      state = { ...state, runtimeMode: mode };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("inversions.runtime.mode", mode);
      }
      emit();
    },
    setOperationalMode: (mode: OperationalMode) => {
      state = { ...state, operationalMode: mode };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("inversions.runtime.operational", mode);
      }
      emit();
    },
  };
}
