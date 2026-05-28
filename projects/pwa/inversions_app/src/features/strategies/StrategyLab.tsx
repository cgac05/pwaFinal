import React, { useState, useCallback } from "react";
import type {
  OptionsChainResponse,
  OptionsChainEntry,
  FromChainResponse,
  StrikeSelection,
} from "../../services/strategies/strategyApi";
import {
  fetchOptionsChain,
  executeStrategy,
  fetchAccountBalance,
  executeOptionsStrategy,
} from "../../services/strategies/strategyApi";
import type { OptionsStrategyLeg, ExecuteOptionsStrategyRequest } from "../../services/strategies/strategyApi";

// ─── Types ───────────────────────────────────────────────

type TabId = "chain" | "builder" | "results";

interface StrategyForm {
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

/**
 * Genera strikes por defecto según el tipo de estrategia y precio base.
 * Cada estrategia requiere una configuración de patas específica:
 *
 * Iron Condor (4):  long put + short put + short call + long call
 * Iron Butterfly (4): long put + short put + short call(ATM) + long call
 * Butterfly Spread (3): long + short(2x) + long (mismo tipo: call o put)
 * Condor (4): long + short + short + long (mismo tipo: call o put)
 */
function getDefaultStrikes(type: string, baseStrike: number): StrikeSelection[] {
  const w = 20; // wing width

  switch (type) {
    case "iron_condor":
      return [
        { strike: baseStrike - w, tipo: "put", posicion: "long" },    // long put OTM
        { strike: baseStrike, tipo: "put", posicion: "short" },       // short put ATM
        { strike: baseStrike + 2 * w, tipo: "call", posicion: "short" }, // short call ATM
        { strike: baseStrike + 3 * w, tipo: "call", posicion: "long" },  // long call OTM
      ];

    case "butterfly_spread":
      return [
        { strike: baseStrike - w, tipo: "call", posicion: "long" },   // long lower call
        { strike: baseStrike + w, tipo: "call", posicion: "short" },  // short middle call (2x)
        { strike: baseStrike + 3 * w, tipo: "call", posicion: "long" }, // long upper call
      ];

    case "iron_butterfly":
      return [
        { strike: baseStrike - 2 * w, tipo: "put", posicion: "long" },  // long put OTM
        { strike: baseStrike, tipo: "put", posicion: "short" },         // short put ATM
        { strike: baseStrike, tipo: "call", posicion: "short" },        // short call ATM (mismo strike)
        { strike: baseStrike + 2 * w, tipo: "call", posicion: "long" }, // long call OTM
      ];

    case "condor":
      return [
        { strike: baseStrike - 3 * w, tipo: "call", posicion: "long" },  // long lower call
        { strike: baseStrike - w, tipo: "call", posicion: "short" },     // short lower-mid call
        { strike: baseStrike + w, tipo: "call", posicion: "short" },     // short upper-mid call
        { strike: baseStrike + 3 * w, tipo: "call", posicion: "long" },  // long upper call
      ];

    default:
      return [
        { strike: baseStrike, tipo: "put", posicion: "long" },
        { strike: baseStrike + w, tipo: "call", posicion: "short" },
      ];
  }
}

const DEFAULT_FORM: StrategyForm = {
  strategy_type: "iron_condor",
  ticker: "SPY",
  expiracion: "",
  contratos: 1,
  tipo_ala: "short",
  tolerancia_riesgo: "medio",
  estilo_opcion: "americana",
  strikes: getDefaultStrikes("iron_condor", 560),
  portfolio_valor: 50000,
  portfolio_poder: 25000,
  portfolio_margen: 0,
  portfolio_posiciones: 0,
};

const STRATEGY_PRESETS: Record<string, { label: string; legs: number; description: string }> = {
  iron_condor: { label: "Iron Condor", legs: 4, description: "2 puts (long+short) + 2 calls (short+long)" },
  iron_butterfly: { label: "Iron Butterfly", legs: 4, description: "2 puts (long+short) + 2 calls (short+long) · mismo strike ATM" },
  butterfly_spread: { label: "Butterfly Spread", legs: 3, description: "3 patas del mismo tipo (long + short 2x + long)" },
  condor: { label: "Condor", legs: 4, description: "4 patas del mismo tipo (long + short + short + long)" },
};

// ─── Payoff Chart Component ──────────────────────────────

function PayoffChart({ points }: { points: Array<{ precio_subyacente: number; pnl: number }> }) {
  if (!points || points.length === 0) return null;

  const width = 600;
  const height = 280;
  const padding = { top: 20, right: 20, bottom: 35, left: 60 };
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

  // Build gradient fill
  const fillPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.precio_subyacente).toFixed(1)},${yScale(p.pnl).toFixed(1)}`)
    .join(" ");
  const fillPathWithBase = `${fillPath} L${xScale(points[points.length - 1].precio_subyacente).toFixed(1)},${zeroY} L${xScale(points[0].precio_subyacente).toFixed(1)},${zeroY} Z`;

  // Grid lines
  const gridLines = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const price = minPrice + ((maxPrice - minPrice) * i) / steps;
    gridLines.push(
      <line key={`g-${i}`} x1={xScale(price)} y1={padding.top} x2={xScale(price)} y2={padding.top + chartH} stroke="#21262d" strokeWidth={1} />
    );
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3fb950" stopOpacity={0.25} />
          <stop offset="50%" stopColor="#3fb950" stopOpacity={0.05} />
          <stop offset="50%" stopColor="#f85149" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#f85149" stopOpacity={0.25} />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect x={padding.left} y={padding.top} width={chartW} height={chartH} fill="#0d1117" rx={4} />

      {/* Grid */}
      {gridLines}
      <line x1={padding.left} y1={zeroY} x2={padding.left + chartW} y2={zeroY} stroke="#30363d" strokeWidth={1} strokeDasharray="4,4" />

      {/* Fill */}
      <path d={fillPathWithBase} fill="url(#pnlGradient)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#58a6ff" strokeWidth={2} strokeLinejoin="round" />

      {/* Zero line */}
      <line x1={padding.left} y1={zeroY} x2={padding.left + chartW} y2={zeroY} stroke="#8b949e" strokeWidth={1} strokeDasharray="4,4" />

      {/* Labels */}
      <text x={padding.left + chartW / 2} y={height - 4} textAnchor="middle" fill="#8b949e" fontSize={11}>
        Precio del Subyacente ($)
      </text>
      <text x={12} y={padding.top + chartH / 2} textAnchor="middle" fill="#8b949e" fontSize={11} transform={`rotate(-90, 12, ${padding.top + chartH / 2})`}>
        P&L ($)
      </text>

      {/* Min/Max price labels */}
      <text x={xScale(minPrice)} y={padding.top + chartH + 14} textAnchor="middle" fill="#8b949e" fontSize={10}>
        ${minPrice}
      </text>
      <text x={xScale(maxPrice)} y={padding.top + chartH + 14} textAnchor="end" fill="#8b949e" fontSize={10}>
        ${maxPrice}
      </text>

      {/* Break-even markers */}
      {points.filter((p) => Math.abs(p.pnl) < 5 && p.precio_subyacente > minPrice && p.precio_subyacente < maxPrice).map((p, i) => (
        i % 2 === 0 ? null :
        <line key={`be-${i}`} x1={xScale(p.precio_subyacente)} y1={padding.top} x2={xScale(p.precio_subyacente)} y2={padding.top + chartH} stroke="#d29922" strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
      ))}
    </svg>
  );
}

// ─── Mini Payoff Sparkline ───────────────────────────────

function MiniSparkline({ points, width = 120, height = 40 }: { points: Array<{ pnl: number }>; width?: number; height?: number }) {
  if (!points || points.length < 2) return null;
  const pnls = points.map((p) => p.pnl);
  const min = Math.min(...pnls, 0);
  const max = Math.max(...pnls, 0);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(0)},${(height - ((p.pnl - min) / range) * height).toFixed(0)}`)
    .join(" ");
  const color = pnls[pnls.length - 1] >= 0 ? "#3fb950" : "#f85149";
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ─── Options Chain Tab ───────────────────────────────────

function OptionsChainTab({ onSelectStrike }: { onSelectStrike?: (strike: number, tipo: "call" | "put") => void }) {
  const [ticker, setTicker] = useState("SPY");
  const [expiration, setExpiration] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chain, setChain] = useState<OptionsChainResponse | null>(null);
  const [filter, setFilter] = useState<"all" | "calls" | "puts">("all");
  const [searchStrike, setSearchStrike] = useState("");

  const fetchChain = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOptionsChain(ticker, expiration || undefined);
      setChain(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar");
    } finally {
      setLoading(false);
    }
  }, [ticker, expiration]);

  const entries = chain ? (filter === "calls" ? chain.grouped.calls : filter === "puts" ? chain.grouped.puts : [...chain.grouped.calls, ...chain.grouped.puts]) : [];

  const filteredEntries = searchStrike
    ? entries.filter((e) => String(e.strike).includes(searchStrike))
    : entries;

  const contractCount = chain ? `${chain.total_calls} Calls + ${chain.total_puts} Puts = ${chain.total_contratos} contratos` : "";

  return (
    <div>
      {/* Search bar */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.75rem", alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Ticker</label>
            <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="SPY" onKeyDown={(e) => e.key === "Enter" && fetchChain()} />
          </div>
          <div>
            <label style={labelStyle}>Vencimiento (opcional)</label>
            <input value={expiration} onChange={(e) => setExpiration(e.target.value)} placeholder="2026-05-26" onKeyDown={(e) => e.key === "Enter" && fetchChain()} />
          </div>
          <button className="btn-primary" onClick={fetchChain} disabled={loading} style={{ height: "34px" }}>
            {loading ? "Cargando..." : "Buscar Opciones"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(248,81,73,0.08)", border: "1px solid var(--color-sell)", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", color: "var(--color-sell)", marginBottom: "1rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Summary cards */}
      {chain && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
          <SummaryCard label="Ticker" value={chain.ticker} />
          <SummaryCard label="Vencimiento" value={chain.expiracion} />
          <SummaryCard label="Contratos" value={contractCount} />
          <SummaryCard label="Calls" value={`$${chain.resumen.call_strike_min} – $${chain.resumen.call_strike_max}`} />
          <SummaryCard label="Puts" value={`$${chain.resumen.put_strike_min} – $${chain.resumen.put_strike_max}`} />
        </div>
      )}

      {/* Filters + table */}
      {chain && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Filtrar:</span>
            {(["all", "calls", "puts"] as const).map((f) => (
              <button key={f} className={`btn-ghost ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "Todos" : f === "calls" ? "Calls" : "Puts"}
              </button>
            ))}
            <div style={{ marginLeft: "auto", width: 160 }}>
              <input value={searchStrike} onChange={(e) => setSearchStrike(e.target.value)} placeholder="Buscar strike..." />
            </div>
          </div>

          <div className="card" style={{ maxHeight: 420, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Símbolo</th>
                  <th>Strike</th>
                  <th>Tipo</th>
                  <th>Bid</th>
                  <th>Ask</th>
                  <th>Mid</th>
                  <th>Delta</th>
                  <th>Gamma</th>
                  <th>Theta</th>
                  <th>Vega</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.slice(0, 100).map((entry) => (
                  <tr
                    key={entry.symbol}
                    onClick={() => onSelectStrike?.(entry.strike, entry.tipo)}
                    style={{ cursor: onSelectStrike ? "pointer" : undefined }}
                    title={onSelectStrike ? "Click para ver strikes similares en el Builder" : undefined}
                  >
                    <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{entry.symbol}</td>
                    <td style={{ fontWeight: 600 }}>${entry.strike}</td>
                    <td>
                      <span className={`badge ${entry.tipo === "call" ? "badge-buy" : "badge-sell"}`}>
                        {entry.tipo}
                      </span>
                    </td>
                    <td style={{ fontFamily: "monospace" }}>{entry.bid !== null ? `$${entry.bid.toFixed(2)}` : "—"}</td>
                    <td style={{ fontFamily: "monospace" }}>{entry.ask !== null ? `$${entry.ask.toFixed(2)}` : "—"}</td>
                    <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{entry.mid !== null ? `$${entry.mid.toFixed(2)}` : "—"}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--color-text-muted)" }}>{entry.greeks?.delta?.toFixed(4) ?? "—"}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--color-text-muted)" }}>{entry.greeks?.gamma?.toFixed(4) ?? "—"}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--color-text-muted)" }}>{entry.greeks?.theta?.toFixed(4) ?? "—"}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--color-text-muted)" }}>{entry.greeks?.vega?.toFixed(4) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEntries.length > 100 && (
              <div style={{ textAlign: "center", padding: "0.75rem", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                Mostrando 100 de {filteredEntries.length} contratos
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Summary Card ────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: color ?? "var(--color-text)" }}>
        {value}
      </div>
    </div>
  );
}

// ─── Strategy Builder Tab ────────────────────────────────

function StrategyBuilderTab({ onResults }: { onResults: (result: FromChainResponse) => void }) {
  const [form, setForm] = useState<StrategyForm>(DEFAULT_FORM);
  const [loadingBuilder, setLoadingBuilder] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [adjustingTicker, setAdjustingTicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateForm = useCallback(<K extends keyof StrategyForm>(key: K, value: StrategyForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateStrike = useCallback((index: number, field: keyof StrikeSelection, value: number | string) => {
    setForm((prev) => ({
      ...prev,
      strikes: prev.strikes.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  }, []);

  /**
   * Cuando el usuario cambia el ticker, auto-ajusta los strikes por defecto
   * consultando la options chain real de Alpaca para ese ticker.
   */
  const handleTickerChange = useCallback(async (ticker: string) => {
    if (!ticker || ticker.length < 2) return;

    setError(null);
    // Mostrar el ticker nuevo inmediatamente
    updateForm("ticker", ticker);

    // Auto-ajustar strikes consultando la options chain real
    try {
      const chain = await fetchOptionsChain(ticker);
      if (chain && chain.total_contratos > 0) {
        // Usar el punto medio de los strikes call como precio base
        const midStrike = Math.round(
          (chain.resumen.call_strike_min + chain.resumen.call_strike_max) / 2
        );
        // Redondear al múltiplo de 5 más cercano
        const roundedBase = Math.round(midStrike / 5) * 5;

        setForm((prev) => ({
          ...prev,
          ticker,
          strikes: getDefaultStrikes(prev.strategy_type, roundedBase),
        }));
      }
    } catch {
      setError("No se pudieron ajustar los strikes automáticamente para " + ticker + ". Los strikes actuales se mantienen.");
    }
  }, [updateForm]);

  const resetStrikesForStrategy = useCallback((type: string) => {
    const preset = STRATEGY_PRESETS[type];
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      strategy_type: type,
      strikes: getDefaultStrikes(type, 560),
    }));
  }, []);

  const handleLoadAlpacaBalance = useCallback(async () => {
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
      setError(err instanceof Error ? err.message : "Error al cargar saldo");
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const handleExecute = useCallback(async () => {
    setLoadingBuilder(true);
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
      const result = await executeStrategy(payload);
      onResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ejecutar");
    } finally {
      setLoadingBuilder(false);
    }
  }, [form, onResults]);

  const preset = STRATEGY_PRESETS[form.strategy_type];
  const legs = preset?.legs ?? 4;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Left column: Strategy config */}
        <div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2 style={{ marginBottom: "0.75rem" }}>Estrategia</h2>
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.strategy_type} onChange={(e) => resetStrikesForStrategy(e.target.value)}>
                  {Object.entries(STRATEGY_PRESETS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                  {preset?.description}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={labelStyle}>Ticker</label>
                  <input
                    value={form.ticker}
                    onChange={(e) => updateForm("ticker", e.target.value.toUpperCase())}
                    onBlur={(e) => handleTickerChange(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTickerChange(e.currentTarget.value.toUpperCase());
                    }}
                    placeholder="SPY"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Contratos</label>
                  <input type="number" min={1} value={form.contratos} onChange={(e) => updateForm("contratos", Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={labelStyle}>Vencimiento (opcional)</label>
                  <input value={form.expiracion} onChange={(e) => updateForm("expiracion", e.target.value)} placeholder="2026-05-26" />
                </div>
                <div>
                  <label style={labelStyle}>Tipo Ala</label>
                  <select value={form.tipo_ala} onChange={(e) => updateForm("tipo_ala", e.target.value)}>
                    <option value="short">Short</option>
                    <option value="wide">Wide</option>
                    <option value="broken">Broken</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={labelStyle}>Tolerancia Riesgo</label>
                  <select value={form.tolerancia_riesgo} onChange={(e) => updateForm("tolerancia_riesgo", e.target.value)}>
                    <option value="bajo">Bajo</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
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
          <div className="card">
            <h2 style={{ marginBottom: "0.75rem" }}>Patas ({legs})</h2>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {form.strikes.slice(0, legs).map((leg, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", alignItems: "center", padding: "0.5rem", background: "var(--color-bg)", borderRadius: "var(--radius-sm)" }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: "0.65rem" }}>Strike</label>
                    <input type="number" value={leg.strike} onChange={(e) => updateStrike(i, "strike", parseInt(e.target.value) || 0)} style={{ padding: "0.3rem 0.5rem" }} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: "0.65rem" }}>Tipo</label>
                    <select value={leg.tipo} onChange={(e) => updateStrike(i, "tipo", e.target.value)} style={{ padding: "0.3rem 0.5rem" }}>
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: "0.65rem" }}>Posición</label>
                    <select value={leg.posicion} onChange={(e) => updateStrike(i, "posicion", e.target.value)} style={{ padding: "0.3rem 0.5rem" }}>
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Portfolio + Execute */}
        <div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2 style={{ marginBottom: "0.75rem" }}>Portfolio</h2>
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <div>
                <label style={labelStyle}>Valor Portafolio ($)</label>
                <input type="number" value={form.portfolio_valor} onChange={(e) => updateForm("portfolio_valor", parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={labelStyle}>Poder de Compra ($)</label>
                <input type="number" value={form.portfolio_poder} onChange={(e) => updateForm("portfolio_poder", parseInt(e.target.value) || 0)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={labelStyle}>Margen Actual ($)</label>
                  <input type="number" value={form.portfolio_margen} onChange={(e) => updateForm("portfolio_margen", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label style={labelStyle}>Posiciones Actuales</label>
                  <input type="number" value={form.portfolio_posiciones} onChange={(e) => updateForm("portfolio_posiciones", Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>
              {/* Cargar saldo real button */}
              <button
                className="btn-ghost"
                onClick={handleLoadAlpacaBalance}
                disabled={loadingBalance}
                style={{ marginTop: "0.25rem", fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              >
                {loadingBalance ? "⏳ Cargando..." : "📡 Cargar saldo real de Alpaca"}
              </button>
            </div>
          </div>

          <button className="btn-primary" onClick={handleExecute} disabled={loadingBuilder} style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}>
            {loadingBuilder ? "⏳ Ejecutando con datos reales de Alpaca..." : "🚀 Ejecutar Estrategia con Datos Reales"}
          </button>

          {error && (
            <div style={{ marginTop: "0.75rem", background: "rgba(248,81,73,0.08)", border: "1px solid var(--color-sell)", borderRadius: "var(--radius-sm)", padding: "0.75rem 1rem", color: "var(--color-sell)" }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Results Tab ─────────────────────────────────────────

function ResultsTab({
  result,
}: {
  result: FromChainResponse | null;
}) {
  if (!result) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-muted)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📊</div>
        <p>Ejecuta una estrategia desde el Builder para ver los resultados aquí</p>
      </div>
    );
  }

  const summary = result.summary as Record<string, unknown> | undefined;
  const perfil = (summary?.perfil ?? {}) as Record<string, unknown>;
  const simulacion = (summary?.simulacion ?? {}) as Record<string, unknown>;
  const riesgo = (summary?.riesgo ?? {}) as Record<string, unknown>;
  const profile = result.profile as Record<string, unknown> | undefined;
  const payoffCurve = (profile?.payoff_curve ?? []) as Array<{ precio_subyacente: number; pnl: number }>;

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        <SummaryCard label="Estrategia" value={result.strategy_type} color="var(--color-accent)" />
        <SummaryCard label="Ticker" value={result.ticker} />
        <SummaryCard label="Vencimiento" value={result.expiracion} />
        <SummaryCard
          label="Ganancia Máxima"
          value={`$${(perfil.ganancia_maxima as number)?.toLocaleString() ?? "—"}`}
          color="var(--color-buy)"
        />
        <SummaryCard
          label="Pérdida Máxima"
          value={`$${(perfil.perdida_maxima as number)?.toLocaleString() ?? "—"}`}
          color="var(--color-sell)"
        />
        <SummaryCard
          label="DTE"
          value={`${(summary?.dias_vencimiento as number) ?? "—"} días`}
        />
      </div>

      {/* Payoff Chart + Premiums side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="card">
          <h2 style={{ marginBottom: "0.75rem" }}>Curva de Payoff</h2>
          <PayoffChart points={payoffCurve} />
        </div>

        <div className="card">
          <h2 style={{ marginBottom: "0.75rem" }}>Primas Usadas (Alpaca)</h2>
          <table>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Strike</th>
                <th>Tipo</th>
                <th>Prima</th>
                <th>Bid</th>
                <th>Ask</th>
              </tr>
            </thead>
            <tbody>
              {result.premiums_used.map((p, i) => (
                <tr key={i}>
                  <td>
                    <span className={`badge ${p.posicion === "long" ? "badge-buy" : "badge-sell"}`}>
                      {p.posicion}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>${p.strike}</td>
                  <td>{p.tipo}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--color-accent)" }}>
                    ${p.prima.toFixed(2)}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>{p.bid !== null ? `$${p.bid.toFixed(2)}` : "—"}</td>
                  <td style={{ fontFamily: "monospace" }}>{p.ask !== null ? `$${p.ask.toFixed(2)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk + Simulation */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div className="card">
          <h2 style={{ marginBottom: "0.75rem" }}>Evaluación de Riesgo</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Puntaje</span>
              <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{(riesgo.puntaje as number) ?? "—"}/100</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Aceptable</span>
              <span className={`badge ${riesgo.aceptable ? "badge-buy" : "badge-sell"}`}>
                {riesgo.aceptable ? "✅ Sí" : "❌ No"}
              </span>
            </div>
            {Array.isArray(riesgo.advertencias) && riesgo.advertencias.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.3rem", fontWeight: 600 }}>Advertencias:</div>
                {riesgo.advertencias.map((w: string, i: number) => (
                  <div key={i} style={{ fontSize: "0.8rem", color: "var(--color-hold)", padding: "0.25rem 0" }}>⚠️ {w}</div>
                ))}
              </div>
            )}
            {Array.isArray(riesgo.bloqueos) && riesgo.bloqueos.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.3rem", fontWeight: 600 }}>Bloqueos:</div>
                {riesgo.bloqueos.map((b: string, i: number) => (
                  <div key={i} style={{ fontSize: "0.8rem", color: "var(--color-sell)", padding: "0.25rem 0" }}>🚫 {b}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: "0.75rem" }}>Simulación Monte Carlo</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Prob. Éxito</span>
              <span style={{ fontWeight: 700 }}>{(simulacion.prob_exito as number) != null ? `${((simulacion.prob_exito as number) * 100).toFixed(1)}%` : "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Rendimiento</span>
              <span style={{ fontWeight: 700, color: (simulacion.rendimiento as number) >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                {(simulacion.rendimiento as number) != null ? `${(simulacion.rendimiento as number).toFixed(2)}%` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Sharpe Ratio</span>
              <span style={{ fontWeight: 700 }}>{(simulacion.sharpe as number)?.toFixed(2) ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Drawdown Máx</span>
              <span style={{ fontWeight: 700, color: "var(--color-sell)" }}>
                {(simulacion.drawdown as number) != null ? `${(simulacion.drawdown as number).toFixed(1)}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Label Style ─────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.7rem",
  color: "var(--color-text-muted)",
  marginBottom: "0.25rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

// ─── Main Strategy Lab ───────────────────────────────────

interface StrategyLabProps {
  onNavigateToDashboard: () => void;
}

export function StrategyLab({ onNavigateToDashboard }: StrategyLabProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chain");
  const [result, setResult] = useState<FromChainResponse | null>(null);

  const handleResults = useCallback((res: FromChainResponse) => {
    setResult(res);
    setActiveTab("results");
  }, []);

  const tabs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: "chain", label: "Options Chain", icon: "📋" },
    { id: "builder", label: "Builder", icon: "🔧" },
    { id: "results", label: "Resultados", icon: "📊" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* Nav */}
      <nav style={navStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button className="btn-ghost" onClick={onNavigateToDashboard} title="Volver al Dashboard">
            ← Dashboard
          </button>
          <span style={{ background: "var(--color-accent)", color: "white", borderRadius: "var(--radius-sm)", padding: "0.2rem 0.6rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em" }}>
            TEAM-08
          </span>
          <span style={{ fontWeight: 700, fontSize: "1rem" }}>Strategy Lab</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
            Estrategias Complejas con datos reales de Alpaca
          </span>
        </div>
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}>
          Datos en vivo • Alpaca API
        </span>
      </nav>

      {/* Tabs */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`btn-ghost ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.9rem" }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "chain" && <OptionsChainTab onSelectStrike={() => setActiveTab("builder")} />}

        {activeTab === "builder" && <StrategyBuilderTab onResults={handleResults} />}

        {activeTab === "results" && <ResultsTab result={result} />}
      </div>
    </div>
  );
}

// ─── Nav Style ───────────────────────────────────────────

const navStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  borderBottom: "1px solid var(--color-border)",
  padding: "0.75rem 1.5rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
