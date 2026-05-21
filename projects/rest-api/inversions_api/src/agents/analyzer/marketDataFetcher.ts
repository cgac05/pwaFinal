/**
 * Market Data Fetcher - Mock Implementation
 * T152: Analyzer Agent - Data Fetching
 * 
 * In production, this would fetch real data from Alpaca/IBKR APIs
 * For testing, provides realistic mock OHLCV data
 */

import { CandleData, MarketContext, QuoteData } from '../types/marketData';
import { logger } from '../utils/logger';

export class MarketDataFetcher {
  /**
   * Fetch current market quote for a symbol
   * @param symbol Stock symbol (e.g., 'AAPL')
   * @returns Quote with current price, bid, ask, IV
   */
  async fetchQuote(symbol: string): Promise<QuoteData> {
    try {
      // In production: Call Alpaca/IBKR API
      // return alpacaClient.getQuote(symbol);

      // Mock implementation
      logger.debug(`Fetching quote for ${symbol}`);
      
      // Simulate realistic price data
      const mockPrices: Record<string, number> = {
        'AAPL': 195.32,
        'MSFT': 427.15,
        'TSLA': 242.84,
        'GOOGL': 175.42,
        'AMZN': 186.95,
      };

      const lastPrice = mockPrices[symbol] || 150 + Math.random() * 100;
      const spread = lastPrice * 0.0001; // 1 basis point spread

      return {
        symbol,
        timestamp: Date.now(),
        bid: lastPrice - spread,
        ask: lastPrice + spread,
        last: lastPrice,
        volume: Math.floor(Math.random() * 10000000),
        impliedVolatility: 0.18 + Math.random() * 0.15, // 18-33% IV
      };
    } catch (error) {
      logger.error(`Error fetching quote for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch historical OHLCV candles
   * @param symbol Stock symbol
   * @param timeframe Timeframe ('1h' or '1d')
   * @param limit Number of candles to fetch
   * @returns Array of OHLCV candles
   */
  async fetchOHLCV(
    symbol: string,
    timeframe: '1h' | '1d',
    limit: number = 100
  ): Promise<CandleData[]> {
    try {
      logger.debug(`Fetching ${limit} ${timeframe} candles for ${symbol}`);

      // In production: Call Alpaca/IBKR API
      // return alpacaClient.getBars(symbol, timeframe, limit);

      // Mock implementation - generate realistic OHLCV data
      const candles: CandleData[] = [];
      let currentPrice = 195.32; // AAPL baseline

      const intervalMs = timeframe === '1h' ? 3600000 : 86400000; // 1h or 1d in ms
      let timestamp = Date.now() - intervalMs * limit;

      for (let i = 0; i < limit; i++) {
        // Random walk with mean reversion
        const change = (Math.random() - 0.48) * currentPrice * 0.02; // ±2% per period
        const open = currentPrice;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * Math.abs(change) * 0.5;
        const low = Math.min(open, close) - Math.random() * Math.abs(change) * 0.5;

        candles.push({
          timestamp,
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: Math.floor(Math.random() * 10000000),
          timeframe,
        });

        currentPrice = close; // Mean revert slightly
        currentPrice = currentPrice * 0.99 + 195.32 * 0.01;

        timestamp += intervalMs;
      }

      return candles;
    } catch (error) {
      logger.error(
        `Error fetching ${timeframe} candles for ${symbol}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Fetch complete market context for analysis
   * @param symbol Stock symbol
   * @returns Full MarketContext with all data needed for analysis
   */
  async fetchMarketContext(symbol: string): Promise<MarketContext> {
    try {
      logger.info(`Fetching complete market context for ${symbol}`);

      const startTime = Date.now();

      // Fetch data in parallel for performance
      const [quote, ohlcv1h, ohlcv1d] = await Promise.all([
        this.fetchQuote(symbol),
        this.fetchOHLCV(symbol, '1h', 100),
        this.fetchOHLCV(symbol, '1d', 252),
      ]);

      const latency = Date.now() - startTime;
      logger.debug(`Market context fetched in ${latency}ms for ${symbol}`);

      // Build market context
      const context: MarketContext = {
        symbol,
        timestamp: Date.now(),
        currentPrice: quote.last,
        bid: quote.bid,
        ask: quote.ask,
        bidAskSpread: ((quote.ask - quote.bid) / quote.last) * 10000, // basis points

        ohlcv1h,
        ohlcv1d,

        // Indicators will be calculated separately
        indicators: {
          rsi14: 0,
          macd: { macd: 0, signal: 0, histogram: 0 },
          bollingerBands: { upper: 0, middle: 0, lower: 0 },
          ivHvRatio: 0,
        },

        impliedVolatility: quote.impliedVolatility,
        historicalVolatility20d: this.calculateHistoricalVolatility(ohlcv1d),
        volume24h: quote.volume,

        riskParameters: {
          maxPositionSize: 50000, // $50k default
          maxDrawdown: 0.20, // 20%
          maxLossPerId: 5000, // $5k max loss per trade
        },
      };

      return context;
    } catch (error) {
      logger.error(`Error fetching market context for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Calculate historical volatility from OHLCV data
   * @param candles OHLCV candles
   * @returns Historical volatility as decimal (0.18 = 18%)
   */
  private calculateHistoricalVolatility(candles: CandleData[]): number {
    if (candles.length < 2) return 0.18; // Default 18%

    // Calculate log returns
    const logReturns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const return_ = Math.log(candles[i].close / candles[i - 1].close);
      logReturns.push(return_);
    }

    // Calculate standard deviation of returns
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
    const variance =
      logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      logReturns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize volatility (252 trading days)
    const annualizedVol = stdDev * Math.sqrt(252);

    return Math.min(Math.max(annualizedVol, 0.08), 0.50); // Clamp between 8-50%
  }
}

export default new MarketDataFetcher();
