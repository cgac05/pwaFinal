/**
 * termChatAssistant.ts — S-T09-C01
 * Proposito: Genera explicaciones en lenguaje natural sobre el proposito, riesgo y
 * condiciones de uso de estrategias Calendar/Diagonal. NO autoriza ejecucion (RNF-001).
 * Llamado por: (no directamente por rutas — disponible para integracion con Chat IA del frontend)
 * Dependencias: calendarSpreadEngine (tipo CalendarSpreadResult),
 *               diagonalSpreadEngine (tipo RiskProfile),
 *               termSimulationEngine (tipo SimulationResult),
 *               termRiskEngine (tipo RiskAnalysis)
 */
import { buildCanonicalOutputString } from "@inversions/utils";
import type { CalendarSpreadResult } from "./calendarSpreadEngine";
import type { RiskProfile } from "./diagonalSpreadEngine";
import type { SimulationResult } from "./termSimulationEngine";
import type { RiskAnalysis } from "./termRiskEngine";

/** Contexto extraido de la estrategia para generar explicacion: tipo, strikes, DTE, griegas, perfil direccional */
export interface ChatContext {
  strategyType: "calendar" | "diagonal";
  optionStyle: "call" | "put";
  shortStrike: number;
  longStrike: number;
  shortDte: number;
  longDte: number;
  netTheta: number;
  netDelta: number;
  directionalProfile: string;
}

/** Explicacion estructurada en lenguaje natural: proposito, perfil riesgo, condiciones, resumen escenarios, disclaimer */
export interface ChatExplanation {
  purpose: string;
  riskProfile: string;
  usageConditions: string;
  scenarioSummary: string;
  disclaimer: string;
  structuredOutput: {
    purpose: string;
    conditions: string[];
    risks: string[];
    metrics: Record<string, number | string>;
  };
}

const DISCLAIMER = "IMPORTANT: This explanation is for informational and educational purposes only. " +
  "It does not constitute financial advice, investment recommendation, or solicitation to trade. " +
  "Options trading involves substantial risk and is not suitable for all investors. " +
  "Past performance does not guarantee future results. Always consult with a qualified financial advisor.";

export class TermChatAssistant {
  private readonly calendarResult: CalendarSpreadResult | null;
  private readonly diagonalResult: RiskProfile | null;
  private readonly simulationResult: SimulationResult | null;
  private readonly riskAnalysis: RiskAnalysis | null;

  /** Recibe resultados de calendar, diagonal, simulacion y riesgo para generar explicaciones en lenguaje natural */
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

  /** Extrae contexto de calendarResult o diagonalResult para alimentar las explicaciones */
  getContext(): ChatContext | null {
    if (this.calendarResult) {
      return {
        strategyType: "calendar",
        optionStyle: "call",
        shortStrike: 0,
        longStrike: 0,
        shortDte: this.calendarResult.shortDte,
        longDte: this.calendarResult.longDte,
        netTheta: this.calendarResult.netTheta,
        netDelta: 0,
        directionalProfile: "neutral",
      };
    }

    if (this.diagonalResult) {
      return {
        strategyType: "diagonal",
        optionStyle: "call",
        shortStrike: 0,
        longStrike: 0,
        shortDte: this.diagonalResult.shortDte,
        longDte: this.diagonalResult.longDte,
        netTheta: this.diagonalResult.greeks.theta,
        netDelta: this.diagonalResult.greeks.delta,
        directionalProfile: this.diagonalResult.directionalProfile,
      };
    }

    return null;
  }

  /** Genera explicacion completa en lenguaje natural: proposito, riesgo, condiciones, escenarios, disclaimer. NO autoriza ejecucion (RNF-001). Punto de entrada principal */
  explain(): ChatExplanation {
    const ctx = this.getContext();

    const purpose = ctx
      ? this.buildPurpose(ctx)
      : "No strategy data available.";

    const riskProfile = ctx
      ? this.buildRiskProfile(ctx)
      : "No strategy data available.";

    const usageConditions = ctx
      ? this.buildUsageConditions(ctx)
      : "No strategy data available.";

    const scenarioSummary = this.buildScenarioSummary();

    return {
      purpose,
      riskProfile,
      usageConditions,
      scenarioSummary,
      disclaimer: DISCLAIMER,
      structuredOutput: {
        purpose: ctx
          ? `${ctx.strategyType === "calendar" ? "Calendar" : "Diagonal"} spread using ${ctx.optionStyle.toUpperCase()} options`
          : "No data",
        conditions: usageConditions.split(". ").filter(s => s.length > 0),
        risks: riskProfile.split(". ").filter(s => s.length > 0),
        metrics: this.extractMetrics(ctx),
      },
    };
  }

  /** Construye descripcion del proposito segun tipo: calendar (neutral) o diagonal (direccional) */
  private buildPurpose(ctx: ChatContext): string {
    if (ctx.strategyType === "calendar") {
      return `Calendar Spread (${ctx.optionStyle.toUpperCase()}): ` +
        `This strategy involves selling a short-term ${ctx.optionStyle.toUpperCase()} option ` +
        `and buying a longer-term ${ctx.optionStyle.toUpperCase()} option at the same strike price. ` +
        `The goal is to profit from time decay (theta) on the short leg while maintaining a long position ` +
        `through the longer-term leg. Best suited for neutral to slightly directional market expectations.`;
    }

    return `Diagonal Spread (${ctx.optionStyle.toUpperCase()}): ` +
      `This strategy involves selling a short-term ${ctx.optionStyle.toUpperCase()} option ` +
      `and buying a longer-term ${ctx.optionStyle.toUpperCase()} option at different strike prices. ` +
      `The goal is to profit from both time decay and directional movement. ` +
      `The directional bias is ${ctx.directionalProfile}.`;
  }

  /** Construye perfil de riesgo: theta, delta, violaciones de limites, riesgo asignacion temprana, perdida maxima */
  private buildRiskProfile(ctx: ChatContext): string {
    const parts: string[] = [
      `Net theta: ${ctx.netTheta.toFixed(2)} — ${ctx.netTheta < 0 ? "Negative theta means the position loses value over time (typical for net debit spreads)." : "Positive theta means the position gains value over time (typical for net credit spreads)."}`,
    ];

    if (ctx.netDelta !== 0) {
      parts.push(`Net delta: ${ctx.netDelta.toFixed(3)} — ${this.describeDelta(ctx.netDelta)}`);
    }

    if (this.riskAnalysis) {
      if (this.riskAnalysis.limitsViolation) {
        parts.push(`Risk limit violations detected: ${this.riskAnalysis.violations.join("; ")}`);
      }
      if (this.riskAnalysis.earlyAssignmentRisk?.isAtRisk) {
        parts.push("Early assignment risk: The short leg is deep ITM and may be assigned early.");
      }
    }

    parts.push("Maximum loss is limited to the net premium paid (debit) or theoretically unlimited on the short side.");

    return parts.join(". ");
  }

  /** Construye condiciones de uso: entorno de volatilidad, direccion, ajustes, monitoreo */
  private buildUsageConditions(ctx: ChatContext): string {
    const conditions: string[] = [];

    if (ctx.strategyType === "calendar") {
      conditions.push("Best used in low to moderate volatility environments");
      conditions.push("Ideal when expecting the underlying to trade in a range near the strike price");
      conditions.push("Works well with earnings plays where IV term structure is steep");
      conditions.push("Can be used with CALLS (neutral/bullish) or PUTS (neutral/bearish)");
    } else {
      conditions.push(`Best used with ${ctx.directionalProfile} directional bias`);
      conditions.push("Suitable for moderate to high volatility environments");
      conditions.push("Provides flexibility through adjustable strike prices");
      conditions.push(`Directional bias is ${ctx.directionalProfile} — trade directionally or hedge`);
    }

    conditions.push("Position should be monitored for early assignment risk");
    conditions.push("Consider rolling the short leg before expiration to avoid gamma risk");

    return conditions.join(". ");
  }

  /** Resumen de escenarios deterministicos y Monte Carlo: rango P&L, media, VaR 95% */
  private buildScenarioSummary(): string {
    if (!this.simulationResult) return "No simulation data available.";

    const parts: string[] = [];
    const det = this.simulationResult.deterministic;

    if (det.length > 0) {
      const pnls = det.filter(d => d.label.includes("Price")).map(d => d.pnl);
      if (pnls.length > 0) {
        const maxPnl = Math.max(...pnls);
        const minPnl = Math.min(...pnls);
        parts.push(`Deterministic scenarios: P&L ranges from ${minPnl.toFixed(2)} to ${maxPnl.toFixed(2)}`);
      }
    }

    if (this.simulationResult.monteCarlo) {
      const mc = this.simulationResult.monteCarlo;
      parts.push(`Monte Carlo (${mc.iterations} iterations): Mean P&L ${mc.meanPnl.toFixed(2)}%, VaR(95): ${mc.var95.toFixed(2)}%`);
    }

    return parts.length > 0 ? parts.join(". ") : "No simulation data available.";
  }

  /** Clasifica delta en bullish (>0.3), bearish (<-0.3) o neutral */
  private describeDelta(delta: number): string {
    if (delta > 0.3) return "Bullish bias — profits from upward price movement";
    if (delta < -0.3) return "Bearish bias — profits from downward price movement";
    return "Neutral bias — limited directional exposure";
  }

  /** Genera señal descriptiva basada en el tipo de estrategia y perfil direccional — formato canónico */
  signal(): string {
    const ctx = this.getContext();
    if (!ctx) {
      return buildCanonicalOutputString({
        core: "E_ESTRATEGIA",
        subCore: "chat_assistant",
        tipoSenal: "HOLD",
        score: 0,
        peso: 1,
        observacion: {
          objetivo: "Chat Assistant sin datos de contexto",
          senal: "NO_DATA",
          explicacion: "No hay contexto disponible para generar señal descriptiva",
          metricas: {},
        },
      });
    }
    let tipoSenal: "CALL" | "PUT" | "HOLD";
    let score: number;
    if (ctx.directionalProfile === "bullish") {
      tipoSenal = "CALL";
      score = 0.6;
    } else if (ctx.directionalProfile === "bearish") {
      tipoSenal = "PUT";
      score = 0.6;
    } else {
      tipoSenal = "HOLD";
      score = 0;
    }
    return buildCanonicalOutputString({
      core: "E_ESTRATEGIA",
      subCore: "chat_assistant",
      tipoSenal,
      score,
      peso: 1,
      observacion: {
        objetivo: `Chat Assistant: estrategia ${ctx.strategyType}, perfil ${ctx.directionalProfile}`,
        senal: `${ctx.strategyType.toUpperCase()}_${ctx.directionalProfile.toUpperCase()}`,
        explicacion: this.describeDelta(ctx.shortDte > 0 ? (ctx.directionalProfile === "bullish" ? 0.5 : ctx.directionalProfile === "bearish" ? -0.5 : 0) : 0),
        metricas: this.extractMetrics(ctx),
      },
    });
  }

  /** Extrae metricas clave del contexto para structuredOutput */
  private extractMetrics(ctx: ChatContext | null): Record<string, number | string> {
    if (!ctx) return {};

    return {
      "Strategy Type": ctx.strategyType,
      "Option Style": ctx.optionStyle.toUpperCase(),
      "Short DTE": ctx.shortDte,
      "Long DTE": ctx.longDte,
      "Net Theta": Math.round(ctx.netTheta * 100) / 100,
      "Net Delta": Math.round(ctx.netDelta * 1000) / 1000,
      "Directional Profile": ctx.directionalProfile,
      "Monte Carlo Iterations": this.simulationResult?.monteCarlo?.iterations ?? "N/A",
      "VaR (95%)": this.simulationResult?.monteCarlo?.var95 ?? "N/A",
    };
  }
}
