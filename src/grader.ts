import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Assertion } from "./config.js";
import { buildGraderPrompt } from "./prompt.js";

export interface AssertionResult {
  id: string;
  check: string;
  pass: boolean | null;
  evidence: string;
  cost_usd: number;
}

export interface Verdict {
  pass: boolean;
  evidence: string;
}

const DEFAULT_MODEL = "claude-haiku-4-5";

const VERDICT_SCHEMA = {
  type: "object" as const,
  properties: {
    pass: { type: "boolean" as const },
    evidence: { type: "string" as const },
  },
  required: ["pass", "evidence"],
  additionalProperties: false,
};

/**
 * Parse and validate a verdict from the structured output JSON string.
 */
export function parseVerdict(text: string): Verdict | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.pass === "boolean" && typeof parsed.evidence === "string") {
      return { pass: parsed.pass, evidence: parsed.evidence };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Grade a single assertion against an output file using the Agent SDK.
 */
export async function gradeAssertion(
  assertion: Assertion,
  outputPath: string,
  options: {
    model?: string;
    context?: string;
    verbose?: boolean;
  } = {},
): Promise<AssertionResult> {
  const model = assertion.model ?? options.model ?? DEFAULT_MODEL;
  const prompt = buildGraderPrompt(assertion, outputPath, options.context);

  // Prevent nested session errors
  delete process.env.CLAUDECODE;

  try {
    let resultText = "";
    let costUsd = 0;

    for await (const message of query({
      prompt,
      options: {
        model,
        tools: ["Read"],
        maxTurns: 5,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        outputFormat: {
          type: "json_schema",
          schema: VERDICT_SCHEMA,
        },
      },
    })) {
      if (message.type === "result") {
        if ("result" in message && typeof message.result === "string") {
          resultText = message.result;
        }
        if ("total_cost_usd" in message && typeof message.total_cost_usd === "number") {
          costUsd = message.total_cost_usd;
        }
      }
    }

    const verdict = parseVerdict(resultText);
    if (!verdict) {
      return {
        id: assertion.id,
        check: assertion.check,
        pass: null,
        evidence: `error: could not parse structured output from LLM response`,
        cost_usd: costUsd,
      };
    }

    return {
      id: assertion.id,
      check: assertion.check,
      pass: verdict.pass,
      evidence: verdict.evidence,
      cost_usd: costUsd,
    };
  } catch (err) {
    return {
      id: assertion.id,
      check: assertion.check,
      pass: null,
      evidence: `error: ${err instanceof Error ? err.message : String(err)}`,
      cost_usd: 0,
    };
  }
}
