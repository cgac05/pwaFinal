/**
 * Executor Agent
 * Executes validated trading strategies and manages orders
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentConfig, OrderRequest, OrderResponse, AgentResponse } from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export class ExecutorAgent {
  private config: AgentConfig;
  private client: Anthropic;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }

  /**
   * Execute validated trading order
   * @param order Order request with strategy details
   * @returns Order execution response
   */
  async executeOrder(order: OrderRequest): Promise<AgentResponse> {
    try {
      logger.info(
        `[${this.config.name}] Executing order: ${order.strategy.strategyType} on ${order.symbol}`
      );

      const result = await retryWithBackoff(
        async () => {
          // Validate order before execution
          this.validateOrder(order);

          const response = await this.client.messages.create({
            model: this.config.model,
            max_tokens: 512,
            temperature: this.config.temperature || 0.2,
            system: this.config.systemPrompt,
            messages: [
              {
                role: 'user',
                content: `Execute this trading order and confirm:

Order Details:
- Symbol: ${order.symbol}
- Strategy: ${order.strategy.strategyType} ${order.strategy.direction}
- Strike: ${order.strategy.strike || 'ATM'}
- Quantity: ${order.quantity}
- Max Loss: $${order.strategy.maxLoss}
- Max Gain: $${order.strategy.maxGain}
- Order Type: ${order.orderType}
- Price: $${order.price || 'Market'}

Confirm order execution as JSON with:
- orderId: unique_id
- status: "filled" | "pending" | "failed"
- executedPrice: numeric
- executedQuantity: numeric
- error: (if any)`,
              },
            ],
          });

          const content = response.content[0];
          if (content.type !== 'text') {
            throw new Error('Unexpected response type');
          }

          return this.parseExecutionResponse(content.text, order);
        },
        this.config.maxRetries || 2,
        this.config.name
      );

      logger.info(
        `[${this.config.name}] Order execution result: ${result.status} (ID: ${result.orderId})`
      );

      return {
        success: result.status !== 'failed',
        data: result,
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.config.name}] Order execution failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Validate order before execution
   */
  private validateOrder(order: OrderRequest): void {
    if (!order.symbol) {
      throw new Error('Invalid symbol');
    }

    if (order.quantity <= 0) {
      throw new Error('Invalid quantity');
    }

    if (order.strategy.confidence < 0.4) {
      throw new Error(`Low confidence strategy (${order.strategy.confidence})`);
    }

    if (order.strategy.maxLoss && order.strategy.maxLoss > 5000) {
      logger.warn('High max loss detected, proceeding with caution');
    }

    logger.debug(`Order validation passed for ${order.symbol}`);
  }

  /**
   * Parse execution response
   */
  private parseExecutionResponse(text: string, order: OrderRequest): OrderResponse {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const response = JSON.parse(jsonMatch[0]);

      return {
        orderId: response.orderId || `ORD-${Date.now()}`,
        status: response.status || 'pending',
        symbol: order.symbol,
        executedPrice: response.executedPrice || order.price || 0,
        executedQuantity: response.executedQuantity || order.quantity,
        timestamp: Date.now(),
        error: response.error,
      };
    } catch (error) {
      logger.error(`Failed to parse execution response: ${error}`);
      throw error;
    }
  }

  /**
   * Cancel pending order
   * @param orderId Order ID to cancel
   */
  async cancelOrder(orderId: string): Promise<AgentResponse> {
    try {
      logger.info(`[${this.config.name}] Cancelling order: ${orderId}`);

      // Placeholder for order cancellation logic
      return {
        success: true,
        data: { orderId, status: 'cancelled' },
        timestamp: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
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
