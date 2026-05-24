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

  it('includes all six anti-pattern definitions', () => {
    const sys = buildLintSystemPrompt();
    expect(sys).toContain('**vague**');
    expect(sys).toContain('**compound**');
    expect(sys).toContain('**tautological**');
    expect(sys).toContain('**always_passes**');
    expect(sys).toContain('**unverifiable**');
    expect(sys).toContain('**over_specific**');
  });

  it('includes the Rules section with self-consistency and over_specific guard', () => {
    const sys = buildLintSystemPrompt();
    expect(sys).toContain('## Rules');
    expect(sys).toContain('suggestions must not introduce other anti-patterns');
    expect(sys).toContain('legitimately specific');
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
});

describe('getLintRulesText', () => {
  it('contains all six anti-pattern names', () => {
    const rules = getLintRulesText();
    expect(rules).toContain('vague');
    expect(rules).toContain('compound');
    expect(rules).toContain('tautological');
    expect(rules).toContain('always_passes');
    expect(rules).toContain('unverifiable');
    expect(rules).toContain('over_specific');
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
    // Both should reference the same 6 anti-patterns
    for (const name of [
      'vague',
      'compound',
      'tautological',
      'always_passes',
      'unverifiable',
      'over_specific',
    ]) {
      expect(rules).toContain(name);
      expect(prompt).toContain(name);
    }
  });
});
