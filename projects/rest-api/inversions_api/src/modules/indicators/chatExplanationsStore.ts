// FIC: Phase 6 Bloque B (T125-T129) — Persistencia chat_explanations con TTL 90 dias (Q3).
// FIC: Phase 6 Block B — chat_explanations persistence with 90-day TTL.

import type { ChatExplanationResponse } from "./chatExplainer";

export const CHAT_TTL_DAYS = 90;

export interface ChatExplanationRecord {
  id?: string;
  user_id?: string;
  symbol: string;
  timeframe: string;
  question: string;
  explanation_text: string;
  indicators_cited: unknown;
  disclaimer: string;
  model_version: string;
  tokens_in: number;
  tokens_out: number;
  computed_at: string;
  expires_at: string;
}

export interface ChatStoreClient {
  insert(record: ChatExplanationRecord): Promise<void>;
  list(userId?: string): Promise<ChatExplanationRecord[]>;
  purgeExpired(now?: Date): Promise<number>;
}

export class InMemoryChatStore implements ChatStoreClient {
  private rows: ChatExplanationRecord[] = [];

  async insert(record: ChatExplanationRecord): Promise<void> {
    this.rows.push(record);
  }

  async list(userId?: string): Promise<ChatExplanationRecord[]> {
    return this.rows.filter((r) => !userId || r.user_id === userId);
  }

  async purgeExpired(now: Date = new Date()): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => Date.parse(r.expires_at) > now.getTime());
    return before - this.rows.length;
  }
}

export function buildChatRecord(opts: {
  response: ChatExplanationResponse;
  question: string;
  symbol: string;
  timeframe: string;
  userId?: string;
  tokensIn?: number;
  tokensOut?: number;
  now?: Date;
}): ChatExplanationRecord {
  const now = opts.now ?? new Date();
  const expires = new Date(now.getTime() + CHAT_TTL_DAYS * 86_400_000);
  return {
    user_id: opts.userId,
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    question: opts.question,
    explanation_text: opts.response.explanation_text,
    indicators_cited: opts.response.indicators_cited,
    disclaimer: opts.response.disclaimer,
    model_version: opts.response.model_version,
    tokens_in: opts.tokensIn ?? 0,
    tokens_out: opts.tokensOut ?? 0,
    computed_at: opts.response.computed_at,
    expires_at: expires.toISOString()
  };
}

let defaultStore: ChatStoreClient = new InMemoryChatStore();
export function getChatStore(): ChatStoreClient {
  return defaultStore;
}
export function setChatStore(store: ChatStoreClient): void {
  defaultStore = store;
}

// FIC: T127 — Job de purga (invocable desde pg_cron via supabase edge function o setInterval).
// FIC: T128 — resiliencia: logs estructurados + retry counter expuesto al caller.
export interface PurgeJobOptions {
  now?: Date;
  logger?: (event: { type: string; payload?: any }) => void;
}

let purgeFailureStreak = 0;

export async function runChatPurgeJob(
  store: ChatStoreClient = getChatStore(),
  opts: PurgeJobOptions = {}
): Promise<{ purged: number; failureStreak: number }> {
  const logger = opts.logger ?? (() => {});
  try {
    const purged = await store.purgeExpired(opts.now);
    purgeFailureStreak = 0;
    logger({ type: "chat_purge_ok", payload: { purged } });
    return { purged, failureStreak: 0 };
  } catch (err) {
    purgeFailureStreak += 1;
    logger({ type: "chat_purge_error", payload: { error: String(err), streak: purgeFailureStreak } });
    if (purgeFailureStreak >= 3) {
      logger({ type: "chat_purge_alert", payload: { streak: purgeFailureStreak } });
    }
    return { purged: 0, failureStreak: purgeFailureStreak };
  }
}

export function resetChatPurgeStreak(): void {
  purgeFailureStreak = 0;
}
