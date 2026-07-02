import { query, SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '@anthropic-ai/claude-agent-sdk';
import type { SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import type { Check } from './config.js';
import { ANTI_PATTERNS, buildLintSystemPrompt, buildLintUserPrompt } from './lint-prompt.js';
import { formatSdkError } from './errors.js';

const LINT_SYSTEM_PROMPT = buildLintSystemPrompt();

export interface LintIssue {
  anti_pattern: string;
  suggestion: string;
}

export interface LintResult {
  id: string;
  check: string;
  issues: LintIssue[];
  cost_usd: number;
}

const DEFAULT_MODEL = 'claude-sonnet-5';

const LINT_SCHEMA = {
  type: 'object' as const,
  properties: {
    issues: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          anti_pattern: {
            type: 'string' as const,
            enum: ANTI_PATTERNS.map((ap) => ap.name),
          },
          suggestion: { type: 'string' as const },
        },
        required: ['anti_pattern', 'suggestion'],
        additionalProperties: false,
      },
    },
  },
  required: ['issues'],
  additionalProperties: false,
};

/**
 * Parse and validate lint issues from the structured output JSON string.
 */
export function parseLintOutput(text: string): LintIssue[] | null {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.issues)) return null;
    for (const issue of parsed.issues) {
      if (typeof issue.anti_pattern !== 'string' || typeof issue.suggestion !== 'string') {
        return null;
      }
    }
    return parsed.issues;
  } catch {
    return null;
  }
}

/**
 * Lint a single check for quality anti-patterns using an LLM.
 */
export async function lintCheck(
  check: Check,
  options: {
    model?: string;
    context?: string;
    availableTools?: string[];
    controller?: AbortController;
    sdkEnv?: Record<string, string | undefined>;
  } = {},
): Promise<LintResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const prompt = buildLintUserPrompt(check, options.context, options.availableTools);

  try {
    let resultText = '';
    let costUsd = 0;
    let sdkError: Pick<
      SDKResultError,
      'subtype' | 'errors' | 'terminal_reason' | 'permission_denials'
    > | null = null;

    for await (const message of query({
      prompt,
      options: {
        model,
        env: options.sdkEnv ?? { ...process.env, CLAUDECODE: undefined },
        tools: [],
        maxTurns: 10,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
        abortController: options.controller,
        systemPrompt: [LINT_SYSTEM_PROMPT, SYSTEM_PROMPT_DYNAMIC_BOUNDARY],
        outputFormat: {
          type: 'json_schema',
          schema: LINT_SCHEMA,
        },
      },
    })) {
      if (message.type === 'result') {
        costUsd = message.total_cost_usd;

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
        issues: [{ anti_pattern: 'error', suggestion: formatSdkError(sdkError) }],
        cost_usd: costUsd,
      };
    }

    const issues = parseLintOutput(resultText);
    if (!issues) {
      const snippet = resultText.length > 0 ? resultText.slice(0, 200) : '(empty response)';
      return {
        id: check.id,
        check: check.check,
        issues: [
          {
            anti_pattern: 'error',
            suggestion: `could not parse structured output from LLM response: ${snippet}`,
          },
        ],
        cost_usd: costUsd,
      };
    }

    return {
      id: check.id,
      check: check.check,
      issues,
      cost_usd: costUsd,
    };
  } catch (err) {
    return {
      id: check.id,
      check: check.check,
      issues: [
        {
          anti_pattern: 'error',
          suggestion: `${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      cost_usd: 0,
    };
  }
}
