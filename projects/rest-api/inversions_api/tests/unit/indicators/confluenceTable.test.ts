// FIC: Unit tests T093 — adapter confluenceTable.ts produce filas por subCore + agregada.
// FIC: Unit tests for the confluenceTable adapter (Phase 5 Bloque A).

import { describe, expect, it } from "vitest";
import { buildIndicatorsTable } from "../../../src/modules/indicators/confluenceTable";
import type { OhlcBar } from "../../../src/modules/indicators/types";

function bar(time: number, close: number, spread = 1.5): OhlcBar {
  return { time, open: close, high: close + spread, low: close - spread, close, volume: 1000 };
}

const CANDLES: OhlcBar[] = Array.from({ length: 90 }, (_, i) => bar(i, 100 + i * 1.5));

describe("buildIndicatorsTable", () => {
  it("emits 1 aggregated row + 5 subCore rows by default", () => {
    const rows = buildIndicatorsTable({ ticket: "AAPL", timeframe: "1h", candles: CANDLES });
    expect(rows).toHaveLength(6);
    expect(rows[0].core).toBe("A_INDICADORES");
    expect(rows[0].subCore).toBeUndefined();
    expect(rows.slice(1).every((r) => r.core === "A_INDICADORES" && !!r.subCore)).toBe(true);
  });

  it("filters subCores when enabledSubCores is provided", () => {
    const rows = buildIndicatorsTable({
      ticket: "AAPL",
      timeframe: "1h",
      candles: CANDLES,
      enabledSubCores: ["RSI", "MACD"]
    });
    const subs = rows.filter((r) => !!r.subCore).map((r) => r.subCore);
    expect(subs.sort()).toEqual(["MACD", "RSI"]);
  });

  it("emits idempotent rows: same candles -> same score and hash", () => {
    const a = buildIndicatorsTable({ ticket: "AAPL", timeframe: "1h", candles: CANDLES });
    const b = buildIndicatorsTable({ ticket: "AAPL", timeframe: "1h", candles: CANDLES });
    expect(a[0].score).toBe(b[0].score);
    expect(a[0].source_input_hash).toBe(b[0].source_input_hash);
  });

  it("degrades subCore rows when there are too few candles", () => {
    const few: OhlcBar[] = Array.from({ length: 5 }, (_, i) => bar(i, 100 + i));
    const rows = buildIndicatorsTable({ ticket: "AAPL", timeframe: "1h", candles: few });
    const degradedRows = rows.filter((r) => r.estado === "DEGRADADA");
    expect(degradedRows.length).toBeGreaterThan(0);
  });
});
