import { describe, it, expect } from "vitest";
import { FinvizDataSource, YahooFinanceDataSource, FundamentalDataService } from "../../../src/modules/fundamental/fundamentalDataService";

describe("FundamentalDataService sources", () => {
  it("FinvizDataSource.fetch returns success and data shape", async () => {
    const src = new FinvizDataSource();
    const res = await src.fetch("AAPL", 30);
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.ticker).toBe("AAPL");
    expect(res.data?.metrics).toBeDefined();
  });

  it("YahooFinanceDataSource.fetch returns success and data shape", async () => {
    const src = new YahooFinanceDataSource();
    const res = await src.fetch("MSFT", 30);
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.ticker).toBe("MSFT");
  });
});

describe("FundamentalDataService integration (no supabase)", () => {
  it("fetch returns result using fallback chain when cache absent", async () => {
    const service = new FundamentalDataService(undefined as any);
    const res = await service.fetch("AAPL", 30);
    expect(res.success).toBe(true);
    expect(res.data?.ticker).toBe("AAPL");
  });
});
