import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { formatCliError, cliExitCode, formatSdkError, UsageError } from '../src/errors.js';
import { EXIT_CONFIG_ERROR, EXIT_RUNTIME_ERROR } from '../src/exit-codes.js';

describe('formatCliError', () => {
  it('formats a ZodError as a Checks file error', () => {
    const result = z.object({ name: z.string() }).safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    const out = formatCliError(result.error);
    expect(out.startsWith('[pincenez] Checks file error: ')).toBe(true);
  });

  it('formats a generic Error as [pincenez] Error', () => {
    expect(formatCliError(new Error('kaboom'))).toBe('[pincenez] Error: kaboom');
  });

  it('stringifies non-Error throws', () => {
    expect(formatCliError('string-error')).toBe('[pincenez] Error: string-error');
  });

  it('handles a real safeParse failure end-to-end', () => {
    const result = z.string().safeParse(42);
    expect(result.success).toBe(false);
    if (result.success) return;
    const out = formatCliError(result.error);
    expect(out.startsWith('[pincenez] Checks file error: ')).toBe(true);
  });
});

describe('cliExitCode', () => {
  it('returns EXIT_CONFIG_ERROR for a ZodError', () => {
    const result = z.string().safeParse(42);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(cliExitCode(result.error)).toBe(EXIT_CONFIG_ERROR);
  });

  it('returns EXIT_CONFIG_ERROR for a UsageError', () => {
    expect(cliExitCode(new UsageError('bad flag'))).toBe(EXIT_CONFIG_ERROR);
  });

  it('returns EXIT_RUNTIME_ERROR for a generic Error', () => {
    expect(cliExitCode(new Error('kaboom'))).toBe(EXIT_RUNTIME_ERROR);
  });

  it('returns EXIT_RUNTIME_ERROR for a non-Error throw', () => {
    expect(cliExitCode('string-error')).toBe(EXIT_RUNTIME_ERROR);
  });
});

describe('formatSdkError', () => {
  it('formats a basic SDKResultError with all fields populated', () => {
    const out = formatSdkError({
      subtype: 'error_during_execution',
      errors: ['boom', 'crash'],
      terminal_reason: 'cancelled',
      permission_denials: [],
    });
    expect(out).toBe('SDK result error_during_execution (terminal: cancelled): boom; crash');
  });

  it('omits terminal_reason when null/undefined', () => {
    const out = formatSdkError({
      subtype: 'error_during_execution',
      errors: ['boom'],
      terminal_reason: null,
      permission_denials: [],
    });
    expect(out).toBe('SDK result error_during_execution: boom');
  });

  it('shows "no error details provided" when errors array is empty', () => {
    const out = formatSdkError({
      subtype: 'error_during_execution',
      errors: [],
      terminal_reason: null,
      permission_denials: [],
    });
    expect(out).toBe('SDK result error_during_execution: no error details provided');
  });

  it('appends denied tools when permission_denials is non-empty', () => {
    const out = formatSdkError({
      subtype: 'error_during_execution',
      errors: ['boom'],
      terminal_reason: null,
      permission_denials: [
        { tool_name: 'Bash', tool_input: {} },
        { tool_name: 'Write', tool_input: {} },
      ],
    });
    expect(out).toBe('SDK result error_during_execution: boom; denied tools: Bash, Write');
  });
});
