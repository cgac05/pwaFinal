/**
 * T004-T078: Servicio de integración con fuentes externas de datos fundamentales
 * Implementa abstracción DataSource, caché, rate limiter y fallback chain.
 *
 * T004-T078: External data source integration service
 * Implements DataSource abstraction, caching, rate limiting, and fallback chain.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FundamentalAnalysisData } from "./fundamentalSourceContract";

/**
 * T004a: Interfaz PluggableSource para múltiples proveedores de datos
 */
export interface DataSourceConfig {
  id: string; // "finviz", "yahoo_finance", "alphavantage"
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: {
    requestsPerMin: number;
    burstAllowed: number;
  };
}

export interface DataSourceResult {
  success: boolean;
  data?: FundamentalAnalysisData;
  error?: string;
  timestamp: string;
  cost?: number; // API cost in credits/money
  costMetric?: string; // "credits", "calls"
}

export interface PluggableSource {
  config: DataSourceConfig;
  fetch(ticker: string, lookbackDays?: number): Promise<DataSourceResult>;
  validate(data: FundamentalAnalysisData): boolean;
  isHealthy(): Promise<boolean>;
}

/**
 * T004a: Implementación simulada de DataSource para Finviz
 */
export class FinvizDataSource implements PluggableSource {
  config: DataSourceConfig;

  constructor(apiKey?: string) {
    this.config = {
      id: "finviz",
      name: "Finviz",
      baseUrl: "https://api.finviz.com/v1/",
      apiKey,
      rateLimit: {
        requestsPerMin: 60,
        burstAllowed: 5
      }
    };
  }

  async fetch(ticker: string, lookbackDays: number = 252): Promise<DataSourceResult> {
    // 🧠 FIC: Simulación de fetch desde Finviz (EN)
    // 🧠 FIC: Simulated Finviz fetch (ES)
    try {
      console.log(`[FinvizDataSource] Fetching ${ticker} (lookback: ${lookbackDays}d)`);

      // Simular delay de API
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulación de datos exitosos
      const data: FundamentalAnalysisData = {
        ticker,
        companyName: `Company ${ticker}`,
        metrics: {
          marketCap: {
            value: 150000000000,
            currency: "USD",
            timestamp: new Date().toISOString()
          },
          priceHistory: {
            currentPrice: 150.25,
            priceChange52WeekPercent: 25.3,
            priceHigh52Week: 180.5,
            priceLow52Week: 110.2,
            avgVolume10Day: 45000000,
            timestamp: new Date().toISOString()
          },
          volatility: {
            annualizedVolatility: 28.35,
            lookbackDays,
            calculationMethod: "historical",
            timestamp: new Date().toISOString()
          },
          financialRatios: {
            roe: 85.42,
            peRatio: 28.5,
            pbRatio: 42.3,
            psRatio: 6.8,
            debtToEquity: 0.45,
            timestamp: new Date().toISOString()
          },
          beta: {
            value: 1.15,
            confidenceLevel: "HIGH",
            calculationMethod: "60-month rolling",
            timestamp: new Date().toISOString()
          },
          eps: {
            eps: 5.27,
            epsGrowthYoYPercent: 12.5,
            timestamp: new Date().toISOString()
          },
          dividend: {
            annualDividendPerShare: 0.92,
            dividendYieldPercent: 0.61,
            payoutRatio: 17.5,
            lastPaymentDate: new Date().toISOString().split("T")[0],
            exDividendDate: new Date().toISOString().split("T")[0],
            timestamp: new Date().toISOString()
          },
          sector: {
            sector: "Technology",
            industry: "Software",
            subIndustry: "Application Software",
            timestamp: new Date().toISOString()
          }
        },
        metadata: {
          sourceId: "finviz",
          fetchTimestamp: new Date().toISOString(),
          dataVersion: "v1.0",
          assumptions: {
            volatilityCalculationMethod: "historical",
            lookbackPeriod: lookbackDays,
            riskFreeRate: 4.5,
            marketIndexBench: "SPX"
          },
          quality: {
            completenessPercent: 95,
            lastValidation: new Date().toISOString()
          }
        }
      };

      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        cost: 1,
        costMetric: "credits"
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  validate(data: FundamentalAnalysisData): boolean {
    return !!(
      data.ticker &&
      data.metrics.priceHistory &&
      data.metrics.volatility &&
      data.metadata.sourceId === "finviz"
    );
  }

  async isHealthy(): Promise<boolean> {
    // 🧠 FIC: Health check simulado (EN)
    // 🧠 FIC: Simulated health check (ES)
    try {
      const testData = await this.fetch("AAPL");
      return !!testData?.success; // ✅ Double negation converts to boolean
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }
}

/**
 * T004a: Implementación simulada de DataSource para Yahoo Finance
 */
export class YahooFinanceDataSource implements PluggableSource {
  config: DataSourceConfig;

  constructor(apiKey?: string) {
    this.config = {
      id: "yahoo_finance",
      name: "Yahoo Finance",
      baseUrl: "https://query1.finance.yahoo.com/",
      apiKey,
      rateLimit: {
        requestsPerMin: 60,
        burstAllowed: 3
      }
    };
  }

  async fetch(ticker: string, lookbackDays: number = 252): Promise<DataSourceResult> {
    // Similar to Finviz but from Yahoo
    try {
      console.log(`[YahooFinanceDataSource] Fetching ${ticker}`);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const data: FundamentalAnalysisData = {
        ticker,
        companyName: `Company ${ticker}`,
        metrics: {
          marketCap: {
            value: 148000000000,
            currency: "USD",
            timestamp: new Date().toISOString()
          },
          priceHistory: {
            currentPrice: 149.75,
            priceChange52WeekPercent: 24.8,
            priceHigh52Week: 179.8,
            priceLow52Week: 111.3,
            avgVolume10Day: 46000000,
            timestamp: new Date().toISOString()
          },
          volatility: {
            annualizedVolatility: 27.92,
            lookbackDays,
            calculationMethod: "historical",
            timestamp: new Date().toISOString()
          },
          financialRatios: {
            roe: 84.1,
            peRatio: 27.9,
            pbRatio: 41.8,
            psRatio: 6.7,
            debtToEquity: 0.47,
            timestamp: new Date().toISOString()
          }
        },
        metadata: {
          sourceId: "yahoo_finance",
          fetchTimestamp: new Date().toISOString(),
          dataVersion: "v1.0",
          assumptions: {
            volatilityCalculationMethod: "historical",
            lookbackPeriod: lookbackDays,
            riskFreeRate: 4.5,
            marketIndexBench: "SPX"
          },
          quality: {
            completenessPercent: 75,
            lastValidation: new Date().toISOString()
          }
        }
      };

      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        cost: 0,
        costMetric: "free"
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  validate(data: FundamentalAnalysisData): boolean {
    return !!(data.ticker && data.metadata.sourceId === "yahoo_finance");
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.fetch("AAPL", 30);
      return !!result.success; // ✅ Double negation converts to boolean
    } catch {
      return false;
    }
  }
}

/**
 * T004b, T004c, T004d: FundamentalDataService con caché, rate limiter y fallback
 */
export interface CacheEntry {
  data: FundamentalAnalysisData;
  timestamp: string;
  ttlSeconds: number;
}

export class FundamentalDataService {
  private sources: PluggableSource[];
  private supabaseClient?: SupabaseClient;
  private requestTimestamps: Map<string, number[]> = new Map();

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient;

    // T004a: Registrar fuentes disponibles
    this.sources = [new FinvizDataSource(), new YahooFinanceDataSource()];

    console.log(`[FundamentalDataService] Initialized with ${this.sources.length} data sources`);
  }

  /**
   * T004c: Rate limiter - máximo 60 req/min por fuente
   * Retorna true si la solicitud está dentro del límite
   */
  private async checkRateLimit(sourceId: string): Promise<boolean> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxRequests = 60;

    const key = `rate_limit:${sourceId}`;
    const timestamps = this.requestTimestamps.get(key) || [];

    // Limpiar timestamps antiguos
    const recentTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (recentTimestamps.length >= maxRequests) {
      // Backoff exponencial: esperar un tiempo proporcional
      const exceedCount = recentTimestamps.length - maxRequests + 1;
      const backoffMs = Math.min(1000 * Math.pow(2, exceedCount), 30000);
      console.warn(
        `[FundamentalDataService] Rate limit exceeded for ${sourceId}. Backoff: ${backoffMs}ms`
      );
      return false;
    }

    recentTimestamps.push(now);
    this.requestTimestamps.set(key, recentTimestamps);
    return true;
  }

  /**
   * T004b: Fetch desde caché Supabase con TTL
   * TTL: precio 5min, ratios 1h
   */
  private async getFromCache(ticker: string): Promise<CacheEntry | null> {
    if (!this.supabaseClient) {
      return null;
    }

    try {
      const { data, error } = await this.supabaseClient
        .from("fundamental_data_cache")
        .select("*")
        .eq("ticker", ticker)
        .single();

      if (error || !data) {
        return null;
      }

      const cachedData = data as any;
      const timestamp = new Date(cachedData.cached_at).getTime();
      const now = Date.now();
      const age = (now - timestamp) / 1000; // segundos

      // T004b: Aplicar TTL según tipo de dato
      const ttlSeconds = cachedData.data.metrics?.priceHistory ? 300 : 3600; // 5min vs 1h

      if (age > ttlSeconds) {
        console.log(`[FundamentalDataService] Cache expired for ${ticker} (age: ${age}s)`);
        return null;
      }

      return {
        data: cachedData.data,
        timestamp: cachedData.cached_at,
        ttlSeconds
      };
    } catch (error) {
      console.warn(`[FundamentalDataService] Cache fetch error for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * T004d: Fallback chain con caché stale
   * Intenta: Finviz → Yahoo → caché stale
   */
  async fetch(ticker: string, lookbackDays: number = 252): Promise<DataSourceResult> {
    console.log(`[FundamentalDataService] Fetching ${ticker}...`);

    // Intentar obtener del caché primero
    const cachedEntry = await this.getFromCache(ticker);
    if (cachedEntry) {
      console.log(`[FundamentalDataService] Cache HIT for ${ticker}`);
      return {
        success: true,
        data: cachedEntry.data,
        timestamp: new Date().toISOString(),
        cost: 0,
        costMetric: "cache"
      };
    }

    // T004d: Fallback chain
    for (const source of this.sources) {
      // T004c: Verificar rate limit
      const canProceed = await this.checkRateLimit(source.config.id);
      if (!canProceed) {
        console.warn(`[FundamentalDataService] Rate limit exceeded for ${source.config.id}`);
        continue;
      }

      // T004e: Logging de ingestión
      const fetchStart = Date.now();
      const result = await source.fetch(ticker, lookbackDays);
      const fetchDuration = Date.now() - fetchStart;

      console.log(
        `[FundamentalDataService] Source ${source.config.id}: ${result.success ? "SUCCESS" : "FAILED"} (${fetchDuration}ms)`
      );

      if (result.success && result.data) {
        // Guardar en caché
        if (this.supabaseClient) {
          await this.cacheData(ticker, result.data);
        }

        // T004e: Log exitoso
        await this.auditLog({
          action: "data_fetched",
          ticker,
          source: source.config.id,
          success: true,
          durationMs: fetchDuration,
          cost: result.cost || 0,
          costMetric: result.costMetric || "unknown"
        });

        return result;
      }

      // Continuar con siguiente fuente
    }

    // T004d: Si todas fallan, intentar caché stale
    console.log(`[FundamentalDataService] All sources failed. Attempting stale cache...`);
    const staleEntry = await this.getStaleCache(ticker);

    if (staleEntry) {
      // T004e: Log con disclaimer
      await this.auditLog({
        action: "stale_cache_served",
        ticker,
        source: "cache",
        success: true,
        ageSeconds: Math.floor(
          (Date.now() - new Date(staleEntry.timestamp).getTime()) / 1000
        )
      });

      return {
        success: true,
        data: staleEntry.data,
        timestamp: new Date().toISOString(),
        cost: 0,
        costMetric: "stale_cache"
      };
    }

    return {
      success: false,
      error: `All data sources failed for ${ticker} and no cache available`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Guardar datos en caché
   */
  private async cacheData(ticker: string, data: FundamentalAnalysisData): Promise<void> {
    if (!this.supabaseClient) {
      return;
    }

    try {
      await this.supabaseClient.from("fundamental_data_cache").upsert({
        ticker,
        data,
        cached_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn(`[FundamentalDataService] Cache write error for ${ticker}:`, error);
    }
  }

  /**
   * Obtener caché stale (sin respetar TTL)
   */
  private async getStaleCache(ticker: string): Promise<CacheEntry | null> {
    if (!this.supabaseClient) {
      return null;
    }

    try {
      const { data, error } = await this.supabaseClient
        .from("fundamental_data_cache")
        .select("*")
        .eq("ticker", ticker)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        data: data.data as FundamentalAnalysisData,
        timestamp: data.cached_at,
        ttlSeconds: -1 // Indicate stale
      };
    } catch (error) {
      console.warn(`[FundamentalDataService] Stale cache fetch error:`, error);
      return null;
    }
  }

  /**
   * T004e: Registrar en auditoría
   */
  private async auditLog(entry: Record<string, any>): Promise<void> {
    if (!this.supabaseClient) {
      console.log("[FundamentalDataService] Audit:", entry);
      return;
    }

    try {
      await this.supabaseClient.from("audit_trail").insert({
        action: entry.action,
        details: entry,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn("[FundamentalDataService] Audit log error:", error);
    }
  }

  /**
   * Verificar health de fuentes
   */
  async getSourceHealth(): Promise<
    Array<{
      sourceId: string;
      healthy: boolean;
    }>
  > {
    const health = await Promise.all(
      this.sources.map(async (source) => ({
        sourceId: source.config.id,
        healthy: await source.isHealthy()
      }))
    );

    return health;
  }
}
