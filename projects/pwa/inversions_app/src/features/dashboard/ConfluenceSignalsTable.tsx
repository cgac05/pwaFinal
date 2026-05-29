// FIC: Canonical confluence signals table - Revolut design tokens applied to all visual elements.
// FIC: Tabla canonica de senales de confluencia - tokens de diseno Revolut aplicados a todos los elementos visuales.
// FIC: Phase 5 T095 - tabla canonica con columnas del PDF "DASBOARD Y TABLA v1".
// FIC: Reemplaza la tabla v0 (symbol/direction/confidence/timestamp) por el contrato del PDF.

import React, { useEffect, useMemo, useState } from "react";
import { useSignalStore, type SelectedSignal } from "../../store/signals";
import {
  getConfluenceTable,
  type ConfluenceSignalRow,
  type ConfluenceTableResponse
} from "../../services/signals/confluenceTableApi";
import { ObservationCell } from "./ObservationCell";
import { OptionGreeksRow } from "./OptionGreeksRow";

// FIC: Columnas con ancho estable; la tabla se desplaza horizontalmente antes de aplastar texto.
const TABLE_COLUMNS: Array<{ key: keyof ConfluenceSignalRow | "estrategia" | "observacion"; label: string; width: number }> = [
  { key: "ticket", label: "TICKET", width: 76 },
  { key: "core", label: "CORE", width: 150 },
  { key: "subCore", label: "SUBCORE", width: 110 },
  { key: "precio", label: "PRECIO", width: 96 },
  { key: "tipoSenal", label: "TIPO SEÑAL", width: 108 },
  { key: "fecha", label: "FECHA", width: 110 },
  { key: "timeframe", label: "TIMEFRAME", width: 112 },
  { key: "tendencia", label: "TENDENCIA", width: 128 },
  { key: "score", label: "SCORE", width: 86 },
  { key: "peso", label: "PESO", width: 82 },
  { key: "invertir", label: "INVERTIR", width: 96 },
  { key: "estado", label: "ESTADO", width: 118 },
  { key: "estrategia", label: "ESTRATEGIA", width: 170 },
  { key: "observacion", label: "OBSERVACION", width: 360 }
];

interface Props {
  symbol?: string;
  /** FIC: Permite sobrescribir las filas (por ejemplo desde una corrida de simulacion). */
  rows?: ConfluenceSignalRow[];
  activeStrategy?: string;
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

export function ConfluenceSignalsTable({ symbol, rows: rowsProp, activeStrategy }: Props) {
  const [rows, setRows] = useState<ConfluenceSignalRow[]>(rowsProp ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Omit<ConfluenceTableResponse, "rows"> | null>(null);
  const [detailRow, setDetailRow] = useState<ConfluenceSignalRow | null>(null);
  const { setSelectedSignal } = useSignalStore();

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
            {meta.ticket} - {meta.timeframe} - v{meta.algorithm_version}
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: "var(--color-sell, #f85149)", marginBottom: "0.5rem", fontSize: "0.8rem" }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <span className="badge badge-medium">Vista compacta</span>
        <span className="badge badge-hold" style={{ fontSize: "0.72rem" }}>
          Estrategia: {(activeStrategy ?? "SIN_ESTRATEGIA").replace(/_/g, " ")}
        </span>
      </div>

      <div style={{ maxHeight: 500, overflow: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
        <table style={{ width: "100%", minWidth: 1760, borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              {TABLE_COLUMNS.map((col) => (
                <th key={col.key} style={{ position: "sticky", top: 0, background: "var(--color-surface, #14171c)", padding: "0.72rem 0.8rem", textAlign: "left", fontSize: "0.68rem", borderBottom: "1px solid var(--color-border)", width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={TABLE_COLUMNS.length} style={{ padding: "1rem", textAlign: "center" }}>Cargando...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={TABLE_COLUMNS.length} style={{ padding: "1rem", textAlign: "center", color: "var(--color-text-muted)" }}>Sin datos para mostrar</td></tr>
            ) : (
              sorted.flatMap((row, idx) => {
                const rowKey = `${row.core}-${row.subCore ?? "agg"}-${idx}`;
                const onClick = () =>
                  setSelectedSignal({
                    id: rowKey,
                    symbol: row.ticket,
                    metadata: { evidencia_refs: row.evidencia_refs, core: row.core, subCore: row.subCore }
                  } as SelectedSignal);
                const cells = (
                  <tr key={rowKey} onClick={onClick} style={{ cursor: "pointer", opacity: row.estado === "DEGRADADA" ? 0.62 : 1 }}>
                    {TABLE_COLUMNS.map((col) => {
                      let content: React.ReactNode;
                      if (col.key === "observacion") {
                        content = (
                          <button
                            className="btn-ghost"
                            type="button"
                            style={{ padding: "0.28rem 0.7rem", fontSize: "0.72rem" }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetailRow(row);
                            }}
                          >
                            Ver detalle
                          </button>
                        );
                      } else if (col.key === "estrategia") {
                        content = <span className="badge badge-hold">{(activeStrategy ?? "N/A").replace(/_/g, " ")}</span>;
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
                        <td key={col.key} style={{ padding: "0.72rem 0.8rem", borderBottom: "1px solid var(--color-border)", fontSize: "0.78rem", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
                if (row.optionLeg) {
                  return [cells, <OptionGreeksRow key={`${rowKey}-greeks`} greeks={row.optionLeg} colSpan={TABLE_COLUMNS.length} />];
                }
                return [cells];
              })
            )}
          </tbody>
        </table>
      </div>

      {detailRow && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.62)",
            zIndex: 45,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.25rem"
          }}
          onClick={() => setDetailRow(null)}
        >
          <div
            className="card"
            style={{
              width: "min(900px, 96vw)",
              maxHeight: "88vh",
              overflowY: "auto",
              border: "1px solid var(--color-border)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)"
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0 }}>Detalle de Señal</h2>
                <p style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}>{detailRow.ticket} - {detailRow.core}</p>
              </div>
              <button className="btn-ghost" type="button" onClick={() => setDetailRow(null)}>Cerrar</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.7rem", marginBottom: "1rem" }}>
              {[
                ["Subcore", detailRow.subCore ?? "-"],
                ["Precio", Number.isFinite(detailRow.precio) ? detailRow.precio.toFixed(3) : "-"],
                ["Señal", detailRow.tipoSenal],
                ["Tendencia", detailRow.tendencia],
                ["Score", detailRow.score.toFixed(3)],
                ["Peso", detailRow.peso.toFixed(3)],
                ["Invertir", detailRow.invertir ? "SI" : "NO"],
                ["Estado", detailRow.estado],
                ["Fecha", detailRow.fecha],
                ["Timeframe", detailRow.timeframe],
                ["Estrategia", (activeStrategy ?? "N/A").replace(/_/g, " ")]
              ].map(([label, value]) => (
                <div key={label} style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "0.6rem" }}>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "0.68rem", textTransform: "uppercase" }}>{label}</div>
                  <strong style={{ fontSize: "0.85rem" }}>{value}</strong>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <h2 style={{ marginBottom: "0.5rem" }}>Observacion</h2>
              <ObservationCell observation={detailRow.observacion} />
            </div>

            {detailRow.evidencia_refs?.length ? (
              <div>
                <h2 style={{ marginBottom: "0.5rem" }}>Evidencia</h2>
                <ul style={{ marginLeft: "1rem", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                  {detailRow.evidencia_refs.map((ref, i) => <li key={`${ref}-${i}`}>{ref}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

export default ConfluenceSignalsTable;
