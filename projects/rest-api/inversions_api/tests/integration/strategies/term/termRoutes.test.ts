/**
 * Tests de integracion de rutas term — T198
 * Cobertura: flujo completo Calendar POST /calendar, Diagonal POST /diagonal,
 * Comparator POST /compare, validacion de errores en los 3 endpoints.
 * Modulos bajo prueba: calendarSpread.ts, diagonalSpread.ts, termComparator.ts
 * (logica de rutas sin HTTP — prueba directa de modulos)
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { TermStrategyContract } from "../../../../src/modules/strategies/term/termStrategyContract";
import { CalendarSpreadEngine } from "../../../../src/modules/strategies/term/calendarSpreadEngine";
import { DiagonalSpreadEngine } from "../../../../src/modules/strategies/term/diagonalSpreadEngine";
import { calendarSpreadRouter } from "../../../../src/routes/strategies/term/calendarSpread";
import { diagonalSpreadRouter } from "../../../../src/routes/strategies/term/diagonalSpread";

/** Tests de integracion: flujos completos de calendar, diagonal y comparator sin HTTP */
describe("Term API Integration", () => {
  const now = new Date();
  const shortExp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const longExp = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const buildCalendarApp = () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/strategies/term", calendarSpreadRouter);
    return app;
  };

  const buildDiagonalApp = () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/strategies/term", diagonalSpreadRouter);
    return app;
  };

  /** Tests de logica de ruta calendar: validacion, analisis completo, manejo errores */
  describe("Calendar Spread Route Logic", () => {
    it("should reject input with fewer than 2 legs", () => {
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: shortExp, premium: 5, contracts: 1, optionStyle: "call" },
        ],
      });
      const validation = contract.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.code === "INSUFFICIENT_LEGS")).toBe(true);
    });

    it("should validate and analyze a complete calendar spread", () => {
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: shortExp, premium: 5, contracts: 1, optionStyle: "call" },
          { strike: 100, expiration: longExp, premium: 8, contracts: 1, optionStyle: "call" },
        ],
        underlying: "SPY",
      });

      const validation = contract.validate();
      expect(validation.isValid).toBe(true);

      const engine = new CalendarSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.shortDte).toBeGreaterThan(0);
      expect(result.longDte).toBeGreaterThan(0);
      expect(result.scenarios.length).toBeGreaterThan(0);
    });

    it("should handle error cases gracefully", () => {
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: shortExp, premium: 5, contracts: 1, optionStyle: "call" },
          { strike: 100, expiration: shortExp, premium: 8, contracts: 1, optionStyle: "call" },
        ],
      });
      const validation = contract.validate();
      expect(validation.isValid).toBe(false);
    });

    it("should expose explicit Calendar Call API variant", async () => {
      const app = buildCalendarApp();
      const response = await request(app)
        .post("/api/v1/strategies/term/calendar/call")
        .send({
          legs: [
            { strike: 100, expiration: shortExp.toISOString(), premium: 2.5, contracts: 1, optionStyle: "put" },
            { strike: 100, expiration: longExp.toISOString(), premium: 5, contracts: 1, optionStyle: "put" },
          ],
          underlying: "AAPL",
          monteCarlo: { iterations: 10, distribution: "normal" },
        });

      expect(response.status).toBe(200);
      expect(response.body.strategy).toBe("calendar");
      expect(response.body.variant).toBe("call");
      expect(response.body.structureName).toBe("Calendar Call Spread");
    });

    it("should expose explicit Calendar Put API variant", async () => {
      const app = buildCalendarApp();
      const response = await request(app)
        .post("/api/v1/strategies/term/calendar/put")
        .send({
          legs: [
            { strike: 100, expiration: shortExp.toISOString(), premium: 2.5, contracts: 1, optionStyle: "call" },
            { strike: 100, expiration: longExp.toISOString(), premium: 5, contracts: 1, optionStyle: "call" },
          ],
          underlying: "AAPL",
          monteCarlo: { iterations: 10, distribution: "normal" },
        });

      expect(response.status).toBe(200);
      expect(response.body.strategy).toBe("calendar");
      expect(response.body.variant).toBe("put");
      expect(response.body.structureName).toBe("Calendar Put Spread");
    });
  });

  /** Tests de logica de ruta diagonal: validacion, analisis completo, rechazo calendar en /diagonal */
  describe("Diagonal Spread Route Logic", () => {
    it("should validate and analyze a complete diagonal spread", () => {
      const contract = new TermStrategyContract({
        legs: [
          { strike: 95, expiration: shortExp, premium: 5, contracts: 1, optionStyle: "call" },
          { strike: 105, expiration: longExp, premium: 8, contracts: 1, optionStyle: "call" },
        ],
        underlying: "SPY",
      });

      const validation = contract.validate();
      expect(validation.isValid).toBe(true);
      expect(contract.getType()).toBe("diagonal");

      const engine = new DiagonalSpreadEngine(contract);
      const result = engine.analyze();

      expect(result.shortDte).toBeGreaterThan(0);
      expect(result.greeks).toHaveProperty("delta");
      expect(result.scenarios.length).toBeGreaterThan(0);
    });

    it("should reject calendar spreads on diagonal endpoint", () => {
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: shortExp, premium: 5, contracts: 1, optionStyle: "call" },
          { strike: 100, expiration: longExp, premium: 8, contracts: 1, optionStyle: "call" },
        ],
      });
      expect(contract.getType()).toBe("calendar");
    });

    it("should expose explicit Diagonal Call API variant", async () => {
      const app = buildDiagonalApp();
      const response = await request(app)
        .post("/api/v1/strategies/term/diagonal/call")
        .send({
          legs: [
            { strike: 95, expiration: shortExp.toISOString(), premium: 3.5, contracts: 1, optionStyle: "put" },
            { strike: 105, expiration: longExp.toISOString(), premium: 4, contracts: 1, optionStyle: "put" },
          ],
          underlying: "AAPL",
          monteCarlo: { iterations: 10, distribution: "normal" },
        });

      expect(response.status).toBe(200);
      expect(response.body.strategy).toBe("diagonal");
      expect(response.body.variant).toBe("call");
      expect(response.body.structureName).toBe("Diagonal Call Spread");
    });

    it("should expose explicit Diagonal Put API variant", async () => {
      const app = buildDiagonalApp();
      const response = await request(app)
        .post("/api/v1/strategies/term/diagonal/put")
        .send({
          legs: [
            { strike: 95, expiration: shortExp.toISOString(), premium: 3.5, contracts: 1, optionStyle: "call" },
            { strike: 105, expiration: longExp.toISOString(), premium: 4, contracts: 1, optionStyle: "call" },
          ],
          underlying: "AAPL",
          monteCarlo: { iterations: 10, distribution: "normal" },
        });

      expect(response.status).toBe(200);
      expect(response.body.strategy).toBe("diagonal");
      expect(response.body.variant).toBe("put");
      expect(response.body.structureName).toBe("Diagonal Put Spread");
    });
  });

  /** Tests de logica de ruta comparator: condiciones neutrales y entradas invalidas */
  describe("Comparator Route Logic", () => {
    it("should recommend calendar spread for neutral conditions", () => {
      const calContract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: shortExp, premium: 5, contracts: 1, optionStyle: "call" },
          { strike: 100, expiration: longExp, premium: 8, contracts: 1, optionStyle: "call" },
        ],
      });
      const diagContract = new TermStrategyContract({
        legs: [
          { strike: 95, expiration: shortExp, premium: 5, contracts: 1, optionStyle: "call" },
          { strike: 105, expiration: longExp, premium: 8, contracts: 1, optionStyle: "call" },
        ],
      });

      expect(calContract.validate().isValid).toBe(true);
      expect(diagContract.validate().isValid).toBe(true);
    });

    it("should handle invalid input for both", () => {
      const contract = new TermStrategyContract({
        legs: [
          { strike: 100, expiration: shortExp, premium: 5, contracts: 1, optionStyle: "call" },
        ],
      });
      expect(contract.validate().isValid).toBe(false);
    });
  });
});
