// FIC: Phase 6 Bloque C (T130-T134) — Rate limit por user_id JWT, dos buckets (60/min indicadores, 10/min chat).
// FIC: Phase 6 Block C rate limiter — per-user buckets (Q4): 60/min indicators+signals+simulation, 10/min chat.

import type { NextFunction, Request, Response } from "express";

export interface RateBucketState {
  windowStart: number;
  count: number;
}

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  bucket: string;
}

export interface RateLimitStorage {
  get(key: string): RateBucketState | undefined;
  set(key: string, value: RateBucketState): void;
  reset(): void;
}

export class InMemoryRateLimitStorage implements RateLimitStorage {
  private store = new Map<string, RateBucketState>();
  get(key: string) {
    return this.store.get(key);
  }
  set(key: string, value: RateBucketState) {
    this.store.set(key, value);
  }
  reset() {
    this.store.clear();
  }
}

let storage: RateLimitStorage = new InMemoryRateLimitStorage();

export function setRateLimitStorage(next: RateLimitStorage): void {
  storage = next;
}

export function getRateLimitStorage(): RateLimitStorage {
  return storage;
}

export const INDICATORS_BUCKET: RateLimitConfig = {
  windowSeconds: 60,
  maxRequests: 60,
  bucket: "indicators"
};

export const CHAT_BUCKET: RateLimitConfig = {
  windowSeconds: 60,
  maxRequests: 10,
  bucket: "chat"
};

export function createRateLimit(config: RateLimitConfig) {
  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const userId = req.authContext?.userId ?? req.header("x-user-id") ?? "anonymous";
    const key = `${config.bucket}:${userId}`;
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const current = storage.get(key);

    if (!current || now - current.windowStart >= windowMs) {
      storage.set(key, { windowStart: now, count: 1 });
      next();
      return;
    }

    if (current.count >= config.maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.windowStart + windowMs - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error_code: "RATE_LIMITED",
        retry_after_seconds: retryAfterSeconds,
        message: `Limite ${config.maxRequests} req/${config.windowSeconds}s alcanzado.`,
        hint: "Espera el reset de ventana o reduce la frecuencia."
      });
      return;
    }

    storage.set(key, { windowStart: current.windowStart, count: current.count + 1 });
    next();
  };
}

export const indicatorsRateLimit = createRateLimit(INDICATORS_BUCKET);
export const chatRateLimit = createRateLimit(CHAT_BUCKET);
