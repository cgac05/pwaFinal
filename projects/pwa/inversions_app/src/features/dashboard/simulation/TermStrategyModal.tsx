import React, { useState, useEffect } from "react";
import { fetchOptionChain, fetchExpirations, type OptionChainRow } from "../../../services/options/optionChainApi";
import { getMarketQuotes } from "../../../services/signals/marketApi";

export interface TermStrategyParams {
  optionStyle: "CALL" | "PUT";
  strikeShort: number;
  strikeLong: number;
  expirationShort: string;
  expirationLong: string;
  premiumShort: number;
  premiumLong: number;
  shortIv: number;
  longIv: number;
  contracts: number;
  riskFreeRate: number;
}

interface Props {
  open: boolean;
  estrategia: string;
  ticker: string;
  currentPrice?: number;
  params: TermStrategyParams;
  onChange: (params: TermStrategyParams) => void;
  onClose: () => void;
  onDatesCorrected?: (short: string, long: string) => void;
}

function midpoint(bid: number, ask: number): number {
  return bid > 0 && ask > 0 ? (bid + ask) / 2 : bid || ask;
}

function getPremium(row: OptionChainRow, style: "CALL" | "PUT"): number {
  if (style === "CALL") return midpoint(row.callBid, row.callAsk) || row.callLastPrice || 0;
  return midpoint(row.putBid, row.putAsk) || row.putLastPrice || 0;
}

function closestAtm(rows: OptionChainRow[], target: number): OptionChainRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((prev, curr) =>
    Math.abs(curr.strike - target) < Math.abs(prev.strike - target) ? curr : prev
  );
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TermStrategyModal({ open, estrategia, ticker, currentPrice, params, onChange, onClose, onDatesCorrected }: Props) {
  const [shortChain, setShortChain] = useState<OptionChainRow[]>([]);
  const [longChain, setLongChain] = useState<OptionChainRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorChain, setErrorChain] = useState<string | null>(null);
  const [validExpirations, setValidExpirations] = useState<string[]>([]);
  const [expirationsLoading, setExpirationsLoading] = useState(true);
  const [localPrice, setLocalPrice] = useState<number>(0);

  useEffect(() => {
    if (!open || !ticker) {
      setExpirationsLoading(true);
      return;
    }

    setExpirationsLoading(true);
    setValidExpirations([]);

    fetchExpirations(ticker)
      .then((data) => {
        const dates = data.expirations;
        setValidExpirations(dates);

        const today = isoToday();
        const updates: Partial<TermStrategyParams> = {};

        if (dates.length > 0 && !dates.includes(params.expirationShort)) {
          const next = dates.find((d) => d >= today);
          if (next) updates.expirationShort = next;
        }

        if (dates.length > 0 && !dates.includes(params.expirationLong)) {
          const base = updates.expirationShort || params.expirationShort;
          const baseDate = new Date(base + "T00:00:00");
          const minLongDate = new Date(baseDate);
          minLongDate.setDate(minLongDate.getDate() + 28);
          const minLongStr = minLongDate.toISOString().slice(0, 10);
          const next = dates.find((d) => d >= minLongStr);
          if (next) updates.expirationLong = next;
        }

        if (Object.keys(updates).length > 0) {
          onChange({ ...params, ...updates });
          onDatesCorrected?.(
            updates.expirationShort || params.expirationShort,
            updates.expirationLong || params.expirationLong
          );
        }
      })
      .catch(() => {
        setValidExpirations([]);
      })
      .finally(() => {
        setExpirationsLoading(false);
      });
  }, [open, ticker]);

  useEffect(() => {
    if (!open || !ticker) return;
    if (currentPrice && currentPrice > 0) {
      setLocalPrice(currentPrice);
      return;
    }

    getMarketQuotes([ticker])
      .then((data) => {
        const q = data.quotes.find((qt) => qt.symbol === ticker.toUpperCase());
        if (q && q.price > 0) setLocalPrice(q.price);
      })
      .catch(() => {});
  }, [open, ticker, currentPrice]);

  useEffect(() => {
    if (!open || !ticker || !params.expirationShort || !params.expirationLong) return;
    if (expirationsLoading) return;

    setLoading(true);
    setErrorChain(null);
    let cancelled = false;

    Promise.all([
      fetchOptionChain(ticker, params.expirationShort).catch(() => null),
      fetchOptionChain(ticker, params.expirationLong).catch(() => null),
    ])
      .then(([shortData, longData]) => {
        if (cancelled) return;
        const shortRows = shortData?.rows ?? [];
        const longRows = longData?.rows ?? [];
        setShortChain(shortRows);
        setLongChain(longRows);

        const up = localPrice || currentPrice || shortData?.underlyingPrice || longData?.underlyingPrice || 0;
        const updates: Partial<TermStrategyParams> = {};

        if (up > 0) {
          const isDiagonal = estrategia.includes("DIAGONAL");

          if (params.strikeShort === 0) {
            const atm = closestAtm(shortRows, up);
            if (atm) {
              updates.strikeShort = atm.strike;
              updates.premiumShort = getPremium(atm, params.optionStyle);
              const iv = params.optionStyle === "CALL" ? atm.callIV : atm.putIV;
              if (iv > 0) updates.shortIv = iv;
            }
          }

          const shortStrike = updates.strikeShort ?? params.strikeShort;

          if (isDiagonal) {
            const needsDifferentLong = params.strikeLong === 0 || params.strikeLong === shortStrike;
            if (needsDifferentLong && shortStrike > 0 && longRows.length > 0) {
              const sorted = [...longRows].sort((a, b) => a.strike - b.strike);
              const longRow = sorted.find((r) => r.strike > shortStrike) ?? sorted[sorted.length - 1] ?? null;
              if (longRow) {
                updates.strikeLong = longRow.strike;
                updates.premiumLong = getPremium(longRow, params.optionStyle);
                const iv = params.optionStyle === "CALL" ? longRow.callIV : longRow.putIV;
                if (iv > 0) updates.longIv = iv;
              }
            }
          } else {
            const needsSameStrike = params.strikeLong === 0 || params.strikeLong !== shortStrike;
            if (needsSameStrike && shortStrike > 0) {
              const atm = closestAtm(longRows, shortStrike);
              const row = longRows.find((r) => r.strike === shortStrike) ?? atm;
              if (row) {
                updates.strikeLong = shortStrike;
                updates.premiumLong = getPremium(row, params.optionStyle);
                const iv = params.optionStyle === "CALL" ? row.callIV : row.putIV;
                if (iv > 0) updates.longIv = iv;
              }
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          onChange({ ...params, ...updates });
        }

        if (shortRows.length === 0 && longRows.length === 0) {
          setErrorChain(
            `No hay datos para las fechas seleccionadas. Puedes ingresar los valores manualmente.`
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, ticker, params.expirationShort, params.expirationLong, expirationsLoading]);

  useEffect(() => {
    if (localPrice <= 0) return;
    if (shortChain.length === 0 && longChain.length === 0) return;
    if (params.strikeShort > 0 && params.strikeLong > 0) return;

    const updates: Partial<TermStrategyParams> = {};

    if (params.strikeShort === 0) {
      const atm = closestAtm(shortChain, localPrice);
      if (atm) {
        updates.strikeShort = atm.strike;
        updates.premiumShort = getPremium(atm, params.optionStyle);
        const iv = params.optionStyle === "CALL" ? atm.callIV : atm.putIV;
        if (iv > 0) updates.shortIv = iv;
      }
    }
    if (params.strikeLong === 0) {
      const atm = closestAtm(longChain, localPrice);
      if (atm) {
        updates.strikeLong = atm.strike;
        updates.premiumLong = getPremium(atm, params.optionStyle);
        const iv = params.optionStyle === "CALL" ? atm.callIV : atm.putIV;
        if (iv > 0) updates.longIv = iv;
      }
    }

    if (Object.keys(updates).length > 0) {
      onChange({ ...params, ...updates });
    }
  }, [localPrice]);

  const handleStrikeChange = (leg: "short" | "long", strike: number) => {
    const chain = leg === "short" ? shortChain : longChain;
    const strikeField = leg === "short" ? "strikeShort" : "strikeLong" as const;
    const premiumField = leg === "short" ? "premiumShort" : "premiumLong" as const;
    const ivField = leg === "short" ? "shortIv" : "longIv" as const;
    const defaultIv = leg === "short" ? 0.25 : 0.30;
    const row = chain.find((r) => r.strike === strike);
    if (!row) return;
    const rawIv = params.optionStyle === "CALL" ? row.callIV : row.putIV;
    onChange({
      ...params,
      [strikeField]: strike,
      [premiumField]: getPremium(row, params.optionStyle),
      [ivField]: rawIv > 0 ? rawIv : defaultIv,
    });
  };

  const handleOptionStyleChange = (style: "CALL" | "PUT") => {
    const update: Partial<TermStrategyParams> = { optionStyle: style };
    if (params.strikeShort > 0) {
      const row = shortChain.find((r) => r.strike === params.strikeShort);
      if (row) {
        update.premiumShort = getPremium(row, style);
        const iv = style === "CALL" ? row.callIV : row.putIV;
        if (iv > 0) update.shortIv = iv;
      }
    }
    if (params.strikeLong > 0) {
      const row = longChain.find((r) => r.strike === params.strikeLong);
      if (row) {
        update.premiumLong = getPremium(row, style);
        const iv = style === "CALL" ? row.callIV : row.putIV;
        if (iv > 0) update.longIv = iv;
      }
    }
    onChange({ ...params, ...update });
  };

  if (!open) return null;

  const set = (field: keyof TermStrategyParams, value: string | number) =>
    onChange({ ...params, [field]: value });

  const fieldLabel: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "var(--font-size-xs)"
  };
  const labelText: React.CSSProperties = {
    color: "var(--color-text-muted)", fontWeight: "var(--font-weight-emphasis)", textTransform: "uppercase"
  };

  const chainToOptions = (rows: OptionChainRow[], selectedStrike: number) => (
    <>
      <option value="" disabled>
        {rows.length > 0 ? "Selecciona strike" : "Sin datos"}
      </option>
      {rows.map((r) => (
        <option key={r.strike} value={r.strike}>
          {r.strike.toFixed(1)}
          {params.optionStyle === "CALL"
            ? ` (${midpoint(r.callBid, r.callAsk).toFixed(2) || "—"})`
            : ` (${midpoint(r.putBid, r.putAsk).toFixed(2) || "—"})`}
        </option>
      ))}
    </>
  );

  const strikeSelectOrInput = (
    chain: OptionChainRow[],
    strikeValue: number,
    onStrikeChange: (v: number) => void,
    leg: "short" | "long"
  ) => {
    if (chain.length > 0) {
      return (
        <select
          value={strikeValue || ""}
          onChange={(e) => onStrikeChange(Number(e.target.value))}
        >
          {chainToOptions(chain, strikeValue)}
        </select>
      );
    }
    return (
      <input
        type="number"
        step={0.5}
        min={0}
        value={strikeValue || ""}
        onChange={(e) => set(leg === "short" ? "strikeShort" : "strikeLong", Number(e.target.value))}
        placeholder="Ingresa strike manual"
      />
    );
  };

  const validDatesMessage = validExpirations.length > 0
    ? `Exp. disponibles: ${validExpirations.slice(0, 5).join(", ")}${validExpirations.length > 5 ? "…" : ""}`
    : null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 45, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "var(--space-lg)", width: "min(540px, 94vw)", maxHeight: "90vh", overflow: "auto", border: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
          <h3 style={{ margin: 0, fontSize: "var(--font-size-base)" }}>
            Parámetros — {estrategia.replace(/_/g, " ")}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "1.2rem", lineHeight: 1 }}>×</button>
        </div>

        {loading && (
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
            Cargando cadena de opciones…
          </p>
        )}

        {expirationsLoading && (
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
            Validando fechas de expiración…
          </p>
        )}

        {validDatesMessage && (
          <p style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)" }}>
            {validDatesMessage}
          </p>
        )}

        {errorChain && (
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-sell)", marginBottom: "var(--space-sm)" }}>
            ⚠ {errorChain}
          </p>
        )}

        <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={fieldLabel}>
            <span style={labelText}>Tipo de Opción</span>
            <select value={params.optionStyle} onChange={(e) => handleOptionStyleChange(e.target.value as "CALL" | "PUT")}>
              <option value="CALL">CALL</option>
              <option value="PUT">PUT</option>
            </select>
          </label>
          <label style={fieldLabel}>
            <span style={labelText}>Contratos</span>
            <input type="number" min={1} value={params.contracts} onChange={(e) => set("contracts", Number(e.target.value))} />
          </label>
          <label style={fieldLabel}>
            <span style={labelText}>Tasa Libre de Riesgo (%)</span>
            <input
              type="number" step={0.01} min={0}
              value={(params.riskFreeRate * 100).toFixed(2)}
              onChange={(e) => set("riskFreeRate", Number(e.target.value) / 100)}
            />
          </label>
        </div>

        <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "var(--space-sm) var(--space-md)", marginTop: "var(--space-md)" }}>
          <legend style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Ala Corta (Short Leg)
          </legend>
          <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: "var(--space-xs)" }}>
            <label style={fieldLabel}>
              <span style={labelText}>Strike</span>
              {strikeSelectOrInput(shortChain, params.strikeShort, (v) => handleStrikeChange("short", v), "short")}
            </label>
            <label style={fieldLabel}>
              <span style={labelText}>Vencimiento</span>
              <input type="date" value={params.expirationShort} disabled />
              <span style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", marginTop: "0.15rem" }}>Tomado del panel de control</span>
            </label>
            <label style={fieldLabel}>
              <span style={labelText}>Premium</span>
              <input type="number" step={0.01} min={0} value={params.premiumShort} onChange={(e) => set("premiumShort", Number(e.target.value))} />
            </label>
          </div>
        </fieldset>

        <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "var(--space-sm) var(--space-md)", marginTop: "var(--space-sm)" }}>
          <legend style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Ala Larga (Long Leg)
          </legend>
          <div style={{ display: "grid", gap: "var(--space-sm)", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: "var(--space-xs)" }}>
            <label style={fieldLabel}>
              <span style={labelText}>Strike</span>
              {strikeSelectOrInput(longChain, params.strikeLong, (v) => handleStrikeChange("long", v), "long")}
            </label>
            <label style={fieldLabel}>
              <span style={labelText}>Vencimiento</span>
              <input type="date" value={params.expirationLong} disabled />
              <span style={{ fontSize: "0.6rem", color: "var(--color-text-muted)", marginTop: "0.15rem" }}>Tomado del panel de control</span>
            </label>
            <label style={fieldLabel}>
              <span style={labelText}>Premium</span>
              <input type="number" step={0.01} min={0} value={params.premiumLong} onChange={(e) => set("premiumLong", Number(e.target.value))} />
            </label>
          </div>
        </fieldset>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-md)" }}>
          <button
            onClick={onClose}
            style={{ background: "var(--color-accent)", color: "#000", border: "none", borderRadius: "var(--radius-sm)", padding: "0.5rem 1.5rem", cursor: "pointer", fontWeight: "var(--font-weight-bold)" }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default TermStrategyModal;
