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

/**
 * Shared between the grader and lint system prompts. Mirrors scuttlerun's
 * `@guarantee TranscriptToolFieldContract` (scuttlerun.allium) — if scuttlerun
 * changes the captured fields, this section must be updated in lockstep.
 */
export function buildTranscriptFieldContractSection(): string {
  return [
    `## Transcript Field Contract`,
    ``,
    `When the output is a scuttlerun YAML transcript, tool-call entries are intentionally lossy: each known tool records only a small set of identifying fields, and every other input field the agent supplied is dropped before serialization. Full tool inputs survive only in the SDK JSONL session file, not in the YAML transcript.`,
    ``,
    `- \`Read\`, \`Write\`, \`Edit\` → \`path\` only. Content-bearing fields (\`content\`, \`old_string\`, \`new_string\`) are dropped: what was written or replaced cannot be verified from the YAML transcript alone — by design.`,
    `- \`Bash\` → \`command\`. \`Glob\`, \`Grep\` → \`pattern\`.`,
    `- \`TodoWrite\` → \`todos\`; \`TaskCreate\` → \`subject\`, \`description\`; \`TaskUpdate\` → \`task_id\` (plus \`status\` when supplied); \`TaskGet\` → \`task_id\`; \`TaskList\` → no extra fields.`,
    `- Any other tool name → the full \`input\` mapping appears verbatim under an \`input:\` key.`,
  ].join('\n');
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
    `- Slash-command invocations (e.g. \`/triage assess\`) are NOT separate transcript entries; the slash command appears as the prefix of the first \`user:\` message. A check like "the user invoked \`/foo\`" is verifiable by inspecting the first user message.`,
    `- Hooks do NOT appear as transcript entries at all; they are observable only via their side effects: file mutations, blocked or absent tool calls, hook stdout strings surfaced elsewhere. A check on hook behavior must look for the side effect, not a \`tool: hook\` entry. If the only available evidence is "the hook ran", and no side effect is captured, the check is not verifiable from the transcript and should fail with that explanation.`,
    ``,
    buildTranscriptFieldContractSection(),
    ``,
    `A check that asserts on written or replaced file content cannot be verified from the YAML transcript alone. If no other evidence source is available (e.g. the written file itself, readable at its recorded path), fail the check and explain that the transcript records only the \`path\` for Write/Edit by design.`,
  ].join('\n');
}
