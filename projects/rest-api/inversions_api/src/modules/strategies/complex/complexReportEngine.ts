/**
 * FIC: Complex Report Engine - Generates payoff curves, P&L heatmaps, and risk/reward summaries
 * for complex options strategies. All outputs are structured JSON consumable by any UI.
 *
 * FIC: Motor de Reportes Complejos - Genera curvas de payoff, heatmaps P&L y resúmenes
 * riesgo/beneficio para estrategias complejas de opciones. Salidas en JSON estructurado
 * consumible por cualquier UI.
 */

import type { ComplexStrategyConfig, StrategyProfile, PayoffPoint } from "./complexStrategyContract";
import { generatePayoffCurve, generatePriceRange } from "./complexStrategyContract";
import type { SimulationResult } from "./complexSimulationEngine";
import type { RiskAssessment } from "./complexRiskEngine";

// ──────────────────────────────────────────────
// FIC: Types / Tipos
// ──────────────────────────────────────────────

/**
 * FIC: Heatmap cell representing P&L for a specific price × time combination.
 * FIC: Celda de heatmap representando P&L para una combinación específica de precio × tiempo.
 */
export interface HeatmapCell {
  /** FIC: Underlying price / Precio del subyacente */
  precio: number;
  /** FIC: Days to expiration / Días hasta vencimiento */
  dias_restantes: number;
  /** FIC: P&L at this point / P&L en este punto */
  pnl: number;
  /** FIC: Win/loss classification for coloring / Clasificación ganancia/pérdida para coloreado */
  tipo: "ganancia" | "perdida" | "equilibrio";
}

/**
 * FIC: Payoff curve with annotations (breakevens, max loss/gain markers).
 * FIC: Curva de payoff con anotaciones (break-evens, marcadores de pérdida/ganancia máxima).
 */
export interface AnnotatedPayoffCurve {
  /** FIC: The payoff points / Los puntos de payoff */
  curva: PayoffPoint[];
  /** FIC: Breakeven markers / Marcadores de break-even */
  break_even: Array<{ precio: number; pnl: number; etiqueta: string }>;
  /** FIC: Max loss marker / Marcador de pérdida máxima */
  perdida_maxima: { precio: number; pnl: number } | null;
  /** FIC: Max gain marker / Marcador de ganancia máxima */
  ganancia_maxima: { precio: number; pnl: number } | null;
  /** FIC: Risk/reward zones (profit/loss ranges) / Zonas de riesgo/beneficio */
  zonas: Array<{
    desde: number;
    hasta: number;
    tipo: "ganancia" | "perdida";
    area: number;
  }>;
}

/**
 * FIC: Complete report for a strategy analysis.
 * FIC: Reporte completo para un análisis de estrategia.
 */
export interface ComplexReport {
  /** FIC: Report metadata / Metadatos del reporte */
  metadata: {
    ticker: string;
    tipo_estrategia: string;
    fecha_analisis: string;
    tiempo_calculo_ms: number;
  };
  /** FIC: Strategy profile summary / Resumen del perfil de estrategia */
  perfil: {
    credito_neto: number;
    tipo_neto: "credito" | "debito";
    perdida_maxima: number;
    ganancia_maxima: number;
    ratio_riesgo_beneficio: number;
    break_even_points: number[];
  };
  /** FIC: Annotated payoff curves / Curvas de payoff anotadas */
  payoff: {
    expiracion: AnnotatedPayoffCurve;
    temporal?: AnnotatedPayoffCurve;
  };
  /** FIC: P&L heatmap (price × time) / Heatmap P&L (precio × tiempo) */
  heatmap?: {
    celdas: HeatmapCell[];
    precio_min: number;
    precio_max: number;
    dte_max: number;
    pnl_min: number;
    pnl_max: number;
  };
  /** FIC: Simulation summary / Resumen de simulación */
  simulacion: {
    tipo: string;
    probabilidad_exito: number;
    rendimiento_esperado: number;
    drawdown_maximo: number;
    ratio_sharpe: number;
    distribucion_pnl: {
      media: number;
      mediana: number;
      desviacion_estandar: number;
      percentil_5: number;
      percentil_95: number;
    };
  };
  /** FIC: Risk assessment summary / Resumen de evaluación de riesgo */
  riesgo: {
    puntaje: number;
    aceptable: boolean;
    eventos: number;
    resumen: string;
    accion_recomendada: string;
  };
}

// ──────────────────────────────────────────────
// FIC: Engine implementation / Implementación del motor
// ──────────────────────────────────────────────

/**
 * FIC: Complex Report Engine - generates structured reports for complex options strategies.
 *
 * FIC: Motor de Reportes Complejos - genera reportes estructurados para estrategias
 * complejas de opciones.
 */
export class ComplexReportEngine {
  /**
   * FIC: Generate a complete report for a strategy analysis.
   * FIC: Genera un reporte completo para un análisis de estrategia.
   */
  generateReport(
    config: ComplexStrategyConfig,
    profile: StrategyProfile,
    simulation: SimulationResult,
    risk: RiskAssessment,
    strategyType: string = "complex"
  ): ComplexReport {
    const startTime = Date.now();

    // FIC: Generate annotated payoff curve for expiration
    const annotatedExpiration = this.buildAnnotatedCurve(profile.payoff_vencimiento, profile);

    // FIC: Generate temporal payoff curve if available
    let annotatedTemporal: AnnotatedPayoffCurve | undefined;
    if (profile.payoff_temporal && profile.payoff_temporal.length > 0) {
      annotatedTemporal = this.buildAnnotatedCurve(profile.payoff_temporal, profile);
    }

    // FIC: Generate P&L heatmap
    const heatmap = this.buildHeatmap(config, profile);

    return {
      metadata: {
        ticker: config.ticker,
        tipo_estrategia: strategyType,
        fecha_analisis: new Date().toISOString(),
        tiempo_calculo_ms: Date.now() - startTime,
      },
      perfil: {
        credito_neto: profile.credito_neto,
        tipo_neto: profile.tipo_neto,
        perdida_maxima: profile.perdida_maxima,
        ganancia_maxima: profile.ganancia_maxima,
        ratio_riesgo_beneficio: profile.ratio_riesgo_beneficio ?? 0,
        break_even_points: profile.break_even_points,
      },
      payoff: {
        expiracion: annotatedExpiration,
        temporal: annotatedTemporal,
      },
      heatmap,
      simulacion: {
        tipo: simulation.tipo,
        probabilidad_exito: simulation.probabilidad_exito,
        rendimiento_esperado: simulation.rendimiento_esperado,
        drawdown_maximo: simulation.drawdown_maximo,
        ratio_sharpe: simulation.ratio_sharpe,
        distribucion_pnl: {
          media: simulation.distribucion_pnl.media,
          mediana: simulation.distribucion_pnl.mediana,
          desviacion_estandar: simulation.distribucion_pnl.desviacion_estandar,
          percentil_5: simulation.distribucion_pnl.percentil_5,
          percentil_95: simulation.distribucion_pnl.percentil_95,
        },
      },
      riesgo: {
        puntaje: risk.puntaje_riesgo,
        aceptable: risk.riesgo_aceptable,
        eventos: risk.eventos.length,
        resumen: risk.resumen,
        accion_recomendada: risk.accion_recomendada,
      },
    };
  }

  /**
   * FIC: Generate a compact summary report (lighter payload for dashboards).
   * FIC: Genera un reporte resumen compacto (payload ligero para dashboards).
   */
  generateSummary(
    profile: StrategyProfile,
    simulation: SimulationResult,
    risk: RiskAssessment
  ): Record<string, unknown> {
    return {
      perfil: {
        credito_neto: profile.credito_neto,
        perdida_maxima: profile.perdida_maxima,
        ganancia_maxima: profile.ganancia_maxima,
        ratio: profile.ratio_riesgo_beneficio,
        break_even: profile.break_even_points,
      },
      simulacion: {
        prob_exito: simulation.probabilidad_exito,
        rendimiento: simulation.rendimiento_esperado,
        sharpe: simulation.ratio_sharpe,
        drawdown: simulation.drawdown_maximo,
      },
      riesgo: {
        puntaje: risk.puntaje_riesgo,
        aceptable: risk.riesgo_aceptable,
        advertencias: risk.eventos.filter((e) => !e.bloquea).length,
        bloqueos: risk.eventos.filter((e) => e.bloquea).length,
      },
    };
  }

  /**
   * FIC: Export report as structured JSON (serializable via JSON.stringify).
   * FIC: Exporta reporte como JSON estructurado (serializable via JSON.stringify).
   */
  toJSON(report: ComplexReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * FIC: Export summary as CSV-ready array of rows.
   * FIC: Exporta resumen como arreglo de filas listo para CSV.
   */
  toCSVRows(report: ComplexReport): Array<Record<string, string | number>> {
    return [
      {
        metric: "Net Credit/Debit",
        value: report.perfil.credito_neto,
        type: report.perfil.tipo_neto,
      },
      {
        metric: "Max Loss",
        value: report.perfil.perdida_maxima,
        type: "loss",
      },
      {
        metric: "Max Gain",
        value: report.perfil.ganancia_maxima,
        type: "gain",
      },
      {
        metric: "Risk/Reward Ratio",
        value: report.perfil.ratio_riesgo_beneficio,
        type: "ratio",
      },
      {
        metric: "Breakeven(s)",
        value: report.perfil.break_even_points.join(" / "),
        type: "info",
      },
      {
        metric: "Probability of Profit",
        value: `${report.simulacion.probabilidad_exito}%`,
        type: "probability",
      },
      {
        metric: "Expected Return",
        value: report.simulacion.rendimiento_esperado,
        type: "return",
      },
      {
        metric: "Sharpe Ratio",
        value: report.simulacion.ratio_sharpe,
        type: "ratio",
      },
      {
        metric: "Max Drawdown",
        value: report.simulacion.drawdown_maximo,
        type: "risk",
      },
      {
        metric: "Risk Score",
        value: report.riesgo.puntaje,
        type: "risk",
      },
      {
        metric: "Risk Acceptable",
        value: report.riesgo.aceptable ? "Yes" : "No",
        type: "status",
      },
    ];
  }

  // ──────────────────────────────────────────────
  // FIC: Private helpers / Helpers privados
  // ──────────────────────────────────────────────

  private buildAnnotatedCurve(
    payoffPoints: PayoffPoint[],
    profile: StrategyProfile
  ): AnnotatedPayoffCurve {
    // FIC: Find max loss/gain points on the curve
    let maxLossPoint: PayoffPoint | null = null;
    let maxGainPoint: PayoffPoint | null = null;

    for (const point of payoffPoints) {
      if (!maxLossPoint || point.pnl < maxLossPoint.pnl) maxLossPoint = point;
      if (!maxGainPoint || point.pnl > maxGainPoint.pnl) maxGainPoint = point;
    }

    // FIC: Build breakeven markers
    const breakevens = profile.break_even_points.map((precio) => ({
      precio,
      pnl: 0,
      etiqueta: `BE @ ${precio.toFixed(2)}`,
    }));

    // FIC: Identify profit/loss zones
    const zonas: AnnotatedPayoffCurve["zonas"] = [];
    let zonaActual: { desde: number; hasta: number; tipo: "ganancia" | "perdida"; area: number } | null = null;

    for (let i = 0; i < payoffPoints.length; i++) {
      const point = payoffPoints[i];
      const tipo = point.pnl > 0 ? "ganancia" : point.pnl < 0 ? "perdida" : "equilibrio";

      if (tipo === "equilibrio") continue;

      if (!zonaActual) {
        zonaActual = { desde: point.precio_subyacente, hasta: point.precio_subyacente, tipo: tipo as "ganancia" | "perdida", area: 0 };
      } else if (tipo === zonaActual.tipo) {
        zonaActual.hasta = point.precio_subyacente;
      } else {
        zonaActual.area = Math.abs(zonaActual.hasta - zonaActual.desde);
        zonas.push(zonaActual);
        zonaActual = { desde: point.precio_subyacente, hasta: point.precio_subyacente, tipo: tipo as "ganancia" | "perdida", area: 0 };
      }
    }
    if (zonaActual) {
      zonaActual.area = Math.abs(zonaActual.hasta - zonaActual.desde);
      zonas.push(zonaActual);
    }

    return {
      curva: payoffPoints,
      break_even: breakevens,
      perdida_maxima: maxLossPoint ? { precio: maxLossPoint.precio_subyacente, pnl: maxLossPoint.pnl } : null,
      ganancia_maxima: maxGainPoint ? { precio: maxGainPoint.precio_subyacente, pnl: maxGainPoint.pnl } : null,
      zonas,
    };
  }

  private buildHeatmap(config: ComplexStrategyConfig, profile: StrategyProfile): ComplexReport["heatmap"] {
    const priceRange = generatePriceRange(config.legs, 0.3);
    const { legs } = config;
    const dtes = [45, 30, 21, 14, 7, 3, 1, 0];
    const cellCount = 20;

    const step = (priceRange.max - priceRange.min) / cellCount;
    const celdas: HeatmapCell[] = [];

    let pnlMin = 0;
    let pnlMax = 0;

    for (const dte of dtes) {
      for (let i = 0; i <= cellCount; i++) {
        const price = priceRange.min + i * step;
        const thetaFactor = dtes.length > 0 ? dte / dtes[0] : 0;

        let totalPnl = 0;
        for (const leg of legs) {
          const intrinsicValue =
            leg.tipo === "call"
              ? Math.max(0, price - leg.strike)
              : Math.max(0, leg.strike - price);

          const extrinsicValue = thetaFactor * leg.prima;
          const adjustedPremium = leg.posicion === "long" ? -(leg.prima - extrinsicValue) : (leg.prima - extrinsicValue);
          totalPnl += (intrinsicValue + adjustedPremium) * leg.contratos * 100;
        }

        totalPnl = Math.round(totalPnl * 100) / 100;

        if (totalPnl < pnlMin) pnlMin = totalPnl;
        if (totalPnl > pnlMax) pnlMax = totalPnl;

        celdas.push({
          precio: Math.round(price * 100) / 100,
          dias_restantes: dte,
          pnl: totalPnl,
          tipo: totalPnl > 0 ? "ganancia" : totalPnl < 0 ? "perdida" : "equilibrio",
        });
      }
    }

    return {
      celdas,
      precio_min: Math.round(priceRange.min * 100) / 100,
      precio_max: Math.round(priceRange.max * 100) / 100,
      dte_max: dtes[0],
      pnl_min: pnlMin,
      pnl_max: pnlMax,
    };
  }
}

/**
 * FIC: Factory function to create a ComplexReportEngine instance.
 * FIC: Función de fábrica para crear una instancia de ComplexReportEngine.
 */
export function createComplexReportEngine(): ComplexReportEngine {
  return new ComplexReportEngine();
}

export default ComplexReportEngine;
