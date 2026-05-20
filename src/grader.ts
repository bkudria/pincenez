import { dirname } from 'node:path';
import { query, SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import type { Check } from './config.js';
import { buildGraderSystemPrompt, buildGraderUserPrompt } from './prompt.js';
import { formatSdkError } from './sdk-error.js';

const GRADER_SYSTEM_PROMPT = buildGraderSystemPrompt();

export interface CheckResult {
  id: string;
  check: string;
  pass: boolean | null;
  evidence: string;
  cost_usd: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
}

export interface Verdict {
  pass: boolean;
  evidence: string;
}

const DEFAULT_MODEL = 'claude-haiku-4-5';

const VERDICT_SCHEMA = {
  type: 'object' as const,
  properties: {
    pass: { type: 'boolean' as const },
    evidence: { type: 'string' as const },
  },
  required: ['pass', 'evidence'],
  additionalProperties: false,
};

/**
 * Parse and validate a verdict from the structured output JSON string.
 */
export function parseVerdict(text: string): Verdict | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.pass === 'boolean' && typeof parsed.evidence === 'string') {
      return { pass: parsed.pass, evidence: parsed.evidence };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Grade a single check against an output file using the Agent SDK.
 */
export async function gradeCheck(
  check: Check,
  outputPath: string,
  options: {
    model?: string;
    context?: string;
    controller?: AbortController;
  } = {},
): Promise<CheckResult> {
  const model = check.model ?? options.model ?? DEFAULT_MODEL;
  const prompt = buildGraderUserPrompt(check, outputPath, options.context);

  try {
    let resultText = '';
    let costUsd = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let sdkError: Pick<
      SDKResultError,
      'subtype' | 'errors' | 'terminal_reason' | 'permission_denials'
    > | null = null;

    for await (const message of query({
      prompt,
      options: {
        model,
        env: { ...process.env, CLAUDECODE: undefined },
        tools: ['Read'],
        additionalDirectories: [dirname(outputPath)],
        maxTurns: 30,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
        abortController: options.controller,
        systemPrompt: [GRADER_SYSTEM_PROMPT, SYSTEM_PROMPT_DYNAMIC_BOUNDARY],
        outputFormat: {
          type: 'json_schema',
          schema: VERDICT_SCHEMA,
        },
      },
    })) {
      if (message.type === 'result') {
        costUsd = message.total_cost_usd;
        cacheCreationTokens = message.usage.cache_creation_input_tokens ?? 0;
        cacheReadTokens = message.usage.cache_read_input_tokens ?? 0;

        if (message.subtype === 'success') {
          // Prefer structured_output (pre-parsed object) over result (JSON string)
          if (message.structured_output != null) {
            resultText = JSON.stringify(message.structured_output);
          } else {
            resultText = message.result;
          }
        } else {
          sdkError = {
            subtype: message.subtype,
            errors: message.errors,
            terminal_reason: message.terminal_reason,
            permission_denials: message.permission_denials,
          };
        }
      }
    }

    if (sdkError) {
      return {
        id: check.id,
        check: check.check,
        pass: null,
        evidence: `error: ${formatSdkError(sdkError)}`,
        cost_usd: costUsd,
        cache_creation_tokens: cacheCreationTokens,
        cache_read_tokens: cacheReadTokens,
      };
    }

    const verdict = parseVerdict(resultText);
    if (!verdict) {
      const snippet = resultText.length > 0 ? resultText.slice(0, 200) : '(empty response)';
      return {
        id: check.id,
        check: check.check,
        pass: null,
        evidence: `error: could not parse structured output from LLM response: ${snippet}`,
        cost_usd: costUsd,
        cache_creation_tokens: cacheCreationTokens,
        cache_read_tokens: cacheReadTokens,
      };
    }

    return {
      id: check.id,
      check: check.check,
      pass: verdict.pass,
      evidence: verdict.evidence,
      cost_usd: costUsd,
      cache_creation_tokens: cacheCreationTokens,
      cache_read_tokens: cacheReadTokens,
    };
  } catch (err) {
    return {
      id: check.id,
      check: check.check,
      pass: null,
      evidence: `error: ${err instanceof Error ? err.message : String(err)}`,
      cost_usd: 0,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
    };
  }
}
