/**
 * T021g: Common Strategy Interface
 * 
 * All option strategies (Long Call, Long Put, Short Call, Short Put)
 * and future strategies (Wheel, Coverage, etc.) must implement this interface.
 */

export interface PnlScenario {
  atPrice: number;
  pnl: number;
  breakeven: boolean;
}

export interface StrategyMetrics {
  maxProfit: number;
  maxLoss: number | null; // null = unlimited loss
  breakeven: number;
  riskRewardRatio: number;
  marginRequired?: number; // for short strategies
}

export interface SimulationResult {
  dayByDay: Array<{
    day: number;
    price: number;
    pnl: number;
    thetaDecay: number;
  }>;
  maxDrawdown: number;
  totalPnL: number;
  sharpeRatio: number;
}

export interface IStrategy {
  /**
   * Calculate P&L at different price points
   */
  calculatePnL(currentPrice: number, scenarios?: number[]): PnlScenario[];

  /**
   * Get key metrics for the strategy
   */
  getMetrics(): StrategyMetrics;

  /**
   * Simulate strategy over time with given price path
   */
  simulate(pricePath: number[], daysToExpiration: number): SimulationResult;

  /**
   * Trace calculation steps for audit trail
   */
  trace(): string[];

  /**
   * Validate strategy parameters
   */
  validate(): { valid: boolean; errors: string[] };
}
