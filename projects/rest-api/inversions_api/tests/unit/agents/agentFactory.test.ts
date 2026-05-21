/**
 * Agent Factory Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentFactory, initializeAgents } from '../../../src/agents/agentFactory';
import { AnalyzerAgent } from '../../../src/agents/analyzer';
import { StrategistAgent } from '../../../src/agents/strategist';
import { ExecutorAgent } from '../../../src/agents/executor';

describe('AgentFactory', () => {
  beforeEach(() => {
    AgentFactory.clearCache();
  });

  it('should create an analyzer agent', () => {
    const config = {
      id: 'test-analyzer',
      name: 'Test Analyzer',
      role: 'analyzer' as const,
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test prompt',
    };

    const agent = AgentFactory.createAgent('analyzer', config);

    expect(agent).toBeInstanceOf(AnalyzerAgent);
    expect(agent.getRole()).toBe('analyzer');
    expect(agent.getStatus()).toContain('Test Analyzer');
  });

  it('should create a strategist agent', () => {
    const config = {
      id: 'test-strategist',
      name: 'Test Strategist',
      role: 'strategist' as const,
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test prompt',
    };

    const agent = AgentFactory.createAgent('strategist', config);

    expect(agent).toBeInstanceOf(StrategistAgent);
    expect(agent.getConfig().role).toBe('strategist');
  });

  it('should create an executor agent', () => {
    const config = {
      id: 'test-executor',
      name: 'Test Executor',
      role: 'executor' as const,
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test prompt',
    };

    const agent = AgentFactory.createAgent('executor', config);

    expect(agent).toBeInstanceOf(ExecutorAgent);
    expect(agent.getConfig().role).toBe('executor');
  });

  it('should return cached agent on second call', () => {
    const config = {
      id: 'test-analyzer-2',
      name: 'Test Analyzer 2',
      role: 'analyzer' as const,
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test prompt',
    };

    const agent1 = AgentFactory.createAgent('analyzer', config);
    const agent2 = AgentFactory.createAgent('analyzer', config);

    expect(agent1).toBe(agent2);
  });

  it('should throw error for unknown role', () => {
    const config = {
      id: 'test-unknown',
      name: 'Test Unknown',
      role: 'unknown' as any,
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test prompt',
    };

    expect(() => {
      AgentFactory.createAgent(config.role, config);
    }).toThrow('Unknown agent role: unknown');
  });

  it('should initialize all agents', () => {
    const { analyzer, strategist, executor } = initializeAgents();

    expect(analyzer).toBeInstanceOf(AnalyzerAgent);
    expect(strategist).toBeInstanceOf(StrategistAgent);
    expect(executor).toBeInstanceOf(ExecutorAgent);
  });

  it('should get all agents', () => {
    const config = {
      id: 'test-all',
      name: 'Test All',
      role: 'analyzer' as const,
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test prompt',
    };

    AgentFactory.createAgent('analyzer', config);

    const agents = AgentFactory.getAllAgents();
    expect(agents.size).toBeGreaterThan(0);
  });
});
