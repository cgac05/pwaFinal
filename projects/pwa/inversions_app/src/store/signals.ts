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

export interface SelectedOptionsStrategy {
  id: "short-put" | "long-put" | "short-call" | "long-call";
  name: "Short Put" | "Long Put" | "Short Call" | "Long Call";
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

const state: SignalStoreState = {
  selectedInstrument: undefined,
  selectedSignal: undefined,
  selectedOptionsStrategy: undefined,
  optionsStrategyParams: undefined,
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
      state.selectedInstrument = instrument;
      emit();
    },
    setSelectedSignal: (signal: SelectedSignal) => {
      state.selectedSignal = signal;
      emit();
    },
    setSelectedOptionsStrategy: (strategy: SelectedOptionsStrategy) => {
      state.selectedOptionsStrategy = strategy;
      emit();
    },
    setOptionsStrategyParams: (params: OptionsStrategyParams) => {
      state.optionsStrategyParams = params;
      emit();
    },
    setRuntimeMode: (mode: RuntimeMode) => {
      state.runtimeMode = mode;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("inversions.runtime.mode", mode);
      }
      emit();
    },
    setOperationalMode: (mode: OperationalMode) => {
      state.operationalMode = mode;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("inversions.runtime.operational", mode);
      }
      emit();
    }
  };
}
