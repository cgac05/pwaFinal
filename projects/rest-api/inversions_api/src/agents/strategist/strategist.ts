/**
 * Strategist Agent
 * Selects optimal trading strategy based on analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentConfig, StrategyContext, StrategyResult, AgentResponse } from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export class StrategistAgent {
  private config: AgentConfig;
  private client: Anthropic;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }

  /**
   * Select optimal strategy based on market context
   * @param context Strategy context with market data and analysis
   * @returns Strategy recommendation
   */
  async selectStrategy(context: StrategyContext): Promise<AgentResponse> {
    try {
      logger.info(`[${this.config.name}] Selecting strategy for ${context.market.symbol}`);

      const strategy = await retryWithBackoff(
        async () => {
          const response = await this.client.messages.create({
            model: this.config.model,
            max_tokens: 1024,
            temperature: this.config.temperature || 0.4,
            system: this.config.systemPrompt,
            messages: [
              {
                role: 'user',
                content: `Select optimal trading strategy based on market context:

Symbol: ${context.market.symbol}
Current Price: $${context.market.price}
IV: ${context.market.iv || 'N/A'}%
HV: ${context.market.hv || 'N/A'}%
Trend: ${context.market.close > context.market.open ? 'up' : 'down'}
Volume: ${context.market.volume}

Risk Profile:
- Max Position Size: $${context.riskContext?.maxPositionSize || 50000}
- Max Loss Tolerance: $${context.riskContext?.maxLoss || 2500}

Provide strategy recommendation as JSON with:
- strategyType: "straddle" | "strangle" | "none"
- direction: "long" | "short" | "neutral"
- strike: (ATM or specific strike)
- expirationDate: (recommended expiration)
- riskRewardRatio: numeric
- maxLoss: numeric
- maxGain: numeric
- confidence: 0-1
- reasoning: explanation`,
              },
            ],
          });

          const content = response.content[0];
          if (content.type !== 'text') {
            throw new Error('Unexpected response type');
          }

          return this.parseStrategyResponse(content.text, context.market.symbol);
        },
        this.config.maxRetries || 3,
        this.config.name
      );

      logger.info(`[${this.config.name}] Strategy selected: ${strategy.strategyType}`);

      return {
        success: true,
        data: strategy,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.config.name}] Strategy selection failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Parse and validate strategy response
   */
  private parseStrategyResponse(text: string, symbol: string): StrategyResult {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const response = JSON.parse(jsonMatch[0]);

      // Validate and create StrategyResult
      const strategy: StrategyResult = {
        strategyType: response.strategyType || 'none',
        direction: response.direction || 'neutral',
        symbol,
        entryPrice: 0, // Will be set by executor
        strike: response.strike,
        expirationDate: response.expirationDate,
        riskRewardRatio: response.riskRewardRatio || 1,
        maxLoss: response.maxLoss,
        maxGain: response.maxGain,
        confidence: Math.min(1, Math.max(0, response.confidence || 0.5)),
        reasoning: response.reasoning || '',
      };

      return strategy;
    } catch (error) {
      logger.error(`Failed to parse strategy response: ${error}`);
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
