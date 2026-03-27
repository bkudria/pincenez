import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Assertion } from "./config.js";
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

const DEFAULT_MODEL = "claude-haiku-4-5";

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
 * Lint a single assertion for quality anti-patterns using an LLM.
 */
export async function lintAssertion(
  assertion: Assertion,
  options: {
    model?: string;
    context?: string;
    verbose?: boolean;
  } = {},
): Promise<LintResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const prompt = buildLintPrompt(assertion, options.context);

  // Prevent nested session errors
  delete process.env.CLAUDECODE;

  try {
    let resultText = "";

    for await (const message of query({
      prompt,
      options: {
        model,
        tools: [],
        maxTurns: 1,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        outputFormat: {
          type: "json_schema",
          schema: LINT_SCHEMA,
        },
      },
    })) {
      if (message.type === "result" && "result" in message && typeof message.result === "string") {
        resultText = message.result;
      }
    }

    const issues = parseLintOutput(resultText);
    if (!issues) {
      return {
        id: assertion.id,
        check: assertion.check,
        issues: [{ anti_pattern: "error", suggestion: "could not parse structured output from LLM response" }],
      };
    }

    return {
      id: assertion.id,
      check: assertion.check,
      issues,
    };
  } catch (err) {
    return {
      id: assertion.id,
      check: assertion.check,
      issues: [{ anti_pattern: "error", suggestion: `${err instanceof Error ? err.message : String(err)}` }],
    };
  }
}
