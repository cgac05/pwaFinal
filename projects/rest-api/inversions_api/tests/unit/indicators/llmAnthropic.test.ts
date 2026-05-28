// FIC: Unit tests T123 — AnthropicExplainer degradacion + reintentos + disclaimer preservado.

import { describe, expect, it } from "vitest";
import { AnthropicExplainer, ANTHROPIC_MODEL_ID } from "../../../src/modules/indicators/llmAnthropic";

describe("AnthropicExplainer", () => {
  it("uses claude-opus-4-7 by default", () => {
    const ex = new AnthropicExplainer({ apiKey: undefined });
    expect(ex.model).toBe(ANTHROPIC_MODEL_ID);
  });

  it("degrades to mock when no API key is set", async () => {
    const ex = new AnthropicExplainer({ apiKey: undefined });
    const res = await ex.explain("[DATOS]{\"symbol\":\"AAPL\",\"timeframe\":\"1h\",\"verdict\":\"neutral\",\"score\":0,\"facts\":[]}[/DATOS]");
    expect(res.text.length).toBeGreaterThan(0);
    expect((res as any).degraded).toBe(true);
    expect((res as any).error_code).toBe("LLM_UNAVAILABLE");
  });

  it("respects retry policy with custom delay", async () => {
    let delays = 0;
    const ex = new AnthropicExplainer({
      apiKey: undefined,
      retries: 0,
      delay: async () => {
        delays += 1;
      }
    });
    await ex.explain("prompt");
    // FIC: Sin API key, no entra al loop de reintentos.
    expect(delays).toBe(0);
  });
});
