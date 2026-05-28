/**
 * FIC: Butterfly Spread Engine - Calculates profiles for Butterfly Spread strategies (call/put).
 * A Butterfly Spread involves 3 legs: buy lower strike, sell 2x middle strike, buy upper strike.
 * Profits from low volatility around the middle strike.
 *
 * FIC: Motor de Butterfly Spread - Calcula perfiles para estrategias Butterfly Spread (call/put).
 * Un Butterfly Spread involucra 3 patas: comprar strike inferior, vender 2x strike medio, comprar strike superior.
 * Gana con baja volatilidad alrededor del strike medio.
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
// FIC: Butterfly spread type / Tipo de butterfly spread
// ──────────────────────────────────────────────

/**
 * FIC: Type of butterfly spread.
 * FIC: Tipo de butterfly spread.
 */
export type ButterflyType = "call" | "put";

/**
 * FIC: Engine implementation / Implementación del motor
 */
export class ButterflySpreadEngine implements IComplexStrategyEngine {
  /**
   * FIC: Validate butterfly spread configuration.
   * Requirements:
   * - Exactly 3 legs
   * - Long lower (buy 1), Short middle (sell 2), Long upper (buy 1)
   * - All same type (call OR put)
   * - Equidistant strikes
   *
   * FIC: Valida configuración de butterfly spread.
   * Requisitos:
   * - Exactamente 3 patas
   * - Long inferior (comprar 1), Short medio (vender 2), Long superior (comprar 1)
   * - Todas del mismo tipo (call O put)
   * - Strikes equidistantes
   */
  validateConfig(config: ComplexStrategyConfig): StrategyValidationResult {
    const base = validateCommonConfig(config);
    const errores = [...base.errores];
    const advertencias = [...base.advertencias];

    if (config.legs.length !== 3) {
      errores.push(
        "Butterfly Spread requiere exactamente 3 patas. Butterfly Spread requires exactly 3 legs."
      );
      return { valido: false, errores, advertencias };
    }

    // FIC: All legs must be the same type (all call or all put)
    const tipos = new Set(config.legs.map((leg) => leg.tipo));
    if (tipos.size !== 1) {
      errores.push(
        "Butterfly Spread: todas las patas deben ser del mismo tipo (call o put). " +
        "Butterfly Spread: all legs must be the same type (call or put)."
      );
    }

    // FIC: Sort by strike
    const sorted = [...config.legs].sort((a, b) => a.strike - b.strike);

    const lowerLeg = sorted[0];
    const middleLeg = sorted[1];
    const upperLeg = sorted[2];

    // FIC: First leg must be long
    if (lowerLeg.posicion !== "long") {
      errores.push(
        "Butterfly Spread: la pata de strike inferior debe ser long (compra). " +
        "Butterfly Spread: lower strike leg must be long."
      );
    }

    // FIC: Middle leg(s) must be short (2 contracts)
    if (middleLeg.posicion !== "short") {
      errores.push(
        "Butterfly Spread: la pata de strike medio debe ser short (venta). " +
        "Butterfly Spread: middle strike leg must be short."
      );
    }

    // FIC: Upper leg must be long
    if (upperLeg.posicion !== "long") {
      errores.push(
        "Butterfly Spread: la pata de strike superior debe ser long (compra). " +
        "Butterfly Spread: upper strike leg must be long."
      );
    }

    // FIC: Middle leg should have 2 contracts (sell 2x)
    if (middleLeg.contratos < 2) {
      advertencias.push(
        "Butterfly Spread: la pata media tipicamente tiene 2 contratos (venta 2x). " +
        "Butterfly Spread: the middle leg typically has 2 contracts (sell 2x)."
      );
    }

    // FIC: Strikes should be equidistant
    const lowerWidth = middleLeg.strike - lowerLeg.strike;
    const upperWidth = upperLeg.strike - middleLeg.strike;

    if (Math.abs(lowerWidth - upperWidth) > 0.01) {
      advertencias.push(
        `Butterfly Spread: los strikes no son equidistantes (inferior: ${lowerWidth}, superior: ${upperWidth}). ` +
        `Butterfly Spread: strikes are not equidistant (lower: ${lowerWidth}, upper: ${upperWidth}).`
      );
    }

    // FIC: Warn if there's significant IV skew
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
   * FIC: Calculate full profile for a Butterfly Spread strategy.
   * FIC: Calcula perfil completo para una estrategia Butterfly Spread.
   */
  calculateProfile(config: ComplexStrategyConfig): StrategyProfile {
    const validation = this.validateConfig(config);
    if (!validation.valido) {
      throw new Error(
        `ButterflySpreadEngine: configuracion invalida. Invalid configuration.\n${validation.errores.join("\n")}`
      );
    }

    // FIC: Sort legs by strike
    const sorted = [...config.legs].sort((a, b) => a.strike - b.strike);
    const butterflyType: ButterflyType = sorted[0].tipo as ButterflyType;

    const lowerStrike = sorted[0].strike;
    const middleStrike = sorted[1].strike;
    const upperStrike = sorted[2].strike;

    // FIC: Generate price range
    const priceRange = generatePriceRange(config.legs, 0.3);

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

    // FIC: Calculate optimal profit window
    const optimalWindow = this.calculateOptimalWindow(
      lowerStrike,
      middleStrike,
      upperStrike,
      butterflyType
    );

    // FIC: Temporal payoff
    const payoffTemporal = this.generateTemporalPayoff(
      config.legs,
      priceRange.min,
      priceRange.max,
      config.dias_vencimiento ?? 45
    );

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
   * FIC: Calculate the optimal profit window for the butterfly.
   * For a butterfly, max profit occurs when underlying is at the middle strike at expiration.
   *
   * FIC: Calcula la ventana óptima de beneficio para el butterfly.
   * Para un butterfly, el máximo beneficio ocurre cuando el subyacente está en el strike medio al vencimiento.
   */
  private calculateOptimalWindow(
    lowerStrike: number,
    middleStrike: number,
    upperStrike: number,
    butterflyType: ButterflyType
  ): string {
    const widthUp = upperStrike - middleStrike;
    const widthDown = middleStrike - lowerStrike;

    if (butterflyType === "call") {
      return `Max profit when underlying <= ${middleStrike} at expiration. ` +
             `Declines linearly to zero at ${upperStrike}. ` +
             `Máximo beneficio cuando subyacente <= ${middleStrike} al vencimiento.`;
    } else {
      return `Max profit when underlying >= ${middleStrike} at expiration. ` +
             `Declines linearly to zero at ${lowerStrike}. ` +
             `Máximo beneficio cuando subyacente >= ${middleStrike} al vencimiento.`;
    }
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
    const timePoints = [daysToExpiration, Math.floor(daysToExpiration * 0.66), Math.floor(daysToExpiration * 0.33)];
    const result: Array<{ precio_subyacente: number; pnl: number; dias_restantes: number }> = [];
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

          const extrinsicValue = thetaFactor * leg.prima;
          const adjustedPremium = leg.posicion === "long" ? -(leg.prima - extrinsicValue) : (leg.prima - extrinsicValue);

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
 * FIC: Factory function to create a ButterflySpreadEngine instance.
 * FIC: Función de fábrica para crear una instancia de ButterflySpreadEngine.
 */
export function createButterflySpreadEngine(): ButterflySpreadEngine {
  return new ButterflySpreadEngine();
}

export default ButterflySpreadEngine;
