/**
 * Options Analysis Core — Motor determinístico de Q&A para estrategias de opciones.
 *
 * Sin IA. Las respuestas se derivan exclusivamente de los datos calculados
 * por los evaluadores de estrategia (shortPut, longPut, shortCall, longCall).
 *
 * Diseñado para ser consumido por el chat u otros equipos vía HTTP.
 * Contrato estable: recibe StrategiesSnapshot + pregunta, devuelve OptionsQAResponse.
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

export interface OptionsQARequest {
  ticker: string;
  question: string;
  strategies: StrategiesSnapshot;
  selectedStrategy?: StrategyKey;
  currentPrice: number;
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

function answerRecomendacion(ticker: string, snap: StrategiesSnapshot): string {
  // Ranking por ratio ajustado: excluir Short Call (unlimited loss), ordenar por riskAdjustedReturn
  const ranked = allFour(snap)
    .filter((x) => !isUnlimitedLoss(x.out))
    .sort((a, b) => b.out.riskAdjustedReturn - a.out.riskAdjustedReturn);

  const top = ranked[0];
  const lines = [
    `**Recomendación de estrategia — ${ticker}:**`,
    "",
    `Basado en los cálculos actuales (ratio riesgo/recompensa, breakeven y probabilidad ITM):`,
    "",
    `→ **${STRATEGY_LABEL[top.key]}** tiene el mejor ratio riesgo/recompensa: **${top.out.riskAdjustedReturn.toFixed(2)}**.`,
    `  Prima: ${fmt(top.out.premium)}/acción | Breakeven: ${fmt(top.out.breakEvenPrice)} | P(ITM): ${fmtPct(top.out.probabilityItm)}`,
    "",
    "**Resumen por perfil de riesgo:**",
  ];

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

function answerGeneral(ticker: string, snap: StrategiesSnapshot, currentPrice?: number): string {
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
  lines.push("Puedes preguntar por: máxima ganancia, máxima pérdida, breakeven, escenarios, margen, riesgo, o comparar estrategias.");
  return lines.join("\n");
}

// ─── Ranker auxiliar ─────────────────────────────────────────────────────────

function rankBestStrategy(snap: StrategiesSnapshot): StrategyKey {
  return allFour(snap)
    .filter((x) => !isUnlimitedLoss(x.out))
    .sort((a, b) => b.out.riskAdjustedReturn - a.out.riskAdjustedReturn)[0].key;
}

// ─── Punto de entrada público ────────────────────────────────────────────────

export function generateOptionsAnswer(request: OptionsQARequest): OptionsQAResponse {
  const intent = classifyIntent(request.question, request.selectedStrategy);
  const focus = strategyFocusFromIntent(intent, request.selectedStrategy);
  const { ticker, strategies: snap, currentPrice } = request;

  let answer: string;

  switch (intent) {
    case "MAX_GANANCIA":          answer = answerMaxGanancia(ticker, snap, focus); break;
    case "MAX_PERDIDA":           answer = answerMaxPerdida(ticker, snap, focus); break;
    case "BREAKEVEN":             answer = answerBreakeven(ticker, snap, focus, currentPrice); break;
    case "ESCENARIOS":            answer = answerEscenarios(ticker, snap, focus); break;
    case "MARGEN":                answer = answerMargen(ticker, snap, focus); break;
    case "ROI":                   answer = answerROI(ticker, snap, focus); break;
    case "COMPARACION":           answer = answerComparacion(ticker, snap); break;
    case "RECOMENDACION":         answer = answerRecomendacion(ticker, snap); break;
    case "RIESGO":                answer = answerRiesgo(ticker, snap, focus); break;
    case "RENTABILIDAD":          answer = answerRentabilidad(ticker, snap, focus, currentPrice); break;
    case "ESPECIFICO_LONG_CALL":  answer = answerEspecifico(ticker, snap, "LONG_CALL", request.question); break;
    case "ESPECIFICO_LONG_PUT":   answer = answerEspecifico(ticker, snap, "LONG_PUT", request.question); break;
    case "ESPECIFICO_SHORT_CALL": answer = answerEspecifico(ticker, snap, "SHORT_CALL", request.question); break;
    case "ESPECIFICO_SHORT_PUT":  answer = answerEspecifico(ticker, snap, "SHORT_PUT", request.question); break;
    default:                      answer = answerGeneral(ticker, snap, currentPrice); break;
  }

  return {
    answer: `${answer}\n\n*${DISCLAIMER}*`,
    intent,
    strategyFocus: focus,
    disclaimer: DISCLAIMER,
  };
}
