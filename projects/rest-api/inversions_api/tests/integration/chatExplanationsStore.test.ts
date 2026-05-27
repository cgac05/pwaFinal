// FIC: Integration tests T129 — InMemoryChatStore insert + list + purga + job resiliencia (T128).

import { describe, expect, it, beforeEach } from "vitest";
import {
  InMemoryChatStore,
  buildChatRecord,
  runChatPurgeJob,
  resetChatPurgeStreak,
  CHAT_TTL_DAYS,
  type ChatStoreClient,
  type ChatExplanationRecord
} from "../../src/modules/indicators/chatExplanationsStore";

beforeEach(() => {
  resetChatPurgeStreak();
});

function fakeResponse() {
  return {
    explanation_text: "RSI 65",
    indicators_cited: [],
    disclaimer: "esta explicacion no constituye orden ni recomendacion ejecutable",
    model_version: "test",
    computed_at: new Date("2026-01-01T00:00:00Z").toISOString(),
    refused: false
  } as any;
}

describe("InMemoryChatStore", () => {
  it("inserts and lists records", async () => {
    const store = new InMemoryChatStore();
    const rec = buildChatRecord({
      response: fakeResponse(),
      question: "por que alcista?",
      symbol: "AAPL",
      timeframe: "1h",
      userId: "u1",
      now: new Date("2026-01-01T00:00:00Z")
    });
    await store.insert(rec);
    const rows = await store.list("u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("AAPL");
  });

  it("computes expires_at = computed_at + 90 days", () => {
    const rec = buildChatRecord({
      response: fakeResponse(),
      question: "?",
      symbol: "AAPL",
      timeframe: "1h",
      now: new Date("2026-01-01T00:00:00Z")
    });
    const expected = new Date("2026-01-01T00:00:00Z").getTime() + CHAT_TTL_DAYS * 86_400_000;
    expect(Date.parse(rec.expires_at)).toBe(expected);
  });

  it("purges expired records", async () => {
    const store = new InMemoryChatStore();
    const old: ChatExplanationRecord = {
      symbol: "OLD",
      timeframe: "1h",
      question: "q",
      explanation_text: "",
      indicators_cited: [],
      disclaimer: "",
      model_version: "",
      tokens_in: 0,
      tokens_out: 0,
      computed_at: "2024-01-01T00:00:00Z",
      expires_at: "2024-04-01T00:00:00Z"
    };
    await store.insert(old);
    const purged = await store.purgeExpired(new Date("2026-01-01T00:00:00Z"));
    expect(purged).toBe(1);
    expect((await store.list()).length).toBe(0);
  });
});

describe("runChatPurgeJob — resiliencia T128", () => {
  it("logs ok and resets streak on success", async () => {
    const store = new InMemoryChatStore();
    const events: any[] = [];
    const result = await runChatPurgeJob(store, { logger: (e) => events.push(e) });
    expect(result.purged).toBe(0);
    expect(result.failureStreak).toBe(0);
    expect(events.some((e) => e.type === "chat_purge_ok")).toBe(true);
  });

  it("emits alert after 3 consecutive failures", async () => {
    const failing: ChatStoreClient = {
      insert: async () => {},
      list: async () => [],
      purgeExpired: async () => {
        throw new Error("DB down");
      }
    };
    const events: any[] = [];
    await runChatPurgeJob(failing, { logger: (e) => events.push(e) });
    await runChatPurgeJob(failing, { logger: (e) => events.push(e) });
    const r3 = await runChatPurgeJob(failing, { logger: (e) => events.push(e) });
    expect(r3.failureStreak).toBe(3);
    expect(events.some((e) => e.type === "chat_purge_alert")).toBe(true);
  });
});
