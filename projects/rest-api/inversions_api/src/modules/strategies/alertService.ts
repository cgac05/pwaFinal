import type { OptionStrategyInput } from "./optionsStrategyContract";

/**
 * T088: Servicio de alertas en tiempo real y ejecución de stop-loss
 * 
 * Monitorea posiciones abiertas y emite alertas cuando:
 * - Precio cruza stop-loss nivel
 * - Precio cruza take-profit nivel
 * - Margen cae por debajo de umbral
 * 
 * NO ejecuta operaciones automáticas, solo genera solicitudes (requests)
 */

export interface OpenPosition {
  positionId: string;
  ticker: string;
  strategyType: "LONG_CALL" | "LONG_PUT" | "SHORT_CALL" | "SHORT_PUT";
  entryPrice: number;
  strikePrice: number;
  expirationDate: string;
  quantity: number;
  stopLossLevel: number;
  takeProfitLevel: number;
  status: "OPEN" | "REQUESTED_CLOSE" | "CLOSED";
  createdAt: string;
  userId: string;
}

export interface Alert {
  alertId: string;
  positionId: string;
  ticker: string;
  type: "STOP_LOSS" | "TAKE_PROFIT" | "MARGIN_WARNING" | "EXPIRATION_WARNING";
  triggeredAt: string;
  currentPrice: number;
  triggerLevel: number;
  profitLossAtTrigger: number;
  message: string;
  severity: "WARNING" | "CRITICAL";
}

export interface CloseRequest {
  requestId: string;
  positionId: string;
  requestedAt: string;
  requestedPrice?: number;
  requestedBy: string;
  status: "PENDING" | "EXECUTED" | "CANCELLED";
  reason: "STOP_LOSS" | "TAKE_PROFIT" | "MANUAL" | "EXPIRATION";
}

export class AlertService {
  private positions: Map<string, OpenPosition> = new Map();
  private alerts: Alert[] = [];
  private closeRequests: CloseRequest[] = [];
  private alertCallbacks: ((alert: Alert) => void)[] = [];

  /**
   * Register an open position for monitoring
   */
  registerPosition(position: OpenPosition): void {
    this.positions.set(position.positionId, position);
  }

  /**
   * Evaluate current price against all triggers
   */
  evaluatePosition(positionId: string, currentPrice: number): Alert[] {
    const position = this.positions.get(positionId);
    if (!position) return [];

    const triggeredAlerts: Alert[] = [];

    // Check Stop-Loss trigger
    if (this.checkStopLossTrigger(position, currentPrice)) {
      const alert = this.createAlert(
        position,
        "STOP_LOSS",
        currentPrice,
        position.stopLossLevel,
        "Stop-loss triggered. Position reached maximum acceptable loss."
      );
      triggeredAlerts.push(alert);
      this.emitAlert(alert);
    }

    // Check Take-Profit trigger
    if (this.checkTakeProfitTrigger(position, currentPrice)) {
      const alert = this.createAlert(
        position,
        "TAKE_PROFIT",
        currentPrice,
        position.takeProfitLevel,
        "Take-profit triggered. Position reached target profit level."
      );
      triggeredAlerts.push(alert);
      this.emitAlert(alert);
    }

    // Check Expiration warning (30 days before)
    if (this.checkExpirationWarning(position)) {
      const alert = this.createAlert(
        position,
        "EXPIRATION_WARNING",
        currentPrice,
        0,
        "Option expiration in 30 days. Plan exit strategy."
      );
      triggeredAlerts.push(alert);
      this.emitAlert(alert);
    }

    return triggeredAlerts;
  }

  /**
   * Check if stop-loss should trigger
   */
  private checkStopLossTrigger(position: OpenPosition, currentPrice: number): boolean {
    const pnlTrigger = this.calculatePnL(position, currentPrice);
    const maxLoss = this.calculateMaxLoss(position);

    // Trigger if loss exceeds 50% of max loss (or custom threshold)
    return pnlTrigger <= -maxLoss * 0.5;
  }

  /**
   * Check if take-profit should trigger
   */
  private checkTakeProfitTrigger(position: OpenPosition, currentPrice: number): boolean {
    const pnlTrigger = this.calculatePnL(position, currentPrice);
    const maxProfit = this.calculateMaxProfit(position);

    // Trigger if profit reaches 75% of max profit
    return pnlTrigger >= maxProfit * 0.75;
  }

  /**
   * Check if expiration warning should trigger (30 days before)
   */
  private checkExpirationWarning(position: OpenPosition): boolean {
    const expirationDate = new Date(position.expirationDate);
    const today = new Date();
    const daysUntilExpiration = Math.floor(
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return 25 <= daysUntilExpiration && daysUntilExpiration <= 30;
  }

  /**
   * Create close request (NOT auto-execute)
   */
  requestClose(
    positionId: string,
    userId: string,
    reason: "STOP_LOSS" | "TAKE_PROFIT" | "MANUAL" | "EXPIRATION",
    requestedPrice?: number
  ): CloseRequest {
    const request: CloseRequest = {
      requestId: `CR-${Date.now()}`,
      positionId,
      requestedAt: new Date().toISOString(),
      requestedPrice,
      requestedBy: userId,
      status: "PENDING",
      reason
    };

    this.closeRequests.push(request);
    
    // Update position status
    const position = this.positions.get(positionId);
    if (position) {
      position.status = "REQUESTED_CLOSE";
    }

    return request;
  }

  /**
   * Emit alert to registered callbacks
   */
  private emitAlert(alert: Alert): void {
    this.alerts.push(alert);
    this.alertCallbacks.forEach(cb => cb(alert));
  }

  /**
   * Subscribe to alerts
   */
  onAlert(callback: (alert: Alert) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      this.alertCallbacks = this.alertCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Private helper: Create alert object
   */
  private createAlert(
    position: OpenPosition,
    type: "STOP_LOSS" | "TAKE_PROFIT" | "MARGIN_WARNING" | "EXPIRATION_WARNING",
    currentPrice: number,
    triggerLevel: number,
    message: string
  ): Alert {
    const pnl = this.calculatePnL(position, currentPrice);
    return {
      alertId: `ALR-${Date.now()}`,
      positionId: position.positionId,
      ticker: position.ticker,
      type,
      triggeredAt: new Date().toISOString(),
      currentPrice,
      triggerLevel,
      profitLossAtTrigger: pnl,
      message,
      severity: type === "STOP_LOSS" ? "CRITICAL" : "WARNING"
    };
  }

  /**
   * Calculate current P&L
   */
  private calculatePnL(position: OpenPosition, currentPrice: number): number {
    const strikePrice = position.strikePrice;
    const quantity = position.quantity;

    let pnl = 0;
    if (position.strategyType === "LONG_CALL") {
      const intrinsic = Math.max(currentPrice - strikePrice, 0);
      pnl = (intrinsic - (position.entryPrice - strikePrice)) * quantity * 100;
    } else if (position.strategyType === "LONG_PUT") {
      const intrinsic = Math.max(strikePrice - currentPrice, 0);
      pnl = (intrinsic - (strikePrice - position.entryPrice)) * quantity * 100;
    } else if (position.strategyType === "SHORT_CALL") {
      const obligation = Math.max(currentPrice - strikePrice, 0);
      pnl = ((strikePrice - currentPrice) - position.entryPrice) * quantity * 100;
    } else if (position.strategyType === "SHORT_PUT") {
      const obligation = Math.max(strikePrice - currentPrice, 0);
      pnl = ((currentPrice - strikePrice) - position.entryPrice) * quantity * 100;
    }

    return pnl;
  }

  /**
   * Calculate max loss (strategy dependent)
   */
  private calculateMaxLoss(position: OpenPosition): number {
    const premium = position.entryPrice;
    const quantity = position.quantity;

    if (position.strategyType === "LONG_CALL" || position.strategyType === "LONG_PUT") {
      return premium * quantity * 100; // Premium paid
    } else if (position.strategyType === "SHORT_CALL") {
      return Infinity; // Unlimited loss
    } else {
      return (position.strikePrice - premium) * quantity * 100; // Short put max loss
    }
  }

  /**
   * Calculate max profit (strategy dependent)
   */
  private calculateMaxProfit(position: OpenPosition): number {
    const premium = position.entryPrice;
    const quantity = position.quantity;

    if (position.strategyType === "LONG_CALL" || position.strategyType === "LONG_PUT") {
      return Infinity; // Unlimited for long, but capped at strike for puts
    } else {
      return premium * quantity * 100; // Premium received
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Get all close requests
   */
  getCloseRequests(): CloseRequest[] {
    return [...this.closeRequests];
  }
}
