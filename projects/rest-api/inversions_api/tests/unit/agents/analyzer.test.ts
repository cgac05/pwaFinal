/**
 * Analyzer Agent Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyzerAgent } from '../../../src/agents/analyzer';
import { AgentConfig, MarketContext } from '../../../src/agents/types';

describe('AnalyzerAgent', () => {
  let analyzer: AnalyzerAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: 'analyzer-test',
      name: 'Test Analyzer',
      role: 'analyzer',
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test system prompt',
      temperature: 0.3,
    };

    analyzer = new AnalyzerAgent(config);
  });

  it('should be created with correct configuration', () => {
    expect(analyzer.getConfig()).toEqual(config);
  });

  it('should have correct status message', () => {
    const status = analyzer.getStatus();
    expect(status).toContain('Test Analyzer');
    expect(status).toContain('analyzer');
    expect(status).toContain('Ready');
  });

  it('should have analyzer role', () => {
    const agentConfig = analyzer.getConfig();
    expect(agentConfig.role).toBe('analyzer');
  });

  it('should have correct temperature for analysis', () => {
    const agentConfig = analyzer.getConfig();
    expect(agentConfig.temperature).toBe(0.3); // Low temp for consistency
  });

  it('should have retry configuration', () => {
    // Create analyzer with retry config
    const configWithRetry: AgentConfig = {
      ...config,
      maxRetries: 3,
      timeoutMs: 5000,
    };

    const analyzerWithRetry = new AnalyzerAgent(configWithRetry);
    const agentConfig = analyzerWithRetry.getConfig();

    expect(agentConfig.maxRetries).toBe(3);
    expect(agentConfig.timeoutMs).toBe(5000);
  });
});
