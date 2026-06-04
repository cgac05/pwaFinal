// FIC: Detail modal for complex strategy rows (A_ESTRATEGIA) in the confluence table.
// Shows leg-specific analysis for individual option legs, or full strategy analysis for summary row.
// FIC: Modal de detalle para filas de estrategias complejas (A_ESTRATEGIA) en la tabla de confluencia.
// Muestra análisis específico de cada pata, o análisis completo para la fila de resumen.

import React from "react";
import type { ConfluenceSignalRow } from "../../../services/signals/confluenceTableApi";
import type { FromChainResponse } from "../../../services/strategies/strategyApi";
import { PayoffChart } from "../../../components/coverage/PayoffChart";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  row: ConfluenceSignalRow | null;
  result: FromChainResponse | null;
}

/** Formats a number with toLocaleString */
function nfmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Formats currency */
function cnfmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${Number(v).toLocaleString()}`;
}

/** Color class for P&L */
function pnlColor(v: number | null | undefined): string {
  if (v == null) return "var(--color-text-muted)";
  return v >= 0 ? "var(--color-buy)" : "var(--color-sell)";
}

/** Field card component */
function FieldCard({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.7rem", background: "var(--color-surface)" }}>
      <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <strong style={{ fontSize: "0.9rem", color }}>{value}</strong>
    </div>
  );
}

/** Parse subCore like "LONG PUT 520" → { position, type, strike } */
function parseSubCore(subCore: string): { position: string; type: string; strike: number } | null {
  const parts = subCore.split(" ");
  if (parts.length < 3) return null;
  const position = parts[0];     // "LONG" | "SHORT"
  const type = parts[1];          // "PUT" | "CALL"
  const strike = Number(parts[2].replace("$", ""));
  if (!position || !type || isNaN(strike)) return null;
  return { position, type, strike };
}

/** Find the matching premium entry for a leg row */
function findMatchingPremium(result: FromChainResponse, subCore: string) {
  const parsed = parseSubCore(subCore);
  if (!parsed) return null;
  return result.premiums_used?.find(
    (p) =>
      p.posicion.toUpperCase() === parsed.position &&
      p.tipo.toUpperCase() === parsed.type &&
      p.strike === parsed.strike
  ) ?? null;
}

// ─── LEG DETAIL MODAL ───────────────────────────────────────────────────────

function LegDetailModal({ row, result, onClose }: { row: ConfluenceSignalRow; result: FromChainResponse; onClose: () => void }) {
  const subCore = row.subCore ?? "";
  const parsed = parseSubCore(subCore);
  const premium = parsed ? findMatchingPremium(result, subCore) : null;
  const p = premium as Record<string, unknown> | null;

  if (!parsed || !premium) {
    return (
      <div className="card" style={{ padding: "1.25rem", border: "1px solid var(--color-sell)", background: "rgba(248,81,73,0.08)" }}>
        <strong style={{ color: "var(--color-sell)", display: "block", marginBottom: "0.5rem" }}>Error al identificar la pata</strong>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.82rem", margin: 0 }}>
          No se pudo hacer match del subCore &ldquo;{subCore}&rdquo; con las primas disponibles en la respuesta del backend.
          Verifica que los datos de la estrategia contengan la información esperada.
        </p>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.72rem", marginTop: "0.5rem" }}>
          SubCore: {subCore} | Premiums disponibles: {(result.premiums_used?.length ?? 0)}
        </p>
      </div>
    );
  }

  const { position, type, strike } = parsed;
  const prima     = Number(premium.prima ?? 0);
  const bid       = premium.bid != null ? Number(premium.bid) : null;
  const ask       = premium.ask != null ? Number(premium.ask) : null;
  const mid       = bid != null && ask != null ? (bid + ask) / 2 : null;
  const spreadPct = bid != null && ask != null && mid != null && mid > 0 ? ((ask - bid) / mid) * 100 : null;

  const iv    = p?.iv != null ? Number(p.iv) : null;
  const delta = p?.delta != null ? Number(p.delta) : null;
  const gamma = p?.gamma != null ? Number(p.gamma) : null;
  const theta = p?.theta != null ? Number(p.theta) : null;
  const vega  = p?.vega != null ? Number(p.vega) : null;
  const rho   = p?.rho != null ? Number(p.rho) : null;

  const isShort = position === "SHORT";
  const pctOfStrike = strike > 0 ? (prima / strike) * 100 : 0;
  const strategyLabel = (result.strategy_type ?? "").replace(/_/g, " ");

  // DTE — no silent fallback: if expiracion is missing → "—"; if invalid → show error
  let dte = "—";
  let dteError: string | null = null;
  if (result.expiracion) {
    const expDate = new Date(result.expiracion);
    if (!isNaN(expDate.getTime())) {
      const today = new Date();
      const diff = Math.max(0, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      dte = `${diff} días`;
    } else {
      dteError = `Fecha inválida: "${result.expiracion}"`;
    }
  }

  const badgeStyle = (color: string) => ({
    fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase" as const,
    padding: "1px 6px", borderRadius: "var(--radius-xs)",
    background: color,
    color: "#fff",
  });

  return (
    <>
      {/* ── Header ── */}
      <div style={{ padding: "1rem 1.25rem 0.5rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", borderBottom: "1px solid var(--color-border)" }}>
        <div>
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <span style={badgeStyle(isShort ? "rgba(248,81,73,0.85)" : "rgba(0,168,126,0.85)")}>{position}</span>
            {" "}{type} · Strike ${strike}
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.78rem", margin: 0, fontWeight: 700 }}>
            {row.ticket} · {strategyLabel} · {dte} para expirar · {result.expiracion}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
            Score: <strong style={{ color: row.score >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>{row.score.toFixed(4)}</strong>
          </span>
          <button className="btn-ghost" type="button" onClick={onClose} style={{ borderRadius: "var(--radius-pill)", fontWeight: 700 }}>Cerrar</button>
        </div>
      </div>

      <div style={{ padding: "1rem 1.25rem", overflowY: "auto", flex: 1 }}>
        {/* ── Key metrics grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.65rem", marginBottom: "1rem" }}>
          <FieldCard label="Prima" value={<span style={{ fontWeight: 700, color: "var(--color-accent)" }}>${nfmt(prima)}</span>} />
          <FieldCard label="Bid" value={bid != null ? `$${nfmt(bid)}` : "—"} />
          <FieldCard label="Ask" value={ask != null ? `$${nfmt(ask)}` : "—"} />
          <FieldCard label="Mid" value={mid != null ? `$${nfmt(mid)}` : "—"} />
          <FieldCard
            label="Spread"
            value={spreadPct != null ? `${spreadPct.toFixed(1)}%` : "—"}
            color={spreadPct != null && spreadPct <= 5 ? "var(--color-buy)" : spreadPct != null && spreadPct <= 15 ? "var(--color-hold)" : spreadPct != null ? "var(--color-sell)" : undefined}
          />
          <FieldCard
            label="IV"
            value={iv != null ? `${(iv * 100).toFixed(0)}%` : "—"}
            color={iv != null ? (isShort && iv >= 0.5 ? "var(--color-buy)" : !isShort && iv <= 0.25 ? "var(--color-buy)" : "var(--color-text-muted)") : undefined}
          />
          <FieldCard label="Prima / Strike" value={`${pctOfStrike.toFixed(1)}%`} />
          <FieldCard label="DTE" value={dte} color={dteError ? "var(--color-sell)" : undefined} />
        </div>

        {dteError && (
          <div style={{ fontSize: "0.72rem", color: "var(--color-sell)", marginBottom: "0.75rem", padding: "0.35rem 0.6rem", background: "rgba(248,81,73,0.08)", borderRadius: "var(--radius-sm)" }}>
            ⚠ {dteError}
          </div>
        )}

        {/* ── Greeks ── */}
        {(delta != null || gamma != null || theta != null || vega != null || rho != null) && (
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
              Griegas de la pata
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.5rem" }}>
              <FieldCard label="Delta" value={delta != null ? nfmt(delta, 4) : "—"} />
              <FieldCard label="Gamma" value={gamma != null ? nfmt(gamma, 4) : "—"} />
              <FieldCard
                label="Theta ($/día)"
                value={theta != null ? <span style={{ color: theta >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>${nfmt(theta)}</span> : "—"}
              />
              <FieldCard label="Vega ($/1%)" value={vega != null ? `$${nfmt(vega)}` : "—"} />
              <FieldCard label="Rho" value={rho != null ? nfmt(rho, 4) : "—"} />
            </div>
          </div>
        )}

        {/* ── Analysis ── */}
        <div style={{ marginBottom: "1rem" }}>
          <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
            Análisis de la pata
          </h3>
          <div className="card" style={{ fontSize: "0.78rem", lineHeight: 1.6, padding: "0.85rem" }}>
            <p style={{ margin: "0 0 0.5rem" }}>
              <strong>{position} {type} @ ${strike}</strong> — {isShort ? "Vendes" : "Compras"} la opción por una prima de <strong>${nfmt(prima)}</strong>
              {mid != null ? ` (mid $${nfmt(mid)})` : ""}.
            </p>
            <ul style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
              {iv != null && (
                <li style={{ marginBottom: "0.25rem" }}>
                  <strong>IV:</strong> {(iv * 100).toFixed(0)}% — {isShort
                    ? iv >= 0.5 ? "Favorable para vendedor (prima inflada)." : "IV moderado, prima razonable."
                    : iv <= 0.25 ? "Favorable para comprador (prima barata)." : "IV elevado, prima cara."}
                </li>
              )}
              {spreadPct != null && (
                <li style={{ marginBottom: "0.25rem" }}>
                  <strong>Bid-Ask spread:</strong> {spreadPct.toFixed(1)}% — {spreadPct <= 5 ? "Opción líquida, fácil de ejecutar." : spreadPct <= 15 ? "Spread moderado." : "Spread amplio, opción ilíquida."}
                </li>
              )}
              {delta != null && (
                <li style={{ marginBottom: "0.25rem" }}>
                  <strong>Delta:</strong> {nfmt(delta, 4)} — {isShort
                    ? `Exposición direccional de ${(Math.abs(delta) * 100).toFixed(0)}% por $1 de movimiento.`
                    : `Delta de ${(delta * 100).toFixed(0)}% — ${delta > 0 ? "alcista" : "bajista"}.`}
                </li>
              )}
              {theta != null && (
                <li style={{ marginBottom: "0.25rem" }}>
                  <strong>Theta:</strong> ${nfmt(theta)}/día — {isShort
                    ? theta > 0 ? "El tiempo juega a tu favor (colectas theta)." : "Theta negativo."
                    : theta < 0 ? "Pagas theta cada día (decaimiento temporal)." : "Theta neutral."}
                </li>
              )}
              <li>
                <strong>Prima como % del strike:</strong> {pctOfStrike.toFixed(1)}% — {isShort
                  ? pctOfStrike >= 5 ? "Prima significativa." : "Prima modesta."
                  : pctOfStrike <= 1 ? "Protección relativamente barata." : "Cobertura con costo significativo."}
              </li>
            </ul>
            <p style={{ margin: "0.5rem 0 0", color: "var(--color-text-muted)" }}>
              Señal: <strong style={{ color: row.score >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>{row.tipoSenal} ({row.score.toFixed(4)})</strong> — {row.observacion?.explicacion ?? ""}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── SUMMARY DETAIL MODAL (existing full analysis) ─────────────────────────

function SummaryDetailModal({ row, result, onClose }: { row: ConfluenceSignalRow; result: FromChainResponse; onClose: () => void }) {
  const strategyLabel = (result.strategy_type ?? "").replace(/_/g, " ");
  const profile = result.profile as Record<string, unknown>;
  const risk = result.risk as Record<string, unknown>;
  const simulation = result.simulation as Record<string, unknown>;
  const premiums = result.premiums_used ?? [];
  const payoffCurve = (profile?.payoff_curve as Array<Record<string, unknown>>) ?? [];
  const griegas = profile?.griegas as Record<string, unknown> | undefined;
  const escenarios = simulation?.escenarios as Record<string, unknown> | undefined;
  const bePoints: number[] = Array.isArray(profile?.break_even_points) ? profile.break_even_points as number[] : [];

  let dte = "—";
  let dteError: string | null = null;
  if (result.expiracion) {
    const expDate = new Date(result.expiracion);
    if (!isNaN(expDate.getTime())) {
      const today = new Date();
      const diff = Math.max(0, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      dte = `${diff} días`;
    } else {
      dteError = `Fecha inválida: "${result.expiracion}"`;
    }
  }

  const eventos = Array.isArray(risk?.eventos) ? risk.eventos as Array<{ mensaje: string; bloquea: boolean }> : [];

  return (
    <>
      {/* ── Header ── */}
      <div style={{ padding: "1rem 1.25rem 0.5rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", borderBottom: "1px solid var(--color-border)" }}>
        <div>
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Resumen · {strategyLabel}
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.78rem", margin: 0, fontWeight: 700 }}>
            {row.ticket} · {dte} para expirar · {result.expiracion}
          </p>
        </div>
        <button className="btn-ghost" type="button" onClick={onClose} style={{ borderRadius: "var(--radius-pill)", fontWeight: 700 }}>
          Cerrar
        </button>
      </div>

      <div style={{ padding: "1rem 1.25rem", overflowY: "auto", flex: 1 }}>
        {/* ── Profile metrics grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.65rem", marginBottom: "1rem" }}>
          {[
            ["Ganancia Máx", <span key="gm" style={{ color: "var(--color-buy)" }}>{cnfmt(profile?.ganancia_maxima as number)}</span>],
            ["Pérdida Máx", <span key="pm" style={{ color: "var(--color-sell)" }}>{cnfmt(profile?.perdida_maxima as number)}</span>],
            ["Break-even", bePoints.length > 0 ? bePoints.map((bp, i) => <span key={i} style={{ display: "block" }}>${nfmt(bp)}</span>) : "—"],
            ["Crédito/Débito", <span key="cd" style={{ color: profile?.tipo_neto === "credito" ? "var(--color-buy)" : "var(--color-sell)" }}>{cnfmt(profile?.credito_neto as number)}</span>],
            ["Ratio R/B", profile?.ratio_riesgo_beneficio != null ? `1:${nfmt(profile.ratio_riesgo_beneficio as number)}` : "—"],
            ["Prob. Éxito", <span key="pe" style={{ color: (simulation?.probabilidad_exito as number ?? 0) >= 50 ? "var(--color-buy)" : "var(--color-sell)" }}>{(simulation?.probabilidad_exito as number ?? 0).toFixed(1)}%</span>],
            ["Sharpe", <span key="sh" style={{ color: (simulation?.ratio_sharpe as number ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>{nfmt(simulation?.ratio_sharpe as number)}</span>],
            ["Rend. Esperado", <span key="re" style={{ color: pnlColor(simulation?.rendimiento_esperado as number) }}>{cnfmt(simulation?.rendimiento_esperado as number)}</span>],
            ["Riesgo", <span key="ri" style={{ color: (risk?.puntaje_riesgo as number ?? 0) >= 60 ? "var(--color-warning)" : "var(--color-text)" }}>{(risk?.puntaje_riesgo as number ?? 0)}/100</span>],
            ["Riesgo Aceptable", <span key="ra" style={{ color: risk?.riesgo_aceptable ? "var(--color-buy)" : "var(--color-sell)" }}>{risk?.riesgo_aceptable ? "Sí" : "No"}</span>],
            ["DTE", <span key="dte" style={{ color: dteError ? "var(--color-sell)" : undefined }}>{dte}{dteError && " ⚠"}</span>],
            ["Contratos", (result as any).contratos != null ? String((result as any).contratos) : "—"],
          ].map(([label, value]) => (
            <FieldCard key={String(label)} label={String(label)} value={value} />
          ))}
        </div>

        {dteError && (
          <div style={{ fontSize: "0.72rem", color: "var(--color-sell)", marginBottom: "0.75rem", padding: "0.35rem 0.6rem", background: "rgba(248,81,73,0.08)", borderRadius: "var(--radius-sm)" }}>
            ⚠ {dteError}
          </div>
        )}

        {/* ── Payoff + Premiums side by side ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
              Diagrama de Payoff
            </h3>
            {payoffCurve.length > 0 ? (
              <PayoffChart
                points={payoffCurve.map((p: any) => ({
                  underlyingPrice: Number(p.precio_subyacente ?? p.price ?? 0),
                  pnl: Number(p.pnl ?? 0),
                }))}
                breakEvenPrice={bePoints[0] ?? 0}
                height={220}
              />
            ) : (
              <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>Sin datos de payoff</p>
            )}
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
              Primas (Alpaca)
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr>
                  {["Pos", "Strike", "Tipo", "Prima", "Bid", "Ask"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {premiums.map((p: any, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <span style={{
                        fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase",
                        padding: "1px 6px", borderRadius: "var(--radius-xs)",
                        background: p.posicion === "long" ? "rgba(0,168,126,0.15)" : "rgba(248,81,73,0.15)",
                        color: p.posicion === "long" ? "var(--color-buy)" : "var(--color-sell)",
                      }}>
                        {p.posicion}
                      </span>
                    </td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border-subtle)", fontWeight: 600 }}>${p.strike}</td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border-subtle)", textTransform: "uppercase" }}>{p.tipo}</td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border-subtle)", fontWeight: 700, color: "var(--color-accent)" }}>${p.prima?.toFixed(2) ?? "—"}</td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{p.bid != null ? `$${p.bid.toFixed(2)}` : "—"}</td>
                    <td style={{ padding: "0.35rem 0.5rem", borderBottom: "1px solid var(--color-border-subtle)" }}>{p.ask != null ? `$${p.ask.toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Griegas ── */}
        {griegas && (
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
              Griegas (agregadas)
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.5rem" }}>
              {[
                ["Delta", nfmt(griegas.delta as number, 4)],
                ["Gamma", nfmt(griegas.gamma as number, 4)],
                ["Theta ($/día)", <span key="theta" style={{ color: (griegas.theta as number ?? 0) >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>${nfmt(griegas.theta as number)}</span>],
                ["Vega ($/1%)", `$${nfmt(griegas.vega as number)}`],
                ["Rho", nfmt(griegas.rho as number, 4)],
              ].map(([label, value]) => (
                <FieldCard key={String(label)} label={String(label)} value={value} />
              ))}
            </div>
          </div>
        )}

        {/* ── Risk + Monte Carlo ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
              Evaluación de Riesgo
            </h3>
            <div style={{ display: "grid", gap: "0.25rem" }}>
              {[
                ["Puntaje", `${risk?.puntaje_riesgo ?? "—"}/100`, (risk?.puntaje_riesgo as number ?? 0) >= 60 ? "var(--color-warning)" : "var(--color-text)"],
                ["Aceptable", risk?.riesgo_aceptable ? "Sí" : "No", risk?.riesgo_aceptable ? "var(--color-buy)" : "var(--color-sell)"],
                ["Drawdown Máx", cnfmt(simulation?.drawdown_maximo as number), "var(--color-sell)"],
                ["Costos Totales", cnfmt(simulation?.costos_totales as number)],
                ["Iteraciones", (simulation?.total_iteraciones as number ?? 0).toLocaleString()],
              ].map(([label, value, color]) => (
                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "0.35rem 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                  <span style={{ fontWeight: 700, color: color ?? "var(--color-text)" }}>{value}</span>
                </div>
              ))}
              {eventos.map((e, i) => (
                <div key={i} style={{ fontSize: "0.72rem", color: e.bloquea ? "var(--color-sell)" : "var(--color-hold)", padding: "0.15rem 0" }}>
                  {e.mensaje}
                </div>
              ))}
              {risk?.resumen ? (
                <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", padding: "0.35rem 0", borderBottom: "1px solid var(--color-border-subtle)", fontStyle: "italic" }}>
                  {String(risk.resumen)}
                </div>
              ) : null}
              {risk?.accion_recomendada ? (
                <div style={{ fontSize: "0.78rem", fontWeight: 600, padding: "0.35rem 0" }}>
                  {String(risk.accion_recomendada)}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
              Escenarios
            </h3>
            {escenarios ? (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {[
                  { key: "mejor_caso", label: "Mejor caso", data: escenarios.mejor_caso as Record<string, unknown> },
                  { key: "caso_base", label: "Caso base", data: escenarios.caso_base as Record<string, unknown> },
                  { key: "peor_caso", label: "Peor caso", data: escenarios.peor_caso as Record<string, unknown> },
                ].map(({ key, label, data }) => {
                  const precio = data?.precio as number | undefined;
                  const pnl = data?.pnl as number | undefined;
                  return (
                    <div key={key} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.6rem", background: "var(--color-surface)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.78rem" }}>{label}</span>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: pnlColor(pnl) }}>
                          {pnl != null ? `${pnl >= 0 ? "+" : ""}$${nfmt(pnl)}` : "—"}
                        </span>
                      </div>
                      {precio != null && (
                        <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                          Precio subyacente: ${nfmt(precio)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>Sin datos de escenarios</p>
            )}

            {simulation?.distribucion_pnl ? (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ margin: "0 0 0.4rem", fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em" }}>
                  Distribución P&L (Monte Carlo)
                </h4>
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  {[
                    ["Media", cnfmt((simulation.distribucion_pnl as Record<string, unknown>)?.media as number)],
                    ["Mediana", cnfmt((simulation.distribucion_pnl as Record<string, unknown>)?.mediana as number)],
                    ["P5", cnfmt((simulation.distribucion_pnl as Record<string, unknown>)?.p5 as number)],
                    ["P95", cnfmt((simulation.distribucion_pnl as Record<string, unknown>)?.p95 as number)],
                  ].map(([label, value]) => (
                    <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", padding: "0.25rem 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                      <span style={{ fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ROOT MODAL ─────────────────────────────────────────────────────────────

export function ComplexStrategyModal({ isOpen, onClose, row, result }: Props) {
  if (!isOpen || !row || !result) return null;

  const isSummary = row.subCore === "RESUMEN";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: isSummary ? "min(1100px, 96vw)" : "min(700px, 96vw)",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--color-border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isSummary ? (
          <SummaryDetailModal row={row} result={result} onClose={onClose} />
        ) : (
          <LegDetailModal row={row} result={result} onClose={onClose} />
        )}

        {/* ── Close footer ── */}
        <div style={{ padding: "0.65rem 1.25rem", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn-ghost"
            type="button"
            onClick={onClose}
            style={{ borderRadius: "var(--radius-pill)", fontWeight: 700, fontSize: "0.78rem" }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ComplexStrategyModal;
