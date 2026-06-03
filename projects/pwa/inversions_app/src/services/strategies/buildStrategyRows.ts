// FIC: Converts complex strategy execution result into ConfluenceSignalRow[] with one row per
// option leg (pata) plus a final summary row. Each leg row analyzes the specific option's
// premium fairness, IV environment, liquidity, and contribution to the strategy.
// FIC: Convierte resultado de estrategia compleja en filas ConfluenceSignalRow[] con una fila
// por cada pata de la opción más una fila final de resumen. Cada fila de pata analiza la
// prima, IV, liquidez y contribución individual de esa opción.
//
// IMPORTANTE: No se usan fallbacks silenciosos para datos del backend. Si un campo requerido
// falta, la función lanza un error que debe ser capturado y mostrado al usuario.

import type { ConfluenceSignalRow, CoreId, TipoSenal, Tendencia, EstadoSenal, DeltaPrev } from "../../services/signals/confluenceTableApi";
import type { FromChainResponse } from "./strategyApi";

// ─── Core identifier (exported for use by other Team 8 files) ─────────────────
export const STRATEGY_CORE = "A_ESTRATEGIA" as CoreId;

// ─── Named analysis constants ─────────────────────────────────────────────────
const IV_HIGH      = 0.5;   // IV >= 50% → high
const IV_MODERATE  = 0.25;  // IV between 25%–50% → moderate; IV <= 25% → low
const SPREAD_TIGHT = 0.05;  // Bid-ask spread <= 5% → liquid
const SPREAD_WIDE  = 0.15;  // Bid-ask spread > 15% → illiquid
const PREMIUM_HIGH_PCT = 5;   // Premium >= 5% of strike → high
const PREMIUM_LOW_PCT  = 1;   // Premium <= 1% of strike → low

const SCORE_CLAMP_MAX =  0.8;
const SCORE_CLAMP_MIN = -0.8;
const SCORE_CALL_THRESHOLD  =  0.2;  // >= 0.2 → CALL / ALCISTA
const SCORE_PUT_THRESHOLD   = -0.2;  // <= -0.2 → PUT / BAJISTA; between → HOLD / LATERAL

const RATIO_RB_GOOD = 0.3;   // ratio riesgo/beneficio >= 0.3 → +0.1 adjustment
const PROB_EXITO_50 = 50;    // probabilidad éxito >= 50% → +0.1 adjustment
const REND_BAJO     = 0;     // rendimiento esperado < 0 → -0.2 adjustment
const SHARPE_NEUTRO = 0;     // sharpe >= 0 → +0.1 adjustment

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StrategyRowPayload {
  rawResult: FromChainResponse;
  strategy: string;
  rows: ConfluenceSignalRow[];
}

/**
 * Validates that a strategy response contains the required data structure.
 * Throws a descriptive Error if any critical field is missing.
 */
function validateStrategyResult(result: FromChainResponse): void {
  if (!result.profile || typeof result.profile !== "object" || Object.keys(result.profile).length === 0) {
    throw new Error(`La estrategia ${result.strategy_type} no contiene datos de perfil (profile). Verifica la respuesta del backend.`);
  }
  if (!result.risk || typeof result.risk !== "object" || Object.keys(result.risk).length === 0) {
    throw new Error(`La estrategia ${result.strategy_type} no contiene datos de riesgo (risk). Verifica la respuesta del backend.`);
  }
  if (!result.simulation || typeof result.simulation !== "object" || Object.keys(result.simulation).length === 0) {
    throw new Error(`La estrategia ${result.strategy_type} no contiene datos de simulación (simulation). Verifica la respuesta del backend.`);
  }
  if (!result.premiums_used || !Array.isArray(result.premiums_used) || result.premiums_used.length === 0) {
    throw new Error(`La estrategia ${result.strategy_type} no contiene patas (premiums_used). Verifica la respuesta del backend.`);
  }
}

/**
 * Builds N rows (one per leg) + 1 summary row from a complex strategy result.
 *
 * Each leg row analyzes:
 *   - Premium fairness (IV-adjusted)
 *   - Bid-ask spread liquidity
 *   - Position contribution (long = cost, short = income)
 *   - Overall leg quality signal
 *
 * The summary row combines all legs into a final verdict.
 *
 * @throws Error if the result is missing required data (profile, risk, simulation, premiums_used).
 */
export function buildComplexStrategyRows(
  result: FromChainResponse,
  strategy: string,
  ticket: string,
  timeframe?: string,
): StrategyRowPayload {
  validateStrategyResult(result);

  const now = new Date().toISOString();
  const hash = `estrategia:${ticket}:${strategy}:${now}`;

  const profile    = result.profile;
  const risk       = result.risk;
  const simulation = result.simulation;
  const premiums   = result.premiums_used;  // guaranteed non-empty by validateStrategyResult

  // All values are validated to exist, but individual numerics can legitimately be 0
  const gananciaMax   = Number(profile.ganancia_maxima ?? 0);
  const perdidaMax    = Number(profile.perdida_maxima ?? 0);
  const ratioRB       = Number(profile.ratio_riesgo_beneficio ?? 0);
  const riesgoScore   = Number(risk.puntaje_riesgo ?? 0);
  const riesgoAceptable = (risk.riesgo_aceptable as boolean) ?? false;
  const probExito     = Number(simulation.probabilidad_exito ?? 0);
  const rendEsp       = Number(simulation.rendimiento_esperado ?? 0);
  const sharpe        = Number(simulation.ratio_sharpe ?? 0);

  const bePoints: number[] = Array.isArray(profile.break_even_points)
    ? (profile.break_even_points as (number | null)[]).filter((bp): bp is number => bp != null)
    : [];

  const estrategiaLabel = strategy.replace(/_/g, " ");

  // ─── Base fields shared by all rows ─────────────────────────────────────
  const baseRow: Partial<ConfluenceSignalRow> = {
    ticket,
    precio: 0,
    fecha: now.slice(0, 10),
    timeframe: timeframe ?? "",  // pass through the user-selected timeframe from the panel
    peso: 1,
    invertir: false,  // will be overridden per row based on score
    estado: "ACTIVA" as EstadoSenal,
    vigencia: now,
    fuente: "estrategia",
    evidencia_refs: [hash],
    ia_revisada: false,
    delta_vs_anterior: "NUEVA" as DeltaPrev,
    algorithm_version: "1.0.0",
    computed_at: now,
    source_input_hash: hash,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Build ONE ROW PER LEG (pata)
  // ═══════════════════════════════════════════════════════════════════════════

  const legRows: ConfluenceSignalRow[] = premiums.map((prem, idx) => {
    const p = prem as unknown as Record<string, unknown>;
    const strike   = Number(prem.strike);
    const tipo     = String(prem.tipo).toUpperCase();
    const posicion = String(prem.posicion).toLowerCase();
    const prima    = Number(prem.prima ?? 0);
    const bid      = prem.bid != null ? Number(prem.bid) : null;
    const ask      = prem.ask != null ? Number(prem.ask) : null;
    const iv       = p.iv != null ? Number(p.iv) : null;
    const delta    = p.delta != null ? Number(p.delta) : null;
    const theta    = p.theta != null ? Number(p.theta) : null;

    const mid     = bid != null && ask != null ? (bid + ask) / 2 : null;
    const spread  = bid != null && ask != null ? (ask - bid) / (mid ?? 1) : null;

    const isShort = posicion === "short";

    // ── Leg signal logic ─────────────────────────────────────────────────
    let legTipo: TipoSenal;
    let legTendencia: Tendencia;
    let legScore = 0;
    const factors: string[] = [];

    // Factor 1: IV assessment
    if (iv != null) {
      if (isShort) {
        if (iv >= IV_HIGH) {
          legScore = 0.35; factors.push(`IV alto (${(iv * 100).toFixed(0)}%) favorece vendedor`);
        } else if (iv >= IV_MODERATE) {
          legScore = 0.1; factors.push(`IV moderado (${(iv * 100).toFixed(0)}%)`);
        } else {
          legScore = -0.2; factors.push(`IV bajo (${(iv * 100).toFixed(0)}%) — prima baja`);
        }
      } else {
        if (iv <= IV_MODERATE) {
          legScore = 0.3; factors.push(`IV bajo (${(iv * 100).toFixed(0)}%) — compra barata`);
        } else if (iv <= IV_HIGH) {
          legScore = 0; factors.push(`IV moderado (${(iv * 100).toFixed(0)}%)`);
        } else {
          legScore = -0.3; factors.push(`IV alto (${(iv * 100).toFixed(0)}%) — prima cara`);
        }
      }
    } else {
      legScore = isShort ? 0.1 : -0.1;
      factors.push("Sin datos de IV");
    }

    // Factor 2: Bid-ask spread liquidity
    if (spread != null) {
      if (spread <= SPREAD_TIGHT) {
        legScore += 0.1; factors.push("Spread estrecho (líquido)");
      } else if (spread <= SPREAD_WIDE) {
        legScore += 0; factors.push(`Spread moderado (${(spread * 100).toFixed(0)}%)`);
      } else {
        legScore -= 0.15; factors.push(`Spread amplio (${(spread * 100).toFixed(0)}%) — ilíquido`);
      }
    }

    // Factor 3: Theta (time decay)
    if (theta != null) {
      if (isShort && theta > 0) {
        legScore += 0.1; factors.push(`Theta positivo ($${theta.toFixed(2)}) — ganas tiempo`);
      } else if (!isShort && theta < 0) {
        legScore += 0; factors.push(`Theta negativo ($${theta.toFixed(2)}) — pagas tiempo`);
      }
    }

    // Factor 4: Premium as % of strike
    if (prima > 0 && strike > 0) {
      const pctOfStrike = (prima / strike) * 100;
      if (isShort) {
        if (pctOfStrike >= PREMIUM_HIGH_PCT) {
          legScore += 0.15; factors.push(`Prima alta (${pctOfStrike.toFixed(1)}% del strike)`);
        } else if (pctOfStrike < PREMIUM_LOW_PCT) {
          legScore -= 0.05; factors.push(`Prima baja (${pctOfStrike.toFixed(1)}% del strike)`);
        }
      } else {
        if (pctOfStrike <= PREMIUM_LOW_PCT) {
          legScore += 0.1; factors.push(`Prima baja (${pctOfStrike.toFixed(1)}% del strike) — protección barata`);
        } else if (pctOfStrike > PREMIUM_HIGH_PCT) {
          legScore -= 0.1; factors.push(`Prima alta (${pctOfStrike.toFixed(1)}% del strike)`);
        }
      }
    }

    // Clamp score
    legScore = Math.max(SCORE_CLAMP_MIN, Math.min(SCORE_CLAMP_MAX, legScore));

    if (legScore >= SCORE_CALL_THRESHOLD) {
      legTipo = "CALL";
      legTendencia = "ALCISTA";
    } else if (legScore >= SCORE_PUT_THRESHOLD) {
      legTipo = "HOLD";
      legTendencia = "LATERAL";
    } else {
      legTipo = "PUT";
      legTendencia = "BAJISTA";
    }

    const posLabel = posicion === "short" ? "SHORT" : "LONG";
    const subCore = `${posLabel} ${tipo} $${strike}`;

    const legMetricTag = `${posLabel.slice(0, 1)}${tipo.slice(0, 1)}${strike}`;
    const metricas: Record<string, number | string> = {
      [`PRIMA_${legMetricTag}`]: prima,
      [`IV_${legMetricTag}`]: iv != null ? iv : "N/A",
      [`SPREAD_${legMetricTag}`]: spread != null ? spread : "N/A",
      [`DELTA_${legMetricTag}`]: delta ?? "N/A",
      [`THETA_${legMetricTag}`]: theta ?? "N/A",
      POSITION: posLabel,
    };

    return {
      ...baseRow,
      core: STRATEGY_CORE,
      subCore,
      precio: strike,  // ← muestra el strike en la columna precio de la tabla de confluencia
      tipoSenal: legTipo,
      tendencia: legTendencia,
      score: Number(legScore.toFixed(4)),
      invertir: legScore >= SCORE_CALL_THRESHOLD,
      observacion: {
        objetivo: `Análisis de pata: ${subCore}`,
        senal: `${isShort ? "Crédito" : "Débito"} · Prima: $${prima.toFixed(2)}${iv != null ? ` · IV: ${(iv * 100).toFixed(0)}%` : ""}`,
        explicacion: factors.length > 0
          ? `Pata ${posLabel} ${tipo} Strike $${strike}: ${factors.join(". ")}.`
          : `Pata ${posLabel} ${tipo} Strike $${strike}: sin datos adicionales.`,
        metricas,
      },
    } as ConfluenceSignalRow;
  });

  // Derive weight from score magnitude — más convicción = más peso
  const legWeights = legRows.map((r) => Math.abs(r.score) + 0.2); // 0.2 base to avoid 0-weight
  legRows.forEach((r, idx) => {
    const w = Number((legWeights[idx] / Math.max(...legWeights, 0.01)).toFixed(3));
    r.peso = Math.max(0.1, Math.min(1, w));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY ROW (RESUMEN)
  //   Combines all leg analyses into an overall verdict about the strategy.
  // ═══════════════════════════════════════════════════════════════════════════

  const aggregatedScores = legRows.map((r) => r.score);
  const sumScore = aggregatedScores.reduce((a, b) => a + b, 0);
  const avgScore = legRows.length > 0 ? sumScore / legRows.length : 0;
  const positiveLegs = aggregatedScores.filter((s) => s >= 0).length;
  const pctPositive = legRows.length > 0 ? (positiveLegs / legRows.length) * 100 : 0;

  let sumTipo: TipoSenal;
  let sumTendencia: Tendencia;
  let overallScore: number;

  overallScore = avgScore;

  if (ratioRB >= RATIO_RB_GOOD) overallScore += 0.1;
  if (riesgoAceptable) overallScore += 0.15;
  if (probExito >= PROB_EXITO_50) overallScore += 0.1;
  if (sharpe >= SHARPE_NEUTRO) overallScore += 0.1;
  if (rendEsp < REND_BAJO) overallScore -= 0.2;

  overallScore = Math.max(SCORE_CLAMP_MIN, Math.min(SCORE_CLAMP_MAX, overallScore));

  if (overallScore >= SCORE_CALL_THRESHOLD) {
    sumTipo = "CALL";
    sumTendencia = "ALCISTA";
  } else if (overallScore >= SCORE_PUT_THRESHOLD) {
    sumTipo = "HOLD";
    sumTendencia = "LATERAL";
  } else {
    sumTipo = "PUT";
    sumTendencia = "BAJISTA";
  }

  const legCount = legRows.length;
  const positiveCount = aggregatedScores.filter((s) => s > 0).length;
  const negativeCount = aggregatedScores.filter((s) => s < 0).length;
  const neutralCount = aggregatedScores.filter((s) => s === 0).length;

  let briefSummary: string;
  if (overallScore >= 0.3) {
    briefSummary = `Estructura favorable: ${positiveCount}/${legCount} patas con señal positiva.`;
  } else if (overallScore >= 0) {
    briefSummary = `Estructura mixta: ${positiveCount} positivas, ${negativeCount} negativas, ${neutralCount} neutras.`;
  } else if (overallScore >= -0.3) {
    briefSummary = `Estructura con señales adversas: ${negativeCount}/${legCount} patas con señal negativa.`;
  } else {
    briefSummary = `Estructura desfavorable: ${negativeCount}/${legCount} patas con señal negativa.`;
  }

  let detailExplanation = `${estrategiaLabel} — ${legCount} patas analizadas. `;
  detailExplanation += `${briefSummary} `;
  detailExplanation += `Pérdida máx: $${perdidaMax.toLocaleString()} · Ganancia máx: $${gananciaMax.toLocaleString()}. `;
  detailExplanation += bePoints.length >= 2
    ? `Rango BE: $${bePoints[0].toFixed(2)}–$${bePoints[1].toFixed(2)}.`
    : "";
  if (probExito > 0) {
    detailExplanation += ` Monte Carlo: ${probExito.toFixed(1)}% prob. éxito, Sharpe ${sharpe.toFixed(2)}, rend. esperado $${rendEsp.toFixed(2)}.`;
  }

  const summaryRow: ConfluenceSignalRow = {
    ...baseRow,
    core: STRATEGY_CORE,
    subCore: "RESUMEN",
    tipoSenal: sumTipo,
    tendencia: sumTendencia,
    score: Number(overallScore.toFixed(4)),
    invertir: overallScore >= SCORE_CALL_THRESHOLD,
    observacion: {
      objetivo: `Resumen de estrategia — ${estrategiaLabel}`,
      senal: `${positiveCount}/${legCount} patas positivas · Ratio R/B ${ratioRB.toFixed(2)} · Riesgo ${riesgoScore}/100`,
      explicacion: detailExplanation,
      metricas: {
        TOTAL_PATAS: legCount,
        PATAS_POSITIVAS: positiveCount,
        PATAS_NEGATIVAS: negativeCount,
        PATAS_NEUTRALES: neutralCount,
        SCORE_PROMEDIO: Number(avgScore.toFixed(4)),
        RATIO_RB: ratioRB,
        GANANCIA_MAX: gananciaMax,
        PERDIDA_MAX: perdidaMax,
        RIESGO_PUNTAJE: riesgoScore,
        RIESGO_ACEPTABLE: riesgoAceptable ? 1 : 0,
        PROB_EXITO: probExito,
        SHARPE: sharpe,
        REND_ESPERADO: rendEsp,
      },
    },
  // Summary row carries full weight (1.0)
  } as ConfluenceSignalRow;

  return {
    rawResult: result,
    strategy,
    rows: [...legRows, summaryRow],
  };
}
