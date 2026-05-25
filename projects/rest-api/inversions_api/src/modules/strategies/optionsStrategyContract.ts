/**
 * T082: Contrato base de parámetros de estrategias de opciones.
 * Define los campos requeridos para cualquier estrategia de opciones.
 * 
 * Entrada: Parámetros de configuración de la opción
 * Salida: Escenarios de P&L, riesgos, recomendaciones
 */

export type OptionType = "CALL" | "PUT";
export type OptionDirection = "LONG" | "SHORT";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";
export type TimeDecayModel = "LINEAR" | "EXPONENTIAL";

/**
 * Input: Parámetros de entrada para evaluar una estrategia de opciones
 */
export interface OptionStrategyInput {
  // Core parameters
  ticker: string;
  optionType: OptionType;
  direction: OptionDirection;
  
  // Price parameters
  strikePrice: number;
  currentPrice: number;
  
  // Time parameters
  expirationDate: string; // ISO 8601
  daysToExpiration: number;
  
  // Premium and quantity
  premiumPerContract: number; // Price per contract (0.01$ granularity)
  numberOfContracts: number;
  
  // Capital and risk
  availableCapital: number;
  riskTolerance: RiskTolerance;
  
  // Simulation assumptions
  assumptions: {
    impliedVolatility?: number; // as percentage (e.g., 25 for 25%)
    timeDecayModel?: TimeDecayModel; // LINEAR or EXPONENTIAL
    interestRate?: number; // Annual rate, default 4%
    expectedReturn?: number; // Expected daily return %
  };
}

/**
 * Output: Escenarios y métricas de riesgo/recompensa
 */
export interface PriceScenario {
  priceMovement: string; // e.g., "ATM", "+5%", "-5%"
  priceAtScenario: number;
  profitLoss: number; // Total P&L in dollars
  roi: number; // ROI as percentage
}

export interface OptionStrategyOutput {
  ticker: string;
  optionType: OptionType;
  direction: OptionDirection;
  premium: number;
  quantity: number;
  
  // Breakeven and limits
  breakEvenPrice: number; // Price where P&L = 0 (exact to 0.01)
  maxProfit: number; // Maximum profit possible in dollars
  maxLoss: number; // Maximum loss possible in dollars (UNLIMITED if short call)
  requiredMargin: number; // Margin required for short strategies
  
  // Scenarios (ATM, +5%, -5%)
  scenarioAtm: PriceScenario;
  scenarioPlus5: PriceScenario;
  scenarioMinus5: PriceScenario;
  
  // Risk metrics
  riskAdjustedReturn: number; // maxProfit / maxLoss (if maxLoss > 0)
  probabilityItm: number; // Probability in-the-money at expiration (0-1)
  
  // Warnings for risk management
  warnings: string[];
  
  // Metadata and traceability
  calculatedAt: string; // ISO timestamp
  calculationVersion: string; // v1.0, v2.0, etc
  assumptions: OptionStrategyInput["assumptions"];
}

/**
 * Result from comparing multiple strategies
 */
export interface StrategyComparison {
  recommended: OptionStrategyOutput;
  alternatives: OptionStrategyOutput[];
  rationale: string;
}
