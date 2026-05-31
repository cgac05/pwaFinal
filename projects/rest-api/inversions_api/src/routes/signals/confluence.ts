// FIC: Confluence signals route — BID/ASK/stop/target anchored to real market price.
// Price fetched from Yahoo Finance; falls back to last known or 100 if unavailable.

import { Router } from "express";

export const signalConfluenceRouter = Router();

const priceCache = new Map<string, { price: number; fetchedAt: number }>();
const PRICE_TTL_MS = 5 * 60 * 1000; // 5 min

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

signalConfluenceRouter.get("/confluence", async (req, res) => {
  const symbol = String(req.query.symbol ?? "SPY").toUpperCase();
  const now = Date.now();

  const basePrice = await getRealPrice(symbol);

  // Typical option spread: ~0.05% of price, min $0.05
  const spread     = Math.max(parseFloat((basePrice * 0.0005).toFixed(2)), 0.05);
  // Stop ~3% below, target ~6% above, strike at-the-money rounded to nearest $5
  const stopDist   = basePrice * 0.03;
  const targetDist = basePrice * 0.06;
  const strikeBase = Math.round(basePrice / 5) * 5;

  const signals = Array.from({ length: 20 }).map((_, idx) => {
    const isBuy    = idx % 2 === 0;
    const time     = new Date(now - idx * 3_600_000).toISOString();
    const confidence = Number((0.45 + ((idx % 7) * 0.07)).toFixed(2));

    const bid    = Number((basePrice - spread + idx * (spread * 0.1)).toFixed(2));
    const ask    = Number((basePrice + spread + idx * (spread * 0.1)).toFixed(2));
    const stop   = Number((basePrice - stopDist   - idx * (stopDist   * 0.05)).toFixed(2));
    const target = Number((basePrice + targetDist + idx * (targetDist * 0.03)).toFixed(2));
    const strike = strikeBase + (idx % 3) * 5 * (isBuy ? 1 : -1);

    return {
      id: `${symbol}-${idx + 1}`,
      symbol,
      timestamp: Math.floor(new Date(time).getTime() / 1000),
      direction: isBuy ? "buy" : "sell",
      confidence,
      metadata: {
        timing_d:              isBuy ? "bullish" : "bearish",
        timing_h:              idx % 3 === 0 ? "confirm" : "watch",
        pre_senal:             isBuy ? "alcista" : "bajista",
        senal_real_activada:   idx % 3 === 0,
        stop,
        objetivo:              target,
        divergencia:           idx % 4 === 0 ? "RSI" : "none",
        z_extrema:             Number((1.2 + idx * 0.03).toFixed(2)),
        cantidad_sugerida:     1 + (idx % 4),
        vencimiento:           new Date(now + 15 * 86_400_000).toISOString(),
        precio_ejercicio:      strike,
        tipo_opcion:           isBuy ? "call" : "put",
        duracion:              3 + (idx % 10),
        bid,
        ask,
        zona_apertura:         `${Number((basePrice * 0.995).toFixed(2))}-${Number((basePrice * 1.005).toFixed(2))}`,
        zona_cierre:           `${Number((basePrice * 1.02).toFixed(2))}-${Number((basePrice * 1.025).toFixed(2))}`,
        stoploss_sugerido:     stop,
        alerta_configurada:    idx % 3 !== 0,
        referencia_maximos:    Number((basePrice * 1.08).toFixed(2)),
        referencia_minimos:    Number((basePrice * 0.92).toFixed(2)),
        variantes_ataque:      "breakout/retest",
        recolocacion_stoploss: "trail 1R",
        liquidez:              idx % 2 === 0 ? "alta" : "media",
        riesgo:                idx % 3 === 0 ? "medio" : "bajo",
        retorno_maximo:        Number((targetDist).toFixed(2)),
        perdida_maxima:        Number((stopDist).toFixed(2))
      }
    };
  });

  res.status(200).json({ signals, base_price: basePrice });
});
