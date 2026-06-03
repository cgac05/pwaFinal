// FIC: Unit tests for HTML extraction and URL impact analysis (with an injected fetch).
// FIC: Tests unitarios de extraccion HTML y analisis de impacto de URL (con fetch inyectado).

import { describe, expect, it, vi } from "vitest";
import {
  URLAnalysisService,
  extractRelevantContent,
  extractTitle
} from "../../../src/modules/news/urlAnalysisService";
import { NEWS_DISCLAIMER } from "../../../src/modules/news/types";

describe("HTML extraction", () => {
  it("extracts the title", () => {
    expect(extractTitle("<html><head><title>Hola &amp; Mundo</title></head></html>")).toBe("Hola & Mundo");
  });

  it("strips scripts/styles/tags and caps length", () => {
    const html = "<style>.x{}</style><script>bad()</script><p>Texto   relevante</p>";
    const text = extractRelevantContent(html, 100);
    expect(text).toBe("Texto relevante");
    expect(text).not.toContain("bad()");
  });
});

describe("URLAnalysisService.analyzeSourceImpact", () => {
  it("fetches, extracts and analyzes returning a disclaimer-bearing result", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        "<html><head><title>AAPL supera expectativas</title></head><body><p>fuerte crecimiento y rally</p></body></html>"
    } as Response);

    const service = new URLAnalysisService({ fetchImpl: fakeFetch as unknown as typeof fetch });
    const content = await service.fetchURLContent("https://example.com/aapl", "AAPL");
    expect(content.title).toContain("AAPL");

    const result = await service.analyzeSourceImpact(content, "AAPL");
    expect(result.company).toBe("AAPL");
    expect(["BUY", "SELL", "HOLD"]).toContain(result.verdict);
    expect(result.disclaimer).toBe(NEWS_DISCLAIMER);
  });

  it("throws on non-ok HTTP", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" } as Response);
    const service = new URLAnalysisService({ fetchImpl: fakeFetch as unknown as typeof fetch });
    await expect(service.fetchURLContent("https://example.com/x", "AAPL")).rejects.toThrow();
  });
});
