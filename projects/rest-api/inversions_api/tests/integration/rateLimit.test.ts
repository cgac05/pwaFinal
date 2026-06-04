// FIC: Integration tests T134 — rate limit por user_id, 60/min indicadores, 10/min chat.

import express from "express";
import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import {
  createRateLimit,
  InMemoryRateLimitStorage,
  setRateLimitStorage
} from "../../src/middleware/indicatorsRateLimit";

beforeEach(() => {
  setRateLimitStorage(new InMemoryRateLimitStorage());
});

function buildApp(limit: number) {
  const app = express();
  app.use((req, _res, next) => {
    req.authContext = { userId: (req.headers["x-test-user"] as string) ?? "u-test", role: "trader" } as any;
    next();
  });
  app.get(
    "/api/test",
    createRateLimit({ windowSeconds: 60, maxRequests: limit, bucket: "test" }),
    (_req, res) => res.json({ ok: true })
  );
  return app;
}

describe("rate limit middleware", () => {
  it("allows up to maxRequests then 429s", async () => {
    const app = buildApp(3);
    for (let i = 0; i < 3; i++) {
      const r = await request(app).get("/api/test").set("x-test-user", "alice");
      expect(r.status).toBe(200);
    }
    const blocked = await request(app).get("/api/test").set("x-test-user", "alice");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error_code).toBe("RATE_LIMITED");
    expect(blocked.body.retry_after_seconds).toBeGreaterThan(0);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("uses separate buckets per user_id", async () => {
    const app = buildApp(2);
    await request(app).get("/api/test").set("x-test-user", "alice");
    await request(app).get("/api/test").set("x-test-user", "alice");
    const blockedAlice = await request(app).get("/api/test").set("x-test-user", "alice");
    expect(blockedAlice.status).toBe(429);

    const bob = await request(app).get("/api/test").set("x-test-user", "bob");
    expect(bob.status).toBe(200);
  });
});
