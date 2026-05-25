/**
 * T082: Contrato base de parámetros de estrategias de opciones.
 * Define los campos requeridos para cualquier estrategia de opciones.
 */

export type OptionType = "call" | "put";
export type OptionDirection = "long" | "short";
export type RiskTolerance = "low" | "medium" | "high";

export interface OptionSimulationMetadata {
  scenarioName: string;
  probability: number;
  volatilityAssumption?: number;
}

export interface OptionStrategyContract {
  ticker: string;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: string;
  premium: number;
  quantity: number;
  direction: OptionDirection;
  capitalAvailable: number;
  riskTolerance: RiskTolerance;
  metadata?: OptionSimulationMetadata;
}

export interface OptionStrategyResult {
  ticker: string;
  optionType: OptionType;
  direction: OptionDirection;
  premium: number;
  quantity: number;
  breakEven: number;
  maxProfit: number;
  maxLoss: number;
  requiredMargin: number;
  payoffProfile: {
    price: number;
    profitLoss: number;
  }[];
}
