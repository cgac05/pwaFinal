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
import {
  fetchWheelEligibility,
  type WheelEligibilityCriterion,
  type WheelEligibilityResult,
} from "../../../services/strategies/wheelEligibilityApi";

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

// FIC: Result of Roll 1 lookup — fetched from real option chain, no backend changes. (EN)
// FIC: Resultado de la búsqueda del Roll 1 — obtenido de la cadena de opciones real, sin cambios backend. (ES)
interface Roll1Result {
  status: "idle" | "loading" | "found" | "not_found";
  currentExpiration?: string;
  nextExpiration?: string;
  strikeCallCurrent?: number;
  strikeCallSuggested?: number;
  prima?: number;
  delta?: number | null;
  creditoEstimado?: number;
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
  padding: "var(--space-md)",
  width: "min(1200px, 98vw)",
  boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-sm)",
};

const modalColumnsStyle: React.CSSProperties = {
  display: "grid",
  gap: "var(--space-sm)",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  alignItems: "start",
};

const modalColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-sm)",
  minWidth: 0,
};

const sectionStyle: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-sm)",
  border: "1px solid var(--color-border-subtle)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "var(--font-size-xs)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-accent)",
  marginBottom: "2px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: "var(--space-xs)",
  gridTemplateColumns: "repeat(3, 1fr)",
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  fontSize: "var(--font-size-xs)",
  padding: "3px var(--space-xs)",
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
  fontSize: "0.68rem",
  color: "var(--color-text-muted)",
  marginBottom: "2px",
  display: "block",
};

const resultRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "2px 0",
  borderBottom: "1px solid var(--color-border-subtle)",
  fontSize: "var(--font-size-xs)",
};

const resultLabelStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "0.68rem",
};

const resultValueStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--color-text)",
  fontSize: "var(--font-size-xs)",
};

const stageGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "var(--space-xs)",
  gridTemplateColumns: "repeat(6, 1fr)",
};

const stageCardStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-sm)",
  padding: "6px 8px",
  border: "1px solid var(--color-border-subtle)",
  minWidth: 0,
};

const unavailableStageStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--font-size-xs)",
  fontStyle: "italic",
  lineHeight: 1.4,
};

// ─── Operational Recommendation ──────────────────────────────────────────────

// FIC: WheelOperationalRecommendation — purely presentational, no new calculations,
// no backend calls, no predictions. Reads existing eligibility + params data. (EN)
// FIC: WheelOperationalRecommendation — puramente presentacional, sin nuevos cálculos,
// sin llamadas backend, sin predicciones. Lee datos existentes de eligibility + params. (ES)
function WheelOperationalRecommendation({
  eligibility,
  eligibilityLoading,
  csp,
  cc,
  expiration,
}: {
  eligibility: WheelEligibilityResult | null;
  eligibilityLoading: boolean;
  csp: WheelCspParams;
  cc: WheelCcParams;
  expiration: string | undefined;
}) {
  if (eligibilityLoading) {
    return (
      <div style={{
        background: "var(--color-surface-raised)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-md)",
        border: "1px solid var(--color-border-subtle)",
        fontSize: "var(--font-size-xs)",
        color: "var(--color-text-muted)",
        fontStyle: "italic",
      }}>
        Evaluando elegibilidad para recomendación operativa…
      </div>
    );
  }

  if (!eligibility) return null;

  const eligible = eligibility.eligible;
  const passedCriteria = eligibility.criteria.filter((c) => c.status === "pass");
  const failedCriteria = eligibility.criteria.filter((c) => c.status === "fail");

  const hasPut  = csp.strikePut > 0 && csp.primaPut >= 0;
  const hasCall = cc.strikeCall > 0 && cc.primaCall >= 0;

  const borderColor = eligible ? "var(--color-buy)" : "var(--color-warning)";
  const headerBg    = eligible ? "rgba(34,197,94,0.08)" : "rgba(251,191,36,0.08)";
  const icon        = eligible ? "✅" : "⚠️";
  const headline    = eligible
    ? "Momento adecuado para iniciar Wheel."
    : "No se recomienda iniciar Wheel actualmente.";
  const action      = eligible
    ? "Acción recomendada: Vender Cash Secured Put."
    : "Acción recomendada: Esperar una mejor configuración técnica.";

  const money = (v: number) => `$${v.toFixed(2)}`;

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "var(--font-size-xs)",
    padding: "2px 0",
  };

  const mutedLabel: React.CSSProperties = {
    color: "var(--color-text-muted)",
  };

  const boldValue: React.CSSProperties = {
    fontWeight: 600,
    color: "var(--color-text)",
    fontVariantNumeric: "tabular-nums",
  };

  const subTitleStyle: React.CSSProperties = {
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--color-text-muted)",
    marginBottom: "4px",
  };

  return (
    <div style={{
      background: "var(--color-surface-raised)",
      borderRadius: "var(--radius-sm)",
      border: `1px solid ${borderColor}`,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        background: headerBg,
        padding: "var(--space-sm) var(--space-md)",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        borderBottom: `1px solid ${borderColor}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>{icon}</span>
          <span style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: eligible ? "var(--color-buy)" : "var(--color-warning)",
          }}>
            RECOMENDACIÓN OPERATIVA
          </span>
        </div>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text)", fontWeight: 600 }}>
          {headline}
        </div>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          {action}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "var(--space-sm) var(--space-md)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>

        {/* Vencimiento */}
        <div>
          <div style={subTitleStyle}>Vencimiento</div>
          <div style={rowStyle}>
            <span style={mutedLabel}>Fecha seleccionada</span>
            <span style={boldValue}>{expiration ?? "—"}</span>
          </div>
        </div>

        {/* Contrato PUT (solo si hay datos) */}
        {eligible && (
          <div>
            <div style={subTitleStyle}>Contrato PUT</div>
            <div style={rowStyle}>
              <span style={mutedLabel}>Strike</span>
              <span style={boldValue}>{hasPut ? money(csp.strikePut) : "—"}</span>
            </div>
            <div style={rowStyle}>
              <span style={mutedLabel}>Prima</span>
              <span style={boldValue}>{hasPut ? `${money(csp.primaPut)} / acción` : "—"}</span>
            </div>
          </div>
        )}

        {/* Criterios: favorables o fallidos */}
        <div>
          <div style={subTitleStyle}>
            {eligible ? "Motivos favorables" : "Criterios fallidos"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {eligible
              ? passedCriteria.length > 0
                ? passedCriteria.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-buy)", flexShrink: 0, marginTop: "1px" }}>✓</span>
                      <span style={{ color: "var(--color-text)" }}>{c.label}</span>
                    </div>
                  ))
                : <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>Sin criterios disponibles.</span>
              : failedCriteria.length > 0
                ? failedCriteria.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "var(--font-size-xs)" }}>
                      <span style={{ color: "var(--color-warning)", flexShrink: 0, marginTop: "1px" }}>!</span>
                      <span style={{ color: "var(--color-warning)" }}>{c.label}</span>
                    </div>
                  ))
                : <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>Sin criterios fallidos registrados.</span>
            }
          </div>
        </div>

        {/* Covered Call sugerido (solo si elegible y hay datos de CC) */}
        {eligible && (
          <div>
            <div style={subTitleStyle}>Covered Call sugerido en caso de asignación</div>
            {hasCall
              ? (
                <>
                  <div style={rowStyle}>
                    <span style={mutedLabel}>Strike</span>
                    <span style={boldValue}>{money(cc.strikeCall)}</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={mutedLabel}>Prima</span>
                    <span style={boldValue}>{`${money(cc.primaCall)} / acción`}</span>
                  </div>
                </>
              )
              : (
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  Selecciona un CALL desde el option chain para ver la sugerencia.
                </span>
              )
            }
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

// FIC: These are module-level refs so suggestCallFromChain can write to state
// without being declared inside the component (avoids stale closure issues). (EN)
// FIC: Refs a nivel de módulo para que suggestCallFromChain pueda escribir estado
// sin declararse dentro del componente (evita problemas de closure obsoleto). (ES)
function WheelEligibilitySummary({
  result,
  loading,
  error,
}: {
  result: WheelEligibilityResult | null;
  loading: boolean;
  error: string | null;
}) {
  const statusColor = result?.eligible
    ? "var(--color-buy)"
    : result
      ? "var(--color-warning)"
      : "var(--color-text-muted)";
  const title = loading
    ? "Evaluando elegibilidad Wheel..."
    : error
      ? "Elegibilidad Wheel no disponible"
      : result?.eligible
        ? "Activo apto para Wheel"
        : "Advertencia de elegibilidad Wheel";
  const criteria = result?.criteria ?? [];

  const markerFor = (criterion: WheelEligibilityCriterion) => {
    if (criterion.status === "pass") return { text: "✓", color: "var(--color-buy)" };
    if (criterion.status === "fail") return { text: "!", color: "var(--color-warning)" };
    return { text: "⚠", color: "var(--color-warning)" };
  };

  return (
    <div style={{
      background: "var(--color-surface-raised)",
      borderRadius: "var(--radius-sm)",
      padding: "var(--space-md)",
      border: `1px solid ${result && !result.eligible ? "var(--color-warning)" : "var(--color-border-subtle)"}`,
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-sm)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
        <span style={{ color: statusColor, fontSize: "1rem", lineHeight: 1 }}>●</span>
        <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--color-text)" }}>
          {title}
        </span>
        {result && (
          <span style={{
            marginLeft: "auto",
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {result.summary.passed}/{result.summary.total - result.summary.unavailable} evaluados
            {result.summary.unavailable > 0 && ` · ${result.summary.unavailable} N/D`}
          </span>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          Consultando filtros técnicos para el ticker actual.
        </div>
      )}

      {error && (
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-warning)" }}>
          {error}
        </div>
      )}

      {criteria.length > 0 && (
        <div style={{ display: "grid", gap: "6px" }}>
          {criteria.map((criterion) => {
            const marker = markerFor(criterion);
            return (
              <div
                key={criterion.id}
                title={criterion.details}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "var(--font-size-xs)",
                  color: criterion.status === "fail" ? "var(--color-warning)" : "var(--color-text-muted)",
                }}
              >
                <span style={{
                  color: marker.color,
                  width: 14,
                  textAlign: "center",
                  fontWeight: 800,
                  flexShrink: 0,
                }}>
                  {marker.text}
                </span>
                <span style={{ color: criterion.status === "pass" ? "var(--color-text)" : undefined }}>
                  {criterion.label}
                </span>
                {criterion.status === "unavailable" && (
                  <span style={{ color: "var(--color-warning)", marginLeft: "auto" }}>no disponible</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

let _setSuggestionStatus: React.Dispatch<React.SetStateAction<"idle"|"loading"|"found"|"not_found">> | null = null;
let _onChangeSetter: ((p: WheelModalParams) => void) | null = null;
let _latestParams: WheelModalParams | null = null;
// FIC: Monotonic counter — incremented on each call so stale async responses are discarded. (EN)
// FIC: Contador monótono — incrementado en cada llamada para descartar respuestas asíncronas obsoletas. (ES)
let _suggestCallVersion = 0;

// FIC: Fetch option chain for the PUT's own expiration, find best OTM call (delta ~0.30). (EN)
// FIC: Obtiene la cadena de opciones de la expiración del PUT, encuentra el mejor call OTM (delta ~0.30). (ES)
// FIC: expiration param avoids a redundant fetchExpirations round-trip and anchors to the correct date. (EN)
// FIC: El parámetro expiration evita un round-trip innecesario a fetchExpirations y ancla la fecha correcta. (ES)
async function suggestCallFromChain(
  params: WheelModalParams,
  strikePut: number,
  ticker: string,
  expiration?: string,
): Promise<void> {
  if (!_setSuggestionStatus || !_onChangeSetter) return;

  // FIC: Capture version before any await — discard result if a newer call arrived. (EN)
  // FIC: Captura la versión antes de cualquier await — descarta el resultado si llegó una llamada más reciente. (ES)
  _suggestCallVersion += 1;
  const myVersion = _suggestCallVersion;

  _setSuggestionStatus("loading");
  _latestParams = params;

  try {
    // FIC: Use provided expiration when available; fall back to nearest only if not supplied. (EN)
    // FIC: Usa la expiración provista si está disponible; retrocede a la más cercana solo si no se proveyó. (ES)
    let resolvedExpiration = expiration;
    if (!resolvedExpiration) {
      const expData = await fetchExpirations(ticker);
      if (myVersion !== _suggestCallVersion) return; // stale — newer call already in flight
      resolvedExpiration = expData.expirations[0];
    }
    if (!resolvedExpiration) { _setSuggestionStatus("not_found"); return; }

    const chain = await fetchOptionChain(ticker, resolvedExpiration);
    if (myVersion !== _suggestCallVersion) return; // stale — discard

    // FIC: OTM filter — strike must exceed underlying price, not just PUT strike. (EN)
    // FIC: Filtro OTM — el strike debe superar el precio del subyacente, no solo el strike del PUT. (ES)
    // FIC: Then prefer delta closest to 0.30 (max 0.40); fallback to nearest OTM strike. (EN)
    const otmCandidates = chain.rows
      .filter((r) => r.strike > chain.underlyingPrice && r.callBid > 0);
    const deltaCandidates = otmCandidates
      .filter((r) => Number.isFinite(r.callDelta) && r.callDelta > 0 && r.callDelta <= 0.40)
      .sort((a, b) => Math.abs(a.callDelta - 0.30) - Math.abs(b.callDelta - 0.30));
    const fallbackCandidates = otmCandidates
      .sort((a, b) => a.strike - b.strike);

    const best = deltaCandidates[0] ?? fallbackCandidates[0];
    if (!best) { _setSuggestionStatus("not_found"); return; }
    const primaCall = parseFloat(((best.callBid + best.callAsk) / 2).toFixed(4));

    // FIC: Final staleness check before writing state — guards against race on slow networks. (EN)
    // FIC: Verificación final de obsolescencia antes de escribir estado — protege contra race en redes lentas. (ES)
    if (myVersion !== _suggestCallVersion) return;

    // FIC: Use latest params snapshot to avoid stale closure overwriting user edits. (EN)
    const currentParams = _latestParams ?? params;
    _onChangeSetter({
      ...currentParams,
      cc: { ...currentParams.cc, strikeCall: best.strike, primaCall },
    });
    _setSuggestionStatus("found");

  } catch {
    // FIC: Network failure or cancellation — stay silent, allow manual input. (EN)
    // FIC: Falla de red o cancelación — permanecer silencioso, permitir captura manual. (ES)
    if (myVersion === _suggestCallVersion) _setSuggestionStatus("idle");
  }
}

// FIC: Fetch the next available expiration and find the best OTM call >= strikeFloor. (EN)
// FIC: Obtiene la siguiente expiración disponible y busca el mejor call OTM >= strikeFloor. (ES)
// Reuses fetchExpirations + fetchOptionChain — no new endpoints. (EN)
// Reutiliza fetchExpirations + fetchOptionChain — sin nuevos endpoints. (ES)
async function computeRoll1(
  ticker: string,
  currentExpiration: string,
  strikeFloor: number,
  contratos: number,
): Promise<Roll1Result> {
  try {
    const expData = await fetchExpirations(ticker);
    const exps = expData.expirations;
    const currentIdx = exps.indexOf(currentExpiration);

    // FIC: If currentExpiration not found in list, fall back to index 1 (second nearest). (EN)
    // FIC: Si currentExpiration no está en la lista, usar índice 1 (segunda más cercana). (ES)
    const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 1;
    const nextExpiration = nextIdx < exps.length ? exps[nextIdx] : undefined;

    if (!nextExpiration) {
      return { status: "not_found", currentExpiration };
    }

    const chain = await fetchOptionChain(ticker, nextExpiration);

    // FIC: OTM calls at or above current strike with liquidity (callBid > 0). (EN)
    // FIC: Calls OTM en o por encima del strike actual con liquidez (callBid > 0). (ES)
    const otmCandidates = chain.rows
      .filter((r) => r.strike > chain.underlyingPrice && r.callBid > 0);
    const deltaCandidates = otmCandidates
      .filter((r) => Number.isFinite(r.callDelta) && r.callDelta > 0 && r.callDelta <= 0.40)
      .sort((a, b) => Math.abs(a.callDelta - 0.30) - Math.abs(b.callDelta - 0.30));
    const fallbackCandidates = otmCandidates
      .sort((a, b) => a.strike - b.strike);

    const best = deltaCandidates[0] ?? fallbackCandidates[0];
    if (!best) {
      return { status: "not_found", currentExpiration, nextExpiration };
    }

    // FIC: Midpoint bid/ask — same logic as suggestCallFromChain. (EN)
    // FIC: Punto medio bid/ask — misma lógica que suggestCallFromChain. (ES)
    const prima = parseFloat(((best.callBid + best.callAsk) / 2).toFixed(4));
    const delta = typeof best.callDelta === "number" && best.callDelta !== 0
      ? best.callDelta
      : null;

    return {
      status: "found",
      currentExpiration,
      nextExpiration,
      strikeCallCurrent: strikeFloor,
      strikeCallSuggested: best.strike,
      prima,
      delta,
      creditoEstimado: parseFloat((prima * contratos * 100).toFixed(2)),
    };
  } catch {
    // FIC: Network or parse failure — silently report not_found. (EN)
    // FIC: Falla de red o parseo — reportar not_found silenciosamente. (ES)
    return { status: "not_found", currentExpiration };
  }
}

// ─── Day-by-day simulation (pure, no backend) ─────────────────────────────────

interface DaySimRow {
  day: number;
  fecha: string;
  dte: number;
  precioEstimado: number;
  valorOpcion: number;
  pnlAcum: number;
  pctGanado: number;
  estado: "normal" | "take_profit" | "stop_loss" | "roll" | "zona_roll" | "vencimiento";
  accion: string;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function buildDaySim(
  currentPrice: number,
  strikePut: number,
  primaPut: number,
  contratos: number,
  precioFinal: number,
  fechaInicio: string,
  fechaFin: string,
): DaySimRow[] {
  if (currentPrice <= 0 || strikePut <= 0 || primaPut <= 0 || precioFinal <= 0) return [];
  if (!fechaInicio || !fechaFin) return [];

  const startMs    = new Date(fechaInicio).getTime();
  const endMs      = new Date(fechaFin).getTime();
  const dteEntrada = Math.max(1, Math.round((endMs - startMs) / 86400000));

  const multiplier       = contratos * 100;
  const intrinsicAtEntry = Math.max(strikePut - currentPrice, 0);
  const timeValueAtEntry = Math.max(primaPut - intrinsicAtEntry, 0);
  const slThreshold      = primaPut * 4;

  const rows: DaySimRow[] = [];
  let rollTriggered = false;

  for (let day = 0; day <= dteEntrada; day++) {
    const dte  = dteEntrada - day;
    const t    = day / dteEntrada;

    const rowDate = new Date(startMs + day * 86400000);
    const fecha   = isoDate(rowDate);

    const precioEstimado = parseFloat((currentPrice + (precioFinal - currentPrice) * t).toFixed(2));
    const intrinsicValue = Math.max(strikePut - precioEstimado, 0);
    const timeDecay      = Math.sqrt((dteEntrada - day) / dteEntrada);
    const valorOpcion    = parseFloat((intrinsicValue + timeValueAtEntry * timeDecay).toFixed(4));
    const pnlAcum        = parseFloat(((primaPut - valorOpcion) * multiplier).toFixed(2));
    const pctGanado      = primaPut > 0 ? (primaPut - valorOpcion) / primaPut : 0;

    let estado: DaySimRow["estado"] = "normal";
    let accion = "Mantener posición";

    if (pctGanado >= 0.50) {
      estado = "take_profit";
      accion = "CERRAR — Take profit 50%: ganaste la mitad de la prima en menos tiempo";
    } else if (valorOpcion >= slThreshold) {
      estado = "stop_loss";
      accion = "CERRAR URGENTE — recompra supera 4× prima cobrada (SL 400%)";
    } else if (dte === 21 && !rollTriggered) {
      estado = "roll";
      accion = "ROLL al siguiente vencimiento — 21 DTE sin alcanzar TP del 50%";
      rollTriggered = true;
    } else if (rollTriggered && dte > 0) {
      estado = "zona_roll";
      accion = "Zona de riesgo — la posición debería estar rolada al mes siguiente";
    } else if (day === dteEntrada) {
      estado = "vencimiento";
      accion = precioEstimado >= strikePut
        ? "PUT expiró sin valor — ciclo completo, volver a Etapa 1"
        : "ASIGNADO — precio < strike, pasar a Etapa 2 (Covered Call)";
    }

    rows.push({ day, fecha, dte, precioEstimado, valorOpcion, pnlAcum, pctGanado, estado, accion });
    if (estado === "take_profit" || estado === "stop_loss") break;
  }

  return rows;
}

// ─── Operational Rules Panel ──────────────────────────────────────────────────

function WheelRulesPanel({
  csp,
  cc,
  dteEntrada,
  fechaInicio,
}: {
  csp: WheelCspParams;
  cc: WheelCcParams;
  dteEntrada: number;
  fechaInicio: string;
}) {
  const hasCsp = csp.strikePut > 0 && csp.primaPut > 0;
  const hasCc  = cc.strikeCall > 0 && cc.primaCall > 0;
  const tpPut  = csp.primaPut  * csp.contratos * 100 * 0.50;
  const slPut  = csp.primaPut  * csp.contratos * 100 * 4;
  const tpCall = cc.primaCall  * cc.contratos  * 100 * 0.50;
  const rollDia = dteEntrada > 21 ? dteEntrada - 21 : 0;
  const rollFecha = rollDia > 0 && fechaInicio
    ? isoDate(new Date(new Date(fechaInicio).getTime() + rollDia * 86400000))
    : "";
  const money = (v: number) => `$${v.toFixed(2)}`;

  const chip = (
    label: string,
    value: string,
    color: string,
    detail: string,
  ) => (
    <div style={{
      background: "var(--color-surface)",
      border: `1px solid ${color}30`,
      borderRadius: "var(--radius-sm)",
      padding: "5px 8px",
      display: "flex",
      flexDirection: "column",
      gap: "1px",
    }}>
      <div style={{ fontSize: "0.63rem", color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, color, fontSize: "var(--font-size-xs)" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontStyle: "italic", lineHeight: 1.3 }}>
        {detail}
      </div>
    </div>
  );

  return (
    <div style={{
      background: "var(--color-surface-raised)",
      borderRadius: "var(--radius-sm)",
      padding: "var(--space-sm)",
      border: "1px solid var(--color-border-subtle)",
    }}>
      <div style={{
        fontSize: "var(--font-size-xs)",
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: "var(--color-accent)",
        marginBottom: "var(--space-xs)",
      }}>
        REGLAS OPERATIVAS
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-xs)" }}>
        {chip("TP PUT (50%)", hasCsp ? money(tpPut) : "—", "var(--color-buy)",   "Cierra al 50% de ganancia")}
        {chip("SL PUT (400%)", hasCsp ? money(slPut) : "—", "var(--color-sell)", "Cierra si recompra > 4× prima")}
        {chip("Roll PUT", rollDia > 0 ? `Día ${rollDia}${rollFecha ? ` · ${rollFecha}` : ""}` : "< 21 DTE", "var(--color-warning)", "Si no hay 50% a 21 DTE, rolar")}
        {chip("TP CALL (50%)", hasCc ? money(tpCall) : "—", "var(--color-buy)",  "Cierra al 50% de ganancia")}
        <div style={{ gridColumn: "1 / -1" }}>
          {chip("SL CALL", "Stage 4 Weinstein", "var(--color-sell)", "Cierra todo si el activo entra en tendencia bajista")}
        </div>
      </div>
    </div>
  );
}

// ─── Day Simulation Table ──────────────────────────────────────────────────────

function WheelDaySimSection({ rows, primaTotal }: { rows: DaySimRow[]; primaTotal: number }) {
  if (rows.length === 0) return null;

  // Día 0: entrada. Siempre el mejor momento para VENDER (abrir la posición corta en el PUT)
  const openRow = rows[0];

  // Mejor día para CERRAR (comprar de vuelta el PUT):
  //   1. Take Profit (50%) — escenario ideal, se cierra antes de tiempo
  //   2. Roll (21 DTE)     — si no hubo TP, la estrategia dice rolar al mes siguiente
  //   3. Stop Loss (400%)  — emergencia, pérdida excede lo tolerable
  //   4. Vencimiento       — último recurso
  const bestCloseRow =
    rows.find((r) => r.estado === "take_profit") ??
    rows.find((r) => r.estado === "roll")         ??
    rows.find((r) => r.estado === "stop_loss")    ??
    rows[rows.length - 1];

  const estadoColors: Record<DaySimRow["estado"], string> = {
    normal:       "var(--color-text-muted)",
    take_profit:  "var(--color-buy)",
    stop_loss:    "var(--color-sell)",
    roll:         "var(--color-warning)",
    zona_roll:    "#9a6f00",
    vencimiento:  "var(--color-accent)",
  };

  const estadoLabels: Record<DaySimRow["estado"], string> = {
    normal:       "Normal",
    take_profit:  "Take Profit ✓",
    stop_loss:    "Stop Loss ✕",
    roll:         "ROLL (21 DTE)",
    zona_roll:    "Sin rolar ⚠",
    vencimiento:  "Vencimiento",
  };

  const thStyle: React.CSSProperties = {
    padding: "3px 7px",
    textAlign: "left",
    color: "var(--color-text-muted)",
    fontWeight: 700,
    whiteSpace: "nowrap",
    fontSize: "0.68rem",
    borderBottom: "2px solid var(--color-border)",
    position: "sticky" as const,
    top: 0,
    background: "var(--color-surface-raised)",
  };

  const tdBase: React.CSSProperties = {
    padding: "2px 7px",
    fontVariantNumeric: "tabular-nums",
    fontSize: "0.68rem",
    whiteSpace: "nowrap",
  };

  const summaryCard = (
    label: string,
    day: number,
    dte: number,
    precio: number,
    pnl: number,
    pct: number,
    estado: DaySimRow["estado"],
    accion: string,
    borderColor: string,
  ) => (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-sm)",
      padding: "6px 10px",
      background: `${borderColor}10`,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      flex: 1,
    }}>
      <div style={{ fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.07em", color: borderColor, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "baseline", flexWrap: "wrap" as const }}>
        <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", color: borderColor }}>Día {day}</span>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>DTE {dte}</span>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text)" }}>${precio.toFixed(2)}</span>
      </div>
      <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" as const }}>
        <span style={{ fontSize: "var(--font-size-xs)", color: pnl >= 0 ? "var(--color-buy)" : "var(--color-sell)", fontWeight: 600 }}>
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
        </span>
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
          ({(pct * 100).toFixed(1)}% prima)
        </span>
        <span style={{ fontSize: "0.63rem", color: estadoColors[estado] }}>
          {estadoLabels[estado]}
        </span>
      </div>
      <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>{accion}</div>
    </div>
  );

  return (
    <div style={{
      background: "var(--color-surface-raised)",
      borderRadius: "var(--radius-sm)",
      padding: "var(--space-sm)",
      border: "1px solid var(--color-border-subtle)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-xs)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)" }}>
        <div style={{
          fontSize: "var(--font-size-xs)",
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: "var(--color-accent)",
        }}>
          SIMULACIÓN DÍA A DÍA — PUT
        </div>
        <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
          Precio lineal · Decay √tiempo
        </div>
      </div>

      {/* Aviso cuando precio final = precio de entrada (simulación plana) */}
      {rows[0].precioEstimado === rows[rows.length - 1].precioEstimado && (
        <div style={{
          background: "rgba(251,191,36,0.10)",
          border: "1px solid var(--color-warning)",
          borderRadius: "var(--radius-sm)",
          padding: "5px 10px",
          fontSize: "0.68rem",
          color: "var(--color-warning)",
        }}>
          Precio plano: el "Precio final al vencimiento" es igual al precio actual (${rows[0].precioEstimado.toFixed(2)}).
          Las dos tarjetas muestran el mismo precio porque no hay movimiento simulado.
          Cambia el precio final para ver escenarios de subida o bajada.
        </div>
      )}

      {/* Mejores días */}
      <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" as const }}>

        {/* Card VENDER: precio = precio de ENTRADA (hoy), prima total a cobrar */}
        <div style={{
          border: "1px solid var(--color-buy)",
          borderRadius: "var(--radius-sm)",
          padding: "6px 10px",
          background: "rgba(34,197,94,0.06)",
          display: "flex", flexDirection: "column", gap: "2px", flex: 1,
        }}>
          <div style={{ fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "var(--color-buy)", fontWeight: 700 }}>
            Mejor día para VENDER el PUT (abrir posición)
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "baseline", flexWrap: "wrap" as const }}>
            <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", color: "var(--color-buy)" }}>Día {openRow.day} — {openRow.fecha}</span>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              DTE {openRow.dte} <span style={{ fontStyle: "italic" }}>(días hasta vencimiento al entrar)</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "0.63rem", color: "var(--color-text-muted)" }}>Precio de entrada:</span>
            <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, color: "var(--color-text)" }}>${openRow.precioEstimado.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" as const }}>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-buy)", fontWeight: 600 }}>
              Prima cobrada: +${primaTotal.toFixed(2)}
            </span>
            <span style={{ fontSize: "0.63rem", color: "var(--color-text-muted)" }}>crédito máximo</span>
          </div>
          <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            Vendes el PUT hoy y cobras la prima completa. Tu máx. ganancia = ${primaTotal.toFixed(2)}
          </div>
        </div>

        {/* Card COMPRAR: precio = precio ESTIMADO en el día de salida (diferente al de entrada) */}
        <div style={{
          border: `1px solid ${bestCloseRow.estado === "take_profit" ? "var(--color-buy)" : bestCloseRow.estado === "stop_loss" ? "var(--color-sell)" : "var(--color-warning)"}`,
          borderRadius: "var(--radius-sm)",
          padding: "6px 10px",
          background: bestCloseRow.estado === "take_profit" ? "rgba(34,197,94,0.06)" : bestCloseRow.estado === "stop_loss" ? "rgba(239,68,68,0.06)" : "rgba(251,191,36,0.06)",
          display: "flex", flexDirection: "column", gap: "2px", flex: 1,
        }}>
          <div style={{ fontSize: "0.6rem", textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 700,
            color: bestCloseRow.estado === "take_profit" ? "var(--color-buy)" : bestCloseRow.estado === "stop_loss" ? "var(--color-sell)" : "var(--color-warning)" }}>
            {bestCloseRow.estado === "take_profit"
              ? "Mejor día para COMPRAR de vuelta el PUT (TP 50%)"
              : bestCloseRow.estado === "roll"
                ? "Mejor día para CERRAR y ROLAR al mes siguiente (21 DTE)"
                : bestCloseRow.estado === "stop_loss"
                  ? "Mejor día para CERRAR urgente (Stop Loss 400%)"
                  : "Mejor día para CERRAR (vencimiento)"}
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "baseline", flexWrap: "wrap" as const }}>
            <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)",
              color: bestCloseRow.estado === "take_profit" ? "var(--color-buy)" : bestCloseRow.estado === "stop_loss" ? "var(--color-sell)" : "var(--color-warning)" }}>
              Día {bestCloseRow.day} — {bestCloseRow.fecha}
            </span>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              DTE {bestCloseRow.dte} <span style={{ fontStyle: "italic" }}>(días restantes al cerrar)</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "0.63rem", color: "var(--color-text-muted)" }}>Precio estimado del activo al cerrar:</span>
            <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, color: "var(--color-text)" }}>${bestCloseRow.precioEstimado.toFixed(2)}</span>
            {bestCloseRow.precioEstimado === openRow.precioEstimado && (
              <span style={{ fontSize: "0.58rem", color: "var(--color-warning)", fontStyle: "italic" }}>(igual al de entrada — precio plano)</span>
            )}
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" as const }}>
            <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 600,
              color: bestCloseRow.pnlAcum >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
              {bestCloseRow.pnlAcum >= 0 ? "+" : ""}${bestCloseRow.pnlAcum.toFixed(2)}
            </span>
            <span style={{ fontSize: "0.63rem", color: "var(--color-text-muted)" }}>
              ({(bestCloseRow.pctGanado * 100).toFixed(1)}% de la prima cobrada)
            </span>
          </div>
          <div style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            {bestCloseRow.accion}
          </div>
        </div>
      </div>

      {/* Tabla con scroll */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "240px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Fecha", "Día", "DTE", "Precio", "Valor opt.", "P&L", "% ganado", "Estado", "Acción"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.day}
                style={{
                  borderBottom: "1px solid var(--color-border-subtle)",
                  background: r.estado !== "normal" ? `${estadoColors[r.estado]}14` : undefined,
                }}
              >
                <td style={{ ...tdBase, color: "var(--color-text-muted)" }}>{r.fecha}</td>
                <td style={tdBase}>{r.day}</td>
                <td style={{
                  ...tdBase,
                  color: r.dte > 0 && r.dte <= 21 ? "var(--color-warning)" : undefined,
                  fontWeight: r.dte > 0 && r.dte <= 21 ? 700 : undefined,
                }}>
                  {r.dte}
                </td>
                <td style={tdBase}>${r.precioEstimado.toFixed(2)}</td>
                <td style={tdBase}>${r.valorOpcion.toFixed(4)}</td>
                <td style={{ ...tdBase, color: r.pnlAcum >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                  {r.pnlAcum >= 0 ? "+" : ""}${r.pnlAcum.toFixed(2)}
                </td>
                <td style={{
                  ...tdBase,
                  color: r.pctGanado >= 0.50 ? "var(--color-buy)" : undefined,
                  fontWeight: r.pctGanado >= 0.50 ? 700 : undefined,
                }}>
                  {(r.pctGanado * 100).toFixed(1)}%
                </td>
                <td style={{ ...tdBase, color: estadoColors[r.estado], fontWeight: 600 }}>
                  {estadoLabels[r.estado]}
                </td>
                <td style={{ ...tdBase, color: estadoColors[r.estado] }}>{r.accion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WheelParamsModal({ open, ticker, params, onChange, onClose, onConfirm }: Props) {
  const [analyzed, setAnalyzed] = useState(false);
  const [precioFinal, setPrecioFinal] = useState<number>(0);
  const [evalResult, setEvalResult] = useState<WheelEvalResult | null>(null);
  const [eligibility, setEligibility] = useState<WheelEligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  // FIC: Status of automatic call suggestion fetch triggered by PUT selection. (EN)
  // FIC: Estado de la búsqueda automática de call sugerido al seleccionar un PUT. (ES)
  const [callSuggestionStatus, setCallSuggestionStatus] =
    useState<"idle" | "loading" | "found" | "not_found">("idle");

  // FIC: Roll 1 — real data from the next available expiration in the option chain. (EN)
  // FIC: Roll 1 — datos reales de la siguiente expiración disponible en la cadena de opciones. (ES)
  const [roll1, setRoll1] = useState<Roll1Result>({ status: "idle" });
  const [fechaInicio, setFechaInicio] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [fechaFin, setFechaFin] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return d.toISOString().split("T")[0];
  });

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
    if (!open || !ticker.trim()) return;
    let cancelled = false;
    setEligibilityLoading(true);
    setEligibilityError(null);

    fetchWheelEligibility(ticker)
      .then((result) => {
        if (cancelled) return;
        setEligibility(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setEligibility(null);
        setEligibilityError(err instanceof Error ? err.message : "wheel_eligibility_failed");
      })
      .finally(() => {
        if (!cancelled) setEligibilityLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, ticker]);

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
        void suggestCallFromChain(fresh, selectedStrike.strike, ticker, selectedStrike.expiration);
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
        // FIC: Trigger automatic call suggestion after PUT selection — pass expiration to avoid redundant HTTP. (EN)
        // FIC: Disparar sugerencia de call tras selección de PUT — pasa expiración para evitar HTTP redundante. (ES)
        void suggestCallFromChain(updatedParams, selectedStrike.strike, ticker, selectedStrike.expiration);
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

  // FIC: Compute Roll 1 whenever strikeCall or expiration changes. (EN)
  // FIC: Calcula el Roll 1 cuando cambia strikeCall o la expiración. (ES)
  useEffect(() => {
    if (!open || params.cc.strikeCall <= 0) {
      setRoll1({ status: "idle" });
      return;
    }
    const currentExpiration = selectedStrike?.expiration;
    if (!currentExpiration) {
      setRoll1({ status: "idle" });
      return;
    }

    let cancelled = false;
    setRoll1({ status: "loading", currentExpiration, strikeCallCurrent: params.cc.strikeCall });

    computeRoll1(ticker, currentExpiration, params.cc.strikeCall, params.cc.contratos)
      .then((result) => { if (!cancelled) setRoll1(result); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, params.cc.strikeCall, params.cc.contratos, selectedStrike?.expiration, ticker]);

  if (!open) return null;

  // FIC: Helpers to update nested CSP / CC params without touching the other section. (EN)
  // FIC: Helpers para actualizar parámetros CSP / CC anidados sin tocar la otra sección. (ES)
  const setCsp = <K extends keyof WheelCspParams>(field: K, value: WheelCspParams[K]) =>
    onChange({ ...params, csp: { ...params.csp, [field]: value } });

  const setCc = <K extends keyof WheelCcParams>(field: K, value: WheelCcParams[K]) =>
    onChange({ ...params, cc: { ...params.cc, [field]: value } });

  const cspResult = calcCsp(params.csp);
  const ccResult  = calcCc(params.cc);
  const money = (value: number) => `$${value.toFixed(2)}`;
  const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
  const unavailableText = "No disponible en la simulación actual";

  // FIC: Build roll1 rows outside IIFE to avoid TSX parser issues with spreads in array literals. (EN)
  // FIC: Construye filas del roll1 fuera del IIFE para evitar problemas del parser TSX con spreads. (ES)
  const roll1Rows: {label: string; value: string}[] = [];
  if (roll1.status === "found" && roll1.strikeCallSuggested !== undefined) {
    roll1Rows.push({ label: "Vencimiento actual", value: roll1.currentExpiration ?? "—" });
    roll1Rows.push({ label: "Nuevo vencimiento",  value: roll1.nextExpiration ?? "—" });
    roll1Rows.push({ label: "Strike CALL actual", value: money(roll1.strikeCallCurrent ?? 0) });
    roll1Rows.push({ label: "Strike sugerido",    value: money(roll1.strikeCallSuggested) });
    roll1Rows.push({ label: "Prima estimada",     value: `${money(roll1.prima ?? 0)} / acción` });
    if (roll1.delta != null) {
      roll1Rows.push({ label: "Delta", value: roll1.delta.toFixed(2) });
    }
    roll1Rows.push({ label: "Crédito estimado",   value: money(roll1.creditoEstimado ?? 0) });
  }

  const dteEntrada = Math.max(1, Math.round(
    (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / 86400000
  ));

  const simRows = buildDaySim(
    params.csp.currentPrice,
    params.csp.strikePut,
    params.csp.primaPut,
    params.csp.contratos,
    precioFinal,
    fechaInicio,
    fechaFin,
  );

  const handleAnalyze = () => {
    setAnalyzed(true);
    onConfirm?.(params);
  };

  const renderStageRows = (rows: Array<{ label: string; value: string }>) => (
    <div>
      {rows.map((row) => (
        <div key={row.label} style={resultRowStyle}>
          <span style={resultLabelStyle}>{row.label}</span>
          <span style={resultValueStyle}>{row.value}</span>
        </div>
      ))}
    </div>
  );

  const renderUnavailableStage = () => (
    <div style={unavailableStageStyle}>{unavailableText}</div>
  );

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

        <div style={modalColumnsStyle}>
          <div style={modalColumnStyle}>
        <WheelEligibilitySummary
          result={eligibility}
          loading={eligibilityLoading}
          error={eligibilityError}
        />

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

        {/* ── Sección de evaluación Wheel */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>EVALUAR RESULTADO</div>
          <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
            <div>
              <label style={labelStyle}>Fecha de inicio (hoy)</label>
              <input
                style={inputStyle}
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Fecha de fin (vencimiento) · DTE: {dteEntrada}d</label>
              <input
                style={inputStyle}
                type="date"
                value={fechaFin}
                min={fechaInicio}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
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
            const totalColor = evalResult.gananciaTotal >= 0 ? "var(--color-buy)" : "var(--color-sell)";
            const estado = evalResult.estadoCC !== "N/A"
              ? `${evalResult.estadoCSP.replace(/_/g, " ")} / ${evalResult.estadoCC.replace(/_/g, " ")}`
              : evalResult.estadoCSP.replace(/_/g, " ");

            const evalRows: Array<{ label: string; value: string; color?: string }> = [
              { label: "Estado", value: estado, color: totalColor },
              { label: "Ganancia Total", value: `$${evalResult.gananciaTotal.toFixed(2)}`, color: totalColor },
              { label: "ROI", value: `${(evalResult.roi * 100).toFixed(2)}%`, color: totalColor },
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
          </div>
          <div style={modalColumnStyle}>
          {/* ── RECOMENDACIÓN OPERATIVA ─────────────────────────────────────── */}
          <WheelOperationalRecommendation
            eligibility={eligibility}
            eligibilityLoading={eligibilityLoading}
            csp={params.csp}
            cc={params.cc}
            expiration={selectedStrike?.expiration}
          />

          <WheelRulesPanel
            csp={params.csp}
            cc={params.cc}
            dteEntrada={dteEntrada}
            fechaInicio={fechaInicio}
          />
        </div>

        </div>

        {/* ── WHEEL STAGES (ancho completo) */}
        {(() => {
            const stage1Available = params.csp.strikePut > 0 && params.csp.primaPut >= 0 && params.csp.contratos > 0;
            const stage2Available = Boolean(evalResult) && precioFinal > 0 && params.cc.costoPromedio > 0;
            const stage3Available = params.cc.acciones > 0 && params.cc.strikeCall > 0 && params.cc.primaCall >= 0 && params.cc.contratos > 0;
            const primaPut  = cspResult.primaTotal;
            const primaCall = ccResult.primaRecibida;
            // FIC: creditoRoll1 comes exclusively from ETAPA 4 real data — no duplication. (EN)
            // FIC: creditoRoll1 proviene exclusivamente de los datos reales de ETAPA 4 — sin duplicados. (ES)
            const creditoRoll1   = roll1.status === "found" ? (roll1.creditoEstimado ?? 0) : 0;
            const totalIngresos  = primaPut + primaCall + creditoRoll1;

            // FIC: Build ETAPA 6 rows here to avoid spread inside JSX. (EN)
            const etapa6Rows: {label: string; value: string}[] = [];
            if (stage1Available || stage3Available) {
              etapa6Rows.push({ label: 'Prima PUT recibida',  value: money(primaPut) });
              etapa6Rows.push({ label: 'Prima CALL recibida', value: money(primaCall) });
              if (roll1.status === 'found') {
                etapa6Rows.push({ label: 'Crédito primer roll', value: money(creditoRoll1) });
              }
              etapa6Rows.push({ label: 'Total acumulado', value: money(totalIngresos) });
            }

            return (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>WHEEL STAGES</div>
                <div style={stageGridStyle}>
                  <div style={stageCardStyle}>
                    <div style={sectionTitleStyle}>ETAPA 1: Venta del PUT</div>
                    {stage1Available
                      ? renderStageRows([
                          { label: "Ticker", value: params.csp.ticker || ticker.toUpperCase() },
                          { label: "Strike PUT", value: money(params.csp.strikePut) },
                          { label: "Prima PUT", value: money(params.csp.primaPut) },
                          { label: "Contratos", value: String(params.csp.contratos) },
                          { label: "Prima total", value: money(cspResult.primaTotal) },
                          { label: "Capital comprometido", value: money(cspResult.capitalComprometido) },
                          { label: "Breakeven", value: money(cspResult.breakeven) },
                        ])
                      : renderUnavailableStage()}
                  </div>

                  <div style={stageCardStyle}>
                    <div style={sectionTitleStyle}>ETAPA 2: Asignación</div>
                    {stage2Available && evalResult
                      ? renderStageRows([
                          { label: "Estado", value: evalResult.estadoCSP },
                          { label: "Precio final utilizado", value: money(precioFinal) },
                          { label: "Costo promedio estimado", value: money(params.cc.costoPromedio) },
                        ])
                      : renderUnavailableStage()}
                  </div>

                  <div style={stageCardStyle}>
                    <div style={sectionTitleStyle}>ETAPA 3: Covered Call</div>
                    {stage3Available
                      ? renderStageRows([
                          { label: "Acciones", value: String(params.cc.acciones) },
                          { label: "Strike CALL", value: money(params.cc.strikeCall) },
                          { label: "Prima CALL", value: money(params.cc.primaCall) },
                          { label: "Prima recibida", value: money(ccResult.primaRecibida) },
                          { label: "Breakeven", value: money(ccResult.breakeven) },
                          { label: "Retorno estimado", value: pct(ccResult.retornoPct) },
                        ])
                      : renderUnavailableStage()}
                  </div>

                  <div style={stageCardStyle}>
                    {/* FIC: ETAPA 4 — real roll data from next available expiration. (EN) */}
                    {/* FIC: ETAPA 4 — datos reales de la siguiente expiración disponible. (ES) */}
                    <div style={sectionTitleStyle}>ETAPA 4: PRIMER ROLL</div>
                    {roll1.status === "idle" && renderUnavailableStage()}
                    {roll1.status === "loading" && (
                      <div style={{ ...unavailableStageStyle, fontStyle: "italic" }}>
                        Consultando siguiente expiración…
                      </div>
                    )}
                    {roll1.status === "not_found" && (
                      <div style={unavailableStageStyle}>Roll no disponible</div>
                    )}
                    {roll1.status === "found" && roll1Rows.length > 0 && renderStageRows(roll1Rows)}
                  </div>

                  <div style={stageCardStyle}>
                    {/* FIC: ETAPA 5 — mirrors ETAPA 4 roll data; no invented premiums. (EN) */}
                    {/* FIC: ETAPA 5 — refleja los datos reales del roll de ETAPA 4; sin primas inventadas. (ES) */}
                    <div style={sectionTitleStyle}>ETAPA 5: RESUMEN DEL ROLL</div>
                    {roll1.status === "idle" && renderUnavailableStage()}
                    {roll1.status === "loading" && (
                      <div style={{ ...unavailableStageStyle, fontStyle: "italic" }}>
                        Consultando siguiente expiración…
                      </div>
                    )}
                    {roll1.status === "not_found" && (
                      <div style={unavailableStageStyle}>Roll no disponible</div>
                    )}
                    {roll1.status === "found" && roll1.strikeCallSuggested !== undefined && renderStageRows([
                      { label: "Vencimiento actual",  value: roll1.currentExpiration ?? "—" },
                      { label: "Nuevo vencimiento",   value: roll1.nextExpiration ?? "—" },
                      { label: "Strike CALL actual",  value: money(roll1.strikeCallCurrent ?? 0) },
                      { label: 'Strike sugerido',     value: money(roll1.strikeCallSuggested ?? 0) },
                      { label: 'Prima estimada',      value: `${money(roll1.prima ?? 0)} / acción` },
                      { label: 'Crédito estimado',    value: money(roll1.creditoEstimado ?? 0) },
                    ])}
                  </div>

                  <div style={stageCardStyle}>
                    {/* FIC: ETAPA 6 — solo primas reales: PUT + CALL + Roll 1 si existe. (ES) */}
                    <div style={sectionTitleStyle}>ETAPA 6: RESUMEN DE INGRESOS</div>
                    {stage1Available || stage3Available
                      ? renderStageRows(etapa6Rows)
                      : renderUnavailableStage()}
                  </div>
                </div>
              </div>
            );
        })()}

        {/* ── Simulación día a día */}
        {simRows.length > 0 && (
          <WheelDaySimSection
            rows={simRows}
            primaTotal={params.csp.primaPut * params.csp.contratos * 100}
          />
        )}

        {/* ── Analizar button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleAnalyze}
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.5rem 1.75rem',
              cursor: 'pointer',
              fontWeight: 'var(--font-weight-bold)' as React.CSSProperties['fontWeight'],
              fontSize: 'var(--font-size-sm)',
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
