import type { Check } from './config.js';
import { buildTranscriptFieldContractSection } from './prompt.js';

interface Slip {
  name: string;
  signal: string;
  example: string;
  fix: string;
}

interface AntiPattern {
  name: string;
  description: string;
  example: string;
  fix: string;
  slips?: Slip[];
}

export const ANTI_PATTERNS: AntiPattern[] = [
  {
    name: 'vague',
    description:
      'Different graders would disagree on pass/fail. Uses subjective terms like "high quality", "correct", "proper", "good", "best practices", "well-structured" without specifying what concretely to check.',
    example: '"Output is high quality" → should name the specific quality metric.',
    fix: '"Output contains a markdown table with at least 3 rows and a header row"',
    slips: [
      {
        name: 'Abstract-noun stand-ins',
        signal:
          'Nouns like "investigation", "presentation", "review", "consideration" sound concrete but need a grader to infer what counts.',
        example: '"investigation before presentation"',
        fix: 'Replace with the observable behaviour: "at least one Read/Grep/Bash call against the file before writing findings".',
      },
    ],
  },
  {
    name: 'compound',
    description:
      'Tests two or more independent things in one check. Contains "AND", "and also", "as well as", or tests multiple distinct behaviors. Each should be its own check.',
    example: '"Code uses correct syntax AND includes error handling" → split into two checks.',
    fix: '(1) "Response body is valid JSON" (2) "Response includes a \\"next_cursor\\" field for pagination"',
    slips: [
      {
        name: 'Likewise-joined intervals',
        signal:
          '"likewise" or "also" join two independent claims even when the usual "and"/"both" signals are absent.',
        example:
          '"Between the edits to A and B there is an AskUserQuestion; likewise between B and C"',
        fix: 'Split into two checks: one per interval.',
      },
      {
        name: 'Before/after-clause embedding',
        signal:
          'A temporal "before X" or "after X" clause quietly adds a second claim (the ordering itself).',
        example: '"The agent asks about item 2 before making any edit to hello.py"',
        fix: 'Split: (1) "asks about item 2"; (2) "the ask precedes any edit to hello.py".',
      },
      {
        name: 'Capitalized AND after a fix',
        signal:
          'Re-authoring (rewriting) a compound check often introduces a second AND in the rewrite — apply the enumeration test to the rewrite, not just the original.',
        example: '"...makes an investigative tool call AND asks a separate AskUserQuestion"',
        fix: 'Re-author once more so the rewrite itself contains only one independent claim.',
      },
    ],
  },
  {
    name: 'tautological',
    description:
      'Restates the prompt as a check without adding specificity. If the prompt says "write a function" and the check says "output contains a function", that\'s tautological. Good checks test HOW, not WHETHER.',
    example: 'Prompt "Write a haiku" → check "Output contains a haiku" (tautological).',
    fix: '"Output has exactly 3 lines following 5-7-5 syllable pattern"',
  },
  {
    name: 'always_passes',
    description:
      "Tests baseline LLM behavior that would happen without any special skill/config. If Claude would naturally do this without guidance, the check isn't testing anything meaningful. (Contrast unfalsifiable: a check that structurally cannot fail, rather than one the model satisfies by default.)",
    example: '"Output is written in English" or "Output contains code" for a coding task.',
    fix: '"Output uses the test-first pattern taught in the skill\'s TDD reference (not a generic `it.todo`)"',
  },
  {
    name: 'unverifiable',
    description:
      'Tests internal state or reasoning that can\'t be observed from the output. References what the agent "understood", "considered", or "thought about" rather than what it produced.',
    example: '"Agent understood the requirements deeply" → rewrite as observable behavior.',
    fix: '"Agent identified the performance bottleneck before proposing optimizations"',
  },
  {
    name: 'over_specific',
    description:
      'Prescribes a single implementation means when the intent is about the outcome. Names a specific function, operator, or tool as THE required approach when multiple valid alternatives exist. Signals: "uses [specific function]" as a requirement, "not [alternative]" framing that assumes only one alternative.',
    example: '"Uses eval-all for multi-file merge" — load() with glob also works.',
    fix: '"Produces a merged YAML document combining arrays from both input files"',
    slips: [
      {
        name: 'Enumerated list as requirement',
        signal:
          'A short list of specific tools, files, or syntaxes looks concrete but disallows equivalent alternatives — lint treats "X or Y" as "only X or Y" when an outcome-equivalent Z exists. Ask: would an enumerated alternative satisfy the intent? If yes, rewrite the outcome and keep the list as non-exhaustive examples.',
        example:
          '"Read or Grep tool call targeting notes.md" (misses cat/head/Bash); "pyproject.toml, setup.py, setup.cfg, or requirements.txt" (misses package.json, Cargo.toml, go.mod).',
        fix: '"any file-reading tool call against notes.md" (e.g., Read, Grep, or Bash cat); "a project-manifest file".',
      },
    ],
  },
  {
    name: 'unfalsifiable',
    description:
      'A check that no realistic transcript can fail — it passes whether or not the agent did the right thing, so it cannot discriminate pass from fail. The common form is a negative-universal ("no X without a preceding Y") that passes vacuously when there is simply no X. Contrast always_passes, which flags checks for baseline behaviour the model does anyway: always_passes is practically always true, while unfalsifiable is structurally unable to fail.',
    example:
      '"No database write occurs without a prior validation step" — passes vacuously in any run that never writes to the database.',
    fix: '(1) "A database write occurs" (2) "No database write occurs without a prior validation step"',
  },
];

export function buildLintSystemPrompt(): string {
  const parts: string[] = [];

  parts.push(
    `You are an eval check quality analyst. Your task is to check a single check for common anti-patterns that reduce eval reliability.`,
  );
  parts.push(``);
  parts.push(`## Domain Detection`);
  parts.push(``);
  parts.push(`Before analyzing the check, characterize the scenario's domain from the context:`);
  parts.push(
    `- **technical** — Code, data, APIs, systems. Checks can and should reference concrete, objectively verifiable properties.`,
  );
  parts.push(
    `- **creative** — Poetry, prose, design, music. Some subjectivity is inherent. Checks like "thematic progression" or "distinct imagery" are as concrete as this domain allows.`,
  );
  parts.push(`- **mixed** — Both technical and creative elements.`);
  parts.push(``);
  parts.push(
    `Use the detected domain to calibrate your anti-pattern checks. For creative domains, only flag "vague" when the check is genuinely ambiguous to any grader — not when it uses domain-appropriate language that trained readers would evaluate consistently.`,
  );
  parts.push(``);
  parts.push(`## Anti-Patterns to Check`);
  parts.push(``);

  ANTI_PATTERNS.forEach((ap, i) => {
    parts.push(`${i + 1}. **${ap.name}** — ${ap.description}`);
    parts.push(`   Bad:   ${ap.example}`);
    parts.push(`   Fixed: ${ap.fix}`);
    if (ap.slips && ap.slips.length > 0) {
      parts.push(`   Common Slips (sub-patterns of ${ap.name}):`);
      ap.slips.forEach((slip) => {
        parts.push(`     - ${slip.name} — ${slip.signal}`);
        parts.push(`       Bad:   ${slip.example}`);
        parts.push(`       Fixed: ${slip.fix}`);
      });
    }
    parts.push(``);
  });

  parts.push(buildTranscriptFieldContractSection());
  parts.push(``);
  parts.push(`## Rules`);
  parts.push(``);
  parts.push(
    `- Only flag genuine issues. Many checks are fine — return an empty issues array for good checks.`,
  );
  parts.push(
    `- Be specific in suggestions. Don't just say "be more specific" — give a concrete rewrite or direction.`,
  );
  parts.push(
    `- Your suggestions must not introduce other anti-patterns. Before suggesting a rewrite, verify it would pass your own checks.`,
  );
  parts.push(`- A check can have multiple issues (e.g., both vague AND compound).`);
  parts.push(
    `- When flagging tautological, you need the scenario context to compare against. Without context, skip this check.`,
  );
  parts.push(
    `- For always_passes, consider whether a general-purpose LLM would typically do this without special instruction.`,
  );
  parts.push(
    `- For over_specific, do NOT flag checks where the alternative approach would be a security vulnerability, a correctness violation, or a contract breach — not just a stylistic preference. A check like "uses approach X, not approach Y" is legitimately specific ONLY when Y would produce an objectively wrong outcome (e.g. a known vulnerability class, a protocol violation, or a silently-wrong computation). Only flag when multiple valid approaches exist and the check mandates one for non-correctness reasons.`,
  );
  parts.push(
    `- For unverifiable, treat literal tool-call entries in transcripts as observable output, not as references to internal machinery. Plugin-component tool calls — \`tool: Skill\` (input: \`{skill: ...}\`), \`tool: Agent\` (input: \`{subagent_type: ..., prompt: ...}\`), and \`tool: mcp__<server>__<tool>\` — appear verbatim in the YAML transcript the grader reads. A check like "the skill \`foo\` was loaded" or "the Agent tool was dispatched with subagent_type plugin-validator" or "mcp__github__create_issue was called" is verifiable from the transcript and must NOT be flagged as unverifiable. Hooks and slash commands are NOT directly surfaced in the transcript today; checks asserting on them are correctly flagged unless they reference an observable side-effect (e.g. a hook's stdout string).`,
  );
  parts.push(
    `- Never suggest a rewrite that asserts on fields the transcript drops (per the Transcript Field Contract above, e.g. the content written by Write/Edit) — such a check is ungradeable from the transcript. A check that already depends on dropped fields warrants unverifiable; suggest a rewrite that targets a recorded field (e.g. the path) or another observable evidence source instead.`,
  );
  parts.push(
    `- When the user message includes a "Session Tool Configuration" list, treat it as the authoritative list of tools available in the session under test — custom and MCP tools may be provisioned beyond the defaults. Do NOT flag a check on tool-availability grounds when the tool it names is listed, and do NOT speculate from general knowledge about which tools are or are not available. Without the list, make no claims about tool availability.`,
  );
  parts.push(
    `- For unfalsifiable, ask whether ANY realistic transcript would make the check FAIL. Only flag when the check passes on essentially all plausible transcripts — most often a negative-universal whose subject ("X" in "no X without Y") may simply be absent, so it passes vacuously. Do NOT flag a negative check that can fail on a realistic transcript (e.g. "no Edit to config.py appears" when editing config.py is a plausible mistake).`,
  );

  return parts.join('\n');
}

export function buildLintUserPrompt(
  check: Check,
  context?: string,
  availableTools?: string[],
): string {
  const parts: string[] = [];

  parts.push(`## Check to Analyze`);
  parts.push(``);
  parts.push(`**Check:** ${check.check}`);
  if (check.note) {
    parts.push(`**Note:** ${check.note}`);
  }

  if (context) {
    parts.push(``);
    parts.push(`## Scenario Context`);
    parts.push(``);
    parts.push(`The scenario prompt (for detecting tautological checks):`);
    parts.push(context.trim());
  }

  if (availableTools && availableTools.length > 0) {
    parts.push(``);
    parts.push(`## Session Tool Configuration`);
    parts.push(``);
    parts.push(`Tools available in the session under test:`);
    parts.push(availableTools.map((t) => `- ${t}`).join('\n'));
  }

  return parts.join('\n');
}

/**
 * Return a human/agent-readable reference of the lint anti-patterns.
 * Displayed by `pincenez lint --help` and when lint is run with no arguments.
 */
export function getLintRulesText(): string {
  const lines: string[] = [];

  lines.push(``);
  lines.push(`Anti-Patterns Detected:`);

  for (const ap of ANTI_PATTERNS) {
    lines.push(`  ${ap.name}`);
    lines.push(`    ${ap.description}`);
    lines.push(`    Bad:   ${ap.example}`);
    lines.push(`    Fixed: ${ap.fix}`);
    if (ap.slips && ap.slips.length > 0) {
      lines.push(`    Common Slips (sub-patterns of ${ap.name}):`);
      for (const slip of ap.slips) {
        lines.push(`      - ${slip.name} — ${slip.signal}`);
        lines.push(`        Bad:   ${slip.example}`);
        lines.push(`        Fixed: ${slip.fix}`);
      }
    }
    lines.push(``);
  }

  lines.push(`Writing Good Checks:`);
  lines.push(`  - Each check should test one thing (split compound checks)`);
  lines.push(`  - Name specific elements, not vague qualities`);
  lines.push(`  - Test what the config adds, not baseline LLM behavior`);
  lines.push(`  - Assert observable output, not internal reasoning`);
  lines.push(
    `  - Plugin-component tool calls (\`tool: Skill\`, \`tool: Agent\`, \`tool: mcp__<server>__<tool>\`) in the transcript ARE observable output`,
  );
  lines.push(`  - Add a note: field to orient the grader toward the right evidence`);

  return lines.join('\n');
}
