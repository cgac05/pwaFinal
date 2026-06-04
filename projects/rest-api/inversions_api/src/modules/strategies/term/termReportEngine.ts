/**
 * termReportEngine.ts — T167
 * Proposito: Agrega resultados de calendar/diagonal + simulacion + riesgo en un reporte
 * estructurado unico con curva de payoff, superficie tiempo-precio-IV, metricas de riesgo
 * (delta/gamma/theta/vega/PoP/max-drawdown/Sharpe). Exportable a JSON para TEAM-01.
 * Llamado por: routes/strategies/term/calendarSpread (POST /calendar),
 *              routes/strategies/term/diagonalSpread (POST /diagonal)
 * Dependencias: calendarSpreadEngine (tipo CalendarSpreadResult),
 *               diagonalSpreadEngine (tipo RiskProfile),
 *               termSimulationEngine (tipos SimulationResult, DeterministicScenario),
 *               termRiskEngine (tipo RiskAnalysis)
 */
import { buildCanonicalOutputString } from "@inversions/utils";
import type { CalendarSpreadResult, CalendarStressTest } from "./calendarSpreadEngine";
import type { RiskProfile, DiagonalStressTest } from "./diagonalSpreadEngine";
import type { SimulationResult, DeterministicScenario, MonteCarloResult } from "./termSimulationEngine";
import type { RiskAnalysis } from "./termRiskEngine";
import type { TermLeg } from "./termStrategyContract";
import { blackScholesPrice } from "./termUtils";

/** Punto individual de la curva de payoff: precio subyacente, valor estrategia, P&L */
export interface PayoffCurvePoint {
  price: number;
  payoff: number;
  pnl: number;
}

/** Superficie tiempo-precio-IV: ejes de precio y DTE, matrices de P&L e IV. Solo calendar spread genera surface */
export interface TimePriceIvSurface {
  priceAxis: number[];
  dteAxis: number[];
  pnlMatrix: number[][];
  ivMatrix: number[][];
}

/** Punto de la distribucion de P&L en un DTE futuro: percentil, valor P&L. Usado para probability cone chart */
export interface ProbabilityConePoint {
  dte: number;
  percentile5: number;
  percentile25: number;
  median: number;
  percentile75: number;
  percentile95: number;
}

/** Resultado de un escenario de stress: label, descripcion, precio subyacente, P&L */
export interface StressTestEntry {
  label: string;
  description: string;
  underlyingPrice: number;
  pnl: number;
  strategyValue: number;
  greeks?: { delta: number; gamma: number; theta: number; vega: number };
}

/** Metricas de riesgo agregadas: griegas netas, probabilidad de ganancia, max drawdown estimado, Sharpe ratio, stress tests metrics, expected shortfall */
export interface RiskMetrics {
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  probabilityOfProfit: number;
  maxDrawdown: number;
  sharpeRatio: number;
  stressTestMaxLoss: number;
  stressTestMaxGain: number;
  expectedShortfall: number;
}

/** Reporte estructurado final: tipo estrategia, curva payoff, superficie 3D, metricas riesgo, escenarios deterministicos, stress tests, probability cone, timestamp. Devuelto como JSON por routes a TEAM-01 */
export interface StructuredReport {
  strategy: string;
  optionStyle: string;
  payoffCurve: PayoffCurvePoint[];
  surface: TimePriceIvSurface | null;
  riskMetrics: RiskMetrics;
  deterministic: DeterministicScenario[];
  stressTests: StressTestEntry[];
  probabilityCone: ProbabilityConePoint[];
  generatedAt: string;
}

export class TermReportEngine {
  private readonly calendarResult: CalendarSpreadResult | null;
  private readonly diagonalResult: RiskProfile | null;
  private readonly simulationResult: SimulationResult | null;
  private readonly riskAnalysis: RiskAnalysis | null;

  /** Recibe resultados de calendar, diagonal, simulacion y riesgo (todos opcionales) para armar el reporte */
  constructor(
    calendarResult: CalendarSpreadResult | null,
    diagonalResult: RiskProfile | null,
    simulationResult: SimulationResult | null,
    riskAnalysis: RiskAnalysis | null
  ) {
    this.calendarResult = calendarResult;
    this.diagonalResult = diagonalResult;
    this.simulationResult = simulationResult;
    this.riskAnalysis = riskAnalysis;
  }

  /** Genera curva de payoff a partir de scenarios de calendar o diagonal. Usado internamente por generateReport */
  generatePayoffCurve(): PayoffCurvePoint[] {
    if (this.calendarResult) {
      return this.calendarResult.scenarios.map(s => ({
        price: s.underlyingPrice,
        payoff: s.strategyValue,
        pnl: s.pnl,
      }));
    }

    if (this.diagonalResult) {
      return this.diagonalResult.scenarios.map(s => ({
        price: s.underlyingPrice,
        payoff: s.strategyValue,
        pnl: s.pnl,
      }));
    }

    return [];
  }

  /** Genera superficie 3D tiempo-precio-IV. Solo disponible para calendar spread (tiene 2 ejes DTE) */
  generateSurface(): TimePriceIvSurface | null {
    if (!this.calendarResult || this.calendarResult.scenarios.length === 0) return null;

    const priceAxis: number[] = [];
    const dteAxis = [this.calendarResult.shortDte, this.calendarResult.longDte];
    const pnlMatrix: number[][] = [[], []];
    const ivMatrix: number[][] = [[], []];

    for (const scenario of this.calendarResult.scenarios) {
      if (!priceAxis.includes(scenario.underlyingPrice)) {
        priceAxis.push(scenario.underlyingPrice);
      }
    }

    for (let dteIdx = 0; dteIdx < dteAxis.length; dteIdx++) {
      for (const price of priceAxis) {
        const scenario = this.calendarResult.scenarios.find(
          s => s.underlyingPrice === price
        );
        if (scenario) {
          pnlMatrix[dteIdx].push(scenario.pnl);
          ivMatrix[dteIdx].push(scenario.impliedVolatility);
        } else {
          pnlMatrix[dteIdx].push(0);
          ivMatrix[dteIdx].push(0);
        }
      }
    }

    return { priceAxis, dteAxis, pnlMatrix, ivMatrix };
  }

  /** Extrae stress tests del resultado de calendar o diagonal como StressTestEntry[] */
  generateStressTestSummary(): StressTestEntry[] {
    if (this.calendarResult && this.calendarResult.stressTests) {
      return this.calendarResult.stressTests.map(s => ({
        label: s.label,
        description: s.description,
        underlyingPrice: s.underlyingPrice,
        pnl: s.pnl,
        strategyValue: s.strategyValue,
      }));
    }

    if (this.diagonalResult && this.diagonalResult.stressTests) {
      return this.diagonalResult.stressTests.map(s => ({
        label: s.label,
        description: s.description,
        underlyingPrice: s.underlyingPrice,
        pnl: s.pnl,
        strategyValue: s.strategyValue,
        greeks: { ...s.greeks },
      }));
    }

    return [];
  }

  /** Genera probability cone estimado desde Monte Carlo (percentiles simulados vs DTE restante) */
  generateProbabilityCone(): ProbabilityConePoint[] {
    const mc = this.simulationResult?.monteCarlo;
    if (!mc || mc.pnlDistribution.length < 100) return [];

    const shortDte = this.calendarResult?.shortDte ?? this.diagonalResult?.shortDte ?? 0;
    if (shortDte <= 0) return [];

    const sorted = [...mc.pnlDistribution].sort((a, b) => a - b);
    const len = sorted.length;
    const p5 = sorted[Math.floor(len * 0.05)];
    const p25 = sorted[Math.floor(len * 0.25)];
    const p50 = sorted[Math.floor(len * 0.5)];
    const p75 = sorted[Math.floor(len * 0.75)];
    const p95 = sorted[Math.floor(len * 0.95)];

    return [
      { dte: shortDte, percentile5: Math.round(p5 * 100) / 100, percentile25: Math.round(p25 * 100) / 100, median: Math.round(p50 * 100) / 100, percentile75: Math.round(p75 * 100) / 100, percentile95: Math.round(p95 * 100) / 100 },
    ];
  }

  /** Estima el expected shortfall (CVaR) desde la cola izquierda de la distribucion Monte Carlo */
  private estimateExpectedShortfall(): number {
    const mc = this.simulationResult?.monteCarlo;
    if (!mc || mc.pnlDistribution.length < 100) return 0;
    const sorted = [...mc.pnlDistribution].sort((a, b) => a - b);
    const tailCount = Math.max(1, Math.floor(sorted.length * 0.05));
    const tail = sorted.slice(0, tailCount);
    const cvar = tail.reduce((a, b) => a + b, 0) / tail.length;
    return Math.round(cvar * 100) / 100;
  }

  /** Calcula metricas de riesgo agregadas: toma griegas de diagonalResult o theta de calendarResult, PoP estimado, max drawdown de riesgo, Sharpe de backtest, stress max/min, expected shortfall */
  calculateRiskMetrics(): RiskMetrics {
    const stressTests = this.generateStressTestSummary();
    const stressPnlValues = stressTests.map(s => s.pnl).filter(p => !isNaN(p));
    const stressTestMaxLoss = stressPnlValues.length > 0 ? Math.round(Math.min(...stressPnlValues) * 100) / 100 : 0;
    const stressTestMaxGain = stressPnlValues.length > 0 ? Math.round(Math.max(...stressPnlValues) * 100) / 100 : 0;
    const expectedShortfall = this.estimateExpectedShortfall();

    if (this.diagonalResult) {
      const greeks = this.diagonalResult.greeks;
      const pop = this.estimateProbabilityOfProfit(greeks.delta);

      const maxDrawdown = this.riskAnalysis
        ? Math.max(
            ...this.riskAnalysis.stopLossRules.map(r => r.currentDrawdown),
            0
          )
        : 0;

      const sharpeRatio = this.simulationResult?.backtest?.sharpeRatio ?? 0;

      return {
        netDelta: Math.round(greeks.delta * 1000) / 1000,
        netGamma: Math.round(greeks.gamma * 1000) / 1000,
        netTheta: Math.round(greeks.theta * 100) / 100,
        netVega: Math.round(greeks.vega * 100) / 100,
        probabilityOfProfit: Math.round(pop * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        stressTestMaxLoss,
        stressTestMaxGain,
        expectedShortfall,
      };
    }

    if (this.calendarResult) {
      const g = this.calendarResult.greeks;
      const pop = this.estimateProbabilityOfProfit(g.delta);

      const sharpeRatio = this.simulationResult?.backtest?.sharpeRatio ?? 0;
      const maxDrawdown = this.riskAnalysis
        ? Math.max(
            ...this.riskAnalysis.stopLossRules.map(r => r.currentDrawdown),
            0
          )
        : 0;

      return {
        netDelta: Math.round(g.delta * 1000) / 1000,
        netGamma: Math.round(g.gamma * 1000) / 1000,
        netTheta: Math.round(g.theta * 100) / 100,
        netVega: Math.round(g.vega * 100) / 100,
        probabilityOfProfit: Math.round(pop * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        stressTestMaxLoss,
        stressTestMaxGain,
        expectedShortfall,
      };
    }

    return {
      netDelta: 0, netGamma: 0, netTheta: 0, netVega: 0,
      probabilityOfProfit: 0, maxDrawdown: 0, sharpeRatio: 0,
      stressTestMaxLoss: 0, stressTestMaxGain: 0, expectedShortfall: 0,
    };
  }

  /** Estima PoP como 0.5 + delta*0.5, clamp entre 5% y 95%. Call con delta 0.3 => PoP ~65% */
  private estimateProbabilityOfProfit(delta: number): number {
    return Math.min(0.95, Math.max(0.05, 0.5 + delta * 0.5));
  }

  /** Ensambla el StructuredReport completo llamando a generatePayoffCurve, generateSurface, calculateRiskMetrics. Llamado por routes POST /calendar y /diagonal */
  generateReport(): StructuredReport {
    const strategy = this.calendarResult
      ? "calendar"
      : this.diagonalResult
        ? "diagonal"
        : "unknown";

    const optionStyle = this.calendarResult
      ? "call"
      : this.diagonalResult
        ? this.diagonalResult.greeks.delta > 0 ? "call" : "put"
        : "call";

    return {
      strategy,
      optionStyle,
      payoffCurve: this.generatePayoffCurve(),
      surface: this.generateSurface(),
      riskMetrics: this.calculateRiskMetrics(),
      deterministic: this.simulationResult?.deterministic ?? [],
      stressTests: this.generateStressTestSummary(),
      probabilityCone: this.generateProbabilityCone(),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Serializa reporte a JSON. Usado por rutas para enviar respuesta HTTP */
  toJson(): string {
    return JSON.stringify(this.generateReport(), null, 2);
  }

  /** Genera señal de reporte indicando el tipo de estrategia analizada — formato canónico */
  signal(): string {
    const report = this.generateReport();
    const tipoSenal: "CALL" | "PUT" | "HOLD" = report.strategy === "calendar" ? "HOLD" : report.strategy === "diagonal" ? "HOLD" : "HOLD";

    return buildCanonicalOutputString({
      core: "E_ESTRATEGIA",
      subCore: "report_engine",
      tipoSenal,
      score: 0,
      peso: 1,
      observacion: {
        objetivo: `Reporte de estrategia ${report.strategy}`,
        senal: `REPORT_${report.strategy.toUpperCase()}`,
        explicacion: `Reporte generado para estrategia ${report.strategy} con métricas agregadas`,
        metricas: {},
      },
    });
  }

  /** Encuentra los precios donde P&L cruza cero (break-even points) desde una curva de payoff.
   *  Busca pares consecutivos donde pnl cambia de signo e interpola linealmente. */
  static calculateBreakEvens(curve: PayoffCurvePoint[]): number[] {
    if (curve.length < 2) return [];
    const breakEvens: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1];
      const curr = curve[i];
      if ((prev.pnl <= 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl <= 0)) {
        const ratio = prev.pnl / (prev.pnl - curr.pnl);
        const bePrice = prev.price + ratio * (curr.price - prev.price);
        breakEvens.push(Math.round(bePrice * 100) / 100);
      }
    }
    return breakEvens;
  }

  /** Calcula el costo neto de entrada (debito) como la suma del valor de todas las patas.
   *  Positivo = debito (pagas), negativo = credito (recibes). */
  static calculateNetCost(legs: Array<{ premium: number; contracts: number }>): number {
    return legs.reduce((sum, leg) => sum + leg.premium * leg.contracts, 0);
  }

  /** Genera la curva de payoff al vencimiento de la pata corta.
   *  Short leg = valor intrinseco (T=0). Long leg = BS con DTE remanente.
   *  Usado por el comparador para el overlay chart (linea solida = expiracion). */
  static generatePayoffAtExpiration(
    legs: TermLeg[],
    initialCost: number,
    riskFreeRate: number,
    longIv: number,
    remainingDte: number,
    priceRange?: { min: number; max: number; steps: number }
  ): PayoffCurvePoint[] {
    if (legs.length < 2) return [];
    const sorted = [...legs].sort((a, b) => a.expiration.getTime() - b.expiration.getTime());
    const shortLeg = sorted[0];
    const longLeg = sorted[sorted.length - 1];
    const contracts = shortLeg.contracts;
    const remainingT = Math.max(remainingDte, 0) / 365;
    const range = priceRange ?? { min: shortLeg.strike * 0.5, max: shortLeg.strike * 1.5, steps: 50 };
    const step = (range.max - range.min) / (range.steps - 1);
    const curve: PayoffCurvePoint[] = [];

    for (let i = 0; i < range.steps; i++) {
      const S = Number((range.min + i * step).toFixed(2));
      const shortValue = blackScholesPrice(S, shortLeg.strike, 0, riskFreeRate, 0, shortLeg.optionStyle);
      const longValue = blackScholesPrice(S, longLeg.strike, remainingT, riskFreeRate, longIv, longLeg.optionStyle);
      const strategyValue = (shortValue + longValue) * contracts;
      const pnl = Number((strategyValue - initialCost).toFixed(2));
      const payoff = Number(strategyValue.toFixed(2));
      curve.push({ price: S, payoff, pnl });
    }
    return curve;
  }
}
