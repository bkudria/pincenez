import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChecksFile } from '../src/config.js';

// Mock the linter module
vi.mock('../src/linter.js', () => ({
  lintCheck: vi.fn(),
}));

// Mock auth env construction (real detection touches fs/keychain)
vi.mock('../src/auth.js', () => ({
  buildSdkEnv: vi.fn(() => ({ SENTINEL: 'sdk-env' })),
}));

import { lintCheck } from '../src/linter.js';
import { buildSdkEnv } from '../src/auth.js';
import { runLint } from '../src/lint-runner.js';

const mockLintCheck = vi.mocked(lintCheck);
const mockBuildSdkEnv = vi.mocked(buildSdkEnv);

const checksFile: ChecksFile = {
  checks: [
    { id: 'a1', check: 'Output is high quality' },
    { id: 'a2', check: 'Handler returns a 200 response' },
    { id: 'a3', check: 'Code works AND handles errors' },
  ],
};

describe('runLint', () => {
  let stdoutChunks: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutChunks = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdoutChunks.push(chunk.toString());
      return true;
    });
  });

  it('resolves the SDK env once for the configured auth mode and passes it to every check', async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues: [],
      cost_usd: 0,
    }));

    await runLint(checksFile, { auth: 'api-key' });

    expect(mockBuildSdkEnv).toHaveBeenCalledTimes(1);
    expect(mockBuildSdkEnv).toHaveBeenCalledWith('api-key');
    for (const call of mockLintCheck.mock.calls) {
      expect(call[1]?.sdkEnv).toEqual({ SENTINEL: 'sdk-env' });
    }
  });

  it('defaults the auth mode to auto', async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues: [],
      cost_usd: 0,
    }));

    await runLint(checksFile);

    expect(mockBuildSdkEnv).toHaveBeenCalledWith('auto');
  });

  it('respects the concurrency limit when linting checks', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockLintCheck.mockImplementation(async (check) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return { id: check.id, check: check.check, issues: [] };
    });

    const checks = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      check: `check ${i}`,
    }));

    await runLint({ checks }, { concurrency: 2 });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('defaults to concurrency = 10 when no option is provided', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockLintCheck.mockImplementation(async (check) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return { id: check.id, check: check.check, issues: [] };
    });

    const checks = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`,
      check: `check ${i}`,
    }));

    await runLint({ checks });

    expect(maxInFlight).toBeLessThanOrEqual(10);
    expect(maxInFlight).toBe(10);
  });

  it('runs all checks and returns results', async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues:
        check.id === 'a1'
          ? [{ anti_pattern: 'vague', suggestion: 'Name the metric' }]
          : check.id === 'a3'
            ? [{ anti_pattern: 'compound', suggestion: 'Split into two' }]
            : [],
    }));

    const { results, checksWithIssues } = await runLint(checksFile);

    expect(results).toHaveLength(3);
    expect(checksWithIssues).toBe(2);
  });

  it('writes checks header to stdout', async () => {
    mockLintCheck.mockResolvedValue({
      id: 'a1',
      check: 'test',
      issues: [],
    });

    await runLint({ checks: [{ id: 'a1', check: 'test' }] });

    expect(stdoutChunks[0]).toBe('checks:\n');
  });

  it('writes summary stats to stdout', async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues: check.id === 'a1' ? [{ anti_pattern: 'vague', suggestion: 'fix' }] : [],
    }));

    await runLint(checksFile);

    const output = stdoutChunks.join('');
    expect(output).toContain('checks_total: 3');
    expect(output).toContain('checks_with_issues: 1');
  });

  it('passes context from checks file to linter', async () => {
    mockLintCheck.mockResolvedValue({
      id: 'a1',
      check: 'test',
      issues: [],
    });

    const checksFileWithContext: ChecksFile = {
      context: 'Write a haiku',
      checks: [{ id: 'a1', check: 'test' }],
    };

    await runLint(checksFileWithContext);

    expect(mockLintCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ context: 'Write a haiku' }),
    );
  });

  it('passes model option to linter', async () => {
    mockLintCheck.mockResolvedValue({
      id: 'a1',
      check: 'test',
      issues: [],
    });

    await runLint({ checks: [{ id: 'a1', check: 'test' }] }, { model: 'claude-sonnet-5' });

    expect(mockLintCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: 'claude-sonnet-5' }),
    );
  });

  it('passes availableTools option to linter', async () => {
    mockLintCheck.mockResolvedValue({
      id: 'a1',
      check: 'test',
      issues: [],
    });

    await runLint(
      { checks: [{ id: 'a1', check: 'test' }] },
      { availableTools: ['Read', 'TaskCreate'] },
    );

    expect(mockLintCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ availableTools: ['Read', 'TaskCreate'] }),
    );
  });

  it('aggregates cost_usd into summary, rounded to 4 decimals, omitted when 0', async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues: [],
      cost_usd: check.id === 'a1' ? 0.0011 : check.id === 'a2' ? 0.0023456 : 0,
    }));

    const { costUsd } = await runLint(checksFile);
    expect(costUsd).toBe(0.0034);

    const output = stdoutChunks.join('');
    expect(output).toContain('cost_usd: 0.0034');
  });

  it('omits cost_usd from summary when total is 0', async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues: [],
      cost_usd: 0,
    }));

    await runLint(checksFile);
    const output = stdoutChunks.join('');
    expect(output).not.toContain('cost_usd:');
  });

  it('forwards controller to each lintCheck call', async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues: [],
    }));
    const controller = new AbortController();

    await runLint(checksFile, { controller });

    expect(mockLintCheck).toHaveBeenCalledTimes(3);
    expect(mockLintCheck.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ controller }));
    expect(mockLintCheck.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ controller }));
    expect(mockLintCheck.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ controller }));
  });
});
