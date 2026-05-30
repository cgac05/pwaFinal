// FIC: Unit tests for the deterministic sentiment analyzer and JSON parsing helpers.
// FIC: Tests unitarios del analizador determinista de sentimiento y los helpers de parseo JSON.

import { describe, expect, it } from "vitest";
import {
  DeterministicNewsSentimentAnalyzer,
  labelForScore,
  parseSentimentJson
} from "../../../src/modules/news/sentimentService";
import { demoNewsForSymbol } from "../../../src/modules/news/newsAdapter";
import type { NewsArticle } from "../../../src/modules/news/types";

function article(headline: string, summary = ""): NewsArticle {
  return {
    id: headline,
    headline,
    summary,
    author: "",
    source: "Test",
    url: "https://example.com",
    symbols: ["AAPL"],
    createdAt: "2026-05-29T00:00:00.000Z"
  };
}

describe("labelForScore", () => {
  it("maps scores to labels with the doc thresholds", () => {
    expect(labelForScore(0.5)).toBe("BULLISH");
    expect(labelForScore(-0.5)).toBe("BEARISH");
    expect(labelForScore(0.1)).toBe("NEUTRAL");
  });
});

describe("DeterministicNewsSentimentAnalyzer", () => {
  const analyzer = new DeterministicNewsSentimentAnalyzer();

  it("returns neutral with zero confidence when there are no articles", async () => {
    const res = await analyzer.analyzeNewsSentiment("AAPL", []);
    expect(res.label).toBe("NEUTRAL");
    expect(res.confidence).toBe(0);
    expect(res.degraded).toBe(true);
  });

  it("scores bullish headlines positively", async () => {
    const res = await analyzer.analyzeNewsSentiment("AAPL", [
      article("AAPL supera expectativas con fuerte crecimiento"),
      article("Analistas elevan el precio objetivo, rally en marcha")
    ]);
    expect(res.score).toBeGreaterThan(0.3);
    expect(res.label).toBe("BULLISH");
  });

  it("scores bearish headlines negatively", async () => {
    const res = await analyzer.analyzeNewsSentiment("AAPL", [
      article("Reguladores investiga a la empresa por presion regulatoria"),
      article("Lawsuit triggers downgrade and warning")
    ]);
    expect(res.score).toBeLessThan(-0.3);
    expect(res.label).toBe("BEARISH");
  });

  it("is deterministic over demo news", async () => {
    const a = await analyzer.analyzeNewsSentiment("AAPL", demoNewsForSymbol("AAPL"));
    const b = await analyzer.analyzeNewsSentiment("AAPL", demoNewsForSymbol("AAPL"));
    expect(a).toEqual(b);
  });
});

describe("parseSentimentJson", () => {
  it("parses fenced JSON and clamps ranges", () => {
    const text = "```json\n{ \"score\": 1.9, \"label\": \"BULLISH\", \"confidence\": 2, \"reasoning\": \"x\", \"keyFactors\": [\"a\"] }\n```";
    const res = parseSentimentJson(text, "AAPL");
    expect(res.score).toBe(1);
    expect(res.confidence).toBe(1);
    expect(res.label).toBe("BULLISH");
  });

  it("derives the label from the score when missing/invalid", () => {
    const res = parseSentimentJson('{ "score": -0.8, "confidence": 0.5 }', "AAPL");
    expect(res.label).toBe("BEARISH");
  });

  it("throws when no JSON object is present", () => {
    expect(() => parseSentimentJson("no json here", "AAPL")).toThrow();
  });
});
