/**
 * FIC: Complex Strategy Contract - Base contract for all complex options strategies.
 * Defines shared types, interfaces, and validation for Iron Condor, Iron Butterfly,
 * Butterfly Spread, and Condor engines.
 *
 * FIC: Contrato de Estrategias Complejas - Contrato base para todas las estrategias complejas de opciones.
 * Define tipos, interfaces y validación compartidos para los motores de Iron Condor, Iron Butterfly,
 * Butterfly Spread y Condor.
 */

// ──────────────────────────────────────────────
// FIC: Basic option types / Tipos básicos de opciones
// ──────────────────────────────────────────────

/**
 * FIC: Option style (American allows early exercise; European does not).
 * FIC: Estilo de opción (Americana permite ejercicio anticipado; Europea no).
 */
export type OptionStyle = "europea" | "americana";

/**
 * FIC: Option type (call or put).
 * FIC: Tipo de opción (call o put).
 */
export type OptionType = "call" | "put";

/**
 * FIC: Leg position (long = bought, short = sold).
 * FIC: Posición de la pata (long = comprada, short = vendida).
 */
export type LegPosition = "long" | "short";

/**
 * FIC: Wing type for complex strategies.
 * - short: standard equidistant wings
 * - wide: wider wings for higher probability of profit
 * - broken: asymmetric wings (one side wider than the other)
 *
 * FIC: Tipo de ala para estrategias complejas.
 * - short: alas equidistantes estándar
 * - wide: alas más anchas para mayor probabilidad de ganancia
 * - broken: alas asimétricas (un lado más ancho que el otro)
 */
export type WingType = "short" | "wide" | "broken";

/**
 * FIC: Risk tolerance level.
 * FIC: Nivel de tolerancia al riesgo.
 */
export type RiskTolerance = "bajo" | "medio" | "alto";

// ──────────────────────────────────────────────
// FIC: Core data structures / Estructuras de datos core
// ──────────────────────────────────────────────

/**
 * FIC: Represents a single option leg in a complex strategy.
 * FIC: Representa una pata de opción individual en una estrategia compleja.
 */
export interface OptionLeg {
  /** FIC: Strike price / Precio de ejercicio */
  strike: number;

  /** FIC: Option type (call/put) / Tipo de opción (call/put) */
  tipo: OptionType;

  /** FIC: Position (long/short) / Posición (long/short) */
  posicion: LegPosition;

  /** FIC: Premium paid (long) or received (short) per share / Prima pagada (long) o recibida (short) por acción */
  prima: number;

  /** FIC: Number of contracts / Número de contratos */
  contratos: number;

  /** FIC: Bid price (market data) / Precio bid (dato de mercado) */
  bid?: number;

  /** FIC: Ask price (market data) / Precio ask (dato de mercado) */
  ask?: number;

  /** FIC: Underlying price at calculation time / Precio del subyacente al momento del cálculo */
  subyacente_precio?: number;

  /** FIC: Implied volatility for this leg / Volatilidad implícita para esta pata */
  volatilidad_implicita?: number;

  /** FIC: Option contract symbol from Alpaca (e.g., SPY260526C00540000) / Símbolo del contrato de opción desde Alpaca */
  symbol?: string;
}

/**
 * FIC: Configuration for a complex strategy, passed to engine constructors.
 * FIC: Configuración para una estrategia compleja, pasada a los constructores del motor.
 */
export interface ComplexStrategyConfig {
  /** FIC: Ticker symbol / Símbolo del ticker */
  ticker: string;

  /** FIC: Expiration date (ISO 8601) / Fecha de vencimiento (ISO 8601) */
  expiracion: string;

  /** FIC: Option legs of the strategy / Patas de opción de la estrategia */
  legs: OptionLeg[];

  /** FIC: Wing type configuration / Configuración de tipo de ala */
  tipo_ala: WingType;

  /** FIC: Risk tolerance for this strategy / Tolerancia al riesgo para esta estrategia */
  tolerancia_riesgo: RiskTolerance;

  /** FIC: Option style / Estilo de opción */
  estilo_opcion: OptionStyle;

  /** FIC: Version for optimistic locking / Versión para optimistic locking */
  version: number;

  /** FIC: Unique identifier for this configuration / Identificador único para esta configuración */
  id?: string;

  /** FIC: Trace ID for correlated logging / ID de rastreo para logging correlacionado */
  trace_id?: string;

  /** FIC: Days to expiration at calculation time / Días hasta el vencimiento al momento del cálculo */
  dias_vencimiento?: number;

  /** FIC: User-defined label for this strategy / Etiqueta definida por el usuario para esta estrategia */
  etiqueta?: string;
}

/**
 * FIC: Calculated payoff point for a strategy profile.
 * FIC: Punto de payoff calculado para un perfil de estrategia.
 */
export interface PayoffPoint {
  /** FIC: Underlying price at this point / Precio del subyacente en este punto */
  precio_subyacente: number;

  /** FIC: Profit/Loss at this point / Ganancia/Pérdida en este punto */
  pnl: number;

  /** FIC: Days to expiration for temporal payoff curves / Días hasta vencimiento para curvas temporales */
  dias_restantes?: number;
}

/**
 * FIC: Complete profile result for a complex strategy.
 * FIC: Resultado de perfil completo para una estrategia compleja.
 */
export interface StrategyProfile {
  /** FIC: Net credit (positive) or net debit (negative) of the strategy / Crédito neto (positivo) o débito neto (negativo) de la estrategia */
  credito_neto: number;

  /** FIC: Whether this is a credit or debit strategy / Si es una estrategia de crédito o débito */
  tipo_neto: "credito" | "debito";

  /** FIC: Break-even point(s) of the strategy / Punto(s) de equilibrio de la estrategia */
  break_even_points: number[];

  /** FIC: Maximum possible loss / Pérdida máxima posible */
  perdida_maxima: number;

  /** FIC: Maximum possible gain / Ganancia máxima posible */
  ganancia_maxima: number;

  /** FIC: Payoff curve over underlying price range / Curva de payoff sobre rango de precios del subyacente */
  payoff_curve: PayoffPoint[];

  /** FIC: Payoff at expiration (T=0) / Payoff al vencimiento (T=0) */
  payoff_vencimiento: PayoffPoint[];

  /** FIC: Temporal payoff curves (T-30, T-15, T-7) / Curvas temporales de payoff (T-30, T-15, T-7) */
  payoff_temporal?: PayoffPoint[];

  /** FIC: Greeks summary / Resumen de griegas */
  griegas?: GreeksSummary;

  /** FIC: Probability of profit (estimated) / Probabilidad de ganancia (estimada) */
  probabilidad_ganancia?: number;

  /** FIC: Risk/reward ratio / Ratio riesgo/beneficio */
  ratio_riesgo_beneficio?: number;
}

/**
 * FIC: Greeks summary for a strategy.
 * FIC: Resumen de griegas para una estrategia.
 */
export interface GreeksSummary {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho?: number;
}

// ──────────────────────────────────────────────
// FIC: Engine interface / Interfaz del motor
// ──────────────────────────────────────────────

/**
 * FIC: Interface that all complex strategy engines must implement.
 * FIC: Interfaz que todos los motores de estrategias complejas deben implementar.
 */
export interface IComplexStrategyEngine {
  /**
   * FIC: Calculate the full profile for this strategy.
   * FIC: Calcula el perfil completo para esta estrategia.
   */
  calculateProfile(config: ComplexStrategyConfig): StrategyProfile;

  /**
   * FIC: Validate that the configuration is valid for this strategy type.
   * FIC: Valida que la configuración sea válida para este tipo de estrategia.
   */
  validateConfig(config: ComplexStrategyConfig): StrategyValidationResult;
}

/**
 * FIC: Result of configuration validation.
 * FIC: Resultado de la validación de configuración.
 */
export interface StrategyValidationResult {
  /** FIC: Whether the configuration is valid / Si la configuración es válida */
  valido: boolean;

  /** FIC: Error messages if invalid / Mensajes de error si no es válida */
  errores: string[];

  /** FIC: Warnings that don't block calculation / Advertencias que no bloquean el cálculo */
  advertencias: string[];
}

// ──────────────────────────────────────────────
// FIC: Validation helpers / Helpers de validación
// ──────────────────────────────────────────────

/**
 * FIC: Validates common strategy configuration fields.
 * FIC: Valida campos comunes de configuración de estrategias.
 */
export function validateCommonConfig(config: ComplexStrategyConfig): StrategyValidationResult {
  const errores: string[] = [];
  const advertencias: string[] = [];

  if (!config.ticker || config.ticker.trim().length === 0) {
    errores.push("Ticker es requerido. Ticker is required.");
  }

  if (!config.expiracion || config.expiracion.trim().length === 0) {
    errores.push("Fecha de expiracion es requerida. Expiration date is required.");
  } else {
    const expDate = new Date(config.expiracion);
    if (isNaN(expDate.getTime())) {
      errores.push("Fecha de expiracion invalida. Invalid expiration date.");
    }
  }

  if (!config.legs || config.legs.length < 2) {
    errores.push("Se requieren al menos 2 patas. At least 2 legs are required.");
  }

  if (config.version < 0) {
    errores.push("Version debe ser >= 0. Version must be >= 0.");
  }

  // FIC: Validate each leg
  if (config.legs) {
    for (let i = 0; i < config.legs.length; i++) {
      const leg = config.legs[i];

      if (leg.strike <= 0) {
        errores.push(`Pata ${i + 1}: strike debe ser > 0. Leg ${i + 1}: strike must be > 0.`);
      }

      if (leg.prima < 0) {
        errores.push(`Pata ${i + 1}: prima no puede ser negativa. Leg ${i + 1}: premium cannot be negative.`);
      }

      if (leg.contratos <= 0) {
        errores.push(`Pata ${i + 1}: contratos debe ser > 0. Leg ${i + 1}: contracts must be > 0.`);
      }

      if (!["call", "put"].includes(leg.tipo)) {
        errores.push(`Pata ${i + 1}: tipo debe ser 'call' o 'put'. Leg ${i + 1}: type must be 'call' or 'put'.`);
      }

      if (!["long", "short"].includes(leg.posicion)) {
        errores.push(`Pata ${i + 1}: posicion debe ser 'long' o 'short'. Leg ${i + 1}: position must be 'long' or 'short'.`);
      }
    }
  }

  // FIC: Check for early assignment risk with American options
  if (config.estilo_opcion === "americana") {
    const hasShortITM = config.legs.some(
      (leg) => leg.posicion === "short" && leg.subyacente_precio !== undefined && (
        (leg.tipo === "call" && leg.subyacente_precio > leg.strike) ||
        (leg.tipo === "put" && leg.subyacente_precio < leg.strike)
      )
    );
    if (hasShortITM) {
      advertencias.push(
        "Estrategia con opciones americanas ITM en posicion short: riesgo de asignacion temprana. " +
        "Strategy with ITM American options in short position: early assignment risk."
      );
    }
  }

  // FIC: Check for unrealistic premium
  for (let i = 0; i < config.legs.length; i++) {
    const leg = config.legs[i];
    if (leg.prima > 0 && leg.strike > 0 && leg.prima / leg.strike > 0.5) {
      advertencias.push(
        `Pata ${i + 1}: prima (${leg.prima}) es > 50% del strike (${leg.strike}). Verificar datos. ` +
        `Leg ${i + 1}: premium (${leg.prima}) is > 50% of strike (${leg.strike}). Verify data.`
      );
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  };
}

// ──────────────────────────────────────────────
// FIC: Shared calculation utilities / Utilidades de cálculo compartidas
// ──────────────────────────────────────────────

/**
 * FIC: Calculate payoff for a single leg at a given underlying price.
 * Positive = profit, Negative = loss.
 *
 * FIC: Calcula el payoff para una pata individual a un precio subyacente dado.
 * Positivo = ganancia, Negativo = pérdida.
 */
export function calculateLegPayoff(leg: OptionLeg, subyacente_precio: number): number {
  let intrinsicValue: number;

  if (leg.tipo === "call") {
    intrinsicValue = Math.max(0, subyacente_precio - leg.strike);
  } else {
    intrinsicValue = Math.max(0, leg.strike - subyacente_precio);
  }

  const multiplier = leg.posicion === "long" ? 1 : -1;
  const premiumCost = leg.posicion === "long" ? -leg.prima : leg.prima;

  return (intrinsicValue * multiplier + premiumCost) * leg.contratos * 100;
}

/**
 * FIC: Generate an array of payoff points over a price range.
 * FIC: Genera un array de puntos de payoff sobre un rango de precios.
 */
export function generatePayoffCurve(
  legs: OptionLeg[],
  minPrice: number,
  maxPrice: number,
  steps: number = 100
): PayoffPoint[] {
  const stepSize = (maxPrice - minPrice) / steps;
  const curve: PayoffPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const price = minPrice + i * stepSize;
    const totalPnl = legs.reduce((sum, leg) => sum + calculateLegPayoff(leg, price), 0);

    curve.push({
      precio_subyacente: Math.round(price * 100) / 100,
      pnl: Math.round(totalPnl * 100) / 100,
    });
  }

  return curve;
}

/**
 * FIC: Find break-even points from a payoff curve (where P&L crosses zero).
 * FIC: Encuentra puntos de equilibrio de una curva de payoff (donde P&L cruza cero).
 */
export function findBreakEvens(payoffCurve: PayoffPoint[]): number[] {
  const breakEvens: number[] = [];

  for (let i = 1; i < payoffCurve.length; i++) {
    const prev = payoffCurve[i - 1];
    const curr = payoffCurve[i];

    // FIC: Check if P&L crosses zero between these two points
    if ((prev.pnl <= 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl <= 0)) {
      // FIC: Linear interpolation to find exact zero-crossing
      const denom = Math.abs(prev.pnl) + Math.abs(curr.pnl);
      if (denom === 0) continue;
      const fraction = Math.abs(prev.pnl) / denom;
      const bePrice = prev.precio_subyacente + fraction * (curr.precio_subyacente - prev.precio_subyacente);
      breakEvens.push(Math.round(bePrice * 100) / 100);
    }
  }

  return breakEvens;
}

/**
 * FIC: Calculate net credit/debit for a set of legs.
 * Positive = net credit (money received), Negative = net debit (money paid).
 *
 * FIC: Calcula crédito/débito neto para un conjunto de patas.
 * Positivo = crédito neto (dinero recibido), Negativo = débito neto (dinero pagado).
 */
export function calculateNetCredit(legs: OptionLeg[]): { credito_neto: number; tipo_neto: "credito" | "debito" } {
  const net = legs.reduce((sum, leg) => {
    const sign = leg.posicion === "short" ? 1 : -1;
    return sum + sign * leg.prima * leg.contratos * 100;
  }, 0);

  return {
    credito_neto: Math.round(net * 100) / 100,
    tipo_neto: net >= 0 ? "credito" : "debito",
  };
}

/**
 * FIC: Calculate max possible loss from payoff curve.
 * FIC: Calcula la pérdida máxima posible desde la curva de payoff.
 */
export function calculateMaxLoss(payoffCurve: PayoffPoint[]): number {
  let minPnl = 0;
  for (const point of payoffCurve) {
    if (point.pnl < minPnl) {
      minPnl = point.pnl;
    }
  }
  return Math.abs(minPnl);
}

/**
 * FIC: Calculate max possible gain from payoff curve.
 * FIC: Calcula la ganancia máxima posible desde la curva de payoff.
 */
export function calculateMaxGain(payoffCurve: PayoffPoint[]): number {
  let maxPnl = 0;
  for (const point of payoffCurve) {
    if (point.pnl > maxPnl) {
      maxPnl = point.pnl;
    }
  }
  return maxPnl;
}

/**
 * FIC: Generate a price range centered around the strategy's strikes.
 * FIC: Genera un rango de precios centrado alrededor de los strikes de la estrategia.
 */
export function generatePriceRange(legs: OptionLeg[], marginPercent: number = 0.3): { min: number; max: number } {
  const strikes = legs.map((leg) => leg.strike);
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  const range = maxStrike - minStrike;

  const buffer = range * marginPercent || minStrike * marginPercent;

  return {
    min: Math.max(0, Math.floor((minStrike - buffer) * 100) / 100),
    max: Math.ceil((maxStrike + buffer) * 100) / 100,
  };
}

/**
 * FIC: Calculate the width between two strikes.
 * FIC: Calcula la anchura entre dos strikes.
 */
export function calculateWingWidth(lowerStrike: number, upperStrike: number): number {
  return Math.abs(upperStrike - lowerStrike);
}

export default IComplexStrategyEngine;
