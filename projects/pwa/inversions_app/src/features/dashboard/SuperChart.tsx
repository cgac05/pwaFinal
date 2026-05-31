import React, { useEffect, useRef, useState } from "react";
import { createSeriesMarkers, LineSeries, LineStyle } from "lightweight-charts";
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
  const bullishSeriesRef = useRef<any>(null);
  const bearishSeriesRef = useRef<any>(null);
  const supportResistanceLinesRef = useRef<any[]>([]);
  const trendSeriesRef = useRef<Array<{ series: any; direction: "ALCISTA" | "BAJISTA" }>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candles, setCandles] = useState<OHLC[]>([]);
  const [signals, setSignals] = useState<SignalMark[]>([]);
  const [dataSource, setDataSource] = useState<"tradier" | "yahoo" | "mock" | null>(null);

  const [srWindow, setSrWindow] = useState<number>(20);
  const [trendWindow, setTrendWindow] = useState<number>(5);
  const [mostrarAlcistas, setMostrarAlcistas] = useState<boolean>(true);
  const [mostrarBajistas, setMostrarBajistas] = useState<boolean>(false);
  const [techData, setTechData] = useState<any>(null);

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

  // ── Load Technical Analysis (supports, resistances, trendlines) ────────────
  useEffect(() => {
    if (!symbol || !chartRef.current || !candleSeriesRef.current) return;

    const loadTechnicalAnalysis = async () => {
      try {
        const response = await fetch("/api/indicators/technical-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            symbol,
            timeframe,
            count: 300,
            supportResistanceWindow: srWindow,
            trendWindow: trendWindow,
            clusterTolerance: 0.005,
          }),
        });

        if (!response.ok) throw new Error("Failed to load technical analysis");

        const data = await response.json();
        setTechData(data);

        // 1. Draw horizontal Support / Resistance lines
        if (candleSeriesRef.current) {
          const candleSeries = candleSeriesRef.current;
          supportResistanceLinesRef.current.forEach((line) => {
            candleSeries.removePriceLine(line);
          });
          supportResistanceLinesRef.current = [];

          if (data.supports) {
            data.supports.forEach((level: any) => {
              const priceLine = candleSeries.createPriceLine({
                price: level.price,
                color: "rgba(0,168,126,0.6)",
                lineStyle: LineStyle.Dashed,
                lineWidth: 2,
                axisLabelVisible: true,
                title: `S(${level.touches})`,
              });
              supportResistanceLinesRef.current.push(priceLine);
            });
          }

          if (data.resistances) {
            data.resistances.forEach((level: any) => {
              const priceLine = candleSeries.createPriceLine({
                price: level.price,
                color: "rgba(226,59,74,0.6)",
                lineStyle: LineStyle.Dashed,
                lineWidth: 2,
                axisLabelVisible: true,
                title: `R(${level.touches})`,
              });
              supportResistanceLinesRef.current.push(priceLine);
            });
          }
        }

        // 2. Draw diagonal Trendlines
        if (chartRef.current) {
          // Initialize series if not present
          if (!bullishSeriesRef.current) {
            bullishSeriesRef.current = chartRef.current.addSeries(LineSeries, {
              color: "#2196f3",
              lineWidth: 3,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            }, 0);
          }
          if (!bearishSeriesRef.current) {
            bearishSeriesRef.current = chartRef.current.addSeries(LineSeries, {
              color: "#ef5350",
              lineWidth: 3,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            }, 0);
          }

          // Apply visibility
          bullishSeriesRef.current.applyOptions({ visible: mostrarAlcistas });
          bearishSeriesRef.current.applyOptions({ visible: mostrarBajistas });

          // Populate data: use filter() to draw ALL lines per direction
          trendSeriesRef.current.forEach(({ series }) => {
            try { chartRef.current!.removeSeries(series); } catch { /* already removed */ }
          });
          trendSeriesRef.current = [];

          const allLines: any[] = data.trendLines ?? [];
          allLines.forEach((tl: any) => {
            const isBullish = tl.direction === "ALCISTA";
            const s = chartRef.current!.addSeries(LineSeries, {
              color: isBullish ? "rgba(0,168,126,0.7)" : "rgba(226,59,74,0.7)",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
              visible: isBullish ? mostrarAlcistas : mostrarBajistas,
            }, 0);
            s.setData([
              { time: tl.p1.time as any, value: tl.p1.price },
              { time: tl.pEnd.time as any, value: tl.pEnd.price },
            ]);
            trendSeriesRef.current.push({ series: s, direction: tl.direction });
          });

          // Sync legacy single refs (kept for compat)
          bullishSeriesRef.current = trendSeriesRef.current.find(x => x.direction === "ALCISTA")?.series ?? null;
          bearishSeriesRef.current = trendSeriesRef.current.find(x => x.direction === "BAJISTA")?.series ?? null;
        }
      } catch (err) {
        console.error("Technical analysis load error:", err);
      }
    };

    loadTechnicalAnalysis();
  }, [symbol, timeframe, srWindow, trendWindow]);

  // Handle client-side visibility updates for ALL trendline series
  useEffect(() => {
    trendSeriesRef.current.forEach(({ series, direction }) => {
      const visible = direction === "ALCISTA" ? mostrarAlcistas : mostrarBajistas;
      series.applyOptions({ visible });
    });
  }, [mostrarAlcistas, mostrarBajistas]);

  // Clean up all drawings on unmount or symbol change
  useEffect(() => {
    return () => {
      if (candleSeriesRef.current) {
        const candleSeries = candleSeriesRef.current;
        supportResistanceLinesRef.current.forEach((line) => {
          candleSeries.removePriceLine(line);
        });
        supportResistanceLinesRef.current = [];
      }
      trendSeriesRef.current.forEach(({ series }) => {
        try { chartRef.current?.removeSeries(series); } catch { /* already removed */ }
      });
      trendSeriesRef.current = [];
      bullishSeriesRef.current = null;
      bearishSeriesRef.current = null;
    };
  }, [symbol]);

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
 
      {/* ── Technical Analysis Panel ───────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "10px 16px",
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-surface)",
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text)",
          flexShrink: 0,
          gap: "24px",
        }}
      >
        <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
          {/* Soportes / Resistencias Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Soportes / Resistencias
              </span>
              <span style={{ fontSize: "10px", color: "var(--color-text-muted)", background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: "3px" }}>
                {techData ? `${techData.resistances?.length ?? 0}R / ${techData.supports?.length ?? 0}S` : "0R / 0S"}
              </span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Ventana</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {[5, 10, 15, 20, 50].map((w) => (
                  <button
                    key={w}
                    onClick={() => setSrWindow(w)}
                    style={{
                      padding: "2px 8px",
                      fontSize: "10px",
                      borderRadius: "3px",
                      border: "1px solid var(--color-border)",
                      background: srWindow === w ? "var(--color-accent)" : "transparent",
                      color: srWindow === w ? "#fff" : "var(--color-text-muted)",
                      cursor: "pointer",
                      fontWeight: srWindow === w ? 600 : "normal",
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", fontSize: "10px", marginTop: "2px", color: "var(--color-text-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "0px", borderBottom: "1.5px dashed rgba(226,59,74,0.8)" }}></span>
                Resistencia
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "0px", borderBottom: "1.5px dashed rgba(0,168,126,0.8)" }}></span>
                Soporte
              </span>
            </div>
          </div>

          {/* Tendencias Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Tendencias
              </span>
              <span style={{ fontSize: "10px", color: "var(--color-text-muted)", background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: "3px" }}>
                {techData ? `${techData.trendLines?.filter((l: any) => l.direction === "ALCISTA").length ?? 0}A / ${techData.trendLines?.filter((l: any) => l.direction === "BAJISTA").length ?? 0}V` : "0A / 0V"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Ventana</span>
              <div style={{ display: "flex", gap: "4px" }}>
                {[5, 10, 15, 20, 50].map((w) => (
                  <button
                    key={w}
                    onClick={() => setTrendWindow(w)}
                    style={{
                      padding: "2px 8px",
                      fontSize: "10px",
                      borderRadius: "3px",
                      border: "1px solid var(--color-border)",
                      background: trendWindow === w ? "var(--color-accent)" : "transparent",
                      color: trendWindow === w ? "#fff" : "var(--color-text-muted)",
                      cursor: "pointer",
                      fontWeight: trendWindow === w ? 600 : "normal",
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
              <button
                onClick={() => setMostrarAlcistas(!mostrarAlcistas)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "1px 8px",
                  fontSize: "10px",
                  borderRadius: "3px",
                  border: `1px solid ${mostrarAlcistas ? "rgba(0,168,126,0.6)" : "var(--color-border)"}`,
                  background: mostrarAlcistas ? "rgba(0,168,126,0.15)" : "transparent",
                  color: mostrarAlcistas ? "var(--color-buy)" : "var(--color-text-muted)",
                  cursor: "pointer",
                }}
              >
                ▲ Alcistas
              </button>
              <button
                onClick={() => setMostrarBajistas(!mostrarBajistas)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "1px 8px",
                  fontSize: "10px",
                  borderRadius: "3px",
                  border: `1px solid ${mostrarBajistas ? "rgba(226,59,74,0.6)" : "var(--color-border)"}`,
                  background: mostrarBajistas ? "rgba(226,59,74,0.15)" : "transparent",
                  color: mostrarBajistas ? "var(--color-sell)" : "var(--color-text-muted)",
                  cursor: "pointer",
                }}
              >
                ▼ Bajistas
              </button>
            </div>
          </div>
        </div>

        {/* Trend Verdict Badge */}
        {techData && techData.trend && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: techData.trend === "ALCISTA" ? "var(--color-buy)" : techData.trend === "BAJISTA" ? "var(--color-sell)" : "var(--color-text-muted)",
                background: techData.trend === "ALCISTA" ? "rgba(0,168,126,0.12)" : techData.trend === "BAJISTA" ? "rgba(226,59,74,0.12)" : "rgba(255,255,255,0.06)",
                padding: "3px 10px",
                borderRadius: "var(--radius-pill)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {techData.trend === "ALCISTA" ? "▲ " : techData.trend === "BAJISTA" ? "▼ " : "— "}
              {techData.trend} - {techData.trendStrength || "NEUTRAL"}
            </span>
          </div>
        )}
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
