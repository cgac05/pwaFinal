// FIC: Canonical confluence signals table — Revolut design tokens applied to all visual elements.
// FIC: Tabla canónica de señales de confluencia — tokens de diseño Revolut aplicados a todos los elementos visuales.
// FIC: Phase 5 T095 — tabla canonica con columnas del PDF "DASBOARD Y TABLA v1".

import React, { useEffect, useMemo, useState } from "react";
import { useSignalStore, type SelectedSignal } from "../../store/signals";
import { useAppShellStore } from "../../store/appShell";
import { useInstitutionalStore, getNearestZone } from "../../store/institutional";
import {
  getConfluenceTable,
  type ConfluenceSignalRow,
  type ConfluenceTableResponse
} from "../../services/signals/confluenceTableApi";
import { ObservationCell } from "./ObservationCell";
import { OptionGreeksRow } from "./OptionGreeksRow";
import { InstitutionalDetailModal } from "../institutional/InstitutionalDetailModal";

// FIC: 13 columnas canonicas del PDF v1 (US5).
const PDF_COLUMNS: Array<{ key: keyof ConfluenceSignalRow | "observacion"; label: string }> = [
  { key: "ticket", label: "TICKET" },
  { key: "core", label: "CORE" },
  { key: "subCore", label: "SUBCORE" },
  { key: "precio", label: "PRECIO" },
  { key: "tipoSenal", label: "TIPO SEÑAL" },
  { key: "fecha", label: "FECHA" },
  { key: "timeframe", label: "TIMEFRAME" },
  { key: "tendencia", label: "TENDENCIA" },
  { key: "score", label: "SCORE" },
  { key: "peso", label: "PESO" },
  { key: "invertir", label: "INVERTIR" },
  { key: "estado", label: "ESTADO" },
  { key: "observacion", label: "OBSERVACION" }
];

interface Props {
  symbol?: string;
  /** FIC: Permite sobrescribir las filas (por ejemplo desde una corrida de simulacion). */
  rows?: ConfluenceSignalRow[];
}

function colorForTipo(tipo: string): string {
  if (tipo === "CALL") return "var(--color-buy, #2ec27e)";
  if (tipo === "PUT") return "var(--color-sell, #f85149)";
  return "var(--color-text-muted, #8b949e)";
}

function colorForEstado(estado: string): string {
  if (estado === "DEGRADADA") return "var(--color-text-muted, #8b949e)";
  if (estado === "INVALIDADA") return "var(--color-sell, #f85149)";
  return "var(--color-buy, #2ec27e)";
}

export function ConfluenceSignalsTable({ symbol, rows: rowsProp }: Props) {
  const [rows, setRows] = useState<ConfluenceSignalRow[]>(rowsProp ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Omit<ConfluenceTableResponse, "rows"> | null>(null);
  const [modalTicker, setModalTicker] = useState<string | null>(null);
  const { setSelectedSignal } = useSignalStore();
  const { analysisCategory } = useAppShellStore();
  const { results: institutionalResults } = useInstitutionalStore();

  const showInstitutionalColumns = analysisCategory === "institutional";

  useEffect(() => {
    if (rowsProp) {
      setRows(rowsProp);
      return;
    }
    if (!symbol) return;
    setLoading(true);
    setError(null);
    getConfluenceTable({ ticket: symbol })
      .then((res) => {
        setRows(res.rows);
        setMeta({
          generated_at: res.generated_at,
          algorithm_version: res.algorithm_version,
          ticket: res.ticket,
          timeframe: res.timeframe
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "load_failed"))
      .finally(() => setLoading(false));
  }, [symbol, rowsProp]);

  const sorted = useMemo(() => {
    const order = ["A_INDICADORES", "A_FUNDAMENTAL", "A_TECNICO", "A_INSTITUCIONAL", "A_NOTICIAS", "A_IA"];
    return [...rows].sort((a, b) => order.indexOf(a.core) - order.indexOf(b.core));
  }, [rows]);

  return (
    <section className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Tabla de Confluencia de Señales</h2>
        {meta && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
            {meta.ticket} · {meta.timeframe} · v{meta.algorithm_version}
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: "var(--color-sell, #f85149)", marginBottom: "0.5rem", fontSize: "0.8rem" }}>
          Error: {error}
        </div>
      )}

      <div style={{ maxHeight: 540, overflow: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {PDF_COLUMNS.map((col) => (
                <th key={col.key} style={{ position: "sticky", top: 0, background: "var(--color-surface, #14171c)", padding: "0.5rem", textAlign: "left", fontSize: "0.7rem", borderBottom: "1px solid var(--color-border)" }}>
                  {col.label}
                </th>
              ))}
              {/* FIC: Institutional columns — only shown when analysisCategory === "institutional". (EN) */}
              {/* FIC: Columnas institucionales — solo visibles cuando analysisCategory === "institutional". (ES) */}
              {showInstitutionalColumns && (
                <>
                  <th style={{ position: "sticky", top: 0, background: "var(--color-surface, #14171c)", padding: "0.5rem", textAlign: "left", fontSize: "0.7rem", borderBottom: "1px solid var(--color-border)", color: "var(--color-accent)" }}>
                    INST. SCORE
                  </th>
                  <th style={{ position: "sticky", top: 0, background: "var(--color-surface, #14171c)", padding: "0.5rem", textAlign: "left", fontSize: "0.7rem", borderBottom: "1px solid var(--color-border)", color: "var(--color-accent)" }}>
                    TREND
                  </th>
                  <th style={{ position: "sticky", top: 0, background: "var(--color-surface, #14171c)", padding: "0.5rem", textAlign: "left", fontSize: "0.7rem", borderBottom: "1px solid var(--color-border)", color: "var(--color-accent)" }}>
                    ZONA CERCANA
                  </th>
                  <th style={{ position: "sticky", top: 0, background: "var(--color-surface, #14171c)", padding: "0.5rem", textAlign: "left", fontSize: "0.7rem", borderBottom: "1px solid var(--color-border)", color: "var(--color-accent)" }}>
                    DÍAS OPEX
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={PDF_COLUMNS.length} style={{ padding: "1rem", textAlign: "center" }}>Cargando…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={PDF_COLUMNS.length} style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-muted)" }}>Sin datos para mostrar</td></tr>
            ) : (
              sorted.flatMap((row, idx) => {
                const rowKey = `${row.core}-${row.subCore ?? "agg"}-${idx}`;
                const instData = institutionalResults[row.ticket?.toUpperCase() ?? ""];
                const onClick = () => {
                  if (showInstitutionalColumns && instData) {
                    // FIC: Open institutional detail modal on row click when institutional data is available. (EN)
                    // FIC: Abre el modal de detalle institucional al clic en la fila cuando hay datos disponibles. (ES)
                    setModalTicker(row.ticket ?? null);
                  } else {
                    setSelectedSignal({
                      id: rowKey,
                      symbol: row.ticket,
                      metadata: { evidencia_refs: row.evidencia_refs, core: row.core, subCore: row.subCore }
                    } as SelectedSignal);
                  }
                };
                // Institutional derived values for this row's ticker
                const instScore = instData?.zones?.institutionalScore;
                const trendDir = instData?.trends?.direction;
                const allZones = instData?.zones?.all ?? [];
                const nearestZone = getNearestZone(allZones, row.precio ?? 0);
                const daysToOpex = instData?.expiration?.daysToNextOpex;

                const cells = (
                  <tr key={rowKey} onClick={onClick} style={{ cursor: "pointer", opacity: row.estado === "DEGRADADA" ? 0.55 : 1 }}>
                    {PDF_COLUMNS.map((col) => {
                      let content: React.ReactNode;
                      if (col.key === "observacion") {
                        content = <ObservationCell observation={row.observacion} />;
                      } else if (col.key === "tipoSenal") {
                        content = <span style={{ color: colorForTipo(row.tipoSenal), fontWeight: 700 }}>{row.tipoSenal}</span>;
                      } else if (col.key === "estado") {
                        content = <span style={{ color: colorForEstado(row.estado), fontWeight: 600 }}>{row.estado}</span>;
                      } else if (col.key === "invertir") {
                        content = row.invertir ? "SI" : "NO";
                      } else if (col.key === "score" || col.key === "peso" || col.key === "precio") {
                        const v = row[col.key] as number;
                        content = Number.isFinite(v) ? v.toFixed(3) : "-";
                      } else if (col.key === "core" && row.core === "A_IA") {
                        content = (
                          <span>
                            {row.core}{" "}
                            <span title={row.disclaimer_id} style={{ background: "var(--color-accent, #ffd43b)", color: "#000", borderRadius: 3, padding: "0 4px", fontSize: "0.6rem", fontWeight: 700 }}>IA</span>
                          </span>
                        );
                      } else {
                        const v = (row as any)[col.key];
                        content = v == null ? "-" : String(v);
                      }
                      return (
                        <td key={col.key} style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", fontSize: "0.8rem", verticalAlign: "top" }}>
                          {content}
                        </td>
                      );
                    })}
                    {/* FIC: Institutional columns — rendered per-row when category=institutional. (EN) */}
                    {showInstitutionalColumns && (
                      <>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
                          {instScore != null ? (
                            <span style={{ color: instScore >= 0.7 ? "var(--color-buy)" : instScore >= 0.4 ? "var(--color-hold)" : "var(--color-sell)", fontWeight: 600 }}>
                              {instScore.toFixed(2)}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
                          {trendDir === "bullish" ? "🟢 Bullish" : trendDir === "bearish" ? "🔴 Bearish" : trendDir === "neutral" ? "⚫ Neutral" : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
                          {nearestZone
                            ? <span style={{ color: nearestZone.type === "support" ? "var(--color-buy)" : "var(--color-sell)" }}>
                                ${nearestZone.price.toFixed(2)} ({nearestZone.type === "support" ? "S" : "R"})
                              </span>
                            : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
                          {daysToOpex != null ? `${daysToOpex}d` : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                );
                const totalCols = PDF_COLUMNS.length + (showInstitutionalColumns ? 4 : 0);
                if (row.optionLeg) {
                  return [cells, <OptionGreeksRow key={`${rowKey}-greeks`} greeks={row.optionLeg} colSpan={totalCols} />];
                }
                return [cells];
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FIC: InstitutionalDetailModal — opens when clicking a row with institutional data. (EN) */}
      {/* FIC: InstitutionalDetailModal — se abre al clic en una fila con datos institucionales. (ES) */}
      <InstitutionalDetailModal
        isOpen={modalTicker !== null}
        onClose={() => setModalTicker(null)}
        ticker={modalTicker ?? ""}
        data={modalTicker ? (institutionalResults[modalTicker.toUpperCase()] ?? null) : null}
      />
    </section>
  );
}

export default ConfluenceSignalsTable;
