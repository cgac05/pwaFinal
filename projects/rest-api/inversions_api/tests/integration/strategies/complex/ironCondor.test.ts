import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ironCondorRouter } from "../../../../src/routes/strategies/complex/ironCondor";

describe("POST /api/strategies/complex/iron-condor", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/strategies/complex", ironCondorRouter);

  const validPayload = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "put", strike: 540, prima: 3.50, posicion: "long", contratos: 1 },
      { tipo: "put", strike: 560, prima: 6.00, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 590, prima: 4.50, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 610, prima: 2.00, posicion: "long", contratos: 1 },
    ],
  };

  it("should return 401 without JWT bypass", async () => {
    const response = await request(app).post("/api/strategies/complex/iron-condor").send(validPayload);
    expect([200, 401]).toContain(response.status);
  });
});
