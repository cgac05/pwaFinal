/**
 * termUtils.ts — T162 (utilidad compartida)
 * Proposito: Implementacion Black-Scholes con griegas (delta, gamma, theta, vega),
 * interpolacion de curva IV y calculo de DTE. Base matematica de todo el modulo term.
 * Llamado por: calendarSpreadEngine, diagonalSpreadEngine, termSimulationEngine,
 *              termRiskEngine, termRollOrchestrator
 * (No tiene dependencias internas excepto el tipo OptionStyle de termStrategyContract)
 */
import type { OptionStyle } from "./termStrategyContract";

/** Aproximacion polinomica de Hastings para la CDF normal estandar. Usada internamente por blackScholesPrice y las griegas */
export function cumulativeNormal(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  if (x < -10) return 0;
  if (x > 10) return 1;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const poly = (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t;
  const pdf = Math.exp(-0.5 * absX * absX) / Math.sqrt(2 * Math.PI);
  const cnd = 1 - pdf * poly;

  return sign < 0 ? 1 - cnd : cnd;
}

/**
 * Precio Black-Scholes para opcion europea call/put.
 * Llamada por: calendarSpreadEngine (generateScenarios), diagonalSpreadEngine (generatePriceScenarios, etc.),
 *              termSimulationEngine (runMonteCarlo, runDeterministic), termRiskEngine (evaluateEarlyAssignmentRisk),
 *              termRollOrchestrator (calculateRollCost)
 */
export function blackScholesPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionStyle: OptionStyle
): number {
  if (T <= 0) {
    const intrinsic = optionStyle === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
    return intrinsic;
  }
  if (sigma <= 0 || S <= 0 || K <= 0) return 0;

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (optionStyle === "call") {
    return S * cumulativeNormal(d1) - K * Math.exp(-r * T) * cumulativeNormal(d2);
  }
  return K * Math.exp(-r * T) * cumulativeNormal(-d2) - S * cumulativeNormal(-d1);
}

/** Delta de Black-Scholes. Llamada por: diagonalSpreadEngine (calculateGreeks, generatePriceScenarios, generateThetaDecayProfile) */
export function blackScholesDelta(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionStyle: OptionStyle
): number {
  if (T <= 0) {
    return optionStyle === "call" ? (S > K ? 1 : 0) : (S > K ? 0 : -1);
  }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  if (optionStyle === "call") return cumulativeNormal(d1);
  return cumulativeNormal(d1) - 1;
}

/** Gamma de Black-Scholes (segunda derivada del precio respecto al subyacente). Llamada por: diagonalSpreadEngine */
export function blackScholesGamma(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  _optionStyle: OptionStyle
): number {
  if (T <= 0 || sigma <= 0 || S <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const nd1 = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
  return nd1 / (S * sigma * Math.sqrt(T));
}

/** Theta de Black-Scholes (decaimiento temporal). Llamada por: calendarSpreadEngine (analyze, generateScenarios), diagonalSpreadEngine */
export function blackScholesTheta(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionStyle: OptionStyle
): number {
  if (T <= 0) return 0;

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const nd1 = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);

  if (optionStyle === "call") {
    return (-S * nd1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cumulativeNormal(d2);
  }
  return (-S * nd1 * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cumulativeNormal(-d2);
}

/** Vega de Black-Scholes (sensibilidad a volatilidad). Llamada por: diagonalSpreadEngine */
export function blackScholesVega(
  S: number,
  K: number,
  T: number,
  _r: number,
  sigma: number,
  _optionStyle: OptionStyle
): number {
  if (T <= 0 || sigma <= 0 || S <= 0) return 0;
  const d1 = (Math.log(S / K) + (_r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const nd1 = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
  return S * nd1 * Math.sqrt(T);
}

/** Interpolacion lineal de IV desde una curva DTE->IV. Default 0.2 si no hay datos. Llamada por: calendarSpreadEngine, diagonalSpreadEngine, termSimulationEngine */
export function interpolateIv(dte: number, ivCurve: Array<{ dte: number; iv: number }>): number {
  if (ivCurve.length === 0) return 0.2;
  if (ivCurve.length === 1) return ivCurve[0].iv;

  const sorted = [...ivCurve].sort((a, b) => a.dte - b.dte);

  if (dte <= sorted[0].dte) return sorted[0].iv;
  if (dte >= sorted[sorted.length - 1].dte) return sorted[sorted.length - 1].iv;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (dte >= sorted[i].dte && dte <= sorted[i + 1].dte) {
      const t = (dte - sorted[i].dte) / (sorted[i + 1].dte - sorted[i].dte);
      return sorted[i].iv + t * (sorted[i + 1].iv - sorted[i].iv);
    }
  }

  return sorted[sorted.length - 1].iv;
}

/** Diferencia en dias calendario entre `from` y `expiration` (techo, minimo 0). Llamada por: calendarSpreadEngine, diagonalSpreadEngine, termSimulationEngine, termRiskEngine, termRollOrchestrator */
export function daysToExpiration(expiration: Date, from: Date): number {
  const diffMs = expiration.getTime() - from.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/** Estima la IV forward entre dos DTE: sqrt((IV2^2 * T2 - IV1^2 * T1) / (T2 - T1)).
 *  Usada por calendarSpreadEngine y diagonalSpreadEngine para precio mas preciso
 *  de la pata larga cuando se provee curva IV. */
export function estimateForwardIv(ivShort: number, ivLong: number, shortT: number, longT: number): number {
  if (longT <= shortT || shortT <= 0) return ivLong;
  const numerator = ivLong * ivLong * longT - ivShort * ivShort * shortT;
  if (numerator <= 0) return Math.max(ivShort, ivLong) * 0.9;
  return Math.sqrt(numerator / (longT - shortT));
}
