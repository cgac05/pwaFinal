import type { SupabaseClient } from "@supabase/supabase-js";

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
}

export interface CopilotChatResponse {
  answer: string;
  sourceContext: string[];
  disclaimer: string;
  reasoningTrace: string[];
}

interface FundamentalContext {
  ticker: string;
  viabilityScore?: number;
  viabilityJustification?: string;
  strategySummary?: string;
  recentUserAnalysis?: string[];
  contextDescriptions: string[];
}

export class FundamentalCopilotChat {
  constructor(private readonly supabaseClient?: SupabaseClient) {}

  async generateResponse(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const ticker = request.ticker.toUpperCase();
    const reasoningTrace: string[] = [];
    const baseContext = [`Ticker: ${ticker}`, `Question: ${request.question}`];

    const fundamentalContext = await this.buildFundamentalContext(ticker, request.userId);

    if (fundamentalContext.viabilityScore !== undefined) {
      baseContext.push(`Viability score: ${fundamentalContext.viabilityScore}`);
    }
    if (fundamentalContext.strategySummary) {
      baseContext.push(`Strategy summary available`);
    }
    const recentUserAnalysis = fundamentalContext.recentUserAnalysis ?? [];
    if (recentUserAnalysis.length > 0) {
      baseContext.push(`User analysis history available: ${recentUserAnalysis.length} entries`);
    }

    const systemMessage: ChatMessage = {
      role: "system",
      content:
        "Eres un asesor de inversiones explicativo. Tu rol es EXPLICAR análisis fundamental y estrategias de opciones sin ejecutar operaciones ni dar asesoramiento financiero.",
      timestamp: new Date().toISOString(),
      metadata: {
        ticker,
        context_type: "fundamental",
        reasoning_trace: []
      }
    };

    const userMessage: ChatMessage = {
      role: "user",
      content: request.question,
      timestamp: new Date().toISOString(),
      metadata: {
        ticker,
        context_type: "fundamental"
      }
    };

    const prompt = this.buildClaudePrompt(request, fundamentalContext);
    const answer = await this.executeCopilot(prompt, fundamentalContext, reasoningTrace);

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
    if (context.viabilityScore !== undefined) {
      lines.push(`Viability score: ${context.viabilityScore}`);
    }
    if (context.viabilityJustification) {
      lines.push(`Justification: ${context.viabilityJustification}`);
    }
    if (context.strategySummary) {
      lines.push(`Strategy summary: ${context.strategySummary}`);
    }
    const recentUserAnalysis = context.recentUserAnalysis ?? [];
    if (recentUserAnalysis.length > 0) {
      lines.push("Recent user analysis history:");
      recentUserAnalysis.forEach((entry) => {
        lines.push(`- ${entry}`);
      });
    }

    lines.push("");
    lines.push(`Pregunta del usuario: ${request.question}`);
    lines.push("");

    if (request.includeStrategyRecommendation) {
      lines.push("Incluye una recomendación de estrategia basada en el análisis fundamental y las posibilidades de opciones descritas.");
    }

    return lines.join("\n");
  }

  private async executeCopilot(
    prompt: string,
    context: FundamentalContext,
    reasoningTrace: string[]
  ): Promise<string> {
    const claudeAnswer = await this.callClaude(prompt);
    if (claudeAnswer) {
      reasoningTrace.push("Used Claude API prompt generation.");
      return claudeAnswer;
    }

    reasoningTrace.push("Used local copilot fallback.");
    return this.localChatResponse(prompt, context, reasoningTrace);
  }

  private async callClaude(prompt: string): Promise<string | undefined> {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return undefined;
    }

    const apiUrl = process.env.CLAUDE_API_URL ?? "https://api.anthropic.com/v1/complete";
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL ?? "claude-3.5-mini",
          prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
          max_tokens_to_sample: 1000,
          stop_sequences: ["\n\nHuman:"]
        })
      });

      if (!response.ok) {
        return undefined;
      }

      const payload = (await response.json()) as {
        completion?: unknown;
        response?: unknown;
      };
      if (payload?.completion) {
        return String(payload.completion).trim();
      }

      if (payload?.response) {
        return String(payload.response).trim();
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private localChatResponse(
    prompt: string,
    context: FundamentalContext,
    reasoningTrace: string[]
  ): string {
    const lines: string[] = [];
    lines.push(`Resumen para ${context.ticker}:`);

    if (context.viabilityScore !== undefined) {
      lines.push(
        `Según el análisis fundamental disponible, este activo tiene un score de viabilidad de ${context.viabilityScore.toFixed(2)}.`
      );
    } else {
      lines.push("No se encontró información de viabilidad disponible, por lo que el análisis es más general.");
    }

    if (context.viabilityJustification) {
      lines.push("Motivos principales:");
      lines.push(context.viabilityJustification);
    }

    if (context.strategySummary) {
      lines.push("");
      lines.push("Recomendación de estrategia:");
      lines.push(context.strategySummary);
    }

    const question = prompt.toLowerCase();
    if (question.includes("qué puede cambiar") || question.includes("qué puede pasar") || question.includes("escenarios")) {
      lines.push("");
      lines.push("Escenarios de mercado a considerar:");
      lines.push("- Si la volatilidad sube más de 50%, la estrategia puede requerir mayor margen o ajuste de strike.");
      lines.push("- Si los resultados trimestrales son peores de lo esperado, la percepción de riesgo puede aumentar y afectar el precio.");
      lines.push("- Una rotación sectorial puede cambiar la fortaleza relativa de la empresa, incluso si sus fundamentos son sólidos.");
    }

    if (question.includes("cómo calculaste") || question.includes("cómo lo calculaste") || question.includes("pasos matemáticos")) {
      lines.push("");
      lines.push("Cómo se calculó el resultado:");
      lines.push("- Se usa el score de viabilidad disponible y se compara con umbrales de riesgo/retorno.");
      lines.push("- Se evalúan métricas clave como ROE, P/E, volatilidad y dividendos para ponderar cada componente.");
      lines.push("- La recomendación de estrategia considera la relación entre viabilidad fundamental y objetivo de opciones.");
    }

    lines.push("");
    lines.push(this.buildDisclaimer());

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

    if (!this.supabaseClient) {
      return context;
    }

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
    const client = this.supabaseClient;
    if (!client) {
      return null;
    }

    try {
      const { data, error } = await client
        .from("company_fundamentals")
        .select("ticker, viability_score, justification")
        .eq("ticker", ticker)
        .maybeSingle();

      if (error) {
        return null;
      }

      return data as { viability_score?: number; justification?: string } | null;
    } catch {
      return null;
    }
  }

  private async fetchStrategySummary(ticker: string): Promise<{ summary?: string } | null> {
    const client = this.supabaseClient;
    if (!client) {
      return null;
    }

    try {
      const { data, error } = await client
        .from("strategy_evaluations")
        .select("ticker, summary")
        .eq("ticker", ticker)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return null;
      }

      return data as { summary?: string } | null;
    } catch {
      return null;
    }
  }

  private async fetchUserHistory(userId: string, ticker: string): Promise<string[]> {
    const client = this.supabaseClient;
    if (!client) {
      return [];
    }

    try {
      const { data, error } = await client
        .from("user_analysis_history")
        .select("interaction_summary")
        .eq("user_id", userId)
        .eq("ticker", ticker)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error || !data) {
        return [];
      }

      return (data as Array<{ interaction_summary?: string }>).
        filter((item) => typeof item.interaction_summary === "string")
        .map((item) => item.interaction_summary as string);
    } catch {
      return [];
    }
  }

  private async logChatInteraction(userId: string | undefined, ticker: string, exchangeCount: number): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }

    try {
      await this.supabaseClient.from("chat_audit").insert([
        {
          action: "chat_message",
          user_id: userId ?? null,
          ticker,
          exchange_count: exchangeCount,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch {
      // do not fail the chat if audit logging fails
    }
  }
}
