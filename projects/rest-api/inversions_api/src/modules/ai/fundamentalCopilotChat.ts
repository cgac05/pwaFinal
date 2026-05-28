import type { SupabaseClient } from "@supabase/supabase-js";
import { FundamentalDataService } from "../fundamental/fundamentalDataService";
import { analyzeFundamental } from "../fundamental/fundamentalAnalyzer";
import type { FundamentalAnalysisResult, MetricSection } from "../fundamental/fundamentalAnalyzer";
import type { FundamentalAnalysisData } from "../fundamental/fundamentalSourceContract";

export interface CopilotChatRequest {
  ticker: string;
  question: string;
  userId?: string;
  simulationContext?: CopilotSimulationContext;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface CopilotChatResponse {
  answer: string;
  sourceContext: string[];
  disclaimer: string;
  reasoningTrace: string[];
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

const DISCLAIMER = "Este análisis es informativo y educativo. No constituye asesoramiento financiero ni recomendación de inversión. Consulta a un profesional antes de tomar decisiones financieras.";

const ALL_METRICS = ["Valoración", "Crecimiento", "Rentabilidad", "Salud Financiera", "Flujo de Caja", "Riesgo", "Ventaja Competitiva"];

export class FundamentalCopilotChat {
  private readonly fundamentalService: FundamentalDataService;

  constructor(private readonly supabaseClient?: SupabaseClient) {
    this.fundamentalService = new FundamentalDataService(supabaseClient);
  }

  async generateResponse(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const ticker = request.ticker.toUpperCase();
    const reasoningTrace: string[] = [];

    let result: FundamentalAnalysisResult | null = null;
    let rawData: FundamentalAnalysisData | null = null;

    try {
      const fetched = await this.fundamentalService.fetch(ticker, 252);
      if (fetched.success && fetched.data) {
        rawData = fetched.data;
        result = await analyzeFundamental(fetched.data, {
          investmentProfile: "Quality",
          horizon: "Mediano plazo",
          selectedMetrics: ALL_METRICS,
          strategy: request.simulationContext?.strategy ?? "Long Call",
          comparisons: [],
          projectionFrom: request.simulationContext?.projectionFrom,
          projectionTo: request.simulationContext?.projectionTo
        });
        reasoningTrace.push(`Datos obtenidos de ${fetched.data.metadata.sourceId.toUpperCase()}`);
        reasoningTrace.push(`Score calculado: ${result.overallScore}/100 → ${result.verdict}`);
        reasoningTrace.push(`Métricas analizadas: ${result.sections.map((s) => s.metric).join(", ")}`);
      }
    } catch (err) {
      reasoningTrace.push(`Error al obtener datos: ${String(err)}`);
    }

    if (!result || !rawData) {
      const answer = `No se pudieron obtener datos de mercado para **${ticker}**. Verifica que el símbolo sea correcto (ej: AAPL, MSFT, NVDA) e intenta de nuevo.\n\n*${DISCLAIMER}*`;
      return { answer, sourceContext: [], disclaimer: DISCLAIMER, reasoningTrace };
    }

    const answer = this.buildAnswer(request.question, result, rawData, request.conversationHistory ?? []);

    await this.saveInteractionSummary(request.userId, ticker, request.question, answer);

    return {
      answer,
      sourceContext: [
        `${result.ticker} — ${result.verdict} (${result.overallScore}/100)`,
        `Fuente: ${result.sourceId.toUpperCase()}`,
        `Estrategia: ${result.projection.strategy}`,
        `Métricas: ${result.sections.length} analizadas`
      ],
      disclaimer: DISCLAIMER,
      reasoningTrace
    };
  }

  // ---------------------------------------------------------------------------
  // Generador de respuesta conversacional
  // ---------------------------------------------------------------------------

  private buildAnswer(
    question: string,
    result: FundamentalAnalysisResult,
    rawData: FundamentalAnalysisData,
    history: Array<{ role: string; content: string }>
  ): string {
    const proj = result.projection;
    const ticker = result.ticker;
    const sections = result.sections;
    const q = question.trim();
    const m = rawData.metrics;

    // ── Datos base del análisis ────────────────────────────────────────────
    const vol        = sections.find((s) => s.metric === "Riesgo")?.score ?? 50;
    const volPct     = (m.volatility?.annualizedVolatility ?? 0).toFixed(1) + "%";
    const isHighVol  = vol < 40;
    const isViable   = result.overallScore >= 65;
    const isNeutral  = result.overallScore >= 40 && result.overallScore < 65;
    const isBearish  = result.overallScore < 40;

    const topMetrics    = [...sections].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50)).slice(0, 3);
    const weakMetrics   = sections.filter((s) => s.score < 40);
    const strongMetrics = sections.filter((s) => s.score >= 65);

    const strategyName  = proj.strategy;
    const strategyLower = strategyName.toLowerCase();

    // ── Detección de tipo de pregunta ─────────────────────────────────────
    const isFundamentalAnalysis = /an[aá]li[sz]|dame (el|un)|mu[eé]strame|overview|resumen ejecutivo|c[oó]mo est[aá]|qu[eé] tal (est[aá]|es)|cu[eé]ntame (sobre|de)|eval[uú][ao]|valoraci[oó]n general|informe|reporte|diagnos/i.test(q)
      || /^(an[aá]li[sz]a|evalú[ao]|rev[ií]sa|estudia)\b/i.test(q)
      || (q.length < 25 && /^(AAPL|MSFT|NVDA|TSLA|AMZN|SPY|GOOG|META|NFLX|[A-Z]{1,5})(\s+(pls|please|favor))?$/i.test(q));

    const isYesNoAboutStrategy  = !isFundamentalAnalysis && /recomend|conviene|deber[íi]a|vale la pena|sirve|usar (short|long|call|put)|mejor usar|qu[eé] (short|long|call|put)/i.test(q);
    const isYesNoShortCall      = isYesNoAboutStrategy && /short call/i.test(q);
    const isYesNoLongCall       = isYesNoAboutStrategy && /long call/i.test(q);
    const isYesNoShortPut       = isYesNoAboutStrategy && /short put/i.test(q);
    const isYesNoLongPut        = isYesNoAboutStrategy && /long put/i.test(q);
    const isConfirmation        = !isFundamentalAnalysis && /^(entonces|o sea|es decir|quer[eé]s? decir|entonces no|entonces s[íi]|no\?|s[íi]\?|correcto\?|ok\?|y\s+eso|y\s+si|pero)/i.test(q);
    const isWhy                 = !isFundamentalAnalysis && /por\s?qu[eé]|razones?|motivo|qu[eé] lo hace|c[oó]mo lleg/i.test(q);
    const isRisks               = !isFundamentalAnalysis && /riesgo|p[eé]rdida|escenario|perder|pierde|atm|\+5|[\-−]5|breakeven/i.test(q);
    const isChanges             = !isFundamentalAnalysis && /cambiar[íi]a|cambio|ca[íi]da fuerte|subida fuerte|earnings|miss|beat|volatilidad.*sube|rotar|cu[aá]ndo cambia/i.test(q);
    const isCalc                = !isFundamentalAnalysis && /c[oó]mo.*calcul|formula|pasos|c[aá]lculo/i.test(q);
    const isMetricDetail        = !isFundamentalAnalysis && /p\/e|roe|deuda|beta|eps|ventas|crecimiento|rentabilidad|flujo|valoraci/i.test(q);
    const isComparison          = !isFundamentalAnalysis && /diferencia|comparar|mejor.*entre|long.*vs.*short|call.*vs.*put|cu[aá]l es mejor/i.test(q);

    const lines: string[] = [];

    // ══════════════════════════════════════════════════════════════════════
    // 0. ANÁLISIS FUNDAMENTAL COMPLETO — Bloomberg / Morningstar style
    // ══════════════════════════════════════════════════════════════════════
    if (isFundamentalAnalysis) {
      return this.buildFullFundamentalAnalysis(result, rawData);
    }

    // ══════════════════════════════════════════════════════════════════════
    // 1. Pregunta directa sobre una estrategia específica → YES/NO + razón
    // ══════════════════════════════════════════════════════════════════════
    if (isYesNoAboutStrategy) {

      if (isYesNoShortCall) {
        const recommend = !isViable && isHighVol;
        lines.push(recommend
          ? `Con ${ticker} en ${result.verdict} (${result.overallScore}/100) y volatilidad ${isHighVol ? "alta" : "baja"}, una **Short Call** podría tener sentido para cobrar prima.`
          : `**No es la estrategia más recomendada** para ${ticker} en este momento.`
        );
        lines.push("");
        if (!recommend) {
          lines.push(`Razones por las que el Short Call tiene desventajas aquí:`);
          if (!isHighVol) lines.push(`- Volatilidad baja (${volPct}) → prima cobrada es pequeña, no justifica el riesgo de pérdida ilimitada si el precio sube.`);
          if (isViable || isNeutral) lines.push(`- Score ${result.overallScore}/100 (${result.verdict}) → los fundamentales no descartan alza. Short Call tiene pérdida ilimitada si el precio supera $${proj.breakeven}.`);
          lines.push(`- ${ticker} cotiza a $${proj.initialPrice}. Si sube a $${proj.breakeven} (breakeven), la pérdida por contrato empieza a crecer sin límite.`);
        } else {
          lines.push(`Aplica si crees que el precio se mantiene por debajo de $${proj.breakeven} hasta ${proj.projectionTo}.`);
          lines.push(`Prima cobrada: $${proj.premium}/acción ($${(proj.premium * 100).toFixed(0)}/contrato).`);
          lines.push(`Riesgo: pérdida ilimitada si el precio supera $${proj.breakeven}.`);
        }

      } else if (isYesNoLongCall) {
        const recommend = isViable || isNeutral;
        lines.push(recommend
          ? `**Long Call es razonable** para ${ticker} con score ${result.overallScore}/100 (${result.verdict}).`
          : `**Long Call tiene desventajas** en el contexto actual de ${ticker} (${result.verdict}, ${result.overallScore}/100).`
        );
        lines.push("");
        lines.push(`Strike: $${proj.strike} | Prima: $${proj.premium}/acc | Breakeven: $${proj.breakeven}`);
        lines.push(`Para ser rentable, el precio debe superar **$${proj.breakeven}** antes del ${proj.projectionTo}.`);
        lines.push(`Movimiento esperado según volatilidad: ±$${proj.expectedMove} (±${proj.expectedMovePercent}%)`);
        if (!recommend) {
          lines.push("");
          lines.push(`Con score ${result.overallScore}/100 los fundamentales sugieren cautela. El riesgo es perder toda la prima ($${(proj.premium * 100).toFixed(0)}/contrato) si el precio no alcanza el breakeven.`);
        }

      } else if (isYesNoShortPut) {
        const recommend = isViable || isNeutral;
        lines.push(recommend
          ? `**Short Put puede tener sentido** si estás dispuesto a comprar ${ticker} al precio de asignación.`
          : `**Short Put tiene riesgo elevado** con ${ticker} en ${result.verdict}.`
        );
        lines.push("");
        lines.push(`Cobras: $${proj.premium}/acc ($${(proj.premium * 100).toFixed(0)}/contrato)`);
        lines.push(`Breakeven: $${proj.breakeven} | Pérdida máxima: $${typeof proj.maxLoss === "number" ? proj.maxLoss : "calculada al vencimiento"}`);
        lines.push(recommend
          ? `Si el precio cae bajo $${proj.breakeven}, recibirías las acciones a ese precio efectivo. Útil si quieres entrar a ${ticker} con descuento.`
          : `Con fundamentales débiles, recibir las acciones podría no ser deseable si el precio sigue cayendo.`
        );

      } else if (isYesNoLongPut) {
        const recommend = isBearish || weakMetrics.length >= 2;
        lines.push(recommend
          ? `**Long Put aplica** si hay catalizadores bajistas concretos para ${ticker}.`
          : `**Long Put va contra el sesgo actual** de ${ticker} (${result.verdict}, ${result.overallScore}/100).`
        );
        lines.push("");
        lines.push(`Costo: $${proj.premium}/acc ($${(proj.premium * 100).toFixed(0)}/contrato)`);
        lines.push(`Breakeven: $${proj.breakeven} | Ganancia máxima si el precio cae a $0: $${typeof proj.maxProfit === "number" ? proj.maxProfit : "ilimitada"}`);
        if (!recommend) {
          lines.push(`Con ${strongMetrics.length} métricas fuertes (${strongMetrics.map((s) => s.metric).join(", ")}), una caída fuerte no está respaldada por los fundamentales actuales.`);
        }

      } else {
        lines.push(`Con ${ticker} en **${result.verdict} (${result.overallScore}/100)** y volatilidad ${isHighVol ? "alta" : "baja"}:`);
        lines.push("");
        if (isViable) {
          lines.push(`- **Long Call**: alineada con los fundamentales alcistas. Breakeven: $${proj.breakeven}, costo: $${(proj.premium * 100).toFixed(0)}/contrato.`);
          lines.push(`- **Short Put**: cobras prima ($${(proj.premium * 100).toFixed(0)}/contrato) y entras a las acciones si cae al strike.`);
        } else if (isNeutral) {
          lines.push(`- **Short Put o Short Call**: vol ${isHighVol ? "alta" : "moderada"} permite cobrar prima mientras el mercado decide dirección.`);
          lines.push(`- **Long Call**: solo si hay catalizador alcista claro próximo (earnings, lanzamiento de producto).`);
        } else {
          lines.push(`- **Long Put**: alineada con fundamentales débiles. Breakeven: $${proj.breakeven}.`);
          lines.push(`- **Short Call**: cobra prima si el precio se mantiene estancado o baja.`);
        }
      }

    // ══════════════════════════════════════════════════════════════════════
    // 2. Confirmación / follow-up conversacional
    // ══════════════════════════════════════════════════════════════════════
    } else if (isConfirmation) {
      const lastBot = [...history].reverse().find((h) => h.role === "assistant");
      const lastWasAboutShortCall = lastBot?.content.toLowerCase().includes("short call");
      const lastWasAboutLongCall  = lastBot?.content.toLowerCase().includes("long call");

      if (lastWasAboutShortCall) {
        lines.push(`Exacto. El **Short Call** tiene riesgo de pérdida ilimitada si ${ticker} sube por encima de $${proj.breakeven}.`);
        lines.push(`Con score ${result.overallScore}/100 (${result.verdict}) y precio en $${proj.initialPrice}, los fundamentales no descartan ese movimiento alcista, lo que hace el Short Call especialmente arriesgado aquí.`);
        lines.push("");
        lines.push(`La alternativa más conservadora sería **Short Put** (pérdida máxima conocida: $${typeof proj.maxLoss === "number" ? proj.maxLoss : "calculada"}) si quieres vender prima con riesgo acotado.`);
      } else if (lastWasAboutLongCall) {
        lines.push(`Sí. El **Long Call** es viable si estás dispuesto a pagar la prima ($${(proj.premium * 100).toFixed(0)}/contrato) y el precio supera $${proj.breakeven} antes del ${proj.projectionTo}.`);
        lines.push(`El riesgo máximo está limitado a lo que pagas: $${(proj.premium * 100).toFixed(0)} por contrato.`);
      } else {
        lines.push(`Correcto. Con ${ticker} en **${result.verdict} (${result.overallScore}/100)**, el análisis apunta a:`);
        lines.push(`- ${topMetrics[0]?.metric}: ${topMetrics[0]?.finding} (score ${topMetrics[0]?.score}/100)`);
        if (topMetrics[1]) lines.push(`- ${topMetrics[1]?.metric}: ${topMetrics[1]?.finding} (score ${topMetrics[1]?.score}/100)`);
        lines.push(`¿Quieres profundizar en algún aspecto específico?`);
      }

    // ══════════════════════════════════════════════════════════════════════
    // 3. Por qué el veredicto
    // ══════════════════════════════════════════════════════════════════════
    } else if (isWhy) {
      const thresholdText = isViable
        ? `supera el umbral de VIABLE (≥65)`
        : isNeutral
          ? `está en zona neutral (40–64), clasificado como NEUTRAL`
          : `no alcanza el mínimo de viabilidad (40), clasificado como NO VIABLE`;

      lines.push(`**${ticker} es ${result.verdict} con ${result.overallScore}/100** — ${thresholdText}.`);
      lines.push("");
      lines.push("Métricas con mayor peso en este resultado:");
      topMetrics.forEach((s) => {
        const delta = s.score - 50;
        const impact = delta > 0 ? `empuja el score hacia arriba (+${delta}pts)` : `arrastra el score hacia abajo (${delta}pts)`;
        lines.push(`- **${s.metric}** (${s.score}/100): ${s.finding} — ${impact}`);
      });
      lines.push("");
      lines.push("Razones fundamentales clave:");
      proj.drivers.forEach((d) => lines.push(`- ${d}`));

    // ══════════════════════════════════════════════════════════════════════
    // 4. Riesgos y escenarios
    // ══════════════════════════════════════════════════════════════════════
    } else if (isRisks) {
      lines.push(`**Riesgos de ${strategyName} en ${ticker}:**`);
      lines.push("");
      lines.push(`Strike: $${proj.strike} | Prima: $${proj.premium}/acc | Breakeven: $${proj.breakeven}`);
      lines.push(`Pérdida máxima: ${typeof proj.maxLoss === "number" ? `$${proj.maxLoss}` : proj.maxLoss}`);
      lines.push(`Ganancia máxima: ${typeof proj.maxProfit === "number" ? `$${proj.maxProfit}` : proj.maxProfit}`);
      lines.push("");
      lines.push("Escenarios:");
      proj.scenarios.forEach((s) => {
        const sign = s.profitLoss >= 0 ? "+" : "";
        lines.push(`- **${s.label}** (precio $${s.price}): P&L ${sign}$${s.profitLoss}`);
      });

    // ══════════════════════════════════════════════════════════════════════
    // 5. Qué cambiaría la opinión
    // ══════════════════════════════════════════════════════════════════════
    } else if (isChanges) {
      lines.push(`**Qué podría cambiar el veredicto de ${result.verdict}:**`);
      proj.changeTriggers.forEach((t) => lines.push(`- ${t}`));
      lines.push("");
      if (weakMetrics.length > 0) {
        lines.push(`Métricas ya en zona débil (riesgo de bajar el score): ${weakMetrics.map((s) => `${s.metric} (${s.score}/100)`).join(", ")}`);
      }
      if (strongMetrics.length > 0) {
        lines.push(`Métricas que sostienen el score actual: ${strongMetrics.map((s) => `${s.metric} (${s.score}/100)`).join(", ")}`);
      }

    // ══════════════════════════════════════════════════════════════════════
    // 6. Cómo se calculó
    // ══════════════════════════════════════════════════════════════════════
    } else if (isCalc) {
      lines.push("**Cómo se calculó el score y la proyección:**");
      proj.calculationSteps.forEach((s) => lines.push(`- ${s}`));
      lines.push("");
      const avg = sections.reduce((a, s) => a + s.score, 0) / sections.length;
      lines.push(`Desglose de scores: ${sections.map((s) => `${s.metric} ${s.score}`).join(" | ")}`);
      lines.push(`Promedio: ${avg.toFixed(1)} → **${result.overallScore}/100**`);

    // ══════════════════════════════════════════════════════════════════════
    // 7. Métrica específica
    // ══════════════════════════════════════════════════════════════════════
    } else if (isMetricDetail) {
      lines.push(`**Métricas de ${ticker}:**`);
      sections.forEach((s) => {
        const arrow = s.tipoSenal === "CALL" ? "↑" : s.tipoSenal === "PUT" ? "↓" : "→";
        lines.push(`- **${s.metric}** ${arrow} ${s.score}/100: ${s.finding}`);
      });

    // ══════════════════════════════════════════════════════════════════════
    // 8. Comparación entre estrategias
    // ══════════════════════════════════════════════════════════════════════
    } else if (isComparison) {
      lines.push(`Comparativa para ${ticker} (${result.verdict}, ${result.overallScore}/100, vol ${volPct}):`);
      lines.push("");
      lines.push(`| Estrategia | Costo/Beneficio | Riesgo máx | Breakeven | Cuándo aplica |`);
      lines.push(`|------------|-----------------|-----------|-----------|---------------|`);
      lines.push(`| Long Call  | Paga $${(proj.premium * 100).toFixed(0)}/contrato | $${(proj.premium * 100).toFixed(0)} | $${proj.breakeven} | Alza fuerte esperada |`);
      lines.push(`| Long Put   | Paga $${(proj.premium * 100).toFixed(0)}/contrato | $${(proj.premium * 100).toFixed(0)} | $${proj.breakeven} | Caída fuerte esperada |`);
      lines.push(`| Short Call | Cobra $${(proj.premium * 100).toFixed(0)}/contrato | Ilimitado ⚠ | $${proj.breakeven} | Precio estancado o baja |`);
      lines.push(`| Short Put  | Cobra $${(proj.premium * 100).toFixed(0)}/contrato | $${typeof proj.maxLoss === "number" ? proj.maxLoss : "alto"} | $${proj.breakeven} | Vol alta; acepta asignación |`);
      lines.push("");
      lines.push(`Con score ${result.overallScore}/100 (${result.verdict}) y vol ${isHighVol ? "alta → favorece vender prima (Short)" : "baja → favorece comprar opciones (Long)"}:`);
      if (isViable)   lines.push(`→ Long Call o Short Put son las más alineadas con los fundamentales.`);
      if (isNeutral)  lines.push(`→ Short Put o Short Call dan prima cobrada mientras el mercado decide.`);
      if (isBearish)  lines.push(`→ Long Put o Short Call están más alineadas con la debilidad fundamental.`);

    // ══════════════════════════════════════════════════════════════════════
    // 9. Pregunta general → resumen conciso
    // ══════════════════════════════════════════════════════════════════════
    } else {
      lines.push(`**${result.companyName} (${ticker}) — ${result.verdict} | Score ${result.overallScore}/100**`);
      lines.push(result.recommendation);
      lines.push("");
      lines.push(`Estrategia activa: ${proj.strategy} | Strike $${proj.strike} | Breakeven $${proj.breakeven} | Prima $${proj.premium}/acc`);
      lines.push("");
      lines.push("Métricas destacadas:");
      topMetrics.forEach((s) => lines.push(`- ${s.metric}: ${s.score}/100 — ${s.finding}`));
    }

    lines.push("");
    lines.push(`*${DISCLAIMER}*`);
    return lines.join("\n");
  }

  // ---------------------------------------------------------------------------
  // Análisis Fundamental Completo — estilo Bloomberg / Morningstar
  // ---------------------------------------------------------------------------

  private buildFullFundamentalAnalysis(
    result: FundamentalAnalysisResult,
    rawData: FundamentalAnalysisData
  ): string {
    const m   = rawData.metrics;
    const proj = result.projection;
    const sections = result.sections;
    const ticker = result.ticker;

    // ── Métricas brutas ─────────────────────────────────────────────────
    const price       = m.priceHistory?.currentPrice ?? 0;
    const high52      = m.priceHistory?.priceHigh52Week ?? 0;
    const low52       = m.priceHistory?.priceLow52Week ?? 0;
    const change52    = m.priceHistory?.priceChange52WeekPercent ?? 0;
    const volume      = m.priceHistory?.avgVolume10Day ?? 0;
    const mcap        = m.marketCap?.value ?? 0;
    const volAnnual   = m.volatility?.annualizedVolatility ?? 0;
    const beta        = m.beta?.value ?? 1;
    const pe          = m.financialRatios?.peRatio ?? 0;
    const pb          = m.financialRatios?.pbRatio ?? 0;
    const ps          = m.financialRatios?.psRatio ?? 0;
    const roe         = m.financialRatios?.roe ?? 0;
    const deRatio     = m.financialRatios?.debtToEquity ?? 0;
    const eps         = m.eps?.eps ?? 0;
    const epsGrowth   = m.eps?.epsGrowthYoYPercent ?? 0;
    const revAnnual   = m.sales?.annualRevenue ?? 0;
    const revGrowth   = m.sales?.revenueGrowthPercent ?? 0;
    const divYield    = m.dividend?.dividendYieldPercent ?? 0;
    const divAnnual   = m.dividend?.annualDividendPerShare ?? 0;
    const payoutRatio = m.dividend?.payoutRatio ?? 0;
    const sector      = m.sector?.sector ?? "N/D";
    const industry    = m.sector?.industry ?? "N/D";

    // ── Derivaciones ────────────────────────────────────────────────────
    const score = result.overallScore;
    const verdict = result.verdict;

    const recommendation = score >= 65 ? "BUY" : score >= 40 ? "HOLD" : "SELL";

    const callCount  = sections.filter((s) => s.tipoSenal === "CALL").length;
    const holdCount  = sections.filter((s) => s.tipoSenal === "HOLD").length;
    const putCount   = sections.filter((s) => s.tipoSenal === "PUT").length;
    const total      = sections.length || 1;

    const confidence = callCount / total >= 0.6 || putCount / total >= 0.6
      ? "Alto"
      : holdCount / total >= 0.5 ? "Medio" : "Moderado";

    const riskLevel = (volAnnual > 35 || beta > 1.5)
      ? "Alto"
      : (volAnnual > 20 || beta > 1.1) ? "Moderado" : "Bajo";

    const horizonStr = proj.days > 180 ? "Largo plazo (>6 meses)" : proj.days > 60 ? "Mediano plazo (2-6 meses)" : "Corto plazo (<2 meses)";

    // Infra/sobre valoración por P/E
    const valuationJudge = pe <= 0
      ? "Sin datos de P/E disponibles"
      : pe < 12 ? "Posiblemente infravalorada frente al mercado general"
      : pe < 22 ? "Valuación moderada, en línea con el mercado"
      : pe < 35 ? "Prima de valuación — el mercado descuenta crecimiento futuro"
      : "Sobrevalorada respecto a referencias históricas (P/E >35)";

    // Moat assessment
    const moatScore = sections.find((s) => s.metric === "Ventaja Competitiva")?.score ?? 50;
    const moatVerdict = moatScore >= 70 ? "Moat amplio" : moatScore >= 50 ? "Moat moderado" : "Moat limitado o ausente";

    // Strong / weak
    const strongMetrics = [...sections].filter((s) => s.score >= 65).sort((a, b) => b.score - a.score);
    const weakMetrics   = [...sections].filter((s) => s.score < 40).sort((a, b) => a.score - b.score);
    const callSections  = sections.filter((s) => s.tipoSenal === "CALL");
    const putSections   = sections.filter((s) => s.tipoSenal === "PUT");

    // ── Interpretaciones narrativas ──────────────────────────────────────
    const peInterpret = pe <= 0 ? "No disponible"
      : pe < 15 ? `P/E de ${pe.toFixed(1)}x — empresa cotiza con descuento frente al mercado. Puede indicar infravaloración o expectativas de crecimiento moderado.`
      : pe < 25 ? `P/E de ${pe.toFixed(1)}x — valuación razonable para una empresa con fundamentales sólidos.`
      : pe < 40 ? `P/E de ${pe.toFixed(1)}x — el mercado paga prima por este activo. Justificado si el crecimiento de EPS es sostenible.`
      : `P/E de ${pe.toFixed(1)}x — valuación elevada. Requiere crecimiento de EPS acelerado para sostenerse.`;

    const pbInterpret = pb <= 0 ? "" : pb < 1.5 ? `P/B de ${pb.toFixed(1)}x — cotiza cerca del valor en libros, posible oportunidad de valor.`
      : pb < 4 ? `P/B de ${pb.toFixed(1)}x — estándar para empresas con activos intangibles importantes.`
      : `P/B de ${pb.toFixed(1)}x — prima significativa sobre activos en libros.`;

    const roeInterpret = roe <= 0 ? "ROE negativo — la empresa destruye valor para el accionista en este período."
      : roe < 10 ? `ROE del ${roe.toFixed(1)}% — rentabilidad del patrimonio modesta. Industrias de capital intensivo típicamente operan en este rango.`
      : roe < 20 ? `ROE del ${roe.toFixed(1)}% — rentabilidad sólida, empresa genera buen retorno sobre el capital invertido.`
      : `ROE del ${roe.toFixed(1)}% — excelente eficiencia en el uso del capital del accionista. Señal de ventaja competitiva duradera.`;

    const deInterpret = deRatio < 0.3 ? `D/E de ${deRatio.toFixed(2)} — balance extremadamente conservador. La empresa opera casi sin deuda.`
      : deRatio < 0.8 ? `D/E de ${deRatio.toFixed(2)} — apalancamiento moderado, manejable para la mayoría de sectores.`
      : deRatio < 2.0 ? `D/E de ${deRatio.toFixed(2)} — deuda significativa. Monitorear cobertura de intereses y flujo de caja libre.`
      : `D/E de ${deRatio.toFixed(2)} — alto apalancamiento. Riesgo financiero elevado si los ingresos se deterioran.`;

    const epsGrowthInterpret = epsGrowth > 25 ? `Crecimiento de EPS del ${epsGrowth.toFixed(1)}% YoY — expansión acelerada de utilidades, poco común y muy positivo.`
      : epsGrowth > 10 ? `Crecimiento de EPS del ${epsGrowth.toFixed(1)}% YoY — trayectoria de crecimiento saludable y sostenible.`
      : epsGrowth > 0 ? `Crecimiento de EPS del ${epsGrowth.toFixed(1)}% YoY — crecimiento positivo pero moderado.`
      : `Contracción de EPS del ${Math.abs(epsGrowth).toFixed(1)}% YoY — las utilidades se están comprimiendo, señal de alerta.`;

    const revGrowthInterpret = revGrowth > 20 ? `Crecimiento de ingresos del ${revGrowth.toFixed(1)}% — expansión del top-line por encima de la industria.`
      : revGrowth > 8 ? `Crecimiento de ingresos del ${revGrowth.toFixed(1)}% — momentum de ventas saludable.`
      : revGrowth > 0 ? `Crecimiento de ingresos del ${revGrowth.toFixed(1)}% — crecimiento modesto de la línea superior.`
      : `Caída de ingresos del ${Math.abs(revGrowth).toFixed(1)}% — contracción del top-line, requiere atención.`;

    const betaInterpret = beta < 0.7 ? `Beta de ${beta.toFixed(2)} — activo defensivo, oscila menos que el mercado.`
      : beta < 1.1 ? `Beta de ${beta.toFixed(2)} — comportamiento cercano al mercado general.`
      : beta < 1.5 ? `Beta de ${beta.toFixed(2)} — más volátil que el índice, amplifica movimientos del mercado.`
      : `Beta de ${beta.toFixed(2)} — activo de alta volatilidad sistémica. Mayor potencial de ganancia y pérdida.`;

    // Comparación sector (aproximada con benchmarks generales)
    const sectorPEBenchmark: Record<string, number> = {
      Technology: 28, "Financial Services": 15, Healthcare: 22, "Consumer Cyclical": 20,
      Energy: 12, Utilities: 18, "Communication Services": 24, "Real Estate": 25,
      "Consumer Defensive": 20, Industrials: 20, "Basic Materials": 14
    };
    const benchmarkPE = sectorPEBenchmark[sector] ?? 20;
    const vsSectorStr = pe > 0
      ? pe > benchmarkPE * 1.2
        ? `P/E de ${pe.toFixed(1)}x es ${((pe / benchmarkPE - 1) * 100).toFixed(0)}% superior al promedio del sector ${sector} (~${benchmarkPE}x) — prima de valuación vs. pares.`
        : pe < benchmarkPE * 0.8
          ? `P/E de ${pe.toFixed(1)}x es ${((1 - pe / benchmarkPE) * 100).toFixed(0)}% inferior al promedio del sector ${sector} (~${benchmarkPE}x) — posible descuento vs. pares.`
          : `P/E de ${pe.toFixed(1)}x alineado con el promedio del sector ${sector} (~${benchmarkPE}x).`
      : `Sin P/E para comparar con el sector ${sector}.`;

    // ── Construcción del reporte ─────────────────────────────────────────
    const lines: string[] = [];

    lines.push(`# ${result.companyName} (${ticker}) — Análisis Fundamental Institucional`);
    lines.push(`*Fuente: ${result.sourceId.toUpperCase()} | Sector: ${sector} | Industria: ${industry} | Período: ${proj.projectionFrom} → ${proj.projectionTo}*`);
    lines.push("");

    // VEREDICTO
    lines.push("## VEREDICTO GENERAL");
    lines.push(`| Campo | Valor |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Recomendación | **${recommendation}** |`);
    lines.push(`| Score general | **${score}/100** (${verdict}) |`);
    lines.push(`| Nivel de confianza | ${confidence} (${callCount} CALL / ${holdCount} HOLD / ${putCount} PUT de ${total} métricas) |`);
    lines.push(`| Nivel de riesgo | ${riskLevel} — Vol. anual ${volAnnual.toFixed(1)}%, Beta ${beta.toFixed(2)} |`);
    lines.push(`| Horizonte ideal | ${horizonStr} |`);
    lines.push(`| Estrategia evaluada | ${proj.strategy} |`);
    lines.push(`| Valuación | ${valuationJudge} |`);
    lines.push(`| Ventaja competitiva | ${moatVerdict} (score ${moatScore}/100) |`);
    lines.push("");

    // DATOS DE MERCADO
    lines.push("## DATOS DE MERCADO");
    lines.push(`Precio actual: **$${price.toFixed(2)}** | Rango 52 sem: $${low52.toFixed(2)} – $${high52.toFixed(2)} | Cambio 52 sem: ${change52 >= 0 ? "+" : ""}${change52.toFixed(1)}%`);
    if (mcap > 0) lines.push(`Market Cap: **$${(mcap / 1e9).toFixed(2)}B** | Vol. promedio 10d: ${volume > 0 ? (volume / 1e6).toFixed(2) + "M acciones" : "N/D"}`);
    if (divAnnual > 0) lines.push(`Dividendo: $${divAnnual.toFixed(2)}/acc/año (Yield ${divYield.toFixed(2)}%) | Payout Ratio: ${payoutRatio.toFixed(0)}%`);
    lines.push("");

    // RESUMEN EJECUTIVO
    lines.push("## RESUMEN EJECUTIVO");
    const execParagraph = this.buildExecutiveSummary(result, rawData, recommendation, confidence, riskLevel);
    lines.push(execParagraph);
    lines.push("");

    // ANÁLISIS DE VALUACIÓN
    lines.push("## ANÁLISIS DE VALUACIÓN");
    lines.push(peInterpret);
    if (pbInterpret) lines.push(pbInterpret);
    if (ps > 0) lines.push(`P/S de ${ps.toFixed(1)}x — ${ps < 3 ? "el mercado paga menos de 3x por cada dólar de ingresos, valuación contenida." : ps < 8 ? "prima moderada sobre ventas." : "mercado paga una prima significativa sobre ingresos."}`);
    lines.push("");
    lines.push(`**Conclusión de valuación:** ${valuationJudge}`);
    lines.push(`**Sector:** ${vsSectorStr}`);
    lines.push("");

    // ANÁLISIS DE CRECIMIENTO
    lines.push("## ANÁLISIS DE CRECIMIENTO");
    lines.push(epsGrowthInterpret);
    if (revAnnual > 0) lines.push(`Ingresos anuales: $${(revAnnual / 1e9).toFixed(2)}B — ${revGrowthInterpret}`);
    if (eps !== 0) lines.push(`EPS TTM: $${eps.toFixed(2)} — ${eps > 0 ? "empresa genera ganancias por acción positivas." : "empresa registra pérdidas por acción."}`);
    lines.push("");

    // ANÁLISIS DE RENTABILIDAD
    lines.push("## ANÁLISIS DE RENTABILIDAD");
    lines.push(roeInterpret);
    const rentSection = sections.find((s) => s.metric === "Rentabilidad");
    if (rentSection) lines.push(`Score de rentabilidad: ${rentSection.score}/100 (${rentSection.tipoSenal}) — ${rentSection.finding}`);
    lines.push("");

    // SALUD FINANCIERA
    lines.push("## SALUD FINANCIERA Y FLUJO DE CAJA");
    lines.push(deInterpret);
    lines.push(betaInterpret);
    const saludSection = sections.find((s) => s.metric === "Salud Financiera");
    const flujoSection = sections.find((s) => s.metric === "Flujo de Caja");
    if (saludSection) lines.push(`Score salud financiera: ${saludSection.score}/100 — ${saludSection.finding}`);
    if (flujoSection) lines.push(`Score flujo de caja: ${flujoSection.score}/100 — ${flujoSection.finding}`);
    lines.push("");

    // COMPARACIÓN SECTOR
    lines.push("## COMPARACIÓN CONTRA SECTOR E INDUSTRIA");
    lines.push(`Sector: **${sector}** | Industria: **${industry}**`);
    lines.push(vsSectorStr);
    if (roe > 0) {
      const roeBenchmark: Record<string, number> = { Technology: 22, Healthcare: 15, Financials: 12, Energy: 10, Utilities: 8 };
      const benchROE = roeBenchmark[sector] ?? 14;
      lines.push(`ROE del ${roe.toFixed(1)}% vs. promedio sectorial estimado ~${benchROE}% → ${roe > benchROE ? "superior a sus pares." : "por debajo del promedio sectorial."}`);
    }
    lines.push("");

    // FORTALEZAS
    lines.push("## FORTALEZAS PRINCIPALES");
    if (strongMetrics.length > 0) {
      strongMetrics.forEach((s) => lines.push(`- **${s.metric}** (${s.score}/100): ${s.finding}`));
    } else {
      lines.push(`- Score general de ${score}/100 refleja fundamentos estables.`);
      proj.drivers.slice(0, 2).forEach((d) => lines.push(`- ${d}`));
    }
    lines.push("");

    // RIESGOS
    lines.push("## RIESGOS PRINCIPALES");
    if (weakMetrics.length > 0) {
      weakMetrics.forEach((s) => lines.push(`- **${s.metric}** (${s.score}/100, riesgo): ${s.finding}`));
    }
    proj.changeTriggers.slice(0, 3).forEach((t) => lines.push(`- ${t}`));
    lines.push("");

    // SEÑALES POSITIVAS
    lines.push("## SEÑALES POSITIVAS DETECTADAS");
    if (callSections.length > 0) {
      callSections.forEach((s) => lines.push(`- ↑ **${s.metric}**: ${s.finding} — señal CALL`));
    } else {
      lines.push("- Sin señales CALL claras en las métricas actuales.");
    }
    lines.push("");

    // RED FLAGS
    lines.push("## RED FLAGS / SEÑALES NEGATIVAS");
    if (putSections.length > 0) {
      putSections.forEach((s) => lines.push(`- ↓ **${s.metric}**: ${s.finding} — señal PUT`));
    } else {
      lines.push("- Sin señales PUT significativas detectadas.");
    }
    lines.push("");

    // VENTAJAS COMPETITIVAS
    lines.push("## VENTAJAS COMPETITIVAS (MOAT)");
    const moatSection = sections.find((s) => s.metric === "Ventaja Competitiva");
    lines.push(`**${moatVerdict}** — Score ${moatScore}/100`);
    if (moatSection) lines.push(moatSection.finding);
    if (roe >= 20) lines.push(`- ROE del ${roe.toFixed(1)}% sostenido sugiere barreras de entrada o poder de fijación de precios.`);
    if (mcap > 1e11) lines.push(`- Market cap de $${(mcap / 1e9).toFixed(0)}B — economías de escala y reconocimiento de marca como factores diferenciadores.`);
    proj.drivers.slice(0, 2).forEach((d) => lines.push(`- ${d}`));
    lines.push("");

    // CONCLUSIÓN FINAL
    lines.push("## CONCLUSIÓN FINAL");
    lines.push(this.buildConclusion(result, rawData, recommendation, riskLevel, horizonStr));
    lines.push("");
    lines.push(`---`);
    lines.push(`*${DISCLAIMER}*`);

    return lines.join("\n");
  }

  private buildExecutiveSummary(
    result: FundamentalAnalysisResult,
    rawData: FundamentalAnalysisData,
    recommendation: string,
    confidence: string,
    riskLevel: string
  ): string {
    const m = rawData.metrics;
    const ticker = result.ticker;
    const score = result.overallScore;
    const price = m.priceHistory?.currentPrice ?? 0;
    const pe = m.financialRatios?.peRatio ?? 0;
    const roe = m.financialRatios?.roe ?? 0;
    const epsGrowth = m.eps?.epsGrowthYoYPercent ?? 0;
    const vol = m.volatility?.annualizedVolatility ?? 0;
    const sector = m.sector?.sector ?? "su sector";
    const companyName = result.companyName;

    const sentimentWord = recommendation === "BUY" ? "positivo" : recommendation === "SELL" ? "negativo" : "neutral";
    const verdictNarrative = score >= 65
      ? `presenta un perfil fundamental sólido que lo posiciona favorablemente dentro de ${sector}`
      : score >= 40
        ? `muestra un perfil fundamental mixto, con fortalezas compensadas por áreas de riesgo que requieren monitoreo`
        : `refleja debilidades fundamentales que generan precaución ante una posición alcista en este momento`;

    let summary = `${companyName} (${ticker}), cotizando a $${price.toFixed(2)}, ${verdictNarrative}. `;
    summary += `Con un score agregado de ${score}/100 y nivel de confianza ${confidence.toLowerCase()}, el análisis arroja un sesgo fundamental ${sentimentWord}.`;

    if (pe > 0 && roe > 0) {
      summary += ` La empresa opera con un P/E de ${pe.toFixed(1)}x y ROE del ${roe.toFixed(1)}%, parámetros que ${roe >= 15 && pe <= 30 ? "refuerzan el atractivo fundamental" : "presentan un balance que merece atención"}.`;
    }

    if (epsGrowth !== 0) {
      summary += ` El crecimiento de EPS del ${epsGrowth >= 0 ? "+" : ""}${epsGrowth.toFixed(1)}% YoY ${epsGrowth >= 10 ? "es un catalizador positivo para la valoración actual" : epsGrowth >= 0 ? "es modesto pero mantiene una dirección positiva" : "es una señal de alerta que puede presionar múltiplos"}.`;
    }

    summary += ` La volatilidad anualizada del ${vol.toFixed(1)}% define un nivel de riesgo ${riskLevel.toLowerCase()} para el perfil de inversión en el horizonte proyectado.`;

    return summary;
  }

  private buildConclusion(
    result: FundamentalAnalysisResult,
    rawData: FundamentalAnalysisData,
    recommendation: string,
    riskLevel: string,
    horizonStr: string
  ): string {
    const m = rawData.metrics;
    const ticker = result.ticker;
    const score = result.overallScore;
    const proj = result.projection;
    const roe = m.financialRatios?.roe ?? 0;
    const pe = m.financialRatios?.peRatio ?? 0;
    const sections = result.sections;
    const callCount = sections.filter((s) => s.tipoSenal === "CALL").length;
    const total = sections.length || 1;

    let conclusion = `Basado en el análisis de ${total} métricas fundamentales, **${ticker} recibe una recomendación de ${recommendation}** con score ${score}/100. `;

    if (recommendation === "BUY") {
      conclusion += `Los fundamentales respaldan una perspectiva constructiva: ${callCount} de ${total} métricas emiten señal CALL. `;
      if (roe >= 15) conclusion += `El ROE del ${roe.toFixed(1)}% demuestra eficiencia en la generación de valor para el accionista. `;
      conclusion += `La estrategia ${proj.strategy} evaluada tiene un breakeven en $${proj.breakeven}, alcanzable dentro del movimiento esperado de ±${proj.expectedMovePercent.toFixed(1)}%.`;
    } else if (recommendation === "SELL") {
      conclusion += `Las señales fundamentales son predominantemente negativas. Se recomienda cautela ante exposición alcista. `;
      if (pe > 40) conclusion += `El P/E de ${pe.toFixed(1)}x implica un precio que descuenta mucho crecimiento futuro, dejando poco margen de seguridad. `;
      conclusion += `La estrategia ${proj.strategy} evaluada requiere que el precio ${proj.strategy.includes("Call") ? "supere" : "caiga bajo"} $${proj.breakeven} para ser rentable.`;
    } else {
      conclusion += `Las métricas presentan señales mixtas que no justifican una posición direccional agresiva. `;
      conclusion += `Se recomienda monitorear catalizadores como earnings, revisión de guidance o cambios en el contexto macro antes de incrementar exposición. `;
      conclusion += `La estrategia ${proj.strategy} evaluada tiene un horizonte de ${proj.days} días con movimiento esperado de ±${proj.expectedMovePercent.toFixed(1)}%.`;
    }

    conclusion += ` Horizonte ideal de análisis: **${horizonStr}** | Riesgo: **${riskLevel}**.`;
    return conclusion;
  }

  // ---------------------------------------------------------------------------

  private async saveInteractionSummary(userId: string | undefined, ticker: string, question: string, answer: string): Promise<void> {
    if (!this.supabaseClient) return;
    const summary = `Q: ${question.slice(0, 150)} | A: ${answer.slice(0, 250)}`;
    try {
      await this.supabaseClient.from("user_analysis_history").insert([{
        user_id: userId ?? null,
        ticker,
        interaction_summary: summary,
        created_at: new Date().toISOString()
      }]);
    } catch { /* no fail */ }
  }
}

// Legacy export alias for backwards compatibility with existing route imports
export type { CopilotChatRequest as ChatMessage };
