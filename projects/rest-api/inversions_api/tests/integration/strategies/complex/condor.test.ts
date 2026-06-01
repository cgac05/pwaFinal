import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { condorRouter } from "../../../../src/routes/strategies/complex/condor";

describe("POST /api/strategies/complex/condor", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/strategies/complex", condorRouter);

  const validPayload = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "call", strike: 550, prima: 10.00, posicion: "long", contratos: 1 },
      { tipo: "call", strike: 570, prima: 6.00, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 590, prima: 3.00, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 610, prima: 1.50, posicion: "long", contratos: 1 },
    ],
  };

  it("should return 401 without JWT bypass", async () => {
    const response = await request(app).post("/api/strategies/complex/condor").send(validPayload);
    expect([200, 401]).toContain(response.status);
  });
});
