import React from "react";

export interface CoverageModalParams {
  currentPrice: number;
  shares: number;
  putStrikePrice?: number;
  callStrikePrice?: number;
  riskTolerancePct: number;
}

const STRATEGY_LABELS: Record<string, string> = {
  protective_put:   "Protective Put",
  married_put:      "Married Put",
  collar_put:       "Collar Put",
  covered_straddle: "Covered Straddle",
  PROTECTIVE_PUT:   "Protective Put",
  MARRIED_PUT:      "Married Put",
  COLLAR_PUT:       "Collar Put",
  COVERED_STRADDLE: "Covered Straddle",
};

// Qué campos mostrar según estrategia
const SHOW_PUT_STRIKE  = new Set(["PROTECTIVE_PUT", "MARRIED_PUT", "COLLAR_PUT", "protective_put", "married_put", "collar_put"]);
const SHOW_CALL_STRIKE = new Set(["COLLAR_PUT", "COVERED_STRADDLE", "collar_put", "covered_straddle"]);

function callStrikeLabel(e: string): string {
  if (e === "COVERED_STRADDLE" || e === "covered_straddle") return "Strike (opc.)";
  return "Strike Call (opc.)";
}

interface Props {
  open: boolean;
  estrategia: string;
  ticker: string;
  params: CoverageModalParams;
  onChange: (params: CoverageModalParams) => void;
  onClose: () => void;
  onConfirm?: (params: CoverageModalParams) => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-raised)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text)",
  fontSize: "var(--font-size-sm)",
  padding: "var(--space-xs) var(--space-sm)",
  width: "100%",
  outline: "none",
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

export function CoverageParamsModal({ open, estrategia, ticker, params, onChange, onClose, onConfirm }: Props) {
  if (!open) return null;

  const set = <K extends keyof CoverageModalParams>(field: K, value: CoverageModalParams[K]) =>
    onChange({ ...params, [field]: value });

  const label      = STRATEGY_LABELS[estrategia] ?? estrategia.replace(/_/g, " ");
  const showPut    = SHOW_PUT_STRIKE.has(estrategia);
  const showCall   = SHOW_CALL_STRIKE.has(estrategia);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-lg)",
          width: "min(540px, 94vw)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "var(--font-size-base)" }}>{label}</h3>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Parámetros de estrategia</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "1.2rem", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div>
            <label style={labelStyle}>Ticker</label>
            <input style={readonlyStyle} value={ticker} readOnly />
          </div>
          <div>
            <label style={labelStyle}>Precio actual</label>
            <input
              style={inputStyle}
              type="number"
              step={0.01}
              min={0}
              value={params.currentPrice || ""}
              placeholder="450"
              onChange={(e) => set("currentPrice", Number(e.target.value))}
            />
          </div>
          <div>
            <label style={labelStyle}>Shares</label>
            <input
              style={inputStyle}
              type="number"
              step={1}
              min={1}
              value={params.shares || ""}
              placeholder="100"
              onChange={(e) => set("shares", Number(e.target.value))}
            />
          </div>
          {showPut && (
            <div>
              <label style={labelStyle}>Strike Put (opc.)</label>
              <input
                style={inputStyle}
                type="number"
                step={0.5}
                min={0}
                value={params.putStrikePrice ?? ""}
                placeholder="auto"
                onChange={(e) => set("putStrikePrice", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          )}
          {showCall && (
            <div>
              <label style={labelStyle}>{callStrikeLabel(estrategia)}</label>
              <input
                style={inputStyle}
                type="number"
                step={0.5}
                min={0}
                value={params.callStrikePrice ?? ""}
                placeholder="auto"
                onChange={(e) => set("callStrikePrice", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          )}
          <div>
            <label style={labelStyle}>Riesgo (%)</label>
            <input
              style={inputStyle}
              type="number"
              step={0.1}
              min={0}
              max={100}
              value={params.riskTolerancePct !== undefined ? (params.riskTolerancePct * 100).toFixed(1) : ""}
              placeholder="5"
              onChange={(e) => set("riskTolerancePct", Number(e.target.value) / 100)}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-md)" }}>
          <button
            onClick={() => { onConfirm?.(params); onClose(); }}
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "0.5rem 1.5rem",
              cursor: "pointer",
              fontWeight: "var(--font-weight-bold)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            Analizar estrategia
          </button>
        </div>
      </div>
    </div>
  );
}

export default CoverageParamsModal;
