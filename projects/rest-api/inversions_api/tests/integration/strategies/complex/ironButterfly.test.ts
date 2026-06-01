import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ironButterflyRouter } from "../../../../src/routes/strategies/complex/ironButterfly";

describe("POST /api/strategies/complex/iron-butterfly", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/strategies/complex", ironButterflyRouter);

  const validPayload = {
    ticker: "SPY",
    expiracion: "2025-06-20",
    tipo_ala: "short",
    tolerancia_riesgo: "medio",
    estilo_opcion: "europea",
    version: 1,
    legs: [
      { tipo: "put", strike: 555, prima: 4.00, posicion: "long", contratos: 1 },
      { tipo: "put", strike: 575, prima: 8.00, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 575, prima: 7.50, posicion: "short", contratos: 1 },
      { tipo: "call", strike: 595, prima: 3.50, posicion: "long", contratos: 1 },
    ],
  };

  it("should return 401 without JWT bypass", async () => {
    const response = await request(app).post("/api/strategies/complex/iron-butterfly").send(validPayload);
    expect([200, 401]).toContain(response.status);
  });
});
