import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Check } from "./config.js";
import { buildLintPrompt } from "./lint-prompt.js";

export interface LintIssue {
  anti_pattern: string;
  suggestion: string;
}

export interface LintResult {
  id: string;
  check: string;
  issues: LintIssue[];
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

const LINT_SCHEMA = {
  type: "object" as const,
  properties: {
    issues: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          anti_pattern: { type: "string" as const },
          suggestion: { type: "string" as const },
        },
        required: ["anti_pattern", "suggestion"],
        additionalProperties: false,
      },
    },
  },
  required: ["issues"],
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
      if (typeof issue.anti_pattern !== "string" || typeof issue.suggestion !== "string") {
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
  } = {},
): Promise<LintResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const prompt = buildLintPrompt(check, options.context);

  try {
    let resultText = "";
    let sdkError: { subtype: string; errors: string[] } | null = null;

    for await (const message of query({
      prompt,
      options: {
        model,
        env: { ...process.env, CLAUDECODE: undefined },
        tools: [],
        maxTurns: 10,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        outputFormat: {
          type: "json_schema",
          schema: LINT_SCHEMA,
        },
      },
    })) {
      if (message.type === "result") {
        if ("subtype" in message && message.subtype === "success") {
          // Prefer structured_output (pre-parsed object) over result (JSON string)
          if ("structured_output" in message && message.structured_output != null) {
            resultText = JSON.stringify(message.structured_output);
          } else if ("result" in message && typeof message.result === "string") {
            resultText = message.result;
          }
        } else if ("subtype" in message) {
          const errMsg = message as unknown as { subtype: string; errors: string[] };
          sdkError = { subtype: errMsg.subtype, errors: errMsg.errors };
        }
      }
    }

    if (sdkError) {
      const errorDetail = sdkError.errors.length > 0
        ? sdkError.errors.join("; ")
        : "no error details provided";
      return {
        id: check.id,
        check: check.check,
        issues: [{ anti_pattern: "error", suggestion: `SDK result ${sdkError.subtype}: ${errorDetail}` }],
      };
    }

    const issues = parseLintOutput(resultText);
    if (!issues) {
      const snippet = resultText.length > 0
        ? resultText.slice(0, 200)
        : "(empty response)";
      return {
        id: check.id,
        check: check.check,
        issues: [{ anti_pattern: "error", suggestion: `could not parse structured output from LLM response: ${snippet}` }],
      };
    }

    return {
      id: check.id,
      check: check.check,
      issues,
    };
  } catch (err) {
    return {
      id: check.id,
      check: check.check,
      issues: [{ anti_pattern: "error", suggestion: `${err instanceof Error ? err.message : String(err)}` }],
    };
  }
}
