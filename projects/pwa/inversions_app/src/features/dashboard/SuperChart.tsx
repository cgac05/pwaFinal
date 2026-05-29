import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  ColorType,
  IChartApi,
  ISeriesApi
} from "lightweight-charts";
import { useSignalStore } from "../../store/signals";
import { getAuthHeaders } from "../../services/signals/signalApi";

interface OHLC {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface SignalMark {
  time: string;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
  text: string;
  signal: any;
}

interface SuperChartProps {
  symbol?: string;
  timeframe?: string;
  startDate?: Date;
  endDate?: Date;
  onSelectSignal?: (signal: any) => void;
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getChartTheme() {
  return {
    bg:     getCSSVar("--color-bg")           || "#000000",
    text:   getCSSVar("--color-text")         || "#ffffff",
    border: getCSSVar("--color-border")       || "rgba(255,255,255,0.12)",
    surface: getCSSVar("--color-surface")     || "#0a0a0a",
    buy:    getCSSVar("--color-buy")          || "#00a87e",
    sell:   getCSSVar("--color-sell")         || "#e23b4a",
  };
}

export const SuperChart: React.FC<SuperChartProps> = ({
  symbol,
  timeframe = "1d",
  startDate,
  endDate,
  onSelectSignal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const signalMarkersRef = useRef<Map<string, SignalMark>>(new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candles, setCandles] = useState<OHLC[]>([]);
  const [signals, setSignals] = useState<SignalMark[]>([]);

  const { selectedSignal } = useSignalStore();

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current || !symbol) return;

    try {
      const theme = getChartTheme();

      const chart = createChart(containerRef.current, {
        layout: {
          textColor: theme.text,
          background: { type: ColorType.Solid, color: theme.bg },
          fontFamily: getCSSVar("--font-family") || "Inter, sans-serif",
        },
        grid: {
          vertLines: { color: theme.border },
          horzLines: { color: theme.border },
        },
        width: containerRef.current.clientWidth,
        height: Math.max(containerRef.current.clientHeight, 340),
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          borderColor: theme.border,
        },
        rightPriceScale: {
          borderColor: theme.border,
        },
      });

      chartRef.current = chart;

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: theme.buy,
        downColor: theme.sell,
        borderVisible: true,
        wickUpColor: theme.buy,
        wickDownColor: theme.sell,
      });

      candleSeriesRef.current = candleSeries;

      // Re-apply theme when OS color scheme changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleThemeChange = () => {
        if (!chartRef.current) return;
        const t = getChartTheme();
        chartRef.current.applyOptions({
          layout: {
            textColor: t.text,
            background: { type: ColorType.Solid, color: t.bg },
          },
          grid: {
            vertLines: { color: t.border },
            horzLines: { color: t.border },
          },
          timeScale: { borderColor: t.border },
          rightPriceScale: { borderColor: t.border },
        });
        candleSeriesRef.current?.applyOptions({
          upColor: t.buy,
          downColor: t.sell,
          wickUpColor: t.buy,
          wickDownColor: t.sell,
        });
      };
      mediaQuery.addEventListener("change", handleThemeChange);

      const resizeObserver = new ResizeObserver((entries) => {
        if (!chartRef.current) return;
        for (const entry of entries) {
          const { width } = entry.contentRect;
          if (width > 0) {
            chartRef.current.applyOptions({ width });
            chartRef.current.timeScale().fitContent();
          }
        }
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        mediaQuery.removeEventListener("change", handleThemeChange);
        resizeObserver.disconnect();
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    } catch (err) {
      setError((err as Error).message);
    }
  }, [symbol]);

  // Load OHLC data
  useEffect(() => {
    if (!symbol || !chartRef.current || !candleSeriesRef.current) return;

    const loadOHLC = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/market-data/ohlc?symbol=${symbol}&timeframe=${timeframe}`,
          { headers: getAuthHeaders() }
        );
        if (!response.ok) {
          throw new Error("Failed to load OHLC data");
        }

        const data = await response.json();
        const rawCandles: OHLC[] = data.candles || [];

        const filteredCandles = rawCandles.filter((candle) => {
          const candleDate = new Date(Number(candle.time) * 1000);
          if (startDate && candleDate < startDate) return false;
          if (endDate && candleDate > endDate) return false;
          return true;
        });

        setCandles(filteredCandles);
        candleSeriesRef.current!.setData(filteredCandles);
        chartRef.current!.timeScale().fitContent();
      } catch (err) {
        setError((err as Error).message);
        console.error("OHLC load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadOHLC();
  }, [symbol, timeframe, startDate, endDate]);

  // Load signals overlay
  useEffect(() => {
    if (!symbol || !candleSeriesRef.current) return;

    const loadSignals = async () => {
      try {
        const response = await fetch(
          `/api/signals/confluence?symbol=${symbol}`,
          { headers: getAuthHeaders() }
        );
        if (!response.ok) throw new Error("Failed to load signals");

        const data = await response.json();
        const theme = getChartTheme();
        const signalMarks: SignalMark[] = (data.signals || []).map(
          (sig: any) => ({
            time: sig.timestamp,
            position: sig.direction === "buy" ? "belowBar" : "aboveBar",
            color: sig.direction === "buy" ? theme.buy : theme.sell,
            shape: sig.direction === "buy" ? "arrowUp" : "arrowDown",
            text: `${sig.confidence.toFixed(2)}`,
            signal: sig,
          })
        );

        setSignals(signalMarks);
        createSeriesMarkers(candleSeriesRef.current as any, signalMarks as any);

        signalMarks.forEach((mark) => {
          signalMarkersRef.current!.set(mark.time, mark);
        });
      } catch (err) {
        console.error("Signal load error:", err);
      }
    };

    loadSignals();
  }, [symbol]);

  // Handle signal highlighting
  useEffect(() => {
    if (!selectedSignal || !candleSeriesRef.current) return;

    const relevantSignals = signals.map((mark) => {
      if (mark.signal?.id === selectedSignal?.id) {
        return { ...mark, color: getCSSVar("--color-warning") || "#ec7e00", shape: "square" as const };
      }
      return mark;
    });

    createSeriesMarkers(candleSeriesRef.current as any, relevantSignals as any);
  }, [selectedSignal, signals]);

  if (error) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface)" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--color-sell)", fontWeight: "var(--font-weight-bold)" as any }}>Error al cargar el gráfico</p>
          <p style={{ color: "var(--color-sell)", fontSize: "var(--font-size-sm)" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", zIndex: 10 }}>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>Cargando gráfico...</p>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ flex: 1, width: "100%", position: "relative", minHeight: 340 }}
      />
      <div style={{ padding: "0.4rem 1rem", borderTop: "1px solid var(--color-border)", background: "var(--color-surface)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", display: "flex", justifyContent: "space-between" }}>
        <span>{symbol} · {timeframe}{candles.length > 0 ? ` · ${candles.length} velas` : ""}</span>
        <span>
          {selectedSignal
            ? `Señal: ${selectedSignal.symbol} @ ${selectedSignal.confidence?.toFixed(2) || "?"}`
            : "Selecciona una señal de la tabla de confluencia"}
        </span>
      </div>
    </div>
  );
};

export default SuperChart;
