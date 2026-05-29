import React, { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi
} from "lightweight-charts";
import type { FundamentalProjection } from "./FundamentalAnalysisModal";

interface Props {
  projection: FundamentalProjection;
}

function fmtMoney(value: number | string): string {
  if (typeof value === "string") return value;
  return `$${value.toFixed(2)}`;
}

function fmtPnL(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

function buildCandles(projection: FundamentalProjection) {
  // Deterministic PRNG seeded by ticker so useMemo output stays stable
  let seed = projection.ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + projection.days;
  const rand = () => {
    seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
    return (seed >>> 0) / 0xffffffff;
  };

  // Daily volatility fraction: derived from expected move, similar to real stocks
  const dailyVolFrac = Math.max(0.004, (projection.expectedMovePercent / 100) / Math.sqrt(Math.max(1, projection.days)));

  return projection.path.map((point, index) => {
    const prevBase = index === 0 ? projection.initialPrice : projection.path[index - 1].basePrice;
    const currBase = point.basePrice;

    // Add realistic session noise around the trend, biased toward the trend direction
    const trendBias = (currBase - prevBase) * 0.1;
    const open  = Math.max(0.01, prevBase + trendBias * (rand() - 0.4) + prevBase * dailyVolFrac * (rand() - 0.5));
    const close = Math.max(0.01, currBase + trendBias * (rand() - 0.4) + currBase * dailyVolFrac * (rand() - 0.5));

    const bodyHigh = Math.max(open, close);
    const bodyLow  = Math.min(open, close);

    // Wicks proportional to body or price — realistic 30–90% extension
    const wickMult = dailyVolFrac * (0.4 + rand() * 0.8);
    const high = bodyHigh + bodyHigh * wickMult;
    const low  = Math.max(0.01, bodyLow  - bodyLow  * wickMult);

    return { time: point.date as any, open, high, low, close };
  });
}

export function ProjectionSimulationPanel({ projection }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);

  const finalPoint = projection.path[projection.path.length - 1];
  const candles = useMemo(() => buildCandles(projection), [projection]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        textColor: "#1f2937",
        background: { type: ColorType.Solid, color: "#ffffff" }
      },
      width: containerRef.current.clientWidth,
      height: Math.max(containerRef.current.clientHeight, 340),
      grid: {
        vertLines: { color: "#eef2f7" },
        horzLines: { color: "#eef2f7" }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false
      },
      rightPriceScale: {
        borderColor: "#e5e7eb"
      }
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80",
      downColor: "#ef4444",
      borderUpColor: "#4ade80",
      borderDownColor: "#ef4444",
      wickUpColor: "#4ade80",
      wickDownColor: "#ef4444"
    });
    candleSeries.setData(candles);
    candleSeriesRef.current = candleSeries;

    if (projection.path.length > 0) {
      const first = projection.path[0];
      const last = projection.path[projection.path.length - 1];
      createSeriesMarkers(candleSeries as any, [
        {
          time: first.date,
          position: "belowBar",
          color: "#2563eb",
          shape: "circle",
          text: "Inicio"
        },
        {
          time: last.date,
          position: "aboveBar",
          color: projection.verdict === "NO_VIABLE" ? "#dc2626" : projection.verdict === "MARGINAL" ? "#d29922" : "#16a34a",
          shape: "square",
          text: projection.verdict
        }
      ] as any);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: Math.max(containerRef.current.clientHeight, 340)
      });
      chart.timeScale().fitContent();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [candles, projection]);

  const riskColor = projection.verdict === "VIABLE"
    ? "var(--color-buy)"
    : projection.verdict === "MARGINAL"
      ? "var(--color-hold)"
      : "var(--color-sell)";

  return (
    <section className="card" style={{ display: "grid", gap: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0 }}>Proyeccion de simulacion</h2>
          <p style={{ marginTop: "0.25rem", fontSize: "0.82rem" }}>
            {projection.ticker} - {projection.projectionFrom} {"->"} {projection.projectionTo}
          </p>
        </div>
        <div style={{
          border: `1px solid ${riskColor}`,
          color: riskColor,
          borderRadius: "var(--radius-sm)",
          padding: "0.25rem 0.65rem",
          fontWeight: 800,
          fontSize: "0.78rem"
        }}>
          {projection.verdict} - {projection.score}/100
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "0.6rem"
      }}>
        {[
          ["Precio inicial", fmtMoney(projection.initialPrice)],
          ["Movimiento esperado", `+/- ${fmtMoney(projection.expectedMove)} (${projection.expectedMovePercent.toFixed(1)}%)`],
          ["Strike", fmtMoney(projection.strike)],
          ["Prima", fmtMoney(projection.premium)],
          ["Breakeven", fmtMoney(projection.breakeven)],
          ["Perdida maxima", fmtMoney(projection.maxLoss)]
        ].map(([label, value]) => (
          <div key={label} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.6rem" }}>
            <div style={{ fontSize: "0.66rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {label}
            </div>
            <div style={{ marginTop: "0.2rem", fontWeight: 800, color: "var(--color-text)" }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        background: "#ffffff"
      }}>
        <div ref={containerRef} style={{ minHeight: 340, width: "100%" }} />
        <div style={{
          padding: "0.5rem 1rem",
          borderTop: "1px solid #e5e7eb",
          background: "#f9fafb",
          color: "#4b5563",
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          fontSize: "0.75rem"
        }}>
          <span>{projection.ticker} - {projection.days} dias simulados - {candles.length} velas</span>
          <span>
            Base {finalPoint ? fmtMoney(finalPoint.basePrice) : "N/D"} |
            Alcista {finalPoint ? fmtMoney(finalPoint.bullishPrice) : "N/D"} |
            Bajista {finalPoint ? fmtMoney(finalPoint.bearishPrice) : "N/D"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap", alignItems: "center", fontSize: "0.78rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: 12, height: 12, background: "#4ade80", display: "inline-block", borderRadius: 2 }} />
          <span style={{ fontWeight: 700 }}>Vela alcista (cuerpo: precio base, mecha alta: escenario alcista)</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: 12, height: 12, background: "#ef4444", display: "inline-block", borderRadius: 2 }} />
          <span style={{ fontWeight: 700 }}>Vela bajista (cuerpo: precio base, mecha baja: escenario bajista)</span>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
        {projection.scenarios.map((scenario) => (
          <div key={scenario.label} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.65rem" }}>
            <strong>{scenario.label}</strong>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem" }}>
              Precio {fmtMoney(scenario.price)} - P&L <span style={{ color: scenario.profitLoss >= 0 ? "var(--color-buy)" : "var(--color-sell)", fontWeight: 800 }}>{fmtPnL(scenario.profitLoss)}</span>
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: "0.5rem" }}>
        <strong style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", textTransform: "uppercase" }}>Razones fundamentales</strong>
        <ul style={{ marginLeft: "1rem", color: "var(--color-text-muted)", fontSize: "0.78rem" }}>
          {projection.drivers.slice(0, 4).map((driver) => <li key={driver}>{driver}</li>)}
        </ul>
      </div>
    </section>
  );
}

export default ProjectionSimulationPanel;
