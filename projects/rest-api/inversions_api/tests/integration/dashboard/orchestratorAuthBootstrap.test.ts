import express from "express";
import request from "supertest";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";

// FIC: Integration test for auth bootstrap and JWT token flow on dashboard orchestrator.
// Verifies that the endpoint returns proper AUTH_CONTEXT_* error codes when no token is provided,
// and accepts valid tokens from the dev bootstrap flow.
// FIC: Test de integración para bootstrap de auth y flujo JWT en orquestador del dashboard.
// Verifica que el endpoint retorna códigos AUTH_CONTEXT_* cuando no hay token,
// y acepta tokens válidos del flujo bootstrap dev.

import { dashboardOrchestratorRouter } from "../../../src/routes/dashboard/orchestrator";
import { initializeEnvironment, resetEnvironment } from "../../../src/config/environment";

describe("Dashboard orchestrator auth bootstrap", () => {
  let app: express.Express;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    app = express();
    app.use(express.json());
    app.use("/api/dashboard", dashboardOrchestratorRouter);
  });

  afterEach(() => {
    resetEnvironment();
    process.env = { ...originalEnv };
  });

  it("returns 401 AUTH_CONTEXT_MISSING when no auth token provided", async () => {
    process.env.AUTH_BYPASS = "false";
    process.env.NODE_ENV = "production";

    const response = await request(app).get("/api/dashboard/orchestrator");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_CONTEXT_MISSING");
  });

  it("returns 401 AUTH_CONTEXT_INVALID_TOKEN with malformed bearer token", async () => {
    process.env.AUTH_BYPASS = "false";
    process.env.NODE_ENV = "production";

    const response = await request(app)
      .get("/api/dashboard/orchestrator")
      .set("Authorization", "Bearer invalid-token-that-will-fail-verification");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_CONTEXT_INVALID_TOKEN");
  });

  it("returns 200 with valid JWT (dev token) when AUTH_BYPASS is disabled", async () => {
    process.env.AUTH_BYPASS = "false";
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret-key-that-is-longer-than-thirty-two-chars!!";
    // Initialize environment singleton with the test env vars
    initializeEnvironment();

    const validToken = jwt.sign(
      { sub: "dev-user", role: "trader", email: "dev@local" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const response = await request(app)
      .get("/api/dashboard/orchestrator")
      .set("Authorization", `Bearer ${validToken}`);

    // Auth passed — orchestrator defaults to AAPL,MSFT,NVDA,SPY
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("cards");
  });

  it("bypasses auth in development mode without AUTH_BYPASS set", async () => {
    delete process.env.AUTH_BYPASS;
    process.env.NODE_ENV = "development";

    const response = await request(app).get("/api/dashboard/orchestrator");

    // Auth bypass active — orchestrator returns 200 with default cards
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("cards");
  });

  it("bypasses auth when AUTH_BYPASS=true explicitly", async () => {
    process.env.AUTH_BYPASS = "true";
    process.env.NODE_ENV = "production";

    const response = await request(app).get("/api/dashboard/orchestrator");

    // Auth bypass active — orchestrator returns 200 with default cards
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("cards");
  });

  it("rejects token with missing sub claim", async () => {
    process.env.AUTH_BYPASS = "false";
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret-key-that-is-longer-than-thirty-two-chars!!";
    // Re-initialize so the new JWT_SECRET takes effect
    resetEnvironment();
    initializeEnvironment();

    const tokenNoSub = jwt.sign(
      { role: "trader", email: "dev@local" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const response = await request(app)
      .get("/api/dashboard/orchestrator")
      .set("Authorization", `Bearer ${tokenNoSub}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_CONTEXT_INVALID_TOKEN");
  });

  it("rejects token with invalid role claim", async () => {
    process.env.AUTH_BYPASS = "false";
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret-key-that-is-longer-than-thirty-two-chars!!";
    // Re-initialize so the new JWT_SECRET takes effect
    resetEnvironment();
    initializeEnvironment();

    const tokenBadRole = jwt.sign(
      { sub: "dev-user", role: "hacker", email: "dev@local" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const response = await request(app)
      .get("/api/dashboard/orchestrator")
      .set("Authorization", `Bearer ${tokenBadRole}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_CONTEXT_INVALID_TOKEN");
  });
});
