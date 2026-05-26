// FIC: Integration tests T091 — GET /api/signals/confluence-table.
// FIC: Integration tests for confluence-table endpoint (Phase 5 Bloque B).

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { confluenceTableRouter } from "../../../src/routes/signals/confluenceTable";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/signals", confluenceTableRouter);
  return app;
}

describe("GET /api/signals/confluence-table", () => {
  it("returns 400 when ticket missing", async () => {
    const res = await request(buildApp()).get("/api/signals/confluence-table");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("missing_ticket");
  });

  it("returns 400 on invalid range", async () => {
    const res = await request(buildApp()).get(
      "/api/signals/confluence-table?ticket=AAPL&from=2026-02-01&to=2026-01-01"
    );
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("INVALID_RANGE");
  });

  it("returns 400 on invalid core", async () => {
    const res = await request(buildApp()).get("/api/signals/confluence-table?ticket=AAPL&cores=A_BOGUS");
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe("INVALID_CORE");
  });

  it("returns 200 with rows including A_INDICADORES + degraded stubs", async () => {
    const res = await request(buildApp()).get("/api/signals/confluence-table?ticket=AAPL");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.length).toBeGreaterThan(1);
    const cores = new Set(res.body.rows.map((r: any) => r.core));
    expect(cores.has("A_INDICADORES")).toBe(true);
    expect(cores.has("A_FUNDAMENTAL")).toBe(true);
    const ia = res.body.rows.find((r: any) => r.core === "A_IA");
    expect(ia.ia_revisada).toBe(true);
    expect(ia.disclaimer_id).toBeDefined();
  });

  it("filters by cores when query param is provided", async () => {
    const res = await request(buildApp()).get(
      "/api/signals/confluence-table?ticket=AAPL&cores=A_INDICADORES"
    );
    expect(res.status).toBe(200);
    const cores = new Set(res.body.rows.map((r: any) => r.core));
    expect([...cores]).toEqual(["A_INDICADORES"]);
  });
});
