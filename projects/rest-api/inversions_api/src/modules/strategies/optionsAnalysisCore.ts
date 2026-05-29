/**
 * Options Analysis Core — Motor determinístico de Q&A para estrategias de opciones.
 * Options Analysis Core — Deterministic Q&A engine for options strategies.
 *
 * Sin IA. Las respuestas se derivan de los datos calculados por los evaluadores
 * de estrategia (shortPut, longPut, shortCall, longCall) + contexto enriquecido
 * del dashboard (análisis fundamental, señales de confluencia, tendencia OHLC).
 *
 * No AI. Responses are derived from calculated strategy data + enriched dashboard
 * context (fundamental analysis, confluence signals, OHLC trend).
 *
 * Contrato estable: recibe StrategiesSnapshot + pregunta + DashboardContext opcional,
 * devuelve OptionsQAResponse con contexto integrado del dashboard.
 */

import type { OptionStrategyOutput } from "./optionsStrategyContract";

// ─── Tipos públicos ─────────────────────────────────────────────────────────

export type StrategyKey = "LONG_CALL" | "LONG_PUT" | "SHORT_CALL" | "SHORT_PUT";

export interface StrategiesSnapshot {
  longCall: OptionStrategyOutput;
  longPut: OptionStrategyOutput;
  shortCall: OptionStrategyOutput;
  shortPut: OptionStrategyOutput;
}

// ─── Contexto enriquecido del dashboard ──────────────────────────────────────
// Dashboard enriched context — fed from frontend (fundamental, confluence, OHLC)

export interface FundamentalCtx {
  verdict: "VIABLE" | "NEUTRAL" | "NOT_VIABLE";
  overallScore: number;
  recommendation: string;
  /** Fuente de datos (ej: "finviz", "fmp", "yahoo_finance") / Data source */
  source?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  pe?: number;
  pb?: number;
  ps?: number;
  roe?: number;
  debtToEquity?: number;
  eps?: number;
  epsGrowth?: number;
  dividendYield?: number;
  revenueGrowth?: number;
  volatility?: number;
  beta?: number;
  change52w?: number;
}

export interface ConfluenceSignalCtx {
  core: string;
  subCore?: string;
  tipoSenal: "CALL" | "PUT" | "HOLD";
  score: number;
  observacionSummary: string;
}

export interface ConfluenceCtx {
  callCount: number;
  putCount: number;
  holdCount: number;
  avgScore: number;
  dominantTrend: "ALCISTA" | "BAJISTA" | "LATERAL";
  topSignals: ConfluenceSignalCtx[];
}

export interface OhlcCtx {
  timeframe: string;
  lastClose: number;
  recentTrend: "ALCISTA" | "BAJISTA" | "LATERAL";
}

export interface DashboardContext {
  fundamental?: FundamentalCtx;
  confluence?: ConfluenceCtx;
  ohlc?: OhlcCtx;
}

export interface OptionsQARequest {
  ticker: string;
  question: string;
  strategies: StrategiesSnapshot;
  selectedStrategy?: StrategyKey;
  currentPrice: number;
  /** Contexto enriquecido del dashboard para análisis más completo / Enriched dashboard context */
  dashboardContext?: DashboardContext;
}

export type IntentType =
  | "MAX_GANANCIA"
  | "MAX_PERDIDA"
  | "BREAKEVEN"
  | "ESCENARIOS"
  | "MARGEN"
  | "ROI"
  | "COMPARACION"
  | "RECOMENDACION"
  | "RIESGO"
  | "RENTABILIDAD"
  | "ESPECIFICO_LONG_CALL"
  | "ESPECIFICO_LONG_PUT"
  | "ESPECIFICO_SHORT_CALL"
  | "ESPECIFICO_SHORT_PUT"
  | "GENERAL";

export interface OptionsQAResponse {
  answer: string;
  intent: IntentType;
  strategyFocus?: StrategyKey;
  disclaimer: string;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const DISCLAIMER =
  "Este análisis es informativo y educativo. No constituye asesoramiento financiero ni recomendación de inversión.";

const STRATEGY_LABEL: Record<StrategyKey, string> = {
  LONG_CALL: "Long Call",
  LONG_PUT: "Long Put",
  SHORT_CALL: "Short Call",
  SHORT_PUT: "Short Put",
};

// ─── Clasificador de intención ───────────────────────────────────────────────

const INTENT_RULES: Array<{ intent: IntentType; re: RegExp }> = [
  { intent: "MAX_GANANCIA",          re: /m[aá]x(ima)?\s*(ganancia|profit|ganar|upside)|cu[aá]nto\s*(puedo\s*)?ganar/i },
  { intent: "MAX_PERDIDA",           re: /m[aá]x(ima)?\s*(p[eé]rdida|loss|perder|downside)|cu[aá]nto\s*(puedo\s*)?perder/i },
  { intent: "BREAKEVEN",             re: /breakeven|break[\s-]?even|punto\s*de\s*equilibrio|precio\s*de\s*equilibrio/i },
  { intent: "ESCENARIOS",            re: /escenario|qu[eé]\s*pasa\s*(si|cuando)|\+5|[\-−]5|atm|at.the.money|movimiento\s*de\s*precio/i },
  { intent: "MARGEN",                re: /margen|margin|garant[íi]a|capital\s*(requerido|necesario|m[íi]nimo)/i },
  { intent: "ROI",                   re: /\broi\b|retorno\s*(porcentual|sobre)|rendimiento\s*(%|porcentual)/i },
  { intent: "COMPARACION",           re: /comparar|diferencia\s*(entre|de)|mejor\s*(entre|de|opci[oó]n)|cu[aá]l\s*(es|ser[íi]a)\s*(mejor|m[aá]s\s*(rentable|segura))|long.*vs.*short|call.*vs.*put/i },
  { intent: "RECOMENDACION",         re: /recomiend|qu[eé]\s*(estrategia|opci[oó]n)\s*(usar|elegir|tomar|conviene)|debo\s*usar|cu[aá]l\s*(debo|deberia)\s*(usar|elegir)/i },
  { intent: "RIESGO",                re: /riesgo|peligros|arriesgad|qu[eé]\s*(tan\s*)?(segur|riesg)|conservador|agresivo/i },
  { intent: "RENTABILIDAD",          re: /rentable|vale\s*la\s*pena|conviene|buena\s*(idea|opci[oó]n)|es\s*(bueno|malo|viable|recomendable)/i },
  { intent: "ESPECIFICO_LONG_CALL",  re: /long\s*call/i },
  { intent: "ESPECIFICO_LONG_PUT",   re: /long\s*put/i },
  { intent: "ESPECIFICO_SHORT_CALL", re: /short\s*call/i },
  { intent: "ESPECIFICO_SHORT_PUT",  re: /short\s*put/i },
];

function classifyIntent(question: string, selected?: StrategyKey): IntentType {
  for (const rule of INTENT_RULES) {
    if (rule.re.test(question)) return rule.intent;
  }
  // Si hay estrategia seleccionada y la pregunta menciona conceptos genéricos de opciones
  if (selected && /prima|contrato|opci[oó]n|strike|vencimiento/i.test(question)) {
    return `ESPECIFICO_${selected}` as IntentType;
  }
  return "GENERAL";
}

function strategyFocusFromIntent(intent: IntentType, selected?: StrategyKey): StrategyKey | undefined {
  const map: Partial<Record<IntentType, StrategyKey>> = {
    ESPECIFICO_LONG_CALL:  "LONG_CALL",
    ESPECIFICO_LONG_PUT:   "LONG_PUT",
    ESPECIFICO_SHORT_CALL: "SHORT_CALL",
    ESPECIFICO_SHORT_PUT:  "SHORT_PUT",
  };
  return map[intent] ?? selected;
}

// ─── Helpers de formato ──────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function isUnlimitedLoss(s: OptionStrategyOutput): boolean {
  return s.optionType === "CALL" && s.direction === "SHORT";
}

function maxLossLabel(s: OptionStrategyOutput): string {
  return isUnlimitedLoss(s)
    ? "ILIMITADA ⚠️"
    : fmt(Math.abs(s.maxLoss));
}

function strategyFromOutput(s: OptionStrategyOutput): StrategyKey {
  const dir = String(s.direction).toUpperCase();
  const type = String(s.optionType).toUpperCase();
  return `${dir}_${type}` as StrategyKey;
}

function getStrategyOutput(snap: StrategiesSnapshot, key: StrategyKey): OptionStrategyOutput {
  const map: Record<StrategyKey, OptionStrategyOutput> = {
    LONG_CALL:  snap.longCall,
    LONG_PUT:   snap.longPut,
    SHORT_CALL: snap.shortCall,
    SHORT_PUT:  snap.shortPut,
  };
  return map[key];
}

function allFour(snap: StrategiesSnapshot): Array<{ key: StrategyKey; out: OptionStrategyOutput }> {
  return [
    { key: "LONG_CALL",  out: snap.longCall },
    { key: "LONG_PUT",   out: snap.longPut },
    { key: "SHORT_CALL", out: snap.shortCall },
    { key: "SHORT_PUT",  out: snap.shortPut },
  ];
}

// ─── Generadores de respuesta por intención ──────────────────────────────────

function answerMaxGanancia(ticker: string, snap: StrategiesSnapshot, focus?: StrategyKey): string {
  if (focus) {
    const s = getStrategyOutput(snap, focus);
    const label = STRATEGY_LABEL[focus];
    const unlimited = focus === "LONG_CALL" || focus === "LONG_PUT";
    const maxProfitNote =
      focus === "LONG_CALL"
        ? "ganancia potencialmente ilimitada (el precio puede subir indefinidamente)"
        : focus === "SHORT_CALL"
        ? "la ganancia está **limitada a la prima cobrada** porque el riesgo de pérdida es ilimitado"
        : undefined;

    const lines = [
      `**Ganancia máxima — ${label} en ${ticker}:**`,
      "",
      `- Prima por acción: ${fmt(s.premium)}`,
      `- Contratos: ${s.quantity}`,
      `- Ganancia máxima total: **${fmt(s.maxProfit)}**`,
    ];
    if (maxProfitNote) lines.push(`- Nota: ${maxProfitNote}`);
    lines.push(`- ROI máximo en escenario +5%: **${s.scenarioPlus5.roi.toFixed(1)}%**`);
    lines.push(`- ROI máximo en escenario -5%: **${s.scenarioMinus5.roi.toFixed(1)}%**`);
    lines.push(`- Probabilidad de estar ITM al vencimiento: **${fmtPct(s.probabilityItm)}**`);
    return lines.join("\n");
  }

  // Sin foco: mostrar todas
  const lines = [`**Ganancias máximas comparadas — ${ticker}:**`, ""];
  for (const { key, out } of allFour(snap)) {
    lines.push(`- **${STRATEGY_LABEL[key]}**: ${fmt(out.maxProfit)} (P(ITM) ${fmtPct(out.probabilityItm)})`);
  }
  lines.push("");
  const best = allFour(snap).reduce((a, b) => (b.out.maxProfit > a.out.maxProfit ? b : a));
  lines.push(`→ Mayor ganancia potencial: **${STRATEGY_LABEL[best.key]}** con ${fmt(best.out.maxProfit)}.`);
  lines.push(`  Breakeven requerido: ${fmt(best.out.breakEvenPrice)}.`);
  return lines.join("\n");
}

function answerMaxPerdida(ticker: string, snap: StrategiesSnapshot, focus?: StrategyKey): string {
  if (focus) {
    const s = getStrategyOutput(snap, focus);
    const label = STRATEGY_LABEL[focus];
    const lines = [
      `**Pérdida máxima — ${label} en ${ticker}:**`,
      "",
      `- Pérdida máxima: **${maxLossLabel(s)}**`,
      `- Breakeven: ${fmt(s.breakEvenPrice)} (punto donde P&L = 0)`,
      `- Escenario ATM (precio actual): P&L = ${fmt(s.scenarioAtm.profitLoss)}`,
      `- Escenario -5% (${fmt(s.scenarioMinus5.priceAtScenario)}): P&L = ${fmt(s.scenarioMinus5.profitLoss)}`,
      `- Escenario +5% (${fmt(s.scenarioPlus5.priceAtScenario)}): P&L = ${fmt(s.scenarioPlus5.profitLoss)}`,
    ];
    if (s.warnings.length > 0) {
      lines.push("", "**Advertencias:**");
      s.warnings.forEach((w) => lines.push(`  ${w}`));
    }
    return lines.join("\n");
  }

  const lines = [`**Pérdidas máximas comparadas — ${ticker}:**`, ""];
  for (const { key, out } of allFour(snap)) {
    lines.push(`- **${STRATEGY_LABEL[key]}**: ${maxLossLabel(out)}`);
  }
  lines.push("");
  const safest = allFour(snap).filter((x) => !isUnlimitedLoss(x.out))
    .reduce((a, b) => (Math.abs(b.out.maxLoss) < Math.abs(a.out.maxLoss) ? b : a));
  lines.push(`→ Menor pérdida máxima: **${STRATEGY_LABEL[safest.key]}** con ${fmt(Math.abs(safest.out.maxLoss))}.`);
  lines.push(`  ⚠️ Short Call tiene pérdida ILIMITADA.`);
  return lines.join("\n");
}

function answerBreakeven(ticker: string, snap: StrategiesSnapshot, focus?: StrategyKey, currentPrice?: number): string {
  if (focus) {
    const s = getStrategyOutput(snap, focus);
    const label = STRATEGY_LABEL[focus];
    const dist = currentPrice ? Math.abs(s.breakEvenPrice - currentPrice) : null;
    const distPct = currentPrice && currentPrice > 0 ? (dist! / currentPrice) * 100 : null;
    const lines = [
      `**Breakeven — ${label} en ${ticker}:**`,
      "",
      `- Precio de equilibrio: **${fmt(s.breakEvenPrice)}**`,
    ];
    if (currentPrice) {
      lines.push(`- Precio actual: ${fmt(currentPrice)}`);
      lines.push(`- Distancia al breakeven: ${fmt(dist!)} (${distPct!.toFixed(1)}%)`);
      const dir = focus.includes("CALL") ? "subir" : "bajar";
      lines.push(`- El precio necesita **${dir}** ${distPct!.toFixed(1)}% para ser rentable.`);
    }
    return lines.join("\n");
  }

  const lines = [`**Breakevens comparados — ${ticker}:**`, ""];
  for (const { key, out } of allFour(snap)) {
    const dist = currentPrice ? Math.abs(out.breakEvenPrice - currentPrice) : null;
    const distStr = dist !== null && currentPrice
      ? ` (${((dist / currentPrice) * 100).toFixed(1)}% desde precio actual)`
      : "";
    lines.push(`- **${STRATEGY_LABEL[key]}**: ${fmt(out.breakEvenPrice)}${distStr}`);
  }
  return lines.join("\n");
}

function answerEscenarios(ticker: string, snap: StrategiesSnapshot, focus?: StrategyKey): string {
  const targets = focus ? [{ key: focus, out: getStrategyOutput(snap, focus) }] : allFour(snap);
  const lines = [
    focus
      ? `**Escenarios de P&L — ${STRATEGY_LABEL[focus]} en ${ticker}:**`
      : `**Escenarios de P&L para todas las estrategias — ${ticker}:**`,
    "",
  ];

  for (const { key, out } of targets) {
    if (!focus) lines.push(`**${STRATEGY_LABEL[key]}:**`);
    const scenarios = [
      { label: "ATM (precio actual)", s: out.scenarioAtm },
      { label: "+5%",                 s: out.scenarioPlus5 },
      { label: "-5%",                 s: out.scenarioMinus5 },
    ];
    for (const { label, s } of scenarios) {
      const sign = s.profitLoss >= 0 ? "+" : "";
      lines.push(`  - ${label} → precio ${fmt(s.priceAtScenario)}: P&L **${sign}${fmt(s.profitLoss)}** (ROI ${s.roi.toFixed(1)}%)`);
    }
    if (!focus) lines.push("");
  }
  return lines.join("\n");
}

function answerMargen(ticker: string, snap: StrategiesSnapshot, focus?: StrategyKey): string {
  const targets = focus ? [{ key: focus, out: getStrategyOutput(snap, focus) }] : allFour(snap);
  const lines = [
    focus
      ? `**Margen requerido — ${STRATEGY_LABEL[focus]} en ${ticker}:**`
      : `**Márgenes requeridos — ${ticker}:**`,
    "",
  ];
  for (const { key, out } of targets) {
    const label = focus ? "" : `**${STRATEGY_LABEL[key]}**: `;
    if (out.requiredMargin > 0) {
      lines.push(`- ${label}Margen estimado: ${fmt(out.requiredMargin)}`);
    } else {
      lines.push(`- ${label}No requiere margen (estrategia compradora — se paga prima al abrir).`);
    }
  }
  if (!focus) {
    lines.push("");
    lines.push("Long Call y Long Put no requieren margen, solo el costo de la prima.");
    lines.push("Short Call y Short Put requieren margen porque tienen obligación de entrega o compra.");
  }
  return lines.join("\n");
}

function answerROI(ticker: string, snap: StrategiesSnapshot, focus?: StrategyKey): string {
  const targets = focus ? [{ key: focus, out: getStrategyOutput(snap, focus) }] : allFour(snap);
  const lines = [
    focus
      ? `**ROI — ${STRATEGY_LABEL[focus]} en ${ticker}:**`
      : `**ROI comparado por escenario — ${ticker}:**`,
    "",
  ];
  for (const { key, out } of targets) {
    if (!focus) lines.push(`**${STRATEGY_LABEL[key]}:**`);
    lines.push(`  - ATM: ${out.scenarioAtm.roi.toFixed(1)}%`);
    lines.push(`  - +5%: ${out.scenarioPlus5.roi.toFixed(1)}%`);
    lines.push(`  - -5%: ${out.scenarioMinus5.roi.toFixed(1)}%`);
    lines.push(`  - Ratio riesgo/recompensa: ${out.riskAdjustedReturn > 0 ? out.riskAdjustedReturn.toFixed(2) : "N/A (pérdida ilimitada)"}`);
    if (!focus) lines.push("");
  }
  return lines.join("\n");
}

function answerComparacion(ticker: string, snap: StrategiesSnapshot): string {
  const rows = allFour(snap);
  const lines = [
    `**Comparación de las 4 estrategias — ${ticker}:**`,
    "",
    `| Estrategia | Prima/contrato | Ganancia máx. | Pérdida máx. | Breakeven | P(ITM) | R/R |`,
    `|------------|---------------|--------------|-------------|-----------|--------|-----|`,
  ];
  for (const { key, out } of rows) {
    const perContract = fmt(out.premium * 100);
    const rr = out.riskAdjustedReturn > 0 ? out.riskAdjustedReturn.toFixed(2) : "∞ riesgo";
    lines.push(
      `| ${STRATEGY_LABEL[key].padEnd(11)} | ${perContract.padEnd(13)} | ${fmt(out.maxProfit).padEnd(12)} | ${maxLossLabel(out).padEnd(11)} | ${fmt(out.breakEvenPrice).padEnd(9)} | ${fmtPct(out.probabilityItm).padEnd(6)} | ${rr} |`
    );
  }
  lines.push("");
  lines.push("**Cómo leer la tabla:**");
  lines.push("- P(ITM): probabilidad de estar In-The-Money al vencimiento.");
  lines.push("- R/R: ratio ganancia-máxima / pérdida-máxima (mayor = mejor relación riesgo/recompensa).");
  lines.push("- Short Call tiene pérdida ilimitada; su R/R no es comparable.");
  return lines.join("\n");
}

function answerRecomendacion(ticker: string, snap: StrategiesSnapshot, ctx?: DashboardContext): string {
  // Ranking por ratio ajustado: excluir Short Call (unlimited loss), ordenar por riskAdjustedReturn
  const ranked = allFour(snap)
    .filter((x) => !isUnlimitedLoss(x.out))
    .sort((a, b) => b.out.riskAdjustedReturn - a.out.riskAdjustedReturn);

  const bias = ctx ? dashboardBias(ctx) : 0;
  let top = ranked[0];

  // Dashboard bias modulates the top pick: bullish bias → prefer Long Call, bearish → Long Put
  if (ctx && Math.abs(bias) >= 2) {
    const bullishPick = ranked.find((r) => r.key === "LONG_CALL");
    const bearishPick = ranked.find((r) => r.key === "LONG_PUT");
    if (bias >= 2 && bullishPick) top = bullishPick;
    if (bias <= -2 && bearishPick) top = bearishPick;
  }

  const biasNote = ctx
    ? bias >= 2
      ? "📈 El análisis del dashboard sugiere sesgo **alcista** — se refuerza la selección de estrategias compradoras."
      : bias <= -2
      ? "📉 El análisis del dashboard sugiere sesgo **bajista** — se refuerza la selección de estrategias vendedoras."
      : "📊 El análisis del dashboard muestra señales **mixtas** — el ratio riesgo/recompensa es el criterio primario."
    : null;

  const lines = [
    `**Recomendación de estrategia — ${ticker}:**`,
    "",
    `Basado en los cálculos actuales (ratio riesgo/recompensa, breakeven y probabilidad ITM):`,
    "",
    `→ **${STRATEGY_LABEL[top.key]}** tiene el mejor ratio riesgo/recompensa: **${top.out.riskAdjustedReturn.toFixed(2)}**.`,
    `  Prima: ${fmt(top.out.premium)}/acción | Breakeven: ${fmt(top.out.breakEvenPrice)} | P(ITM): ${fmtPct(top.out.probabilityItm)}`,
    "",
  ];

  if (biasNote) {
    lines.push(biasNote);
    lines.push("");
  }

  lines.push("**Resumen por perfil de riesgo:**");


  // Long Call: alcista, riesgo limitado
  const lc = snap.longCall;
  lines.push(`- 🟢 **Long Call** (alcista, riesgo limitado): paga ${fmt(lc.premium)}/acc, necesita precio >${fmt(lc.breakEvenPrice)}, P&L si +5%: ${fmt(lc.scenarioPlus5.profitLoss)}`);

  // Short Put: cobrar prima con obligación de compra
  const sp = snap.shortPut;
  lines.push(`- 🟡 **Short Put** (neutral/alcista, ingreso por prima): cobra ${fmt(sp.premium)}/acc, asignado si precio <${fmt(sp.breakEvenPrice)}, P&L máx: ${fmt(sp.maxProfit)}`);

  // Long Put: bajista, riesgo limitado
  const lp = snap.longPut;
  lines.push(`- 🔴 **Long Put** (bajista, riesgo limitado): paga ${fmt(lp.premium)}/acc, necesita precio <${fmt(lp.breakEvenPrice)}, P&L si -5%: ${fmt(lp.scenarioMinus5.profitLoss)}`);

  // Short Call: ingreso prima, riesgo ilimitado
  const sc = snap.shortCall;
  lines.push(`- ⚠️ **Short Call** (neutral/bajista, pérdida ILIMITADA): cobra ${fmt(sc.premium)}/acc, breakeven ${fmt(sc.breakEvenPrice)}, solo con convicción alta en rango acotado`);

  return lines.join("\n");
}

function answerRiesgo(ticker: string, snap: StrategiesSnapshot, focus?: StrategyKey): string {
  if (focus) {
    const s = getStrategyOutput(snap, focus);
    const label = STRATEGY_LABEL[focus];
    const unlimited = isUnlimitedLoss(s);
    const lines = [
      `**Análisis de riesgo — ${label} en ${ticker}:**`,
      "",
      `- Pérdida máxima: **${maxLossLabel(s)}**`,
      `- Ganancia máxima: **${fmt(s.maxProfit)}**`,
      `- Ratio riesgo/recompensa: ${s.riskAdjustedReturn > 0 ? s.riskAdjustedReturn.toFixed(2) : "N/A (riesgo ilimitado)"}`,
      `- Margen requerido: ${s.requiredMargin > 0 ? fmt(s.requiredMargin) : "ninguno"}`,
      `- Probabilidad ITM: ${fmtPct(s.probabilityItm)}`,
    ];
    if (unlimited) {
      lines.push("");
      lines.push("⚠️ **Short Call es la estrategia de mayor riesgo**: si el precio sube sin límite, la pérdida también.");
      lines.push("Solo recomendada con cobertura (hedge) o convicción muy alta en techos de precio.");
    }
    if (s.warnings.length > 0) {
      lines.push("", "**Advertencias del sistema:**");
      s.warnings.forEach((w) => lines.push(`  ${w}`));
    }
    return lines.join("\n");
  }

  const lines = [`**Niveles de riesgo comparados — ${ticker}:**`, ""];
  const sorted = allFour(snap).sort((a, b) => {
    const riskA = isUnlimitedLoss(a.out) ? Infinity : Math.abs(a.out.maxLoss);
    const riskB = isUnlimitedLoss(b.out) ? Infinity : Math.abs(b.out.maxLoss);
    return riskA - riskB;
  });
  for (const { key, out } of sorted) {
    const risk = isUnlimitedLoss(out) ? "⚠️ ILIMITADO" : fmt(Math.abs(out.maxLoss));
    lines.push(`- **${STRATEGY_LABEL[key]}**: pérdida máx ${risk}, R/R ${out.riskAdjustedReturn > 0 ? out.riskAdjustedReturn.toFixed(2) : "N/A"}`);
  }
  lines.push("");
  lines.push("Orden de menor a mayor riesgo: Long Call/Put → Short Put → Short Call.");
  return lines.join("\n");
}

function answerRentabilidad(ticker: string, snap: StrategiesSnapshot, focus?: StrategyKey, currentPrice?: number): string {
  const target = focus ?? rankBestStrategy(snap);
  const s = getStrategyOutput(snap, target);
  const label = STRATEGY_LABEL[target];

  const pnlAtm = s.scenarioAtm.profitLoss;
  const pnlPlus = s.scenarioPlus5.profitLoss;
  const pnlMinus = s.scenarioMinus5.profitLoss;

  const positiveScenarios = [pnlAtm, pnlPlus, pnlMinus].filter((p) => p > 0).length;
  const isRentable = positiveScenarios >= 2;

  const lines = [
    `**¿Es rentable ${label} para ${ticker}?**`,
    "",
    isRentable
      ? `✅ **Puede ser rentable** en ${positiveScenarios} de 3 escenarios calculados.`
      : `⚠️ **No es rentable** en la mayoría de los escenarios actuales.`,
    "",
    `**Escenarios:**`,
    `- ATM (${fmt(s.scenarioAtm.priceAtScenario)}): ${pnlAtm >= 0 ? "✅" : "❌"} P&L = ${fmt(pnlAtm)}`,
    `- +5%  (${fmt(s.scenarioPlus5.priceAtScenario)}): ${pnlPlus >= 0 ? "✅" : "❌"} P&L = ${fmt(pnlPlus)}`,
    `- -5%  (${fmt(s.scenarioMinus5.priceAtScenario)}): ${pnlMinus >= 0 ? "✅" : "❌"} P&L = ${fmt(pnlMinus)}`,
    "",
    `**Breakeven:** ${fmt(s.breakEvenPrice)} — el precio debe ${target.includes("CALL") ? "superar" : "caer por debajo de"} este nivel para rentabilizar.`,
    `**Probabilidad ITM:** ${fmtPct(s.probabilityItm)}`,
    `**Pérdida máxima en juego:** ${maxLossLabel(s)}`,
  ];

  if (!focus) {
    lines.push("", `*Análisis sobre ${label} por tener el mejor ratio riesgo/recompensa actual.*`);
  }

  return lines.join("\n");
}

function answerEspecifico(ticker: string, snap: StrategiesSnapshot, key: StrategyKey, question: string): string {
  const s = getStrategyOutput(snap, key);
  const label = STRATEGY_LABEL[key];
  const q = question.toLowerCase();

  // Delegar a intenciones específicas si la pregunta contiene keywords claros
  if (/perder|p[eé]rdida|loss/i.test(q)) return answerMaxPerdida(ticker, snap, key);
  if (/ganar|ganancia|profit/i.test(q)) return answerMaxGanancia(ticker, snap, key);
  if (/breakeven|equilibrio/i.test(q)) return answerBreakeven(ticker, snap, key);
  if (/escenario|pasa si|sube|baja/i.test(q)) return answerEscenarios(ticker, snap, key);
  if (/margen|margin/i.test(q)) return answerMargen(ticker, snap, key);
  if (/riesgo/i.test(q)) return answerRiesgo(ticker, snap, key);
  if (/rentable|conviene|vale la pena/i.test(q)) return answerRentabilidad(ticker, snap, key);

  // Resumen completo de la estrategia
  const lines = [
    `**Resumen ${label} — ${ticker}:**`,
    "",
    `| Campo                | Valor |`,
    `|----------------------|-------|`,
    `| Prima/acción         | ${fmt(s.premium)} |`,
    `| Prima/contrato (×100)| ${fmt(s.premium * 100)} |`,
    `| Contratos            | ${s.quantity} |`,
    `| Breakeven            | ${fmt(s.breakEvenPrice)} |`,
    `| Ganancia máxima      | ${fmt(s.maxProfit)} |`,
    `| Pérdida máxima       | ${maxLossLabel(s)} |`,
    `| Margen requerido     | ${s.requiredMargin > 0 ? fmt(s.requiredMargin) : "No aplica"} |`,
    `| P(ITM)               | ${fmtPct(s.probabilityItm)} |`,
    `| Ratio R/R            | ${s.riskAdjustedReturn > 0 ? s.riskAdjustedReturn.toFixed(2) : "N/A"} |`,
    "",
    "**Escenarios de P&L:**",
    `- ATM: ${fmt(s.scenarioAtm.profitLoss)} (ROI ${s.scenarioAtm.roi.toFixed(1)}%)`,
    `- +5%: ${fmt(s.scenarioPlus5.profitLoss)} (ROI ${s.scenarioPlus5.roi.toFixed(1)}%)`,
    `- -5%: ${fmt(s.scenarioMinus5.profitLoss)} (ROI ${s.scenarioMinus5.roi.toFixed(1)}%)`,
  ];
  if (s.warnings.length > 0) {
    lines.push("", "**Advertencias:**");
    s.warnings.forEach((w) => lines.push(`  ${w}`));
  }
  return lines.join("\n");
}

function answerGeneral(ticker: string, snap: StrategiesSnapshot, currentPrice?: number, ctx?: DashboardContext): string {
  const best = rankBestStrategy(snap);
  const s = getStrategyOutput(snap, best);
  const lines = [
    `**Resumen de opciones para ${ticker}${currentPrice ? ` (precio actual: ${fmt(currentPrice)})` : ""}:**`,
    "",
    "Las 4 estrategias calculadas:",
  ];
  for (const { key, out } of allFour(snap)) {
    const sign = out.scenarioAtm.profitLoss >= 0 ? "+" : "";
    lines.push(
      `- **${STRATEGY_LABEL[key]}**: breakeven ${fmt(out.breakEvenPrice)}, P&L ATM = ${sign}${fmt(out.scenarioAtm.profitLoss)}, pérd. máx ${maxLossLabel(out)}`
    );
  }
  lines.push("");
  lines.push(`→ Estrategia con mejor R/R actual: **${STRATEGY_LABEL[best]}** (ratio ${s.riskAdjustedReturn.toFixed(2)}).`);

  if (ctx) {
    const bias = dashboardBias(ctx);
    if (ctx.fundamental) {
      const icon = ctx.fundamental.verdict === "VIABLE" ? "✅" : ctx.fundamental.verdict === "NOT_VIABLE" ? "❌" : "⚠️";
      lines.push(`${icon} Fundamental: **${ctx.fundamental.verdict}** (${ctx.fundamental.overallScore}/100)`);
    }
    if (ctx.confluence) {
      lines.push(`📊 Confluencia: ${ctx.confluence.callCount} CALL / ${ctx.confluence.putCount} PUT — tendencia **${ctx.confluence.dominantTrend}**`);
    }
    if (ctx.ohlc) {
      lines.push(`🕯️ Velas (${ctx.ohlc.timeframe}): tendencia reciente **${ctx.ohlc.recentTrend}** @ ${fmt(ctx.ohlc.lastClose)}`);
    }
    if (bias >= 2) lines.push("→ Sesgo global: **ALCISTA** — favorece Long Call / Short Put");
    if (bias <= -2) lines.push("→ Sesgo global: **BAJISTA** — favorece Long Put");
    lines.push("");
  }

  lines.push("Puedes preguntar por: máxima ganancia, máxima pérdida, breakeven, escenarios, margen, riesgo, o comparar estrategias.");
  return lines.join("\n");
}

// ─── Ranker auxiliar ─────────────────────────────────────────────────────────

function rankBestStrategy(snap: StrategiesSnapshot): StrategyKey {
  return allFour(snap)
    .filter((x) => !isUnlimitedLoss(x.out))
    .sort((a, b) => b.out.riskAdjustedReturn - a.out.riskAdjustedReturn)[0].key;
}

// ─── Sección de contexto del dashboard ───────────────────────────────────────
// Dashboard context section — appended to answers when enriched context is available

/**
 * Razonamiento fundamental valor-por-valor: explica cómo cada métrica de la fuente
 * (Finviz, FMP, etc.) empuja el sesgo y por qué sustenta una estrategia.
 * Fundamental value-by-value reasoning: explains how each source metric drives bias and strategy.
 */
function fundamentalReasoning(f: FundamentalCtx): string[] {
  const out: string[] = [];
  const push = (label: string, value: string, why: string) =>
    out.push(`- **${label}: ${value}** → ${why}`);

  if (f.pe !== undefined) {
    push("P/E", f.pe.toFixed(2),
      f.pe <= 0 ? "ganancias negativas: empresa sin beneficios, sesgo bajista / cautela."
      : f.pe < 15 ? "valoración baja: posible infravaloración, favorece sesgo alcista (Long Call / Short Put)."
      : f.pe > 35 ? "valoración exigente: riesgo de corrección, favorece sesgo bajista (Long Put)."
      : "valoración moderada: neutral.");
  }
  if (f.pb !== undefined) {
    push("P/B", f.pb.toFixed(2),
      f.pb < 1 ? "cotiza bajo valor en libros: posible value, sesgo alcista."
      : f.pb > 5 ? "muy por encima de libros: caro, sesgo cauteloso." : "razonable, neutral.");
  }
  if (f.ps !== undefined) {
    push("P/S", f.ps.toFixed(2),
      f.ps > 10 ? "ventas caras frente a precio: riesgo de múltiplo, cautela." : "aceptable, neutral.");
  }
  if (f.roe !== undefined) {
    push("ROE", `${f.roe.toFixed(2)}%`,
      f.roe > 15 ? "alta rentabilidad sobre capital: negocio fuerte, refuerza sesgo alcista."
      : f.roe < 0 ? "destruye capital: sesgo bajista." : "rentabilidad media, neutral.");
  }
  if (f.debtToEquity !== undefined) {
    push("Deuda/Capital", f.debtToEquity.toFixed(2),
      f.debtToEquity > 2 ? "apalancamiento alto: fragilidad ante caídas, eleva el riesgo de estrategias short."
      : f.debtToEquity < 0.5 ? "balance sano: soporta sesgo alcista." : "endeudamiento moderado.");
  }
  if (f.eps !== undefined) {
    push("EPS", f.eps.toFixed(2),
      f.eps > 0 ? "beneficio positivo por acción: base sólida." : "pérdidas por acción: sesgo bajista.");
  }
  if (f.epsGrowth !== undefined) {
    push("Crecimiento EPS", `${f.epsGrowth.toFixed(2)}%`,
      f.epsGrowth > 10 ? "beneficios crecientes: momentum alcista, favorece Long Call."
      : f.epsGrowth < 0 ? "beneficios en contracción: favorece Long Put." : "crecimiento plano, neutral.");
  }
  if (f.revenueGrowth !== undefined) {
    push("Crecimiento ingresos", `${f.revenueGrowth.toFixed(2)}%`,
      f.revenueGrowth > 10 ? "ventas en expansión: refuerza alcista."
      : f.revenueGrowth < 0 ? "ventas cayendo: refuerza bajista." : "estable, neutral.");
  }
  if (f.dividendYield !== undefined && f.dividendYield > 0) {
    push("Dividend Yield", `${f.dividendYield.toFixed(2)}%`,
      "paga dividendo: amortigua caídas, hace atractivo el Short Put (cobrar prima sobre acción estable).");
  }
  if (f.beta !== undefined) {
    push("Beta", f.beta.toFixed(2),
      f.beta > 1.3 ? "más volátil que el mercado: primas más caras, mayor potencial pero más riesgo."
      : f.beta < 0.8 ? "defensiva: movimientos suaves, favorece estrategias de cobro de prima." : "se mueve con el mercado.");
  }
  if (f.volatility !== undefined) {
    push("Volatilidad", `${f.volatility.toFixed(2)}%`,
      f.volatility > 40 ? "vol. alta: primas infladas, favorece estrategias vendedoras (Short Put/Call) si se busca cobrar prima."
      : f.volatility < 15 ? "vol. baja: primas baratas, favorece compradoras (Long Call/Put)." : "vol. media.");
  }
  if (f.change52w !== undefined) {
    push("Cambio 52sem", `${f.change52w.toFixed(2)}%`,
      f.change52w > 0 ? "tendencia anual positiva: contexto alcista." : "tendencia anual negativa: contexto bajista.");
  }
  return out;
}

function buildContextSectionMD(ctx: DashboardContext, ticker: string): string {
  const lines: string[] = ["", "---", `**Contexto del Dashboard — ${ticker}:**`, ""];

  if (ctx.fundamental) {
    const f = ctx.fundamental;
    const verdictIcon = f.verdict === "VIABLE" ? "✅" : f.verdict === "NOT_VIABLE" ? "❌" : "⚠️";
    lines.push(`**Análisis Fundamental${f.source ? ` (fuente: ${f.source})` : ""}:**`);
    lines.push(`- Veredicto: ${verdictIcon} **${f.verdict}** (Score ${f.overallScore}/100)`);
    lines.push(`- Recomendación: ${f.recommendation}`);
    if (f.sector) lines.push(`- Sector: ${f.sector}${f.industry ? ` / ${f.industry}` : ""}`);

    // Razonamiento valor-por-valor: cómo se llegó al pensamiento y por qué la estrategia.
    const reasoning = fundamentalReasoning(f);
    if (reasoning.length > 0) {
      lines.push("");
      lines.push(`**Cómo se llegó a este pensamiento (valor por valor de ${f.source ?? "la fuente"}):**`);
      lines.push(...reasoning);

      // Síntesis del sesgo derivado de los fundamentales.
      const fb = dashboardBias({ fundamental: f });
      const conclusion = fb >= 2
        ? "Los fundamentales en conjunto apuntan **alcista** → estrategias compradoras alcistas (Long Call) o cobro de prima alcista (Short Put)."
        : fb <= -2
        ? "Los fundamentales en conjunto apuntan **bajista** → protección/especulación bajista (Long Put)."
        : "Los fundamentales son **mixtos** → priorizar el ratio riesgo/recompensa de cada estrategia.";
      lines.push("", `→ **Conclusión fundamental:** ${conclusion}`);
    }
    lines.push("");
  }

  if (ctx.confluence) {
    const c = ctx.confluence;
    const total = c.callCount + c.putCount + c.holdCount;
    lines.push(`**Señales de Confluencia (${total} señales activas):**`);
    lines.push(`- CALL: ${c.callCount} | PUT: ${c.putCount} | HOLD: ${c.holdCount}`);
    lines.push(`- Score promedio: ${c.avgScore.toFixed(1)} | Tendencia dominante: **${c.dominantTrend}**`);
    if (c.topSignals.length > 0) {
      lines.push(`- Señales principales:`);
      for (const s of c.topSignals.slice(0, 4)) {
        lines.push(`  • ${s.core}${s.subCore ? `/${s.subCore}` : ""}: ${s.tipoSenal} (score ${s.score.toFixed(1)}) — ${s.observacionSummary}`);
      }
    }
    lines.push("");
  }

  if (ctx.ohlc) {
    const o = ctx.ohlc;
    lines.push(`**Gráfico de Velas (${o.timeframe}):**`);
    lines.push(`- Último cierre: $${o.lastClose.toFixed(2)} | Tendencia reciente: **${o.recentTrend}**`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Derive a directional bias score from dashboard context.
 * Returns positive for bullish, negative for bearish.
 * Used to modulate recommendations.
 */
function dashboardBias(ctx: DashboardContext): number {
  let bias = 0;

  if (ctx.fundamental) {
    if (ctx.fundamental.verdict === "VIABLE")     bias += 2;
    if (ctx.fundamental.verdict === "NOT_VIABLE") bias -= 2;
    if (ctx.fundamental.beta !== undefined && ctx.fundamental.beta < 1) bias += 0.5;
  }

  if (ctx.confluence) {
    bias += (ctx.confluence.callCount - ctx.confluence.putCount) * 0.5;
    if (ctx.confluence.dominantTrend === "ALCISTA") bias += 1;
    if (ctx.confluence.dominantTrend === "BAJISTA") bias -= 1;
  }

  if (ctx.ohlc) {
    if (ctx.ohlc.recentTrend === "ALCISTA") bias += 1;
    if (ctx.ohlc.recentTrend === "BAJISTA") bias -= 1;
  }

  return bias;
}

// ─── Punto de entrada público ────────────────────────────────────────────────

export function generateOptionsAnswer(request: OptionsQARequest): OptionsQAResponse {
  const intent = classifyIntent(request.question, request.selectedStrategy);
  const focus = strategyFocusFromIntent(intent, request.selectedStrategy);
  const { ticker, strategies: snap, currentPrice, dashboardContext } = request;

  let answer: string;

  switch (intent) {
    case "MAX_GANANCIA":          answer = answerMaxGanancia(ticker, snap, focus); break;
    case "MAX_PERDIDA":           answer = answerMaxPerdida(ticker, snap, focus); break;
    case "BREAKEVEN":             answer = answerBreakeven(ticker, snap, focus, currentPrice); break;
    case "ESCENARIOS":            answer = answerEscenarios(ticker, snap, focus); break;
    case "MARGEN":                answer = answerMargen(ticker, snap, focus); break;
    case "ROI":                   answer = answerROI(ticker, snap, focus); break;
    case "COMPARACION":           answer = answerComparacion(ticker, snap); break;
    case "RECOMENDACION":         answer = answerRecomendacion(ticker, snap, dashboardContext); break;
    case "RIESGO":                answer = answerRiesgo(ticker, snap, focus); break;
    case "RENTABILIDAD":          answer = answerRentabilidad(ticker, snap, focus, currentPrice); break;
    case "ESPECIFICO_LONG_CALL":  answer = answerEspecifico(ticker, snap, "LONG_CALL", request.question); break;
    case "ESPECIFICO_LONG_PUT":   answer = answerEspecifico(ticker, snap, "LONG_PUT", request.question); break;
    case "ESPECIFICO_SHORT_CALL": answer = answerEspecifico(ticker, snap, "SHORT_CALL", request.question); break;
    case "ESPECIFICO_SHORT_PUT":  answer = answerEspecifico(ticker, snap, "SHORT_PUT", request.question); break;
    default:                      answer = answerGeneral(ticker, snap, currentPrice, dashboardContext); break;
  }

  // Append dashboard context section for intents that benefit from full context
  const contextIntents: IntentType[] = ["RECOMENDACION", "GENERAL", "COMPARACION", "RENTABILIDAD", "RIESGO"];
  if (dashboardContext && contextIntents.includes(intent)) {
    answer += buildContextSectionMD(dashboardContext, ticker);
  }

  return {
    answer: `${answer}\n\n*${DISCLAIMER}*`,
    intent,
    strategyFocus: focus,
    disclaimer: DISCLAIMER,
  };
}
