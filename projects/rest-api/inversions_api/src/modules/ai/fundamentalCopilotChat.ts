import type { SupabaseClient } from "@supabase/supabase-js";

export interface CopilotChatRequest {
  ticker: string;
  question: string;
  includeStrategyRecommendation?: boolean;
}

export interface CopilotChatResponse {
  answer: string;
  sourceContext: string[];
  disclaimer: string;
}

export class FundamentalCopilotChat {
  constructor(private readonly supabaseClient?: SupabaseClient) {}

  async generateResponse(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const context = [
      `Requested ticker: ${request.ticker}`,
      `Question: ${request.question}`
    ];

    if (request.includeStrategyRecommendation) {
      context.push("Includes recommendation based on fundamental and options strategy context.");
    }

    return {
      answer: `La empresa ${request.ticker} tiene un perfil de riesgo/retorno compatible con la solicitud: ${request.question}`,
      sourceContext: context,
      disclaimer: "Este análisis es informativo y no constituye una recomendación de inversión."
    };
  }
}
