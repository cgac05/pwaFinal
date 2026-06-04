import React from "react";

export interface LegendData {
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevClose: number | null;
  rsiValue?: number;
}

function fmt(n: number) {
  return n.toFixed(2);
}

function fmtVol(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export const ChartLegend: React.FC<{ data: LegendData | null }> = ({ data }) => {
  if (!data) return null;

  const change = data.prevClose != null ? data.close - data.prevClose : null;
  const changePct =
    change != null && data.prevClose ? (change / data.prevClose) * 100 : null;
  const up = change != null && change >= 0;
  const changeColor = up ? "#26a69a" : "#ef5350";

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 5,
        background: "rgba(0,0,0,0.65)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 4,
        padding: "5px 8px",
        fontSize: 11,
        fontFamily:
          "'JetBrains Mono','Cascadia Code','Fira Code','Consolas',monospace",
        color: "rgba(255,255,255,0.85)",
        lineHeight: 1.7,
        pointerEvents: "none",
        backdropFilter: "blur(4px)",
        userSelect: "none",
      }}
    >
      <div style={{ fontWeight: 600, letterSpacing: "0.02em", marginBottom: 2 }}>
        {data.symbol} · {data.timeframe}
        {data.rsiValue !== undefined && (
          <span style={{ color: "#7b61ff", marginLeft: 8 }}>
            RSI {data.rsiValue.toFixed(1)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <span>
          O<span style={{ color: "#e0e0e0", marginLeft: 3 }}>{fmt(data.open)}</span>
        </span>
        <span>
          H<span style={{ color: "#26a69a", marginLeft: 3 }}>{fmt(data.high)}</span>
        </span>
        <span>
          L<span style={{ color: "#ef5350", marginLeft: 3 }}>{fmt(data.low)}</span>
        </span>
        <span>
          C<span style={{ color: "#e0e0e0", marginLeft: 3 }}>{fmt(data.close)}</span>
        </span>
        {data.volume > 0 && (
          <span>
            V<span style={{ color: "#b2b5be", marginLeft: 3 }}>{fmtVol(data.volume)}</span>
          </span>
        )}
      </div>
      {change != null && changePct != null && (
        <div style={{ color: changeColor, marginTop: 1 }}>
          {up ? "+" : ""}
          {fmt(change)} ({up ? "+" : ""}
          {changePct.toFixed(2)}%)
        </div>
      )}
    </div>
  );
};
