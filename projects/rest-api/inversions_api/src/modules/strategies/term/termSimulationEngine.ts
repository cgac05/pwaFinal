/**
 * termSimulationEngine.ts — T165
 * Proposito: Motor de simulacion temporal con 3 modos: backtesting con datos historicos,
 * Monte Carlo (normal/lognormal), y escenarios deterministicos (precio+IV+tiempo).
 * Llamado por: routes/strategies/term/calendarSpread (POST /calendar),
 *              routes/strategies/term/diagonalSpread (POST /diagonal)
 * Dependencias: calendarSpreadEngine, diagonalSpreadEngine (motores de estrategia),
 *               termStrategyContract, termUtils
 */
import { buildCanonicalOutputString } from "@inversions/utils";
import { CalendarSpreadEngine, type CalendarSpreadResult, type IvCurvePoint } from "./calendarSpreadEngine";
import { DiagonalSpreadEngine, type RiskProfile } from "./diagonalSpreadEngine";
import { TermStrategyContract, type OptionStyle } from "./termStrategyContract";
import { blackScholesPrice, interpolateIv, daysToExpiration } from "./termUtils";

export interface OhlcData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface BacktestResult {
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  returns: number[];
  equityCurve: number[];
}

export interface MonteCarloConfig {
  iterations: number;
  distribution: "normal" | "lognormal";
  seed?: number;
}

export interface MonteCarloResult {
  iterations: number;
  distribution: string;
  meanPnl: number;
  medianPnl: number;
  percentile5: number;
  percentile95: number;
  var95: number;
  pnlDistribution: number[];
}

export interface DeterministicScenario {
  label: string;
  price: number;
  ivShock: number;
  dteRemaining: number;
  strategyValue: number;
  pnl: number;
}

export interface SimulationResult {
  strategy: "calendar" | "diagonal";
  optionStyle: OptionStyle;
  backtest: BacktestResult | null;
  monteCarlo: MonteCarloResult | null;
  deterministic: DeterministicScenario[];
  timestamp: Date;
}

/** Genera numero aleatorio normal estandar usando Box-Muller. Usado por runMonteCarlo */
function generateNormalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Calcula Sharpe Ratio anualizado. Usado por runBacktest */
function calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (mean - riskFreeRate / 252) / stdDev;
}

/** Calcula Sortino Ratio (solo downside risk). Usado por runBacktest */
function calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const negativeReturns = returns.filter(r => r < 0);
  if (negativeReturns.length === 0) return mean > 0 ? Infinity : 0;
  const downsideVariance = negativeReturns.reduce((a, b) => a + b * b, 0) / negativeReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);
  if (downsideDev === 0) return 0;
  return (mean - riskFreeRate / 252) / downsideDev;
}

/** Calcula maximo drawdown desde un pico historico. Usado por runBacktest */
function calculateMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;
  let peak = equityCurve[0];
  let maxDrawdown = 0;
  for (const value of equityCurve) {
    if (value > peak) peak = value;
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown;
}

export class TermSimulationEngine {
  private readonly calendarEngine: CalendarSpreadEngine | null;
  private readonly diagonalEngine: DiagonalSpreadEngine | null;
  private readonly contract: TermStrategyContract;
  private readonly riskFreeRate: number;
  private readonly ivCurve: IvCurvePoint[];

  /** Construye el motor con ambos engines (calendar/diagonal), contrato, tasa libre de riesgo y curva IV */
  constructor(
    contract: TermStrategyContract,
    calendarEngine: CalendarSpreadEngine | null,
    diagonalEngine: DiagonalSpreadEngine | null,
    riskFreeRate: number = 0.05,
    ivCurve: IvCurvePoint[] = []
  ) {
    this.contract = contract;
    this.calendarEngine = calendarEngine;
    this.diagonalEngine = diagonalEngine;
    this.riskFreeRate = riskFreeRate;
    this.ivCurve = ivCurve;
  }

  /** Backtesting sobre datos historicos OHLC: calcula rendimiento, Sharpe, Sortino, max drawdown, win rate. Minimo 20 datos */
  runBacktest(historicalData: OhlcData[]): BacktestResult {
    if (historicalData.length < 20) {
      return {
        totalReturn: 0, sharpeRatio: 0, sortinoRatio: 0, maxDrawdown: 0,
        winRate: 0, totalTrades: 0, returns: [], equityCurve: [],
      };
    }

    const returns: number[] = [];
    const equityCurve: number[] = [1];
    let wins = 0;
    const windowSize = Math.min(10, Math.floor(historicalData.length / 2));

    for (let i = windowSize; i < historicalData.length; i++) {
      const currentPrice = historicalData[i].close;
      const prevPrice = historicalData[i - 1].close;
      const dailyReturn = (currentPrice - prevPrice) / prevPrice;
      returns.push(dailyReturn);
      equityCurve.push(equityCurve[equityCurve.length - 1] * (1 + dailyReturn));
      if (dailyReturn > 0) wins++;
    }

    const totalReturn = (equityCurve[equityCurve.length - 1] - 1) * 100;
    const sharpeRatio = calculateSharpeRatio(returns, this.riskFreeRate);
    const sortinoRatio = calculateSortinoRatio(returns, this.riskFreeRate);
    const maxDrawdown = calculateMaxDrawdown(equityCurve);
    const winRate = returns.length > 0 ? wins / returns.length : 0;

    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      totalTrades: returns.length,
      returns,
      equityCurve,
    };
  }

  /** Simulacion Monte Carlo con config: iteraciones, distribucion (normal/lognormal). Retorna distribucion de P&L, percentiles y VaR 95% */
  runMonteCarlo(config: MonteCarloConfig): MonteCarloResult {
    const legs = this.contract.getLegs();
    const sortedByExpiration = [...legs].sort(
      (a, b) => a.expiration.getTime() - b.expiration.getTime()
    );
    const shortLeg = sortedByExpiration[0];
    const longLeg = sortedByExpiration[sortedByExpiration.length - 1];
    const optionStyle = shortLeg.optionStyle;

    const now = new Date();
    const shortDte = daysToExpiration(shortLeg.expiration, now);
    const longDte = daysToExpiration(longLeg.expiration, now);
    const shortT = shortDte / 365;
    const longT = longDte / 365;

    const shortIv = interpolateIv(shortDte, this.ivCurve);
    const longIv = interpolateIv(longDte, this.ivCurve);

    const initialShortPrice = blackScholesPrice(
      shortLeg.strike, shortLeg.strike, shortT, this.riskFreeRate, shortIv, optionStyle
    );
    const initialLongPrice = blackScholesPrice(
      longLeg.strike, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle
    );
    const initialValue = initialLongPrice - initialShortPrice;

    const pnlDistribution: number[] = [];
    const annualVol = 0.2;

    for (let i = 0; i < config.iterations; i++) {
      let pricePath = shortLeg.strike;
      for (let day = 0; day < shortDte; day++) {
        const shock = generateNormalRandom() * annualVol * Math.sqrt(1 / 252);
        if (config.distribution === "lognormal") {
          pricePath *= Math.exp(shock);
        } else {
          pricePath += shock * pricePath;
        }
      }

      const finalShortPrice = blackScholesPrice(
        pricePath, shortLeg.strike, Math.max(0.001, shortT - shortDte / 365), this.riskFreeRate, shortIv, optionStyle
      );
      const finalLongPrice = blackScholesPrice(
        pricePath, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle
      );

      const finalValue = finalLongPrice - finalShortPrice;
      const pnl = (finalValue - initialValue) / Math.abs(initialValue || 1) * 100;
      pnlDistribution.push(pnl);
    }

    pnlDistribution.sort((a, b) => a - b);
    const meanPnl = pnlDistribution.reduce((a, b) => a + b, 0) / pnlDistribution.length;
    const medianPnl = pnlDistribution[Math.floor(pnlDistribution.length / 2)];
    const percentile5 = pnlDistribution[Math.floor(pnlDistribution.length * 0.05)];
    const percentile95 = pnlDistribution[Math.floor(pnlDistribution.length * 0.95)];
    const var95 = percentile5;

    return {
      iterations: config.iterations,
      distribution: config.distribution,
      meanPnl: Math.round(meanPnl * 100) / 100,
      medianPnl: Math.round(medianPnl * 100) / 100,
      percentile5: Math.round(percentile5 * 100) / 100,
      percentile95: Math.round(percentile95 * 100) / 100,
      var95: Math.round(var95 * 100) / 100,
      pnlDistribution,
    };
  }

  /** Escenarios deterministicos: combina shocks de IV (-10%, 0, +10%), precio (-10%, 0, +10%) y pasos temporales (0, mitad, fin) */
  runDeterministic(): DeterministicScenario[] {
    const legs = this.contract.getLegs();
    const sortedByExpiration = [...legs].sort(
      (a, b) => a.expiration.getTime() - b.expiration.getTime()
    );
    const shortLeg = sortedByExpiration[0];
    const longLeg = sortedByExpiration[sortedByExpiration.length - 1];
    const optionStyle = shortLeg.optionStyle;

    const now = new Date();
    const shortDte = daysToExpiration(shortLeg.expiration, now);
    const longDte = daysToExpiration(longLeg.expiration, now);
    const shortT = shortDte / 365;
    const longT = longDte / 365;

    const shortIv = interpolateIv(shortDte, this.ivCurve);
    const longIv = interpolateIv(longDte, this.ivCurve);

    const scenarios: DeterministicScenario[] = [];

    const ivShocks = [-0.1, 0, 0.1];
    const priceOffsets = [-0.1, 0, 0.1];
    const dteSteps = [0, Math.floor(shortDte / 2), shortDte - 1];

    for (const ivShock of ivShocks) {
      for (const priceOffset of priceOffsets) {
        const price = shortLeg.strike * (1 + priceOffset);
        const shockedShortIv = Math.max(0.05, shortIv + ivShock);
        const shockedLongIv = Math.max(0.05, longIv + ivShock);

        const shortPrice = blackScholesPrice(
          price, shortLeg.strike, shortT, this.riskFreeRate, shockedShortIv, optionStyle
        );
        const longPrice = blackScholesPrice(
          price, longLeg.strike, longT, this.riskFreeRate, shockedLongIv, optionStyle
        );

        const strategyValue = longPrice - shortPrice;
        const initialShortPrice = blackScholesPrice(
          shortLeg.strike, shortLeg.strike, shortT, this.riskFreeRate, shortIv, optionStyle
        );
        const initialLongPrice = blackScholesPrice(
          longLeg.strike, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle
        );
        const initialValue = initialLongPrice - initialShortPrice;
        const pnl = strategyValue - initialValue;

        scenarios.push({
          label: `Price${priceOffset >= 0 ? '+' : ''}${(priceOffset * 100).toFixed(0)}%_IV${ivShock >= 0 ? '+' : ''}${(ivShock * 100).toFixed(0)}%`,
          price: Math.round(price * 100) / 100,
          ivShock,
          dteRemaining: shortDte,
          strategyValue: Math.round(strategyValue * 100) / 100,
          pnl: Math.round(pnl * 100) / 100,
        });
      }
    }

    for (const dteElapsed of dteSteps) {
      if (dteElapsed === 0) continue;
      const remainingShortDte = Math.max(1, shortDte - dteElapsed);

      const shortPrice = 0;
      const longPrice = blackScholesPrice(
        shortLeg.strike, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle
      );
      const strategyValue = longPrice - shortPrice;
      const initialShortPrice = blackScholesPrice(
        shortLeg.strike, shortLeg.strike, shortT, this.riskFreeRate, shortIv, optionStyle
      );
      const initialLongPrice = blackScholesPrice(
        longLeg.strike, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle
      );
      const initialValue = initialLongPrice - initialShortPrice;
      const pnl = strategyValue - initialValue;

      scenarios.push({
        label: `TimeStep_${dteElapsed}d`,
        price: shortLeg.strike,
        ivShock: 0,
        dteRemaining: remainingShortDte,
        strategyValue: Math.round(strategyValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
      });
    }

    return scenarios;
  }

  /** Ejecuta simulacion completa: backtest (opcional), Monte Carlo (opcional) y deterministico (siempre). Retorna SimulationResult. Llamado por las rutas REST */
  simulate(
    historicalData?: OhlcData[],
    monteCarloConfig?: MonteCarloConfig
  ): SimulationResult {
    const legs = this.contract.getLegs();
    const optionStyle = legs[0].optionStyle;
    const strategyType = this.contract.getType();

    const backtest = historicalData ? this.runBacktest(historicalData) : null;
    const monteCarlo = monteCarloConfig ? this.runMonteCarlo(monteCarloConfig) : null;
    const deterministic = this.runDeterministic();

    return {
      strategy: strategyType,
      optionStyle,
      backtest,
      monteCarlo,
      deterministic,
      timestamp: new Date(),
    };
  }

  /** Retorna el engine de Calendar (o null si no se uso). Para acceso externo si es necesario */
  getCalendarEngine(): CalendarSpreadEngine | null {
    return this.calendarEngine;
  }

  /** Retorna el engine de Diagonal (o null si no se uso) */
  getDiagonalEngine(): DiagonalSpreadEngine | null {
    return this.diagonalEngine;
  }

  /** Genera señal de trading basada en los resultados de Monte Carlo — formato canónico */
  signal(
    historicalData?: OhlcData[],
    monteCarloConfig?: MonteCarloConfig
  ): string {
    const result = this.simulate(historicalData, monteCarloConfig);
    const mc = result.monteCarlo;
    if (!mc) {
      return buildCanonicalOutputString({
        core: "E_ESTRATEGIA",
        subCore: "simulation_engine",
        tipoSenal: "HOLD",
        score: 0,
        peso: 1,
        observacion: {
          objetivo: "Simulación Monte Carlo sin datos",
          senal: "NO_MC_DATA",
          explicacion: "No hay datos de Monte Carlo disponibles para generar señal",
          metricas: {},
        },
      });
    }
    let tipoSenal: "CALL" | "PUT" | "HOLD";
    let score: number;
    let objetivo: string;
    let senal: string;
    if (mc.meanPnl > 5 && mc.var95 > -10) {
      tipoSenal = "CALL";
      score = 0.7;
      objetivo = "Simulación Monte Carlo muestra condiciones favorables";
      senal = "FAVORABLE";
    } else if (mc.meanPnl < -5 || mc.var95 < -20) {
      tipoSenal = "PUT";
      score = 0.7;
      objetivo = "Simulación Monte Carlo muestra condiciones desfavorables";
      senal = "UNFAVORABLE";
    } else {
      tipoSenal = "HOLD";
      score = 0;
      objetivo = "Simulación Monte Carlo sin sesgo claro";
      senal = "NEUTRAL";
    }
    return buildCanonicalOutputString({
      core: "E_ESTRATEGIA",
      subCore: "simulation_engine",
      tipoSenal,
      score,
      peso: 1,
      observacion: {
        objetivo,
        senal,
        explicacion: `Monte Carlo: meanPnl=${mc.meanPnl.toFixed(2)}, var95=${mc.var95.toFixed(2)}, p5=${mc.percentile5.toFixed(2)}, p95=${mc.percentile95.toFixed(2)}, dist=${mc.distribution}`,
        metricas: {
          meanPnl: mc.meanPnl,
          medianPnl: mc.medianPnl,
          var95: mc.var95,
          percentile5: mc.percentile5,
          percentile95: mc.percentile95,
        },
      },
    });
  }
}
