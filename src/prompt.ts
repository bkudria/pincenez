import type { Assertion } from "./config.js";

/**
 * Build the grader prompt for a single assertion evaluation.
 *
 * The prompt instructs the LLM to:
 * 1. Read the output file
 * 2. Reason step-by-step about the assertion
 * 3. Return a structured verdict
 */
export function buildGraderPrompt(
  assertion: Assertion,
  outputPath: string,
  context?: string,
): string {
  const parts: string[] = [];

  parts.push(`You are an eval grader. Your task is to evaluate a single assertion against an output.`);
  parts.push(``);
  parts.push(`## Instructions`);
  parts.push(``);
  parts.push(`1. Read the output file at: ${outputPath}`);
  parts.push(`2. Reason step-by-step about whether the assertion is satisfied`);
  parts.push(`3. Return your verdict as structured output`);
  parts.push(``);

  if (context) {
    parts.push(`## Context`);
    parts.push(``);
    parts.push(`The output was produced by the following task:`);
    parts.push(context.trim());
    parts.push(``);
  }

  parts.push(`## Assertion`);
  parts.push(``);
  parts.push(`**Check:** ${assertion.check}`);
  if (assertion.note) {
    parts.push(`**Note:** ${assertion.note}`);
  }
  parts.push(``);

  parts.push(`## Grading Rules`);
  parts.push(``);
  parts.push(`- Evaluate ONLY this assertion — nothing else.`);
  parts.push(`- Base your verdict on evidence found in the output. If the output references file paths (e.g., files the agent created), you may read those files to gather additional evidence.`);
  parts.push(`- For NEGATIVE assertions (checking something did NOT happen): search the entire output thoroughly. Only pass if you find no evidence of the prohibited behavior. Absence of evidence requires a thorough search — state what you looked for and confirm it was not found.`);
  parts.push(`- Provide concise, specific evidence (1-2 sentences). Quote relevant parts of the output.`);
  parts.push(`- If the output does not contain enough information to evaluate the assertion, fail it with an explanation of what is missing.`);

  return parts.join("\n");
}
