import { describe, it, expect } from 'vitest';
import {
  buildLintSystemPrompt,
  buildLintUserPrompt,
  getLintRulesText,
} from '../src/lint-prompt.js';
import type { Check } from '../src/config.js';

const baseCheck: Check = {
  id: 'test-1',
  check: 'The output contains a greeting',
};

describe('buildLintSystemPrompt', () => {
  it('contains the lint role intro', () => {
    expect(buildLintSystemPrompt()).toContain('eval check quality analyst');
  });

  it('includes the domain detection section', () => {
    const sys = buildLintSystemPrompt();
    expect(sys).toContain('## Domain Detection');
    expect(sys).toContain('**technical**');
    expect(sys).toContain('**creative**');
    expect(sys).toContain('**mixed**');
  });

  it('includes all seven anti-pattern definitions', () => {
    const sys = buildLintSystemPrompt();
    expect(sys).toContain('**vague**');
    expect(sys).toContain('**compound**');
    expect(sys).toContain('**tautological**');
    expect(sys).toContain('**always_passes**');
    expect(sys).toContain('**unverifiable**');
    expect(sys).toContain('**over_specific**');
    expect(sys).toContain('**unfalsifiable**');
  });

  it('includes the Rules section with self-consistency, over_specific, and unfalsifiable guards', () => {
    const sys = buildLintSystemPrompt();
    expect(sys).toContain('## Rules');
    expect(sys).toContain('suggestions must not introduce other anti-patterns');
    expect(sys).toContain('legitimately specific');
    expect(sys).toContain('For unfalsifiable');
    expect(sys).toContain('passes vacuously');
  });

  it('does not contain dynamic per-check content', () => {
    const sys = buildLintSystemPrompt();
    expect(sys).not.toContain('## Check to Analyze');
    expect(sys).not.toContain('**Check:**');
    expect(sys).not.toContain('## Scenario Context');
  });

  it('tells the analyst that plugin-component tool calls in transcripts are observable', () => {
    const sys = buildLintSystemPrompt();
    // The guidance must name the three transcript-visible plugin-component tool
    // forms so the analyst does not flag checks asserting on them as unverifiable.
    expect(sys).toContain('tool: Skill');
    expect(sys).toContain('tool: Agent');
    expect(sys).toContain('mcp__');
    // The clause must be scoped to unverifiable, not a stray mention elsewhere.
    const unverifiableIndex = sys.indexOf('For unverifiable');
    const skillIndex = sys.indexOf('tool: Skill');
    expect(unverifiableIndex).toBeGreaterThan(-1);
    expect(skillIndex).toBeGreaterThan(unverifiableIndex);
  });

  it('documents the transcript field contract (lossy tool entries)', () => {
    const sys = buildLintSystemPrompt();
    expect(sys).toContain('## Transcript Field Contract');
    expect(sys).toContain('old_string');
    expect(sys).toContain('new_string');
    expect(sys).toMatch(/dropped/i);
    expect(sys).toContain('JSONL');
  });

  it('forbids suggesting rewrites that assert on dropped transcript fields', () => {
    const sys = buildLintSystemPrompt();
    const rulesIndex = sys.indexOf('## Rules');
    expect(rulesIndex).toBeGreaterThan(-1);
    const rules = sys.slice(rulesIndex);
    // The rule must connect dropped fields to ungradeable suggestions.
    expect(rules).toMatch(/ungradeable/i);
    expect(rules).toMatch(/dropped/i);
  });

  it('treats a provided session tool list as authoritative for availability', () => {
    const sys = buildLintSystemPrompt();
    const rules = sys.slice(sys.indexOf('## Rules'));
    expect(rules).toContain('Session Tool Configuration');
    expect(rules).toMatch(/authoritative/i);
    // Without the list, the analyst must not speculate about availability.
    expect(rules).toMatch(/speculate|general knowledge/i);
  });
});

describe('buildLintUserPrompt', () => {
  it('includes the check text', () => {
    const prompt = buildLintUserPrompt(baseCheck);
    expect(prompt).toContain('The output contains a greeting');
  });

  it('includes the note when present', () => {
    const check: Check = { ...baseCheck, note: 'check the header' };
    const prompt = buildLintUserPrompt(check);
    expect(prompt).toContain('**Note:** check the header');
  });

  it('omits the note when absent', () => {
    const prompt = buildLintUserPrompt(baseCheck);
    expect(prompt).not.toContain('**Note:**');
  });

  it('includes scenario context section when provided', () => {
    const prompt = buildLintUserPrompt(baseCheck, '  Write a haiku  ');
    expect(prompt).toContain('## Scenario Context');
    expect(prompt).toContain('Write a haiku');
    expect(prompt).not.toContain('  Write a haiku  ');
  });

  it('omits scenario context section when not provided', () => {
    const prompt = buildLintUserPrompt(baseCheck);
    expect(prompt).not.toContain('## Scenario Context');
  });

  it('does not contain static instructions or anti-pattern definitions', () => {
    const prompt = buildLintUserPrompt(baseCheck);
    expect(prompt).not.toContain('eval check quality analyst');
    expect(prompt).not.toContain('## Domain Detection');
    expect(prompt).not.toContain('**vague**');
    expect(prompt).not.toContain('## Rules');
  });

  it('includes the session tool configuration section when tools are provided', () => {
    const prompt = buildLintUserPrompt(baseCheck, undefined, ['Read', 'TaskCreate']);
    expect(prompt).toContain('## Session Tool Configuration');
    expect(prompt).toContain('Read');
    expect(prompt).toContain('TaskCreate');
  });

  it('omits the session tool configuration section when tools are absent or empty', () => {
    expect(buildLintUserPrompt(baseCheck)).not.toContain('## Session Tool Configuration');
    expect(buildLintUserPrompt(baseCheck, 'ctx', [])).not.toContain(
      '## Session Tool Configuration',
    );
  });

  it('renders context and tools together', () => {
    const prompt = buildLintUserPrompt(baseCheck, 'Write a haiku', ['Read']);
    expect(prompt).toContain('## Scenario Context');
    expect(prompt).toContain('## Session Tool Configuration');
  });
});

describe('getLintRulesText', () => {
  it('contains all seven anti-pattern names', () => {
    const rules = getLintRulesText();
    expect(rules).toContain('vague');
    expect(rules).toContain('compound');
    expect(rules).toContain('tautological');
    expect(rules).toContain('always_passes');
    expect(rules).toContain('unverifiable');
    expect(rules).toContain('over_specific');
    expect(rules).toContain('unfalsifiable');
  });

  it('contains descriptions and examples for each anti-pattern', () => {
    const rules = getLintRulesText();
    // vague example
    expect(rules).toContain('high quality');
    // compound example
    expect(rules).toContain('split');
    // tautological description
    expect(rules).toContain('prompt');
    // always_passes description
    expect(rules).toContain('baseline');
    // unverifiable description
    expect(rules).toContain('internal state');
  });

  it('contains fix examples for each anti-pattern', () => {
    const rules = getLintRulesText();
    expect(rules).toContain('Fixed:');
    // vague fix
    expect(rules).toContain('markdown table');
    // compound fix — HTTP-oriented example
    expect(rules).toContain('next_cursor');
    // tautological fix
    expect(rules).toContain('5-7-5 syllable pattern');
    // always_passes fix — uses skill-added value, not baseline LLM behavior
    expect(rules).toContain('taught in the skill');
    // unverifiable fix
    expect(rules).toContain('performance bottleneck');
    // over_specific fix
    expect(rules).toContain('merged YAML document');
  });

  it('does not contain check-specific interpolation', () => {
    const rules = getLintRulesText();
    expect(rules).not.toContain('## Check to Analyze');
    expect(rules).not.toContain('**Check:**');
  });

  it('notes plugin-component tool calls as observable transcript signals', () => {
    const rules = getLintRulesText();
    // The "Writing Good Checks" section must mention that transcript tool-call
    // entries for plugin components count as observable output.
    expect(rules).toContain('Writing Good Checks');
    expect(rules).toContain('tool: Skill');
    expect(rules).toContain('tool: Agent');
    expect(rules).toContain('mcp__');
  });

  it('stays in sync with buildLintSystemPrompt anti-patterns', () => {
    const rules = getLintRulesText();
    const prompt = buildLintSystemPrompt();
    // Both should reference the same 7 anti-patterns
    for (const name of [
      'vague',
      'compound',
      'tautological',
      'always_passes',
      'unverifiable',
      'over_specific',
      'unfalsifiable',
    ]) {
      expect(rules).toContain(name);
      expect(prompt).toContain(name);
    }
  });
});

/**
 * Common Slips coverage.
 *
 * Source of truth: cc-plugins/.../claude-code-evals/references/check-design.md
 * § Common Slips. Five patterns that look like single checks but fail lint as
 * compound or vague. Each must surface in the lint prompt (system prompt + --help)
 * under the parent category it maps to:
 *   Likewise-joined intervals     -> compound
 *   Before/after-clause embedding -> compound
 *   Capitalized "AND" after a fix -> compound
 *   Abstract-noun stand-ins       -> vague
 *   Enumerated list as requirement -> over_specific
 */
describe('buildLintSystemPrompt — Common Slips coverage', () => {
  function sectionBetween(prompt: string, startMarker: string, endMarker: string): string {
    const s = prompt.indexOf(startMarker);
    if (s < 0) return '';
    const e = prompt.indexOf(endMarker, s);
    return prompt.slice(s, e > s ? e : undefined);
  }

  const prompt = buildLintSystemPrompt();
  const compoundSection = sectionBetween(prompt, '**compound**', '**tautological**');
  const vagueSection = sectionBetween(prompt, '**vague**', '**compound**');
  const overSpecificSection = sectionBetween(prompt, '**over_specific**', '## Rules');

  it('compound section primes Likewise-joined intervals (likewise)', () => {
    expect(compoundSection.toLowerCase()).toContain('likewise');
  });

  it('compound section primes Before/after-clause embedding', () => {
    expect(compoundSection.toLowerCase()).toContain('before');
    expect(compoundSection.toLowerCase()).toContain('after');
  });

  it('compound section primes Capitalized AND after a fix (re-author/rewrite)', () => {
    expect(compoundSection.toLowerCase()).toMatch(/\b(re-author|rewrite)\b/);
  });

  it('vague section names abstract-noun stand-ins by example', () => {
    const examples = ['investigation', 'presentation', 'review', 'consideration'];
    const matches = examples.filter((ex) => vagueSection.toLowerCase().includes(ex));
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('over_specific section names enumerated-list-as-requirement slip', () => {
    expect(overSpecificSection.toLowerCase()).toContain('enumerated');
  });
});

describe('getLintRulesText — Common Slips coverage mirrors system prompt', () => {
  const help = getLintRulesText().toLowerCase();

  it('--help mentions likewise under compound', () => {
    expect(help).toContain('likewise');
  });

  it('--help mentions abstract-noun examples under vague', () => {
    const examples = ['investigation', 'presentation', 'review', 'consideration'];
    const matches = examples.filter((ex) => help.includes(ex));
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('--help mentions enumerated-list-as-requirement under over_specific', () => {
    expect(help).toContain('enumerated');
  });
});
