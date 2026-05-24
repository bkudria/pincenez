import type { Check } from './config.js';

export function buildGraderUserPrompt(check: Check, outputPath: string, context?: string): string {
  const parts: string[] = [];

  parts.push(`Output file to evaluate: ${outputPath}`);
  parts.push(``);

  if (context) {
    parts.push(`## Context`);
    parts.push(``);
    parts.push(`The output was produced by the following task:`);
    parts.push(context.trim());
    parts.push(``);
  }

  parts.push(`## Check`);
  parts.push(``);
  parts.push(`**Check:** ${check.check}`);
  if (check.note) {
    parts.push(`**Note:** ${check.note}`);
  }

  return parts.join('\n');
}

export function buildGraderSystemPrompt(): string {
  return [
    `You are an eval grader. Your task is to evaluate a single check against an output.`,
    ``,
    `## Instructions`,
    ``,
    `1. Read the output file at the path provided in the user message`,
    `2. Reason step-by-step about whether the check is satisfied`,
    `3. Return your verdict as structured output`,
    ``,
    `## Grading Rules`,
    ``,
    `- Evaluate ONLY this check — nothing else.`,
    `- Base your verdict on evidence found in the output. If the output references file paths (e.g., files the agent created), you may read those files to gather additional evidence.`,
    `- For NEGATIVE checks (checking something did NOT happen): search the entire output thoroughly. Only pass if you find no evidence of the prohibited behavior. Absence of evidence requires a thorough search — state what you looked for and confirm it was not found.`,
    `- Provide concise, specific evidence (1-2 sentences). Quote relevant parts of the output.`,
    `- If the output does not contain enough information to evaluate the check, fail it with an explanation of what is missing.`,
    ``,
    `## Transcript Awareness`,
    ``,
    `- The output file is often a scuttlerun YAML transcript: a 'conversation:' sequence of typed entries (\`- user:\`, \`- assistant:\`, \`- thinking:\`, \`- tool: <Name>\`, \`- oracle:\`).`,
    `- Plugin-component invocations appear as literal tool-call entries in that YAML and ARE observable evidence — treat them the same as any other quoted output, not as references to hidden internal state:`,
    `  - \`tool: Skill\` with \`input: { skill: <id>, ... }\` indicates the skill \`<id>\` was loaded.`,
    `  - \`tool: Agent\` with \`input: { subagent_type: <id>, prompt: ..., ... }\` indicates the sub-agent \`<id>\` was dispatched.`,
    `  - \`tool: mcp__<server>__<tool>\` indicates the MCP tool \`<tool>\` on server \`<server>\` was called.`,
    `- Checks like "the \`X\` skill was loaded", "the Agent tool was dispatched with subagent_type \`Y\`", or "\`mcp__github__create_issue\` was called" are verifiable from the transcript. Search for the corresponding tool-call entry; cite it as evidence.`,
  ].join('\n');
}
