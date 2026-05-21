import { Router, Request, Response } from "express";
import { AgentFactory } from "../../modules/agents/agentFactory";
import { AgentRole } from "../../modules/agents/geminiAgentService";

const router = Router();
const geminiAgent = AgentFactory.createGeminiAgent();

router.post("/gemini/test", async (req: Request, res: Response) => {
  const rawPrompt = typeof req.body.prompt === "string" ? req.body.prompt.trim() : "Provide a concise market volatility opinion.";
  const roleValue = req.body.role as AgentRole | undefined;
  const role: AgentRole = roleValue === "strategist" || roleValue === "executor" ? roleValue : "analyzer";

  if (!geminiAgent.isEnabled()) {
    return res.status(503).json({
      success: false,
      message: "Gemini AI is not configured. Set GEMINI_API_KEY in environment variables.",
    });
  }

  try {
    const response = await geminiAgent.generateAgentResponse({
      role,
      userPrompt: rawPrompt,
    });

    return res.status(200).json({
      success: true,
      model: response.model,
      text: response.text,
      structured: response.structured,
      timestampUtc: response.timestampUtc,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      message: "Gemini invocation failed.",
      details: errorMessage,
    });
  }
});

export default router;
