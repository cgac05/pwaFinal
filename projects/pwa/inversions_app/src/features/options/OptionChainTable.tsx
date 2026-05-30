// FIC: Option chain table — 3-column layout (calls | strike | puts), auto-updates on ticker change. (EN)
// FIC: Tabla de cadena de opciones — layout 3 columnas (calls | strike | puts), se actualiza al cambiar ticker. (ES)

import React, { useEffect, useState, useCallback } from "react";
import { useSignalStore } from "../../store/signals";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import {
  fetchOptionChain,
  fetchExpirations,
  type OptionChainResponse,
  type OptionChainRow,
} from "../../services/options/optionChainApi";

export interface OptionChainTableProps {
  symbol: string;
  onSelectStrike?: (
    strike: number,
    type: "call" | "put",
    premium: number,
    iv: number
  ) => void;
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n === 0 ? "—" : n.toFixed(decimals);
}

function fmtPct(n: number): string {
  return n === 0 ? "—" : `${(n * 100).toFixed(1)}%`;
}

function fmtDelta(n: number): string {
  return n === 0 ? "—" : n.toFixed(3);
}

function midpoint(bid: number, ask: number): number {
  return bid > 0 && ask > 0 ? (bid + ask) / 2 : bid || ask;
}

// ─── Styles (reusing existing CSS tokens only) ────────────────────────────────

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--font-size-xs)",
};

const thStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  color: "var(--color-text-muted)",
  fontWeight: "var(--font-weight-emphasis)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const strikeTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "center",
  fontWeight: "var(--font-weight-bold)",
  cursor: "default",
  background: "var(--color-surface)",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CallCells({
  row,
  isItm,
  onClick,
}: {
  row: OptionChainRow;
  isItm: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <td
        style={{
          ...tdStyle,
          textAlign: "right",
          background: isItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined,
        }}
        onClick={onClick}
        title="Click para usar este call en estrategia de cobertura"
      >
        {fmt(row.callBid)}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", background: isItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }} onClick={onClick}>
        {fmt(row.callAsk)}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", background: isItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }} onClick={onClick}>
        {fmtPct(row.callIV)}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", background: isItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }} onClick={onClick}>
        {fmtDelta(row.callDelta)}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", background: isItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }} onClick={onClick}>
        {row.callVolume > 0 ? row.callVolume.toLocaleString() : "—"}
      </td>
    </>
  );
}

function PutCells({
  row,
  isItm,
  onClick,
}: {
  row: OptionChainRow;
  isItm: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <td
        style={{
          ...tdStyle,
          background: isItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined,
        }}
        onClick={onClick}
        title="Click para usar este put en estrategia de cobertura"
      >
        {fmt(row.putBid)}
      </td>
      <td style={{ ...tdStyle, background: isItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }} onClick={onClick}>
        {fmt(row.putAsk)}
      </td>
      <td style={{ ...tdStyle, background: isItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }} onClick={onClick}>
        {fmtPct(row.putIV)}
      </td>
      <td style={{ ...tdStyle, background: isItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }} onClick={onClick}>
        {fmtDelta(row.putDelta)}
      </td>
      <td style={{ ...tdStyle, background: isItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }} onClick={onClick}>
        {row.putVolume > 0 ? row.putVolume.toLocaleString() : "—"}
      </td>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OptionChainTable({ symbol, onSelectStrike }: OptionChainTableProps) {
  const [expirations, setExpirations] = useState<string[]>([]);
  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  const [chain, setChain] = useState<OptionChainResponse | null>(null);
  const [loadingExp, setLoadingExp] = useState(false);
  const [loadingChain, setLoadingChain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FIC: Load expirations whenever symbol changes. (EN)
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setExpirations([]);
    setSelectedExpiration("");
    setChain(null);
    setError(null);
    setLoadingExp(true);

    fetchExpirations(symbol)
      .then((data) => {
        if (cancelled) return;
        setExpirations(data.expirations);
        if (data.expirations.length > 0) setSelectedExpiration(data.expirations[0]);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las expiraciones. Intenta de nuevo.");
      })
      .finally(() => { if (!cancelled) setLoadingExp(false); });

    return () => { cancelled = true; };
  }, [symbol]);

  // FIC: Load chain whenever symbol or selected expiration changes. (EN)
  useEffect(() => {
    if (!symbol || !selectedExpiration) return;
    let cancelled = false;
    setChain(null);
    setError(null);
    setLoadingChain(true);

    fetchOptionChain(symbol, selectedExpiration)
      .then((data) => { if (!cancelled) setChain(data); })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la cadena de opciones. Intenta de nuevo.");
      })
      .finally(() => { if (!cancelled) setLoadingChain(false); });

    return () => { cancelled = true; };
  }, [symbol, selectedExpiration]);

  const handleCallClick = useCallback(
    (row: OptionChainRow) => {
      const premium = midpoint(row.callBid, row.callAsk) || row.callLastPrice;
      onSelectStrike?.(row.strike, "call", premium, row.callIV);
    },
    [onSelectStrike]
  );

  const handlePutClick = useCallback(
    (row: OptionChainRow) => {
      const premium = midpoint(row.putBid, row.putAsk) || row.putLastPrice;
      onSelectStrike?.(row.strike, "put", premium, row.putIV);
    },
    [onSelectStrike]
  );

  const underlyingPrice = chain?.underlyingPrice ?? 0;
  const isLoading = loadingExp || loadingChain;

  // ─── Header ───────────────────────────────────────────────────────────────

  const header = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-sm)",
        marginBottom: "var(--space-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
        <span style={{ fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-sm)" }}>
          Cadena de Opciones — {symbol}
        </span>
        {underlyingPrice > 0 && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
            Precio subyacente: <strong style={{ color: "var(--color-text)" }}>${underlyingPrice.toFixed(2)}</strong>
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
        {chain && !chain.greeksAvailable && chain.rows.length > 0 && (
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-muted)",
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-xs)",
              padding: "2px 8px",
            }}
          >
            Delta estimada — Greeks calculados localmente
          </span>
        )}
        <select
          value={selectedExpiration}
          onChange={(e) => setSelectedExpiration(e.target.value)}
          disabled={expirations.length === 0 || isLoading}
          style={{
            background: "var(--color-surface)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xs)",
            padding: "0.2rem 0.5rem",
            fontSize: "var(--font-size-xs)",
            cursor: "pointer",
          }}
        >
          {expirations.length === 0 && <option value="">— Cargando —</option>}
          {expirations.map((exp) => (
            <option key={exp} value={exp}>{exp}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const stickyContainer: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  };

  const stickyHeader: React.CSSProperties = {
    flexShrink: 0,
    paddingBottom: "var(--space-sm)",
  };

  const scrollBody: React.CSSProperties = {
    flex: 1,
    overflow: "auto",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)",
  };

  // ─── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={stickyContainer}>
        <div style={stickyHeader}>{header}</div>
        <div style={{ flex: 1 }}><SkeletonCard height={280} lines={8} /></div>
      </div>
    );
  }

  // ─── Error / empty state ─────────────────────────────────────────────────

  const isYahooBlocked = chain?.unavailableReason === "YAHOO_BLOCKED";

  if (error || !chain || chain.rows.length === 0) {
    const isNoData = !error && chain?.rows.length === 0;
    return (
      <div style={stickyContainer}>
        <div style={stickyHeader}>{header}</div>
        <div style={{ ...scrollBody, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              padding: "var(--space-xl)",
              textAlign: "center",
              color: "var(--color-text-muted)",
              width: "100%",
            }}
          >
            {isYahooBlocked || isNoData ? (
              <>
                <p style={{ fontWeight: "var(--font-weight-emphasis)", marginBottom: "var(--space-xs)", color: "var(--color-text)" }}>
                  Cadena de opciones no disponible en este entorno
                </p>
                <p style={{ fontSize: "var(--font-size-sm)", margin: 0, color: "var(--color-text-muted)" }}>
                  No hay datos de opciones disponibles para esta expiración en este momento.
                  Selecciona otra fecha o intenta de nuevo en unos minutos.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: "var(--font-weight-emphasis)", marginBottom: "var(--space-xs)" }}>
                  {error ?? "Sin datos para esta expiración"}
                </p>
                <p style={{ fontSize: "var(--font-size-sm)", margin: 0 }}>
                  Selecciona otra fecha de expiración o intenta de nuevo.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Table ────────────────────────────────────────────────────────────────

  return (
    <div style={stickyContainer}>
      <div style={stickyHeader}>{header}</div>
      <div style={scrollBody}>
        <table style={tableStyle}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={{ background: "var(--color-surface)" }}>
              {/* CALLS header */}
              <th style={{ ...thStyle, textAlign: "right", color: "var(--color-buy)" }} colSpan={5}>CALLS</th>
              {/* STRIKE header */}
              <th style={{ ...thStyle, textAlign: "center", background: "var(--color-surface)" }}>STRIKE</th>
              {/* PUTS header */}
              <th style={{ ...thStyle, textAlign: "left", color: "var(--color-sell)" }} colSpan={5}>PUTS</th>
            </tr>
            <tr style={{ background: "var(--color-surface)" }}>
              {/* Call columns — right-aligned */}
              {["Vol", "Δ", "IV", "Ask", "Bid"].map((h) => (
                <th key={`c-${h}`} style={{ ...thStyle, textAlign: "right" }}>{h}</th>
              ))}
              {/* Strike column */}
              <th style={{ ...thStyle, textAlign: "center" }}></th>
              {/* Put columns — left-aligned */}
              {["Bid", "Ask", "IV", "Δ", "Vol"].map((h) => (
                <th key={`p-${h}`} style={{ ...thStyle, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chain.rows.map((row) => {
              const isCallItm = row.strike < underlyingPrice;
              const isPutItm  = row.strike > underlyingPrice;
              const isAtm     = Math.abs(row.strike - underlyingPrice) / (underlyingPrice || 1) < 0.005;

              return (
                <tr key={row.strike} style={{ transition: "background 0.1s" }}>
                  {/* Call cells — reverse order so Bid is closest to strike */}
                  <td
                    style={{ ...tdStyle, textAlign: "right", background: isCallItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }}
                    onClick={() => handleCallClick(row)}
                    title="Click para usar este call en estrategia de cobertura"
                  >
                    {row.callVolume > 0 ? row.callVolume.toLocaleString() : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", background: isCallItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }} onClick={() => handleCallClick(row)}>
                    {fmtDelta(row.callDelta)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", background: isCallItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }} onClick={() => handleCallClick(row)}>
                    {fmtPct(row.callIV)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", background: isCallItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }} onClick={() => handleCallClick(row)}>
                    {fmt(row.callAsk)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", background: isCallItm ? "color-mix(in srgb, var(--color-buy) 8%, transparent)" : undefined }} onClick={() => handleCallClick(row)}>
                    {fmt(row.callBid)}
                  </td>

                  {/* Strike */}
                  <td style={{ ...strikeTdStyle, color: isAtm ? "var(--color-accent)" : undefined }}>
                    {row.strike.toFixed(row.strike % 1 === 0 ? 0 : 2)}
                    {isAtm && " ★"}
                  </td>

                  {/* Put cells */}
                  <td
                    style={{ ...tdStyle, background: isPutItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }}
                    onClick={() => handlePutClick(row)}
                    title="Click para usar este put en estrategia de cobertura"
                  >
                    {fmt(row.putBid)}
                  </td>
                  <td style={{ ...tdStyle, background: isPutItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }} onClick={() => handlePutClick(row)}>
                    {fmt(row.putAsk)}
                  </td>
                  <td style={{ ...tdStyle, background: isPutItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }} onClick={() => handlePutClick(row)}>
                    {fmtPct(row.putIV)}
                  </td>
                  <td style={{ ...tdStyle, background: isPutItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }} onClick={() => handlePutClick(row)}>
                    {fmtDelta(row.putDelta)}
                  </td>
                  <td style={{ ...tdStyle, background: isPutItm ? "color-mix(in srgb, var(--color-sell) 8%, transparent)" : undefined }} onClick={() => handlePutClick(row)}>
                    {row.putVolume > 0 ? row.putVolume.toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// FIC: Wrapper that reads symbol from Signal Store — use this in MainDashboard. (EN)
// FIC: Wrapper que lee el symbol del Signal Store — usar este en MainDashboard. (ES)
export function OptionChainTableConnected({
  onSelectStrike,
}: {
  onSelectStrike?: OptionChainTableProps["onSelectStrike"];
}) {
  const { selectedInstrument } = useSignalStore();
  const symbol = selectedInstrument?.symbol ?? "SPY";
  return <OptionChainTable symbol={symbol} onSelectStrike={onSelectStrike} />;
}
