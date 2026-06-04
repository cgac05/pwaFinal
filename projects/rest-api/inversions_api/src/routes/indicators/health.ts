// FIC: REST endpoint GET /api/indicators/health — Phase 6 (T136-T138) chequeo de 3 dependencias.
// FIC: Endpoint REST GET /api/indicators/health — Phase 6 health with OHLC + LLM + Supabase deps.

import { Router } from "express";
import { getCandles } from "../../modules/indicators/ohlcSource";
import { computeRsi } from "../../modules/indicators/rsi";
import { computeMacd } from "../../modules/indicators/macd";
import { computeEma } from "../../modules/indicators/ema";
import { computeAdx } from "../../modules/indicators/adx";
import { computeBollinger } from "../../modules/indicators/bollinger";
import type { OhlcBar, Timeframe } from "../../modules/indicators/types";

export const indicatorsHealthRouter = Router();

type DepStatus = "up" | "degraded" | "down";

interface DependencyReport {
  name: string;
  status: DepStatus;
  latency_ms: number;
  detail?: string;
}

const DEP_TIMEOUT_MS = 1500;

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkOhlcSource(): Promise<DependencyReport> {
  const start = Date.now();
  const result = await withTimeout(
    (async (): Promise<DepStatus> => {
      try {
        const c = await getCandles({ symbol: "AAPL", timeframe: "1h", count: 1 });
        return c.length > 0 ? "up" : "down";
      } catch {
        return "down";
      }
    })(),
    DEP_TIMEOUT_MS,
    "degraded"
  );
  return { name: "ohlc_source", status: result, latency_ms: Date.now() - start };
}

async function checkAnthropic(): Promise<DependencyReport> {
  const start = Date.now();
  // FIC: Sin API key, marcamos degraded en vez de down (no critico para dashboard live).
  if (!process.env.ANTHROPIC_API_KEY || process.env.NODE_ENV === "test") {
    return { name: "anthropic_llm", status: "degraded", latency_ms: Date.now() - start, detail: "no_api_key_or_test_mode" };
  }
  const result = await withTimeout(
    (async (): Promise<DepStatus> => {
      try {
        const mod = await import(/* @vite-ignore */ "@anthropic-ai/sdk" as string).catch(() => null);
        if (!mod) return "degraded";
        const Anthropic = (mod as any).default ?? (mod as any).Anthropic;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        await client.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }]
        });
        return "up";
      } catch {
        return "down";
      }
    })(),
    DEP_TIMEOUT_MS,
    "degraded"
  );
  return { name: "anthropic_llm", status: result, latency_ms: Date.now() - start };
}

async function checkSupabase(): Promise<DependencyReport> {
  const start = Date.now();
  if (process.env.NODE_ENV === "test" || !process.env.SUPABASE_URL) {
    return { name: "supabase", status: "degraded", latency_ms: Date.now() - start, detail: "no_url_or_test_mode" };
  }
  const result = await withTimeout(
    (async (): Promise<DepStatus> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { supabaseClient } = require("../../database/supabase/client");
        const { error } = await supabaseClient.from("chat_explanations").select("id").limit(1);
        return error ? "degraded" : "up";
      } catch {
        return "down";
      }
    })(),
    DEP_TIMEOUT_MS,
    "degraded"
  );
  return { name: "supabase", status: result, latency_ms: Date.now() - start };
}

type CheckStatus = "ok" | "degraded";

// FIC: Run a probe defensively — any throw or null headline degrades, never bubbles up.
// FIC: Ejecuta una sonda de forma defensiva — cualquier excepcion o valor nulo degrada, nunca propaga.
function safeCheck(fn: () => boolean): CheckStatus {
  try {
    return fn() ? "ok" : "degraded";
  } catch {
    return "degraded";
  }
}

indicatorsHealthRouter.get("/health", async (_req, res) => {
  const symbol = "AAPL";
  const timeframe: Timeframe = "1h";
  const meta = { symbol, timeframe };

  let candles: OhlcBar[] = [];
  try {
    candles = await getCandles({ symbol, timeframe, count: 300 });
  } catch {
    candles = [];
  }

  const indicators = {
    rsi: safeCheck(() => computeRsi(candles, { period: 14 }, meta).current_value !== null),
    macd: safeCheck(() => computeMacd(candles, { fast: 12, slow: 26, signal: 9 }, meta).current_value.histogram !== null),
    ema: safeCheck(() => computeEma(candles, { period: 20 }, meta).current_value !== null),
    adx: safeCheck(() => computeAdx(candles, { period: 14 }, meta).current_value.adx !== null),
    bollinger: safeCheck(() => computeBollinger(candles, { period: 20, stdDev: 2 }, meta).current_value.middle !== null)
  };

  // FIC: T136/T137 — 3 dependencias en paralelo con timeout 1.5s c/u.
  const dependencies = await Promise.all([checkOhlcSource(), checkAnthropic(), checkSupabase()]);

  const upCount = dependencies.filter((d) => d.status === "up").length;
  const allDown = dependencies.every((d) => d.status === "down");
  const httpStatus = allDown ? 503 : 200;
  const overall: DepStatus = allDown ? "down" : upCount === dependencies.length ? "up" : "degraded";

  return res.status(httpStatus).json({
    status: overall,
    dependencies,
    indicators,
    timestamp: new Date().toISOString()
  });
});
