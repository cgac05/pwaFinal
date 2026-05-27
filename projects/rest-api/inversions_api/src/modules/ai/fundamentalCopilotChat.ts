import type { SupabaseClient } from "@supabase/supabase-js";
import { FundamentalDataService } from "../fundamental/fundamentalDataService";
import { buildOptionStrategyCandidates } from "../strategies/optionsStrategyService";
import type { OptionStrategyResult } from "../strategies/optionsStrategyContract";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
  metadata: {
    ticker: string;
    context_type: "fundamental" | "strategy";
    reasoning_trace?: string[];
  };
}

export interface CopilotChatRequest {
  ticker: string;
  question: string;
  includeStrategyRecommendation?: boolean;
  userId?: string;
  simulationContext?: CopilotSimulationContext;
}

export interface CopilotChatResponse {
  answer: string;
  sourceContext: string[];
  disclaimer: string;
  reasoningTrace: string[];
}

interface MarketMetrics {
  price?: number;
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  psRatio?: number;
  roe?: number;
  debtToEquity?: number;
  dividendYield?: number;
  annualizedVolatility?: number;
  eps?: number;
  grossMargin?: number;
  sector?: string;
  industry?: string;
  companyName?: string;
  priceHigh52Week?: number;
  priceLow52Week?: number;
  revenueGrowth?: number;
}

export interface CopilotSimulationContext {
  strategy: string;
  verdict: "VIABLE" | "MARGINAL" | "NO_VIABLE" | string;
  score: number;
  projectionFrom: string;
  projectionTo: string;
  initialPrice: number;
  expectedMove?: number;
  strike?: number;
  premium?: number;
  breakeven?: number;
  maxLoss?: number | string;
  maxProfit?: number | string;
  scenarios?: Array<{ label: string; price: number; profitLoss: number }>;
  drivers?: string[];
  changeTriggers?: string[];
  calculationSteps?: string[];
}

interface FundamentalContext {
  ticker: string;
  viabilityScore?: number;
  viabilityJustification?: string;
  strategySummary?: string;
  recentUserAnalysis?: string[];
  contextDescriptions: string[];
  market?: MarketMetrics;
}

export class FundamentalCopilotChat {
  private readonly fundamentalService: FundamentalDataService;

  constructor(private readonly supabaseClient?: SupabaseClient) {
    this.fundamentalService = new FundamentalDataService(supabaseClient);
  }

  async generateResponse(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const ticker = request.ticker.toUpperCase();
    const reasoningTrace: string[] = [];
    const baseContext = [`Ticker: ${ticker}`, `Question: ${request.question}`];

    const fundamentalContext = await this.buildFundamentalContext(ticker, request.userId);

    if (fundamentalContext.market?.price) {
      baseContext.push(`Precio actual: $${fundamentalContext.market.price}`);
    }
    if (fundamentalContext.viabilityScore !== undefined) {
      baseContext.push(`Viability score: ${fundamentalContext.viabilityScore}`);
    }
    if (fundamentalContext.strategySummary) {
      baseContext.push(`Strategy summary available`);
    }
    if (request.simulationContext) {
      baseContext.push(`Simulation strategy: ${request.simulationContext.strategy}`);
      baseContext.push(`Simulation verdict: ${request.simulationContext.verdict} (${request.simulationContext.score}/100)`);
      baseContext.push(`Simulation range: ${request.simulationContext.projectionFrom} to ${request.simulationContext.projectionTo}`);
    }

    const prompt = this.buildClaudePrompt(request, fundamentalContext);
    const answer = await this.executeCopilot(prompt, fundamentalContext, reasoningTrace, request.question, request.simulationContext);

    await this.logChatInteraction(request.userId, ticker, reasoningTrace.length + 1);

    return {
      answer,
      sourceContext: baseContext.concat(fundamentalContext.contextDescriptions),
      disclaimer: this.buildDisclaimer(),
      reasoningTrace
    };
  }

  private buildClaudePrompt(request: CopilotChatRequest, context: FundamentalContext): string {
    const lines: string[] = [];
    lines.push("Eres un asesor de inversiones explicativo. Tu rol es EXPLICAR análisis fundamental y estrategias de opciones sin ejecutar operaciones ni dar asesoramiento financiero.");
    lines.push("Responde con claridad, estructura la explicación en secciones, incluye supuestos y limitaciones y siempre añade un disclaimer.");
    lines.push("No uses lenguaje que parezca una orden de trading ni indiques que el usuario debe comprar o vender.");
    lines.push("");
    lines.push(`Ticker: ${context.ticker}`);
    if (context.market?.companyName) lines.push(`Empresa: ${context.market.companyName}`);
    if (context.market?.sector)      lines.push(`Sector: ${context.market.sector} / ${context.market.industry ?? ""}`);

    if (context.market) {
      const m = context.market;
      lines.push("");
      lines.push("Datos de mercado actuales:");
      if (m.price)               lines.push(`  Precio: $${m.price}`);
      if (m.priceHigh52Week)     lines.push(`  Máximo 52 semanas: $${m.priceHigh52Week}`);
      if (m.priceLow52Week)      lines.push(`  Mínimo 52 semanas: $${m.priceLow52Week}`);
      if (m.marketCap)           lines.push(`  Market Cap: $${(m.marketCap / 1e9).toFixed(2)}B`);
      if (m.peRatio)             lines.push(`  P/E: ${m.peRatio}`);
      if (m.pbRatio)             lines.push(`  P/B: ${m.pbRatio}`);
      if (m.psRatio)             lines.push(`  P/S: ${m.psRatio}`);
      if (m.roe)                 lines.push(`  ROE: ${m.roe}%`);
      if (m.debtToEquity)        lines.push(`  Deuda/Patrimonio: ${m.debtToEquity}`);
      if (m.dividendYield)       lines.push(`  Dividend Yield: ${m.dividendYield}%`);
      if (m.eps)                 lines.push(`  EPS: $${m.eps}`);
      if (m.annualizedVolatility) lines.push(`  Volatilidad anualizada: ${m.annualizedVolatility}%`);
      if (m.revenueGrowth)       lines.push(`  Crecimiento de ventas 5Y: ${m.revenueGrowth}%`);
    }

    if (context.viabilityScore !== undefined) {
      lines.push(`Viability score: ${context.viabilityScore}`);
    }
    if (context.viabilityJustification) {
      lines.push(`Justification: ${context.viabilityJustification}`);
    }
    if (context.strategySummary) {
      lines.push(`Strategy summary: ${context.strategySummary}`);
    }
    if (request.simulationContext) {
      lines.push("");
      lines.push("Contexto de simulacion seleccionado por el usuario:");
      lines.push(this.formatSimulationContext(request.simulationContext));
    }
    const recentUserAnalysis = context.recentUserAnalysis ?? [];
    if (recentUserAnalysis.length > 0) {
      lines.push("Recent user analysis history:");
      recentUserAnalysis.forEach((entry) => lines.push(`- ${entry}`));
    }

    const q = request.question.toLowerCase();
    if (q.includes("estrategia") || q.includes("opcion") || q.includes("call") || q.includes("put") || q.includes("long") || q.includes("short") || q.includes("prima") || q.includes("bajista") || q.includes("alcista") || q.includes("caída") || q.includes("cae") || q.includes("sube")) {
      if (context.market?.price) {
        const explicitDir = this.extractExplicitDirection(q);
        const direction = explicitDir ?? this.deriveDirection(context.market);
        const candidates = this.buildOptionsAnalysis(context.market, context.ticker);
        const optText = this.formatOptionsSection(candidates, direction, context.market);
        if (optText) {
          lines.push("");
          lines.push("Análisis de opciones pre-calculado (úsalo en tu respuesta):");
          lines.push(optText);
        }
      }
    }

    lines.push("");
    lines.push(`Pregunta del usuario: ${request.question}`);
    lines.push("");

    if (request.includeStrategyRecommendation) {
      lines.push("Incluye una recomendación de estrategia basada en el análisis fundamental y las posibilidades de opciones descritas.");
    }

    return lines.join("\n");
  }

  private formatSimulationContext(simulation: CopilotSimulationContext): string {
    const lines: string[] = [];
    lines.push(`- Estrategia: ${simulation.strategy}`);
    lines.push(`- Veredicto: ${simulation.verdict} (${simulation.score}/100)`);
    lines.push(`- Rango: ${simulation.projectionFrom} -> ${simulation.projectionTo}`);
    lines.push(`- Precio inicial: $${simulation.initialPrice}`);
    if (simulation.expectedMove !== undefined) lines.push(`- Movimiento esperado: +/-$${simulation.expectedMove}`);
    if (simulation.strike !== undefined) lines.push(`- Strike ATM: $${simulation.strike}`);
    if (simulation.premium !== undefined) lines.push(`- Prima teorica: $${simulation.premium}`);
    if (simulation.breakeven !== undefined) lines.push(`- Breakeven: $${simulation.breakeven}`);
    if (simulation.maxLoss !== undefined) lines.push(`- Perdida maxima: ${simulation.maxLoss}`);
    if (simulation.maxProfit !== undefined) lines.push(`- Ganancia maxima: ${simulation.maxProfit}`);
    if (simulation.scenarios?.length) {
      lines.push("- Escenarios:");
      simulation.scenarios.forEach((scenario) => {
        lines.push(`  - ${scenario.label}: precio $${scenario.price}, P&L $${scenario.profitLoss}`);
      });
    }
    if (simulation.drivers?.length) {
      lines.push("- Razones fundamentales:");
      simulation.drivers.forEach((driver) => lines.push(`  - ${driver}`));
    }
    if (simulation.changeTriggers?.length) {
      lines.push("- Que podria cambiar la opinion:");
      simulation.changeTriggers.forEach((trigger) => lines.push(`  - ${trigger}`));
    }
    if (simulation.calculationSteps?.length) {
      lines.push("- Pasos de calculo:");
      simulation.calculationSteps.forEach((step) => lines.push(`  - ${step}`));
    }
    return lines.join("\n");
  }

  private containsForbiddenTradingOrder(answer: string): boolean {
    const normalized = answer.toLowerCase();
    return [
      "compra ahora",
      "vende inmediatamente",
      "esta es tu oportunidad",
      "deberias ejecutar",
      "deberías ejecutar",
      "ejecuta esta orden",
      "compra ya",
      "vende ya"
    ].some((phrase) => normalized.includes(phrase));
  }

  private async executeCopilot(
    prompt: string,
    context: FundamentalContext,
    reasoningTrace: string[],
    originalQuestion: string,
    simulationContext?: CopilotSimulationContext
  ): Promise<string> {
    const claudeAnswer = await this.callClaude(prompt);
    if (claudeAnswer && !this.containsForbiddenTradingOrder(claudeAnswer)) {
      reasoningTrace.push("Used Claude API prompt generation.");
      return claudeAnswer;
    }

    reasoningTrace.push("Used local copilot fallback.");
    return this.localChatResponse(originalQuestion, context, reasoningTrace, simulationContext);
  }

  private async callClaude(prompt: string): Promise<string | undefined> {
    const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return undefined;

    try {
      const model = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }]
        }),
        signal: AbortSignal.timeout(Number(process.env.CLAUDE_TIMEOUT_MS ?? 8000))
      });

      if (!response.ok) return undefined;

      const payload = (await response.json()) as {
        content?: Array<{ type: string; text: string }>;
      };
      return payload?.content?.find((b) => b.type === "text")?.text?.trim();
    } catch {
      return undefined;
    }
  }

  private localChatResponse(
    _prompt: string,
    context: FundamentalContext,
    reasoningTrace: string[],
    simulationContext?: CopilotSimulationContext
  ): string {
    const m = context.market;
    const q = _prompt.toLowerCase();
    const lines: string[] = [];

    const ticker = context.ticker;
    const company = m?.companyName ?? ticker;
    const fundamentalDir = m ? this.deriveDirection(m) : "NEUTRAL";
    const explicitDir = this.extractExplicitDirection(q);
    const vol = m?.annualizedVolatility ?? 0;
    const volLabel = vol > 40 ? "alta" : vol > 25 ? "moderada" : "baja";

    const isOptionsQ = ["estrategia", "opcion", "call", "put", "long", "short", "prima", "breakeven", "strike"].some((w) => q.includes(w));
    const isBearishQ = explicitDir === "BAJISTA";
    const isBullishQ = explicitDir === "ALCISTA";
    const isScenarioQ = ["escenario", "qué pasa", "que pasa", "qué puede", "que puede", "podria cambiar", "podría cambiar", "opinion", "opinión", "riesgo"].some((w) => q.includes(w));
    const isExplainQ = ["por qué", "porque", "explica", "cuando", "cuándo", "conviene", "sirve", "no sirve", "qué significa", "que significa"].some((w) => q.includes(w));
    const isCompareQ = ["vs", "versus", "diferencia", "comparar", "mejor"].some((w) => q.includes(w));
    const isHowCalculatedQ = ["como calcul", "cómo calcul", "calculo", "cálculo", "formula", "pasos"].some((w) => q.includes(w));

    // ── Snapshot de datos ──────────────────────────────────────────────────
    lines.push(`**${company} (${ticker})** — datos en tiempo real`);
    lines.push("");

    if (m?.price) {
      const pos = (m.priceHigh52Week && m.priceLow52Week && m.priceHigh52Week > m.priceLow52Week)
        ? Math.round(((m.price - m.priceLow52Week) / (m.priceHigh52Week - m.priceLow52Week)) * 100)
        : null;
      lines.push(`Precio: **$${m.price}** ${pos !== null ? `| Rango 52w: $${m.priceLow52Week?.toFixed(2)} – $${m.priceHigh52Week?.toFixed(2)} (posición ${pos}%)` : ""}`);
    }
    const metrics: string[] = [];
    if (m?.peRatio)  metrics.push(`P/E ${m.peRatio}x`);
    if (m?.roe)      metrics.push(`ROE ${m.roe}%`);
    if (m?.debtToEquity !== undefined) metrics.push(`D/E ${m.debtToEquity}`);
    if (m?.revenueGrowth) metrics.push(`Crec. ventas 5Y ${m.revenueGrowth}%`);
    if (vol > 0)     metrics.push(`Vol ${vol}% (${volLabel})`);
    if (metrics.length) lines.push(metrics.join(" | "));
    lines.push(`Sesgo fundamental: **${fundamentalDir}**`);
    lines.push("");

    if (simulationContext) {
      lines.push(`**Simulacion seleccionada: ${simulationContext.strategy}**`);
      lines.push(`Veredicto fundamental: **${simulationContext.verdict}** (${simulationContext.score}/100) | Rango ${simulationContext.projectionFrom} -> ${simulationContext.projectionTo}`);
      lines.push(`Strike: $${simulationContext.strike ?? "N/D"} | Prima: $${simulationContext.premium ?? "N/D"} | Breakeven: $${simulationContext.breakeven ?? "N/D"}`);
      lines.push(`Perdida maxima: ${simulationContext.maxLoss ?? "N/D"} | Ganancia maxima: ${simulationContext.maxProfit ?? "N/D"}`);
      lines.push("");

      if (simulationContext.drivers?.length) {
        lines.push("**Por que la empresa queda en ese veredicto:**");
        simulationContext.drivers.slice(0, 5).forEach((driver) => lines.push(`- ${driver}`));
        lines.push("");
      }

      if (simulationContext.scenarios?.length) {
        lines.push("**Riesgos y escenarios de la estrategia:**");
        simulationContext.scenarios.forEach((scenario) => {
          lines.push(`- ${scenario.label}: precio $${scenario.price}, P&L estimado $${scenario.profitLoss}`);
        });
        lines.push("");
      }

      if (isScenarioQ && simulationContext.changeTriggers?.length) {
        lines.push("**Escenarios de mercado a considerar:**");
        simulationContext.changeTriggers.forEach((trigger) => lines.push(`- ${trigger}`));
        lines.push("");
      }

      if (isHowCalculatedQ && simulationContext.calculationSteps?.length) {
        lines.push("**Como se calculo el resultado:**");
        simulationContext.calculationSteps.forEach((step) => lines.push(`- ${step}`));
        lines.push("");
        lines.push("En resumen: el score de viabilidad sale del promedio de metricas fundamentales y la proyeccion de opciones aplica strike ATM, prima teorica, breakeven y P&L por escenario.");
        lines.push("");
      }
    }

    // ── Cuerpo contextual ──────────────────────────────────────────────────

    if (isBearishQ && (isOptionsQ || isScenarioQ || isExplainQ)) {
      // Usuario pide escenario/estrategia bajista
      if (fundamentalDir === "ALCISTA") {
        lines.push(`**¿Por qué es difícil el escenario bajista para ${ticker}?**`);
        lines.push("");
        lines.push(`Los fundamentales apuntan en dirección contraria:`);
        if (m?.roe && m.roe > 20)         lines.push(`- ROE de ${m.roe}% indica que la empresa genera rendimiento excepcional sobre su capital`);
        if (m?.revenueGrowth && m.revenueGrowth > 10) lines.push(`- Crecimiento de ventas del ${m.revenueGrowth}% anual — raramente compatible con una tesis bajista estructural`);
        if (m?.debtToEquity !== undefined && m.debtToEquity < 0.5) lines.push(`- Deuda conservadora (D/E ${m.debtToEquity}): baja probabilidad de estrés financiero`);
        if (m?.peRatio && m.peRatio > 30) lines.push(`- P/E de ${m.peRatio}x sí representa una valuación elevada que PODRÍA comprimirse si el crecimiento decepciona`);
        lines.push("");
        lines.push(`**¿Cuándo tendría sentido una posición bajista de todas formas?**`);
        lines.push(`- Guía de resultados por debajo de expectativas (guidance miss)`);
        lines.push(`- Compresión de márgenes por competencia o costos`);
        lines.push(`- Rotación sectorial: salida de growth → value en entorno de tasas altas`);
        lines.push(`- El precio está en el ${Math.round(((m?.price ?? 0) - (m?.priceLow52Week ?? 0)) / Math.max((m?.priceHigh52Week ?? 1) - (m?.priceLow52Week ?? 0), 1) * 100)}% del rango 52w — corrección técnica posible`);
        lines.push("");
        lines.push(`**Uso recomendado del bajista: HEDGE, no especulación directional**`);
        lines.push(`Un Long Put sirve para proteger una posición larga existente en ${ticker}, no como apuesta principal contra la empresa.`);
      } else if (fundamentalDir === "BAJISTA") {
        lines.push(`**Escenario bajista para ${ticker} — alineado con fundamentales**`);
        lines.push("");
        lines.push(`Los datos respaldan esta tesis:`);
        if (m?.peRatio && m.peRatio > 35) lines.push(`- Valuación elevada (P/E ${m.peRatio}x) vulnerable a corrección`);
        if (m?.roe && m.roe < 10)         lines.push(`- ROE bajo (${m.roe}%) sugiere ineficiencia en uso de capital`);
        if (m?.debtToEquity && m.debtToEquity > 1) lines.push(`- Apalancamiento elevado (D/E ${m.debtToEquity}) aumenta riesgo`);
        lines.push("");
      } else {
        lines.push(`**Escenario bajista para ${ticker} — fundamentales neutros**`);
        lines.push(`Los datos no confirman ni contradicen fuertemente una tesis bajista. El riesgo principal sería una decepción de resultados o macro adverso.`);
        lines.push("");
      }
    } else if (isBullishQ && (isOptionsQ || isScenarioQ || isExplainQ)) {
      if (fundamentalDir === "BAJISTA") {
        lines.push(`**¿Por qué es difícil el escenario alcista para ${ticker}?**`);
        lines.push("");
        lines.push(`Los fundamentales sugieren presión a la baja:`);
        if (m?.peRatio && m.peRatio > 40) lines.push(`- P/E de ${m.peRatio}x ya incorpora expectativas muy optimistas — poco margen de expansión`);
        if (m?.roe && m.roe < 10)         lines.push(`- ROE de ${m.roe}% indica rentabilidad débil`);
        lines.push("");
        lines.push(`Un Long Call en este contexto requiere que el precio supere el breakeven antes del vencimiento. Con vol ${volLabel} y fundamentales débiles, esa probabilidad es reducida.`);
        lines.push("");
      } else {
        lines.push(`**Escenario alcista para ${ticker} — ${fundamentalDir === "ALCISTA" ? "respaldado por fundamentales" : "fundamentales neutrales"}**`);
        lines.push("");
        if (fundamentalDir === "ALCISTA") {
          if (m?.roe && m.roe > 20) lines.push(`- ROE ${m.roe}%: empresa genera rendimiento excepcional — catalizador para alza`);
          if (m?.revenueGrowth && m.revenueGrowth > 10) lines.push(`- Crecimiento ventas ${m.revenueGrowth}% anual sostiene la expansión de múltiplos`);
        }
        lines.push("");
      }
    } else if (isCompareQ && isOptionsQ) {
      lines.push(`**Comparativa de estrategias para ${ticker}:**`);
      lines.push("");
      lines.push(`| Estrategia | Riesgo | Potencial | Cuándo usarla |`);
      lines.push(`|-----------|--------|-----------|---------------|`);
      lines.push(`| Long Call | Limitado (prima) | Ilimitado | Esperas alza fuerte antes de vencimiento |`);
      lines.push(`| Long Put | Limitado (prima) | Alto | Esperas caída; también como hedge |`);
      lines.push(`| Short Call | Ilimitado ⚠️ | Prima cobrada | Vol alta + mercado lateral/bajista |`);
      lines.push(`| Short Put | Alto (asignación) | Prima cobrada | Vol alta + dispuesto a comprar acciones |`);
      lines.push("");
      lines.push(`Con vol ${volLabel} (${vol}%) para ${ticker}:`);
      if (vol > 35) {
        lines.push(`- Vol alta → primas caras → VENDER prima (Short Call / Short Put) es más atractivo`);
        lines.push(`- Short Put es preferible a Short Call porque el riesgo es conocido ($0 como límite inferior)`);
      } else {
        lines.push(`- Vol baja → primas baratas → COMPRAR opciones (Long Call / Long Put) es eficiente`);
        lines.push(`- Long Call si sesgo alcista; Long Put si bajista o como hedge`);
      }
      lines.push("");
    } else if (!isOptionsQ && !isScenarioQ) {
      // Pregunta general fundamental
      lines.push(`**Análisis fundamental de ${company}:**`);
      lines.push("");
      if (m?.peRatio) {
        const peCtx = m.peRatio > 35 ? `valuación premium — el mercado espera crecimiento sostenido` : m.peRatio < 15 ? `valuación de descuento — posible oportunidad o señal de debilidad` : `valuación en línea con el mercado`;
        lines.push(`**Valuación:** P/E ${m.peRatio}x — ${peCtx}`);
      }
      if (m?.roe) {
        lines.push(`**Eficiencia:** ROE ${m.roe}% — ${m.roe > 20 ? "por encima del promedio S&P 500 (~15%), indica ventaja competitiva" : m.roe < 10 ? "por debajo del promedio, posible ineficiencia operativa" : "dentro del rango normal"}`);
      }
      if (m?.revenueGrowth) {
        lines.push(`**Crecimiento:** ventas +${m.revenueGrowth}% (5 años) — ${m.revenueGrowth > 20 ? "crecimiento acelerado, típico de empresas growth" : m.revenueGrowth > 5 ? "crecimiento saludable" : "crecimiento lento, posible empresa madura"}`);
      }
      if (m?.debtToEquity !== undefined) {
        lines.push(`**Deuda:** D/E ${m.debtToEquity} — ${m.debtToEquity < 0.5 ? "balance sólido, baja dependencia de deuda" : m.debtToEquity > 1.5 ? "apalancamiento elevado, monitorear cobertura de intereses" : "nivel moderado"}`);
      }
      lines.push("");
    }

    // ── Tabla de opciones (siempre que haya keywords de opciones) ──────────
    if ((isOptionsQ || isBearishQ || isBullishQ) && m?.price) {
      const direction = explicitDir ?? fundamentalDir;
      const candidates = this.buildOptionsAnalysis(m, ticker);
      lines.push(this.formatOptionsSection(candidates, direction, m));
    }

    // ── Escenarios numéricos ───────────────────────────────────────────────
    if (isScenarioQ && m?.price) {
      const p = m.price;
      const v = vol / 100;
      const move30d = Math.round(p * v * Math.sqrt(30 / 252) * 100) / 100;
      lines.push("Escenarios de mercado a considerar:");
      lines.push(`**Movimiento esperado (1 mes, ±1σ): ±$${move30d} (±${(move30d / p * 100).toFixed(1)}%)**`);
      lines.push(`- Escenario alcista: $${(p + move30d).toFixed(2)}`);
      lines.push(`- Escenario bajista: $${(p - move30d).toFixed(2)}`);
      lines.push(`- Catalizadores positivos: earnings beat, expansión de producto, guía optimista`);
      lines.push(`- Catalizadores negativos: earnings miss, competencia, macro adverso (tasas, dólar)`);
      lines.push("");
    }

    if (isHowCalculatedQ && !simulationContext) {
      lines.push("Cómo se calculó el resultado:");
      lines.push("- Se cargaron datos fundamentales disponibles del ticker: precio, volatilidad, valuacion, rentabilidad, deuda y crecimiento.");
      lines.push("- El score de viabilidad se infiere ponderando calidad fundamental, riesgo y posicion del precio dentro del rango reciente.");
      lines.push("- Para opciones se estima strike ATM, prima teorica, breakeven y P&L bajo escenarios ATM, +5% y -5%.");
      lines.push("- Si falta algun dato, el chat lo declara y limita la conclusion a la informacion disponible.");
      lines.push("");
    }

    if (!m?.price && !m?.peRatio) {
      lines.push("No se encontraron datos de mercado. Verifica el ticker e intenta de nuevo.");
    }

    lines.push(this.buildDisclaimer());
    reasoningTrace.push("Local fallback con datos Finviz.");
    return lines.join("\n");
  }

  private extractExplicitDirection(question: string): "ALCISTA" | "BAJISTA" | null {
    const q = question.toLowerCase();
    const bearish = ["bajista", "caída", "cae", "baja", "short put", "long put", "si cae", "si baja", "escenario negativo", "bearish"];
    const bullish = ["alcista", "sube", "alza", "long call", "si sube", "escenario positivo", "bullish"];
    if (bearish.some((w) => q.includes(w))) return "BAJISTA";
    if (bullish.some((w) => q.includes(w))) return "ALCISTA";
    return null;
  }

  private deriveDirection(market: MarketMetrics): "ALCISTA" | "BAJISTA" | "NEUTRAL" {
    if (!market.price || !market.priceHigh52Week || !market.priceLow52Week) return "NEUTRAL";
    const range = market.priceHigh52Week - market.priceLow52Week;
    if (range <= 0) return "NEUTRAL";
    const position = (market.price - market.priceLow52Week) / range;
    const overvalued = market.peRatio !== undefined && market.peRatio > 40;
    const qualityROE = market.roe !== undefined && market.roe > 15;
    if (position > 0.6 && !overvalued) return qualityROE ? "ALCISTA" : "NEUTRAL";
    if (position < 0.35) return "BAJISTA";
    return "NEUTRAL";
  }

  private buildOptionsAnalysis(market: MarketMetrics, ticker: string): OptionStrategyResult[] {
    if (!market.price || market.price <= 0) return [];
    const price = market.price;
    const vol = market.annualizedVolatility ?? 25;
    const DTE = 30;
    const strikePrice = Math.round(price / 5) * 5;
    // Simplified ATM premium: price × daily_vol × sqrt(DTE) × 0.4
    const dailyVol = vol / 100 / Math.sqrt(252);
    const premium = Math.max(0.01, Math.round(price * dailyVol * Math.sqrt(DTE) * 0.4 * 100) / 100);
    const expirationDate = new Date(Date.now() + DTE * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    try {
      return buildOptionStrategyCandidates({
        ticker,
        optionType: "call",
        direction: "long",
        strikePrice,
        currentPrice: price,
        expirationDate,
        daysToExpiration: DTE,
        premium,
        quantity: 1,
        capitalAvailable: price * 100,
        riskTolerance: "medium",
        assumptions: { impliedVolatility: vol, interestRate: 4.5 }
      } as any);
    } catch {
      return [];
    }
  }

  private formatOptionsSection(
    candidates: OptionStrategyResult[],
    direction: "ALCISTA" | "BAJISTA" | "NEUTRAL",
    market: MarketMetrics
  ): string {
    if (candidates.length === 0) return "";
    const vol = market.annualizedVolatility ?? 25;
    const price = market.price ?? 0;
    const strike = Math.round(price / 5) * 5;
    const DTE = 30;

    // Pick recommended strategy based on direction + vol
    let recommended: OptionStrategyResult | undefined;
    if (direction === "ALCISTA") {
      recommended = vol > 35
        ? candidates.find((c) => c.optionType === "PUT" && String(c.direction).toUpperCase() === "SHORT")
        : candidates.find((c) => c.optionType === "CALL" && String(c.direction).toUpperCase() === "LONG");
    } else if (direction === "BAJISTA") {
      recommended = vol > 35
        ? candidates.find((c) => c.optionType === "CALL" && String(c.direction).toUpperCase() === "SHORT")
        : candidates.find((c) => c.optionType === "PUT" && String(c.direction).toUpperCase() === "LONG");
    } else {
      recommended = vol > 35
        ? candidates.find((c) => String(c.direction).toUpperCase() === "SHORT")
        : undefined;
    }

    const lines: string[] = [];
    lines.push(`**Análisis de opciones — Strike ATM ~$${strike}, DTE ${DTE} días, Vol ${vol}%:**`);
    lines.push(`Sesgo fundamental: **${direction}**`);
    lines.push("");

    for (const c of candidates) {
      const dir = String(c.direction).toUpperCase();
      const type = String(c.optionType).toUpperCase();
      const label = `${dir} ${type}`;
      const maxLoss = c.maxLoss === Infinity ? "ilimitada" : `$${c.maxLoss.toFixed(0)}`;
      const maxProfit = c.maxProfit === Infinity ? "ilimitado" : `$${c.maxProfit.toFixed(0)}`;
      const isRec = recommended && c.optionType === recommended.optionType && String(c.direction).toUpperCase() === String(recommended.direction).toUpperCase();
      lines.push(`${isRec ? "★ " : "  "}**${label}**${isRec ? " ← recomendada" : ""}`);
      lines.push(`    Breakeven: $${c.breakEvenPrice.toFixed(2)} | Max profit: ${maxProfit} | Max loss: ${maxLoss}`);
      lines.push(`    Escenarios: ATM $${c.scenarioAtm?.profitLoss?.toFixed(0) ?? "?"} | +5% $${c.scenarioPlus5?.profitLoss?.toFixed(0) ?? "?"} | -5% $${c.scenarioMinus5?.profitLoss?.toFixed(0) ?? "?"}`);
      if (c.warnings?.length) lines.push(`    ⚠ ${c.warnings[0]}`);
    }

    if (recommended) {
      const dir = String(recommended.direction).toUpperCase();
      const type = String(recommended.optionType).toUpperCase();
      lines.push("");
      if (dir === "LONG") {
        lines.push(`**Por qué ${dir} ${type}:** Estrategia de riesgo limitado. Pagas la prima ($${recommended.premium?.toFixed(2)}) como máxima pérdida. ${direction === "ALCISTA" && type === "CALL" ? "Captura alza ilimitada si el precio supera el breakeven." : "Captura caída si el precio baja del breakeven."}`);
      } else {
        lines.push(`**Por qué ${dir} ${type}:** Vendes prima (cobras $${recommended.premium?.toFixed(2)} × 100). Con vol alta (${vol}%) las primas son caras. Margen requerido: $${recommended.requiredMargin?.toFixed(0)}.`);
      }
    }

    lines.push("");
    return lines.join("\n");
  }

  private buildDisclaimer(): string {
    return "Este análisis es informativo y no constituye una recomendación de inversión. Consulta a un profesional antes de tomar decisiones financieras.";
  }

  private async buildFundamentalContext(ticker: string, userId?: string): Promise<FundamentalContext> {
    const context: FundamentalContext = {
      ticker,
      contextDescriptions: [],
      recentUserAnalysis: []
    };

    // Fetch real market data from Finviz (primary) / Yahoo (fallback)
    try {
      const result = await this.fundamentalService.fetch(ticker, 252);
      if (result.success && result.data) {
        const d = result.data;
        const m = d.metrics;
        context.market = {
          companyName:          d.companyName,
          price:                m.priceHistory?.currentPrice,
          priceHigh52Week:      m.priceHistory?.priceHigh52Week,
          priceLow52Week:       m.priceHistory?.priceLow52Week,
          marketCap:            m.marketCap?.value,
          peRatio:              m.financialRatios?.peRatio,
          pbRatio:              m.financialRatios?.pbRatio,
          psRatio:              m.financialRatios?.psRatio,
          roe:                  m.financialRatios?.roe,
          debtToEquity:         m.financialRatios?.debtToEquity,
          dividendYield:        m.dividend?.dividendYieldPercent,
          eps:                  m.eps?.eps,
          annualizedVolatility: m.volatility?.annualizedVolatility,
          sector:               m.sector?.sector,
          industry:             m.sector?.industry,
          revenueGrowth:        m.sales?.revenueGrowthPercent
        };
        context.contextDescriptions.push(`Datos de mercado cargados desde ${d.metadata.sourceId}.`);
      }
    } catch {
      context.contextDescriptions.push("No se pudo cargar datos de mercado en tiempo real.");
    }

    if (!this.supabaseClient) return context;

    const [fundamentals, strategy, history] = await Promise.all([
      this.fetchFundamentals(ticker),
      this.fetchStrategySummary(ticker),
      userId ? this.fetchUserHistory(userId, ticker) : Promise.resolve([])
    ]);

    if (fundamentals) {
      context.viabilityScore = fundamentals.viability_score;
      context.viabilityJustification = fundamentals.justification;
      context.contextDescriptions.push("Loaded company fundamentals from Supabase.");
    }
    if (strategy) {
      context.strategySummary = strategy.summary;
      context.contextDescriptions.push("Loaded strategy evaluation summary from Supabase.");
    }
    if (history.length > 0) {
      context.recentUserAnalysis = history;
      context.contextDescriptions.push("Loaded recent user analysis history from Supabase.");
    }

    return context;
  }

  private async fetchFundamentals(ticker: string): Promise<{ viability_score?: number; justification?: string } | null> {
    try {
      const { data, error } = await this.supabaseClient!
        .from("company_fundamentals")
        .select("ticker, viability_score, justification")
        .eq("ticker", ticker)
        .maybeSingle();
      if (error) return null;
      return data as { viability_score?: number; justification?: string } | null;
    } catch { return null; }
  }

  private async fetchStrategySummary(ticker: string): Promise<{ summary?: string } | null> {
    try {
      const { data, error } = await this.supabaseClient!
        .from("strategy_evaluations")
        .select("ticker, summary")
        .eq("ticker", ticker)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as { summary?: string } | null;
    } catch { return null; }
  }

  private async fetchUserHistory(userId: string, ticker: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabaseClient!
        .from("user_analysis_history")
        .select("interaction_summary")
        .eq("user_id", userId)
        .eq("ticker", ticker)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error || !data) return [];
      return (data as Array<{ interaction_summary?: string }>)
        .filter((item) => typeof item.interaction_summary === "string")
        .map((item) => item.interaction_summary as string);
    } catch { return []; }
  }

  private async logChatInteraction(userId: string | undefined, ticker: string, exchangeCount: number): Promise<void> {
    if (!this.supabaseClient) return;
    try {
      await this.supabaseClient.from("chat_audit").insert([{
        action: "chat_message",
        user_id: userId ?? null,
        ticker,
        exchange_count: exchangeCount,
        timestamp: new Date().toISOString()
      }]);
    } catch { /* no fail */ }
  }
}
