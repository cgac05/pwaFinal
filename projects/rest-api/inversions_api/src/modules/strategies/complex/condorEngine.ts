/**
 * FIC: Condor Engine - Calculates profiles for Condor strategies (call/put).
 * A Condor involves 4 legs: buy lower, sell lower-middle, sell upper-middle, buy upper.
 * All legs are the same type (all calls or all puts). Profits from range-bound movement
 * with a wider profit zone than a Butterfly Spread (two short strikes instead of one).
 *
 * FIC: Motor de Condor - Calcula perfiles para estrategias Condor (call/put).
 * Un Condor involucra 4 patas: comprar inferior, vender medio-inferior, vender medio-superior, comprar superior.
 * Todas las patas son del mismo tipo (todos calls o todos puts). Gana con movimiento lateral
 * con una zona de ganancia más amplia que un Butterfly Spread (dos strikes cortos en lugar de uno).
 */

import type {
  ComplexStrategyConfig,
  IComplexStrategyEngine,
  StrategyProfile,
  StrategyValidationResult,
} from "./complexStrategyContract";
import {
  calculateNetCredit,
  calculateMaxLoss,
  calculateMaxGain,
  findBreakEvens,
  generatePayoffCurve,
  generatePriceRange,
  validateCommonConfig,
} from "./complexStrategyContract";

// ──────────────────────────────────────────────
// FIC: Condor type / Tipo de condor
// ──────────────────────────────────────────────

/**
 * FIC: Type of condor spread.
 * FIC: Tipo de condor spread.
 */
export type CondorType = "call" | "put";

// ──────────────────────────────────────────────
// FIC: Engine implementation / Implementación del motor
// ──────────────────────────────────────────────

/**
 * FIC: Condor Engine - validates config and calculates full strategy profile.
 * A Condor has 4 legs of the same type (all calls or all puts) with equidistant strikes:
 *   - Long lower (buy 1)
 *   - Short lower-middle (sell 1)
 *   - Short upper-middle (sell 1)
 *   - Long upper (buy 1)
 *
 * FIC: Motor de Condor - valida configuración y calcula perfil completo de estrategia.
 * Un Condor tiene 4 patas del mismo tipo (todos calls o todos puts) con strikes equidistantes:
 *   - Long inferior (comprar 1)
 *   - Short medio-inferior (vender 1)
 *   - Short medio-superior (vender 1)
 *   - Long superior (comprar 1)
 */
export class CondorEngine implements IComplexStrategyEngine {
  /**
   * FIC: Validate condor configuration.
   * Requirements:
   * - Exactly 4 legs
   * - All same type (call OR put)
   * - Sorted ascending: long lower, short lower-middle, short upper-middle, long upper
   * - Equidistant strikes
   *
   * FIC: Valida configuración de condor.
   * Requisitos:
   * - Exactamente 4 patas
   * - Todas del mismo tipo (call O put)
   * - Orden ascendente: long inferior, short medio-inferior, short medio-superior, long superior
   * - Strikes equidistantes
   */
  validateConfig(config: ComplexStrategyConfig): StrategyValidationResult {
    const base = validateCommonConfig(config);
    const errores = [...base.errores];
    const advertencias = [...base.advertencias];

    if (config.legs.length !== 4) {
      errores.push(
        "Condor requiere exactamente 4 patas. Condor requires exactly 4 legs."
      );
      return { valido: false, errores, advertencias };
    }

    // FIC: All legs must be the same type (all call or all put)
    const tipos = new Set(config.legs.map((leg) => leg.tipo));
    if (tipos.size !== 1) {
      errores.push(
        "Condor: todas las patas deben ser del mismo tipo (call o put). " +
        "Condor: all legs must be the same type (call or put)."
      );
      return { valido: false, errores, advertencias };
    }

    // FIC: Sort by strike ascending
    const sorted = [...config.legs].sort((a, b) => a.strike - b.strike);
    const condorType: CondorType = sorted[0].tipo as CondorType;

    const lowerLeg = sorted[0];
    const lowerMidLeg = sorted[1];
    const upperMidLeg = sorted[2];
    const upperLeg = sorted[3];

    // FIC: Wing legs (outer) must be long
    if (lowerLeg.posicion !== "long") {
      errores.push(
        "Condor: la pata de strike inferior debe ser long (compra). " +
        "Condor: the lower strike leg must be long."
      );
    }
    if (upperLeg.posicion !== "long") {
      errores.push(
        "Condor: la pata de strike superior debe ser long (compra). " +
        "Condor: the upper strike leg must be long."
      );
    }

    // FIC: Middle legs must be short
    if (lowerMidLeg.posicion !== "short") {
      errores.push(
        "Condor: la pata de strike medio-inferior debe ser short (venta). " +
        "Condor: the lower-middle strike leg must be short."
      );
    }
    if (upperMidLeg.posicion !== "short") {
      errores.push(
        "Condor: la pata de strike medio-superior debe ser short (venta). " +
        "Condor: the upper-middle strike leg must be short."
      );
    }

    if (errores.length > 0) {
      return { valido: false, errores, advertencias };
    }

    // FIC: Verify equidistant strikes
    const width1 = lowerMidLeg.strike - lowerLeg.strike;
    const width2 = upperMidLeg.strike - lowerMidLeg.strike;
    const width3 = upperLeg.strike - upperMidLeg.strike;

    if (
      Math.abs(width1 - width2) > 0.01 ||
      Math.abs(width2 - width3) > 0.01
    ) {
      advertencias.push(
        `Condor: los strikes no son equidistantes (${width1}, ${width2}, ${width3}). ` +
        `Condor: strikes are not equidistant (${width1}, ${width2}, ${width3}).`
      );
    }

    // FIC: Warn if wing widths are too narrow (less than 1 standard deviation)
    const avgWidth = (width1 + width2 + width3) / 3;
    if (avgWidth < 1) {
      advertencias.push(
        `Condor: alas muy estrechas (${avgWidth.toFixed(1)}). Riesgo de alto costo de comisiones. ` +
        `Condor: very narrow wings (${avgWidth.toFixed(1)}). Risk of high commission costs.`
      );
    }

    // FIC: Check for IV skew between wings
    if (lowerLeg.volatilidad_implicita && upperLeg.volatilidad_implicita) {
      const ivSkew = Math.abs(lowerLeg.volatilidad_implicita - upperLeg.volatilidad_implicita);
      if (ivSkew > 0.05) {
        advertencias.push(
          `Diferencia de IV entre alas: ${(ivSkew * 100).toFixed(1)}%. Verificar skew de volatilidad. ` +
          `IV difference between wings: ${(ivSkew * 100).toFixed(1)}%. Check volatility skew.`
        );
      }
    }

    return {
      valido: errores.length === 0,
      errores,
      advertencias,
    };
  }

  /**
   * FIC: Calculate full profile for a Condor strategy.
   * FIC: Calcula perfil completo para una estrategia Condor.
   */
  calculateProfile(config: ComplexStrategyConfig): StrategyProfile {
    const validation = this.validateConfig(config);
    if (!validation.valido) {
      throw new Error(
        `CondorEngine: configuracion invalida. Invalid configuration.\n${validation.errores.join("\n")}`
      );
    }

    // FIC: Sort legs by strike
    const sorted = [...config.legs].sort((a, b) => a.strike - b.strike);
    const condorType: CondorType = sorted[0].tipo as CondorType;

    const lowerStrike = sorted[0].strike;
    const lowerMidStrike = sorted[1].strike;
    const upperMidStrike = sorted[2].strike;
    const upperStrike = sorted[3].strike;

    // FIC: Generate price range (wider than butterfly due to 4-leg spread)
    const priceRange = generatePriceRange(config.legs, 0.35);

    // FIC: Payoff at expiration
    const payoffExpiration = generatePayoffCurve(
      config.legs,
      priceRange.min,
      priceRange.max,
      150
    );

    // FIC: Net credit/debit
    const { credito_neto, tipo_neto } = calculateNetCredit(config.legs);

    // FIC: Break-even points
    const breakEvens = findBreakEvens(payoffExpiration);

    // FIC: Max loss and gain
    const perdida_maxima = calculateMaxLoss(payoffExpiration);
    const ganancia_maxima = calculateMaxGain(payoffExpiration);

    // FIC: Risk/reward
    const ratio_riesgo_beneficio =
      perdida_maxima > 0
        ? Math.round((ganancia_maxima / perdida_maxima) * 100) / 100
        : 0;

    // FIC: Calculate profit plateau (range between short strikes where max profit occurs)
    const profitPlateau = this.calculateProfitPlateau(
      lowerMidStrike,
      upperMidStrike,
      condorType
    );

    // FIC: Temporal payoff
    const payoffTemporal = this.generateTemporalPayoff(
      config.legs,
      priceRange.min,
      priceRange.max,
      config.dias_vencimiento ?? 45
    );

    // FIC: Condor-specific metrics
    const wingWidth = upperStrike - lowerStrike;
    const bodyWidth = upperMidStrike - lowerMidStrike;
    const creditSpreadRatio =
      perdida_maxima > 0
        ? Math.round((ganancia_maxima / (wingWidth * 100)) * 100) / 100
        : 0;

    return {
      credito_neto,
      tipo_neto,
      break_even_points: breakEvens,
      perdida_maxima,
      ganancia_maxima,
      payoff_curve: payoffExpiration,
      payoff_vencimiento: payoffExpiration,
      payoff_temporal: payoffTemporal,
      ratio_riesgo_beneficio,
    };
  }

  /**
   * FIC: Calculate the profit plateau description for the condor.
   * For a condor, max profit occurs when underlying is between the two middle strikes at expiration.
   *
   * FIC: Calcula la descripción de la meseta de ganancia para el condor.
   * Para un condor, el máximo beneficio ocurre cuando el subyacente está entre los dos strikes medios al vencimiento.
   */
  private calculateProfitPlateau(
    lowerMidStrike: number,
    upperMidStrike: number,
    condorType: CondorType
  ): string {
    return (
      `Max profit when underlying is between ${lowerMidStrike} and ${upperMidStrike} at expiration. ` +
      `Profit plateau width: ${(upperMidStrike - lowerMidStrike).toFixed(2)}. ` +
      `Máximo beneficio cuando subyacente está entre ${lowerMidStrike} y ${upperMidStrike} al vencimiento. ` +
      `Ancho de meseta de ganancia: ${(upperMidStrike - lowerMidStrike).toFixed(2)}.`
    );
  }

  /**
   * FIC: Generate temporal payoff curves at different DTE.
   * FIC: Genera curvas de payoff temporales a diferentes DTE.
   */
  private generateTemporalPayoff(
    legs: ComplexStrategyConfig["legs"],
    minPrice: number,
    maxPrice: number,
    daysToExpiration: number
  ): Array<{ precio_subyacente: number; pnl: number; dias_restantes: number }> {
    const timePoints = [
      daysToExpiration,
      Math.floor(daysToExpiration * 0.66),
      Math.floor(daysToExpiration * 0.33),
    ];
    const result: Array<{
      precio_subyacente: number;
      pnl: number;
      dias_restantes: number;
    }> = [];
    const step = (maxPrice - minPrice) / 50;

    for (const dte of timePoints) {
      const thetaFactor = dte / daysToExpiration;

      for (let price = minPrice; price <= maxPrice; price += step) {
        const roundedPrice = Math.round(price * 100) / 100;
        let totalPnl = 0;

        for (const leg of legs) {
          const intrinsicValue =
            leg.tipo === "call"
              ? Math.max(0, roundedPrice - leg.strike)
              : Math.max(0, leg.strike - roundedPrice);

          // FIC: Extrinsic value decays with time (simplified linear theta)
          const extrinsicValue = thetaFactor * leg.prima;
          const adjustedPremium =
            leg.posicion === "long"
              ? -(leg.prima - extrinsicValue)
              : leg.prima - extrinsicValue;

          totalPnl += (intrinsicValue + adjustedPremium) * leg.contratos * 100;
        }

        result.push({
          precio_subyacente: roundedPrice,
          pnl: Math.round(totalPnl * 100) / 100,
          dias_restantes: dte,
        });
      }
    }

    return result;
  }
}

/**
 * FIC: Factory function to create a CondorEngine instance.
 * FIC: Función de fábrica para crear una instancia de CondorEngine.
 */
export function createCondorEngine(): CondorEngine {
  return new CondorEngine();
}

export default CondorEngine;
