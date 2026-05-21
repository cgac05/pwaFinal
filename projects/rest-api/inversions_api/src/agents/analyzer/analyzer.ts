/**
 * Analyzer Agent
 * Analyzes market data and technical indicators
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentConfig, MarketContext, AgentResponse } from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

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
   * Analyze market data and return context
   * @param marketContext Market data to analyze
   * @returns Analysis result
   */
  async analyze(marketContext: MarketContext): Promise<AgentResponse> {
    try {
      logger.info(`[${this.config.name}] Analyzing market: ${marketContext.symbol}`);

      const analysis = await retryWithBackoff(
        async () => {
          const response = await this.client.messages.create({
            model: this.config.model,
            max_tokens: 1024,
            temperature: this.config.temperature || 0.3,
            system: this.config.systemPrompt,
            messages: [
              {
                role: 'user',
                content: `Analyze this market data and provide technical context:

Symbol: ${marketContext.symbol}
Current Price: $${marketContext.price}
Bid/Ask: ${marketContext.bid} / ${marketContext.ask}
Volume: ${marketContext.volume}
Range Today: $${marketContext.low} - $${marketContext.high}

Technical Indicators:
- RSI(14): ${marketContext.rsi || 'N/A'}
- MACD: ${marketContext.macd || 'N/A'}
- Bollinger Bands: ${marketContext.bollingerLower || 'N/A'} - ${marketContext.bollingerUpper || 'N/A'}
- IV: ${marketContext.iv || 'N/A'}%
- HV: ${marketContext.hv || 'N/A'}%

Provide analysis in JSON format with keys:
- trend: "uptrend" | "downtrend" | "sideways"
- strength: 0-100
- volatility_state: "low" | "medium" | "high"
- technical_signals: string
- recommended_strategy_type: "straddle" | "strangle" | "none"
- confidence: 0-1`,
              },
            ],
          });

          const content = response.content[0];
          if (content.type !== 'text') {
            throw new Error('Unexpected response type');
          }

          return this.parseAnalysisResponse(content.text);
        },
        this.config.maxRetries || 3,
        this.config.name
      );

      logger.info(`[${this.config.name}] Analysis complete for ${marketContext.symbol}`);

      return {
        success: true,
        data: analysis,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.config.name}] Analysis failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Parse and validate analysis response
   */
  private parseAnalysisResponse(text: string): any {
    try {
      // Extract JSON from response (Claude sometimes adds markdown blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!analysis.trend || !analysis.strength === undefined || !analysis.volatility_state) {
        throw new Error('Missing required fields in analysis');
      }

      return analysis;
    } catch (error) {
      logger.error(`Failed to parse analysis response: ${error}`);
      throw error;
    }
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Get agent status
   */
  getStatus(): string {
    return `${this.config.name} (${this.config.role}) - Ready`;
  }
}
