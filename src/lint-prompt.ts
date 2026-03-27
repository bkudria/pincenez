import type { Assertion } from "./config.js";

/**
 * Build the lint prompt for evaluating a single assertion's quality.
 */
export function buildLintPrompt(
  assertion: Assertion,
  context?: string,
): string {
  const parts: string[] = [];

  parts.push(`You are an eval assertion quality analyst. Your task is to check a single assertion for common anti-patterns that reduce eval reliability.`);
  parts.push(``);
  parts.push(`## Anti-Patterns to Check`);
  parts.push(``);
  parts.push(`1. **vague** — Different graders would disagree on pass/fail. Uses subjective terms like "high quality", "correct", "proper", "good", "best practices", "well-structured" without specifying what concretely to check.`);
  parts.push(`   Example: "Output is high quality" → should name the specific quality metric.`);
  parts.push(``);
  parts.push(`2. **compound** — Tests two or more independent things in one assertion. Contains "AND", "and also", "as well as", or tests multiple distinct behaviors. Each should be its own assertion.`);
  parts.push(`   Example: "Code uses correct syntax AND includes error handling" → split into two assertions.`);
  parts.push(``);
  parts.push(`3. **tautological** — Restates the prompt as an assertion without adding specificity. If the prompt says "write a function" and the assertion says "output contains a function", that's tautological. Good assertions test HOW, not WHETHER.`);
  parts.push(`   Example: Prompt "Write a haiku" → assertion "Output contains a haiku" (tautological). Better: "Output has exactly 3 lines following 5-7-5 syllable pattern".`);
  parts.push(``);
  parts.push(`4. **always_passes** — Tests baseline LLM behavior that would happen without any special skill/config. If Claude would naturally do this without guidance, the assertion isn't testing anything meaningful.`);
  parts.push(`   Example: "Output is written in English" or "Output contains code" for a coding task.`);
  parts.push(``);
  parts.push(`5. **unverifiable** — Tests internal state or reasoning that can't be observed from the output. References what the agent "understood", "considered", or "thought about" rather than what it produced.`);
  parts.push(`   Example: "Agent understood the requirements deeply" → rewrite as observable behavior.`);
  parts.push(``);
  parts.push(`## Assertion to Analyze`);
  parts.push(``);
  parts.push(`**Check:** ${assertion.check}`);
  if (assertion.note) {
    parts.push(`**Note:** ${assertion.note}`);
  }
  parts.push(``);

  if (context) {
    parts.push(`## Scenario Context`);
    parts.push(``);
    parts.push(`The scenario prompt (for detecting tautological assertions):`);
    parts.push(context.trim());
    parts.push(``);
  }

  parts.push(`## Rules`);
  parts.push(``);
  parts.push(`- Only flag genuine issues. Many assertions are fine — return an empty issues array for good assertions.`);
  parts.push(`- Be specific in suggestions. Don't just say "be more specific" — give a concrete rewrite or direction.`);
  parts.push(`- An assertion can have multiple issues (e.g., both vague AND compound).`);
  parts.push(`- When flagging tautological, you need the scenario context to compare against. Without context, skip this check.`);
  parts.push(`- For always_passes, consider whether a general-purpose LLM would typically do this without special instruction.`);

  return parts.join("\n");
}
