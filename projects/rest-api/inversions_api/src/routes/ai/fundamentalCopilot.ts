import { Router, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FundamentalCopilotChat } from "../../modules/ai/fundamentalCopilotChat";

export function createFundamentalCopilotRouter(supabaseClient: SupabaseClient): Router {
  const router = Router();
  const copilot = new FundamentalCopilotChat(supabaseClient);

  router.post("/fundamental/copilot", async (req: Request, res: Response) => {
    try {
      const { ticker, question, includeStrategyRecommendation = false, simulationContext } = req.body;

      if (!ticker || !question) {
        return res.status(400).json({ error: "ticker and question are required" });
      }

      const response = await copilot.generateResponse({
        ticker: String(ticker).toUpperCase(),
        question: String(question),
        includeStrategyRecommendation: Boolean(includeStrategyRecommendation),
        simulationContext: typeof simulationContext === "object" && simulationContext !== null ? simulationContext : undefined
      });

      await auditLog(supabaseClient, {
        action: "fundamental_copilot_chat",
        ticker: response.answer.includes(ticker) ? ticker : String(ticker),
        question,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ error: "Failed to generate copilot response", details: String(error) });
    }
  });

  return router;
}

async function auditLog(supabaseClient: SupabaseClient, entry: Record<string, unknown>) {
  try {
    await supabaseClient.from("audit_trail").insert({ action: entry.action, details: JSON.stringify(entry), timestamp: new Date().toISOString() });
  } catch {
    // no-op
  }
}
