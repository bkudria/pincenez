import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChecksFile } from '../src/config.js';
import type { CheckResult } from '../src/grader.js';

// Mock gradeCheck
vi.mock('../src/grader.js', () => ({
  gradeCheck: vi.fn(),
}));

import { gradeCheck } from '../src/grader.js';
import { run } from '../src/runner.js';

const mockGrade = vi.mocked(gradeCheck);

function makeChecksFile(overrides: Partial<ChecksFile> = {}): ChecksFile {
  return {
    checks: [
      { id: 'a1', check: 'first check' },
      { id: 'a2', check: 'second check' },
    ],
    ...overrides,
  };
}

function makeResult(
  id: string,
  pass: boolean | null,
  evidence = 'evidence',
  cost_usd = 0,
): CheckResult {
  return {
    id,
    check: `check for ${id}`,
    pass,
    evidence,
    cost_usd,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
  };
}

describe('run', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string;

  beforeEach(() => {
    vi.clearAllMocks();
    written = '';
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written += typeof chunk === 'string' ? chunk : chunk.toString();
        return true;
      });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('writes checks header first', async () => {
    mockGrade.mockResolvedValue(makeResult('a1', true));

    await run({ checks: [{ id: 'a1', check: 'c' }] }, '/tmp/out.md');

    expect(written).toMatch(/^checks:\n/);
  });

  it('writes each result as a YAML array item', async () => {
    mockGrade.mockImplementation(async (check) => makeResult(check.id, true, 'found it'));

    await run(makeChecksFile(), '/tmp/out.md');

    expect(written).toContain('  - id: a1');
    expect(written).toContain('  - id: a2');
  });

  it('includes cache_creation_tokens and cache_read_tokens in summary when non-zero', async () => {
    mockGrade.mockResolvedValueOnce({
      ...makeResult('a1', true),
      cache_creation_tokens: 100,
      cache_read_tokens: 200,
    });
    mockGrade.mockResolvedValueOnce({
      ...makeResult('a2', true),
      cache_creation_tokens: 50,
      cache_read_tokens: 300,
    });

    await run(makeChecksFile(), '/tmp/out.md');

    expect(written).toContain('cache_creation_tokens: 150');
    expect(written).toContain('cache_read_tokens: 500');
  });

  it('omits cache_* fields from summary when both totals are 0', async () => {
    mockGrade.mockResolvedValue(makeResult('a1', true));
    await run({ checks: [{ id: 'a1', check: 'c' }] }, '/tmp/out.md');
    expect(written).not.toContain('cache_creation_tokens');
    expect(written).not.toContain('cache_read_tokens');
  });

  it('writes pass_rate line after all results', async () => {
    mockGrade.mockResolvedValue(makeResult('a1', true));

    await run({ checks: [{ id: 'a1', check: 'c' }] }, '/tmp/out.md');

    const lines = written.trimEnd().split('\n');
    expect(lines[lines.length - 1]).toMatch(/^pass_rate: /);
  });

  it('computes pass_rate = 1 when all pass', async () => {
    mockGrade.mockImplementation(async (check) => makeResult(check.id, true));

    const { passRate } = await run(makeChecksFile(), '/tmp/out.md');
    expect(passRate).toBe(1);
    expect(written).toContain('pass_rate: 1');
  });

  it('computes pass_rate = 0 when all fail', async () => {
    mockGrade.mockImplementation(async (check) => makeResult(check.id, false));

    const { passRate } = await run(makeChecksFile(), '/tmp/out.md');
    expect(passRate).toBe(0);
    expect(written).toContain('pass_rate: 0');
  });

  it('computes correct pass_rate for mixed results', async () => {
    mockGrade
      .mockResolvedValueOnce(makeResult('a1', true))
      .mockResolvedValueOnce(makeResult('a2', false));

    const { passRate } = await run(makeChecksFile(), '/tmp/out.md');
    expect(passRate).toBe(0.5);
  });

  it('respects the concurrency limit when grading checks', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockGrade.mockImplementation(async (check) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return makeResult(check.id, true);
    });

    const checks = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      check: `check ${i}`,
    }));

    await run({ checks }, '/tmp/out.md', { concurrency: 2 });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('defaults to concurrency = 10 when no option is provided', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockGrade.mockImplementation(async (check) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return makeResult(check.id, true);
    });

    const checks = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`,
      check: `check ${i}`,
    }));

    await run({ checks }, '/tmp/out.md');

    expect(maxInFlight).toBeLessThanOrEqual(10);
    expect(maxInFlight).toBe(10);
  });

  it('counts null pass results as failures', async () => {
    mockGrade
      .mockResolvedValueOnce(makeResult('a1', true))
      .mockResolvedValueOnce(makeResult('a2', null));

    const { passRate } = await run(makeChecksFile(), '/tmp/out.md');
    expect(passRate).toBe(0.5);
  });

  it('prefers options.context over checksFile.context', async () => {
    mockGrade.mockResolvedValue(makeResult('a1', true));

    await run({ checks: [{ id: 'a1', check: 'c' }], context: 'rubric ctx' }, '/tmp/out.md', {
      context: 'options ctx',
    });

    expect(mockGrade).toHaveBeenCalledWith(
      expect.anything(),
      '/tmp/out.md',
      expect.objectContaining({ context: 'options ctx' }),
    );
  });

  it('falls back to checksFile.context when options.context is absent', async () => {
    mockGrade.mockResolvedValue(makeResult('a1', true));

    await run({ checks: [{ id: 'a1', check: 'c' }], context: 'rubric ctx' }, '/tmp/out.md');

    expect(mockGrade).toHaveBeenCalledWith(
      expect.anything(),
      '/tmp/out.md',
      expect.objectContaining({ context: 'rubric ctx' }),
    );
  });

  it('returns results, passRate, and costUsd', async () => {
    mockGrade.mockImplementation(async (check) => makeResult(check.id, true, 'evidence', 0.005));

    const { results, passRate, costUsd } = await run(makeChecksFile(), '/tmp/out.md');
    expect(results).toHaveLength(2);
    expect(passRate).toBe(1);
    expect(costUsd).toBe(0.01);
  });

  it('writes cost_usd line when cost is non-zero', async () => {
    mockGrade.mockImplementation(async (check) => makeResult(check.id, true, 'evidence', 0.003));

    await run(makeChecksFile(), '/tmp/out.md');
    expect(written).toContain('cost_usd: 0.006');
  });

  it('omits cost_usd line when cost is zero', async () => {
    mockGrade.mockImplementation(async (check) => makeResult(check.id, true));

    await run(makeChecksFile(), '/tmp/out.md');
    expect(written).not.toContain('cost_usd:');
  });

  it('rounds cost_usd to 4 decimal places', async () => {
    let call = 0;
    mockGrade.mockImplementation(async (check) => {
      const cost = call === 0 ? 0.1234567 : 0;
      call++;
      return makeResult(check.id, true, 'evidence', cost);
    });
    await run(makeChecksFile(), '/tmp/out.md');
    expect(written).toContain('cost_usd: 0.1235');
  });

  it('surfaces errored count when checks have pass: null', async () => {
    let call = 0;
    mockGrade.mockImplementation(async (check) => {
      if (call++ === 0) return makeResult(check.id, null, 'error: grader crashed');
      return makeResult(check.id, true);
    });
    await run(makeChecksFile(), '/tmp/out.md');
    expect(written).toContain('errored: 1');
  });

  it('omits errored when all checks returned boolean pass', async () => {
    mockGrade.mockImplementation(async (check) => makeResult(check.id, true));
    await run(makeChecksFile(), '/tmp/out.md');
    expect(written).not.toContain('errored:');
  });

  it('forwards controller to each gradeCheck call', async () => {
    mockGrade.mockImplementation(async (check) => makeResult(check.id, true));
    const controller = new AbortController();

    await run(makeChecksFile(), '/tmp/out.md', { controller });

    expect(mockGrade).toHaveBeenCalledTimes(2);
    expect(mockGrade.mock.calls[0]?.[2]).toEqual(expect.objectContaining({ controller }));
    expect(mockGrade.mock.calls[1]?.[2]).toEqual(expect.objectContaining({ controller }));
  });
});
