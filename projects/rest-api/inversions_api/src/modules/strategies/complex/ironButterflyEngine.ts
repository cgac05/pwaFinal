/**
 * FIC: Iron Butterfly Engine - Calculates profiles for Iron Butterfly strategies.
 * An Iron Butterfly involves 4 legs: buy OTM put, sell ATM put, sell ATM call, buy OTM call.
 * Profits from low volatility around the middle strike (body).
 *
 * FIC: Motor de Iron Butterfly - Calcula perfiles para estrategias Iron Butterfly.
 * Un Iron Butterfly involucra 4 patas: comprar put OTM, vender put ATM, vender call ATM, comprar call OTM.
 * Gana con baja volatilidad alrededor del strike medio (cuerpo).
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
// FIC: Engine implementation / Implementación del motor
// ──────────────────────────────────────────────

/**
 * FIC: Iron Butterfly Engine - validates config and calculates full strategy profile.
 * Supports short (standard) and broken wing variants.
 *
 * FIC: Motor de Iron Butterfly - valida configuración y calcula perfil completo de estrategia.
 * Soporta variantes short (estándar) y broken wing.
 */
export class IronButterflyEngine implements IComplexStrategyEngine {
  /**
   * FIC: Validate that the configuration is a valid Iron Butterfly.
   * Requirements:
   * - Exactly 4 legs
   * - Short: 1 long put (OTM), 1 short put (ATM), 1 short call (ATM), 1 long call (OTM)
   * - ATM strikes must be the same (body)
   * - Broken wing: one wing is wider (asymmetric)
   *
   * FIC: Valida que la configuración sea un Iron Butterfly válido.
   * Requisitos:
   * - Exactamente 4 patas
   * - Short: 1 put largo (OTM), 1 put corto (ATM), 1 call corto (ATM), 1 call largo (OTM)
   * - Los strikes ATM deben ser el mismo (cuerpo)
   * - Broken wing: un ala es más ancha (asimétrica)
   */
  validateConfig(config: ComplexStrategyConfig): StrategyValidationResult {
    const base = validateCommonConfig(config);
    const errores = [...base.errores];
    const advertencias = [...base.advertencias];

    if (config.legs.length !== 4) {
      errores.push(
        "Iron Butterfly requiere exactamente 4 patas (2 puts + 2 calls). " +
        "Iron Butterfly requires exactly 4 legs (2 puts + 2 calls)."
      );
      return { valido: false, errores, advertencias };
    }

    // FIC: Verify leg structure: 2 puts + 2 calls
    const puts = config.legs.filter((leg) => leg.tipo === "put").sort((a, b) => a.strike - b.strike);
    const calls = config.legs.filter((leg) => leg.tipo === "call").sort((a, b) => a.strike - b.strike);

    if (puts.length !== 2) {
      errores.push(
        "Iron Butterfly requiere exactamente 2 patas put. Iron Butterfly requires exactly 2 put legs."
      );
    }
    if (calls.length !== 2) {
      errores.push(
        "Iron Butterfly requiere exactamente 2 patas call. Iron Butterfly requires exactly 2 call legs."
      );
    }

    if (errores.length > 0) {
      return { valido: false, errores, advertencias };
    }

    // FIC: For Iron Butterfly: long put (lowest), short put & short call (ATM = same strike), long call (highest)
    const longPut = puts[0]; // OTM put (lowest strike)
    const shortPut = puts[1]; // ATM put (higher strike, should equal short call strike)
    const shortCall = calls[0]; // ATM call (lower strike, should equal short put strike)
    const longCall = calls[1]; // OTM call (highest strike)

    if (longPut.posicion !== "long") {
      errores.push(
        "Iron Butterfly: la pata put de strike inferior debe ser long (compra). " +
        "Iron Butterfly: the lower strike put leg must be long."
      );
    }
    if (shortPut.posicion !== "short") {
      errores.push(
        "Iron Butterfly: la pata put de strike superior debe ser short (venta). " +
        "Iron Butterfly: the higher strike put leg must be short."
      );
    }
    if (shortCall.posicion !== "short") {
      errores.push(
        "Iron Butterfly: la pata call de strike inferior debe ser short (venta). " +
        "Iron Butterfly: the lower strike call leg must be short."
      );
    }
    if (longCall.posicion !== "long") {
      errores.push(
        "Iron Butterfly: la pata call de strike superior debe ser long (compra). " +
        "Iron Butterfly: the higher strike call leg must be long."
      );
    }

    // FIC: The body strikes must match (short put and short call at same strike)
    if (shortPut.strike !== shortCall.strike) {
      errores.push(
        `Iron Butterfly: los strikes del cuerpo deben coincidir (put short en ${shortPut.strike}, call short en ${shortCall.strike}). ` +
        `Iron Butterfly: body strikes must match (short put at ${shortPut.strike}, short call at ${shortCall.strike}).`
      );
    }

    // FIC: Check wing symmetry for broken wing variant
    if (config.tipo_ala === "broken") {
      const putWingWidth = shortPut.strike - longPut.strike;
      const callWingWidth = longCall.strike - shortCall.strike;

      if (Math.abs(putWingWidth - callWingWidth) < 0.01) {
        advertencias.push(
          "Broken wing Iron Butterfly: las alas deberian ser asimetricas (una mas ancha que la otra). " +
          "Broken wing Iron Butterfly: wings should be asymmetric (one wider than the other)."
        );
      }

      // FIC: Broken wing typically has a wider put side (bearish) or wider call side (bullish)
      if (putWingWidth > callWingWidth) {
        advertencias.push(
          "Broken wing Iron Butterfly: ala put mas ancha — sesgo bajista. " +
          "Broken wing Iron Butterfly: wider put wing — bearish bias."
        );
      } else {
        advertencias.push(
          "Broken wing Iron Butterfly: ala call mas ancha — sesgo alcista. " +
          "Broken wing Iron Butterfly: wider call wing — bullish bias."
        );
      }
    } else {
      // FIC: Standard short butterfly: wings should be symmetric
      const putWingWidth = shortPut.strike - longPut.strike;
      const callWingWidth = longCall.strike - shortCall.strike;

      if (Math.abs(putWingWidth - callWingWidth) > 0.01) {
        advertencias.push(
          `Short Iron Butterfly: las alas no son simetricas (put: ${putWingWidth}, call: ${callWingWidth}). ` +
          `Short Iron Butterfly: wings are not symmetric (put: ${putWingWidth}, call: ${callWingWidth}).`
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
   * FIC: Calculate full profile for an Iron Butterfly strategy.
   * FIC: Calcula perfil completo para una estrategia Iron Butterfly.
   */
  calculateProfile(config: ComplexStrategyConfig): StrategyProfile {
    const validation = this.validateConfig(config);
    if (!validation.valido) {
      throw new Error(
        `IronButterflyEngine: configuracion invalida. Invalid configuration.\n${validation.errores.join("\n")}`
      );
    }

    // FIC: Sort legs
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

    const bodyStrike = shortPut.strike; // FIC: Center / Centro

    // FIC: Generate price range
    const priceRange = generatePriceRange(config.legs, 0.4);

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

    // FIC: Generate sensitivity to underlying drift
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
 * FIC: Factory function to create an IronButterflyEngine instance.
 * FIC: Función de fábrica para crear una instancia de IronButterflyEngine.
 */
export function createIronButterflyEngine(): IronButterflyEngine {
  return new IronButterflyEngine();
}

export default IronButterflyEngine;
