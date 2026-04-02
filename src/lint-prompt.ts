import type { Check } from "./config.js";

/**
 * Build the lint prompt for evaluating a single check's quality.
 */
export function buildLintPrompt(
  check: Check,
  context?: string,
): string {
  const parts: string[] = [];

  parts.push(`You are an eval check quality analyst. Your task is to check a single check for common anti-patterns that reduce eval reliability.`);
  parts.push(``);
  parts.push(`## Domain Detection`);
  parts.push(``);
  parts.push(`Before analyzing the check, characterize the scenario's domain from the context:`);
  parts.push(`- **technical** — Code, data, APIs, systems. Checks can and should reference concrete, objectively verifiable properties.`);
  parts.push(`- **creative** — Poetry, prose, design, music. Some subjectivity is inherent. Checks like "thematic progression" or "distinct imagery" are as concrete as this domain allows.`);
  parts.push(`- **mixed** — Both technical and creative elements.`);
  parts.push(``);
  parts.push(`Use the detected domain to calibrate your anti-pattern checks. For creative domains, only flag "vague" when the check is genuinely ambiguous to any grader — not when it uses domain-appropriate language that trained readers would evaluate consistently.`);
  parts.push(``);
  parts.push(`## Anti-Patterns to Check`);
  parts.push(``);
  parts.push(`1. **vague** — Different graders would disagree on pass/fail. Uses subjective terms like "high quality", "correct", "proper", "good", "best practices", "well-structured" without specifying what concretely to check.`);
  parts.push(`   Example: "Output is high quality" → should name the specific quality metric.`);
  parts.push(``);
  parts.push(`2. **compound** — Tests two or more independent things in one check. Contains "AND", "and also", "as well as", or tests multiple distinct behaviors. Each should be its own check.`);
  parts.push(`   Example: "Code uses correct syntax AND includes error handling" → split into two checks.`);
  parts.push(``);
  parts.push(`3. **tautological** — Restates the prompt as a check without adding specificity. If the prompt says "write a function" and the check says "output contains a function", that's tautological. Good checks test HOW, not WHETHER.`);
  parts.push(`   Example: Prompt "Write a haiku" → check "Output contains a haiku" (tautological). Better: "Output has exactly 3 lines following 5-7-5 syllable pattern".`);
  parts.push(``);
  parts.push(`4. **always_passes** — Tests baseline LLM behavior that would happen without any special skill/config. If Claude would naturally do this without guidance, the check isn't testing anything meaningful.`);
  parts.push(`   Example: "Output is written in English" or "Output contains code" for a coding task.`);
  parts.push(``);
  parts.push(`5. **unverifiable** — Tests internal state or reasoning that can't be observed from the output. References what the agent "understood", "considered", or "thought about" rather than what it produced.`);
  parts.push(`   Example: "Agent understood the requirements deeply" → rewrite as observable behavior.`);
  parts.push(``);
  parts.push(`## Check to Analyze`);
  parts.push(``);
  parts.push(`**Check:** ${check.check}`);
  if (check.note) {
    parts.push(`**Note:** ${check.note}`);
  }
  parts.push(``);

  if (context) {
    parts.push(`## Scenario Context`);
    parts.push(``);
    parts.push(`The scenario prompt (for detecting tautological checks):`);
    parts.push(context.trim());
    parts.push(``);
  }

  parts.push(`## Rules`);
  parts.push(``);
  parts.push(`- Only flag genuine issues. Many checks are fine — return an empty issues array for good checks.`);
  parts.push(`- Be specific in suggestions. Don't just say "be more specific" — give a concrete rewrite or direction.`);
  parts.push(`- Your suggestions must not introduce other anti-patterns. Before suggesting a rewrite, verify it would pass your own checks.`);
  parts.push(`- A check can have multiple issues (e.g., both vague AND compound).`);
  parts.push(`- When flagging tautological, you need the scenario context to compare against. Without context, skip this check.`);
  parts.push(`- For always_passes, consider whether a general-purpose LLM would typically do this without special instruction.`);

  return parts.join("\n");
}
