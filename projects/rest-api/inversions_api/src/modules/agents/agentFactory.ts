import { GeminiAgentService } from "./geminiAgentService";

export class AgentFactory {
  public static createGeminiAgent(): GeminiAgentService {
    return new GeminiAgentService();
  }
}
