// FIC: TechnicalAnalysisExtendedSection — reads from POST /api/indicators/technical-analysis. (EN)
// FIC: TechnicalAnalysisExtendedSection — lee de POST /api/indicators/technical-analysis. (ES)
// No new endpoints. No recalculation. Uses only: trend, trendStrength, adxValue,
// ema20, ema50, lastClose, supports, resistances, trendLines.

import React, { useEffect, useState } from "react";
import { getAuthHeaders } from "../../services/signals/signalApi";

// ─── Types (mirrors backend TechnicalAnalysisResult) ─────────────────────────

interface PriceLevel {
  price: number;
  touches: number;
  strength: "DEBIL" | "MODERADO" | "FUERTE";
}

interface TrendLine {
  direction: "ALCISTA" | "BAJISTA";
  p1: { time: string; price: number };
  pEnd: { time: string; price: number };
}

interface TechData {
  trend: string;
  trendStrength: string;
  adxValue: number | null;
  ema20: number | null;
  ema50: number | null;
  lastClose: number | null;
  supports: PriceLevel[];
  resistances: PriceLevel[];
  trendLines: TrendLine[];
}

interface Props {
  symbol: string;
  timeframe?: string;
}

// ─── Interpretation helpers ───────────────────────────────────────────────────

function interpretTrend(d: TechData): string {
  if (d.trend === "ALCISTA") return "Tendencia alcista confirmada";
  if (d.trend === "BAJISTA") return "Tendencia bajista confirmada";
  return "Mercado en rango lateral";
}

function interpretStrength(d: TechData): string {
  const s = d.trendStrength?.toLowerCase() ?? "";
  if (s === "fuerte") return "Fuerza de tendencia elevada";
  if (s === "moderado") return "Fuerza de tendencia moderada";
  if (s === "debil" || s === "débil") return "Tendencia débil";
  return "Sin tendencia definida";
}

function interpretEma(d: TechData): string {
  const { lastClose: p, ema20, ema50 } = d;
  if (p === null || ema20 === null || ema50 === null) return "Medias no disponibles";
  if (p > ema20 && p > ema50 && ema20 > ema50) return "Precio por encima de EMA20 y EMA50 — alcista";
  if (p < ema20 && p < ema50 && ema20 < ema50) return "Precio por debajo de EMA20 y EMA50 — bajista";
  if (p > ema20 && p > ema50) return "Precio sobre ambas medias";
  if (p < ema20 && p < ema50) return "Precio bajo ambas medias";
  return "Precio entre EMA20 y EMA50 — zona de transición";
}

function interpretAdx(d: TechData): string {
  const adx = d.adxValue;
  if (adx === null) return "ADX no disponible";
  if (adx >= 40) return `ADX ${adx.toFixed(1)} — tendencia muy fuerte`;
  if (adx >= 25) return `ADX ${adx.toFixed(1)} — tendencia fuerte`;
  if (adx >= 15) return `ADX ${adx.toFixed(1)} — tendencia débil`;
  return `ADX ${adx.toFixed(1)} — mercado sin tendencia`;
}

function interpretRisk(d: TechData): string {
  const { lastClose: p, supports, resistances } = d;
  if (p === null) return "Precio no disponible";
  const nearestSupport = supports.find(s => s.price < p);
  const nearestResistance = resistances.find(r => r.price > p);
  const parts: string[] = [];
  if (nearestSupport) {
    const pct = ((p - nearestSupport.price) / p * 100).toFixed(1);
    parts.push(`Soporte más cercano: $${nearestSupport.price.toFixed(2)} (${pct}% abajo)`);
  }
  if (nearestResistance) {
    const pct = ((nearestResistance.price - p) / p * 100).toFixed(1);
    parts.push(`Resistencia más cercana: $${nearestResistance.price.toFixed(2)} (${pct}% arriba)`);
  }
  if (parts.length === 0) return "Sin niveles clave identificados";
  return parts.join(" · ");
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "var(--space-md)",
};

const subCard: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-md)",
  border: "1px solid var(--color-border-subtle)",
};

const subTitle: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-accent)",
  marginBottom: "var(--space-sm)",
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "3px 0",
  borderBottom: "1px solid var(--color-border-subtle)",
  fontSize: "var(--font-size-xs)",
  gap: "var(--space-sm)",
};

const labelStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  flexShrink: 0,
};

const valueStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--color-text)",
  textAlign: "right",
};

const trendColor = (t: string) =>
  t === "ALCISTA" ? "var(--color-buy)"
  : t === "BAJISTA" ? "var(--color-sell)"
  : "var(--color-text-muted)";

// ─── Component ────────────────────────────────────────────────────────────────

export function TechnicalAnalysisExtendedSection({ symbol, timeframe = "1d" }: Props) {
  const [data, setData]       = useState<TechData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch("/api/indicators/technical-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ symbol, timeframe, count: 300 }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TechData>;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message ?? "Error al cargar análisis técnico");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  if (loading) {
    return (
      <section className="card" style={{ padding: "var(--space-lg)" }}>
        <h2 style={{ margin: "0 0 var(--space-md)", fontSize: "var(--font-size-base)" }}>
          Análisis Técnico Extendido
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          Cargando análisis técnico…
        </p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="card" style={{ padding: "var(--space-lg)", opacity: 0.7 }}>
        <h2 style={{ margin: "0 0 var(--space-md)", fontSize: "var(--font-size-base)" }}>
          Análisis Técnico Extendido
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          {error ?? "Sin datos. Ejecuta una simulación primero."}
        </p>
      </section>
    );
  }

  const bullLines  = data.trendLines.filter(t => t.direction === "ALCISTA").length;
  const bearLines  = data.trendLines.filter(t => t.direction === "BAJISTA").length;
  const topSupports    = data.supports.slice(0, 3);
  const topResistances = data.resistances.slice(0, 3);

  return (
    <section className="card" style={{ padding: "var(--space-lg)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>
          Análisis Técnico Extendido
        </h2>
        <span style={{
          fontSize: "var(--font-size-xs)", fontWeight: 700,
          color: trendColor(data.trend),
          border: `1px solid ${trendColor(data.trend)}`,
          borderRadius: "var(--radius-xs)", padding: "2px 10px",
        }}>
          {data.trend}
        </span>
      </div>

      <div style={cardGrid}>

        {/* 1. Tendencia General */}
        <div style={subCard}>
          <div style={subTitle}>Tendencia General</div>
          <div style={row}>
            <span style={labelStyle}>Dirección</span>
            <span style={{ ...valueStyle, color: trendColor(data.trend) }}>{interpretTrend(data)}</span>
          </div>
          <div style={row}>
            <span style={labelStyle}>Fuerza</span>
            <span style={valueStyle}>{interpretStrength(data)}</span>
          </div>
          <div style={row}>
            <span style={labelStyle}>EMA</span>
            <span style={valueStyle}>{interpretEma(data)}</span>
          </div>
          {data.ema20 !== null && (
            <div style={row}>
              <span style={labelStyle}>EMA20 / EMA50</span>
              <span style={valueStyle}>${data.ema20.toFixed(2)} / ${data.ema50?.toFixed(2) ?? "—"}</span>
            </div>
          )}
          {data.lastClose !== null && (
            <div style={{ ...row, borderBottom: "none" }}>
              <span style={labelStyle}>Último cierre</span>
              <span style={valueStyle}>${data.lastClose.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* 2. Momentum */}
        <div style={subCard}>
          <div style={subTitle}>Momentum</div>
          <div style={row}>
            <span style={labelStyle}>ADX</span>
            <span style={valueStyle}>{interpretAdx(data)}</span>
          </div>
          <div style={row}>
            <span style={labelStyle}>Clasificación</span>
            <span style={valueStyle}>{interpretStrength(data)}</span>
          </div>
          <div style={{ ...row, borderBottom: "none" }}>
            <span style={labelStyle}>Líneas de tendencia</span>
            <span style={valueStyle}>
              <span style={{ color: "var(--color-buy)" }}>{bullLines} alcistas</span>
              {" · "}
              <span style={{ color: "var(--color-sell)" }}>{bearLines} bajistas</span>
            </span>
          </div>
        </div>

        {/* 3. Estructura de Mercado */}
        <div style={subCard}>
          <div style={subTitle}>Estructura de Mercado</div>
          {topResistances.length > 0 && (
            <>
              <div style={{ ...labelStyle, marginBottom: "2px" }}>Resistencias</div>
              {topResistances.map((r, i) => (
                <div key={i} style={row}>
                  <span style={{ ...labelStyle, color: "var(--color-sell)" }}>R{i + 1}</span>
                  <span style={valueStyle}>${r.price.toFixed(2)} · {r.touches} toc. · {r.strength}</span>
                </div>
              ))}
            </>
          )}
          {topSupports.length > 0 && (
            <>
              <div style={{ ...labelStyle, marginTop: "var(--space-xs)", marginBottom: "2px" }}>Soportes</div>
              {topSupports.map((s, i) => (
                <div key={i} style={{ ...row, borderBottom: i === topSupports.length - 1 ? "none" : undefined }}>
                  <span style={{ ...labelStyle, color: "var(--color-buy)" }}>S{i + 1}</span>
                  <span style={valueStyle}>${s.price.toFixed(2)} · {s.touches} toc. · {s.strength}</span>
                </div>
              ))}
            </>
          )}
          {topResistances.length === 0 && topSupports.length === 0 && (
            <p style={{ ...valueStyle, color: "var(--color-text-muted)", margin: 0 }}>
              Sin niveles identificados aún.
            </p>
          )}
        </div>

        {/* 4. Riesgo Técnico */}
        <div style={subCard}>
          <div style={subTitle}>Riesgo Técnico</div>
          <div style={{ ...row, flexDirection: "column", alignItems: "flex-start", gap: "var(--space-xs)", borderBottom: "none" }}>
            <span style={{ ...valueStyle, fontWeight: 400, fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {interpretRisk(data)}
            </span>
          </div>
          <div style={row}>
            <span style={labelStyle}>Soportes activos</span>
            <span style={valueStyle}>{data.supports.length}</span>
          </div>
          <div style={row}>
            <span style={labelStyle}>Resistencias activas</span>
            <span style={valueStyle}>{data.resistances.length}</span>
          </div>
          <div style={{ ...row, borderBottom: "none" }}>
            <span style={labelStyle}>Líneas totales</span>
            <span style={valueStyle}>{data.trendLines.length} ({bullLines}A · {bearLines}B)</span>
          </div>
        </div>

      </div>
    </section>
  );
}

export default TechnicalAnalysisExtendedSection;
