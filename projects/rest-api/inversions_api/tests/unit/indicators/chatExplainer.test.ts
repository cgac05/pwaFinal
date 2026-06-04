// FIC: Unit tests for the Chat IA explainer orchestrator (Hansel, TEAM-02).
// FIC: Tests unitarios del orquestador del Chat IA explicativo (Hansel, TEAM-02).

import { describe, expect, it } from "vitest";
import {
  CHAT_DISCLAIMER,
  DeterministicMockExplainer,
  enforceDisclaimer,
  explainSignal,
  hasExecutionIntent
} from "../../../src/modules/indicators/chatExplainer";
import type { OhlcBar } from "../../../src/modules/indicators/types";

function bar(time: number, close: number, spread = 1.5): OhlcBar {
  return { time, open: close, high: close + spread, low: close - spread, close, volume: 1000 };
}

const UPTREND: OhlcBar[] = Array.from({ length: 90 }, (_, i) => bar(i, 100 + i * 1.5));

describe("hasExecutionIntent", () => {
  it.each([
    ["ejecuta una compra de AAPL", true],
    ["coloca una orden de venta", true],
    ["compra 10 acciones", true],
    ["execute a buy order now", true],
    ["por que la señal esta alcista?", false],
    ["explica el RSI actual", false]
  ] as const)("classifies %s -> %s", (question, expected) => {
    expect(hasExecutionIntent(question)).toBe(expected);
  });
});

describe("enforceDisclaimer", () => {
  it("appends the constitutional disclaimer when missing", () => {
    const out = enforceDisclaimer("La señal es alcista.");
    expect(out.toLowerCase()).toContain(CHAT_DISCLAIMER);
  });

  it("does not duplicate an already present disclaimer", () => {
    const text = `Algo. ${CHAT_DISCLAIMER}`;
    const out = enforceDisclaimer(text);
    expect(out.toLowerCase().split(CHAT_DISCLAIMER).length - 1).toBe(1);
  });
});

describe("DeterministicMockExplainer", () => {
  it("returns identical output for identical prompts (deterministic)", async () => {
    const explainer = new DeterministicMockExplainer();
    const a = await explainer.explain("prompt\n[DATOS]{\"symbol\":\"X\"}[/DATOS]");
    const b = await explainer.explain("prompt\n[DATOS]{\"symbol\":\"X\"}[/DATOS]");
    expect(a.text).toBe(b.text);
    expect(a.latency_ms).toBe(b.latency_ms);
    expect(a.model).toBe("mock-explainer-deterministic-v1");
  });
});

describe("explainSignal", () => {
  const explainer = new DeterministicMockExplainer();

  it("explains a signal with disclaimer and at least 3 cited indicators", async () => {
    const res = await explainSignal(
      { symbol: "AAPL", timeframe: "1h", question: "por que la señal esta alcista?" },
      UPTREND,
      { explainer }
    );
    expect(res.refused).toBe(false);
    expect(res.disclaimer).toBe(CHAT_DISCLAIMER);
    expect(res.explanation_text.toLowerCase()).toContain(CHAT_DISCLAIMER);
    expect(res.indicators_cited.length).toBeGreaterThanOrEqual(3);
    expect(res.model_version).toBe("mock-explainer-deterministic-v1");
  });

  it("refuses questions that imply executing an order (still 200-shaped, with disclaimer)", async () => {
    const res = await explainSignal(
      { symbol: "AAPL", timeframe: "1h", question: "ejecuta una compra de AAPL" },
      UPTREND,
      { explainer }
    );
    expect(res.refused).toBe(true);
    expect(res.indicators_cited).toEqual([]);
    expect(res.explanation_text.toLowerCase()).toContain(CHAT_DISCLAIMER);
    expect(res.explanation_text.toLowerCase()).toContain("no puedo ejecutar");
  });

  it("answers in Spanish even when the question is in another language", async () => {
    const res = await explainSignal(
      { symbol: "AAPL", timeframe: "1h", question: "why is the trend behaving like this?" },
      UPTREND,
      { explainer }
    );
    expect(res.refused).toBe(false);
    expect(res.explanation_text.toLowerCase()).toContain("analisis tecnico");
  });
});
