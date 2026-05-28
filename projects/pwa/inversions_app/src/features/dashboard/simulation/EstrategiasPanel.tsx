// FIC: Estrategias Panel — Panel inline de Team 8 para construir y ejecutar estrategias complejas
// Se despliega directamente en el Dashboard al activar el core ESTRATEGIAS.

import React, { useState, useCallback, useMemo } from "react";
import type {
  FromChainResponse,
  StrikeSelection,
} from "../../../services/strategies/strategyApi";
import {
  fetchOptionsChain,
  executeStrategy,
  fetchAccountBalance,
} from "../../../services/strategies/strategyApi";

// ─── Types ──────────────────────────────────────────────

interface EstrategiasForm {
  strategy_type: string;
  ticker: string;
  expiracion: string;
  contratos: number;
  tipo_ala: string;
  tolerancia_riesgo: string;
  estilo_opcion: string;
  strikes: StrikeSelection[];
  portfolio_valor: number;
  portfolio_poder: number;
  portfolio_margen: number;
  portfolio_posiciones: number;
}

interface Props {
  /** Símbolo por defecto (del ticket del panel de simulación) */
  defaultTicker: string;
  /** Callback cuando se ejecuta una estrategia exitosamente */
  onStrategyResult?: (result: FromChainResponse) => void;
}

const STRATEGY_PRESETS: Record<string, { label: string; legs: number; description: string }> = {
  iron_condor: { label: "Iron Condor", legs: 4, description: "2 puts (long+short) + 2 calls (short+long)" },
  iron_butterfly: { label: "Iron Butterfly", legs: 4, description: "2 puts (long+short) + 2 calls (short+long) · mismo strike ATM" },
  butterfly_spread: { label: "Butterfly Spread", legs: 3, description: "3 patas del mismo tipo (long + short 2x + long)" },
  condor: { label: "Condor", legs: 4, description: "4 patas del mismo tipo (long + short + short + long)" },
};

function getLegPattern(type: string): Array<{ tipo: "put" | "call"; posicion: "long" | "short" }> {
  switch (type) {
    case "iron_condor":
    case "iron_butterfly":
      return [
        { tipo: "put", posicion: "long" },
        { tipo: "put", posicion: "short" },
        { tipo: "call", posicion: "short" },
        { tipo: "call", posicion: "long" },
      ];
    case "butterfly_spread":
      return [
        { tipo: "call", posicion: "long" },
        { tipo: "call", posicion: "short" },
        { tipo: "call", posicion: "long" },
      ];
    case "condor":
      return [
        { tipo: "call", posicion: "long" },
        { tipo: "call", posicion: "short" },
        { tipo: "call", posicion: "short" },
        { tipo: "call", posicion: "long" },
      ];
    default:
      return [
        { tipo: "put", posicion: "long" },
        { tipo: "call", posicion: "short" },
      ];
  }
}

function getDefaultStrikes(type: string, baseStrike: number): StrikeSelection[] {
  const patterns = getLegPattern(type);
  if (baseStrike <= 0) {
    return patterns.map((p) => ({ strike: 0, ...p }));
  }

  const offsets: Record<string, number[]> = {
    iron_condor: [-20, 0, 40, 60],
    iron_butterfly: [-40, 0, 0, 40],
    butterfly_spread: [-20, 20, 60],
    condor: [-60, -20, 20, 60],
  };
  const legOffsets = offsets[type] ?? [];
  return patterns.map((p, i) => ({
    ...p,
    strike: baseStrike + (legOffsets[i] ?? 0),
  }));
}

// ─── Sub-components ─────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "0.6rem 0.8rem" }}>
      <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: "1rem", fontWeight: 700, color: color ?? "var(--color-text)" }}>
        {value}
      </div>
    </div>
  );
}

function PayoffChart({ points }: { points: Array<{ precio_subyacente: number; pnl: number }> }) {
  if (!points || points.length === 0) return null;
  const width = 500;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 30, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const prices = points.map((p) => p.precio_subyacente);
  const pnls = points.map((p) => p.pnl);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minPnl = Math.min(...pnls, 0);
  const maxPnl = Math.max(...pnls, 0);
  const rangePnl = maxPnl - minPnl || 1;

  const xScale = (price: number) => padding.left + ((price - minPrice) / (maxPrice - minPrice)) * chartW;
  const yScale = (pnl: number) => padding.top + chartH - ((pnl - minPnl) / rangePnl) * chartH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.precio_subyacente).toFixed(1)},${yScale(p.pnl).toFixed(1)}`)
    .join(" ");

  const zeroY = yScale(0);
  const fillPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.precio_subyacente).toFixed(1)},${yScale(p.pnl).toFixed(1)}`)
    .join(" ");
  const fillPathWithBase = `${fillPath} L${xScale(points[points.length - 1].precio_subyacente).toFixed(1)},${zeroY} L${xScale(points[0].precio_subyacente).toFixed(1)},${zeroY} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="estrategiasPanelPnlGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3fb950" stopOpacity={0.25} />
          <stop offset="50%" stopColor="#3fb950" stopOpacity={0.05} />
          <stop offset="50%" stopColor="#f85149" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#f85149" stopOpacity={0.25} />
        </linearGradient>
      </defs>
      <rect x={padding.left} y={padding.top} width={chartW} height={chartH} fill="#0d1117" rx={4} />
      <line x1={padding.left} y1={zeroY} x2={padding.left + chartW} y2={zeroY} stroke="#30363d" strokeWidth={1} strokeDasharray="4,4" />
      <path d={fillPathWithBase} fill="url(#estrategiasPanelPnlGradient)" />
      <path d={linePath} fill="none" stroke="#58a6ff" strokeWidth={2} strokeLinejoin="round" />
      <text x={padding.left + chartW / 2} y={height - 4} textAnchor="middle" fill="#8b949e" fontSize={10}>Precio Subyacente ($)</text>
      <text x={10} y={padding.top + chartH / 2} textAnchor="middle" fill="#8b949e" fontSize={10} transform={`rotate(-90, 10, ${padding.top + chartH / 2})`}>P&L ($)</text>
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  color: "var(--color-text-muted)",
  marginBottom: "0.2rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

// ─── Panel Content ──────────────────────────────────────

export function EstrategiasPanel({ defaultTicker, onStrategyResult }: Props) {
  const [step, setStep] = useState<"form" | "results">("form");
  const [form, setForm] = useState<EstrategiasForm>(() => ({
    strategy_type: "iron_condor",
    ticker: "",
    expiracion: "",
    contratos: 1,
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "americana",
    strikes: getDefaultStrikes("iron_condor", 0),
    portfolio_valor: 50000,
    portfolio_poder: 25000,
    portfolio_margen: 0,
    portfolio_posiciones: 0,
  }));
  const [loading, setLoading] = useState(false);
  const [loadingStrikes, setLoadingStrikes] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FromChainResponse | null>(null);
  const [lastAutoBaseStrike, setLastAutoBaseStrike] = useState(0);

  const diasVencimiento = useMemo(() => {
    if (!result?.expiracion) return null;
    try {
      const expDate = new Date(result.expiracion);
      const today = new Date();
      return Math.max(0, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    } catch {
      return null;
    }
  }, [result?.expiracion]);

  const updateForm = useCallback(<K extends keyof EstrategiasForm>(key: K, value: EstrategiasForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateStrike = useCallback((index: number, field: keyof StrikeSelection, value: number | string) => {
    setForm((prev) => ({
      ...prev,
      strikes: prev.strikes.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  }, []);

  const resetStrikesForStrategy = useCallback((type: string) => {
    const preset = STRATEGY_PRESETS[type];
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      strategy_type: type,
      strikes: getDefaultStrikes(type, lastAutoBaseStrike > 0 ? lastAutoBaseStrike : 0),
    }));
  }, [lastAutoBaseStrike]);

  const handleAutoAdjustStrikes = useCallback(async () => {
    if (!form.ticker || form.ticker.length < 2) return;
    setError(null);
    setLoadingStrikes(true);
    try {
      const chain = await fetchOptionsChain(form.ticker);
      if (chain && chain.total_contratos > 0) {
        const midStrike = Math.round(
          (chain.resumen.call_strike_min + chain.resumen.call_strike_max) / 2
        );
        const roundedBase = Math.round(midStrike / 5) * 5;
        setLastAutoBaseStrike(roundedBase);
        setForm((prev) => ({
          ...prev,
          strikes: getDefaultStrikes(prev.strategy_type, roundedBase),
        }));
      }
    } catch {
      setError("No se pudieron ajustar strikes automaticamente para " + form.ticker);
    } finally {
      setLoadingStrikes(false);
    }
  }, [form.ticker]);

  const handleLoadBalance = useCallback(async () => {
    setLoadingBalance(true);
    setError(null);
    try {
      const balance = await fetchAccountBalance();
      setForm((prev) => ({
        ...prev,
        portfolio_valor: Math.round(balance.equity),
        portfolio_poder: Math.round(balance.buyingPower),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar saldo de Alpaca");
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const handleExecute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        strategy_type: form.strategy_type,
        ticker: form.ticker,
        expiracion: form.expiracion || undefined,
        strikes: form.strikes,
        contratos: form.contratos,
        tipo_ala: form.tipo_ala,
        tolerancia_riesgo: form.tolerancia_riesgo,
        estilo_opcion: form.estilo_opcion,
        portfolio: {
          valor_portafolio_usd: form.portfolio_valor,
          poder_compra_usd: form.portfolio_poder,
          margen_actual_usd: form.portfolio_margen,
          posiciones_actuales: form.portfolio_posiciones,
        },
      };
      const res = await executeStrategy(payload);
      setResult(res);
      setStep("results");
      onStrategyResult?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar estrategia");
    } finally {
      setLoading(false);
    }
  }, [form, onStrategyResult]);

  const preset = STRATEGY_PRESETS[form.strategy_type];
  const legs = preset?.legs ?? 4;
  const strikesValidas = form.ticker.length > 0 && form.strikes.length > 0 && form.strikes.every((s) => s.strike > 0);

  return (
    <div className="card" style={{
      border: "1px solid var(--color-accent)",
      borderLeft: "3px solid var(--color-accent)",
      padding: "1rem",
      marginTop: "0.5rem",
    }}>
      {/* ── Header ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ background: "var(--color-accent)", color: "white", borderRadius: "var(--radius-sm)", padding: "0.15rem 0.5rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em" }}>
            TEAM-08
          </span>
          <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
            {step === "form" ? "Configurar Estrategia" : "Resultados de Estrategia"}
          </h3>
        </div>
        {/* Tabs: Config / Resultados */}
        {result && (
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button
              className={`btn-ghost ${step === "form" ? "active" : ""}`}
              onClick={() => { setStep("form"); setError(null); }}
              style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
            >
              ⚙️ Configurar
            </button>
            <button
              className={`btn-ghost ${step === "results" ? "active" : ""}`}
              onClick={() => setStep("results")}
              style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
            >
              📊 Resultados
            </button>
          </div>
        )}
      </div>

      {/* ── STEP: Form ─────────────────────────────── */}
      {step === "form" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {/* Left column */}
          <div>
            <div className="card" style={{ marginBottom: "0.75rem", padding: "0.75rem" }}>
              <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.8rem" }}>Estrategia</h4>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={form.strategy_type} onChange={(e) => resetStrikesForStrategy(e.target.value)}>
                    {Object.entries(STRATEGY_PRESETS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
                    {preset?.description} · {legs} patas
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={labelStyle}>Ticker</label>
                    <input
                      value={form.ticker}
                      onChange={(e) => updateForm("ticker", e.target.value.toUpperCase())}
                      onBlur={handleAutoAdjustStrikes}
                      placeholder={defaultTicker}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Contratos</label>
                    <input type="number" min={1} value={form.contratos} onChange={(e) => updateForm("contratos", Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={labelStyle}>Vencimiento (opcional)</label>
                    <input value={form.expiracion} onChange={(e) => updateForm("expiracion", e.target.value)} placeholder="2026-06-19" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tolerancia Riesgo</label>
                    <select value={form.tolerancia_riesgo} onChange={(e) => updateForm("tolerancia_riesgo", e.target.value)}>
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={labelStyle}>Tipo Ala</label>
                    <select value={form.tipo_ala} onChange={(e) => updateForm("tipo_ala", e.target.value)}>
                      <option value="short">Short</option>
                      <option value="wide">Wide</option>
                      <option value="broken">Broken</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Estilo Opción</label>
                    <select value={form.estilo_opcion} onChange={(e) => updateForm("estilo_opcion", e.target.value)}>
                      <option value="americana">Americana</option>
                      <option value="europea">Europea</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Strikes */}
            <div className="card" style={{ padding: "0.75rem" }}>
              <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.8rem" }}>Patas ({legs})</h4>
              {loadingStrikes ? (
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontStyle: "italic", padding: "0.5rem 0" }}>
                  ⏳ Cargando strikes desde options chain...
                </div>
              ) : !strikesValidas && form.ticker.length === 0 ? (
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontStyle: "italic", padding: "0.5rem 0" }}>
                  ✏️ Ingresa un ticker arriba y sal del campo para cargar strikes automáticamente
                </div>
              ) : (
                <div style={{ display: "grid", gap: "0.4rem" }}>
                  {form.strikes.slice(0, legs).map((leg, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.35rem", alignItems: "center", padding: "0.4rem", background: "var(--color-bg)", borderRadius: "var(--radius-sm)" }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: "0.6rem" }}>Strike</label>
                        <input type="number" value={leg.strike} onChange={(e) => updateStrike(i, "strike", parseInt(e.target.value) || 0)} style={{ padding: "0.25rem 0.4rem" }} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: "0.6rem" }}>Tipo</label>
                        <select value={leg.tipo} onChange={(e) => updateStrike(i, "tipo", e.target.value)} style={{ padding: "0.25rem 0.4rem" }}>
                          <option value="call">Call</option>
                          <option value="put">Put</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: "0.6rem" }}>Posición</label>
                        <select value={leg.posicion} onChange={(e) => updateStrike(i, "posicion", e.target.value)} style={{ padding: "0.25rem 0.4rem" }}>
                          <option value="long">Long</option>
                          <option value="short">Short</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div>
            <div className="card" style={{ marginBottom: "0.75rem", padding: "0.75rem" }}>
              <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.8rem" }}>Portfolio</h4>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div>
                  <label style={labelStyle}>Valor Portafolio ($)</label>
                  <input type="number" value={form.portfolio_valor} onChange={(e) => updateForm("portfolio_valor", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label style={labelStyle}>Poder de Compra ($)</label>
                  <input type="number" value={form.portfolio_poder} onChange={(e) => updateForm("portfolio_poder", parseInt(e.target.value) || 0)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={labelStyle}>Margen Actual ($)</label>
                    <input type="number" value={form.portfolio_margen} onChange={(e) => updateForm("portfolio_margen", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Posiciones</label>
                    <input type="number" value={form.portfolio_posiciones} onChange={(e) => updateForm("portfolio_posiciones", Math.max(0, parseInt(e.target.value) || 0))} />
                  </div>
                </div>
                <button
                  className="btn-ghost"
                  onClick={handleLoadBalance}
                  disabled={loadingBalance}
                  style={{ fontSize: "0.75rem", padding: "0.35rem 0.6rem", marginTop: "0.15rem" }}
                >
                  {loadingBalance ? "⏳ Cargando..." : "📡 Cargar saldo real de Alpaca"}
                </button>
              </div>
            </div>

            {/* Execute */}
            <button
              className="btn-primary"
              onClick={handleExecute}
              disabled={loading || !strikesValidas}
              title={!strikesValidas ? "Ingresa un ticker y carga los strikes primero" : undefined}
              style={{
                width: "100%",
                padding: "0.7rem",
                fontSize: "0.95rem",
                marginBottom: "0.75rem",
                opacity: loading || !strikesValidas ? 0.5 : 1,
                cursor: loading || !strikesValidas ? "not-allowed" : "pointer",
              }}
            >
              {loading
                ? "⏳ Ejecutando con datos reales..."
                : !strikesValidas
                  ? "✏️ Ingresa ticker para cargar strikes"
                  : "🚀 Ejecutar Estrategia con Datos Reales"}
            </button>

            {error && (
              <div style={{ background: "rgba(248,81,73,0.08)", border: "1px solid var(--color-sell)", borderRadius: "var(--radius-sm)", padding: "0.6rem 0.8rem", color: "var(--color-sell)", fontSize: "0.8rem" }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP: Results ──────────────────────────── */}
      {step === "results" && result && (
        <div>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem", marginBottom: "1rem" }}>
            <SummaryCard label="Estrategia" value={result.strategy_type} color="var(--color-accent)" />
            <SummaryCard label="Ticker" value={result.ticker} />
            <SummaryCard label="Vencimiento" value={result.expiracion} />
            <SummaryCard
              label="Ganancia Máx"
              value={`$${((result.summary as any)?.perfil?.ganancia_maxima ?? "—").toLocaleString()}`}
              color="var(--color-buy)"
            />
            <SummaryCard
              label="Pérdida Máx"
              value={`$${((result.summary as any)?.perfil?.perdida_maxima ?? "—").toLocaleString()}`}
              color="var(--color-sell)"
            />
            <SummaryCard label="DTE" value={`${diasVencimiento ?? "—"} días`} />
          </div>

          {/* Payoff + Premiums */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div className="card" style={{ padding: "0.75rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem" }}>Curva de Payoff</h4>
              <PayoffChart points={(result.profile as any)?.payoff_curve ?? []} />
            </div>
            <div className="card" style={{ padding: "0.75rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem" }}>Primas (Alpaca)</h4>
              <table style={{ fontSize: "0.75rem" }}>
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Strike</th>
                    <th>Tipo</th>
                    <th>Prima</th>
                  </tr>
                </thead>
                <tbody>
                  {result.premiums_used.map((p, i) => (
                    <tr key={i}>
                      <td><span className={`badge ${p.posicion === "long" ? "badge-buy" : "badge-sell"}`}>{p.posicion}</span></td>
                      <td style={{ fontWeight: 600 }}>${p.strike}</td>
                      <td>{p.tipo}</td>
                      <td style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--color-accent)" }}>${p.prima.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk + Simulation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div className="card" style={{ padding: "0.75rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem" }}>Evaluación de Riesgo</h4>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>Puntaje</span>
                  <span style={{ fontWeight: 700 }}>{(result.risk as any)?.puntaje_riesgo ?? "—"}/100</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>Aceptable</span>
                  <span className={`badge ${(result.risk as any)?.riesgo_aceptable ? "badge-buy" : "badge-sell"}`}>
                    {(result.risk as any)?.riesgo_aceptable ? "✅ Sí" : "❌ No"}
                  </span>
                </div>
                {(() => {
                  const eventos = (result.risk as any)?.eventos;
                  if (!Array.isArray(eventos)) return null;
                  const advertencias = eventos.filter((e: any) => !e.bloquea);
                  const bloqueos = eventos.filter((e: any) => e.bloquea);
                  return (
                    <>
                      {advertencias.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 600, marginBottom: "0.2rem" }}>Advertencias:</div>
                          {advertencias.map((e: any, i: number) => (
                            <div key={i} style={{ fontSize: "0.75rem", color: "var(--color-hold)", padding: "0.15rem 0" }}>⚠️ {e.mensaje}</div>
                          ))}
                        </div>
                      )}
                      {bloqueos.length > 0 && (
                        <div>
                          <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 600, marginBottom: "0.2rem" }}>Bloqueos:</div>
                          {bloqueos.map((e: any, i: number) => (
                            <div key={i} style={{ fontSize: "0.75rem", color: "var(--color-sell)", padding: "0.15rem 0" }}>🚫 {e.mensaje}</div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="card" style={{ padding: "0.75rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem" }}>Simulación Monte Carlo</h4>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>Prob. Éxito</span>
                  <span style={{ fontWeight: 700 }}>
                    {(result.simulation as any)?.probabilidad_exito != null ? `${(result.simulation as any).probabilidad_exito.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>Rendimiento Esperado</span>
                  <span style={{ fontWeight: 700, color: (result.simulation as any)?.rendimiento_esperado >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                    {(result.simulation as any)?.rendimiento_esperado != null ? `$${(result.simulation as any).rendimiento_esperado.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>Sharpe Ratio</span>
                  <span style={{ fontWeight: 700 }}>{(result.simulation as any)?.ratio_sharpe?.toFixed(2) ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>Drawdown Máx</span>
                  <span style={{ fontWeight: 700, color: "var(--color-sell)" }}>{(result.simulation as any)?.drawdown_maximo != null ? `$${(result.simulation as any).drawdown_maximo.toLocaleString()}` : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EstrategiasPanel;
