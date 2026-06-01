// FIC: Expiration analysis engine — calendar events, time decay regimes, and seasonal bias. (EN)
// FIC: Motor de análisis de vencimientos — eventos de calendario, regímenes de decaimiento temporal y sesgo estacional. (ES)

import type { InstitutionalAnalysisContract } from "./institutionalContract";
import type { InstitutionalResolveResult } from "./institutionalDataService";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_WINDOW_DAYS = 90;
const LOOK_AHEAD_MONTHS = 6;
const STRIKE_PROXIMITY_PCT = 0.05;

const OPEX_WEEKDAY = 5;                                   // Friday / Viernes
const QUARTER_MONTHS = [3, 6, 9, 12];                    // quarterly OpEx months
const TRIPLE_WITCHING_MONTHS = [3, 6, 9, 12];
const QUARTERLY_REPORT_MONTHS = [2, 5, 8, 11];           // Feb, May, Aug, Nov
const FOMC_MONTHS = [1, 3, 5, 6, 7, 9, 11, 12];
const EARNINGS_MONTHS = [1, 4, 7, 10];

// ─── Output types ─────────────────────────────────────────────────────────────

export type ExpirationEventType =
  | "monthly_opex"
  | "quarterly_opex"
  | "fomc"
  | "cpi"
  | "earnings"
  | "quarter_futures";

export interface ExpirationEvent {
  date: string;                    // ISO date (YYYY-MM-DD)
  type: ExpirationEventType;
  label: string;
  significance: number;            // 0–1
  daysToExpiry?: number;
}

export type TimeDecayRegime = "at_expiration" | "near" | "far";
export type ExpiryBias = "bullish" | "bearish" | "neutral";
export type CallPutSkew = "call_skew" | "put_skew" | "symmetric";

export interface ExpirationAnalysisResult {
  ticker: string;
  events: ExpirationEvent[];
  currentRegime: TimeDecayRegime;
  theta: number;
  gamma: number;
  expiryBias: ExpiryBias;
  callPutSkew: CallPutSkew;
  quarterlyReportImpact: number;
  daysToNextOpex: number;
  analyzedAt: string;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class ExpirationAnalysisEngine {
  // FIC: Main analysis — generates calendar events and computes time decay regime. (EN)
  // FIC: Análisis principal — genera eventos de calendario y calcula el régimen de decaimiento temporal. (ES)
  async analyze(
    request: InstitutionalAnalysisContract,
    preResolvedResult?: InstitutionalResolveResult,
    candles?: Array<{ close: number; volume: number }>,
    precioActual?: number
  ): Promise<ExpirationAnalysisResult> {
    const now = new Date();
    const events: ExpirationEvent[] = [];

    // Generate events for the next LOOK_AHEAD_MONTHS
    for (let m = 0; m < LOOK_AHEAD_MONTHS; m++) {
      const target = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const year = target.getFullYear();
      const month = target.getMonth() + 1; // 1-indexed

      this.addMonthlyOpex(events, year, month);
      this.addQuarterlyEvents(events, year, month);
      this.addFomc(events, year, month);
      this.addCpi(events, year, month);
      this.addEarnings(events, year, month);
      this.addQuarterlyReportWindow(events, year, month);
    }

    // Filter to events after today and compute daysToExpiry
    const todayMs = now.getTime();
    const nowDateStr = toIsoDate(now);
    for (const ev of events) {
      const evMs = new Date(ev.date + "T00:00:00").getTime();
      if (evMs >= todayMs) ev.daysToExpiry = Math.round((evMs - todayMs) / 86_400_000);
    }
    events.sort((a, b) => a.date.localeCompare(b.date));

    // Next monthly OpEx for regime computation
    const nextOpex = events.find((e) => e.type === "monthly_opex" || e.type === "quarterly_opex");
    const daysToNextOpex = nextOpex?.daysToExpiry ?? DEFAULT_WINDOW_DAYS;

    const regime = this.computeRegime(daysToNextOpex);
    const closes = candles?.map((c) => c.close) ?? [];
    const sigma = historicalVolatility(closes);
    const price = precioActual ?? closes[closes.length - 1] ?? 100;
    const { theta, gamma } = this.computeGreeks(price, daysToNextOpex, sigma);
    const expiryBias = this.computeExpiryBias(now.getMonth() + 1);
    const callPutSkew = this.computeCallPutSkew(preResolvedResult, request);
    const quarterlyReportImpact = this.computeQuarterlyReportImpact(now);

    return {
      ticker: request.ticker,
      events: events.filter((e) => e.date >= nowDateStr),
      currentRegime: regime,
      theta,
      gamma,
      expiryBias,
      callPutSkew,
      quarterlyReportImpact,
      daysToNextOpex,
      analyzedAt: new Date().toISOString(),
    };
  }

  // FIC: Monthly OpEx — 3rd Friday of each month. (EN)
  // FIC: OpEx mensual — 3er viernes de cada mes. (ES)
  private addMonthlyOpex(events: ExpirationEvent[], year: number, month: number): void {
    const date = findNthWeekday(year, month, 3, OPEX_WEEKDAY);
    const isQuarter = QUARTER_MONTHS.includes(month);
    if (isQuarter) return; // quarterly events handle this month separately
    events.push({
      date: toIsoDate(date),
      type: "monthly_opex",
      label: `Monthly Options Expiration (${month}/${year})`,
      significance: 0.6,
    });
  }

  // FIC: Quarterly events — quarterly OpEx (3rd Friday) + Triple Witching dedup + Quarter Futures (last Friday). (EN)
  // FIC: Eventos trimestrales — OpEx trimestral (3er viernes) + dedup Triple Witching + Futuros trimestrales (último viernes). (ES)
  private addQuarterlyEvents(events: ExpirationEvent[], year: number, month: number): void {
    if (!QUARTER_MONTHS.includes(month)) return;

    // Quarterly OpEx: 3rd Friday
    const qDate = findNthWeekday(year, month, 3, OPEX_WEEKDAY);
    const qDateStr = toIsoDate(qDate);
    events.push({
      date: qDateStr,
      type: "quarterly_opex",
      label: `Quarterly Options Expiration (${month}/${year})`,
      significance: 0.85,
    });

    // Triple Witching: same date as quarterly OpEx — dedup instead of pushing new event
    if (TRIPLE_WITCHING_MONTHS.includes(month)) {
      const existing = events.find((e) => e.date === qDateStr && e.type === "quarterly_opex");
      if (existing) {
        // FIC: Dedup: update label and raise significance instead of adding duplicate event. (EN)
        // FIC: Dedup: actualiza etiqueta y eleva significancia en lugar de agregar evento duplicado. (ES)
        existing.label = `Triple Witching — Quarterly OpEx (${month}/${year})`;
        existing.significance = 0.95;
      }
    }

    // Quarter futures: last Friday of the quarter month
    const lastFriday = lastWeekdayOfMonth(year, month, OPEX_WEEKDAY);
    const lfStr = toIsoDate(lastFriday);
    if (lfStr !== qDateStr) {
      events.push({
        date: lfStr,
        type: "quarter_futures",
        label: `Quarter Futures Expiration (${month}/${year})`,
        significance: 0.75,
      });
    }
  }

  // FIC: FOMC — 2nd Wednesday of FOMC months [1,3,5,6,7,9,11,12]. (EN)
  // FIC: FOMC — 2do miércoles de los meses FOMC [1,3,5,6,7,9,11,12]. (ES)
  private addFomc(events: ExpirationEvent[], year: number, month: number): void {
    if (!FOMC_MONTHS.includes(month)) return;
    const date = findNthWeekday(year, month, 2, 3); // 3=Wednesday
    events.push({
      date: toIsoDate(date),
      type: "fomc",
      label: `FOMC Meeting (${month}/${year})`,
      significance: 0.80,
    });
  }

  // FIC: CPI release — 2nd TUESDAY of every month (NOT Wednesday — T1103 bugfix). (EN)
  // FIC: Publicación CPI — 2do MARTES de cada mes (NO miércoles — bugfix T1103). (ES)
  private addCpi(events: ExpirationEvent[], year: number, month: number): void {
    const cpiDate = findNthWeekday(year, month, 2, 2); // 2=Tuesday
    events.push({
      date: toIsoDate(cpiDate),
      type: "cpi",
      label: `CPI Release (${month}/${year})`,
      significance: 0.70,
    });
  }

  // FIC: Earnings season — 2nd Friday of earnings months [1,4,7,10]. (EN)
  // FIC: Temporada de resultados — 2do viernes de los meses de earnings [1,4,7,10]. (ES)
  private addEarnings(events: ExpirationEvent[], year: number, month: number): void {
    if (!EARNINGS_MONTHS.includes(month)) return;
    const date = findNthWeekday(year, month, 2, OPEX_WEEKDAY); // 5=Friday
    events.push({
      date: toIsoDate(date),
      type: "earnings",
      label: `Earnings Season Peak (${month}/${year})`,
      significance: 0.75,
    });
  }

  // FIC: Quarterly report window: ±7/+14 days around the 15th of Feb/May/Aug/Nov. (EN)
  // FIC: Ventana de reporte trimestral: ±7/+14 días alrededor del 15 de feb/may/ago/nov. (ES)
  private addQuarterlyReportWindow(events: ExpirationEvent[], year: number, month: number): void {
    if (!QUARTERLY_REPORT_MONTHS.includes(month)) return;
    const anchor = new Date(year, month - 1, 15);
    events.push({
      date: toIsoDate(anchor),
      type: "earnings",
      label: `Quarterly Report Window Center (${month}/${year})`,
      significance: 0.65,
    });
  }

  private computeRegime(daysToNextOpex: number): TimeDecayRegime {
    if (daysToNextOpex <= 7) return "at_expiration";
    if (daysToNextOpex <= 30) return "near";
    return "far";
  }

  // FIC: Black-Scholes ATM Greeks — theta (daily $/share decay) and gamma (delta sensitivity). (EN)
  // FIC: Greeks ATM Black-Scholes — theta (decaimiento diario $/acción) y gamma (sensibilidad del delta). (ES)
  private computeGreeks(
    price: number,
    daysToOpex: number,
    sigma: number
  ): { theta: number; gamma: number } {
    const T = Math.max(daysToOpex, 1) / 365;
    const sqrtT = Math.sqrt(T);
    const SQRT_2PI = Math.sqrt(2 * Math.PI);
    const gamma = 1 / (price * sigma * SQRT_2PI * sqrtT);
    const theta = -(price * sigma) / (2 * SQRT_2PI * sqrtT) / 365;
    return {
      gamma: Number(gamma.toFixed(6)),
      theta: Number(theta.toFixed(6)),
    };
  }

  // FIC: Seasonal bias by calendar month — T1105 bugfix values. (EN)
  // FIC: Sesgo estacional por mes calendario — valores del bugfix T1105. (ES)
  private computeExpiryBias(month: number): ExpiryBias {
    if (month === 9) return "bearish";               // September — worst month historically
    if (month === 10) return "neutral";              // October — volatile but recovers
    if (month === 11 || month === 12) return "bullish"; // Santa rally
    if (month >= 4 && month <= 6) return "bullish"; // Spring rally
    if (month >= 7 && month <= 8) return "neutral"; // Summer low volume
    return "neutral";                                // Jan-Mar default
  }

  // FIC: Call/put skew from institutional flow ratio and ownership. (EN)
  // FIC: Sesgo call/put derivado del ratio de flujos institucionales y propiedad. (ES)
  private computeCallPutSkew(
    preResolvedResult: InstitutionalResolveResult | undefined,
    request: InstitutionalAnalysisContract
  ): CallPutSkew {
    const merged = preResolvedResult?.merged;
    const inflows = merged?.flows?.inflows ?? request.flows.inflows;
    const outflows = merged?.flows?.outflows ?? request.flows.outflows;
    const total = inflows + outflows;
    const flowRatio = total > 0 ? (inflows - outflows) / total : 0;
    const ownership = merged?.fundsOwnershipPct ?? request.fundsOwnershipPct;

    if (flowRatio > 0.25 && ownership > 30) return "call_skew";
    if (flowRatio < -0.25 && ownership < 20) return "put_skew";
    return "symmetric";
  }

  // FIC: Quarterly report window impact — overlapRatio × 3.5% around the 15th of report months. (EN)
  // FIC: Impacto de ventana de reporte trimestral — overlapRatio × 3.5% alrededor del 15 de meses de reporte. (ES)
  private computeQuarterlyReportImpact(now: Date): number {
    const month = now.getMonth() + 1;
    if (!QUARTERLY_REPORT_MONTHS.includes(month)) return 0;
    const anchor = new Date(now.getFullYear(), now.getMonth(), 15);
    const diffDays = Math.abs((now.getTime() - anchor.getTime()) / 86_400_000);
    const windowDays = 21; // [-7, +14] total = 21 days
    const overlapRatio = Math.max(0, 1 - diffDays / windowDays);
    return overlapRatio * 0.035; // 3.5% max impact
  }
}

// ─── Volatility helper ────────────────────────────────────────────────────────

// FIC: Annualized historical volatility from log-returns (252 trading days). (EN)
// FIC: Volatilidad histórica anualizada a partir de log-retornos (252 días de trading). (ES)
function historicalVolatility(closes: number[], lookback = 30): number {
  const slice = closes.slice(-lookback - 1);
  if (slice.length < 2) return 0.20;
  const returns = slice.slice(1).map((p, i) => Math.log(p / slice[i]));
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252);
}

// ─── Calendar helpers ──────────────────────────────────────────────────────────

// FIC: Find the nth occurrence of weekday in a given month/year. (EN)
// FIC: Encuentra la n-ésima ocurrencia de un día de la semana en un mes/año dado. (ES)
// weekday: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
export function findNthWeekday(year: number, month: number, nth: number, weekday: number): Date {
  let count = 0;
  const d = new Date(year, month - 1, 1); // first day of month (month is 1-indexed)
  while (true) {
    if (d.getDay() === weekday) {
      count++;
      if (count === nth) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
    if (d.getMonth() !== month - 1) break; // overflowed into next month
  }
  // Fallback: return last day with that weekday found
  return d;
}

// FIC: Find the last occurrence of weekday in a month. (EN)
// FIC: Encuentra la última ocurrencia de un día de la semana en un mes. (ES)
export function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  // new Date(year, month, 0) = last day of month (month is 1-indexed, day=0 trick)
  const lastDay = new Date(year, month, 0);
  const dow = lastDay.getDay();
  const diff = (dow - weekday + 7) % 7;
  lastDay.setDate(lastDay.getDate() - diff);
  return lastDay;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
