/**
 * Retry utilities with exponential backoff
 */

import { logger } from './logger';

/**
 * Retry logic with exponential backoff
 * @param fn Async function to retry
 * @param maxRetries Maximum number of retries
 * @param agentName Name of calling agent for logging
 * @returns Result of function execution
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  agentName: string = 'Unknown'
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`[${agentName}] Attempt ${attempt}/${maxRetries}`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        `[${agentName}] Attempt ${attempt} failed: ${lastError.message}. Retrying...`
      );

      // Calculate exponential backoff: 1s, 2s, 4s, etc.
      const backoffMs = Math.pow(2, attempt - 1) * 1000;

      // Don't sleep on last attempt
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  logger.error(`[${agentName}] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Unknown error');
}

/**
 * Circuit breaker pattern for agent communication
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 30000
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, agentName: string = 'Unknown'): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure > this.resetTimeoutMs) {
        this.state = 'half-open';
        logger.info(`[CircuitBreaker] ${agentName} - Transitioning to half-open`);
      } else {
        throw new Error(
          `Circuit breaker open for ${agentName}. Retry after ${this.resetTimeoutMs - timeSinceLastFailure}ms`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess(agentName);
      return result;
    } catch (error) {
      this.onFailure(agentName);
      throw error;
    }
  }

  private onSuccess(agentName: string): void {
    this.failureCount = 0;
    this.state = 'closed';
    logger.info(`[CircuitBreaker] ${agentName} - Success, resetting`);
  }

  private onFailure(agentName: string): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    logger.warn(`[CircuitBreaker] ${agentName} - Failure ${this.failureCount}/${this.failureThreshold}`);

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      logger.error(`[CircuitBreaker] ${agentName} - Circuit opened!`);
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
    logger.info('[CircuitBreaker] Manually reset');
  }
}
