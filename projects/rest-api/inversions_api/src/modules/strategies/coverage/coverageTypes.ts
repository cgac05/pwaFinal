// FIC: Coverage strategy types — math utilities and shared types for coverage engines. (EN)
// FIC: Tipos de cobertura — utilidades matemáticas y tipos compartidos para engines de cobertura. (ES)

export type { CoverageRiskMetrics as RiskMetrics } from "./coverageStrategyContract";

// FIC: Standard normal PDF φ(x) = exp(-x²/2) / √(2π) (EN)
// FIC: PDF normal estándar φ(x) = exp(-x²/2) / √(2π) (ES)
function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// FIC: Standard normal CDF using Abramowitz & Stegun (1964) approximation 26.2.17. (EN)
// FIC: CDF normal estándar usando la aproximación de Abramowitz & Stegun (1964) 26.2.17. (ES)
// Correct formula: upper tail = φ(x) * poly(k)  — NOT (1-φ(x)) * poly(k)
// Verificación: normalCdf(0) ≈ 0.500, normalCdf(-10) ≈ 0, normalCdf(10) ≈ 1
export function normalCdf(x: number): number {
  const absX = Math.abs(x);
  const k = 1.0 / (1.0 + 0.2316419 * absX);
  const phi = normalPdf(absX); // φ(|x|) — multiply by φ, not (1-φ)
  const poly =
    k * (0.319381530 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  const upperTail = phi * poly; // φ(x) * polynomial
  return x >= 0 ? 1.0 - upperTail : upperTail;
}

// FIC: Simplified Black-Scholes option premium estimator. (EN)
// FIC: Estimador simplificado de prima de opciones basado en Black-Scholes. (ES)
// Parameters: type (call/put), strike, IV (annualized vol, default 0.25), DTE (days, default 90).
// underlyingPrice defaults to strike (ATM) when not provided.
export function estimateOptionPremium(
  type: "call" | "put",
  strike: number,
  IV: number = 0.25,
  DTE: number = 90,
  underlyingPrice: number = strike
): number {
  if (strike <= 0 || underlyingPrice <= 0 || IV <= 0 || DTE <= 0) return 0;

  const T = DTE / 365; // time to expiration in years
  const sqrtT = Math.sqrt(T);
  const r = 0.05; // risk-free rate approximation
  const logSK = Math.log(underlyingPrice / strike);
  const d1 = (logSK + (r + 0.5 * IV * IV) * T) / (IV * sqrtT);
  const d2 = d1 - IV * sqrtT;

  let premium: number;
  if (type === "call") {
    premium = underlyingPrice * normalCdf(d1) - strike * Math.exp(-r * T) * normalCdf(d2);
  } else {
    premium = strike * Math.exp(-r * T) * normalCdf(-d2) - underlyingPrice * normalCdf(-d1);
  }

  return Math.max(0, premium);
}

// FIC: Black-Scholes delta — N(d1) for call, N(d1)-1 for put. Used when API Greeks are unavailable. (EN)
// FIC: Delta Black-Scholes — N(d1) para call, N(d1)-1 para put. Usado cuando Greeks de API no están disponibles. (ES)
export function computeDelta(
  type: "call" | "put",
  strike: number,
  iv: number,
  dte: number,
  underlyingPrice: number
): number {
  if (strike <= 0 || underlyingPrice <= 0 || iv <= 0 || dte <= 0) return 0;
  const T = dte / 365;
  const r = 0.05;
  const d1 = (Math.log(underlyingPrice / strike) + (r + 0.5 * iv * iv) * T) / (iv * Math.sqrt(T));
  return type === "call" ? normalCdf(d1) : normalCdf(d1) - 1;
}
