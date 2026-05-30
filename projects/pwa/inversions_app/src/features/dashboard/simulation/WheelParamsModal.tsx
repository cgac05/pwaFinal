// FIC: WheelParamsModal — two-section form for Wheel Strategy: Cash Secured Put + Covered Call. (EN)
// FIC: WheelParamsModal — formulario de dos secciones para Wheel Strategy: Cash Secured Put + Covered Call. (ES)
// NOTE: This modal is intentionally self-contained. It does NOT import from CoverageParamsModal,
// coverageApi, or any coverage engine. All calculations are local formulas. (EN)
// NOTA: Este modal es intencionalmente auto-contenido. NO importa de CoverageParamsModal,
// coverageApi ni ningún engine de cobertura. Todos los cálculos son fórmulas locales. (ES)

import React, { useState, useEffect, useRef } from "react";
import { useSignalStore } from "../../../store/signals";
// FIC: Reuse existing option chain service — no new endpoints created. (EN)
// FIC: Reutiliza el servicio de cadena de opciones existente — no se crean endpoints nuevos. (ES)
import { fetchOptionChain, fetchExpirations } from "../../../services/options/optionChainApi";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WheelCspParams {
  ticker: string;
  currentPrice: number;
  capitalDisponible: number;
  strikePut: number;
  primaPut: number;
  contratos: number;
}

export interface WheelCcParams {
  acciones: number;
  costoPromedio: number;
  strikeCall: number;
  primaCall: number;
  contratos: number;
}

export interface WheelModalParams {
  csp: WheelCspParams;
  cc: WheelCcParams;
}

// FIC: Result of Wheel outcome simulation — computed locally, no backend. (EN)
// FIC: Resultado de la simulación de resultado Wheel — calculado localmente, sin backend. (ES)
interface WheelEvalResult {
  estadoCSP: "PUT_EXPIRA_SIN_VALOR" | "ACCIONES_ASIGNADAS";
  estadoCC:  "ACCIONES_VENDIDAS" | "CONSERVA_ACCIONES" | "N/A";
  gananciaCSP:   number;
  gananciaCC:    number;
  gananciaTotal: number;
  roi:           number;
}

interface Props {
  open: boolean;
  ticker: string;
  params: WheelModalParams;
  onChange: (params: WheelModalParams) => void;
  onClose: () => void;
  onConfirm?: (params: WheelModalParams) => void;
}

// ─── Local calculation helpers (no backend, no coverage engine) ───────────────

function calcCsp(p: WheelCspParams) {
  const multiplier = p.contratos * 100;
  const breakeven       = p.strikePut - p.primaPut;
  const primaTotal      = p.primaPut * multiplier;
  const capitalComprometido = p.strikePut * multiplier;
  const roi             = capitalComprometido > 0 ? primaTotal / capitalComprometido : 0;
  return { breakeven, primaTotal, capitalComprometido, roi };
}

function calcCc(p: WheelCcParams) {
  const multiplier = p.contratos * 100;
  const maxProfit      = Math.max(0, p.strikeCall - p.costoPromedio + p.primaCall) * p.acciones;
  const primaRecibida  = p.primaCall * multiplier;
  const retornoPct     = p.costoPromedio > 0 ? p.primaCall / p.costoPromedio : 0;
  const breakeven      = p.costoPromedio - p.primaCall;
  return { maxProfit, primaRecibida, retornoPct, breakeven };
}

// FIC: Evaluate Wheel outcome at a given final price — pure function, no side effects. (EN)
// FIC: Evalúa el resultado Wheel a un precio final dado — función pura, sin efectos secundarios. (ES)
function evaluateWheel(params: WheelModalParams, precioFinal: number): WheelEvalResult {
  const { csp, cc } = params;

  // ── CSP leg ──
  const estadoCSP: WheelEvalResult["estadoCSP"] = precioFinal >= csp.strikePut
    ? "PUT_EXPIRA_SIN_VALOR"
    : "ACCIONES_ASIGNADAS";

  // FIC: PUT_EXPIRA: keep full premium. ACCIONES_ASIGNADAS: premium minus assignment loss. (EN)
  const gananciaCSP = estadoCSP === "PUT_EXPIRA_SIN_VALOR"
    ? csp.primaPut * csp.contratos * 100
    : (csp.primaPut - (csp.strikePut - precioFinal)) * csp.contratos * 100;

  // ── CC leg (only meaningful when shares were assigned) ──
  let estadoCC: WheelEvalResult["estadoCC"] = "N/A";
  let gananciaCC = 0;

  if (estadoCSP === "ACCIONES_ASIGNADAS" && cc.strikeCall > 0) {
    estadoCC = precioFinal > cc.strikeCall ? "ACCIONES_VENDIDAS" : "CONSERVA_ACCIONES";
    if (estadoCC === "ACCIONES_VENDIDAS") {
      // FIC: Premium received + capital gain from strike - cost basis. (EN)
      gananciaCC = cc.primaCall * cc.contratos * 100
        + (cc.strikeCall - cc.costoPromedio) * cc.acciones;
    } else {
      // FIC: Shares retained, keep only the call premium received. (EN)
      gananciaCC = cc.primaCall * cc.contratos * 100;
    }
  }

  const gananciaTotal = gananciaCSP + gananciaCC;
  const capitalComprometido = csp.strikePut * csp.contratos * 100;
  const roi = capitalComprometido > 0 ? gananciaTotal / capitalComprometido : 0;

  return { estadoCSP, estadoCC, gananciaCSP, gananciaCC, gananciaTotal, roi };
}

// ─── Shared styles (mirrored from CoverageParamsModal, no import) ─────────────

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
  width: "min(680px, 96vw)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-lg)",
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: "var(--space-sm)",
  gridTemplateColumns: "repeat(3, 1fr)",
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface)",
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

const resultRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--space-xs) 0",
  borderBottom: "1px solid var(--color-border-subtle)",
  fontSize: "var(--font-size-sm)",
};

const resultLabelStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-xs)",
};

const resultValueStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--color-text)",
};

// ─── Component ────────────────────────────────────────────────────────────────

// FIC: These are module-level refs so suggestCallFromChain can write to state
// without being declared inside the component (avoids stale closure issues). (EN)
// FIC: Refs a nivel de módulo para que suggestCallFromChain pueda escribir estado
// sin declararse dentro del componente (evita problemas de closure obsoleto). (ES)
let _setSuggestionStatus: React.Dispatch<React.SetStateAction<"idle"|"loading"|"found"|"not_found">> | null = null;
let _onChangeSetter: ((p: WheelModalParams) => void) | null = null;
let _latestParams: WheelModalParams | null = null;

// FIC: Fetch option chain, find nearest OTM call above strikePut, autocomplete CC fields. (EN)
// FIC: Obtiene la cadena de opciones, encuentra el call OTM más cercano sobre strikePut, autocompleta CC. (ES)
async function suggestCallFromChain(
  params: WheelModalParams,
  strikePut: number,
  ticker: string
): Promise<void> {
  if (!_setSuggestionStatus || !_onChangeSetter) return;
  _setSuggestionStatus("loading");
  _latestParams = params;

  try {
    // FIC: Fetch nearest expiration — same default as OptionChainTable. (EN)
    const expData = await fetchExpirations(ticker);
    const expiration = expData.expirations[0];
    if (!expiration) { _setSuggestionStatus("not_found"); return; }

    const chain = await fetchOptionChain(ticker, expiration);

    // FIC: Find nearest call >= strikePut with liquidity (callBid > 0). (EN)
    // FIC: Encontrar el call más cercano >= strikePut con liquidez (callBid > 0). (ES)
    const candidates = chain.rows
      .filter((r) => r.strike > strikePut && r.callBid > 0)
      .sort((a, b) => a.strike - b.strike);

    if (candidates.length === 0) { _setSuggestionStatus("not_found"); return; }

    const best = candidates[0];
    const primaCall = parseFloat(((best.callBid + best.callAsk) / 2).toFixed(4));

    // FIC: Use latest params snapshot to avoid stale closure overwriting user edits. (EN)
    const currentParams = _latestParams ?? params;
    _onChangeSetter({
      ...currentParams,
      cc: { ...currentParams.cc, strikeCall: best.strike, primaCall },
    });
    _setSuggestionStatus("found");

  } catch {
    // FIC: Network failure — stay silent, allow manual input. (EN)
    // FIC: Falla de red — permanecer silencioso, permitir captura manual. (ES)
    _setSuggestionStatus("idle");
  }
}

export function WheelParamsModal({ open, ticker, params, onChange, onClose, onConfirm }: Props) {
  const [analyzed, setAnalyzed] = useState(false);
  const [precioFinal, setPrecioFinal] = useState<number>(0);
  const [evalResult, setEvalResult] = useState<WheelEvalResult | null>(null);
  // FIC: Status of automatic call suggestion fetch triggered by PUT selection. (EN)
  // FIC: Estado de la búsqueda automática de call sugerido al seleccionar un PUT. (ES)
  const [callSuggestionStatus, setCallSuggestionStatus] =
    useState<"idle" | "loading" | "found" | "not_found">("idle");

  // FIC: Wire module-level refs so suggestCallFromChain can access current state setters. (EN)
  // FIC: Conecta los refs de módulo para que suggestCallFromChain acceda a los setters actuales. (ES)
  _setSuggestionStatus = setCallSuggestionStatus;
  _onChangeSetter = onChange;
  _latestParams = params;
  const { selectedStrike } = useSignalStore();

  // FIC: Track whether the modal was already open to distinguish "just opened" from "strike changed". (EN)
  // FIC: Rastrea si el modal ya estaba abierto para distinguir "recién abierto" de "strike cambió". (ES)
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      // FIC: Reset the open-tracking ref so next open is treated as fresh. (EN)
      // FIC: Resetea el ref al cerrar para que la próxima apertura se trate como nueva. (ES)
      wasOpenRef.current = false;
      return;
    }

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (justOpened) {
      // FIC: Modal just opened — reset both sections to clean defaults, then apply current selectedStrike. (EN)
      // FIC: Modal recién abierto — reinicia ambas secciones a defaults limpios, luego aplica selectedStrike actual. (ES)
      const fresh: WheelModalParams = {
        csp: {
          ticker,
          currentPrice: params.csp.currentPrice,   // preserve price if already resolved
          capitalDisponible: 0,
          strikePut: 0,
          primaPut: 0,
          contratos: 1,
        },
        cc: {
          acciones: params.cc.acciones || 100,
          costoPromedio: 0,
          strikeCall: 0,
          primaCall: 0,
          contratos: 1,
        },
      };

      // Apply selectedStrike only to its matching section
      if (selectedStrike?.type === "put") {
        fresh.csp.strikePut = selectedStrike.strike;
        fresh.csp.primaPut  = parseFloat(selectedStrike.premium.toFixed(4));
        // FIC: Also suggest a call when modal opens with a PUT already selected. (EN)
        // FIC: También sugerir un call cuando el modal abre con un PUT ya seleccionado. (ES)
        void suggestCallFromChain(fresh, selectedStrike.strike, ticker);
      } else if (selectedStrike?.type === "call") {
        fresh.cc.strikeCall = selectedStrike.strike;
        fresh.cc.primaCall  = parseFloat(selectedStrike.premium.toFixed(4));
      }

      // TEMP-LOG [Punto 4 — WheelParamsModal] apertura — estado inicial aplicado
      console.log("[WHEEL-AUDIT][4-WheelParamsModal] justOpened →", {
        selectedStrike,
        appliedCsp: { strikePut: fresh.csp.strikePut, primaPut: fresh.csp.primaPut },
        appliedCc:  { strikeCall: fresh.cc.strikeCall, primaCall: fresh.cc.primaCall },
      });

      onChange(fresh);
      setAnalyzed(false);
      ccCostoEditedRef.current = false; // FIC: Reset manual-edit flag on fresh open. (EN)
      // FIC: Pre-fill precio final with current price as a reasonable starting point. (EN)
      // FIC: Pre-llenar precio final con el precio actual como punto de partida. (ES)
      setPrecioFinal(fresh.csp.currentPrice || 0);
      setEvalResult(null);
      setCallSuggestionStatus("idle");

    } else {
      // FIC: Modal already open — strike changed: update only the matching section, leave the other intact. (EN)
      // FIC: Modal ya abierto — strike cambió: actualiza solo la sección correspondiente, deja la otra intacta. (ES)
      if (!selectedStrike) return;

      // TEMP-LOG [Punto 4 — WheelParamsModal] strike cambió mientras estaba abierto
      console.log("[WHEEL-AUDIT][4-WheelParamsModal] strikeChanged →", {
        type: selectedStrike.type, strike: selectedStrike.strike, premium: selectedStrike.premium,
      });

      if (selectedStrike.type === "put") {
        // FIC: PUT selected — update CSP only. CC is left untouched. (EN)
        // FIC: PUT seleccionado — actualiza solo CSP. CC no se modifica. (ES)
        const updatedParams = {
          ...params,
          csp: { ...params.csp, strikePut: selectedStrike.strike, primaPut: parseFloat(selectedStrike.premium.toFixed(4)) },
        };
        onChange(updatedParams);
        // FIC: Trigger automatic call suggestion after PUT selection. (EN)
        // FIC: Disparar sugerencia automática de call tras selección de PUT. (ES)
        void suggestCallFromChain(updatedParams, selectedStrike.strike, ticker);
      } else if (selectedStrike.type === "call") {
        // FIC: CALL selected — update CC only. CSP is left untouched. (EN)
        // FIC: CALL seleccionado — actualiza solo CC. CSP no se modifica. (ES)
        onChange({
          ...params,
          cc: { ...params.cc, strikeCall: selectedStrike.strike, primaCall: parseFloat(selectedStrike.premium.toFixed(4)) },
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedStrike]);

  // FIC: Once currentPrice arrives async, seed precioFinal if user hasn't touched it yet. (EN)
  // FIC: Cuando currentPrice llega async, inicializa precioFinal si el usuario no lo tocó. (ES)
  useEffect(() => {
    if (!open) return;
    if (params.csp.currentPrice > 0 && precioFinal === 0) {
      setPrecioFinal(params.csp.currentPrice);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, params.csp.currentPrice]);

  // FIC: Track if user manually edited costoPromedio — disables autocomplete when true. (EN)
  // FIC: Rastrea si el usuario editó costoPromedio manualmente — desactiva el autocompletado cuando es true. (ES)
  const ccCostoEditedRef = useRef(false);

  // FIC: Autocomplete costoPromedio from CSP breakeven whenever strikePut or primaPut change. (EN)
  // FIC: Autocompletar costoPromedio desde el breakeven del CSP cuando cambien strikePut o primaPut. (ES)
  // Rationale: in Wheel, shares are assigned at strikePut - primaPut (effective purchase price). (EN)
  // Fundamento: en Wheel, las acciones se asignan a strikePut - primaPut (precio efectivo de compra). (ES)
  useEffect(() => {
    if (!open) return;
    if (ccCostoEditedRef.current) return; // user overrode — respect their value
    const { strikePut, primaPut } = params.csp;
    if (strikePut > 0 && primaPut >= 0) {
      const computed = parseFloat((strikePut - primaPut).toFixed(4));
      if (computed !== params.cc.costoPromedio) {
        onChange({ ...params, cc: { ...params.cc, costoPromedio: computed } });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, params.csp.strikePut, params.csp.primaPut]);

  if (!open) return null;

  // FIC: Helpers to update nested CSP / CC params without touching the other section. (EN)
  // FIC: Helpers para actualizar parámetros CSP / CC anidados sin tocar la otra sección. (ES)
  const setCsp = <K extends keyof WheelCspParams>(field: K, value: WheelCspParams[K]) =>
    onChange({ ...params, csp: { ...params.csp, [field]: value } });

  const setCc = <K extends keyof WheelCcParams>(field: K, value: WheelCcParams[K]) =>
    onChange({ ...params, cc: { ...params.cc, [field]: value } });

  const cspResult = calcCsp(params.csp);
  const ccResult  = calcCc(params.cc);

  const handleAnalyze = () => {
    setAnalyzed(true);
    onConfirm?.(params);
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={panelStyle}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "var(--font-size-base)", fontWeight: 700 }}>
              WHEEL STRATEGY
            </h3>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {ticker.toUpperCase()} · Cash Secured Put → Covered Call
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "1.4rem", lineHeight: 1, padding: "0 var(--space-xs)" }}
          >
            ×
          </button>
        </div>

        {/* ── Section 1: CASH SECURED PUT ────────────────────────────────────── */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>CASH SECURED PUT</div>

          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Ticker</label>
              <input style={readonlyStyle} value={ticker.toUpperCase()} readOnly />
            </div>
            <div>
              <label style={labelStyle}>Precio actual</label>
              <input
                style={inputStyle}
                type="number"
                step={0.01}
                min={0}
                value={params.csp.currentPrice || ""}
                placeholder="Precio actual"
                onChange={(e) => setCsp("currentPrice", Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Capital disponible ($)</label>
              <input
                style={inputStyle}
                type="number"
                step={100}
                min={0}
                value={params.csp.capitalDisponible || ""}
                placeholder="Capital ($)"
                onChange={(e) => setCsp("capitalDisponible", Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Strike Put</label>
              <input
                style={inputStyle}
                type="number"
                step={0.5}
                min={0}
                value={params.csp.strikePut || ""}
                placeholder="Strike put"
                onChange={(e) => setCsp("strikePut", Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Prima Put (por acc.)</label>
              <input
                style={inputStyle}
                type="number"
                step={0.01}
                min={0}
                value={params.csp.primaPut || ""}
                placeholder="Prima por acc."
                onChange={(e) => setCsp("primaPut", Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Contratos</label>
              <input
                style={inputStyle}
                type="number"
                step={1}
                min={1}
                value={params.csp.contratos || ""}
                placeholder="1"
                onChange={(e) => setCsp("contratos", Number(e.target.value))}
              />
            </div>
          </div>

          {/* FIC: Hint when CSP not yet populated from option chain. (EN) */}
          {/* FIC: Aviso cuando CSP aún no se ha poblado desde el option chain. (ES) */}
          {params.csp.strikePut === 0 && (
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic", marginTop: "var(--space-xs)" }}>
              Selecciona un PUT desde el option chain para completar esta sección.
            </div>
          )}

          {/* FIC: CSP results — shown after "Analizar Wheel" button press. (EN) */}
          {/* FIC: Resultados CSP — visibles tras presionar el botón "Analizar Wheel". (ES) */}
          {analyzed && (
            <div style={{ marginTop: "var(--space-sm)", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Breakeven</span>
                <span style={resultValueStyle}>
                  {params.csp.strikePut > 0 ? `$${cspResult.breakeven.toFixed(2)}` : "—"}
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Prima total recibida</span>
                <span style={{ ...resultValueStyle, color: "var(--color-buy)" }}>
                  {params.csp.primaPut > 0 ? `$${cspResult.primaTotal.toFixed(2)}` : "—"}
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Capital comprometido</span>
                <span style={resultValueStyle}>
                  {params.csp.strikePut > 0 ? `$${cspResult.capitalComprometido.toFixed(2)}` : "—"}
                </span>
              </div>
              <div style={{ ...resultRowStyle, borderBottom: "none" }}>
                <span style={resultLabelStyle}>ROI estimado</span>
                <span style={{ ...resultValueStyle, color: "var(--color-buy)" }}>
                  {cspResult.capitalComprometido > 0 ? `${(cspResult.roi * 100).toFixed(2)}%` : "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2: COVERED CALL ─────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>COVERED CALL</div>

          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Acciones</label>
              <input
                style={inputStyle}
                type="number"
                step={100}
                min={1}
                value={params.cc.acciones || ""}
                placeholder="100"
                onChange={(e) => setCc("acciones", Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Costo promedio (por acc.)</label>
              <input
                style={inputStyle}
                type="number"
                step={0.01}
                min={0}
                value={params.cc.costoPromedio || ""}
                placeholder="Costo base"
                onChange={(e) => {
                ccCostoEditedRef.current = true; // FIC: User manually edited — stop autocomplete. (EN)
                setCc("costoPromedio", Number(e.target.value));
              }}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Strike Call
                {callSuggestionStatus === "loading" && (
                  <span style={{ marginLeft: "var(--space-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                    buscando…
                  </span>
                )}
                {callSuggestionStatus === "found" && (
                  <span style={{ marginLeft: "var(--space-xs)", color: "var(--color-buy)", fontStyle: "italic" }}>
                    sugerido
                  </span>
                )}
                {callSuggestionStatus === "not_found" && (
                  <span style={{ marginLeft: "var(--space-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                    sin call válido — ingresa manualmente
                  </span>
                )}
              </label>
              <input
                style={inputStyle}
                type="number"
                step={0.5}
                min={0}
                value={params.cc.strikeCall || ""}
                placeholder="Strike call"
                onChange={(e) => setCc("strikeCall", Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Prima Call (por acc.)</label>
              <input
                style={inputStyle}
                type="number"
                step={0.01}
                min={0}
                value={params.cc.primaCall || ""}
                placeholder="Prima por acc."
                onChange={(e) => setCc("primaCall", Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Contratos</label>
              <input
                style={inputStyle}
                type="number"
                step={1}
                min={1}
                value={params.cc.contratos || ""}
                placeholder="1"
                onChange={(e) => setCc("contratos", Number(e.target.value))}
              />
            </div>
          </div>

          {/* FIC: CC results — shown after "Analizar Wheel" button press. (EN) */}
          {/* FIC: Resultados CC — visibles tras presionar el botón "Analizar Wheel". (ES) */}
          {analyzed && (
            <div style={{ marginTop: "var(--space-sm)", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={resultRowStyle}>
                                <span style={resultLabelStyle}>Max Profit</span>
                <span style={{ ...resultValueStyle, color: "var(--color-buy)" }}>
                  {params.cc.strikeCall > 0 ? `$${ccResult.maxProfit.toFixed(2)}` : "—"}
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Prima recibida</span>
                <span style={{ ...resultValueStyle, color: "var(--color-buy)" }}>
                  {params.cc.primaCall > 0 ? `$${ccResult.primaRecibida.toFixed(2)}` : "—"}
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Retorno %</span>
                <span style={resultValueStyle}>
                  {params.cc.costoPromedio > 0 ? `${(ccResult.retornoPct * 100).toFixed(2)}%` : "—"}
                </span>
              </div>
              <div style={{ ...resultRowStyle, borderBottom: "none" }}>
                <span style={resultLabelStyle}>Breakeven</span>
                <span style={resultValueStyle}>
                  {params.cc.costoPromedio > 0 ? `$${ccResult.breakeven.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Simple Wheel status badge (placeholder until real state machine) ── */}
        {analyzed && (() => {
          // FIC: Simple visual classification — not a state machine. (EN)
          // FIC: Clasificacion visual simple — no es una maquina de estados. (ES)
          // Future states: CSP_ACTIVO, SHARES_ASSIGNED, CC_ACTIVO, SHARES_CALLED_AWAY
          const hasCsp  = params.csp.strikePut > 0 && params.csp.primaPut >= 0;
          const hasCc   = params.cc.strikeCall > 0 && params.cc.primaCall >= 0;
          const status  = hasCc ? "CC_CONFIGURADO" : "CSP_CONFIGURADO";
          const color   = hasCc ? "var(--color-buy)" : "var(--color-accent)";
          const label   = hasCc ? "CC Configurado" : "CSP Configurado";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginTop: "var(--space-xs)" }}>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Estado Wheel:</span>
              <span style={{
                fontSize: "var(--font-size-xs)", fontWeight: 700,
                color, border: `1px solid ${color}`,
                borderRadius: "var(--radius-xs)", padding: "2px 10px",
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>
                {status}
              </span>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                {label}
              </span>
            </div>
          );
        })()}

        {/* ── Wheel summary card ── */}
        {analyzed && (() => {
          const capitalComprometido = params.csp.strikePut * params.csp.contratos * 100;
          const primaCsp = params.csp.primaPut * params.csp.contratos * 100;
          const primaCc  = params.cc.primaCall * params.cc.contratos * 100;
          const primaTotal = primaCsp + primaCc;
          const breakevenWheel = params.csp.strikePut - params.csp.primaPut - params.cc.primaCall;
          const retornoEstimado = capitalComprometido > 0 ? primaTotal / capitalComprometido : 0;
          const rows: Array<{ label: string; value: string; highlight?: boolean }> = [
            { label: "Capital comprometido",  value: capitalComprometido > 0 ? `$${capitalComprometido.toFixed(2)}` : "—" },
            { label: "Prima CSP recibida",    value: primaCsp > 0 ? `$${primaCsp.toFixed(2)}` : "—", highlight: true },
            { label: "Prima CC recibida",     value: primaCc  > 0 ? `$${primaCc.toFixed(2)}`  : "—", highlight: true },
            { label: "Breakeven Wheel",       value: breakevenWheel > 0 ? `$${breakevenWheel.toFixed(2)}` : "—" },
            { label: "Retorno estimado",      value: retornoEstimado > 0 ? `${(retornoEstimado * 100).toFixed(2)}%` : "—", highlight: true },
          ];
          return (
            <div style={{
              background: "var(--color-surface-raised)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-md)",
              border: "1px solid var(--color-border-subtle)",
            }}>
              <div style={{
                fontSize: "var(--font-size-xs)", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: "var(--color-accent)", marginBottom: "var(--space-sm)",
              }}>
                RESUMEN WHEEL
              </div>
              {rows.map((r) => (
                <div key={r.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "var(--space-xs) 0",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  fontSize: "var(--font-size-sm)",
                }}>
                  <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.highlight ? "var(--color-buy)" : "var(--color-text)" }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Sección de evaluación Wheel */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>EVALUAR RESULTADO</div>
          <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={labelStyle}>Precio final al vencimiento ($)</label>
              <input
                style={inputStyle}
                type="number"
                step={0.01}
                min={0}
                value={precioFinal || ""}
                placeholder="505.00"
                onChange={(e) => {
                  setPrecioFinal(Number(e.target.value));
                  setEvalResult(null); // FIC: Clear stale result when price changes. (EN)
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                onClick={() => {
                  if (precioFinal > 0) setEvalResult(evaluateWheel(params, precioFinal));
                }}
                disabled={precioFinal <= 0}
                style={{
                  width: "100%",
                  background: precioFinal > 0 ? "var(--color-accent)" : "rgba(73,79,223,0.3)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.5rem 1rem",
                  cursor: precioFinal > 0 ? "pointer" : "not-allowed",
                  fontWeight: "var(--font-weight-bold)" as React.CSSProperties["fontWeight"],
                  fontSize: "var(--font-size-sm)",
                }}
              >
                Evaluar Wheel
              </button>
            </div>
          </div>

          {/* FIC: Evaluation results — shown after Evaluar Wheel is clicked. (EN) */}
          {evalResult && (() => {
            const estadoCSPColor = evalResult.estadoCSP === "PUT_EXPIRA_SIN_VALOR"
              ? "var(--color-buy)" : "var(--color-sell)";
            const estadoCCColor = evalResult.estadoCC === "ACCIONES_VENDIDAS"
              ? "var(--color-buy)" : evalResult.estadoCC === "CONSERVA_ACCIONES"
              ? "var(--color-accent)" : "var(--color-text-muted)";
            const totalColor = evalResult.gananciaTotal >= 0 ? "var(--color-buy)" : "var(--color-sell)";

            const evalRows: Array<{ label: string; value: string; color?: string }> = [
              { label: "Estado CSP",    value: evalResult.estadoCSP.replace(/_/g, " "),  color: estadoCSPColor },
              { label: "Estado CC",     value: evalResult.estadoCC.replace(/_/g, " "),   color: estadoCCColor },
              { label: "Ganancia CSP",  value: `$${evalResult.gananciaCSP.toFixed(2)}`,  color: evalResult.gananciaCSP  >= 0 ? "var(--color-buy)" : "var(--color-sell)" },
              { label: "Ganancia CC",   value: evalResult.estadoCC !== "N/A" ? `$${evalResult.gananciaCC.toFixed(2)}` : "—", color: evalResult.gananciaCC   >= 0 ? "var(--color-buy)" : "var(--color-sell)" },
              { label: "Ganancia Total",value: `$${evalResult.gananciaTotal.toFixed(2)}`, color: totalColor },
              { label: "ROI",           value: `${(evalResult.roi * 100).toFixed(2)}%`,  color: totalColor },
            ];

            return (
              <div style={{ marginTop: "var(--space-sm)" }}>
                {evalRows.map((r) => (
                  <div key={r.label} style={{ ...resultRowStyle }}>
                    <span style={resultLabelStyle}>{r.label}</span>
                    <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", color: r.color ?? "var(--color-text)" }}>
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── Analizar button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleAnalyze}
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "0.5rem 1.75rem",
              cursor: "pointer",
              fontWeight: "var(--font-weight-bold)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--font-size-sm)",
            }}
          >
            Analizar Wheel
          </button>
        </div>

      </div>
    </div>
  );
}

export default WheelParamsModal;
