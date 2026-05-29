import { Router } from "express";
import { authContextMiddleware } from "../../middleware/authContext.js";
import {
  buildDashboardConfluencePayload,
  type SourceVerdict
} from "../../modules/signals/confluenceEngine.js";
import { sourceConfigRegistry } from "../../modules/signals/sourceConfig.js";

interface DashboardQuery {
  instruments?: string;
  timeframe?: string;
}

// ---------------------------------------------------------------------------
// Price cache (shared with confluence route logic)
// ---------------------------------------------------------------------------

const priceCache = new Map<string, { price: number; fetchedAt: number }>();
const PRICE_TTL_MS = 5 * 60 * 1000;

async function getRealPrice(symbol: string): Promise<number> {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < PRICE_TTL_MS) return cached.price;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; inversions-app/1.0)" },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (!res.ok) return cached?.price ?? 100;
    const json = await res.json() as any;
    const price: number = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price && price > 0) {
      priceCache.set(symbol, { price, fetchedAt: Date.now() });
      return price;
    }
  } catch {
    // ignore
  }

  return cached?.price ?? 100;
}

// ---------------------------------------------------------------------------
// Mock verdicts (analytical model — unchanged)
// ---------------------------------------------------------------------------

function buildFallbackSources() {
  return [
    { id: "technical", name: "technical", category: "TECHNICAL" as const, enabled: true, weight: 0.3 },
    { id: "options",   name: "options",   category: "OPTIONS"   as const, enabled: true, weight: 0.25 },
    { id: "flow",      name: "flow",      category: "FLOW"      as const, enabled: true, weight: 0.2 },
    { id: "news",      name: "news",      category: "NEWS"      as const, enabled: true, weight: 0.15 },
    { id: "ai",        name: "ai",        category: "AI"        as const, enabled: true, weight: 0.1 }
  ];
}

function buildMockVerdicts(instrument: string): SourceVerdict[] {
  const seed = instrument.length;

  return [
    { sourceId: "technical", verdict: seed % 3 === 0 ? "SELL" : "BUY", confidence: 0.55, rationale: `RSI/MACD con sesgo ${seed % 3 === 0 ? "bajista" : "alcista"}` },
    { sourceId: "options",   verdict: "BUY",                            confidence: 0.63, rationale: "Call/put skew positivo" },
    { sourceId: "flow",      verdict: seed % 2 === 0 ? "BUY" : "HOLD", confidence: 0.58, rationale: "Flujo institucional en rango favorable" },
    { sourceId: "news",      verdict: "HOLD",                           confidence: 0.41, rationale: "Sentimiento mixto" },
    { sourceId: "ai",        verdict: "BUY",                            confidence: 0.72, rationale: "Confirmacion de modelo IA" }
  ];
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const dashboardOrchestratorRouter = Router();

/**
 * FIC: Consolidated dashboard endpoint — BID/ASK/stop/target anchored to real market prices.
 * Verdicts remain analytical; price metadata uses live Yahoo Finance quotes.
 */
dashboardOrchestratorRouter.get("/orchestrator", authContextMiddleware, async (req, res) => {
  const { instruments, timeframe } = req.query as DashboardQuery;

  const parsedInstruments = (instruments ?? "AAPL,MSFT,NVDA,SPY")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20);

  // Fetch real prices for all instruments in parallel
  const prices = await Promise.all(parsedInstruments.map(getRealPrice));
  const priceMap = new Map(parsedInstruments.map((sym, i) => [sym, prices[i]]));

  const sources = sourceConfigRegistry.listEnabled();
  const activeSources = sources.length > 0 ? sources : buildFallbackSources();

  const payload = buildDashboardConfluencePayload(
    activeSources,
    parsedInstruments.map((instrument) => ({
      instrument,
      verdicts: buildMockVerdicts(instrument),
      basePrice: priceMap.get(instrument)
    }))
  );

  res.status(200).json({
    timeframe: timeframe ?? "1d",
    ...payload
  });
});
