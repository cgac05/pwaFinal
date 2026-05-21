/**
 * Agent Factory
 * Creates and manages agent instances with configuration
 */

import { AgentConfig, AgentRole } from './types';
import { AnalyzerAgent } from './analyzer';
import { StrategistAgent } from './strategist';
import { ExecutorAgent } from './executor';
import { logger } from './utils/logger';

/**
 * Factory class for creating agents
 */
export class AgentFactory {
  private static instances = new Map<string, any>();

  /**
   * Create or retrieve an agent instance
   * @param role Agent role (analyzer | strategist | executor)
   * @param config Agent configuration
   * @returns Agent instance
   */
  static createAgent(role: AgentRole, config: AgentConfig): any {
    const key = `${role}:${config.id}`;

    // Return cached instance if exists
    if (this.instances.has(key)) {
      logger.info(`Retrieving cached agent: ${key}`);
      return this.instances.get(key);
    }

    let agent;
    switch (role) {
      case 'analyzer':
        agent = new AnalyzerAgent(config);
        break;
      case 'strategist':
        agent = new StrategistAgent(config);
        break;
      case 'executor':
        agent = new ExecutorAgent(config);
        break;
      default:
        throw new Error(`Unknown agent role: ${role}`);
    }

    this.instances.set(key, agent);
    logger.info(`Created new agent: ${key}`);

    return agent;
  }

  /**
   * Get all agent instances
   */
  static getAllAgents(): Map<string, any> {
    return this.instances;
  }

  /**
   * Clear agent cache
   */
  static clearCache(): void {
    this.instances.clear();
    logger.info('Agent cache cleared');
  }

  /**
   * Get agent by key
   */
  static getAgent(key: string): any {
    return this.instances.get(key);
  }
}

/**
 * Initialize all required agents for orchestration
 * Returns agent instances in correct order
 */
export function initializeAgents() {
  const analyzerConfig: AgentConfig = {
    id: 'analyzer-1',
    name: 'Market Analyzer',
    role: 'analyzer',
    model: 'claude-3-5-sonnet-20241022',
    systemPrompt: `You are a market analysis expert. Your role is to:
1. Analyze OHLCV data and technical indicators
2. Identify market trends and patterns
3. Calculate volatility metrics (IV, HV ratios)
4. Provide context for strategy selection
Always be precise with numeric values. Format output as JSON.`,
    temperature: 0.3, // Low temp for analysis consistency
    maxRetries: 3,
    timeoutMs: 5000,
  };

  const strategistConfig: AgentConfig = {
    id: 'strategist-1',
    name: 'Strategy Selector',
    role: 'strategist',
    model: 'claude-3-5-sonnet-20241022',
    systemPrompt: `You are a trading strategy expert. Your role is to:
1. Receive market analysis and context
2. Select optimal trading strategy (Straddle, Strangle, or None)
3. Determine position parameters (strike, direction, size)
4. Calculate risk/reward ratios and max loss
Provide recommendations as JSON with confidence scores.`,
    temperature: 0.4, // Slightly higher for strategy selection
    maxRetries: 3,
    timeoutMs: 3000,
  };

  const executorConfig: AgentConfig = {
    id: 'executor-1',
    name: 'Order Executor',
    role: 'executor',
    model: 'claude-3-5-sonnet-20241022',
    systemPrompt: `You are a trade execution specialist. Your role is to:
1. Receive validated strategy from strategist
2. Prepare order parameters for broker
3. Validate order parameters and risk checks
4. Execute trade on broker and track results
Always validate before execution. Format output as JSON.`,
    temperature: 0.2, // Very low for execution precision
    maxRetries: 2,
    timeoutMs: 2000,
  };

  const analyzer = AgentFactory.createAgent('analyzer', analyzerConfig);
  const strategist = AgentFactory.createAgent('strategist', strategistConfig);
  const executor = AgentFactory.createAgent('executor', executorConfig);

  logger.info('All agents initialized successfully');

  return { analyzer, strategist, executor };
}

export default AgentFactory;
