import { Router } from "express";
import { SupabaseClient } from "@supabase/supabase-js";

interface NewsArchiveRow {
  id: string;
  symbol: string | null;
  headline: string;
  summary: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  relevance_score: number | string | null;
  source: string | null;
  url: string | null;
  published_at: string;
  archived_at: string;
}

export interface RelevantNewsItem {
  id: string;
  symbol: string | null;
  headline: string;
  summary: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  relevanceScore: number | null;
  source: string | null;
  url: string | null;
  publishedAt: string;
  archivedAt: string;
}

function parseTicker(rawTicker: string | undefined): string {
  return (rawTicker ?? "").trim().toUpperCase();
}

function parseLimit(rawLimit: unknown): number {
  const parsed = Number(rawLimit ?? 5);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(Math.max(Math.trunc(parsed), 1), 12);
}

function mapRow(row: NewsArchiveRow): RelevantNewsItem {
  return {
    id: row.id,
    symbol: row.symbol,
    headline: row.headline,
    summary: row.summary,
    sentiment: row.sentiment,
    relevanceScore:
      row.relevance_score === null || row.relevance_score === ""
        ? null
        : Number(row.relevance_score),
    source: row.source,
    url: row.url,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
  };
}

export function createRelevantNewsRouter(supabaseClient: SupabaseClient): Router {
  const router = Router();

  router.get("/relevant", async (req, res) => {
    try {
      const ticker = parseTicker(typeof req.query.ticker === "string" ? req.query.ticker : undefined);
      const limit = parseLimit(req.query.limit);

      if (!ticker) {
        return res.status(400).json({ error: "ticker_required" });
      }

      const { data, error } = await supabaseClient
        .from("news_archive")
        .select("id,symbol,headline,summary,sentiment,relevance_score,source,url,published_at,archived_at")
        .or(`symbol.eq.${ticker},symbol.is.null`)
        .order("published_at", { ascending: false })
        .limit(limit);

      if (error) {
        return res.status(500).json({
          error: "news_lookup_failed",
          message: error.message,
        });
      }

      const rows = (data ?? []) as NewsArchiveRow[];

      return res.status(200).json({
        ticker,
        count: rows.length,
        items: rows.map(mapRow),
        source: "supabase",
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({
        error: "news_lookup_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}