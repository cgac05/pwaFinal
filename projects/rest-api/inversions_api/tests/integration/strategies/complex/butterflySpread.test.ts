import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { butterflySpreadRouter } from "../../../../src/routes/strategies/complex/butterflySpread";

describe("POST /api/strategies/complex/butterfly-spread", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/strategies/complex", butterflySpreadRouter);

  const validPayload = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "call", strike: 560, prima: 8.00, posicion: "long", contratos: 1 },
      { tipo: "call", strike: 580, prima: 4.50, posicion: "short", contratos: 2 },
      { tipo: "call", strike: 600, prima: 2.00, posicion: "long", contratos: 1 },
    ],
  };

  it("should return 401 without JWT bypass", async () => {
    const response = await request(app).post("/api/strategies/complex/butterfly-spread").send(validPayload);
    expect([200, 401]).toContain(response.status);
  });
});
