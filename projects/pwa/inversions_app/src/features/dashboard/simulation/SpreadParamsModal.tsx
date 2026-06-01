import React from "react";

export type SpreadStrategy =
  | "BULL_CALL_SPREAD"
  | "BEAR_PUT_SPREAD"
  | "BULL_PUT_SPREAD"
  | "BEAR_CALL_SPREAD";

export interface SpreadModalParams {
  currentPrice: number;
  longStrike: number;
  shortStrike: number;
  longPremium: number;
  shortPremium: number;
  contracts: number;
}

interface Props {
  open: boolean;
  estrategia: string;
  ticker: string;
  params: SpreadModalParams;
  onChange: (params: SpreadModalParams) => void;
  onClose: () => void;
  onConfirm?: (params: SpreadModalParams) => void;
}

const STRATEGY_LABELS: Record<SpreadStrategy, string> = {
  BULL_CALL_SPREAD: "Debit Spread · Bull Call",
  BEAR_PUT_SPREAD: "Debit Spread · Bear Put",
  BULL_PUT_SPREAD: "Credit Spread · Bull Put",
  BEAR_CALL_SPREAD: "Credit Spread · Bear Call",
};

const STRATEGY_HELP: Record<SpreadStrategy, string> = {
  BULL_CALL_SPREAD: "Compra call con strike bajo y vende call con strike alto. Sesgo alcista con riesgo limitado.",
  BEAR_PUT_SPREAD: "Compra put con strike alto y vende put con strike bajo. Sesgo bajista con riesgo limitado.",
  BULL_PUT_SPREAD: "Vende put con strike alto y compra put con strike bajo. Sesgo alcista; recibes crédito.",
  BEAR_CALL_SPREAD: "Vende call con strike bajo y compra call con strike alto. Sesgo bajista; recibes crédito.",
};

const isSpreadStrategy = (value: string): value is SpreadStrategy =>
  value === "BULL_CALL_SPREAD" ||
  value === "BEAR_PUT_SPREAD" ||
  value === "BULL_PUT_SPREAD" ||
  value === "BEAR_CALL_SPREAD";

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

export function SpreadParamsModal({ open, estrategia, ticker, params, onChange, onClose, onConfirm }: Props) {
  if (!open || !isSpreadStrategy(estrategia)) return null;

  const set = <K extends keyof SpreadModalParams>(field: K, value: SpreadModalParams[K]) =>
    onChange({ ...params, [field]: value });

  const label = STRATEGY_LABELS[estrategia];
  const help = STRATEGY_HELP[estrategia];
  const isDebit = estrategia === "BULL_CALL_SPREAD" || estrategia === "BEAR_PUT_SPREAD";
  const net = isDebit
    ? params.longPremium - params.shortPremium
    : params.shortPremium - params.longPremium;

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
          width: "min(640px, 94vw)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "var(--font-size-base)" }}>{label}</h3>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{help}</span>
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
            <input style={inputStyle} type="number" step={0.01} min={0} value={params.currentPrice || ""} placeholder="450" onChange={(e) => set("currentPrice", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>Contratos</label>
            <input style={inputStyle} type="number" step={1} min={1} value={params.contracts || ""} placeholder="1" onChange={(e) => set("contracts", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>Strike Long</label>
            <input style={inputStyle} type="number" step={0.5} min={0} value={params.longStrike || ""} placeholder="Compra" onChange={(e) => set("longStrike", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>Prima Long</label>
            <input style={inputStyle} type="number" step={0.01} min={0} value={params.longPremium || ""} placeholder="Pagada" onChange={(e) => set("longPremium", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>Costo/Débito neto</label>
            <input style={readonlyStyle} value={isDebit && net > 0 ? `$${net.toFixed(2)}` : "—"} readOnly />
          </div>
          <div>
            <label style={labelStyle}>Strike Short</label>
            <input style={inputStyle} type="number" step={0.5} min={0} value={params.shortStrike || ""} placeholder="Venta" onChange={(e) => set("shortStrike", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>Prima Short</label>
            <input style={inputStyle} type="number" step={0.01} min={0} value={params.shortPremium || ""} placeholder="Recibida" onChange={(e) => set("shortPremium", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>Crédito neto</label>
            <input style={readonlyStyle} value={!isDebit && net > 0 ? `$${net.toFixed(2)}` : "—"} readOnly />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-md)", gap: "var(--space-sm)" }}>
          <button
            onClick={onClose}
            style={{
              background: "var(--color-surface-raised)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.5rem 1rem",
              cursor: "pointer",
              fontWeight: "var(--font-weight-bold)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            Cancelar
          </button>
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
            Analizar spread
          </button>
        </div>
      </div>
    </div>
  );
}

export default SpreadParamsModal;
