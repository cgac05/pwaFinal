// FIC: Canonical contract types for all option strategy modules (Team-03). (EN)
// FIC: Tipos de contrato canonicos para todos los modulos de estrategia de opciones (Team-03). (ES)

export type OptionType = "CALL" | "PUT";
export type OptionDirection = "LONG" | "SHORT";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";
export type TimeDecayModel = "LINEAR" | "EXPONENTIAL";

export interface OptionAssumptions {
  impliedVolatility?: number;
  timeDecayModel?: TimeDecayModel;
  interestRate?: number;
  expectedReturn?: number;
}

export interface OptionStrategyContract {
  ticker: string;
  optionType: OptionType | Lowercase<OptionType> | string;
  direction: OptionDirection | Lowercase<OptionDirection> | string;
  strikePrice: number;
  currentPrice?: number;
  expirationDate: string;
  daysToExpiration?: number;
  premium: number;
  quantity: number;
  premiumPerContract?: number;
  numberOfContracts?: number;
  capitalAvailable?: number;
  availableCapital?: number;
  riskTolerance?: RiskTolerance | "BAJO" | "MEDIO" | "ALTO" | string;
  assumptions?: OptionAssumptions;
}

export interface OptionStrategyInput {
  ticker: string;
  optionType: OptionType;
  direction: OptionDirection;
  strikePrice: number;
  currentPrice: number;
  expirationDate: string;
  daysToExpiration: number;
  premiumPerContract: number;
  numberOfContracts: number;
  availableCapital: number;
  riskTolerance: RiskTolerance;
  assumptions: Required<Pick<OptionAssumptions, "impliedVolatility" | "timeDecayModel" | "interestRate">> &
    Pick<OptionAssumptions, "expectedReturn">;
}

export interface PriceScenario {
  priceMovement: string;
  priceAtScenario: number;
  profitLoss: number;
  roi: number;
}

export interface OptionStrategyOutput {
  ticker: string;
  optionType: OptionType;
  direction: OptionDirection;
  premium: number;
  quantity: number;
  breakEvenPrice: number;
  maxProfit: number;
  maxLoss: number;
  requiredMargin: number;
  scenarioAtm: PriceScenario;
  scenarioPlus5: PriceScenario;
  scenarioMinus5: PriceScenario;
  riskAdjustedReturn: number;
  probabilityItm: number;
  warnings: string[];
  calculatedAt: string;
  calculationVersion: string;
  assumptions: OptionStrategyInput["assumptions"];
}

export type OptionStrategyResult = OptionStrategyOutput | {
  ticker: string;
  optionType: "call" | "put";
  direction: "long" | "short";
  breakEven: number;
  maxLoss: number;
  maxProfit: number;
  requiredMargin: number;
};
