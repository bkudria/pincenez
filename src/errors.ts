import { z } from 'zod';
import type { SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import { EXIT_CONFIG_ERROR, EXIT_RUNTIME_ERROR } from './exit-codes.js';

export function formatCliError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return `[pincenez] Checks file error: ${err.message}`;
  }
  return `[pincenez] Error: ${err instanceof Error ? err.message : String(err)}`;
}

export function cliExitCode(err: unknown): number {
  return err instanceof z.ZodError ? EXIT_CONFIG_ERROR : EXIT_RUNTIME_ERROR;
}

export function formatSdkError(
  err: Pick<SDKResultError, 'subtype' | 'errors' | 'terminal_reason' | 'permission_denials'>,
): string {
  const detail = err.errors.length > 0 ? err.errors.join('; ') : 'no error details provided';
  const terminal = err.terminal_reason ? ` (terminal: ${err.terminal_reason})` : '';
  const denied =
    err.permission_denials.length > 0
      ? `; denied tools: ${err.permission_denials.map((d) => d.tool_name).join(', ')}`
      : '';
  return `SDK result ${err.subtype}${terminal}: ${detail}${denied}`;
}
