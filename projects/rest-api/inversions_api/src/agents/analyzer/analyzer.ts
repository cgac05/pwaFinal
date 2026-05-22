/**
 * Analyzer Agent - Complete Implementation
 * T152: Analyzer Agent Implementation
 * 
 * Receives market data OHLCV + calculates indicators
 * Generates technical analysis via Claude API
 * Latency target: <500ms per symbol
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentConfig, AgentResponse } from '../types/agentConfig';
import { MarketContext, AnalysisResult } from '../types/marketData';
import { retryWithBackoff } from '../utils/retry';
import { logger } from '../utils/logger';
import MarketDataFetcher from './marketDataFetcher';
import TechnicalIndicatorsCalculator from './technicalIndicators';

export class AnalyzerAgent {
  private config: AgentConfig;
  private client: Anthropic;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }

  /**
   * Main analysis method - fetches data, calculates indicators, calls Claude
   * @param symbol Stock symbol (e.g., 'AAPL')
   * @returns Analysis result with technical signals and Claude reasoning
   */
  async analyze(symbol: string): Promise<AgentResponse> {
    const startTime = Date.now();
    logger.info(`[Analyzer] Starting analysis for ${symbol}`);

    try {
      return await retryWithBackoff(
        async () => {
          // 1. Fetch market data (parallel calls for performance)
          const marketContext = await MarketDataFetcher.fetchMarketContext(symbol);
          logger.debug(`[Analyzer] Market context fetched for ${symbol}`);

          // 2. Calculate technical indicators
          const indicators = TechnicalIndicatorsCalculator.calculateIndicators(
            marketContext.ohlcv1h,
            marketContext.impliedVolatility,
            marketContext.historicalVolatility20d
          );
          marketContext.indicators = indicators;
          logger.debug(`[Analyzer] Indicators calculated for ${symbol}`);

          // 3. Prepare analysis prompt for Claude
          const analysisPrompt = this.buildAnalysisPrompt(marketContext);

          // 4. Call Claude API
          const message = await this.client.messages.create({
            model: this.config.model,
            max_tokens: 1500,
            system: this.config.systemPrompt,
            messages: [
              {
                role: 'user',
                content: analysisPrompt,
              },
            ],
          });

          // 5. Parse and structure response
          const claudeResponse =
            message.content[0].type === 'text' ? message.content[0].text : '';
          const analysisResult = this.parseAnalysisResponse(
            marketContext,
            claudeResponse
          );

          const latency = Date.now() - startTime;
          logger.info(
            `[Analyzer] Analysis complete for ${symbol} in ${latency}ms`
          );

          return {
            success: true,
            data: analysisResult,
            timestamp: Date.now(),
          };
        },
        this.config.maxRetries,
        this.config.id
      );
    } catch (error) {
      logger.error(`[Analyzer] Error analyzing ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Analyze multiple symbols in parallel (up to 30)
   * @param symbols Array of stock symbols
   * @returns Map of symbol to analysis result
   */
  async analyzeMultiple(
    symbols: string[]
  ): Promise<Map<string, AnalysisResult>> {
    logger.info(`[Analyzer] Starting analysis for ${symbols.length} symbols`);

    // Limit concurrency to prevent rate limits
    const batchSize = Math.min(symbols.length, 10);
    const results = new Map<string, AnalysisResult>();

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((symbol) => this.analyze(symbol))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const analysisData = result.value.data as AnalysisResult;
          results.set(batch[index], analysisData);
        } else {
          logger.warn(`[Analyzer] Failed to analyze ${batch[index]}`);
        }
      });
    }

    logger.info(`[Analyzer] Analysis complete for ${results.size}/${symbols.length} symbols`);
    return results;
  }

  /**
   * Build detailed analysis prompt for Claude
   * @param context Market data context
   * @returns Formatted prompt string
   */
  private buildAnalysisPrompt(marketContext: MarketContext): string {
    const lastPrice = marketContext.ohlcv1h[marketContext.ohlcv1h.length - 1].close;
    const priceChange =
      ((lastPrice - marketContext.ohlcv1h[0].close) /
        marketContext.ohlcv1h[0].close) *
      100;

    return `
You are an expert technical analysis AI. Analyze the following market data for ${marketContext.symbol}:

**Current Market Data:**
- Current Price: $${marketContext.currentPrice.toFixed(2)}
- Bid/Ask: $${marketContext.bid.toFixed(2)} / $${marketContext.ask.toFixed(2)}
- 24h Volume: ${(marketContext.volume24h / 1000000).toFixed(2)}M shares
- Price Change (1h): ${priceChange.toFixed(2)}%

**Technical Indicators:**
- RSI(14): ${marketContext.indicators.rsi14.toFixed(2)} (0-30 oversold, 70-100 overbought)
- MACD: ${marketContext.indicators.macd.macd.toFixed(4)} | Signal: ${marketContext.indicators.macd.signal.toFixed(4)} | Histogram: ${marketContext.indicators.macd.histogram.toFixed(4)}
- Bollinger Bands: Upper $${marketContext.indicators.bollingerBands.upper.toFixed(2)} | Middle $${marketContext.indicators.bollingerBands.middle.toFixed(2)} | Lower $${marketContext.indicators.bollingerBands.lower.toFixed(2)}

**Volatility Metrics:**
- Implied Volatility: ${(marketContext.impliedVolatility * 100).toFixed(1)}%
- Historical Volatility (20d): ${(marketContext.historicalVolatility20d * 100).toFixed(1)}%
- IV/HV Ratio: ${marketContext.indicators.ivHvRatio.toFixed(2)}

**Analysis Task:**
1. Determine the current trend: BULLISH, BEARISH, or NEUTRAL
2. Rate trend strength on 0-1 scale (0 = weak, 1 = strong)
3. Classify volatility state: low, normal, high, or extreme
4. Identify support and resistance levels
5. Provide overall confidence (0-100) in the analysis
6. Suggest action for volatility traders: STRADDLE, STRANGLE, or WAIT

Respond in JSON format:
{
  "trend": "bullish|bearish|neutral",
  "strength": 0.75,
  "volatilityState": "high",
  "support": 190.50,
  "resistance": 200.00,
  "confidence": 85,
  "suggestedAction": "straddle",
  "reasoning": "Clear reason based on indicators"
}
`;
  }

  /**
   * Parse Claude's JSON response into AnalysisResult
   * @param context Market context
   * @param claudeResponse Raw text response from Claude
   * @returns Structured AnalysisResult
   */
  private parseAnalysisResponse(
    context: MarketContext,
    claudeResponse: string
  ): AnalysisResult {
    try {
      // Extract JSON from Claude response (may contain extra text)
      const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        symbol: context.symbol,
        timestamp: Date.now(),
        trend: parsed.trend || 'neutral',
        strength: parsed.strength || 0.5,
        volatilityState: parsed.volatilityState || 'normal',
        technicalSignals: {
          rsiSignal:
            context.indicators.rsi14 < 30
              ? 'oversold'
              : context.indicators.rsi14 > 70
                ? 'overbought'
                : 'neutral',
          macdSignal:
            context.indicators.macd.histogram > 0
              ? 'bullish_crossover'
              : 'bearish_crossover',
          bollingerSignal: 'middle',
          ivHvSignal:
            context.indicators.ivHvRatio < 0.8
              ? 'low_iv'
              : context.indicators.ivHvRatio > 1.2
                ? 'high_iv'
                : 'neutral',
        },
        confidence: (parsed.confidence || 50) / 100,
        volatilityExpectation: parsed.volatilityExpectation || 0,
        supportLevel: parsed.support || context.currentPrice * 0.95,
        resistanceLevel: parsed.resistance || context.currentPrice * 1.05,
        reasoning: parsed.reasoning || 'Analysis complete',
        suggestedAction: parsed.suggestedAction || 'wait',
      };
    } catch (error) {
      logger.warn(`[Analyzer] Error parsing Claude response: ${error}`);
      // Return default analysis if parsing fails
      return {
        symbol: context.symbol,
        timestamp: Date.now(),
        trend: 'neutral',
        strength: 0.5,
        volatilityState: 'normal',
        technicalSignals: {
          rsiSignal: 'neutral',
          macdSignal: 'neutral',
          bollingerSignal: 'middle',
          ivHvSignal: 'neutral',
        },
        confidence: 0.3,
        volatilityExpectation: 0,
        supportLevel: context.currentPrice * 0.95,
        resistanceLevel: context.currentPrice * 1.05,
        reasoning: 'Default analysis - parsing error',
        suggestedAction: 'wait',
      };
    }
  }

  /**
   * Get agent status/configuration
   */
  getStatus(): string {
    return `Analyzer Agent "${this.config.name}" - Role: ${this.config.role}, Model: ${this.config.model}`;
  }

  /**
   * Get agent role
   */
  getRole(): string {
    return this.config.role;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }
}
