/**
 * FIC: Complex Simulation Engine - Monte Carlo, deterministic scenarios, and backtesting
 * for complex options strategies. Self-contained without external API dependencies.
 *
 * FIC: Motor de Simulación Compleja - Monte Carlo, escenarios determinísticos y backtesting
 * para estrategias complejas de opciones. Autónomo sin dependencias de APIs externas.
 */

import type { ComplexStrategyConfig, OptionLeg, PayoffPoint, StrategyProfile } from "./complexStrategyContract";
import { calculateLegPayoff, generatePriceRange } from "./complexStrategyContract";

// ──────────────────────────────────────────────
// FIC: Types / Tipos
// ──────────────────────────────────────────────

/**
 * FIC: Simulation type.
 * FIC: Tipo de simulación.
 */
export type SimulationType = "monte_carlo" | "deterministico" | "backtesting";

/**
 * FIC: Cost model configuration for realistic P&L.
 * FIC: Configuración de modelo de costos para P&L realista.
 */
export interface CostModel {
  /** FIC: Slippage as percentage (e.g., 0.001 = 0.1%) / Slippage como porcentaje */
  slippage: number;
  /** FIC: Commission per contract / Comisión por contrato */
  comision_por_contrato: number;
  /** FIC: Base commission per order / Comisión base por orden */
  comision_base: number;
  /** FIC: Bid-ask spread as percentage (e.g., 0.02 = 2%) / Spread bid-ask como porcentaje */
  spread: number;
}

/**
 * FIC: Simulation configuration parameters.
 * FIC: Parámetros de configuración de simulación.
 */
export interface SimulationConfig {
  /** FIC: Type of simulation / Tipo de simulación */
  tipo: SimulationType;
  /** FIC: Number of Monte Carlo iterations (1K-100K) / Iteraciones de Monte Carlo */
  iteraciones: number;
  /** FIC: Random seed for reproducibility / Semilla aleatoria para reproducibilidad */
  semilla: number;
  /** FIC: Price shock percentage (e.g., 0.2 = ±20%) / Porcentaje de shock de precio */
  shock_precio: number;
  /** FIC: IV shock percentage (e.g., 0.1 = ±10%) / Porcentaje de shock de IV */
  shock_iv: number;
  /** FIC: Confidence interval (e.g., 0.95 = 95%) / Intervalo de confianza */
  intervalo_confianza: number;
  /** FIC: Cost model / Modelo de costos */
  costos: CostModel;
  /** FIC: Historical data points for backtesting (price, date) / Datos históricos para backtesting */
  datos_historicos?: Array<{ precio: number; fecha: string; volatilidad?: number }>;
}

/**
 * FIC: Default cost model for simulation.
 * FIC: Modelo de costos por defecto para simulación.
 */
export const DEFAULT_COST_MODEL: CostModel = {
  slippage: 0.001,
  comision_por_contrato: 0.65,
  comision_base: 1.0,
  spread: 0.02,
};

/**
 * FIC: Default simulation configuration.
 * FIC: Configuración de simulación por defecto.
 */
export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  tipo: "monte_carlo",
  iteraciones: 10000,
  semilla: 42,
  shock_precio: 0.2,
  shock_iv: 0.1,
  intervalo_confianza: 0.95,
  costos: DEFAULT_COST_MODEL,
};

/**
 * FIC: Simulation result.
 * FIC: Resultado de simulación.
 */
export interface SimulationResult {
  /** FIC: Type of simulation executed / Tipo de simulación ejecutada */
  tipo: SimulationType;
  /** FIC: Total number of iterations / Número total de iteraciones */
  total_iteraciones: number;
  /** FIC: Seed used / Semilla utilizada */
  semilla: number;
  /** FIC: Execution time in milliseconds / Tiempo de ejecución en milisegundos */
  tiempo_ms: number;

  // FIC: P&L distribution / Distribución de P&L
  distribucion_pnl: {
    media: number;
    mediana: number;
    desviacion_estandar: number;
    percentil_5: number;
    percentil_25: number;
    percentil_75: number;
    percentil_95: number;
    maximo: number;
    minimo: number;
  };

  /** FIC: Probability of profit (P&L > 0) / Probabilidad de ganancia */
  probabilidad_exito: number;
  /** FIC: Expected return (mean P&L) / Retorno esperado */
  rendimiento_esperado: number;
  /** FIC: Maximum drawdown / Drawdown máximo */
  drawdown_maximo: number;
  /** FIC: Sharpe-like ratio (return / std dev) / Ratio similar a Sharpe */
  ratio_sharpe: number;

  /** FIC: Scenario breakdown / Desglose de escenarios */
  escenarios: {
    /** FIC: Best case scenario / Mejor escenario */
    mejor_caso: { precio: number; pnl: number; descripcion: string };
    /** FIC: Worst case scenario / Peor escenario */
    peor_caso: { precio: number; pnl: number; descripcion: string };
    /** FIC: Base case (no shock) / Caso base (sin shock) */
    caso_base: { precio: number; pnl: number; descripcion: string };
  };

  /** FIC: Detailed iteration results (sampled) / Resultados detallados (muestreados) */
  muestras: Array<{ iteracion: number; precio_final: number; pnl: number }>;

  /** FIC: Cost breakdown / Desglose de costos */
  costos_totales: number;
  costos_detalle: {
    slippage_total: number;
    comisiones_totales: number;
    spread_total: number;
  };
}

// ──────────────────────────────────────────────
// FIC: Seeded PRNG (Mulberry32) for reproducibility /
//      PRNG con semilla (Mulberry32) para reproducibilidad
// ──────────────────────────────────────────────

/**
 * FIC: Mulberry32 - A simple seeded PRNG for reproducible simulations.
 * No external dependencies needed.
 *
 * FIC: Mulberry32 - PRNG simple con semilla para simulaciones reproducibles.
 * Sin dependencias externas.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /**
   * FIC: Returns a random number between 0 (inclusive) and 1 (exclusive).
   * FIC: Retorna un número aleatorio entre 0 (inclusive) y 1 (exclusive).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * FIC: Returns a normally distributed random number using Box-Muller transform.
   * FIC: Retorna un número aleatorio con distribución normal usando transformación Box-Muller.
   */
  nextGaussian(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

// ──────────────────────────────────────────────
// FIC: Engine implementation / Implementación del motor
// ──────────────────────────────────────────────

/**
 * FIC: Complex Simulation Engine - runs Monte Carlo, deterministic, and backtesting simulations.
 *
 * FIC: Motor de Simulación Compleja - ejecuta simulaciones Monte Carlo, determinísticas y backtesting.
 */
export class ComplexSimulationEngine {
  /**
   * FIC: Run a full simulation with the given configuration.
   * FIC: Ejecuta una simulación completa con la configuración dada.
   */
  simulate(
    config: ComplexStrategyConfig,
    profile: StrategyProfile,
    simConfig: SimulationConfig = DEFAULT_SIMULATION_CONFIG
  ): SimulationResult {
    const startTime = Date.now();

    // FIC: Get base price range from strategy
    const priceRange = generatePriceRange(config.legs, 0.3);
    const basePrice = config.legs[0].subyacente_precio ?? (priceRange.min + priceRange.max) / 2;
    const baseIV = this.averageIV(config.legs);

    switch (simConfig.tipo) {
      case "monte_carlo":
        return this.runMonteCarlo(config, profile, simConfig, basePrice, baseIV, startTime);
      case "deterministico":
        return this.runDeterministic(config, profile, simConfig, basePrice, baseIV, startTime);
      case "backtesting":
        return this.runBacktesting(config, profile, simConfig, basePrice, baseIV, startTime);
      default:
        return this.runMonteCarlo(config, profile, simConfig, basePrice, baseIV, startTime);
    }
  }

  // ──────────────────────────────────────────────
  // FIC: Monte Carlo simulation / Simulación Monte Carlo
  // ──────────────────────────────────────────────

  private runMonteCarlo(
    config: ComplexStrategyConfig,
    profile: StrategyProfile,
    simConfig: SimulationConfig,
    basePrice: number,
    baseIV: number,
    startTime: number
  ): SimulationResult {
    const rng = new SeededRandom(simConfig.semilla);
    const iterations = Math.min(Math.max(simConfig.iteraciones, 1000), 100000);

    const pnlResults: number[] = [];
    const sampledResults: Array<{ iteracion: number; precio_final: number; pnl: number }> = [];

    let totalCosts = 0;

    // FIC: Calculate one-time costs
    const costDetail = this.calculateCosts(config.legs, simConfig.costos);
    totalCosts = costDetail.total;

    // FIC: Run Monte Carlo iterations
    for (let i = 0; i < iterations; i++) {
      // FIC: Simulate price movement (geometric Brownian motion simplified)
      const priceShock = simConfig.shock_precio * rng.nextGaussian();
      const simulatedPrice = basePrice * (1 + priceShock);

      // FIC: Calculate P&L at simulated price (including costs)
      let pnl = this.calculateTotalPnl(config.legs, simulatedPrice);
      pnl -= totalCosts;

      pnlResults.push(pnl);

      // FIC: Sample every N iterations for detailed output
      const sampleRate = Math.max(1, Math.floor(iterations / 100));
      if (i % sampleRate === 0) {
        sampledResults.push({
          iteracion: i,
          precio_final: Math.round(simulatedPrice * 100) / 100,
          pnl: Math.round(pnl * 100) / 100,
        });
      }
    }

    // FIC: Sort for percentile analysis
    const sorted = [...pnlResults].sort((a, b) => a - b);

    const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    const percentil5 = sorted[Math.floor(sorted.length * 0.05)];
    const percentil25 = sorted[Math.floor(sorted.length * 0.25)];
    const percentil75 = sorted[Math.floor(sorted.length * 0.75)];
    const percentil95 = sorted[Math.floor(sorted.length * 0.95)];

    const successCount = pnlResults.filter((p) => p > 0).length;
    const probExito = successCount / iterations;

    // FIC: Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(pnlResults);

    // FIC: Find best/worst scenarios
    const maxPnl = Math.max(...pnlResults);
    const minPnl = Math.min(...pnlResults);
    const bestIndex = pnlResults.indexOf(maxPnl);
    const worstIndex = pnlResults.indexOf(minPnl);
    const bestPrice = basePrice * (1 + simConfig.shock_precio * this.estimateShockFromIndex(bestIndex, simConfig.semilla));
    const worstPrice = basePrice * (1 + simConfig.shock_precio * this.estimateShockFromIndex(worstIndex, simConfig.semilla));

    const elapsed = Date.now() - startTime;

    return {
      tipo: "monte_carlo",
      total_iteraciones: iterations,
      semilla: simConfig.semilla,
      tiempo_ms: elapsed,

      distribucion_pnl: {
        media: Math.round(mean * 100) / 100,
        mediana: Math.round(median * 100) / 100,
        desviacion_estandar: Math.round(stdDev * 100) / 100,
        percentil_5: Math.round(percentil5 * 100) / 100,
        percentil_25: Math.round(percentil25 * 100) / 100,
        percentil_75: Math.round(percentil75 * 100) / 100,
        percentil_95: Math.round(percentil95 * 100) / 100,
        maximo: Math.round(maxPnl * 100) / 100,
        minimo: Math.round(minPnl * 100) / 100,
      },

      probabilidad_exito: Math.round(probExito * 10000) / 100,
      rendimiento_esperado: Math.round(mean * 100) / 100,
      drawdown_maximo: Math.round(maxDrawdown * 100) / 100,
      ratio_sharpe: stdDev > 0 ? Math.round((mean / stdDev) * 100) / 100 : 0,

      escenarios: {
        mejor_caso: {
          precio: Math.round(bestPrice * 100) / 100,
          pnl: Math.round(maxPnl * 100) / 100,
          descripcion: `Favorable price movement of ~${(simConfig.shock_precio * 100).toFixed(0)}% std dev. ` +
                       `Movimiento favorable de precio de ~${(simConfig.shock_precio * 100).toFixed(0)}% desviación estándar.`,
        },
        peor_caso: {
          precio: Math.round(worstPrice * 100) / 100,
          pnl: Math.round(minPnl * 100) / 100,
          descripcion: `Adverse price movement. Worst P&L in simulation. ` +
                       `Movimiento adverso de precio. Peor P&L en la simulación.`,
        },
        caso_base: {
          precio: Math.round(basePrice * 100) / 100,
          pnl: Math.round(this.calculateTotalPnl(config.legs, basePrice) * 100) / 100,
          descripcion: `No price movement (base price). ` +
                       `Sin movimiento de precio (precio base).`,
        },
      },

      muestras: sampledResults,
      costos_totales: Math.round(totalCosts * 100) / 100,
      costos_detalle: {
        slippage_total: Math.round(costDetail.slippage * 100) / 100,
        comisiones_totales: Math.round(costDetail.commissions * 100) / 100,
        spread_total: Math.round(costDetail.spread * 100) / 100,
      },
    };
  }

  // ──────────────────────────────────────────────
  // FIC: Deterministic simulation / Simulación determinística
  // ──────────────────────────────────────────────

  private runDeterministic(
    config: ComplexStrategyConfig,
    profile: StrategyProfile,
    simConfig: SimulationConfig,
    basePrice: number,
    baseIV: number,
    startTime: number
  ): SimulationResult {
    const rng = new SeededRandom(simConfig.semilla);

    // FIC: Deterministic scenarios: predefined shock levels
    const priceShocks = [-0.3, -0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2, 0.3];
    const ivShocks = [-0.2, -0.1, 0, 0.1, 0.2];
    const scenarios = priceShocks.length * ivShocks.length;

    const pnlResults: number[] = [];
    const sampledResults: Array<{ iteracion: number; precio_final: number; pnl: number }> = [];
    const costDetail = this.calculateCosts(config.legs, simConfig.costos);

    let iterCount = 0;
    for (const ps of priceShocks) {
      for (const ivs of ivShocks) {
        const simulatedPrice = basePrice * (1 + ps);
        const pnl = this.calculateTotalPnl(config.legs, simulatedPrice) - costDetail.total;

        pnlResults.push(pnl);
        sampledResults.push({
          iteracion: iterCount,
          precio_final: Math.round(simulatedPrice * 100) / 100,
          pnl: Math.round(pnl * 100) / 100,
        });
        iterCount++;
      }
    }

    const sorted = [...pnlResults].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const stdDev = Math.sqrt(sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length);

    const successCount = pnlResults.filter((p) => p > 0).length;
    const probExito = successCount / scenarios;
    const maxDrawdown = this.calculateMaxDrawdown(pnlResults);

    const bestPnl = Math.max(...pnlResults);
    const bestIdx = pnlResults.indexOf(bestPnl);
    const bestPriceDet = basePrice * (1 + priceShocks[bestIdx % priceShocks.length]);

    const worstPnl = Math.min(...pnlResults);
    const worstIdx = pnlResults.indexOf(worstPnl);
    const worstPriceDet = basePrice * (1 + priceShocks[worstIdx % priceShocks.length]);

    const elapsed = Date.now() - startTime;

    return {
      tipo: "deterministico",
      total_iteraciones: scenarios,
      semilla: simConfig.semilla,
      tiempo_ms: elapsed,

      distribucion_pnl: {
        media: Math.round(mean * 100) / 100,
        mediana: Math.round(median * 100) / 100,
        desviacion_estandar: Math.round(stdDev * 100) / 100,
        percentil_5: Math.round(sorted[Math.floor(sorted.length * 0.05)] * 100) / 100,
        percentil_25: Math.round(sorted[Math.floor(sorted.length * 0.25)] * 100) / 100,
        percentil_75: Math.round(sorted[Math.floor(sorted.length * 0.75)] * 100) / 100,
        percentil_95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 100) / 100,
        maximo: Math.round(bestPnl * 100) / 100,
        minimo: Math.round(worstPnl * 100) / 100,
      },

      probabilidad_exito: Math.round(probExito * 10000) / 100,
      rendimiento_esperado: Math.round(mean * 100) / 100,
      drawdown_maximo: Math.round(maxDrawdown * 100) / 100,
      ratio_sharpe: stdDev > 0 ? Math.round((mean / stdDev) * 100) / 100 : 0,

      escenarios: {
        mejor_caso: {
          precio: Math.round(bestPriceDet * 100) / 100,
          pnl: Math.round(bestPnl * 100) / 100,
          descripcion: `Most favorable deterministic scenario (price shock: ${((bestIdx % priceShocks.length) - 3) * 5}%).`,
        },
        peor_caso: {
          precio: Math.round(worstPriceDet * 100) / 100,
          pnl: Math.round(worstPnl * 100) / 100,
          descripcion: `Most adverse deterministic scenario (price shock: ${((worstIdx % priceShocks.length) - 3) * 5}%).`,
        },
        caso_base: {
          precio: Math.round(basePrice * 100) / 100,
          pnl: Math.round(this.calculateTotalPnl(config.legs, basePrice) * 100) / 100,
          descripcion: `No price movement (base price).`,
        },
      },

      muestras: sampledResults,
      costos_totales: Math.round(costDetail.total * 100) / 100,
      costos_detalle: {
        slippage_total: Math.round(costDetail.slippage * 100) / 100,
        comisiones_totales: Math.round(costDetail.commissions * 100) / 100,
        spread_total: Math.round(costDetail.spread * 100) / 100,
      },
    };
  }

  // ──────────────────────────────────────────────
  // FIC: Backtesting simulation / Simulación de backtesting
  // ──────────────────────────────────────────────

  private runBacktesting(
    config: ComplexStrategyConfig,
    profile: StrategyProfile,
    simConfig: SimulationConfig,
    basePrice: number,
    baseIV: number,
    startTime: number
  ): SimulationResult {
    const historicalData = simConfig.datos_historicos;
    const costDetail = this.calculateCosts(config.legs, simConfig.costos);

    if (!historicalData || historicalData.length < 2) {
      // FIC: Fallback to deterministic if no historical data
      return this.runDeterministic(config, profile, simConfig, basePrice, baseIV, startTime);
    }

    const pnlResults: number[] = [];
    const sampledResults: Array<{ iteracion: number; precio_final: number; pnl: number }> = [];

    for (let i = 0; i < historicalData.length; i++) {
      const point = historicalData[i];
      const pnl = this.calculateTotalPnl(config.legs, point.precio) - costDetail.total;
      pnlResults.push(pnl);

      if (i % Math.max(1, Math.floor(historicalData.length / 100)) === 0) {
        sampledResults.push({
          iteracion: i,
          precio_final: point.precio,
          pnl: Math.round(pnl * 100) / 100,
        });
      }
    }

    const sorted = [...pnlResults].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const stdDev = Math.sqrt(sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / sorted.length);

    const successCount = pnlResults.filter((p) => p > 0).length;
    const probExito = successCount / historicalData.length;
    const maxDrawdown = this.calculateMaxDrawdown(pnlResults);

    const bestPrice = historicalData[pnlResults.indexOf(Math.max(...pnlResults))]?.precio ?? basePrice;
    const worstPrice = historicalData[pnlResults.indexOf(Math.min(...pnlResults))]?.precio ?? basePrice;

    const elapsed = Date.now() - startTime;

    return {
      tipo: "backtesting",
      total_iteraciones: historicalData.length,
      semilla: simConfig.semilla,
      tiempo_ms: elapsed,

      distribucion_pnl: {
        media: Math.round(mean * 100) / 100,
        mediana: Math.round(median * 100) / 100,
        desviacion_estandar: Math.round(stdDev * 100) / 100,
        percentil_5: Math.round(sorted[Math.floor(sorted.length * 0.05)] * 100) / 100,
        percentil_25: Math.round(sorted[Math.floor(sorted.length * 0.25)] * 100) / 100,
        percentil_75: Math.round(sorted[Math.floor(sorted.length * 0.75)] * 100) / 100,
        percentil_95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 100) / 100,
        maximo: Math.round(Math.max(...pnlResults) * 100) / 100,
        minimo: Math.round(Math.min(...pnlResults) * 100) / 100,
      },

      probabilidad_exito: Math.round(probExito * 10000) / 100,
      rendimiento_esperado: Math.round(mean * 100) / 100,
      drawdown_maximo: Math.round(maxDrawdown * 100) / 100,
      ratio_sharpe: stdDev > 0 ? Math.round((mean / stdDev) * 100) / 100 : 0,

      escenarios: {
        mejor_caso: {
          precio: Math.round(bestPrice * 100) / 100,
          pnl: Math.round(Math.max(...pnlResults) * 100) / 100,
          descripcion: `Best historical scenario from ${historicalData.length} data points.`,
        },
        peor_caso: {
          precio: Math.round(worstPrice * 100) / 100,
          pnl: Math.round(Math.min(...pnlResults) * 100) / 100,
          descripcion: `Worst historical scenario from ${historicalData.length} data points.`,
        },
        caso_base: {
          precio: Math.round(basePrice * 100) / 100,
          pnl: Math.round(this.calculateTotalPnl(config.legs, basePrice) * 100) / 100,
          descripcion: `Current market price (${basePrice}).`,
        },
      },

      muestras: sampledResults,
      costos_totales: Math.round(costDetail.total * 100) / 100,
      costos_detalle: {
        slippage_total: Math.round(costDetail.slippage * 100) / 100,
        comisiones_totales: Math.round(costDetail.commissions * 100) / 100,
        spread_total: Math.round(costDetail.spread * 100) / 100,
      },
    };
  }

  // ──────────────────────────────────────────────
  // FIC: Private helpers / Helpers privados
  // ──────────────────────────────────────────────

  private calculateTotalPnl(legs: OptionLeg[], price: number): number {
    return legs.reduce((sum, leg) => sum + calculateLegPayoff(leg, price), 0);
  }

  private calculateCosts(
    legs: OptionLeg[],
    costModel: CostModel
  ): { total: number; slippage: number; commissions: number; spread: number } {
    const totalPremium = legs.reduce((sum, leg) => sum + Math.abs(leg.prima) * leg.contratos * 100, 0);
    const totalContracts = legs.reduce((sum, leg) => sum + leg.contratos, 0);

    const slippage = totalPremium * costModel.slippage;
    const commissions = costModel.comision_base + totalContracts * costModel.comision_por_contrato;
    const spread = totalPremium * costModel.spread;

    return {
      total: slippage + commissions + spread,
      slippage,
      commissions,
      spread,
    };
  }

  private calculateMaxDrawdown(pnlResults: number[]): number {
    let peak = -Infinity;
    let maxDrawdown = 0;

    for (const pnl of pnlResults) {
      if (pnl > peak) peak = pnl;
      const drawdown = peak - pnl;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  private averageIV(legs: OptionLeg[]): number {
    const ivs = legs.filter((l) => l.volatilidad_implicita !== undefined).map((l) => l.volatilidad_implicita!);
    if (ivs.length === 0) return 0.25; // FIC: Default IV / IV por defecto
    return ivs.reduce((sum, v) => sum + v, 0) / ivs.length;
  }

  private estimateShockFromIndex(index: number, seed: number): number {
    // FIC: Approximate the shock value from index for scenario description
    const pseudoRng = new SeededRandom(seed + index);
    return pseudoRng.nextGaussian();
  }
}

/**
 * FIC: Factory function to create a ComplexSimulationEngine instance.
 * FIC: Función de fábrica para crear una instancia de ComplexSimulationEngine.
 */
export function createComplexSimulationEngine(): ComplexSimulationEngine {
  return new ComplexSimulationEngine();
}

export default ComplexSimulationEngine;
