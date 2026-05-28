// FIC: Market quotes service — polling hook with stale-while-revalidate and visibility pause.
// FIC: Servicio de cotizaciones de mercado — hook con polling, stale-while-revalidate y pausa por visibilidad.

import { useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "./signalApi";

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface MarketQuotesResponse {
  quotes: MarketQuote[];
}

export async function getMarketQuotes(symbols: string[]): Promise<MarketQuotesResponse> {
  const params = symbols.join(",");
  const response = await fetch(`/api/market/quotes?symbols=${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Quotes fetch failed: ${response.status}`);
  return response.json() as Promise<MarketQuotesResponse>;
}

const POLLING_INTERVAL_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export function useWatchlistPrices(symbols: string[]): Record<string, MarketQuote> {
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const failureCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (symbols.length === 0) return;

    const fetchQuotes = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        const data = await getMarketQuotes(symbols);
        failureCountRef.current = 0;
        const map: Record<string, MarketQuote> = {};
        for (const q of data.quotes) {
          map[q.symbol] = q;
        }
        setQuotes(map);
      } catch {
        failureCountRef.current += 1;
        if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
          setQuotes({});
        }
        // FIC: Retain last known values on error until MAX_CONSECUTIVE_FAILURES exceeded.
        // FIC: Retener últimos valores conocidos en error hasta superar MAX_CONSECUTIVE_FAILURES.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchQuotes();
      }
    };

    void fetchQuotes();
    intervalRef.current = setInterval(() => void fetchQuotes(), POLLING_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [symbolsKey]);

  return quotes;
}
