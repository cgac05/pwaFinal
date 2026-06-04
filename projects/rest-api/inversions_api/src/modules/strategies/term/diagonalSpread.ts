/**
 * diagonalSpread.ts — T168 (endpoint REST)
 * Proposito: Ruta POST /api/v1/strategies/term/diagonal.S
 * Orquesta: TermStrategyContract (validacion) -> DiagonalSpreadEngine (analisis con griegas)
 *           -> TermSimulationEngine (Monte Carlo + deterministico)
 *           -> TermReportEngine (reporte estructurado).
 * Llamado por: src/index.ts (registra el router en /api/v1/strategies/term linea 64)
 * Dependencias: termStrategyContract, diagonalSpreadEngine, termSimulationEngine, termReportEngine
 */
import { Router, type Request, type Response } from "express";
import { TermStrategyContract } from "../../../modules/strategies/term/termStrategyContract";
import { DiagonalSpreadEngine } from "../../../modules/strategies/term/diagonalSpreadEngine";
import { TermSimulationEngine } from "../../../modules/strategies/term/termSimulationEngine";
import { TermReportEngine, type PayoffCurvePoint } from "../../../modules/strategies/term/termReportEngine";
import { blackScholesPrice } from "../../../modules/strategies/term/termUtils";

/** Genera curva de payoff suave (50 puntos) para Diagonal Spread al vencimiento de la pata corta.
 *  Vendemos corta (intrínseco en T=0), compramos larga (BS con tiempo restante). */
function buildDiagonalPayoffCurve(
  shortStrike: number,
  longStrike: number,
  optionStyle: "call" | "put",
  contracts: number,
  netDebit: number,
  riskFreeRate: number,
  longIv: number,
  longDte: number
): PayoffCurvePoint[] {
  const steps = 50;
  const center = (shortStrike + longStrike) / 2;
  const min = center * 0.80;
  const max = center * 1.20;
  const step = (max - min) / (steps - 1);
  const longT = Math.max(longDte, 1) / 365;
  const curve: PayoffCurvePoint[] = [];

  for (let i = 0; i < steps; i++) {
    const S = Number((min + i * step).toFixed(2));
    const shortVal = blackScholesPrice(S, shortStrike, 0, riskFreeRate, 0.001, optionStyle);
    const longVal  = blackScholesPrice(S, longStrike,  longT, riskFreeRate, longIv, optionStyle);
    const strategyValue = (longVal - shortVal) * contracts;
    const pnl = Number((strategyValue - netDebit).toFixed(2));
    curve.push({ price: S, payoff: Number(strategyValue.toFixed(2)), pnl });
  }
  return curve;
}

/** Request body para POST /diagonal */
export interface DiagonalRequest {
  legs: Array<{
    strike: number;
    expiration: string;
    premium: number;
    contracts: number;
    optionStyle: "call" | "put";
  }>;
  underlying?: string;
  riskFreeRate?: number;
  ivCurve?: Array<{ dte: number; iv: number }>;
  monteCarlo?: { iterations: number; distribution: "normal" | "lognormal" };
  riskTolerance?: "BAJO" | "MEDIO" | "ALTO";
}

/** Mapea tolerancia a config de Monte Carlo */
function mcConfigFromTolerance(rt?: string): { iterations: number; distribution: "normal" | "lognormal" } {
  if (rt === "BAJO")  return { iterations: 500,  distribution: "normal" };
  if (rt === "ALTO")  return { iterations: 2000, distribution: "lognormal" };
  return { iterations: 1000, distribution: "normal" };
}

/** Mapea tolerancia a parámetros del DiagonalEngine (thetaThreshold, minDteForRoll) */
function engineParamsFromTolerance(rt?: string): { thetaResidualThreshold: number; minDteForRoll: number } {
  if (rt === "BAJO")  return { thetaResidualThreshold: 1.0, minDteForRoll: 14 }; // conservador: ajustar antes
  if (rt === "ALTO")  return { thetaResidualThreshold: 0.2, minDteForRoll: 3  }; // agresivo: ajustar tarde
  return { thetaResidualThreshold: 0.5, minDteForRoll: 7 };                        // moderado: default
}

export const diagonalSpreadRouter = Router();

type DiagonalVariant = "call" | "put";

function buildDiagonalBody(body: DiagonalRequest, variant?: DiagonalVariant): DiagonalRequest {
  if (!variant) {
    return body;
  }

  return {
    ...body,
    legs: body.legs?.map(leg => ({
      ...leg,
      optionStyle: variant,
    })),
  };
}

function getDiagonalStructureName(optionStyle: "call" | "put"): string {
  return optionStyle === "call" ? "Diagonal Call Spread" : "Diagonal Put Spread";
}

function getDiagonalStructureDescription(optionStyle: "call" | "put"): string {
  return optionStyle === "call"
    ? "Pata corta call vendida y pata larga call comprada con strikes y expiraciones diferentes."
    : "Pata corta put vendida y pata larga put comprada con strikes y expiraciones diferentes.";
}

function handleDiagonalSpread(variant?: DiagonalVariant) {
  return (req: Request, res: Response) => {
    try {
      const body = buildDiagonalBody(req.body as DiagonalRequest, variant);

      if (!body.legs || body.legs.length < 2) {
        res.status(400).json({ error: "At least 2 legs are required" });
        return;
      }

      const contract = new TermStrategyContract({
        legs: body.legs.map(l => ({
          ...l,
          expiration: new Date(l.expiration),
        })),
        underlying: body.underlying,
      });

      const validation = contract.validate();
      if (!validation.isValid) {
        res.status(400).json({ error: "Validation failed", details: validation.errors });
        return;
      }

      if (contract.getType() !== "diagonal") {
        res.status(400).json({
          error: "Invalid strategy type",
          details: ["Diagonal endpoint requires different strikes. Use /calendar endpoint for same-strike spreads."],
        });
        return;
      }

      const resolvedVariant = contract.getLegs()[0].optionStyle;

      const sortedLegs = [...body.legs].sort(
        (a, b) => new Date(a.expiration).getTime() - new Date(b.expiration).getTime()
      );
      const netEntryCost = sortedLegs[1].premium * sortedLegs[1].contracts
        - sortedLegs[0].premium * sortedLegs[0].contracts;

      const { thetaResidualThreshold, minDteForRoll } = engineParamsFromTolerance(body.riskTolerance);
      const engine = new DiagonalSpreadEngine(
        contract, body.riskFreeRate ?? 0.05, body.ivCurve ?? [], thetaResidualThreshold, minDteForRoll
      );
      const result = engine.analyze();

      const simulation = new TermSimulationEngine(contract, null, engine, body.riskFreeRate ?? 0.05, body.ivCurve ?? []);
      const mcConfig = body.monteCarlo ?? mcConfigFromTolerance(body.riskTolerance);
      const simResult = simulation.simulate(undefined, mcConfig);

      const report = new TermReportEngine(null, result, simResult, null);
      const reportData = report.generateReport();

      // Reemplazar payoffCurve con curva suave de 50 puntos y fórmula correcta
      const ivCurveArr = body.ivCurve ?? [];
      const longIv = ivCurveArr.length > 0 ? ivCurveArr[ivCurveArr.length - 1].iv : 0.25;
      reportData.payoffCurve = buildDiagonalPayoffCurve(
        sortedLegs[0].strike, sortedLegs[1].strike, resolvedVariant,
        sortedLegs[0].contracts ?? 1, netEntryCost,
        body.riskFreeRate ?? 0.05, longIv, result.longDte
      );

      res.status(200).json({
        strategy: "diagonal",
        variant: resolvedVariant,
        structureName: getDiagonalStructureName(resolvedVariant),
        structureDescription: getDiagonalStructureDescription(resolvedVariant),
        netEntryCost: Math.round(netEntryCost * 100) / 100,
        analysis: {
          shortDte: result.shortDte,
          longDte: result.longDte,
          greeks: result.greeks,
          directionalProfile: result.directionalProfile,
          adjustmentWindow: result.adjustmentWindow,
        },
        scenarios: result.scenarios,
        thetaDecayProfile: result.thetaDecayProfile,
        vegaShockProfile: result.vegaShockProfile,
        simulation: {
          deterministic: simResult.deterministic,
          monteCarlo: simResult.monteCarlo,
        },
        report: reportData,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  };
}

/**
 * @openapi
 * /diagonal:
 *   post:
 *     tags: [Diagonal Spread]
 *     summary: Calcula metricas y escenarios de un Diagonal Spread
 *     description: >
 *       Evalua un Diagonal Spread (call/put) recibiendo las dos patas con strikes
 *       y expiraciones diferentes. Retorna griegas (delta, gamma, theta, vega),
 *       perfiles de riesgo, escenarios, simulacion y reporte completo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [legs]
 *             properties:
 *               legs:
 *                 type: array
 *                 minItems: 2
 *                 items:
 *                   type: object
 *                   properties:
 *                     strike:       { type: number, example: 95 }
 *                     expiration:   { type: string, format: date, example: "2026-06-19" }
 *                     premium:      { type: number, example: 3.50 }
 *                     contracts:    { type: integer, example: 1 }
 *                     optionStyle:  { type: string, enum: [call, put], example: "call" }
 *               riskFreeRate: { type: number, example: 0.05 }
 *               ivCurve:      { type: array, items: { type: object, properties: { dte: { type: integer }, iv: { type: number } } } }
 *               monteCarlo:   { type: object, properties: { iterations: { type: integer }, distribution: { type: string, enum: [normal, lognormal] } } }
 *     responses:
 *       200:
 *         description: Diagonal Spread calculado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 strategy:           { type: string, example: "diagonal" }
 *                 variant:            { type: string, enum: [call, put] }
 *                 structureName:      { type: string, example: "Diagonal Call Spread" }
 *                 structureDescription: { type: string }
 *                 netEntryCost:       { type: number }
 *                 analysis:           { type: object, properties: { shortDte: { type: integer }, longDte: { type: integer }, greeks: { type: object }, directionalProfile: { type: string }, adjustmentWindow: { type: object } } }
 *                 scenarios:          { type: array, items: { type: object } }
 *                 thetaDecayProfile:  { type: array, items: { type: object } }
 *                 vegaShockProfile:   { type: array, items: { type: object } }
 *                 simulation:         { type: object, properties: { deterministic: { type: array }, monteCarlo: { type: object } } }
 *                 report:             { type: object }
 *       400:
 *         description: Error de validacion
 *       500:
 *         description: Error interno del servidor
 *
 * /diagonal/call:
 *   post:
 *     tags: [Diagonal Spread]
 *     summary: Calcula Diagonal Call Spread
 *     description: Alias explicito de Diagonal Spread que fuerza optionStyle=call en todas las patas.
 *
 * /diagonal/put:
 *   post:
 *     tags: [Diagonal Spread]
 *     summary: Calcula Diagonal Put Spread
 *     description: Alias explicito de Diagonal Spread que fuerza optionStyle=put en todas las patas.
 */
/** POST /diagonal: valida contrato, verifica que sea diagonal (strikes distintos), analiza, simula, genera reporte. Llamado desde src/index.ts linea 64 */
diagonalSpreadRouter.post("/diagonal", handleDiagonalSpread());

/** POST /diagonal/call: alias explicito para Diagonal Call Spread. */
diagonalSpreadRouter.post("/diagonal/call", handleDiagonalSpread("call"));

/** POST /diagonal/put: alias explicito para Diagonal Put Spread. */
diagonalSpreadRouter.post("/diagonal/put", handleDiagonalSpread("put"));
