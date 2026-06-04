/**
 * FIC: Iron Condor Engine - Calculates profiles for Iron Condor strategies.
 * An Iron Condor involves 4 legs: sell OTM put, buy OTM put (lower),
 * sell OTM call, buy OTM call (upper). Profits from low volatility / range-bound movement.
 *
 * FIC: Motor de Iron Condor - Calcula perfiles para estrategias Iron Condor.
 * Un Iron Condor involucra 4 patas: vender put OTM, comprar put OTM (inferior),
 * vender call OTM, comprar call OTM (superior). Gana con baja volatilidad / movimiento lateral.
 */

import type {
  ComplexStrategyConfig,
  IComplexStrategyEngine,
  OptionLeg,
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
  calculateWingWidth,
} from "./complexStrategyContract";

// ──────────────────────────────────────────────
// FIC: Iron Condor Configuration / Configuración de Iron Condor
// ──────────────────────────────────────────────

/**
 * FIC: Additional configuration specific to Iron Condor.
 * FIC: Configuración adicional específica de Iron Condor.
 */
export interface IronCondorConfig extends ComplexStrategyConfig {
  /**
   * FIC: Delta target for the short strikes (e.g., 0.30 = 30 delta).
   * Used for delta-equilibrated condor construction.
   * FIC: Delta objetivo para los strikes cortos (ej: 0.30 = delta 30).
   * Usado para construcción de condor delta-equilibrado.
   */
  delta_objetivo?: number;
}

// ──────────────────────────────────────────────
// FIC: Engine implementation / Implementación del motor
// ──────────────────────────────────────────────

/**
 * FIC: Iron Condor Engine - validates config and calculates full strategy profile.
 * FIC: Motor de Iron Condor - valida configuración y calcula perfil completo de estrategia.
 */
export class IronCondorEngine implements IComplexStrategyEngine {
  /**
   * FIC: Validate that the configuration is a valid Iron Condor.
   * Requirements:
   * - Exactly 4 legs
   * - Legs ordered: short put, long put, short call, long call (by strike ascending)
   * - Puts and calls grouped appropriately
   *
   * FIC: Valida que la configuración sea un Iron Condor válido.
   * Requisitos:
   * - Exactamente 4 patas
   * - Patas ordenadas: put corto, put largo, call corto, call largo (por strike ascendente)
   * - Puts y calls agrupados apropiadamente
   */
  validateConfig(config: ComplexStrategyConfig): StrategyValidationResult {
    const base = validateCommonConfig(config);
    const errores = [...base.errores];
    const advertencias = [...base.advertencias];

    if (config.legs.length !== 4) {
      errores.push(
        "Iron Condor requiere exactamente 4 patas (2 puts + 2 calls). " +
        "Iron Condor requires exactly 4 legs (2 puts + 2 calls)."
      );
      return { valido: false, errores, advertencias };
    }

    // FIC: Verify leg structure: should be 2 puts + 2 calls
    const puts = config.legs.filter((leg) => leg.tipo === "put");
    const calls = config.legs.filter((leg) => leg.tipo === "call");

    if (puts.length !== 2) {
      errores.push(
        "Iron Condor requiere exactamente 2 patas put. Iron Condor requires exactly 2 put legs."
      );
    }
    if (calls.length !== 2) {
      errores.push(
        "Iron Condor requiere exactamente 2 patas call. Iron Condor requires exactly 2 call legs."
      );
    }

    if (errores.length > 0) {
      return { valido: false, errores, advertencias };
    }

    // FIC: Sort puts by strike ascending, calls by strike ascending
    const sortedPuts = [...puts].sort((a, b) => a.strike - b.strike);
    const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

    // FIC: For short condor: long put strike < short put strike < short call strike < long call strike
    const shortPut = sortedPuts[1]; // Higher strike put is short
    const longPut = sortedPuts[0]; // Lower strike put is long
    const shortCall = sortedCalls[0]; // Lower strike call is short
    const longCall = sortedCalls[1]; // Higher strike call is long

    if (longPut.posicion !== "long" || shortPut.posicion !== "short") {
      errores.push(
        "Iron Condor put legs: la pata de strike inferior debe ser long y la de strike superior short. " +
        "Iron Condor put legs: lower strike must be long and higher strike must be short."
      );
    }
    if (shortCall.posicion !== "short" || longCall.posicion !== "long") {
      errores.push(
        "Iron Condor call legs: la pata de strike inferior debe ser short y la de strike superior long. " +
        "Iron Condor call legs: lower strike must be short and higher strike must be long."
      );
    }

    // FIC: For wide condor, check that wing widths are appropriate
    if (config.tipo_ala === "wide") {
      const putWidth = calculateWingWidth(longPut.strike, shortPut.strike);
      const callWidth = calculateWingWidth(shortCall.strike, longCall.strike);

      if (putWidth <= 0 || callWidth <= 0) {
        advertencias.push(
          "Wide Iron Condor: las alas deben tener anchura positiva. Wide Iron Condor: wings must have positive width."
        );
      }

      // FIC: Wide wings should be notably wider than short wings
      if (putWidth < callWidth * 1.5 && callWidth < putWidth * 1.5) {
        advertencias.push(
          "Wide Iron Condor: las alas wide deberian ser significativamente mas anchas. " +
          "Wide Iron Condor: wide wings should be significantly wider."
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
   * FIC: Calculate full profile for an Iron Condor strategy.
   * FIC: Calcula perfil completo para una estrategia Iron Condor.
   */
  calculateProfile(config: ComplexStrategyConfig): StrategyProfile {
    const validation = this.validateConfig(config);
    if (!validation.valido) {
      throw new Error(
        `IronCondorEngine: configuracion invalida. Invalid configuration.\n${validation.errores.join("\n")}`
      );
    }

    // FIC: Sort legs for calculation
    const puts = config.legs
      .filter((leg) => leg.tipo === "put")
      .sort((a, b) => a.strike - b.strike);
    const calls = config.legs
      .filter((leg) => leg.tipo === "call")
      .sort((a, b) => a.strike - b.strike);

    const longPut = puts[0];
    const shortPut = puts[1];
    const shortCall = calls[0];
    const longCall = calls[1];

    // FIC: Generate price range for payoff curve
    const priceRange = generatePriceRange(config.legs, 0.4);

    // FIC: Calculate payoff curve at expiration
    const payoffExpiration = generatePayoffCurve(
      config.legs,
      priceRange.min,
      priceRange.max,
      150
    );

    // FIC: Calculate net credit/debit
    const { credito_neto, tipo_neto } = calculateNetCredit(config.legs);

    // FIC: Calculate break-even points
    const breakEvens = findBreakEvens(payoffExpiration);

    // FIC: Calculate max loss and max gain
    const perdida_maxima = calculateMaxLoss(payoffExpiration);
    const ganancia_maxima = calculateMaxGain(payoffExpiration);

    // FIC: Calculate risk/reward ratio
    const ratio_riesgo_beneficio =
      perdida_maxima > 0
        ? Math.round((ganancia_maxima / perdida_maxima) * 100) / 100
        : 0;

    // FIC: Generate temporal payoff curves (T-30, T-15, T-7) for theta decay
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
   * FIC: Generate temporal payoff curves at different DTE (days to expiration).
   * FIC: Genera curvas de payoff temporales a diferentes DTE (días hasta vencimiento).
   */
  private generateTemporalPayoff(
    legs: OptionLeg[],
    minPrice: number,
    maxPrice: number,
    daysToExpiration: number
  ): Array<{ precio_subyacente: number; pnl: number; dias_restantes: number }> {
    const timePoints = [daysToExpiration, Math.floor(daysToExpiration * 0.66), Math.floor(daysToExpiration * 0.33)];

    const result: Array<{ precio_subyacente: number; pnl: number; dias_restantes: number }> = [];

    for (const dte of timePoints) {
      // FIC: Simplified theta-adjusted payoff (approximation)
      // Actual theta calculation would require option pricing model (Black-Scholes)
      const thetaFactor = dte / daysToExpiration;

      // FIC: Generate curve with theta adjustment - time decay reduces
      // extrinsic value linearly (simplified)
      for (let price = minPrice; price <= maxPrice; price += (maxPrice - minPrice) / 50) {
        const roundedPrice = Math.round(price * 100) / 100;
        let totalPnl = 0;

        for (const leg of legs) {
          const intrinsicValue =
            leg.tipo === "call"
              ? Math.max(0, roundedPrice - leg.strike)
              : Math.max(0, leg.strike - roundedPrice);

          // FIC: Extrinsic value decays with time
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
 * FIC: Factory function to create an IronCondorEngine instance.
 * FIC: Función de fábrica para crear una instancia de IronCondorEngine.
 */
export function createIronCondorEngine(): IronCondorEngine {
  return new IronCondorEngine();
}

export default IronCondorEngine;
