/**
 * termRiskEngine.ts — T166
 * Proposito: Analisis de riesgo con limites por vencimiento/concentracion/theta,
 * evaluacion de riesgo de asignacion temprana, reglas de stop-loss (fixed/percentage/trailing),
 * y generacion de alertas push/email.
 * Llamado por: TermRollOrchestrator (importa tipo RiskAnalysis),
 *              (los endpoints de ruta lo usan indirectamente via termReportEngine)
 * Dependencias: termStrategyContract, termUtils
 */
import { buildCanonicalOutputString } from "@inversions/utils";
import { TermStrategyContract, type TermLeg } from "./termStrategyContract";
import { blackScholesPrice, daysToExpiration } from "./termUtils";

export interface RiskLimits {
  maxConcentrationPct: number;
  maxExpirationDate: Date;
  maxNegativeTheta: number;
}

export interface EarlyAssignmentRisk {
  isAtRisk: boolean;
  probability: number;
  reason: string;
  leg: TermLeg;
}

export interface StopLossRule {
  type: "fixed" | "percentage" | "trailing";
  value: number;
  triggered: boolean;
  currentDrawdown: number;
  message: string;
}

export interface RiskAlert {
  type: "push" | "email";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface RiskAnalysis {
  limitsViolation: boolean;
  violations: string[];
  earlyAssignmentRisk: EarlyAssignmentRisk | null;
  stopLossRules: StopLossRule[];
  alerts: RiskAlert[];
  portfolioExposure: number;
  thetaExposure: number;
}

/** Calcula la exposicion del portafolio como prima total / valor portafolio. Usado por TermRiskEngine.analyze() */
export function calculatePortfolioExposure(legs: TermLeg[], portfolioValue: number): number {
  const totalPremium = legs.reduce((sum, leg) => sum + leg.premium * leg.contracts, 0);
  return portfolioValue > 0 ? totalPremium / portfolioValue : 0;
}

/** Estima max drawdown como |theta| * DTE. Usado por TermRiskEngine.evaluateStopLossRules() */
export function calculateMaxDrawdownFromGreeks(theta: number, dte: number): number {
  if (dte <= 0) return 0;
  return Math.abs(theta) * dte;
}

export class TermRiskEngine {
  private readonly contract: TermStrategyContract;
  private readonly portfolioValue: number;
  private readonly riskLimits: RiskLimits;

  /** Construye el Risk Engine con contrato, valor del portafolio (default 100k) y limites configurables (concentracion 10%, expiracion 1 ano, theta -10) */
  constructor(
    contract: TermStrategyContract,
    portfolioValue: number = 100000,
    riskLimits?: Partial<RiskLimits>
  ) {
    this.contract = contract;
    this.portfolioValue = portfolioValue;

    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    this.riskLimits = {
      maxConcentrationPct: 0.1,
      maxExpirationDate: oneYearFromNow,
      maxNegativeTheta: -10,
      ...riskLimits,
    };
  }

  /** Analiza riesgos: limites de concentracion/expiracion/theta, riesgo de asignacion temprana, stop-loss, alertas. Llamado indirectamente por routes via report engine */
  analyze(
    netTheta: number,
    netGamma?: number
  ): RiskAnalysis {
    const violations: string[] = [];
    const alerts: RiskAlert[] = [];

    const legs = this.contract.getLegs();
    const portfolioExposure = calculatePortfolioExposure(legs, this.portfolioValue);

    if (portfolioExposure > this.riskLimits.maxConcentrationPct) {
      violations.push(
        `Portfolio concentration ${(portfolioExposure * 100).toFixed(1)}% exceeds limit ${(this.riskLimits.maxConcentrationPct * 100).toFixed(1)}%`
      );
      alerts.push({
        type: "push", severity: "high",
        message: `Concentration limit breached: ${(portfolioExposure * 100).toFixed(1)}%`,
        timestamp: new Date(), data: { portfolioExposure, limit: this.riskLimits.maxConcentrationPct },
      });
    }

    for (const leg of legs) {
      if (leg.expiration > this.riskLimits.maxExpirationDate) {
        violations.push(
          `Leg expiration ${leg.expiration.toISOString().split('T')[0]} exceeds max allowed ${this.riskLimits.maxExpirationDate.toISOString().split('T')[0]}`
        );
        alerts.push({
          type: "email", severity: "critical",
          message: `Expiration limit exceeded for leg with strike ${leg.strike}`,
          timestamp: new Date(), data: { leg },
        });
      }
    }

    if (netTheta < this.riskLimits.maxNegativeTheta) {
      violations.push(
        `Net theta ${netTheta.toFixed(2)} exceeds max negative theta limit ${this.riskLimits.maxNegativeTheta}`
      );
      alerts.push({
        type: "push", severity: "high",
        message: `Theta exposure critical: ${netTheta.toFixed(2)}`,
        timestamp: new Date(), data: { netTheta, limit: this.riskLimits.maxNegativeTheta },
      });
    }

    const earlyAssignmentRisk = this.evaluateEarlyAssignmentRisk();
    if (earlyAssignmentRisk) {
      alerts.push({
        type: "push", severity: "medium",
        message: `Early assignment risk detected: ${earlyAssignmentRisk.reason}`,
        timestamp: new Date(), data: { leg: earlyAssignmentRisk.leg },
      });
    }

    const stopLossRules = this.evaluateStopLossRules(netTheta);

    return {
      limitsViolation: violations.length > 0,
      violations,
      earlyAssignmentRisk,
      stopLossRules,
      alerts,
      portfolioExposure: Math.round(portfolioExposure * 1000) / 1000,
      thetaExposure: Math.round(netTheta * 100) / 100,
    };
  }

  /** Evalua riesgo de asignacion temprana: detecta pata corta ITM profunda con DTE < 14 */
  private evaluateEarlyAssignmentRisk(): EarlyAssignmentRisk | null {
    const legs = this.contract.getLegs();
    const now = new Date();

    const sortedByExpiration = [...legs].sort(
      (a, b) => a.expiration.getTime() - b.expiration.getTime()
    );
    const shortLeg = sortedByExpiration[0];

    const shortDte = daysToExpiration(shortLeg.expiration, now);
    if (shortDte <= 0) return null;

    const shortT = shortDte / 365;

    const callPrice = blackScholesPrice(
      shortLeg.strike, shortLeg.strike, shortT, 0.05, 0.2, shortLeg.optionStyle
    );

    const isItmShort = shortLeg.optionStyle === "call"
      ? callPrice > shortLeg.strike * 0.1
      : callPrice > shortLeg.strike * 0.1;

    if (!isItmShort) return null;

    const probability = shortDte < 7 ? 0.3 : shortDte < 14 ? 0.15 : 0.05;

    const isDeepItm = shortLeg.optionStyle === "call"
      ? callPrice > shortLeg.strike * 0.3
      : callPrice > shortLeg.strike * 0.3;

    return {
      isAtRisk: isDeepItm && shortDte < 14,
      probability: Math.round(probability * 100) / 100,
      reason: isDeepItm && shortDte < 14
        ? `Short leg is deep ITM with ${shortDte} DTE. Early assignment possible.`
        : `Short leg shows ITM characteristics. Monitor closely.`,
      leg: shortLeg,
    };
  }

  /** Evalua 3 reglas de stop-loss: fixed (50% prima), percentage (20% capital), trailing (5x theta) */
  private evaluateStopLossRules(netTheta: number): StopLossRule[] {
    const legs = this.contract.getLegs();
    const totalPremiumPaid = legs.reduce((sum, leg) => sum + leg.premium * leg.contracts, 0);

    const now = new Date();
    const sortedByExpiration = [...legs].sort(
      (a, b) => a.expiration.getTime() - b.expiration.getTime()
    );
    const shortDte = daysToExpiration(sortedByExpiration[0].expiration, now);

    const maxDrawdownEstimate = calculateMaxDrawdownFromGreeks(Math.abs(netTheta), shortDte);
    const currentDrawdownPct = totalPremiumPaid > 0 ? maxDrawdownEstimate / totalPremiumPaid : 0;

    return [
      {
        type: "fixed",
        value: totalPremiumPaid * 0.5,
        triggered: maxDrawdownEstimate > totalPremiumPaid * 0.5,
        currentDrawdown: Math.round(maxDrawdownEstimate * 100) / 100,
        message: `Fixed stop-loss at 50% of premium ($${(totalPremiumPaid * 0.5).toFixed(2)})`,
      },
      {
        type: "percentage",
        value: 0.2,
        triggered: currentDrawdownPct > 0.2,
        currentDrawdown: Math.round(currentDrawdownPct * 100) / 100,
        message: `Percentage stop-loss at 20% of capital. Current drawdown: ${(currentDrawdownPct * 100).toFixed(1)}%`,
      },
      {
        type: "trailing",
        value: Math.abs(netTheta) * 5,
        triggered: maxDrawdownEstimate > Math.abs(netTheta) * 5,
        currentDrawdown: Math.round(maxDrawdownEstimate * 100) / 100,
        message: `Trailing stop-loss based on theta decay. Threshold: $${(Math.abs(netTheta) * 5).toFixed(2)}`,
      },
    ];
  }

  /** Retorna el contrato */
  getContract(): TermStrategyContract {
    return this.contract;
  }

  /** Genera señal de riesgo basada en el análisis completo — formato canónico */
  signal(netTheta: number, netGamma?: number): string {
    const analysis = this.analyze(netTheta, netGamma);
    let tipoSenal: "CALL" | "PUT" | "HOLD";
    let score: number;
    let objetivo: string;
    let senal: string;
    if (analysis.limitsViolation) {
      tipoSenal = "PUT";
      score = 0.9;
      objetivo = "Risk Engine detecta violación de límites de riesgo";
      senal = "RISK_LIMIT_VIOLATION";
    } else if (analysis.earlyAssignmentRisk?.isAtRisk) {
      tipoSenal = "PUT";
      score = 0.7;
      objetivo = "Risk Engine detecta riesgo de asignación temprana";
      senal = "EARLY_ASSIGNMENT_RISK";
    } else {
      tipoSenal = "HOLD";
      score = 0;
      objetivo = "Risk Engine sin anomalías detectadas";
      senal = "RISK_OK";
    }
    return buildCanonicalOutputString({
      core: "E_ESTRATEGIA",
      subCore: "risk_engine",
      tipoSenal,
      score,
      peso: 1,
      observacion: {
        objetivo,
        senal,
        explicacion: `Risk: limitsViolation=${analysis.limitsViolation}, earlyAssignment=${analysis.earlyAssignmentRisk?.isAtRisk ?? false}`,
        metricas: {
          limitsViolation: analysis.limitsViolation ? 1 : 0,
          earlyAssignmentRisk: analysis.earlyAssignmentRisk?.isAtRisk ? 1 : 0,
        },
      },
    });
  }
}
