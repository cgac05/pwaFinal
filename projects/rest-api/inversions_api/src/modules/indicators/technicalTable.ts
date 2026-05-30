// FIC: A_TECNICO table builder — translates TechnicalAnalysisResult to ConfluenceSignalRow. (EN)
// FIC: Constructor de tabla A_TECNICO — traduce TechnicalAnalysisResult a ConfluenceSignalRow. (ES)
//
// IMPORTANT: peso = 0. This row is VISUAL ONLY — it does NOT participate in computeConfluence().
// IMPORTANTE: peso = 0. Esta fila es SOLO VISUAL — NO participa en computeConfluence().
// The A_TECNICO score is derived from trend + adxValue and is independent from the
// consolidated confluence score shown in the dashboard header.

import { analyzeTechnicalLevels } from "./technicalAnalysis";
import { ALGORITHM_VERSION } from "./types";
import type {
  ConfluenceSignalRow,
  Tendencia,
  TipoSenal,
  DeltaPrev,
  Timeframe,
} from "./types";
import type { OhlcBar } from "./types";

// ─── Helpers (same thresholds as confluenceTable.ts — not imported to avoid coupling) ──

// FIC: Mirror of tipoSenalFromSignal in confluenceTable.ts — same thresholds (>0.2 / <-0.2). (EN)
function tipoSenalFromScore(score: number): TipoSenal {
  if (score > 0.2)  return "CALL";
  if (score < -0.2) return "PUT";
  return "HOLD";
}

// FIC: Mirror of tendenciaFromSignal in confluenceTable.ts — same thresholds (>0.15 / <-0.15). (EN)
function tendenciaFromScore(score: number): Tendencia {
  if (score > 0.15)  return "ALCISTA";
  if (score < -0.15) return "BAJISTA";
  return "LATERAL";
}

// FIC: Derive A_TECNICO visual score from trend direction amplified by ADX strength. (EN)
// FIC: Deriva el score visual A_TECNICO de la dirección de tendencia amplificada por la fuerza ADX. (ES)
// Formula: baseSignal (ALCISTA=+1, BAJISTA=-1, LATERAL=0) * clamp(adxValue/50, 0, 1)
// Result range: [-1, 1]. Default ADX factor = 0.3 when adxValue is null.
function deriveTechScore(trend: string, adxValue: number | null): number {
  const baseSignal = trend === "ALCISTA" ? 1 : trend === "BAJISTA" ? -1 : 0;
  if (baseSignal === 0) return 0;
  const adxFactor = adxValue !== null
    ? Math.min(Math.max(adxValue / 50, 0), 1)
    : 0.3;  // moderate default when ADX unavailable
  return Math.min(Math.max(baseSignal * adxFactor, -1), 1);
}

function deltaVsAnterior(
  previous: ConfluenceSignalRow | undefined,
  tipoSenal: TipoSenal
): DeltaPrev {
  if (!previous) return "NUEVA";
  if (previous.tipoSenal === tipoSenal) return "CONFIRMADA";
  if (
    (previous.tipoSenal === "CALL" && tipoSenal === "PUT") ||
    (previous.tipoSenal === "PUT"  && tipoSenal === "CALL")
  ) return "INVERTIDA";
  return "DEGRADADA";
}

export interface TechnicalTableInput {
  ticket: string;
  timeframe: Timeframe;
  candles: OhlcBar[];
  sourceInputHash: string;
  previousRows?: ConfluenceSignalRow[];
  now?: Date;
}

// FIC: Build a single A_TECNICO ConfluenceSignalRow from candles via analyzeTechnicalLevels. (EN)
// FIC: Construye una fila ConfluenceSignalRow de A_TECNICO desde velas via analyzeTechnicalLevels. (ES)
// peso = 0 intentionally — A_TECNICO does not influence the consolidated confluence verdict.
export function buildTechnicalTable(input: TechnicalTableInput): ConfluenceSignalRow[] {
  const computedAt = input.now ?? new Date();

  try {
    const result = analyzeTechnicalLevels(
      input.candles,
      { symbol: input.ticket, timeframe: input.timeframe }
    );

    const score     = deriveTechScore(result.trend, result.adxValue);
    const tipoSenal = tipoSenalFromScore(score);
    const tendencia = tendenciaFromScore(score);
    const precio    = result.lastClose ?? 0;

    const previous = input.previousRows?.find(
      (r) => r.core === "A_TECNICO" && !r.subCore
    );

    // FIC: Vigencia = 5 candle-lengths ahead (same convention as coreStubs). (EN)
    const TIMEFRAME_MS: Record<string, number> = {
      "1m": 60_000, "5m": 300_000, "15m": 900_000,
      "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000
    };
    const tfMs = TIMEFRAME_MS[input.timeframe] ?? 3_600_000;
    const vigencia = new Date(computedAt.getTime() + tfMs * 5).toISOString();

    const row: ConfluenceSignalRow = {
      ticket:    input.ticket,
      core:      "A_TECNICO",
      precio,
      tipoSenal,
      fecha:     computedAt.toISOString().slice(0, 10),
      timeframe: input.timeframe,
      tendencia,
      // FIC: peso = 0 — A_TECNICO score is visual only, not fed to computeConfluence(). (EN)
      // FIC: peso = 0 — el score A_TECNICO es solo visual, no se alimenta a computeConfluence(). (ES)
      score:    parseFloat(score.toFixed(4)),
      peso:     0,
      invertir: Math.abs(score) >= 0.3 && (result.adxValue ?? 0) >= 25,
      estado:   "ACTIVA",
      vigencia,
      fuente:   "technical-analysis-engine",
      evidencia_refs: [
        `trend:${result.trend}`,
        `trendStrength:${result.trendStrength}`,
        `adx:${result.adxValue?.toFixed(1) ?? "n/a"}`,
        `supports:${result.supports.length}`,
        `resistances:${result.resistances.length}`,
        `trendLines:${result.trendLines.length}`,
      ],
      ia_revisada:         false,
      delta_vs_anterior:   deltaVsAnterior(previous, tipoSenal),
      observacion: {
        objetivo:    "Identificar soportes, resistencias y tendencias estructurales.",
        senal:       `Tendencia ${result.trend} (${result.trendStrength}), ADX ${result.adxValue?.toFixed(1) ?? "n/a"}`,
        explicacion: `EMA20=${result.ema20?.toFixed(2) ?? "n/a"}, EMA50=${result.ema50?.toFixed(2) ?? "n/a"}, ` +
                     `Ultimo cierre=${precio.toFixed(2)}. ` +
                     `${result.supports.length} soporte(s), ${result.resistances.length} resistencia(s), ` +
                     `${result.trendLines.length} linea(s) de tendencia.`,
        // FIC: Only MetricKey fields allowed per FR-020; technical values encoded in explicacion. (EN)
        metricas: {
          TREND_STRENGTH: result.trendStrength,
          SOPORTES:       result.supports.length,
          RESISTENCIAS:   result.resistances.length,
          SMA_50:         result.ema50 ?? 0,
          CANDLES_ANALYZED: result.bars_used ?? 0,
        },
      },
      algorithm_version: ALGORITHM_VERSION,
      computed_at:       computedAt.toISOString(),
      source_input_hash: input.sourceInputHash,
    };

    return [row];

  } catch {
    // FIC: On any engine failure, return empty array — runner will fall back to stub. (EN)
    // FIC: Ante cualquier fallo del engine, retorna array vacío — el runner usa el stub. (ES)
    return [];
  }
}
