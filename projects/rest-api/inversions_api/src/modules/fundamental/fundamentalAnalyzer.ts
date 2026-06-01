/**
 * FundamentalAnalyzer — cerebro de análisis fundamental automatizado.
 * Toma datos de cualquier fuente (FMP, Finnhub, SimFin, Finviz),
 * los envía a Claude y genera análisis detallado + filas de confluencia.
 */

import type { FundamentalAnalysisData } from "./fundamentalSourceContract";
import { resolveOptionContext } from "../market/optionChainService";

export interface AnalysisOptions {
  ticker?: string;
  investmentProfile: string; // Value, Growth, Dividend, Quality, Aggressive
  horizon: string;           // Corto plazo, Mediano plazo, Largo plazo
  selectedMetrics: string[]; // Valoración, Crecimiento, Rentabilidad, etc.
  strategy: string;          // Short Call, Short Put, Long Call, Long Put
  comparisons: string[];     // Comparar con sector, industria, S&P500
  projectionFrom?: string;   // ISO date — inicio del rango de proyección
  projectionTo?: string;     // ISO date — fin del rango de proyección
}

export interface MetricSection {
  metric: string;
  score: number;          // 0-100
  tipoSenal: "CALL" | "PUT" | "HOLD";
  tendencia: "ALCISTA" | "BAJISTA" | "LATERAL";
  invertir: boolean;
  finding: string;
}

export interface FundamentalAnalysisResult {
  ticker: string;
  companyName: string;
  aiAnalysis: string;       // Full narrative from Claude
  sections: MetricSection[];
  overallScore: number;     // 0-100
  verdict: "VIABLE" | "NEUTRAL" | "NOT_VIABLE";
  recommendation: string;
  projection: FundamentalProjection;
  confluenceRows: FundamentalConfluenceRow[];
  sourceId: string;
  timestamp: string;
}

export interface ProjectionPoint {
  date: string;
  basePrice: number;
  bullishPrice: number;
  bearishPrice: number;
  basePnL: number;
  bullishPnL: number;
  bearishPnL: number;
}

export interface StrategyScenario {
  label: "ATM" | "+5%" | "-5%";
  price: number;
  profitLoss: number;
}

export interface FundamentalProjection {
  ticker: string;
  strategy: string;
  verdict: "VIABLE" | "MARGINAL" | "NO_VIABLE";
  score: number;
  projectionFrom: string;
  projectionTo: string;
  days: number;
  initialPrice: number;
  expectedMove: number;
  expectedMovePercent: number;
  strike: number;
  premium: number;
  breakeven: number;
  maxLoss: number | "ILIMITADO";
  maxProfit: number | "ILIMITADO";
  scenarios: StrategyScenario[];
  path: ProjectionPoint[];
  drivers: string[];
  changeTriggers: string[];
  calculationSteps: string[];
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  ticker: string,
  data: FundamentalAnalysisData,
  opts: AnalysisOptions
): string {
  const m = data.metrics;
  const lines: string[] = [];

  lines.push("Eres un analista financiero fundamental experto. Analiza los siguientes datos de mercado y proporciona un análisis detallado y estructurado en español.");
  lines.push("NO des consejos de compra/venta directos. Explica los datos, identifica fortalezas y riesgos, y concluye con una perspectiva objetiva.");
  lines.push("");
  lines.push(`EMPRESA: ${data.companyName || ticker} (${ticker})`);
  lines.push(`SECTOR: ${m.sector?.sector ?? "N/D"} | INDUSTRIA: ${m.sector?.industry ?? "N/D"}`);
  lines.push(`FUENTE DE DATOS: ${data.metadata.sourceId.toUpperCase()}`);
  lines.push("");
  lines.push("── PERFIL DEL INVERSOR ──");
  lines.push(`Perfil: ${opts.investmentProfile} | Horizonte: ${opts.horizon} | Estrategia: ${opts.strategy}`);
  lines.push("");
  lines.push("── DATOS DE MERCADO ──");

  if (m.priceHistory) {
    const ph = m.priceHistory;
    if (typeof ph.currentPrice === "number") lines.push(`Precio actual:       $${ph.currentPrice.toFixed(2)}`);
    if (typeof ph.priceHigh52Week === "number") lines.push(`Max 52 semanas:      ${ph.priceHigh52Week.toFixed(2)}`);
    if (typeof ph.priceLow52Week === "number") lines.push(`Min 52 semanas:      ${ph.priceLow52Week.toFixed(2)}`);
    if (typeof ph.priceChange52WeekPercent === "number") lines.push(`Cambio 52 sem:       ${ph.priceChange52WeekPercent.toFixed(2)}%`);
  }
  if (typeof m.marketCap?.value === "number") {
    lines.push(`Market Cap:          $${(m.marketCap.value / 1e9).toFixed(2)}B`);
  }
  if (typeof m.volatility?.annualizedVolatility === "number") {
    lines.push(`Volatilidad anual:   ${m.volatility.annualizedVolatility.toFixed(2)}%`);
  }
  if (typeof m.beta?.value === "number") {
    lines.push(`Beta:                ${m.beta.value.toFixed(2)}`);
  }

  lines.push("");
  lines.push("── RATIOS DE VALORACIÓN ──");
  if (m.financialRatios) {
    const r = m.financialRatios;
    if (r.peRatio)      lines.push(`P/E:                 ${r.peRatio.toFixed(2)}`);
    if (r.pbRatio)      lines.push(`P/B:                 ${r.pbRatio.toFixed(2)}`);
    if (r.psRatio)      lines.push(`P/S:                 ${r.psRatio.toFixed(2)}`);
    if (r.roe)          lines.push(`ROE:                 ${r.roe.toFixed(2)}%`);
    if (r.debtToEquity) lines.push(`Deuda/Patrimonio:    ${r.debtToEquity.toFixed(2)}`);
  }

  if (typeof m.eps?.eps === "number") {
    lines.push("");
    lines.push("── GANANCIAS POR ACCIÓN ──");
    lines.push(`EPS TTM:             $${m.eps.eps.toFixed(2)}`);
    if (m.eps.epsGrowthYoYPercent)
      lines.push(`Crecimiento EPS YoY: ${m.eps.epsGrowthYoYPercent.toFixed(2)}%`);
  }

  if (m.sales) {
    lines.push("");
    lines.push("── VENTAS ──");
    if (typeof m.sales.annualRevenue === "number" && m.sales.annualRevenue > 0)
      lines.push(`Ingresos anuales:    $${(m.sales.annualRevenue / 1e9).toFixed(2)}B`);
    if (m.sales.revenueGrowthPercent)
      lines.push(`Crecimiento ingresos:${m.sales.revenueGrowthPercent.toFixed(2)}%`);
  }

  if (typeof m.dividend?.dividendYieldPercent === "number") {
    lines.push("");
    lines.push("── DIVIDENDOS ──");
    lines.push(`Dividend Yield:      ${m.dividend.dividendYieldPercent.toFixed(2)}%`);
  }

  lines.push("");
  lines.push("── MÉTRICAS A ANALIZAR ──");
  lines.push(opts.selectedMetrics.join(", "));

  lines.push("");
  lines.push("── COMPARACIONES REQUERIDAS ──");
  lines.push(opts.comparisons.length > 0 ? opts.comparisons.join(", ") : "Sin comparaciones específicas");

  if (opts.projectionFrom && opts.projectionTo) {
    lines.push("");
    lines.push("── RANGO DE PROYECCIÓN ──");
    lines.push(`Período a simular: ${opts.projectionFrom} → ${opts.projectionTo}`);
    const msFrom = new Date(opts.projectionFrom).getTime();
    const msTo = new Date(opts.projectionTo).getTime();
    const days = Math.round((msTo - msFrom) / 86_400_000);
    lines.push(`Duración: ${days} días (~${(days / 30).toFixed(1)} meses)`);
    lines.push("Contexto: El inversor quiere proyectar qué podría suceder con su estrategia en este período específico.");
  }

  lines.push("");
  lines.push("── INSTRUCCIONES DE ANÁLISIS ──");
  lines.push("Proporciona un análisis estructurado con las siguientes secciones:");
  lines.push("1. RESUMEN EJECUTIVO (2-3 párrafos sobre el estado actual de la empresa)");
  lines.push("2. ANÁLISIS POR MÉTRICA (una subsección por cada métrica seleccionada con interpretación detallada)");
  lines.push("3. FORTALEZAS CLAVE (lista de 3-5 puntos positivos basados en los datos)");
  lines.push("4. RIESGOS IDENTIFICADOS (lista de 3-5 riesgos o debilidades)");
  lines.push(`5. PERSPECTIVA ${opts.horizon.toUpperCase()} (análisis según el horizonte de inversión seleccionado)`);
  lines.push(`6. ANÁLISIS DE ESTRATEGIA ${opts.strategy.toUpperCase()} (evaluación de si la estrategia es adecuada para este perfil fundamental)`);
  if (opts.projectionFrom && opts.projectionTo) {
    const days = Math.round((new Date(opts.projectionTo).getTime() - new Date(opts.projectionFrom).getTime()) / 86_400_000);
    lines.push(`7. PROYECCIÓN ${opts.projectionFrom} → ${opts.projectionTo} (${days} días): basándote en los datos históricos, volatilidad, tendencia y métricas fundamentales, proyecta qué escenarios son más probables para la estrategia ${opts.strategy} en este rango. Incluye: escenario alcista, escenario bajista y escenario base con probabilidades aproximadas y factores clave que podrían inclinar la balanza. Sé específico con niveles de precio si es posible.`);
    lines.push("8. CONCLUSIÓN Y PERSPECTIVA OBJETIVA");
  } else {
    lines.push("7. CONCLUSIÓN Y PERSPECTIVA OBJETIVA");
  }
  lines.push("");
  lines.push("Usa lenguaje profesional y financiero. Incluye números específicos de los datos proporcionados. Máximo 700 palabras.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Score each metric section from data
// ---------------------------------------------------------------------------

function scoreMetrics(
  data: FundamentalAnalysisData,
  opts: AnalysisOptions
): MetricSection[] {
  const m = data.metrics;
  const sections: MetricSection[] = [];

  const allMetrics: Array<{
    name: string;
    score: () => number;
    signal: () => "CALL" | "PUT" | "HOLD";
    finding: () => string;
  }> = [
    {
      name: "Valoración",
      score: () => {
        const pe = m.financialRatios?.peRatio ?? 0;
        const pb = m.financialRatios?.pbRatio ?? 0;
        if (pe <= 0 && pb <= 0) return 50;
        let s = 50;
        if (pe > 0 && pe < 15) s += 20;
        else if (pe > 0 && pe < 25) s += 10;
        else if (pe > 40) s -= 15;
        if (pb > 0 && pb < 3) s += 10;
        else if (pb > 8) s -= 10;
        return Math.max(0, Math.min(100, s));
      },
      signal: () => {
        const pe = m.financialRatios?.peRatio ?? 0;
        if (pe > 0 && pe < 20) return "CALL";
        if (pe > 50) return "PUT";
        return "HOLD";
      },
      finding: () => {
        const pe = m.financialRatios?.peRatio ?? 0;
        const pb = m.financialRatios?.pbRatio ?? 0;
        return `P/E: ${pe.toFixed(1)} | P/B: ${pb.toFixed(1)}`;
      }
    },
    {
      name: "Crecimiento",
      score: () => {
        const epsGrowth = m.eps?.epsGrowthYoYPercent ?? 0;
        const revGrowth = m.sales?.revenueGrowthPercent ?? 0;
        let s = 50;
        if (epsGrowth > 20) s += 25;
        else if (epsGrowth > 10) s += 15;
        else if (epsGrowth < 0) s -= 20;
        if (revGrowth > 10) s += 15;
        else if (revGrowth < 0) s -= 10;
        return Math.max(0, Math.min(100, s));
      },
      signal: () => {
        const epsGrowth = m.eps?.epsGrowthYoYPercent ?? 0;
        if (epsGrowth > 15) return "CALL";
        if (epsGrowth < -5) return "PUT";
        return "HOLD";
      },
      finding: () => {
        const eg = m.eps?.epsGrowthYoYPercent ?? 0;
        const rg = m.sales?.revenueGrowthPercent ?? 0;
        return `EPS growth YoY: ${eg.toFixed(1)}% | Rev growth: ${rg.toFixed(1)}%`;
      }
    },
    {
      name: "Rentabilidad",
      score: () => {
        const roe = m.financialRatios?.roe ?? 0;
        let s = 50;
        if (roe > 20) s += 25;
        else if (roe > 10) s += 15;
        else if (roe < 0) s -= 25;
        return Math.max(0, Math.min(100, s));
      },
      signal: () => {
        const roe = m.financialRatios?.roe ?? 0;
        if (roe > 15) return "CALL";
        if (roe < 0) return "PUT";
        return "HOLD";
      },
      finding: () => `ROE: ${(m.financialRatios?.roe ?? 0).toFixed(1)}%`
    },
    {
      name: "Salud Financiera",
      score: () => {
        const de = m.financialRatios?.debtToEquity ?? 0;
        let s = 70;
        if (de < 0.5) s += 20;
        else if (de < 1.0) s += 5;
        else if (de > 2.0) s -= 20;
        else if (de > 3.0) s -= 35;
        return Math.max(0, Math.min(100, s));
      },
      signal: () => {
        const de = m.financialRatios?.debtToEquity ?? 0;
        if (de < 0.5) return "CALL";
        if (de > 2.5) return "PUT";
        return "HOLD";
      },
      finding: () => `D/E: ${(m.financialRatios?.debtToEquity ?? 0).toFixed(2)}`
    },
    {
      name: "Flujo de Caja",
      score: () => {
        const mcap = m.marketCap?.value ?? 0;
        const rev = m.sales?.annualRevenue ?? 0;
        if (mcap > 0 && rev > 0) {
          const ps = m.financialRatios?.psRatio ?? mcap / rev;
          if (ps < 5) return 75;
          if (ps < 10) return 60;
          return 45;
        }
        return 50;
      },
      signal: () => {
        const ps = m.financialRatios?.psRatio ?? 0;
        if (ps > 0 && ps < 5) return "CALL";
        if (ps > 15) return "PUT";
        return "HOLD";
      },
      finding: () => `P/S: ${(m.financialRatios?.psRatio ?? 0).toFixed(2)}`
    },
    {
      name: "Riesgo",
      score: () => {
        const vol = m.volatility?.annualizedVolatility ?? 0;
        const beta = m.beta?.value ?? 1;
        let s = 70;
        if (vol > 40) s -= 20;
        else if (vol > 25) s -= 10;
        if (beta > 1.5) s -= 15;
        else if (beta < 0.8) s += 10;
        return Math.max(0, Math.min(100, s));
      },
      signal: () => {
        const vol = m.volatility?.annualizedVolatility ?? 0;
        const beta = m.beta?.value ?? 1;
        if (vol < 20 && beta < 1) return "CALL";
        if (vol > 40 || beta > 1.8) return "PUT";
        return "HOLD";
      },
      finding: () => `Volatilidad: ${(m.volatility?.annualizedVolatility ?? 0).toFixed(1)}% | Beta: ${(m.beta?.value ?? 0).toFixed(2)}`
    },
    {
      name: "Ventaja Competitiva",
      score: () => {
        const roe = m.financialRatios?.roe ?? 0;
        const rev = m.sales?.annualRevenue ?? 0;
        let s = 50;
        if (roe > 20) s += 20;
        if (rev > 1e9) s += 10;
        if (m.marketCap?.value && m.marketCap.value > 1e11) s += 15;
        return Math.max(0, Math.min(100, s));
      },
      signal: () => {
        const roe = m.financialRatios?.roe ?? 0;
        if (roe > 25 && (m.marketCap?.value ?? 0) > 5e10) return "CALL";
        if (roe < 5) return "PUT";
        return "HOLD";
      },
      finding: () => `ROE: ${(m.financialRatios?.roe ?? 0).toFixed(1)}% | Cap: $${((m.marketCap?.value ?? 0) / 1e9).toFixed(1)}B`
    }
  ];

  for (const def of allMetrics) {
    if (!opts.selectedMetrics.includes(def.name)) continue;
    const score = def.score();
    const tipoSenal = def.signal();
    sections.push({
      metric: def.name,
      score,
      tipoSenal,
      tendencia: tipoSenal === "CALL" ? "ALCISTA" : tipoSenal === "PUT" ? "BAJISTA" : "LATERAL",
      invertir: score >= 60 && tipoSenal === "CALL",
      finding: def.finding()
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Confluence row builder
// ---------------------------------------------------------------------------

export interface FundamentalConfluenceRow {
  ticket: string;
  core: "A_FUNDAMENTAL";
  subCore: string;
  precio: number;
  tipoSenal: "CALL" | "PUT" | "HOLD";
  fecha: string;
  timeframe: string;
  tendencia: "ALCISTA" | "BAJISTA" | "LATERAL";
  score: number;
  peso: number;
  invertir: boolean;
  estado: "ACTIVA" | "DEGRADADA";
  vigencia: string;
  fuente: string;
  evidencia_refs: string[];
  ia_revisada: boolean;
  disclaimer_id: string;
  delta_vs_anterior: "NUEVA" | "CONFIRMADA" | "INVERTIDA" | "DEGRADADA";
  observacion: { objetivo: string; senal: string; explicacion: string; metricas: Record<string, number | string> };
  algorithm_version: string;
  computed_at: string;
  source_input_hash: string;
}

function buildConfluenceRows(
  ticker: string,
  price: number,
  sections: MetricSection[],
  source: string,
  timestamp: string,
  projectionFrom?: string,
  projectionTo?: string
): FundamentalConfluenceRow[] {
  const vigencia = projectionTo
    ?? new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];

  const projDays = projectionFrom && projectionTo
    ? Math.round((new Date(projectionTo).getTime() - new Date(projectionFrom).getTime()) / 86_400_000)
    : null;

  const timeframe = projDays
    ? projDays <= 7 ? "1d" : projDays <= 30 ? "1d" : projDays <= 90 ? "1w" : "1M"
    : "1d";

  return sections.map((s) => ({
    ticket: ticker,
    core: "A_FUNDAMENTAL" as const,
    subCore: s.metric,
    precio: price,
    tipoSenal: s.tipoSenal,
    fecha: projectionFrom ?? timestamp.split("T")[0],
    timeframe,
    tendencia: s.tendencia,
    score: Math.round(s.score) / 100,
    peso: 1 / sections.length,
    invertir: s.invertir,
    estado: s.score >= 30 ? "ACTIVA" : "DEGRADADA",
    vigencia,
    fuente: source.toUpperCase(),
    evidencia_refs: [`${source}:${ticker}:${s.metric}`],
    ia_revisada: true,
    disclaimer_id: "FUNDAMENTAL_ANALYSIS_DISCLAIMER_V1",
    delta_vs_anterior: "NUEVA",
    observacion: {
      objetivo: `Análisis fundamental — ${s.metric}`,
      senal: `${s.tipoSenal} | ${s.tendencia}`,
      explicacion: s.finding,
      metricas: { score: s.score, tipoSenal: s.tipoSenal }
    },
    algorithm_version: "fundamental_v1",
    computed_at: timestamp,
    source_input_hash: `${source}-${ticker}-${s.metric}-${timestamp.split("T")[0]}`
  }));
}

// ---------------------------------------------------------------------------
// Claude call (same pattern as FundamentalCopilotChat)
// ---------------------------------------------------------------------------

async function callClaude(prompt: string): Promise<string | undefined> {
  const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;
  try {
    const model = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }]
      }),
      signal: AbortSignal.timeout(Number(process.env.CLAUDE_TIMEOUT_MS ?? 15000))
    });
    if (!res.ok) return undefined;
    const payload = (await res.json()) as { content?: Array<{ type: string; text: string }> };
    return payload?.content?.find((b) => b.type === "text")?.text?.trim();
  } catch {
    return undefined;
  }
}

function localFallbackAnalysis(
  ticker: string,
  data: FundamentalAnalysisData,
  sections: MetricSection[],
  opts: AnalysisOptions
): string {
  const lines: string[] = [];
  lines.push(`## Análisis Fundamental — ${data.companyName || ticker} (${ticker})`);
  lines.push(`*Fuente: ${data.metadata.sourceId.toUpperCase()} | Perfil: ${opts.investmentProfile} | Horizonte: ${opts.horizon}*`);
  lines.push("");
  lines.push("### Resumen Ejecutivo");
  const price = data.metrics.priceHistory?.currentPrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error(`No real current price available for ${ticker}`);
  }
  const pe = data.metrics.financialRatios?.peRatio ?? 0;
  const roe = data.metrics.financialRatios?.roe ?? 0;
  lines.push(`${ticker} cotiza a $${price.toFixed(2)} con un P/E de ${pe.toFixed(1)} y ROE del ${roe.toFixed(1)}%. ` +
    `La volatilidad anualizada es ${(data.metrics.volatility?.annualizedVolatility ?? 0).toFixed(1)}%.`);
  lines.push("");
  lines.push("### Análisis por Métrica");
  for (const s of sections) {
    lines.push(`**${s.metric}** — Score: ${s.score}/100 | ${s.tipoSenal} | ${s.tendencia}`);
    lines.push(`${s.finding}`);
    lines.push("");
  }
  lines.push("### Nota");
  lines.push("Claude API no disponible. Análisis generado con reglas locales. Configure CLAUDE_API_KEY para análisis completo.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Deterministic projection builder
// ---------------------------------------------------------------------------

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampPrice(value: number): number {
  return Math.max(0.01, roundMoney(value));
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms)) return 30;
  return Math.max(1, Math.round(ms / 86_400_000));
}

function addDaysIso(from: string, days: number): string {
  const base = new Date(from);
  if (!Number.isFinite(base.getTime())) {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }
  return new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function projectionVerdict(verdict: FundamentalAnalysisResult["verdict"]): FundamentalProjection["verdict"] {
  if (verdict === "VIABLE") return "VIABLE";
  if (verdict === "NEUTRAL") return "MARGINAL";
  return "NO_VIABLE";
}

function strategyParts(strategy: string): { direction: "LONG" | "SHORT"; optionType: "CALL" | "PUT"; label: string } {
  const normalized = strategy.trim().toUpperCase().replace(/[_-]+/g, " ");
  if (normalized.includes("SHORT") && normalized.includes("PUT")) {
    return { direction: "SHORT", optionType: "PUT", label: "Short Put" };
  }
  if (normalized.includes("SHORT") && normalized.includes("CALL")) {
    return { direction: "SHORT", optionType: "CALL", label: "Short Call" };
  }
  if (normalized.includes("LONG") && normalized.includes("PUT")) {
    return { direction: "LONG", optionType: "PUT", label: "Long Put" };
  }
  return { direction: "LONG", optionType: "CALL", label: "Long Call" };
}

function optionPnL(
  price: number,
  strike: number,
  premium: number,
  direction: "LONG" | "SHORT",
  optionType: "CALL" | "PUT"
): number {
  const intrinsic = optionType === "CALL"
    ? Math.max(price - strike, 0)
    : Math.max(strike - price, 0);
  const perShare = direction === "LONG" ? intrinsic - premium : premium - intrinsic;
  return roundMoney(perShare * 100);
}

function strategyRisk(
  strike: number,
  premium: number,
  direction: "LONG" | "SHORT",
  optionType: "CALL" | "PUT"
): Pick<FundamentalProjection, "breakeven" | "maxLoss" | "maxProfit"> {
  if (direction === "LONG" && optionType === "CALL") {
    return {
      breakeven: roundMoney(strike + premium),
      maxLoss: roundMoney(premium * 100),
      maxProfit: "ILIMITADO"
    };
  }
  if (direction === "LONG" && optionType === "PUT") {
    return {
      breakeven: roundMoney(strike - premium),
      maxLoss: roundMoney(premium * 100),
      maxProfit: roundMoney(Math.max(0, strike - premium) * 100)
    };
  }
  if (direction === "SHORT" && optionType === "CALL") {
    return {
      breakeven: roundMoney(strike + premium),
      maxLoss: "ILIMITADO",
      maxProfit: roundMoney(premium * 100)
    };
  }
  return {
    breakeven: roundMoney(strike - premium),
    maxLoss: roundMoney(Math.max(0, strike - premium) * 100),
    maxProfit: roundMoney(premium * 100)
  };
}

function buildProjectionDrivers(sections: MetricSection[]): string[] {
  return [...sections]
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
    .slice(0, 5)
    .map((section) => `${section.metric}: ${section.finding} (score ${section.score}/100, ${section.tendencia})`);
}

async function buildFundamentalProjection(
  ticker: string,
  data: FundamentalAnalysisData,
  opts: AnalysisOptions,
  sections: MetricSection[],
  overallScore: number,
  verdict: FundamentalAnalysisResult["verdict"]
): Promise<FundamentalProjection> {
  const projectionFrom = opts.projectionFrom ?? new Date().toISOString().slice(0, 10);
  let projectionTo = opts.projectionTo ?? addDaysIso(projectionFrom, 30);
  let days = daysBetween(projectionFrom, projectionTo);
  const marketPrice = data.metrics.priceHistory?.currentPrice;
  if (typeof marketPrice !== "number" || !Number.isFinite(marketPrice) || marketPrice <= 0) {
    throw new Error(`No real current price available for ${ticker}`);
  }
  const initialPrice = clampPrice(marketPrice);
  const vol = Math.max(5, data.metrics.volatility?.annualizedVolatility ?? 25);
  const parts = strategyParts(opts.strategy);
  const strike = Math.max(1, Math.round(initialPrice / 5) * 5);
  const marketContext = await resolveOptionContext(ticker, strike, strike, days);
  const rawPremium = parts.optionType === "CALL" ? marketContext?.callPremium : marketContext?.putPremium;
  const premium = roundMoney(rawPremium ?? 0);

  if (!marketContext || premium <= 0) {
    throw new Error(`No real option premium available for ${ticker} ${parts.optionType} near strike ${strike}`);
  }

  projectionTo = marketContext.expirationDate;
  days = marketContext.dte;

  const expectedMove = roundMoney(initialPrice * (vol / 100) * Math.sqrt(days / 252));
  const expectedMovePercent = roundMoney((expectedMove / initialPrice) * 100);
  const drift = initialPrice * ((overallScore - 50) / 100) * Math.min(days / 365, 1);
  const baseFinal = clampPrice(initialPrice + drift);
  const bullishFinal = clampPrice(baseFinal + expectedMove);
  const bearishFinal = clampPrice(baseFinal - expectedMove);
  const risk = strategyRisk(strike, premium, parts.direction, parts.optionType);

  const pointCount = Math.max(2, Math.min(60, days + 1));
  const path: ProjectionPoint[] = [];
  for (let index = 0; index < pointCount; index++) {
    const ratio = pointCount === 1 ? 1 : index / (pointCount - 1);
    const day = Math.round(ratio * days);
    const wave = Math.sin(ratio * Math.PI) * expectedMove * 0.12;
    const basePrice = clampPrice(initialPrice + (baseFinal - initialPrice) * ratio + wave);
    const bullishPrice = clampPrice(initialPrice + (bullishFinal - initialPrice) * ratio + wave);
    const bearishPrice = clampPrice(initialPrice + (bearishFinal - initialPrice) * ratio - wave);
    path.push({
      date: addDaysIso(projectionFrom, day),
      basePrice,
      bullishPrice,
      bearishPrice,
      basePnL: optionPnL(basePrice, strike, premium, parts.direction, parts.optionType),
      bullishPnL: optionPnL(bullishPrice, strike, premium, parts.direction, parts.optionType),
      bearishPnL: optionPnL(bearishPrice, strike, premium, parts.direction, parts.optionType)
    });
  }

  const scenarios: StrategyScenario[] = [
    { label: "ATM", price: initialPrice, profitLoss: optionPnL(initialPrice, strike, premium, parts.direction, parts.optionType) },
    { label: "+5%", price: roundMoney(initialPrice * 1.05), profitLoss: optionPnL(initialPrice * 1.05, strike, premium, parts.direction, parts.optionType) },
    { label: "-5%", price: roundMoney(initialPrice * 0.95), profitLoss: optionPnL(initialPrice * 0.95, strike, premium, parts.direction, parts.optionType) }
  ];

  return {
    ticker,
    strategy: parts.label,
    verdict: projectionVerdict(verdict),
    score: overallScore,
    projectionFrom,
    projectionTo,
    days,
    initialPrice,
    expectedMove,
    expectedMovePercent,
    strike,
    premium,
    ...risk,
    scenarios,
    path,
    drivers: buildProjectionDrivers(sections),
    changeTriggers: [
      "Earnings miss o guidance por debajo de expectativas.",
      "Sector rotation que cambie el apetito por growth/value.",
      "Volatilidad implicita o realizada +50% frente al nivel actual.",
      "Caida fuerte bajo el escenario bajista proyectado.",
      "Subida fuerte sobre el breakeven de la estrategia."
    ],
    calculationSteps: [
      `1. Se calcula score fundamental promedio: ${overallScore}/100 => ${projectionVerdict(verdict)}.`,
      `2. Se usa volatilidad anualizada ${vol.toFixed(1)}% para estimar movimiento esperado de +/-$${expectedMove}.`,
      `3. Se usa prima de cadena de opciones: strike $${strike}, vencimiento ${marketContext.expirationDate}, prima $${premium} por accion.`,
      `4. Se evalua ${parts.label} contra escenarios ATM, +5% y -5%, mas trayectoria base/alcista/bajista.`,
      "5. La simulacion es explicativa: no ejecuta ni recomienda operar automaticamente."
    ],
    disclaimer: "Este analisis es informativo y no constituye recomendacion de inversion ni orden de operacion. Consulta a un profesional antes de tomar decisiones financieras."
  };
}

// ---------------------------------------------------------------------------
// Main analyzer export
// ---------------------------------------------------------------------------

export async function analyzeFundamental(
  data: FundamentalAnalysisData,
  opts: AnalysisOptions
): Promise<FundamentalAnalysisResult> {
  const ticker = opts.ticker ?? data.companyName;
  const timestamp = new Date().toISOString();
  const observedPrice = data.metrics.priceHistory?.currentPrice;
  if (typeof observedPrice !== "number" || !Number.isFinite(observedPrice) || observedPrice <= 0) {
    throw new Error(`No real current price available for ${ticker}`);
  }

  const sections = scoreMetrics(data, opts);

  const overallScore = sections.length > 0
    ? Math.round(sections.reduce((acc, s) => acc + s.score, 0) / sections.length)
    : 50;

  const verdict: "VIABLE" | "NEUTRAL" | "NOT_VIABLE" =
    overallScore >= 65 ? "VIABLE" : overallScore >= 40 ? "NEUTRAL" : "NOT_VIABLE";

  const projection = await buildFundamentalProjection(ticker, data, opts, sections, overallScore, verdict);

  const prompt = buildPrompt(ticker, data, opts);
  const aiText = await callClaude(prompt);
  const aiAnalysis = aiText ?? localFallbackAnalysis(ticker, data, sections, opts);

  const confluenceRows = buildConfluenceRows(ticker, observedPrice, sections, data.metadata.sourceId, timestamp, opts.projectionFrom, opts.projectionTo);

  const callCount = sections.filter((s) => s.tipoSenal === "CALL").length;
  const putCount = sections.filter((s) => s.tipoSenal === "PUT").length;
  const recommendation = callCount > putCount
    ? `Perspectiva positiva en ${callCount}/${sections.length} métricas. Estrategia ${opts.strategy} podría ser adecuada.`
    : putCount > callCount
      ? `Perspectiva cautelosa en ${putCount}/${sections.length} métricas. Evalúe exposición antes de ${opts.strategy}.`
      : `Señales mixtas. Monitorear antes de ejecutar ${opts.strategy}.`;

  return {
    ticker,
    companyName: data.companyName || ticker,
    aiAnalysis,
    sections,
    overallScore,
    verdict,
    recommendation,
    projection,
    confluenceRows,
    sourceId: data.metadata.sourceId,
    timestamp
  };
}

