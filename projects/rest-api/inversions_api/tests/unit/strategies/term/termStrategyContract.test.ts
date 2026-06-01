/**
 * Tests de termStrategyContract.ts — T162 (T200 para validacion de fechas)
 * Cobertura: validacion de legs, consistencia temporal, estilo de opcion,
 * clasificacion Calendar vs Diagonal, errores de fecha (Invalid Date, pasado).
 * Modulo bajo prueba: TermStrategyContract (contrato base)
 */
import { describe, it, expect } from "vitest";
import {
  TermStrategyContract,
  TermStrategyError,
  type TermStrategyInput,
  type ValidationResult,
} from "../../../../src/modules/strategies/term/termStrategyContract";

/** Helper: crea input valido con 2 legs call mismo strike, expiraciones jun/sep 2026 */
function makeInput(overrides?: Partial<TermStrategyInput>): TermStrategyInput {
  return {
    legs: [
      { strike: 100, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
      { strike: 100, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
    ],
    underlying: "SPY",
    ...overrides,
  };
}

/** Tests de TermStrategyContract: constructor, validate (calendar/diagonal validos, errores: legs, expiraciones, estilo, fechas), getType, getLegs, getInput, TermStrategyError factories */
describe("TermStrategyContract", () => {
  /** Verifica que el constructor acepta input calendar y diagonal */
  describe("constructor", () => {
    it("should accept valid calendar spread input", () => {
      const contract = new TermStrategyContract(makeInput());
      expect(contract).toBeInstanceOf(TermStrategyContract);
    });

    it("should accept valid diagonal spread input", () => {
      const input = makeInput({ legs: [
        { strike: 95, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 105, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]});
      const contract = new TermStrategyContract(input);
      expect(contract).toBeInstanceOf(TermStrategyContract);
    });
  });

  /** Tests de validate: calendar/diagonal validos, errores por legs insuficientes/vacios/null, expiraciones iguales/diferencia<7d, estilo invalido, mixed call/put, premium negativo, strike<=0, contracts<=0, no-spread, vertical spread, fecha invalida, fecha pasada */
  describe("validate", () => {
    it("should return isValid=true for valid calendar spread", () => {
      const contract = new TermStrategyContract(makeInput());
      const result = contract.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return isValid=true for valid diagonal spread", () => {
      const input = makeInput({ legs: [
        { strike: 95, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 105, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]});
      const contract = new TermStrategyContract(input);
      const result = contract.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject input with fewer than 2 legs", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "INSUFFICIENT_LEGS")).toBe(true);
    });

    it("should reject input with empty legs", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [] }));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "INSUFFICIENT_LEGS")).toBe(true);
    });

    it("should reject input with null legs", () => {
      const contract = new TermStrategyContract(makeInput({ legs: undefined as any }));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "INSUFFICIENT_LEGS")).toBe(true);
    });

    it("should reject when all legs have the same expiration (no time spread)", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-06-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_CONFIGURATION")).toBe(true);
    });

    it("should reject when expiration difference is less than 7 days", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-06-18"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "TEMPORAL_INCONSISTENCY")).toBe(true);
    });

    it("should reject invalid option style", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "invalid" as any },
        { strike: 100, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_OPTION_STYLE")).toBe(true);
    });

    it("should reject mixed call and put legs", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "put" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_CONFIGURATION")).toBe(true);
    });

    it("should reject negative premium", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2026-06-15"), premium: -5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_CONFIGURATION")).toBe(true);
    });

    it("should reject non-positive strike", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 0, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
    });

    it("should reject non-positive contracts", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 0, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
    });

    it("should reject same strike and same expiration (not a spread)", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-06-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
    });

    it("should reject different strikes with same expiration (vertical spread)", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 95, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 105, expiration: new Date("2026-06-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
    });

    it("should reject invalid date format (NaN)", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("invalid-date"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "INVALID_DATE_FORMAT")).toBe(true);
    });

    it("should reject expiration date in the past", () => {
      const contract = new TermStrategyContract(makeInput({ legs: [
        { strike: 100, expiration: new Date("2020-01-01"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 100, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]}));
      const result = contract.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === "EXPIRATION_IN_PAST")).toBe(true);
    });
  });

  /** Tests de getType: calendar (mismos strikes), diagonal (strikes distintos) */
  describe("getType", () => {
    it("should return 'calendar' when strikes are the same", () => {
      const contract = new TermStrategyContract(makeInput());
      expect(contract.getType()).toBe("calendar");
    });

    it("should return 'diagonal' when strikes are different", () => {
      const input = makeInput({ legs: [
        { strike: 95, expiration: new Date("2026-06-15"), premium: 5.0, contracts: 1, optionStyle: "call" },
        { strike: 105, expiration: new Date("2026-09-15"), premium: 8.0, contracts: 1, optionStyle: "call" },
      ]});
      const contract = new TermStrategyContract(input);
      expect(contract.getType()).toBe("diagonal");
    });
  });

  /** Verifica que getLegs retorna copia (inmutable) */
  describe("getLegs", () => {
    it("should return a copy of the legs", () => {
      const contract = new TermStrategyContract(makeInput());
      const legs = contract.getLegs();
      expect(legs).toHaveLength(2);
      legs[0] = { strike: 999, expiration: new Date(), premium: 0, contracts: 0, optionStyle: "call" };
      const legsAgain = contract.getLegs();
      expect(legsAgain[0].strike).toBe(100);
    });
  });

  /** Verifica que getInput retorna copia del input original */
  describe("getInput", () => {
    it("should return a copy of the input", () => {
      const original = makeInput();
      const contract = new TermStrategyContract(original);
      const retrieved = contract.getInput();
      expect(retrieved.underlying).toBe("SPY");
      expect(retrieved.legs).toHaveLength(2);
    });
  });

  /** Tests de factory methods de TermStrategyError: constructor, temporalInconsistency, invalidOptionStyle, insufficientLegs */
  describe("TermStrategyError", () => {
    it("should create error with code, message, and field", () => {
      const error = new TermStrategyError("TEST_CODE", "Test message", "testField");
      expect(error.code).toBe("TEST_CODE");
      expect(error.message).toBe("Test message");
      expect(error.field).toBe("testField");
    });

    it("should create temporalInconsistency error", () => {
      const error = TermStrategyError.temporalInconsistency("expiration", "Short expiration must be before long expiration.");
      expect(error.code).toBe("TEMPORAL_INCONSISTENCY");
      expect(error.field).toBe("expiration");
    });

    it("should create invalidOptionStyle error", () => {
      const error = TermStrategyError.invalidOptionStyle("invalid");
      expect(error.code).toBe("INVALID_OPTION_STYLE");
    });

    it("should create insufficientLegs error", () => {
      const error = TermStrategyError.insufficientLegs(1);
      expect(error.code).toBe("INSUFFICIENT_LEGS");
    });
  });
});
