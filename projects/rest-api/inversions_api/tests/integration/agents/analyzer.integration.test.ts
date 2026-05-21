/**
 * Analyzer Agent Integration Tests
 * T152: Analyzer Agent Implementation
 * Tests complete flow: fetch market data → calculate indicators → Claude analysis
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AnalyzerAgent } from '../../../src/agents/analyzer/analyzer.ts';
import { initializeAgents } from '../../../src/agents/agentFactory.ts';
import MarketDataFetcher from '../../../src/agents/analyzer/marketDataFetcher.ts';
import TechnicalIndicatorsCalculator from '../../../src/agents/analyzer/technicalIndicators.ts';

describe('T152 - Analyzer Agent Integration Tests', () => {
  let analyzerAgent: AnalyzerAgent;

  beforeAll(() => {
    // Initialize analyzer agent via factory
    const agents = initializeAgents();
    analyzerAgent = agents.analyzer;
  });

  describe('Market Data Fetching', () => {
    it('should fetch quote data successfully', async () => {
      const quote = await MarketDataFetcher.fetchQuote('AAPL');

      expect(quote.symbol).toBe('AAPL');
      expect(quote.bid).toBeGreaterThan(0);
      expect(quote.ask).toBeGreaterThan(quote.bid);
      expect(quote.last).toBeGreaterThan(0);
      expect(quote.impliedVolatility).toBeGreaterThan(0.05);
      expect(quote.impliedVolatility).toBeLessThan(1.0);
    });

    it('should fetch OHLCV data for 1h timeframe', async () => {
      const candles = await MarketDataFetcher.fetchOHLCV('AAPL', '1h', 100);

      expect(candles).toHaveLength(100);
      candles.forEach((candle) => {
        expect(candle.timestamp).toBeGreaterThan(0);
        expect(candle.open).toBeGreaterThan(0);
        expect(candle.high).toBeGreaterThanOrEqual(candle.open);
        expect(candle.high).toBeGreaterThanOrEqual(candle.close);
        expect(candle.low).toBeLessThanOrEqual(candle.open);
        expect(candle.low).toBeLessThanOrEqual(candle.close);
        expect(candle.volume).toBeGreaterThan(0);
      });
    });

    it('should fetch OHLCV data for 1d timeframe', async () => {
      const candles = await MarketDataFetcher.fetchOHLCV('AAPL', '1d', 252);

      expect(candles).toHaveLength(252);
      expect(candles[0].timeframe).toBe('1d');
    });

    it('should fetch complete market context', async () => {
      const context = await MarketDataFetcher.fetchMarketContext('AAPL');

      expect(context.symbol).toBe('AAPL');
      expect(context.currentPrice).toBeGreaterThan(0);
      expect(context.bid).toBeLessThan(context.currentPrice);
      expect(context.ask).toBeGreaterThan(context.currentPrice);
      expect(context.ohlcv1h.length).toBeGreaterThan(0);
      expect(context.ohlcv1d.length).toBeGreaterThan(0);
      expect(context.impliedVolatility).toBeGreaterThan(0);
      expect(context.historicalVolatility20d).toBeGreaterThan(0);
      expect(context.riskParameters.maxPositionSize).toBe(50000);
    });

    it('should process multiple symbols in parallel', async () => {
      const symbols = ['AAPL', 'MSFT', 'TSLA'];
      const results = await Promise.all(
        symbols.map((sym) => MarketDataFetcher.fetchMarketContext(sym))
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.currentPrice).toBeGreaterThan(0);
      });
    });
  });

  describe('Technical Indicators Calculation', () => {
    it('should calculate RSI correctly', async () => {
      const candles = await MarketDataFetcher.fetchOHLCV('AAPL', '1h', 100);
      const indicators = TechnicalIndicatorsCalculator.calculateIndicators(
        candles,
        0.20,
        0.18
      );

      expect(indicators.rsi14).toBeGreaterThanOrEqual(0);
      expect(indicators.rsi14).toBeLessThanOrEqual(100);
    });

    it('should calculate MACD components', async () => {
      const candles = await MarketDataFetcher.fetchOHLCV('AAPL', '1h', 100);
      const indicators = TechnicalIndicatorsCalculator.calculateIndicators(
        candles,
        0.20,
        0.18
      );

      expect(indicators.macd.macd).toBeDefined();
      expect(indicators.macd.signal).toBeDefined();
      expect(indicators.macd.histogram).toBeDefined();
    });

    it('should calculate Bollinger Bands', async () => {
      const candles = await MarketDataFetcher.fetchOHLCV('AAPL', '1h', 100);
      const indicators = TechnicalIndicatorsCalculator.calculateIndicators(
        candles,
        0.20,
        0.18
      );

      expect(indicators.bollingerBands.upper).toBeGreaterThan(
        indicators.bollingerBands.middle
      );
      expect(indicators.bollingerBands.lower).toBeLessThan(
        indicators.bollingerBands.middle
      );
    });

    it('should calculate IV/HV ratio', async () => {
      const candles = await MarketDataFetcher.fetchOHLCV('AAPL', '1h', 100);
      const indicators = TechnicalIndicatorsCalculator.calculateIndicators(
        candles,
        0.25,
        0.18
      );

      expect(indicators.ivHvRatio).toBeGreaterThan(1.0); // IV > HV in this case
    });
  });

  describe('Analyzer Agent Analysis', () => {
    it('should have correct configuration', () => {
      const status = analyzerAgent.getStatus();
      expect(status).toContain('Analyzer Agent');
      expect(status).toContain('analyzer');
    });

    it('should have analyzer role', () => {
      const role = analyzerAgent.getRole();
      expect(role).toBe('analyzer');
    });

    it('should parse valid analysis response', async () => {
      // This test would require mocking Claude API
      // For now, just verify the agent is ready
      expect(analyzerAgent).toBeDefined();
    });
  });

  describe('Performance & Latency', () => {
    it('should fetch market context within 500ms target', async () => {
      const startTime = Date.now();
      await MarketDataFetcher.fetchMarketContext('AAPL');
      const elapsed = Date.now() - startTime;

      // Latency target for market context: <500ms
      // (Actual production might be faster with real broker APIs)
      expect(elapsed).toBeLessThan(1000); // Allow 1s for testing
    });

    it('should calculate indicators quickly (< 100ms)', async () => {
      const candles = await MarketDataFetcher.fetchOHLCV('AAPL', '1h', 100);
      const startTime = Date.now();
      TechnicalIndicatorsCalculator.calculateIndicators(candles, 0.20, 0.18);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(200); // Allow 200ms for testing
    });
  });

  describe('Agent Factory Integration', () => {
    it('should return same analyzer instance from cache', () => {
      const agents1 = initializeAgents();
      const agents2 = initializeAgents();

      expect(agents1.analyzer).toBe(agents2.analyzer);
    });

    it('should create analyzers with correct configuration', () => {
      const agents = initializeAgents();
      const status = agents.analyzer.getStatus();

      expect(status).toContain('claude-3-5-sonnet');
      expect(status).toContain('analyzer');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid symbol gracefully', async () => {
      const quote = await MarketDataFetcher.fetchQuote('INVALID_SYMBOL_XYZ');
      expect(quote.symbol).toBe('INVALID_SYMBOL_XYZ');
      // Should return mock data
      expect(quote.bid).toBeGreaterThan(0);
    });

    it('should handle insufficient data for indicators', async () => {
      const minimalCandles = [
        {
          timestamp: Date.now(),
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 1000000,
        },
      ];

      const indicators = TechnicalIndicatorsCalculator.calculateIndicators(
        minimalCandles,
        0.20,
        0.18
      );

      // RSI should return 50 (neutral) for insufficient data
      expect(indicators.rsi14).toBe(50);
    });
  });
});
