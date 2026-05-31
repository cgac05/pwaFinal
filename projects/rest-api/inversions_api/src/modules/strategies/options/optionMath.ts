import type { OptionStrategyInput, OptionStrategyContract, OptionType, OptionDirection, RiskTolerance } from "../optionsStrategyContract";
//Operaciones matematicas relacionadas con opciones, como cálculos de primas, márgenes, probabilidades, etc.
export const CONTRACT_MULTIPLIER = 100;

export function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function assertPositiveNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
}

export function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} must be an integer greater than or equal to 1`);
  }
}

export function validateOptionInput(params: OptionStrategyInput, optionType: OptionType, direction: OptionDirection): void {
  if (params.optionType !== optionType || params.direction !== direction) {
    throw new Error(`Expected ${direction} ${optionType} parameters`);
  }

  assertPositiveNumber(params.strikePrice, "strikePrice");
  assertPositiveNumber(params.currentPrice, "currentPrice");
  assertPositiveNumber(params.premiumPerContract, "premiumPerContract");
  assertPositiveInteger(params.numberOfContracts, "numberOfContracts");
  assertPositiveNumber(params.availableCapital, "availableCapital");
  assertPositiveInteger(params.daysToExpiration, "daysToExpiration");

  if (!params.expirationDate || Number.isNaN(new Date(params.expirationDate).getTime())) {
    throw new Error("expirationDate must be a valid ISO date string");
  }
}

export function totalPremium(premium: number, numberOfContracts: number): number {
  return roundMoney(premium * numberOfContracts * CONTRACT_MULTIPLIER);
}

export function assignmentValue(pricePerShare: number, numberOfContracts: number): number {
  return roundMoney(pricePerShare * numberOfContracts * CONTRACT_MULTIPLIER);
}

export function calculateShortOptionMargin(
  currentPrice: number,
  strikePrice: number,
  premium: number,
  numberOfContracts: number,
  optionType: OptionType
): number {
  void currentPrice;
  void premium;
  void optionType;
  return roundMoney(strikePrice * numberOfContracts * CONTRACT_MULTIPLIER * 0.2);
}

export function expectedMoveDollars(currentPrice: number, impliedVolatility: number, daysToExpiration: number): number {
  return currentPrice * (impliedVolatility / 100) * Math.sqrt(daysToExpiration / 365);
}

export function probabilityInTheMoney(
  optionType: OptionType,
  currentPrice: number,
  strikePrice: number,
  impliedVolatility: number,
  daysToExpiration: number
): number {
  const move = expectedMoveDollars(currentPrice, impliedVolatility, daysToExpiration);
  if (move <= 0) {
    return optionType === "CALL"
      ? currentPrice > strikePrice ? 1 : 0
      : currentPrice < strikePrice ? 1 : 0;
  }

  const z = (strikePrice - currentPrice) / move;
  const belowStrike = normalCdf(z);
  const probability = optionType === "CALL" ? 1 - belowStrike : belowStrike;
  return Math.max(0, Math.min(1, probability));
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absX);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absX * absX);
  return sign * y;
}

export function normalizeOptionStrategyInput(
  params: OptionStrategyContract | OptionStrategyInput,
  optionType?: OptionType,
  direction?: OptionDirection
): OptionStrategyInput {
  const raw = params as OptionStrategyContract & Partial<OptionStrategyInput> & {
    availableCapital?: number;
    premiumPerContract?: number;
    numberOfContracts?: number;
  };

  const normalizedOptionType = optionType ?? ((String(params.optionType ?? "CALL").toUpperCase()) as OptionType);
  const normalizedDirection = direction ?? ((String(params.direction ?? "LONG").toUpperCase()) as OptionDirection);
  const expirationDate = params.expirationDate;
  const daysToExpiration = typeof raw.daysToExpiration === "number"
    ? raw.daysToExpiration
    : calculateDaysToExpiration(expirationDate);
  const currentPrice = typeof raw.currentPrice === "number" ? raw.currentPrice : undefined;
  const premiumPerContract = typeof raw.premiumPerContract === "number" ? raw.premiumPerContract : raw.premium;
  const numberOfContracts = typeof raw.numberOfContracts === "number" ? raw.numberOfContracts : raw.quantity;
  const availableCapital = typeof raw.availableCapital === "number" ? raw.availableCapital : raw.capitalAvailable;
  const impliedVolatility = raw.assumptions?.impliedVolatility;

  if (currentPrice === undefined) {
    throw new Error("currentPrice is required; enrich with real market data before calculation");
  }
  if (premiumPerContract === undefined) {
    throw new Error("premium is required; enrich with real option market data before calculation");
  }
  if (numberOfContracts === undefined) {
    throw new Error("quantity is required");
  }
  if (availableCapital === undefined) {
    throw new Error("availableCapital is required");
  }
  if (impliedVolatility === undefined) {
    throw new Error("assumptions.impliedVolatility is required; enrich with real option IV before calculation");
  }

  return {
    ticker: params.ticker,
    optionType: normalizedOptionType,
    direction: normalizedDirection,
    strikePrice: params.strikePrice,
    currentPrice,
    expirationDate,
    daysToExpiration,
    premiumPerContract,
    numberOfContracts,
    availableCapital,
    riskTolerance: normalizeRiskTolerance(raw.riskTolerance),
    assumptions: {
      impliedVolatility,
      timeDecayModel: raw.assumptions?.timeDecayModel ?? "LINEAR",
      interestRate: raw.assumptions?.interestRate ?? 0,
      expectedReturn: raw.assumptions?.expectedReturn
    }
  };
}

function calculateDaysToExpiration(expirationDate: string): number {
  const expirationTime = new Date(expirationDate).getTime();
  if (Number.isNaN(expirationTime)) return 30;
  return Math.max(1, Math.ceil((expirationTime - Date.now()) / 86_400_000));
}

function normalizeRiskTolerance(value: OptionStrategyInput["riskTolerance"] | OptionStrategyContract["riskTolerance"] | undefined): RiskTolerance {
  const normalized = String(value ?? "MEDIUM").toUpperCase();
  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH") return normalized;
  return "MEDIUM";
}
