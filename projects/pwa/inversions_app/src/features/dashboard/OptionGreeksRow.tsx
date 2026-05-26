// FIC: Phase 5 T097 — subrow colapsable de OptionGreeks (ala, strike, delta, theta, gamma).

import React, { useState } from "react";
import type { OptionGreeks } from "../../services/signals/confluenceTableApi";

interface Props {
  greeks: OptionGreeks;
  colSpan: number;
}

export function OptionGreeksRow({ greeks, colSpan }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <tr>
      <td colSpan={colSpan} style={{ background: "var(--color-surface-raised, #1c1f26)" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ background: "none", border: 0, color: "var(--color-accent, #ffd43b)", cursor: "pointer", fontSize: "0.75rem" }}
        >
          {open ? "▼" : "▶"} Greeks {greeks.ala} · {greeks.posicion}
        </button>
        {open && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.75rem" }}>
            <div>Vencimiento: {greeks.vencimiento}</div>
            <div>Strike: {greeks.strike.toFixed(2)}</div>
            <div>Delta: {greeks.delta.toFixed(3)}</div>
            <div>Gamma: {greeks.gamma.toFixed(3)}</div>
            <div>Theta: {greeks.theta.toFixed(3)}</div>
            <div>Tolerancia: {greeks.tolerancia}</div>
          </div>
        )}
      </td>
    </tr>
  );
}

export default OptionGreeksRow;
