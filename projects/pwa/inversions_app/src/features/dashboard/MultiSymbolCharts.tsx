import React, { useState } from "react";
import { SuperChart } from "./SuperChart";

const SYMBOLS = ["NVDA", "AAPL", "MSFT", "SPY"] as const;

interface Props {
  timeframe?: string;
}

export function MultiSymbolCharts({ timeframe = "1d" }: Props) {
  const [focused, setFocused] = useState<string | null>(null);

  if (focused) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Charts — {focused}</h2>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                className={`btn-ghost ${focused === sym ? "active" : ""}`}
                onClick={() => setFocused(sym)}
              >
                {sym}
              </button>
            ))}
            <button className="btn-ghost" onClick={() => setFocused(null)}>
              2×2
            </button>
          </div>
        </div>
        <div style={{ minHeight: 420, border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          <SuperChart symbol={focused} timeframe={timeframe} />
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Charts</h2>
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
          Clic en símbolo para expandir
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "auto auto",
        gap: "0.75rem"
      }}>
        {SYMBOLS.map((sym) => (
          <div
            key={sym}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
              minHeight: 280,
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                padding: "0.35rem 0.75rem",
                background: "var(--color-surface-raised)",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{sym}</span>
              <button
                className="btn-ghost"
                style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}
                onClick={() => setFocused(sym)}
              >
                Expandir
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <SuperChart symbol={sym} timeframe={timeframe} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
