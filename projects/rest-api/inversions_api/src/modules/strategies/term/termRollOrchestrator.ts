/**
 * termRollOrchestrator.ts — T169
 * Proposito: Evalua si una posicion de estrategia temporal debe hacerse roll (renovacion)
 * o cerrarse anticipadamente. Dispara reglas basadas en theta residual, exposicion gamma,
 * DTE minimo, y violaciones de limites de riesgo.
 * Llamado por: (no directamente por rutas — modulo de orquestacion interna,
 *              disponible para integracion futura con orquestador global)
 * Dependencias: termStrategyContract, termUtils, termRiskEngine (tipo RiskAnalysis)
 */
import { buildCanonicalOutputString } from "@inversions/utils";
import { TermStrategyContract, type TermLeg } from "./termStrategyContract";
import { blackScholesPrice, daysToExpiration } from "./termUtils";
import type { RiskAnalysis } from "./termRiskEngine";

/** Tipos de schedule para roll: calendar (dias fijos), trigger (solo por condiciones), hybrid (ambos) */
export type RollTriggerType = "calendar" | "trigger" | "hybrid";

/** Schedule de roll: tipo, array de dias antes de expiracion, y periodicidad opcional en dias */
export interface RollSchedule {
  type: RollTriggerType;
  daysBeforeExpiration: number[];
  periodicDays?: number;
}

/** Resultado de evaluacion de triggers para roll: 4 condiciones booleanas + flag agregado + razones */
export interface RollTriggerEvaluation {
  thetaResidualTriggered: boolean;
  gammaExposureTriggered: boolean;
  dteMinTriggered: boolean;
  riskLimitViolationTriggered: boolean;
  triggered: boolean;
  reasons: string[];
}

/** Costo estimado del roll: diferencial de prima, costo de transaccion, total, y riesgo post-roll */
export interface RollCost {
  premiumDifferential: number;
  transactionCost: number;
  totalCost: number;
  postRollRiskDelta: number;
  postRollRiskTheta: number;
}

/** Recomendacion final de roll: flag roll, flag cierre temprano, triggers, costo, texto explicativo y timing */
export interface RollRecommendation {
  shouldRoll: boolean;
  shouldCloseEarly: boolean;
  triggers: RollTriggerEvaluation;
  cost: RollCost | null;
  recommendation: string;
  timing: string;
}

export class TermRollOrchestrator {
  private readonly contract: TermStrategyContract;
  private readonly riskAnalysis: RiskAnalysis | null;
  private readonly netTheta: number;
  private readonly netGamma: number;
  private readonly schedule: RollSchedule;
  private readonly thetaResidualThreshold: number;
  private readonly minDteForRoll: number;

  /** Construye el orquestador con contrato, analisis de riesgo, theta/gamma netos, schedule (default hybrid [7,3,1] c/5d), threshold theta (0.5) y DTE minimo (7) */
  constructor(
    contract: TermStrategyContract,
    riskAnalysis: RiskAnalysis | null,
    netTheta: number,
    netGamma: number = 0,
    schedule?: Partial<RollSchedule>,
    thetaResidualThreshold?: number,
    minDteForRoll?: number
  ) {
    this.contract = contract;
    this.riskAnalysis = riskAnalysis;
    this.netTheta = netTheta;
    this.netGamma = netGamma;
    this.thetaResidualThreshold = thetaResidualThreshold ?? 0.5;
    this.minDteForRoll = minDteForRoll ?? 7;

    this.schedule = {
      type: "hybrid",
      daysBeforeExpiration: [7, 3, 1],
      periodicDays: 5,
      ...schedule,
    };
  }

  /** Evalua si se debe hacer roll: ordena legs por expiracion, evalua triggers, calcula costo, construye recomendacion. Punto de entrada principal */
  evaluate(): RollRecommendation {
    const legs = this.contract.getLegs();
    const now = new Date();

    const sortedByExpiration = [...legs].sort(
      (a, b) => a.expiration.getTime() - b.expiration.getTime()
    );
    const shortLeg = sortedByExpiration[0];
    const longLeg = sortedByExpiration[sortedByExpiration.length - 1];

    const shortDte = daysToExpiration(shortLeg.expiration, now);
    const longDte = daysToExpiration(longLeg.expiration, now);

    const triggers = this.evaluateTriggers(shortDte);
    const cost = this.calculateRollCost(shortLeg, longLeg, shortDte);

    let shouldRoll = triggers.triggered;
    let shouldCloseEarly = false;

    if (this.riskAnalysis?.limitsViolation) {
      shouldRoll = true;
      shouldCloseEarly = true;
    }

    if (shortDte <= 0) {
      shouldRoll = false;
      shouldCloseEarly = true;
    }

    const recommendation = this.buildRecommendation(
      triggers, shouldRoll, shouldCloseEarly, cost, shortDte, longDte
    );

    const timing = this.suggestTiming(shortDte);

    return { shouldRoll, shouldCloseEarly, triggers, cost, recommendation, timing };
  }

  /** Evalua 4 triggers: theta residual bajo, gamma exposure alto, DTE minimo, violacion limites riesgo */
  private evaluateTriggers(shortDte: number): RollTriggerEvaluation {
    const reasons: string[] = [];
    const thetaResidualTriggered = Math.abs(this.netTheta) < this.thetaResidualThreshold;
    const gammaExposureTriggered = Math.abs(this.netGamma) > 0.05;
    const dteMinTriggered = shortDte <= this.minDteForRoll;
    const riskLimitViolationTriggered = this.riskAnalysis?.limitsViolation ?? false;

    if (thetaResidualTriggered) reasons.push(`Theta residual ${Math.abs(this.netTheta).toFixed(2)} below threshold ${this.thetaResidualThreshold}`);
    if (gammaExposureTriggered) reasons.push(`Gamma exposure ${Math.abs(this.netGamma).toFixed(3)} exceeds 0.05`);
    if (dteMinTriggered) reasons.push(`Short DTE (${shortDte}) at or below minimum (${this.minDteForRoll})`);
    if (riskLimitViolationTriggered) reasons.push("Risk limit violation detected");

    return {
      thetaResidualTriggered,
      gammaExposureTriggered,
      dteMinTriggered,
      riskLimitViolationTriggered,
      triggered: thetaResidualTriggered || gammaExposureTriggered || dteMinTriggered || riskLimitViolationTriggered,
      reasons,
    };
  }

  /** Calcula costo estimado: diferencial prima entre short actual y nuevo short a 30d, mas 1% costo transaccion. Retorna null si DTE <= 0 */
  private calculateRollCost(
    shortLeg: TermLeg,
    longLeg: TermLeg,
    shortDte: number
  ): RollCost | null {
    if (shortDte <= 0) return null;

    const shortT = shortDte / 365;
    const longT = (shortDte + 30) / 365;

    const currentShortPrice = blackScholesPrice(
      shortLeg.strike, shortLeg.strike, shortT, 0.05, 0.2, shortLeg.optionStyle
    );
    const newShortPrice = blackScholesPrice(
      shortLeg.strike, shortLeg.strike, longT, 0.05, 0.2, shortLeg.optionStyle
    );

    const premiumDifferential = newShortPrice - currentShortPrice;
    const transactionCost = 0.01 * (currentShortPrice + newShortPrice);

    return {
      premiumDifferential: Math.round(premiumDifferential * 100) / 100,
      transactionCost: Math.round(transactionCost * 100) / 100,
      totalCost: Math.round((premiumDifferential + transactionCost) * 100) / 100,
      postRollRiskDelta: Math.round(0.3 * 1000) / 1000,
      postRollRiskTheta: Math.round(this.netTheta * 1.2 * 100) / 100,
    };
  }

  /** Construye texto de recomendacion segun estado: cierre urgente si expiro o violacion, roll si triggers, "no roll needed" si todo ok */
  private buildRecommendation(
    triggers: RollTriggerEvaluation,
    shouldRoll: boolean,
    shouldCloseEarly: boolean,
    cost: RollCost | null,
    shortDte: number,
    longDte: number
  ): string {
    if (shouldCloseEarly && shortDte <= 0) {
      return "Short leg has expired. Close position immediately.";
    }

    if (shouldCloseEarly && this.riskAnalysis?.limitsViolation) {
      return "Risk limits violated. Recommend closing position early to reduce exposure.";
    }

    if (shouldRoll && cost) {
      return `Roll recommended. Short DTE: ${shortDte}, Long DTE: ${longDte}. ` +
        `Estimated roll cost: $${cost.totalCost}. ` +
        `Triggers: ${triggers.reasons.join("; ")}.`;
    }

    if (shouldRoll) {
      return `Roll recommended but cost could not be estimated. Triggers: ${triggers.reasons.join("; ")}.`;
    }

    return `No roll needed. Short DTE: ${shortDte}, Theta residual: ${Math.abs(this.netTheta).toFixed(2)}.`;
  }

  /** Sugiere timing humano segun DTE: <=0 "Immediate", <=3 "Today", <=7 "Within 2 days", <=14 "Within this week", sino en semanas */
  private suggestTiming(shortDte: number): string {
    if (shortDte <= 0) return "Immediate";
    if (shortDte <= 3) return "Today";
    if (shortDte <= 7) return "Within 2 days";
    if (shortDte <= 14) return "Within this week";
    return `In ${Math.floor(shortDte / 7)} weeks`;
  }

  /** Retorna el contrato */
  getContract(): TermStrategyContract {
    return this.contract;
  }

  /** Genera señal de trading basada en la evaluación de roll — formato canónico */
  signal(): string {
    const result = this.evaluate();
    let tipoSenal: "CALL" | "PUT" | "HOLD";
    let score: number;
    let objetivo: string;
    let senal: string;

    if (result.shouldCloseEarly) {
      tipoSenal = "PUT";
      score = 0.8;
      objetivo = "Roll Orchestrator recomienda cierre anticipado";
      senal = "CLOSE";
    } else if (result.shouldRoll) {
      tipoSenal = "CALL";
      score = 0.6;
      objetivo = "Roll Orchestrator recomienda renovar posición";
      senal = "ROLL";
    } else {
      tipoSenal = "HOLD";
      score = 0;
      objetivo = "Roll Orchestrator sin acción requerida";
      senal = "HOLD";
    }

    return buildCanonicalOutputString({
      core: "E_ESTRATEGIA",
      subCore: "roll_orchestrator",
      tipoSenal,
      score,
      peso: 1,
      observacion: {
        objetivo,
        senal,
        explicacion: result.recommendation,
        metricas: {
          shouldRoll: result.shouldRoll ? 1 : 0,
          shouldCloseEarly: result.shouldCloseEarly ? 1 : 0,
          totalCost: result.cost?.totalCost ?? 0,
        },
      },
    });
  }
}
