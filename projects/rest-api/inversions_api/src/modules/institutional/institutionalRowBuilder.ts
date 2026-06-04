// FIC: Converts institutional engine results into ConfluenceSignalRows for A_INSTITUCIONAL. (EN)
// FIC: Convierte resultados de engines institucionales en filas ConfluenceSignalRow para A_INSTITUCIONAL. (ES)

import type { InstitutionalZonesResult } from "./institutionalZonesEngine";
import type { InstitutionalTrendResult } from "./institutionalTrendEngine";
import type { ExpirationAnalysisResult } from "./expirationAnalysisEngine";
import {
  ALGORITHM_VERSION,
  type ConfluenceSignalRow,
  type Timeframe,
} from "../indicators/types";

interface BuildInstitutionalRowInput {
  ticket: string;
  timeframe: Timeframe;
  sourceInputHash: string;
  now: Date;
  zones: InstitutionalZonesResult | null;
  trend: InstitutionalTrendResult | null;
  expiration: ExpirationAnalysisResult | null;
  estrategia?: string;
  precioActual?: number;
}

export function buildInstitutionalRows(input: BuildInstitutionalRowInput): ConfluenceSignalRow[] {
  const { ticket, timeframe, sourceInputHash, now, zones, trend, expiration, estrategia, precioActual } = input;

  if (!zones && !trend && !expiration) return [];

  const fecha = now.toISOString();

  // ── Signal derivation — trend is the primary authority ────────────────────
  const direction = trend?.direction ?? "neutral";
  const tipoSenal = direction === "bullish" ? "CALL" as const
    : direction === "bearish" ? "PUT" as const : "HOLD" as const;
  const tendencia = direction === "bullish" ? "ALCISTA" as const
    : direction === "bearish" ? "BAJISTA" as const : "LATERAL" as const;

  // ── Score — weighted average of available institutional scores ─────────────
  const scores: number[] = [];
  if (zones)  scores.push(zones.institutionalScore);
  if (trend)  scores.push(trend.institutionalScore);
  if (expiration) {
    scores.push(expiration.daysToNextOpex <= 7 ? 0.9
      : expiration.daysToNextOpex <= 30 ? 0.7 : 0.45);
  }
  const score = scores.length > 0
    ? scores.reduce((s, v) => s + v, 0) / scores.length
    : 0.5;
  const peso = 1;

  // ── Evidence refs — most relevant signals from each engine ─────────────────
  const evidencia_refs: string[] = [];
  if (trend?.crossover) {
    evidencia_refs.push(
      `Cruce ${trend.crossover.type === "golden" ? "dorado (alcista)" : "de la muerte (bajista)"} hace ${trend.crossover.daysAgo} días`
    );
  }
  if (zones && zones.supportZones.length > 0) {
    evidencia_refs.push(
      `${zones.supportZones.length} soporte(s) · ${zones.resistanceZones.length} resistencia(s) detectadas`
    );
  }
  if (expiration) {
    evidencia_refs.push(
      `Próximo OpEx en ${expiration.daysToNextOpex} días — bias ${expiration.expiryBias.toUpperCase()}`
    );
  }

  // ── Observacion — senal + explicacion + metricas ──────────────────────────
  const senalParts: string[] = [];
  if (trend)      senalParts.push(`Tendencia ${direction.toUpperCase()}`);
  if (zones)      senalParts.push(`Score inst. ${(zones.institutionalScore * 100).toFixed(0)}%`);
  if (expiration) senalParts.push(`OpEx ${expiration.daysToNextOpex}d`);

  const explicacionParts: string[] = [];
  if (trend) {
    explicacionParts.push(
      `TENDENCIA: SMA50 ${trend.sma50.toFixed(2)} / SMA200 ${trend.sma200.toFixed(2)}. ` +
      `Fuerza ${(trend.trendStrength * 100).toFixed(1)}%. ` +
      `Prob. continuidad ${(trend.continuityProbability * 100).toFixed(1)}%.`
    );
  }
  if (zones) {
    explicacionParts.push(
      `ZONAS: ${zones.supportZones.length} soportes, ${zones.resistanceZones.length} resistencias. ` +
      `Score inst. ${(zones.institutionalScore * 100).toFixed(1)}%. ATR ${zones.atr.toFixed(4)}.`
    );
  }
  if (expiration) {
    explicacionParts.push(
      `OPEX: ${expiration.daysToNextOpex} días al próximo vencimiento. ` +
      `Theta ${expiration.theta.toFixed(3)}, Gamma ${expiration.gamma.toFixed(3)}. ` +
      `Régimen ${expiration.currentRegime}. Skew ${expiration.callPutSkew}.`
    );
  }

  const metricas: ConfluenceSignalRow["observacion"]["metricas"] = {};
  if (trend) {
    metricas.SMA_50 = parseFloat(trend.sma50.toFixed(4));
    metricas.SMA_200 = parseFloat(trend.sma200.toFixed(4));
    metricas.TREND_STRENGTH = parseFloat(trend.trendStrength.toFixed(4));
    metricas.CONTINUITY_PROB = parseFloat(trend.continuityProbability.toFixed(4));
  }
  if (zones) {
    metricas.SOPORTES = zones.supportZones.length;
    metricas.RESISTENCIAS = zones.resistanceZones.length;
    metricas.ATR = parseFloat(zones.atr.toFixed(4));
    // FIC: INST_SCORE must match zones.institutionalScore used in senal and explicacion. (EN)
    // FIC: INST_SCORE debe coincidir con zones.institutionalScore usado en señal y explicación. (ES)
    metricas.INST_SCORE = parseFloat(zones.institutionalScore.toFixed(4));
  }
  if (expiration) {
    metricas.DAYS_TO_OPEX = expiration.daysToNextOpex;
    metricas.THETA = parseFloat(expiration.theta.toFixed(4));
    metricas.GAMMA = parseFloat(expiration.gamma.toFixed(4));
    metricas.EXPIRY_BIAS = expiration.expiryBias;
    metricas.CALL_PUT_SKEW = expiration.callPutSkew;
  }

  const precioFinal = (() => {
    const sma = trend?.sma50 ?? 0;
    return sma > 0 ? sma : (precioActual ?? 0);
  })();

  const row: ConfluenceSignalRow = {
    ticket,
    core: "A_INSTITUCIONAL",
    subCore: "ANÁLISIS",
    precio: precioFinal,
    tipoSenal,
    fecha,
    timeframe,
    tendencia,
    score: parseFloat(score.toFixed(4)),
    peso: parseFloat(peso.toFixed(4)),
    invertir: direction === "bullish",
    estado: "ACTIVA",
    vigencia: fecha,
    fuente: "institutional_engine",
    evidencia_refs,
    ia_revisada: false,
    delta_vs_anterior: "NUEVA",
    observacion: {
      objetivo: "Análisis Institucional Integral",
      senal: senalParts.join(" · "),
      explicacion: explicacionParts.join(" | "),
      metricas,
    },
    algorithm_version: ALGORITHM_VERSION,
    computed_at: fecha,
    source_input_hash: sourceInputHash,
  };

  return [{ ...row, ...(estrategia ? { estrategia } : {}) }];
}
