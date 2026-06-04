// FIC: Coverage risk service — evaluates risk metrics and fires parallel notifications. (EN)
// FIC: Servicio de riesgo de cobertura — evalúa métricas de riesgo y dispara notificaciones en paralelo. (ES)

import type { CoverageStrategyResult, CoverageStrategyAlert } from "./coverageStrategyContract";

export interface RiskEvaluationConfig {
  maxLossThresholdPct?: number;   // alert when maxLoss > this % of capital
  marginWarningPct?: number;       // alert when marginRequirement > this % of capital
  capital?: number;
}

export interface RiskEvaluationResult {
  strategyId: string;
  alerts: CoverageStrategyAlert[];
  riskLevel: "low" | "medium" | "high" | "critical";
  marginStatus: "ok" | "warning" | "breach";
  evaluatedAt: string;
}

export interface NotificationTarget {
  channel: "log" | "email" | "webhook";
  address?: string;
}

// FIC: Determine overall risk level from alert severities. (EN)
// FIC: Determina el nivel global de riesgo a partir de las severidades de alertas. (ES)
function riskLevelFromAlerts(alerts: CoverageStrategyAlert[]): RiskEvaluationResult["riskLevel"] {
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warning")) return "high";
  if (alerts.length > 0) return "medium";
  return "low";
}

// FIC: Evaluate strategy risk and generate additional system-level alerts. (EN)
// FIC: Evalúa el riesgo de la estrategia y genera alertas adicionales a nivel de sistema. (ES)
export class CoverageRiskService {
  async evaluate(
    strategyResult: CoverageStrategyResult,
    config: RiskEvaluationConfig = {}
  ): Promise<RiskEvaluationResult> {
    const {
      maxLossThresholdPct = 0.10,
      marginWarningPct = 0.20,
      capital = strategyResult.underlyingPrice * strategyResult.shares,
    } = config;

    const alerts: CoverageStrategyAlert[] = [...strategyResult.alerts];
    const rm = strategyResult.riskMetrics;

    // FIC: MAX_LOSS_THRESHOLD: flag when downside exceeds configured capital threshold. (EN)
    // FIC: MAX_LOSS_THRESHOLD: alerta cuando la pérdida máxima supera el umbral de capital configurado. (ES)
    if (capital > 0 && strategyResult.maxLoss > capital * maxLossThresholdPct) {
      alerts.push({
        code: "MAX_LOSS_THRESHOLD",
        severity: "warning",
        message: `Max loss $${strategyResult.maxLoss.toFixed(2)} exceeds ${(maxLossThresholdPct * 100).toFixed(0)}% of capital $${capital.toFixed(2)}.`,
      });
    }

    // FIC: MARGIN_BREACH: flag when margin requirement exceeds capital threshold. (EN)
    // FIC: MARGIN_BREACH: alerta cuando el requerimiento de margen supera el umbral de capital. (ES)
    let marginStatus: RiskEvaluationResult["marginStatus"] = "ok";
    if (capital > 0 && rm.marginRequirement > capital * marginWarningPct) {
      marginStatus = rm.marginRequirement > capital * 0.5 ? "breach" : "warning";
      alerts.push({
        code: marginStatus === "breach" ? "MARGIN_BREACH" : "MARGIN_WARNING",
        severity: marginStatus === "breach" ? "critical" : "warning",
        message: `Margin requirement $${rm.marginRequirement.toFixed(2)} is ${(rm.marginRequirement / capital * 100).toFixed(1)}% of capital.`,
      });
    }

    // FIC: UNLIMITED_RISK: flag strategies with unlimited downside exposure. (EN)
    // FIC: UNLIMITED_RISK: alerta estrategias con exposición ilimitada a la baja. (ES)
    if (rm.riskProfile === "unlimited") {
      alerts.push({
        code: "UNLIMITED_RISK_PROFILE",
        severity: "warning",
        message: "This strategy has an unlimited downside risk profile. Ensure position sizing is appropriate.",
      });
    }

    return {
      strategyId: strategyResult.strategyId,
      alerts,
      riskLevel: riskLevelFromAlerts(alerts),
      marginStatus,
      evaluatedAt: new Date().toISOString(),
    };
  }

  // FIC: Send alerts to multiple notification targets in parallel via Promise.allSettled. (EN)
  // FIC: Envía alertas a múltiples destinos de notificación en paralelo via Promise.allSettled. (ES)
  async notify(
    alerts: CoverageStrategyAlert[],
    targets: NotificationTarget[] = [{ channel: "log" }]
  ): Promise<void> {
    await Promise.allSettled(
      targets.map((target) => this.sendToTarget(alerts, target))
    );
  }

  private async sendToTarget(
    alerts: CoverageStrategyAlert[],
    target: NotificationTarget
  ): Promise<void> {
    if (alerts.length === 0) return;
    if (target.channel === "log") {
      for (const alert of alerts) {
        console.log(`[RISK:${alert.severity.toUpperCase()}] ${alert.code}: ${alert.message}`);
      }
    }
    // webhook/email channels would be implemented in production
  }
}
