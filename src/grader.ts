import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Assertion } from "./config.js";
import { buildGraderPrompt } from "./prompt.js";

export interface AssertionResult {
  id: string;
  check: string;
  pass: boolean | null;
  evidence: string;
}

const DEFAULT_MODEL = "claude-haiku-4-5";

/**
 * Extract a JSON verdict from the LLM's response text.
 * Looks for a ```json code block containing {pass, evidence}.
 */
export function extractVerdict(text: string): { pass: boolean; evidence: string } | null {
  // Try to find a ```json block
  const jsonBlockMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (typeof parsed.pass === "boolean" && typeof parsed.evidence === "string") {
        return parsed;
      }
    } catch {
      // Fall through to other strategies
    }
  }

  // Try to find any JSON object with pass and evidence
  const jsonMatch = text.match(/\{[^{}]*"pass"\s*:\s*(true|false)[^{}]*"evidence"\s*:\s*"[^"]*"[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.pass === "boolean" && typeof parsed.evidence === "string") {
        return parsed;
      }
    } catch {
      // Fall through
    }
  }

  return null;
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

    for await (const message of query({
      prompt,
      options: {
        model,
        tools: ["Read"],
        maxTurns: 5,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    })) {
      if (message.type === "result" && "result" in message && typeof message.result === "string") {
        resultText = message.result;
      }
    }

    // Extract JSON verdict from the result text
    const verdict = extractVerdict(resultText);
    if (!verdict) {
      return {
        id: assertion.id,
        check: assertion.check,
        pass: null,
        evidence: `error: could not extract verdict from LLM response`,
      };
    }

    return {
      id: assertion.id,
      check: assertion.check,
      pass: verdict.pass,
      evidence: verdict.evidence,
    };
  } catch (err) {
    return {
      id: assertion.id,
      check: assertion.check,
      pass: null,
      evidence: `error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
