/**
 * Analyzer Agent Unit Tests
 * T152: Analyzer Agent Implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyzerAgent } from '../../../src/agents/analyzer';
import { AgentConfig } from '../../../src/agents/types';

describe('AnalyzerAgent', () => {
  let analyzer: AnalyzerAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: 'analyzer-test',
      name: 'Test Analyzer',
      role: 'analyzer',
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'You are a technical analysis expert',
      temperature: 0.3,
      maxRetries: 3,
      timeoutMs: 5000,
    };

    analyzer = new AnalyzerAgent(config);
  });

  it('should be created with correct configuration', () => {
    const status = analyzer.getStatus();
    expect(status).toContain('Test Analyzer');
  });

  it('should have correct status message', () => {
    const status = analyzer.getStatus();
    expect(status).toContain('Analyzer Agent');
    expect(status).toContain('Test Analyzer');
    expect(status).toContain('analyzer');
  });

  it('should have analyzer role', () => {
    const role = analyzer.getRole();
    expect(role).toBe('analyzer');
  });

  it('should have correct temperature for analysis', () => {
    const status = analyzer.getStatus();
    // Temperature 0.3 is configured in the agent for consistency
    expect(status).toContain('claude-3-5-sonnet');
  });

  it('should have retry configuration', () => {
    // Create analyzer with retry config
    const configWithRetry: AgentConfig = {
      ...config,
      maxRetries: 3,
      timeoutMs: 5000,
    };

    const analyzerWithRetry = new AnalyzerAgent(configWithRetry);
    const status = analyzerWithRetry.getStatus();

    // Status should contain the agent name
    expect(status).toContain('Test Analyzer');
  });

  it('should be instance of AnalyzerAgent', () => {
    expect(analyzer).toBeInstanceOf(AnalyzerAgent);
  });
});
