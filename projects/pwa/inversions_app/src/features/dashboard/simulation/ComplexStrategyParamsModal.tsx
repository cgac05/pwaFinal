// FIC: ComplexStrategyParamsModal — modal for configuring complex multi-leg
//      options strategies (Iron Condor, Iron Butterfly, Butterfly Spread, Condor).
//      Follows the same pattern as CoverageParamsModal: just collect params and
//      call onConfirm — the actual strategy is executed when user clicks
//      "Ejecutar Simulación" in the main dashboard.

import React, { useState, useEffect, useCallback } from "react";
import { fetchOptionsChain, fetchExpirations, type StrikeSelection } from "../../../services/strategies/strategyApi";
import { useStrategyLegsStore } from "../../../store/strategyLegs";

// ─── Strategy metadata ────────────────────────────────────

const STRATEGY_PRESETS: Record<string, { label: string; legs: number; description: string; backendType: string }> = {
  IRON_CONDOR:     { label: "Iron Condor",     legs: 4, description: "2 puts (long+short) + 2 calls (short+long)",        backendType: "iron_condor" },
  IRON_BUTTERFLY:  { label: "Iron Butterfly",  legs: 4, description: "2 puts (long+short) + 2 calls (short+long) · ATM", backendType: "iron_butterfly" },
  BUTTERFLY_SPREAD:{ label: "Butterfly Spread",legs: 3, description: "3 patas del mismo tipo (long + short 2x + long)",   backendType: "butterfly_spread" },
  CONDOR:          { label: "Condor",           legs: 4, description: "4 patas del mismo tipo (long + short + short + long)", backendType: "condor" },
};

function getLegPattern(type: string): Array<{ tipo: "put" | "call"; posicion: "long" | "short" }> {
  switch (type) {
    case "IRON_CONDOR":
    case "IRON_BUTTERFLY":
      return [
        { tipo: "put", posicion: "long" },
        { tipo: "put", posicion: "short" },
        { tipo: "call", posicion: "short" },
        { tipo: "call", posicion: "long" },
      ];
    case "BUTTERFLY_SPREAD":
      return [
        { tipo: "call", posicion: "long" },
        { tipo: "call", posicion: "short" },
        { tipo: "call", posicion: "long" },
      ];
    case "CONDOR":
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
    IRON_CONDOR:      [-20, 0, 40, 60],
    IRON_BUTTERFLY:   [-40, 0, 0, 40],
    BUTTERFLY_SPREAD: [-20, 20, 60],
    CONDOR:           [-60, -20, 20, 60],
  };
  const legOffsets = offsets[type] ?? [];
  return patterns.map((p, i) => ({
    ...p,
    strike: baseStrike + (legOffsets[i] ?? 0),
  }));
}

/**
 * FIC: Sample expiration dates based on range mode.
 * FIC: Filtra fechas de expiración según el modo de rango.
 */
function sampleExpirations(dates: string[], range: number): string[] {
  if (dates.length === 0) return [];
  if (range === 1) return dates;

  const grouped: Record<string, string[]> = {};
  for (const d of dates) {
    const key = d.slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  }

  const months = Object.keys(grouped).sort();
  const result: string[] = [];

  if (range === 2) {
    for (const m of months) {
      const md = grouped[m];
      result.push(md[0]);
      if (md.length > 1) result.push(md[md.length - 1]);
    }
  } else if (range === 6) {
    for (const m of months) {
      result.push(grouped[m][0]);
    }
  } else if (range === 12) {
    for (let i = 0; i < months.length; i += 2) {
      result.push(grouped[months[i]][0]);
    }
  }

  return result;
}

// ─── Types ────────────────────────────────────────────────

export interface ComplexFormState {
  strategy_type: string;
  expiracion: string;
  contratos: number;
  tipo_ala: string;
  estilo_opcion: string;
  strikes: StrikeSelection[];
  portfolio_valor: number;
  portfolio_poder: number;
  portfolio_margen: number;
  portfolio_posiciones: number;
}

interface Props {
  open: boolean;
  strategy: string;
  ticker: string;
  riskTolerance?: string;
  onClose: () => void;
  onConfirm?: (params: ComplexFormState, strategy: string) => void;
}

// ─── Shared styles (mirrored from other modals) ──────────

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.72)",
  zIndex: 1100,
  display: "flex", alignItems: "center", justifyContent: "center",
  overflowY: "auto",
  padding: "var(--space-lg) 0",
};

const panelStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-lg)",
  width: "min(720px, 96vw)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-md)",
  maxHeight: "90vh",
  overflowY: "auto",
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  fontSize: "var(--font-size-sm)",
  padding: "var(--space-xs) var(--space-sm)",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};

const readonlyStyle: React.CSSProperties = {
  ...inputStyle,
  opacity: 0.5,
  cursor: "not-allowed",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-muted)",
  marginBottom: "var(--space-xs)",
  display: "block",
};

const sectionStyle: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-md)",
  border: "1px solid var(--color-border-subtle)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-sm)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-accent)",
  marginBottom: "var(--space-xs)",
};

// ─── Main component ───────────────────────────────────────

export function ComplexStrategyParamsModal({ open, strategy, ticker, riskTolerance = "medio", onClose, onConfirm }: Props) {
  const preset = STRATEGY_PRESETS[strategy] ?? STRATEGY_PRESETS.IRON_CONDOR;
  const legs = preset.legs;

  const [form, setForm] = useState<ComplexFormState>(() => ({
    strategy_type: preset.backendType,
    expiracion: "",
    contratos: 1,
    tipo_ala: "short",
    estilo_opcion: "americana",
    strikes: getDefaultStrikes(strategy, 0),
    portfolio_valor: 50000,
    portfolio_poder: 25000,
    portfolio_margen: 0,
    portfolio_posiciones: 0,
  }));
  const [rangoMeses, setRangoMeses] = useState<1 | 2 | 6 | 12>(1);
  const [availableExpirations, setAvailableExpirations] = useState<string[]>([]);
  const [loadingExpirations, setLoadingExpirations] = useState(false);
  const [expirationsError, setExpirationsError] = useState<string | null>(null);
  const [strikesError, setStrikesError] = useState<string | null>(null);
  const [loadingStrikes, setLoadingStrikes] = useState(false);
  const [lastAutoBaseStrike, setLastAutoBaseStrike] = useState(0);

  // FIC: Punto 1 — legs picked from the option chain (right-click). When present for this strategy,
  // FIC: they pre-fill the strikes instead of the auto-adjust default. (EN)
  // FIC: Punto 1 — patas elegidas desde la cadena (clic derecho). Si existen para esta estrategia,
  // FIC: precargan los strikes en vez del auto-ajuste por defecto. (ES)
  const { strategy: legStrategy, legs: pendingLegs } = useStrategyLegsStore();
  const hasPendingLegs = legStrategy === strategy && pendingLegs.some((l) => l.strike > 0);

  // ── Fetch expirations when ticker or range changes ──────────
  useEffect(() => {
    if (!open || !ticker || ticker.length < 2) return;

    let cancelled = false;
    setLoadingExpirations(true);
    setExpirationsError(null);

    fetchExpirations(ticker, rangoMeses)
      .then((res) => {
        if (!cancelled) {
          setAvailableExpirations(sampleExpirations(res.expiraciones, rangoMeses));
          setLoadingExpirations(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setExpirationsError(err.message);
          setAvailableExpirations([]);
          setLoadingExpirations(false);
        }
      });

    return () => { cancelled = true; };
  }, [open, ticker, rangoMeses]);

  // Reset form when strategy/ticker changes
  useEffect(() => {
    if (!open) return;
    setForm({
      strategy_type: preset.backendType,
      expiracion: "",
      contratos: 1,
      tipo_ala: "short",
      estilo_opcion: "americana",
      strikes: getDefaultStrikes(strategy, 0),
      portfolio_valor: 50000,
      portfolio_poder: 25000,
      portfolio_margen: 0,
      portfolio_posiciones: 0,
    });
    setRangoMeses(1);
    setAvailableExpirations([]);
    setExpirationsError(null);
    setLastAutoBaseStrike(0);
  }, [open, strategy, ticker]);

  const updateForm = useCallback(<K extends keyof ComplexFormState>(key: K, value: ComplexFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateStrike = useCallback((index: number, field: keyof StrikeSelection, value: number | string) => {
    setForm((prev) => ({
      ...prev,
      strikes: prev.strikes.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  }, []);

  const handleAutoAdjustStrikes = useCallback(async (tickerToFetch: string, expiration?: string) => {
    if (!tickerToFetch || tickerToFetch.length < 2) return;
    setLoadingStrikes(true);
    setStrikesError(null);
    try {
      const chain = await fetchOptionsChain(tickerToFetch, expiration);
      if (chain && chain.total_contratos > 0) {
        const midStrike = Math.round(
          (chain.resumen.call_strike_min + chain.resumen.call_strike_max) / 2
        );
        const roundedBase = Math.round(midStrike / 5) * 5;
        setLastAutoBaseStrike(roundedBase);
        setForm((prev) => ({
          ...prev,
          strikes: getDefaultStrikes(strategy, roundedBase),
        }));
      }
    } catch (err) {
      setStrikesError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingStrikes(false);
    }
  }, [strategy]);

  // FIC: Strikes are manually editable from the moment the modal opens — we do NOT auto-fetch them
  // FIC: from the chain on open. The user can type them, press "Ajustar" to pull from the chain on
  // FIC: demand, or pre-fill via right-click on the chain (Punto 1). (EN)
  // FIC: Los strikes son editables a mano desde que abre el modal — NO se auto-traen de la cadena al
  // FIC: abrir. El usuario los teclea, usa "Ajustar" para traerlos a demanda, o los precarga con clic
  // FIC: derecho en la cadena (Punto 1). (ES)

  // FIC: Punto 1 — when the modal opens with legs picked from the chain, use them as the strikes. (EN)
  // FIC: Punto 1 — al abrir el modal con patas elegidas desde la cadena, úsalas como strikes. (ES)
  useEffect(() => {
    if (open && hasPendingLegs) {
      setForm((prev) => ({
        ...prev,
        strikes: pendingLegs.map((l) => ({ strike: l.strike, tipo: l.tipo, posicion: l.posicion })),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasPendingLegs, pendingLegs]);

  const handleSave = useCallback(() => {
    onConfirm?.(form, strategy);
    onClose();
  }, [form, strategy, onConfirm, onClose]);

  // ── Helpers ──

  const strikesValidas = ticker.length > 0 && form.strikes.length > 0 && form.strikes.every((s) => s.strike > 0);

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={panelStyle}>

        {/* ── Header ─────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "var(--font-size-base)", fontWeight: 700 }}>
              {preset.label}
            </h3>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {ticker.toUpperCase()} · {preset.description}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "1.4rem", lineHeight: 1, padding: "0 var(--space-xs)" }}
          >
            ×
          </button>
        </div>

        {/* ── Strategy config ────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
          {/* Left column */}
          <div>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Parámetros</div>
              <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                  <div>
                    <label style={labelStyle}>Ticker</label>
                    <input
                      style={readonlyStyle}
                      value={ticker.toUpperCase()}
                      readOnly
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Contratos</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min={1}
                      value={form.contratos}
                      onChange={(e) => updateForm("contratos", Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                  <div>
                    <label style={labelStyle}>Rango</label>
                    <select
                      style={inputStyle}
                      value={rangoMeses}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) as 1 | 2 | 6 | 12;
                        setRangoMeses(v);
                        updateForm("expiracion", "");
                      }}
                    >
                      <option value={1}>1 mes</option>
                      <option value={2}>2 meses</option>
                      <option value={6}>6 meses</option>
                      <option value={12}>12 meses</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Tolerancia Riesgo</label>
                    <input
                      style={readonlyStyle}
                      value={riskTolerance.charAt(0).toUpperCase() + riskTolerance.slice(1)}
                      readOnly
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>
                    Vencimiento
                    {loadingExpirations && <span style={{ color: "var(--color-text-muted)", marginLeft: 6, fontSize: "0.55rem" }}>Cargando...</span>}
                  </label>
                  <select
                    style={{
                      ...inputStyle,
                      color: form.expiracion ? "var(--color-text)" : "var(--color-text-muted)",
                    }}
                    value={form.expiracion}
                    onChange={(e) => {
                      const selected = e.target.value;
                      updateForm("expiracion", selected);
                      if (selected) {
                        handleAutoAdjustStrikes(ticker, selected);
                      }
                    }}
                  >
                    {loadingExpirations ? (
                      <option value="">Cargando expiraciones...</option>
                    ) : expirationsError ? (
                      <option value="">Error: {expirationsError}</option>
                    ) : availableExpirations.length === 0 ? (
                      <option value="">No hay expiraciones disponibles</option>
                    ) : (
                      availableExpirations.map((exp) => (
                        <option key={exp} value={exp}>
                          {exp} · {new Date(exp).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                  <div>
                    <label style={labelStyle}>Tipo Ala</label>
                    <select
                      style={inputStyle}
                      value={form.tipo_ala}
                      onChange={(e) => updateForm("tipo_ala", e.target.value)}
                    >
                      <option value="short">Short</option>
                      <option value="wide">Wide</option>
                      <option value="broken">Broken</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Estilo Opción</label>
                    <select
                      style={inputStyle}
                      value={form.estilo_opcion}
                      onChange={(e) => updateForm("estilo_opcion", e.target.value)}
                    >
                      <option value="americana">Americana</option>
                      <option value="europea">Europea</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Strikes */}                <div style={{ ...sectionStyle, marginTop: "var(--space-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={sectionTitleStyle}>Patas ({legs})</div>
                <button
                  onClick={() => handleAutoAdjustStrikes(ticker)}
                  disabled={!ticker || loadingStrikes}
                  style={{
                    fontSize: "0.6rem",
                    padding: "2px 8px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-xs)",
                    color: "var(--color-text-muted)",
                    cursor: ticker ? "pointer" : "not-allowed",
                  }}
                >
                  {loadingStrikes ? "..." : "Ajustar"}
                </button>
              </div>
              {strikesError && (
                <div style={{ color: "var(--color-sell)", fontSize: "0.55rem", marginBottom: "var(--space-xs)", lineHeight: 1.4 }}>
                  {strikesError}
                </div>
              )}
              {loadingStrikes ? (
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic", padding: "var(--space-xs) 0" }}>
                  Cargando strikes desde options chain...
                </div>
              ) : (
                <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                  {form.strikes.slice(0, legs).map((leg, i) => (
                    <div key={i} style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 1fr 1fr",
                      gap: "var(--space-xs)",
                      alignItems: "center",
                      padding: "var(--space-xs)",
                      background: "var(--color-surface)",
                      borderRadius: "var(--radius-xs)",
                      border: "1px solid var(--color-border-subtle)",
                    }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: "0.55rem" }}>Strike</label>
                        <input
                          style={{ ...inputStyle, padding: "0.2rem 0.4rem", fontSize: "var(--font-size-xs)" }}
                          type="number"
                          value={leg.strike || ""}
                          onChange={(e) => updateStrike(i, "strike", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: "0.55rem" }}>Tipo</label>
                        <select
                          style={{ ...inputStyle, padding: "0.2rem 0.4rem", fontSize: "var(--font-size-xs)" }}
                          value={leg.tipo}
                          onChange={(e) => updateStrike(i, "tipo", e.target.value)}
                        >
                          <option value="call">Call</option>
                          <option value="put">Put</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: "0.55rem" }}>Posición</label>
                        <select
                          style={{ ...inputStyle, padding: "0.2rem 0.4rem", fontSize: "var(--font-size-xs)" }}
                          value={leg.posicion}
                          onChange={(e) => updateStrike(i, "posicion", e.target.value)}
                        >
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

          {/* Right column — Portfolio */}
          <div>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Portfolio</div>
              <div style={{ display: "grid", gap: "var(--space-sm)" }}>
                <div>
                  <label style={labelStyle}>Valor Portafolio ($)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={form.portfolio_valor}
                    onChange={(e) => updateForm("portfolio_valor", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Poder de Compra ($)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={form.portfolio_poder}
                    onChange={(e) => updateForm("portfolio_poder", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)" }}>
                  <div>
                    <label style={labelStyle}>Margen Actual ($)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      value={form.portfolio_margen}
                      onChange={(e) => updateForm("portfolio_margen", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Posiciones</label>
                    <input
                      style={inputStyle}
                      type="number"
                      value={form.portfolio_posiciones}
                      onChange={(e) => updateForm("portfolio_posiciones", Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!strikesValidas}
              style={{
                width: "100%",
                padding: "0.7rem",
                fontSize: "var(--font-size-base)",
                fontWeight: 700,
                marginTop: "var(--space-sm)",
                background: !strikesValidas ? "rgba(73,79,223,0.3)" : "var(--color-accent)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: !strikesValidas ? "not-allowed" : "pointer",
                opacity: !strikesValidas ? 0.6 : 1,
              }}
            >
              {!strikesValidas
                ? "Obteniendo strikes..."
                : "Guardar Parámetros"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            {legs} patas · {preset.description}
          </span>
        </div>

      </div>
    </div>
  );
}

export default ComplexStrategyParamsModal;
