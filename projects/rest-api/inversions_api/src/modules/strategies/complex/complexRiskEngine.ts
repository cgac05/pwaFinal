/**
 * FIC: Complex Risk Engine - Hard limits, margin checks, stop-loss,
 * early assignment detection, and kill-switch for complex options strategies.
 *
 * FIC: Motor de Riesgo Complejo - Límites duros, verificación de margen,
 * stop-loss, detección de asignación temprana y kill-switch para estrategias
 * complejas de opciones.
 */

import type { ComplexStrategyConfig, StrategyProfile } from "./complexStrategyContract";
import type { SimulationResult } from "./complexSimulationEngine";

// ──────────────────────────────────────────────
// FIC: Types / Tipos
// ──────────────────────────────────────────────

/**
 * FIC: Risk profile level.
 * FIC: Nivel de perfil de riesgo.
 */
export type RiskProfile = "conservador" | "moderado" | "agresivo";

/**
 * FIC: Hard limit configuration for risk control.
 * FIC: Configuración de límites duros para control de riesgo.
 */
export interface RiskLimits {
  /** FIC: Maximum allowed loss in dollars / Pérdida máxima permitida en dólares */
  perdida_maxima_usd: number;
  /** FIC: Maximum margin requirement in dollars / Requisito máximo de margen en dólares */
  margen_maximo_usd: number;
  /** FIC: Maximum allowed position size in contracts / Tamaño máximo de posición en contratos */
  contratos_maximos: number;
  /** FIC: Maximum risk per trade as percentage of portfolio / Riesgo máximo por operación como % del portafolio */
  riesgo_maximo_porcentaje: number;
  /** FIC: Maximum drawdown percentage before stop-loss / Drawdown máximo % antes de stop-loss */
  drawdown_maximo_porcentaje: number;
  /** FIC: Enable automatic stop-loss / Habilitar stop-loss automático */
  stop_loss_automatico: boolean;
  /** FIC: Minimum DTE (days to expiration) / DTE mínimo (días hasta vencimiento) */
  dte_minimo: number;
  /** FIC: Maximum allowed IV percentile relative to HV / Percentil de IV máximo relativo a HV */
  iv_maximo_percentil: number;
}

/**
 * FIC: Default risk limits based on risk profile.
 * FIC: Límites de riesgo por defecto basados en perfil de riesgo.
 */
export const DEFAULT_RISK_LIMITS: Record<RiskProfile, RiskLimits> = {
  conservador: {
    perdida_maxima_usd: 500,
    margen_maximo_usd: 2000,
    contratos_maximos: 5,
    riesgo_maximo_porcentaje: 2,
    drawdown_maximo_porcentaje: 10,
    stop_loss_automatico: true,
    dte_minimo: 21,
    iv_maximo_percentil: 50,
  },
  moderado: {
    perdida_maxima_usd: 2000,
    margen_maximo_usd: 10000,
    contratos_maximos: 20,
    riesgo_maximo_porcentaje: 5,
    drawdown_maximo_porcentaje: 20,
    stop_loss_automatico: true,
    dte_minimo: 14,
    iv_maximo_percentil: 70,
  },
  agresivo: {
    perdida_maxima_usd: 10000,
    margen_maximo_usd: 50000,
    contratos_maximos: 100,
    riesgo_maximo_porcentaje: 15,
    drawdown_maximo_porcentaje: 35,
    stop_loss_automatico: false,
    dte_minimo: 7,
    iv_maximo_percentil: 90,
  },
};

/**
 * FIC: Severity level of a risk event.
 * FIC: Nivel de severidad de un evento de riesgo.
 */
export type RiskSeverity = "info" | "warning" | "critical" | "blocking";

/**
 * FIC: A risk event detected by the engine.
 * FIC: Un evento de riesgo detectado por el motor.
 */
export interface RiskEvent {
  /** FIC: Unique event ID / ID único del evento */
  id: string;
  /** FIC: Timestamp of detection / Marca de tiempo de detección */
  timestamp: string;
  /** FIC: Severity level / Nivel de severidad */
  severidad: RiskSeverity;
  /** FIC: Risk category / Categoría de riesgo */
  categoria: string;
  /** FIC: Human-readable message / Mensaje legible */
  mensaje: string;
  /** FIC: English message / Mensaje en inglés */
  message: string;
  /** FIC: The value that triggered the event / Valor que disparó el evento */
  valor_actual: number;
  /** FIC: The limit that was exceeded / Límite que se excedió */
  limite: number;
  /** FIC: Whether this blocks the operation / Si bloquea la operación */
  bloquea: boolean;
}

/**
 * FIC: Portfolio context for risk evaluation.
 * FIC: Contexto de portafolio para evaluación de riesgo.
 */
export interface PortfolioContext {
  /** FIC: Total portfolio value in dollars / Valor total del portafolio en dólares */
  valor_portafolio_usd: number;
  /** FIC: Available buying power / Poder de compra disponible */
  poder_compra_usd: number;
  /** FIC: Current margin used / Margen actual utilizado */
  margen_actual_usd: number;
  /** FIC: Current positions count / Conteo de posiciones actuales */
  posiciones_actuales: number;
}

/**
 * FIC: Complete risk assessment result.
 * FIC: Resultado completo de evaluación de riesgo.
 */
export interface RiskAssessment {
  /** FIC: Whether the strategy passes all risk checks / Si la estrategia pasa todos los controles */
  riesgo_aceptable: boolean;
  /** FIC: Overall risk score (0-100, higher = riskier) / Puntaje de riesgo general */
  puntaje_riesgo: number;
  /** FIC: All detected risk events / Todos los eventos de riesgo detectados */
  eventos: RiskEvent[];
  /** FIC: Summary of risk assessment / Resumen de la evaluación */
  resumen: string;
  /** FIC: Recommended action / Acción recomendada */
  accion_recomendada: string;
}

/**
 * FIC: Kill-switch status for a strategy or ticker.
 * FIC: Estado de kill-switch para una estrategia o ticker.
 */
export interface KillSwitchStatus {
  /** FIC: Whether the kill-switch is active / Si el kill-switch está activo */
  activo: boolean;
  /** FIC: Reason for activation / Razón de activación */
  motivo?: string;
  /** FIC: When it was activated / Cuándo se activó */
  activado_en?: string;
  /** FIC: Who activated it / Quién lo activó */
  activado_por?: string;
}

// ──────────────────────────────────────────────
// FIC: Engine implementation / Implementación del motor
// ──────────────────────────────────────────────

/**
 * FIC: Complex Risk Engine - evaluates risk for complex options strategies.
 *
 * FIC: Motor de Riesgo Complejo - evalúa riesgo para estrategias complejas de opciones.
 */
export class ComplexRiskEngine {
  private killSwitches: Map<string, KillSwitchStatus> = new Map();
  private auditLog: RiskEvent[] = [];
  private maxAuditEntries = 10000;

  /**
   * FIC: Evaluate risk for a strategy given its config, profile, and simulation results.
   * FIC: Evalúa riesgo para una estrategia dados su config, perfil y resultados de simulación.
   */
  evaluate(
    config: ComplexStrategyConfig,
    profile: StrategyProfile,
    simulation: SimulationResult,
    portfolio: PortfolioContext,
    customLimits?: Partial<RiskLimits>
  ): RiskAssessment {
    const riskProfile = this.mapToleranceToProfile(config.tolerancia_riesgo);
    const limits = this.resolveLimits(riskProfile, customLimits);
    const eventos: RiskEvent[] = [];
    let eventId = 0;

    const now = new Date().toISOString();

    // FIC: 1. Kill-switch check
    const killSwitch = this.killSwitches.get(config.ticker);
    if (killSwitch?.activo) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: "blocking",
        categoria: "KILL_SWITCH",
        mensaje: `Kill-switch activo para ${config.ticker}: ${killSwitch.motivo}`,
        message: `Kill-switch active for ${config.ticker}: ${killSwitch.motivo}`,
        valor_actual: 1,
        limite: 0,
        bloquea: true,
      });
    }

    // FIC: 2. Maximum loss check
    if (profile.perdida_maxima > limits.perdida_maxima_usd) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: "blocking",
        categoria: "PERDIDA_MAXIMA",
        mensaje: `Pérdida máxima ($${profile.perdida_maxima}) excede límite ($${limits.perdida_maxima_usd})`,
        message: `Maximum loss ($${profile.perdida_maxima}) exceeds limit ($${limits.perdida_maxima_usd})`,
        valor_actual: profile.perdida_maxima,
        limite: limits.perdida_maxima_usd,
        bloquea: true,
      });
    }

    // FIC: 3. Contracts check
    const totalContracts = config.legs.reduce((sum, leg) => sum + leg.contratos, 0);
    if (totalContracts > limits.contratos_maximos) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: "critical",
        categoria: "CONTRATOS_MAXIMOS",
        mensaje: `Contratos totales (${totalContracts}) exceden límite (${limits.contratos_maximos})`,
        message: `Total contracts (${totalContracts}) exceed limit (${limits.contratos_maximos})`,
        valor_actual: totalContracts,
        limite: limits.contratos_maximos,
        bloquea: true,
      });
    }

    // FIC: 4. Portfolio risk percentage check
    const riskPercent = (profile.perdida_maxima / portfolio.valor_portafolio_usd) * 100;
    if (riskPercent > limits.riesgo_maximo_porcentaje) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: "critical",
        categoria: "RIESGO_PORTAFOLIO",
        mensaje: `Riesgo (${riskPercent.toFixed(1)}% del portafolio) excede límite (${limits.riesgo_maximo_porcentaje}%)`,
        message: `Risk (${riskPercent.toFixed(1)}% of portfolio) exceeds limit (${limits.riesgo_maximo_porcentaje}%)`,
        valor_actual: riskPercent,
        limite: limits.riesgo_maximo_porcentaje,
        bloquea: true,
      });
    }

    // FIC: 5. Buying power check
    if (profile.perdida_maxima > portfolio.poder_compra_usd) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: "critical",
        categoria: "PODER_COMPRA",
        mensaje: `Pérdida potencial ($${profile.perdida_maxima}) excede poder de compra ($${portfolio.poder_compra_usd})`,
        message: `Potential loss ($${profile.perdida_maxima}) exceeds buying power ($${portfolio.poder_compra_usd})`,
        valor_actual: profile.perdida_maxima,
        limite: portfolio.poder_compra_usd,
        bloquea: true,
      });
    }

    // FIC: 6. Probability of success check (from simulation)
    if (simulation.probabilidad_exito < 20) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: "warning",
        categoria: "PROBABILIDAD_EXITO",
        mensaje: `Probabilidad de éxito muy baja (${simulation.probabilidad_exito}%)`,
        message: `Very low probability of success (${simulation.probabilidad_exito}%)`,
        valor_actual: simulation.probabilidad_exito,
        limite: 20,
        bloquea: false,
      });
    }

    // FIC: 7. DTE check
    const dte = config.dias_vencimiento ?? 45;
    if (dte < limits.dte_minimo) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: dte < 7 ? "critical" : "warning",
        categoria: "DTE_MINIMO",
        mensaje: `DTE (${dte}) por debajo del mínimo (${limits.dte_minimo}) - riesgo de decay theta acelerado`,
        message: `DTE (${dte}) below minimum (${limits.dte_minimo}) - accelerated theta decay risk`,
        valor_actual: dte,
        limite: limits.dte_minimo,
        bloquea: dte < 7,
      });
    }

    // FIC: 8. Early assignment detection (American options only)
    if (config.estilo_opcion === "americana") {
      for (const leg of config.legs) {
        if (leg.posicion === "short" && leg.subyacente_precio !== undefined) {
          const isITM =
            (leg.tipo === "call" && leg.subyacente_precio > leg.strike) ||
            (leg.tipo === "put" && leg.subyacente_precio < leg.strike);

          if (isITM && dte <= 14) {
            eventos.push({
              id: `RISK-${++eventId}`,
              timestamp: now,
              severidad: "critical",
              categoria: "ASIGNACION_TEMPRANA",
              mensaje: `Riesgo de asignación temprana: pata short ${leg.tipo} ${leg.strike} ITM con DTE=${dte}`,
              message: `Early assignment risk: short ${leg.tipo} ${leg.strike} leg ITM with DTE=${dte}`,
              valor_actual: dte,
              limite: 14,
              bloquea: true,
            });
          } else if (isITM) {
            eventos.push({
              id: `RISK-${++eventId}`,
              timestamp: now,
              severidad: "warning",
              categoria: "ASIGNACION_TEMPRANA",
              mensaje: `Pata short ${leg.tipo} ${leg.strike} ITM - monitorear riesgo de asignación`,
              message: `Short ${leg.tipo} ${leg.strike} leg ITM - monitor assignment risk`,
              valor_actual: dte,
              limite: 14,
              bloquea: false,
            });
          }
        }
      }
    }

    // FIC: 9. Drawdown check from simulation
    const drawdownPercent = portfolio.valor_portafolio_usd > 0
      ? (simulation.drawdown_maximo / portfolio.valor_portafolio_usd) * 100
      : 0;
    if (drawdownPercent > limits.drawdown_maximo_porcentaje) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: limits.stop_loss_automatico ? "critical" : "warning",
        categoria: "DRAWDOWN",
        mensaje: `Drawdown simulado (${drawdownPercent.toFixed(1)}%) excede límite (${limits.drawdown_maximo_porcentaje}%)`,
        message: `Simulated drawdown (${drawdownPercent.toFixed(1)}%) exceeds limit (${limits.drawdown_maximo_porcentaje}%)`,
        valor_actual: drawdownPercent,
        limite: limits.drawdown_maximo_porcentaje,
        bloquea: limits.stop_loss_automatico,
      });
    }

    // FIC: 10. Sharpe ratio check
    if (simulation.ratio_sharpe < 0) {
      eventos.push({
        id: `RISK-${++eventId}`,
        timestamp: now,
        severidad: "warning",
        categoria: "SHARPE_NEGATIVO",
        mensaje: `Ratio Sharpe negativo (${simulation.ratio_sharpe}) - rendimiento esperado negativo`,
        message: `Negative Sharpe ratio (${simulation.ratio_sharpe}) - negative expected return`,
        valor_actual: simulation.ratio_sharpe,
        limite: 0,
        bloquea: false,
      });
    }

    // FIC: Calculate risk score (0-100)
    const puntajeRiesgo = this.calculateRiskScore(eventos);

    // FIC: Determine if risk is acceptable
    const bloqueos = eventos.filter((e) => e.bloquea);
    const criticos = eventos.filter((e) => e.severidad === "critical" && !e.bloquea);
    const warnings = eventos.filter((e) => e.severidad === "warning");

    const riesgoAceptable = bloqueos.length === 0;

    // FIC: Generate summary and recommendation
    let resumen: string;
    let accion: string;

    if (!riesgoAceptable) {
      resumen = `RIESGO NO ACEPTABLE: ${bloqueos.length} bloqueo(s) detectado(s). ` +
                `La estrategia no pasa los controles de riesgo. ` +
                `RISK NOT ACCEPTABLE: ${bloqueos.length} blocking issue(s) detected.`;
      accion = `Revisar y ajustar parámetros de la estrategia. Reducir tamaño de posición, ` +
               `aumentar distancia de strikes, o incrementar DTE. ` +
               `Review and adjust strategy parameters. Reduce position size, ` +
               `widen strikes, or increase DTE.`;
    } else if (criticos.length > 0) {
      resumen = `RIESGO ELEVADO: ${criticos.length} advertencia(s) crítica(s). ` +
                `La estrategia pasa controles básicos pero tiene riesgo significativo. ` +
                `HIGH RISK: ${criticos.length} critical warning(s).`;
      accion = `Monitorear de cerca. Considerar reducir tamaño o agregar cobertura. ` +
               `Monitor closely. Consider reducing size or adding hedge.`;
    } else if (warnings.length > 0) {
      resumen = `RIESGO MODERADO: ${warnings.length} advertencia(s). Estrategia operativa con precaución. ` +
                `MODERATE RISK: ${warnings.length} warning(s). Strategy operational with caution.`;
      accion = `Operativa permitida. Monitorear factores de advertencia. ` +
               `Trading allowed. Monitor warning factors.`;
    } else {
      resumen = `RIESGO ACEPTABLE: Todos los controles pasados. Estrategia operativa. ` +
                `ACCEPTABLE RISK: All checks passed. Strategy operational.`;
      accion = `Operativa permitida sin restricciones. ` +
               `Trading allowed without restrictions.`;
    }

    // FIC: Log audit
    for (const event of eventos) {
      this.logAudit(event);
    }

    return {
      riesgo_aceptable: riesgoAceptable,
      puntaje_riesgo: puntajeRiesgo,
      eventos,
      resumen,
      accion_recomendada: accion,
    };
  }

  // ──────────────────────────────────────────────
  // FIC: Kill-switch management / Gestión de kill-switch
  // ──────────────────────────────────────────────

  /**
   * FIC: Activate kill-switch for a ticker or strategy.
   * FIC: Activa kill-switch para un ticker o estrategia.
   */
  activateKillSwitch(
    ticker: string,
    motivo: string,
    activadoPor: string = "system"
  ): void {
    this.killSwitches.set(ticker, {
      activo: true,
      motivo,
      activado_en: new Date().toISOString(),
      activado_por: activadoPor,
    });

    this.logAudit({
      id: `KS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severidad: "critical",
      categoria: "KILL_SWITCH_ACTIVATED",
      mensaje: `Kill-switch activado para ${ticker}: ${motivo}`,
      message: `Kill-switch activated for ${ticker}: ${motivo}`,
      valor_actual: 1,
      limite: 0,
      bloquea: true,
    });
  }

  /**
   * FIC: Deactivate kill-switch for a ticker.
   * FIC: Desactiva kill-switch para un ticker.
   */
  deactivateKillSwitch(ticker: string): void {
    this.killSwitches.delete(ticker);

    this.logAudit({
      id: `KS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severidad: "info",
      categoria: "KILL_SWITCH_DEACTIVATED",
      mensaje: `Kill-switch desactivado para ${ticker}`,
      message: `Kill-switch deactivated for ${ticker}`,
      valor_actual: 0,
      limite: 0,
      bloquea: false,
    });
  }

  /**
   * FIC: Get kill-switch status for a ticker.
   * FIC: Obtiene estado de kill-switch para un ticker.
   */
  getKillSwitchStatus(ticker: string): KillSwitchStatus {
    return this.killSwitches.get(ticker) ?? { activo: false };
  }

  // ──────────────────────────────────────────────
  // FIC: Audit log / Registro de auditoría
  // ──────────────────────────────────────────────

  /**
   * FIC: Get all audit log entries.
   * FIC: Obtiene todas las entradas del registro de auditoría.
   */
  getAuditLog(): RiskEvent[] {
    return [...this.auditLog];
  }

  /**
   * FIC: Get audit log filtered by severity.
   * FIC: Obtiene registro de auditoría filtrado por severidad.
   */
  getAuditLogBySeverity(severidad: RiskSeverity): RiskEvent[] {
    return this.auditLog.filter((e) => e.severidad === severidad);
  }

  /**
   * FIC: Get audit log filtered by category.
   * FIC: Obtiene registro de auditoría filtrado por categoría.
   */
  getAuditLogByCategory(categoria: string): RiskEvent[] {
    return this.auditLog.filter((e) => e.categoria === categoria);
  }

  /**
   * FIC: Clear audit log (for testing/reset).
   * FIC: Limpia registro de auditoría (para testing/reset).
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * FIC: Clear all kill switches (for testing/reset).
   * FIC: Limpia todos los kill-switches (para testing/reset).
   */
  clearAllKillSwitches(): void {
    this.killSwitches.clear();
  }

  // ──────────────────────────────────────────────
  // FIC: Private helpers / Helpers privados
  // ──────────────────────────────────────────────

  private mapToleranceToProfile(tolerancia: ComplexStrategyConfig["tolerancia_riesgo"]): RiskProfile {
    switch (tolerancia) {
      case "bajo":
        return "conservador";
      case "medio":
        return "moderado";
      case "alto":
        return "agresivo";
      default:
        return "moderado";
    }
  }

  private resolveLimits(profile: RiskProfile, custom?: Partial<RiskLimits>): RiskLimits {
    const base = { ...DEFAULT_RISK_LIMITS[profile] };
    if (custom) {
      Object.assign(base, custom);
    }
    return base;
  }

  private calculateRiskScore(eventos: RiskEvent[]): number {
    if (eventos.length === 0) return 0;

    const weights: Record<RiskSeverity, number> = {
      info: 2,
      warning: 10,
      critical: 25,
      blocking: 40,
    };

    const totalScore = eventos.reduce((sum, e) => sum + (weights[e.severidad] ?? 0), 0);
    return Math.min(100, totalScore);
  }

  private logAudit(event: RiskEvent): void {
    this.auditLog.push(event);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.shift();
    }
  }
}

/**
 * FIC: Factory function to create a ComplexRiskEngine instance.
 * FIC: Función de fábrica para crear una instancia de ComplexRiskEngine.
 */
export function createComplexRiskEngine(): ComplexRiskEngine {
  return new ComplexRiskEngine();
}

export default ComplexRiskEngine;
