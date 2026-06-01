// FIC: Hook for fundamental analysis — encapsulates fetch lifecycle (loading, data, error). (EN)
// FIC: Hook para análisis fundamental — encapsula el ciclo de vida del fetch (loading, data, error). (ES)

import { useCallback, useEffect, useRef, useState } from "react";
import { useSignalStore } from "../store/signals";
import {
  postFundamentalAnalysis,
  postOptionsCalculate,
  type FundamentalAnalysisRequest,
  type FundamentalAnalysisResponse,
  type OptionStrategyResult,
} from "../services/fundamental/fundamentalApi";

export interface FundamentalAnalysisState {
  data: FundamentalAnalysisResponse | null;
  optionsResult: OptionStrategyResult | null;
  loading: boolean;
  error: string | null;
}

export interface UseFundamentalAnalysisReturn extends FundamentalAnalysisState {
  analyze: (overrides?: Partial<FundamentalAnalysisRequest>) => void;
}

export function useFundamentalAnalysis(): UseFundamentalAnalysisReturn {
  const { selectedInstrument, selectedStrike } = useSignalStore();
  const ticker = selectedInstrument?.symbol ?? "SPY";

  const [state, setState] = useState<FundamentalAnalysisState>({
    data: null,
    optionsResult: null,
    loading: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const prevTickerRef = useRef(ticker);

  // FIC: Clear results when ticker changes. (EN)
  // FIC: Limpiar resultados cuando cambia el ticker. (ES)
  useEffect(() => {
    if (prevTickerRef.current !== ticker) {
      prevTickerRef.current = ticker;
      setState({ data: null, optionsResult: null, loading: false, error: null });
    }
  }, [ticker]);

  // FIC: Cleanup abort controller on unmount. (EN)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const analyze = useCallback(
    (overrides?: Partial<FundamentalAnalysisRequest>) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      const params: FundamentalAnalysisRequest = {
        ticker,
        investmentProfile: "Value",
        horizon: "Largo plazo",
        strategy: "Long Call",
        ...overrides,
      };

      // FIC: Run fundamental analysis. If a strike is selected, also calculate options. (EN)
      // FIC: Ejecutar análisis fundamental. Si hay un strike seleccionado, también calcular opciones. (ES)
      const fundamentalPromise = postFundamentalAnalysis(params, controller.signal);

      const optionsPromise: Promise<OptionStrategyResult | null> =
        selectedStrike
          ? postOptionsCalculate(
              {
                ticker,
                optionType: selectedStrike.type,
                direction: "long",
                strikePrice: selectedStrike.strike,
                expirationDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
                premium: selectedStrike.premium,
                quantity: 1,
                riskTolerance: "MEDIUM",
              },
              controller.signal
            ).catch((err: Error) => {
              if (err.name === "AbortError" || controller.signal.aborted) throw err;
              console.warn("[FundamentalAnalysis] Options calculation skipped:", err);
              return null;
            })
          : Promise.resolve(null);

      Promise.all([fundamentalPromise, optionsPromise])
        .then(([fundamentalData, optionsData]) => {
          if (controller.signal.aborted) return;
          setState({
            data: fundamentalData,
            optionsResult: optionsData,
            loading: false,
            error: null,
          });
        })
        .catch((err: Error) => {
          if (err.name === "AbortError" || controller.signal.aborted) return;
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err.message || "Error al ejecutar el análisis fundamental",
          }));
        });
    },
    [ticker, selectedStrike]
  );

  return { ...state, analyze };
}
