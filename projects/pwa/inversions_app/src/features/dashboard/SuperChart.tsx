import React, { useEffect, useRef, useState } from "react";
import { createSeriesMarkers } from "lightweight-charts";
import { useSignalStore } from "../../store/signals";
import { getAuthHeaders } from "../../services/signals/signalApi";
import { Badge } from "../../components/ui/Badge";
import { ChartLegend } from "./ChartLegend";
import { useChartInit, type ActiveIndicators } from "./useChartInit";
import {
  calcRSI,
  calcMACD,
  calcBollingerBands,
} from "../../utils/indicators";

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

function getCSSVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const INDICATOR_META: {
  key: keyof ActiveIndicators;
  label: string;
  color: string;
}[] = [
  { key: "rsi", label: "RSI", color: "#7b61ff" },
  { key: "macd", label: "MACD", color: "#2196f3" },
  { key: "bb", label: "BB", color: "#f5c518" },
];

// ── SuperChart ──────────────────────────────────────────────────────────────

export const SuperChart: React.FC<SuperChartProps> = ({
  symbol,
  timeframe = "1d",
  startDate,
  endDate,
  onSelectSignal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const signalMarkersRef = useRef<Map<string, SignalMark>>(new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candles, setCandles] = useState<OHLC[]>([]);
  const [signals, setSignals] = useState<SignalMark[]>([]);
  const [dataSource, setDataSource] = useState<"tradier" | "yahoo" | "mock" | null>(null);

  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicators>(() => {
    try {
      const saved = localStorage.getItem("superchart_indicators");
      if (saved) return JSON.parse(saved) as ActiveIndicators;
    } catch {
      // ignore
    }
    return { rsi: true, macd: false, bb: false };
  });

  const { selectedSignal } = useSignalStore();

  const {
    chartRef,
    candleSeriesRef,
    volumeSeriesRef,
    rsiSeriesRef,
    macdLineRef,
    macdSignalRef,
    macdHistRef,
    bbUpperRef,
    bbMiddleRef,
    bbLowerRef,
    candlesDataRef,
    legendData,
    setLegendData,
  } = useChartInit(containerRef, symbol, timeframe, activeIndicators);

  const toggleIndicator = (key: keyof ActiveIndicators) => {
    setActiveIndicators(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("superchart_indicators", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // ── Load OHLC + populate all series ──────────────────────────────────────
  useEffect(() => {
    if (!symbol || !chartRef.current || !candleSeriesRef.current) return;

    const loadOHLC = async () => {
      try {
        setLoading(true);
        setError(null);

        const startParam = startDate ? `&startDate=${startDate.toISOString()}` : "";
        const response = await fetch(
          `/api/market-data/ohlc?symbol=${symbol}&timeframe=${timeframe}${startParam}`,
          { headers: getAuthHeaders() },
        );
        if (!response.ok) throw new Error("Failed to load OHLC data");

        const data = await response.json();
        setDataSource(data.source ?? "mock");
        const rawCandles: OHLC[] = data.candles || [];

        const filtered = rawCandles.filter(c => {
          const d = new Date(Number(c.time) * 1000);
          if (startDate && d < startDate) return false;
          if (endDate && d > endDate) return false;
          return true;
        });

        setCandles(filtered);
        candlesDataRef.current = filtered;
        candleSeriesRef.current!.setData(filtered as any);

        // Populate legend immediately with the last candle so it's visible before any mouse interaction
        if (filtered.length > 0) {
          const last = filtered[filtered.length - 1];
          const prev = filtered.length > 1 ? filtered[filtered.length - 2] : null;
          setLegendData({
            symbol: symbol!,
            timeframe,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            volume: last.volume ?? 0,
            prevClose: prev?.close ?? null,
          });
        }

        // Volume — inherit candle color at 50% opacity
        volumeSeriesRef.current?.setData(
          filtered.map(c => ({
            time: c.time,
            value: c.volume ?? 0,
            color:
              c.close >= c.open
                ? "rgba(0,168,126,0.5)"
                : "rgba(226,59,74,0.5)",
          })) as any,
        );

        // RSI
        rsiSeriesRef.current?.setData(calcRSI(filtered) as any);

        // MACD
        const macdData = calcMACD(filtered);
        macdLineRef.current?.setData(
          macdData.map(d => ({ time: d.time, value: d.macd })) as any,
        );
        macdSignalRef.current?.setData(
          macdData.map(d => ({ time: d.time, value: d.signal })) as any,
        );
        macdHistRef.current?.setData(
          macdData.map(d => ({
            time: d.time,
            value: d.histogram,
            color: d.macd >= d.signal ? "#26a69a" : "#ef5350",
          })) as any,
        );

        // Bollinger Bands
        const bbData = calcBollingerBands(filtered);
        bbUpperRef.current?.setData(
          bbData.map(d => ({ time: d.time, value: d.upper })) as any,
        );
        bbMiddleRef.current?.setData(
          bbData.map(d => ({ time: d.time, value: d.middle })) as any,
        );
        bbLowerRef.current?.setData(
          bbData.map(d => ({ time: d.time, value: d.lower })) as any,
        );

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

  // ── Load signal markers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!symbol || !candleSeriesRef.current) return;

    const loadSignals = async () => {
      try {
        const response = await fetch(
          `/api/signals/confluence?symbol=${symbol}`,
          { headers: getAuthHeaders() },
        );
        if (!response.ok) throw new Error("Failed to load signals");

        const data = await response.json();
        const buy = getCSSVar("--color-buy") || "#00a87e";
        const sell = getCSSVar("--color-sell") || "#e23b4a";

        const marks: SignalMark[] = (data.signals || []).map((sig: any) => ({
          time: sig.timestamp,
          position: sig.direction === "buy" ? "belowBar" : "aboveBar",
          color: sig.direction === "buy" ? buy : sell,
          shape: sig.direction === "buy" ? "arrowUp" : "arrowDown",
          text: `${sig.confidence.toFixed(2)}`,
          signal: sig,
        }));

        setSignals(marks);
        createSeriesMarkers(candleSeriesRef.current as any, marks as any);
        marks.forEach(m => signalMarkersRef.current.set(m.time, m));
      } catch (err) {
        console.error("Signal load error:", err);
      }
    };

    loadSignals();
  }, [symbol]);

  // ── Highlight selected signal ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSignal || !candleSeriesRef.current) return;

    const highlighted = signals.map(m =>
      m.signal?.id === selectedSignal?.id
        ? { ...m, color: getCSSVar("--color-warning") || "#ec7e00", shape: "square" as const }
        : m,
    );
    createSeriesMarkers(candleSeriesRef.current as any, highlighted as any);
  }, [selectedSignal, signals]);

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-surface)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--color-sell)", fontWeight: "var(--font-weight-bold)" as any }}>
            Error al cargar el gráfico
          </p>
          <p style={{ color: "var(--color-sell)", fontSize: "var(--font-size-sm)" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
      }}
    >
      {/* ── Indicator controls ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface)",
          flexShrink: 0,
        }}
      >
        {INDICATOR_META.map(({ key, label, color }) => {
          const active = activeIndicators[key];
          return (
            <button
              key={key}
              onClick={() => toggleIndicator(key)}
              style={{
                padding: "2px 10px",
                fontSize: "var(--font-size-xs)",
                fontWeight: "var(--font-weight-emphasis)",
                borderRadius: 3,
                cursor: "pointer",
                border: `1px solid ${active ? color : "rgba(255,255,255,0.15)"}`,
                background: active ? color : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.45)",
                transition: "all 0.15s",
                letterSpacing: "0.04em",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Chart area ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.4)",
              zIndex: 10,
            }}
          >
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              Cargando gráfico...
            </p>
          </div>
        )}

        <ChartLegend data={legendData} />

        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%", minHeight: 340 }}
        />
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "0.4rem 1rem",
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text-muted)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {symbol} · {timeframe}
          {candles.length > 0 ? ` · ${candles.length} velas` : ""}
          {dataSource === "mock" && <Badge label="DEMO" color="var(--color-warning)" size="sm" />}
          {dataSource === "yahoo" && <Badge label="Yahoo" color="var(--color-text-muted)" size="sm" />}
          {dataSource === "tradier" && <Badge label="Live" color="var(--color-buy)" size="sm" />}
        </span>
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
