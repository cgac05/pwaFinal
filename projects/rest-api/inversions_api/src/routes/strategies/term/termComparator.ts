import { Router } from "express";
import { TermStrategyContract } from "../../../modules/strategies/term/termStrategyContract";
import { CalendarSpreadEngine } from "../../../modules/strategies/term/calendarSpreadEngine";
import { DiagonalSpreadEngine } from "../../../modules/strategies/term/diagonalSpreadEngine";
import { TermSimulationEngine } from "../../../modules/strategies/term/termSimulationEngine";
import { TermReportEngine } from "../../../modules/strategies/term/termReportEngine";
import type { CalendarSpreadResult } from "../../../modules/strategies/term/calendarSpreadEngine";
import type { RiskProfile } from "../../../modules/strategies/term/diagonalSpreadEngine";
import type { RiskMetrics, PayoffCurvePoint } from "../../../modules/strategies/term/termReportEngine";
import type { TermLeg } from "../../../modules/strategies/term/termStrategyContract";

export interface CompareRequest {
  marketVolatility: "low" | "medium" | "high";
  timeHorizon: "short" | "medium" | "long";
  direction: "bullish" | "bearish" | "neutral";
  riskTolerance: "conservative" | "moderate" | "aggressive";
  underlyingPrice?: number;
  calendarLegs: Array<{
    strike: number;
    expiration: string;
    premium: number;
    contracts: number;
    optionStyle: "call" | "put";
  }>;
  diagonalLegs: Array<{
    strike: number;
    expiration: string;
    premium: number;
    contracts: number;
    optionStyle: "call" | "put";
  }>;
}

export interface StrategyMetrics {
  cost: number;
  maxLoss: number;
  maxProfit: number;
  breakEvens: number[];
  probabilityOfProfit: number;
  greeks: { delta: number; gamma: number; theta: number; vega: number };
  dte: { short: number; long: number };
  directionalProfile: string;
  riskMetrics: RiskMetrics;
  currentPrice: number;
  payoffCurveT0: PayoffCurvePoint[];
  payoffCurveExpiration: PayoffCurvePoint[];
}

export interface MetricaRow {
  label: string;
  calendar: number;
  diagonal: number;
  winner: "calendar" | "diagonal" | "tie";
  reason: string;
  category: "capital" | "greeks" | "dte";
}

export interface CompareResponse {
  recommendation: "calendar" | "diagonal";
  justification: string;
  scores: { calendar: number; diagonal: number };
  calendar: StrategyMetrics;
  diagonal: StrategyMetrics;
  metricas: MetricaRow[];
}

export const termComparatorRouter = Router();

/**
 * @openapi
 * /compare:
 *   post:
 *     tags: [Comparator]
 *     summary: Compara Calendar Spread vs Diagonal Spread con metricas side-by-side
 *     description: >
 *       Evalua el contexto de mercado (volatilidad, horizonte, direccion, tolerancia)
 *       y las metricas completas de ambas estrategias (capital, riesgo, griegas, DTE)
 *       para recomendar la mas adecuada con justificacion detallada.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [marketVolatility, timeHorizon, direction, riskTolerance, calendarLegs, diagonalLegs]
 *             properties:
 *               marketVolatility: { type: string, enum: [low, medium, high] }
 *               timeHorizon:      { type: string, enum: [short, medium, long] }
 *               direction:        { type: string, enum: [bullish, bearish, neutral] }
 *               riskTolerance:    { type: string, enum: [conservative, moderate, aggressive] }
 *               calendarLegs:     { type: array, items: { type: object } }
 *               diagonalLegs:     { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: Comparacion con metricas side-by-side
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendation: { type: string }
 *                 justification:  { type: string }
 *                 scores:         { type: object }
 *                 calendar:       { type: object }
 *                 diagonal:       { type: object }
 *       400:
 *         description: Error de validacion
 *       500:
 *         description: Error interno del servidor
 */

function buildBaseMetrics(
  engineResult: CalendarSpreadResult | RiskProfile | null,
  legs: Array<{ premium: number; contracts: number; strike: number; expiration: string; optionStyle: string }>,
  isCalendar: boolean,
  currentPrice: number,
  riskFreeRate: number
): StrategyMetrics {
  const empty: StrategyMetrics = {
    cost: 0, maxLoss: 0, maxProfit: 0, breakEvens: [],
    probabilityOfProfit: 0,
    greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 },
    dte: { short: 0, long: 0 },
    directionalProfile: "neutral",
    riskMetrics: {
      netDelta: 0, netGamma: 0, netTheta: 0, netVega: 0,
      probabilityOfProfit: 0, maxDrawdown: 0, sharpeRatio: 0,
      stressTestMaxLoss: 0, stressTestMaxGain: 0, expectedShortfall: 0,
    },
    currentPrice,
    payoffCurveT0: [],
    payoffCurveExpiration: [],
  };

  if (!engineResult) return empty;

  const cost = TermReportEngine.calculateNetCost(legs);

  const scenarios: Array<{ underlyingPrice: number; strategyValue: number; pnl: number }> =
    "shortTheta" in engineResult
      ? (engineResult as CalendarSpreadResult).scenarios
      : (engineResult as RiskProfile).scenarios;
  const payoffCurveT0 = scenarios.map(s => ({
    price: s.underlyingPrice,
    payoff: s.strategyValue,
    pnl: s.pnl,
  }));
  const breakEvens = TermReportEngine.calculateBreakEvens(payoffCurveT0);

  const pnls = scenarios.map(s => s.pnl).filter(p => !isNaN(p));
  const maxLoss = pnls.length > 0 ? Math.min(...pnls) : 0;
  const maxProfit = pnls.length > 0 ? Math.max(...pnls) : 0;

  // Compute expiration curve
  const termLegs: TermLeg[] = legs.map(l => ({
    strike: l.strike,
    expiration: new Date(l.expiration),
    premium: l.premium,
    contracts: l.contracts,
    optionStyle: l.optionStyle as "call" | "put",
  }));
  const sorted = [...termLegs].sort((a, b) => a.expiration.getTime() - b.expiration.getTime());
  const shortDte = isCalendar
    ? (engineResult as CalendarSpreadResult).shortDte
    : (engineResult as RiskProfile).shortDte;
  const longDte = isCalendar
    ? (engineResult as CalendarSpreadResult).longDte
    : (engineResult as RiskProfile).longDte;
  const remainingDte = longDte - shortDte;
  const longIv = 0.25; // default IV for expiration pricing

  const payoffCurveExpiration = TermReportEngine.generatePayoffAtExpiration(
    termLegs, cost, riskFreeRate, longIv, remainingDte
  );

  if (isCalendar) {
    const calResult = engineResult as CalendarSpreadResult;
    const g = calResult.greeks;
    return {
      cost: Math.round(cost * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      breakEvens,
      probabilityOfProfit: 0,
      greeks: { delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega },
      dte: { short: calResult.shortDte, long: calResult.longDte },
      directionalProfile: "neutral",
      riskMetrics: {
        netDelta: g.delta, netGamma: g.gamma, netTheta: g.theta, netVega: g.vega,
        probabilityOfProfit: 0, maxDrawdown: 0, sharpeRatio: 0,
        stressTestMaxLoss: 0, stressTestMaxGain: 0, expectedShortfall: 0,
      },
      currentPrice,
      payoffCurveT0,
      payoffCurveExpiration,
    };
  }

  const diagResult = engineResult as RiskProfile;
  const g = diagResult.greeks;
  return {
    cost: Math.round(cost * 100) / 100,
    maxLoss: Math.round(maxLoss * 100) / 100,
    maxProfit: Math.round(maxProfit * 100) / 100,
    breakEvens,
    probabilityOfProfit: 0,
    greeks: { delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega },
    dte: { short: diagResult.shortDte, long: diagResult.longDte },
    directionalProfile: diagResult.directionalProfile,
    riskMetrics: {
      netDelta: g.delta, netGamma: g.gamma, netTheta: g.theta, netVega: g.vega,
      probabilityOfProfit: 0, maxDrawdown: 0, sharpeRatio: 0,
      stressTestMaxLoss: 0, stressTestMaxGain: 0, expectedShortfall: 0,
    },
    currentPrice,
    payoffCurveT0,
    payoffCurveExpiration,
  };
}

function enrichWithRiskMetrics(
  base: StrategyMetrics,
  reportEngine: TermReportEngine
): StrategyMetrics {
  const riskMetrics = reportEngine.calculateRiskMetrics();
  return {
    ...base,
    probabilityOfProfit: riskMetrics.probabilityOfProfit,
    riskMetrics: { ...riskMetrics },
  };
}

function pickBetter(
  calVal: number,
  diagVal: number,
  lowerIsBetter: boolean,
  tieThreshold: number = 0.001
): "calendar" | "diagonal" | "tie" {
  if (Math.abs(calVal - diagVal) < tieThreshold) return "tie";
  if (lowerIsBetter) return calVal < diagVal ? "calendar" : "diagonal";
  return calVal > diagVal ? "calendar" : "diagonal";
}

function determineMetricas(
  cal: StrategyMetrics,
  diag: StrategyMetrics,
  direction: string,
  riskTolerance: string
): MetricaRow[] {
  const rows: MetricaRow[] = [];

  const capitalRows: Array<{
    label: string; key: keyof Pick<StrategyMetrics, "cost" | "maxLoss" | "maxProfit" | "probabilityOfProfit">; lowerIsBetter: boolean; reasonTpl: (w: string) => string
  }> = [
    { label: "Costo Neto", key: "cost", lowerIsBetter: true, reasonTpl: w => `${w === "calendar" ? "Menor" : "Mayor"} costo → menos capital en riesgo` },
    { label: "Pérdida Máxima", key: "maxLoss", lowerIsBetter: false, reasonTpl: w => `Menor pérdida máxima → mejor control de riesgo` },
    { label: "Ganancia Máxima", key: "maxProfit", lowerIsBetter: false, reasonTpl: w => `Mayor ganancia máxima → mejor potencial de retorno` },
    { label: "Prob. de Ganancia", key: "probabilityOfProfit", lowerIsBetter: false, reasonTpl: w => `POP más alto → mayor probabilidad de éxito estadístico` },
  ];

  for (const r of capitalRows) {
    const w = pickBetter(Number(cal[r.key]), Number(diag[r.key]), r.lowerIsBetter);
    rows.push({
      label: r.label,
      calendar: Number(cal[r.key]),
      diagonal: Number(diag[r.key]),
      winner: w,
      reason: w === "tie" ? "Sin diferencia significativa" : r.reasonTpl(w),
      category: "capital",
    });
  }

  // Greeks
  const greekKeys: Array<{ label: string; key: "delta" | "gamma" | "theta" | "vega"; reasonTpl: (w: string) => string }> = [
    {
      label: "Delta (Δ)",
      key: "delta",
      reasonTpl: w => {
        if (direction === "neutral") return w === "calendar" ? "Delta más cercano a 0 → neutral" : "Delta más direccional → puede no alinearse con outlook neutral";
        if (direction === "bullish") return w === "diagonal" ? "Delta positivo mayor → mejor alineado con outlook alcista" : "Delta neutral → no captura dirección alcista";
        return w === "diagonal" ? "Delta negativo mayor → mejor alineado con outlook bajista" : "Delta neutral → no captura dirección bajista";
      },
    },
    {
      label: "Gamma (Γ)",
      key: "gamma",
      reasonTpl: w => w === "calendar" ? "Menor gamma → menor riesgo de convexidad" : "Mayor gamma → mayor sensibilidad a cambios de precio",
    },
    {
      label: "Theta (θ)",
      key: "theta",
      reasonTpl: w => w === "calendar" ? "Theta más positivo → mayor beneficio por decaimiento temporal" : "Theta más positivo → mayor beneficio por paso del tiempo",
    },
    {
      label: "Vega (ν)",
      key: "vega",
      reasonTpl: w => riskTolerance === "conservative"
        ? (w === "calendar" ? "Menor vega → menos riesgo por cambios en IV" : "Mayor vega → más exposición a cambios en IV")
        : (w === "diagonal" ? "Mayor vega → mejor para entornos de alta volatilidad" : "Menor vega → menos beneficio en alta volatilidad"),
    },
  ];

  for (const g of greekKeys) {
    const calG = cal.greeks[g.key];
    const diagG = diag.greeks[g.key];
    const lowerIsBetter = g.key !== "theta";
    const w = pickBetter(calG, diagG, lowerIsBetter);
    rows.push({
      label: g.label,
      calendar: calG,
      diagonal: diagG,
      winner: w,
      reason: w === "tie" ? "Sin diferencia significativa" : g.reasonTpl(w),
      category: "greeks",
    });
  }

  // DTE
  const dteW = pickBetter(cal.dte.short, diag.dte.short, false);
  rows.push({
    label: "DTE Corto",
    calendar: cal.dte.short,
    diagonal: diag.dte.short,
    winner: dteW,
    reason: dteW === "tie" ? "Mismo DTE corto" : `Mayor DTE corto → más tiempo para gestionar la posición`,
    category: "dte",
  });
  const dteLongW = pickBetter(cal.dte.long, diag.dte.long, false);
  rows.push({
    label: "DTE Largo",
    calendar: cal.dte.long,
    diagonal: diag.dte.long,
    winner: dteLongW,
    reason: dteLongW === "tie" ? "Mismo DTE largo" : `Mayor DTE largo → más tiempo de vida para la estrategia`,
    category: "dte",
  });

  return rows;
}

termComparatorRouter.post("/compare", (req, res) => {
  try {
    const body = req.body as CompareRequest;

    if (!body.calendarLegs || !body.diagonalLegs) {
      res.status(400).json({ error: "Both calendarLegs and diagonalLegs are required" });
      return;
    }

    const riskFreeRate = 0.05;
    const currentPrice = body.underlyingPrice ?? body.calendarLegs[0]?.strike ?? 100;

    const calendarContract = new TermStrategyContract({
      legs: body.calendarLegs.map(l => ({ ...l, expiration: new Date(l.expiration) })),
    });
    const diagonalContract = new TermStrategyContract({
      legs: body.diagonalLegs.map(l => ({ ...l, expiration: new Date(l.expiration) })),
    });

    const calValidation = calendarContract.validate();
    const diagValidation = diagonalContract.validate();

    const calEngine = new CalendarSpreadEngine(calendarContract);
    const diagEngine = new DiagonalSpreadEngine(diagonalContract);

    const calResult = calValidation.isValid ? calEngine.analyze() : null;
    const diagResult = diagValidation.isValid ? diagEngine.analyze() : null;

    let calMetrics = buildBaseMetrics(calResult, body.calendarLegs, true, currentPrice, riskFreeRate);
    let diagMetrics = buildBaseMetrics(diagResult, body.diagonalLegs, false, currentPrice, riskFreeRate);

    if (calResult) {
      const simEngine = new TermSimulationEngine(calendarContract, calEngine, null);
      const simResult = {
        strategy: "calendar" as const,
        optionStyle: "call" as const,
        backtest: null,
        monteCarlo: simEngine.runMonteCarlo({ iterations: 1000, distribution: "normal" }),
        deterministic: simEngine.runDeterministic(),
        timestamp: new Date(),
      };
      const reportEngine = new TermReportEngine(calResult, null, simResult, null);
      calMetrics = enrichWithRiskMetrics(calMetrics, reportEngine);
    }

    if (diagResult) {
      const simEngine = new TermSimulationEngine(diagonalContract, null, diagEngine);
      const simResult = {
        strategy: "diagonal" as const,
        optionStyle: diagResult.greeks.delta > 0 ? "call" as const : "put" as const,
        backtest: null,
        monteCarlo: simEngine.runMonteCarlo({ iterations: 1000, distribution: "normal" }),
        deterministic: simEngine.runDeterministic(),
        timestamp: new Date(),
      };
      const reportEngine = new TermReportEngine(null, diagResult, simResult, null);
      diagMetrics = enrichWithRiskMetrics(diagMetrics, reportEngine);
    }

    // Scoring
    const volatilityScore = body.marketVolatility === "high" ? 1 : body.marketVolatility === "medium" ? 0.5 : 0;
    const timeScore = body.timeHorizon === "long" ? 1 : body.timeHorizon === "medium" ? 0.5 : 0;
    const directionScore = body.direction === "neutral" ? 1 : body.direction === "bullish" ? 0.5 : 0;
    const riskScore = body.riskTolerance === "conservative" ? 1 : body.riskTolerance === "moderate" ? 0.5 : 0;

    const calendarScore = volatilityScore * 0.3 + timeScore * 0.1 + directionScore * 0.3 + riskScore * 0.3;
    const diagonalScore = (1 - volatilityScore) * 0.2 + timeScore * 0.2 + (1 - directionScore) * 0.3 + (1 - riskScore) * 0.3;

    const recommendation = calendarScore >= diagonalScore ? "calendar" : "diagonal";

    const metricas = determineMetricas(calMetrics, diagMetrics, body.direction, body.riskTolerance);

    const justification = recommendation === "calendar"
      ? `Calendar spread recommended for ${body.marketVolatility} volatility, ${body.timeHorizon} horizon, ${body.direction} outlook. Lower cost ($${calMetrics.cost} vs $${diagMetrics.cost}), neutral delta (${calMetrics.greeks.delta}), and higher POP (${(calMetrics.probabilityOfProfit * 100).toFixed(0)}% vs ${(diagMetrics.probabilityOfProfit * 100).toFixed(0)}%).`
      : `Diagonal spread recommended for ${body.marketVolatility} volatility, ${body.timeHorizon} horizon, ${body.direction} outlook. Directional delta (${diagMetrics.greeks.delta}) aligns with bias, higher max profit ($${diagMetrics.maxProfit} vs $${calMetrics.maxProfit}).`;

    res.status(200).json({
      recommendation,
      justification,
      scores: {
        calendar: Math.round(calendarScore * 100) / 100,
        diagonal: Math.round(diagonalScore * 100) / 100,
      },
      calendar: calMetrics,
      diagonal: diagMetrics,
      metricas,
    } as CompareResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});
