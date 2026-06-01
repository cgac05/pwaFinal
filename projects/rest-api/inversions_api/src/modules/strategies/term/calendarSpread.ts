/**
 * calendarSpread.ts — T168 (endpoint REST)
 * Proposito: Rutas POST /api/v1/strategies/term/calendar,
 *            /api/v1/strategies/term/calendar/call y
 *            /api/v1/strategies/term/calendar/put.
 * Orquesta: TermStrategyContract (validacion) -> CalendarSpreadEngine (analisis)
 *           -> TermSimulationEngine (Monte Carlo + deterministico)
 *           -> TermReportEngine (reporte estructurado).
 * Llamado por: src/index.ts (registra el router en /api/v1/strategies/term linea 63)
 * Dependencias: termStrategyContract, calendarSpreadEngine, termSimulationEngine, termReportEngine
 */
import { Router, type Request, type Response } from "express";
import { TermStrategyContract } from "../../../modules/strategies/term/termStrategyContract";
import { CalendarSpreadEngine } from "../../../modules/strategies/term/calendarSpreadEngine";
import { TermSimulationEngine } from "../../../modules/strategies/term/termSimulationEngine";
import { TermReportEngine, type PayoffCurvePoint } from "../../../modules/strategies/term/termReportEngine";
import { blackScholesPrice } from "../../../modules/strategies/term/termUtils";

/** Genera curva de payoff suave (50 puntos) para Calendar Spread al vencimiento de la pata corta.
 *  Fórmula correcta: posición = long(S,T_long) - short(S,0) — vendemos corta, compramos larga. */
function buildCalendarPayoffCurve(
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
  const min = shortStrike * 0.80;
  const max = shortStrike * 1.20;
  const step = (max - min) / (steps - 1);
  const longT = Math.max(longDte, 1) / 365;
  const curve: PayoffCurvePoint[] = [];

  for (let i = 0; i < steps; i++) {
    const S = Number((min + i * step).toFixed(2));
    // Short leg expired: solo valor intrínseco (T=0)
    const shortVal = blackScholesPrice(S, shortStrike, 0, riskFreeRate, 0.001, optionStyle);
    // Long leg: aún tiene tiempo
    const longVal  = blackScholesPrice(S, longStrike,  longT, riskFreeRate, longIv, optionStyle);
    // Vendemos corta (-shortVal) y compramos larga (+longVal)
    const strategyValue = (longVal - shortVal) * contracts;
    const pnl = Number((strategyValue - netDebit).toFixed(2));
    curve.push({ price: S, payoff: Number(strategyValue.toFixed(2)), pnl });
  }
  return curve;
}

/** Request body para POST /calendar, /calendar/call y /calendar/put */
export interface CalendarRequest {
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

/** Mapea tolerancia de riesgo a config de Monte Carlo */
function mcConfigFromTolerance(riskTolerance?: string): { iterations: number; distribution: "normal" | "lognormal" } {
  if (riskTolerance === "BAJO")  return { iterations: 500,  distribution: "normal" };
  if (riskTolerance === "ALTO")  return { iterations: 2000, distribution: "lognormal" };
  return { iterations: 1000, distribution: "normal" }; // MEDIO default
}

export const calendarSpreadRouter = Router();

type CalendarVariant = "call" | "put";

function buildCalendarBody(body: CalendarRequest, variant?: CalendarVariant): CalendarRequest {
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

function getCalendarVariant(contract: TermStrategyContract): CalendarVariant {
  return contract.getLegs()[0].optionStyle;
}

function getCalendarVariantLabel(variant: CalendarVariant): string {
  return variant === "call" ? "Calendar Call Spread" : "Calendar Put Spread";
}

function handleCalendarSpread(variant?: CalendarVariant) {
  return (req: Request, res: Response) => {
    try {
      const body = buildCalendarBody(req.body as CalendarRequest, variant);

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

      if (contract.getType() !== "calendar") {
        res.status(400).json({
          error: "Invalid strategy type",
          details: ["Calendar endpoint requires same strike and different expirations."],
        });
        return;
      }

      const resolvedVariant = getCalendarVariant(contract);
      const engine = new CalendarSpreadEngine(
        contract, body.riskFreeRate ?? 0.05, body.ivCurve ?? []
      );
      const result = engine.analyze();

      const simulation = new TermSimulationEngine(contract, engine, null, body.riskFreeRate ?? 0.05, body.ivCurve ?? []);
      const mcConfig = body.monteCarlo ?? mcConfigFromTolerance(body.riskTolerance);
      const simResult = simulation.simulate(undefined, mcConfig);

      const report = new TermReportEngine(result, null, simResult, null);
      const reportData = report.generateReport();

      // Reemplazar payoffCurve con curva suave de 50 puntos y fórmula correcta
      const sortedLegs = [...body.legs].sort(
        (a, b) => new Date(a.expiration).getTime() - new Date(b.expiration).getTime()
      );
      const shortLeg = sortedLegs[0];
      const longLeg  = sortedLegs[sortedLegs.length - 1];
      const netDebit = (longLeg.premium - shortLeg.premium) * (shortLeg.contracts ?? 1);
      const ivCurveArr = body.ivCurve ?? [];
      const longIv = ivCurveArr.length > 0 ? ivCurveArr[ivCurveArr.length - 1].iv : 0.25;
      reportData.payoffCurve = buildCalendarPayoffCurve(
        shortLeg.strike, longLeg.strike, resolvedVariant,
        shortLeg.contracts ?? 1, netDebit,
        body.riskFreeRate ?? 0.05, longIv, result.longDte
      );

      res.status(200).json({
        strategy: "calendar",
        variant: resolvedVariant,
        structureName: getCalendarVariantLabel(resolvedVariant),
        structureDescription: resolvedVariant === "call"
          ? "Short near-term call plus long later-term call at the same strike."
          : "Short near-term put plus long later-term put at the same strike.",
        analysis: {
          shortDte: result.shortDte,
          longDte: result.longDte,
          shortTheta: result.shortTheta,
          longTheta: result.longTheta,
          netTheta: result.netTheta,
        },
        scenarios: result.scenarios,
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
 * /calendar:
 *   post:
 *     tags: [Calendar Spread]
 *     summary: Calcula metricas y escenarios de un Calendar Spread
 *     description: >
 *       Evalua un Calendar Spread (call/put) recibiendo las dos patas del spread
 *       con el mismo strike y expiraciones diferentes. Retorna metricas de theta decay,
 *       escenarios de precio, simulacion Monte Carlo/determinista y reporte completo.
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
 *                     strike:       { type: number, example: 100 }
 *                     expiration:   { type: string, format: date, example: "2026-06-19" }
 *                     premium:      { type: number, example: 2.50 }
 *                     contracts:    { type: integer, example: 1 }
 *                     optionStyle:  { type: string, enum: [call, put], example: "call" }
 *               riskFreeRate: { type: number, example: 0.05 }
 *               ivCurve:      { type: array, items: { type: object, properties: { dte: { type: integer }, iv: { type: number } } } }
 *               monteCarlo:   { type: object, properties: { iterations: { type: integer }, distribution: { type: string, enum: [normal, lognormal] } } }
 *     responses:
 *       200:
 *         description: Calendar Spread calculado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 strategy:  { type: string, example: "calendar" }
 *                 analysis:  { type: object, properties: { shortDte: { type: integer }, longDte: { type: integer }, netTheta: { type: number } } }
 *                 scenarios: { type: array, items: { type: object } }
 *                 simulation: { type: object, properties: { deterministic: { type: array }, monteCarlo: { type: object } } }
 *                 report:    { type: object }
 *       400:
 *         description: Error de validacion
 *       500:
 *         description: Error interno del servidor
 *
 * /calendar/call:
 *   post:
 *     tags: [Calendar Spread]
 *     summary: Calcula Calendar Call Spread
 *     description: Alias explicito de Calendar Spread que fuerza optionStyle=call en todas las patas.
 *
 * /calendar/put:
 *   post:
 *     tags: [Calendar Spread]
 *     summary: Calcula Calendar Put Spread
 *     description: Alias explicito de Calendar Spread que fuerza optionStyle=put en todas las patas.
 */
/** POST /calendar: conserva compatibilidad y usa optionStyle recibido en las patas. */
calendarSpreadRouter.post("/calendar", handleCalendarSpread());

/** POST /calendar/call: alias explicito para Calendar Call Spread. */
calendarSpreadRouter.post("/calendar/call", handleCalendarSpread("call"));

/** POST /calendar/put: alias explicito para Calendar Put Spread. */
calendarSpreadRouter.post("/calendar/put", handleCalendarSpread("put"));
