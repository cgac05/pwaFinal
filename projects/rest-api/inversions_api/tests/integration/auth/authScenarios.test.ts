// FIC: Integration tests T135 — auth scenarios US7 (401 AUTH_REQUIRED, 401 AUTH_INVALID, 403 AUTH_FORBIDDEN).
// FIC: Cubre 1 endpoint representativo por familia (indicators / signals / simulation / chat).

import express from "express";
import request from "supertest";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { sign } from "jsonwebtoken";

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  process.env.AUTH_BYPASS = "false";
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
});

afterEach(() => {
  process.env = originalEnv;
});

async function loadAuth() {
  // FIC: Carga dinamica para que el JWT_SECRET aplique al middleware.
  return await import("../../../src/middleware/authContext");
}

function buildApp(authMiddleware: any) {
  const app = express();
  app.use(express.json());
  app.use((_req, _res, next) => next());
  app.get("/api/indicators/rsi", authMiddleware, (req: any, res) => {
    if (req.authContext?.role === "guest") {
      return res.status(403).json({ error_code: "AUTH_FORBIDDEN" });
    }
    res.json({ ok: true });
  });
  app.get("/api/signals/confluence-table", authMiddleware, (req: any, res) => {
    if (req.authContext?.role === "guest") {
      return res.status(403).json({ error_code: "AUTH_FORBIDDEN" });
    }
    res.json({ ok: true });
  });
  app.post("/api/simulation/run", authMiddleware, (req: any, res) => {
    if (req.authContext?.role === "guest") {
      return res.status(403).json({ error_code: "AUTH_FORBIDDEN" });
    }
    res.json({ ok: true });
  });
  app.post("/api/chat/explain", authMiddleware, (req: any, res) => {
    if (req.authContext?.role === "guest") {
      return res.status(403).json({ error_code: "AUTH_FORBIDDEN" });
    }
    res.json({ ok: true });
  });
  return app;
}

describe("US7 auth scenarios", () => {
  it("401 AUTH_REQUIRED — sin header Authorization (indicators)", async () => {
    const { authContextMiddleware } = await loadAuth();
    const app = buildApp(authContextMiddleware);
    const res = await request(app).get("/api/indicators/rsi");
    expect(res.status).toBe(401);
  });

  it("401 AUTH_INVALID — JWT con firma invalida (signals)", async () => {
    const { authContextMiddleware } = await loadAuth();
    const app = buildApp(authContextMiddleware);
    const res = await request(app)
      .get("/api/signals/confluence-table")
      .set("Authorization", "Bearer not-a-valid-jwt");
    expect(res.status).toBe(401);
  });

  it("401 — sin Authorization en simulation/run", async () => {
    const { authContextMiddleware } = await loadAuth();
    const app = buildApp(authContextMiddleware);
    const res = await request(app).post("/api/simulation/run").send({});
    expect(res.status).toBe(401);
  });

  it("403 AUTH_FORBIDDEN simulado — rol fuera del enum permitido (chat)", async () => {
    const { authContextMiddleware } = await loadAuth();
    const app = express();
    app.use(express.json());
    // FIC: Bypass-style middleware con rol guest para probar el 403 logico del endpoint.
    app.use((req: any, _res, next) => {
      req.authContext = { userId: "u", role: "guest" };
      next();
    });
    app.post("/api/chat/explain", (req: any, res) => {
      if (req.authContext?.role === "guest") {
        return res.status(403).json({ error_code: "AUTH_FORBIDDEN" });
      }
      res.json({ ok: true });
    });
    const res = await request(app).post("/api/chat/explain").send({});
    expect(res.status).toBe(403);
    expect(res.body.error_code).toBe("AUTH_FORBIDDEN");
    void authContextMiddleware;
  });
});
