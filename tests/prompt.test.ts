import { describe, it, expect } from 'vitest';
import { buildGraderSystemPrompt, buildGraderUserPrompt } from '../src/prompt.js';
import type { Check } from '../src/config.js';

const baseCheck: Check = {
  id: 'test-1',
  check: 'The output contains a greeting',
};

describe('buildGraderSystemPrompt', () => {
  it('contains the grader role intro', () => {
    expect(buildGraderSystemPrompt()).toContain('You are an eval grader');
  });

  it('includes the reasoning step instruction', () => {
    expect(buildGraderSystemPrompt()).toContain('Reason step-by-step');
  });

  it('includes the verdict return instruction', () => {
    expect(buildGraderSystemPrompt()).toContain('Return your verdict');
  });

  it('includes the grading rules section', () => {
    const sys = buildGraderSystemPrompt();
    expect(sys).toContain('## Grading Rules');
    expect(sys).toContain('NEGATIVE checks');
  });

  it('does not contain dynamic per-check content', () => {
    const sys = buildGraderSystemPrompt();
    expect(sys).not.toContain('${');
    expect(sys).not.toContain('## Check');
    expect(sys).not.toContain('## Context');
    expect(sys).not.toContain('**Check:**');
    expect(sys).not.toContain('/tmp/');
  });

  it('tells the grader that plugin-component tool calls in transcripts are observable', () => {
    const sys = buildGraderSystemPrompt();
    expect(sys).toContain('tool: Skill');
    expect(sys).toContain('tool: Agent');
    expect(sys).toContain('mcp__');
    const awarenessIndex = sys.indexOf('## Transcript Awareness');
    const skillIndex = sys.indexOf('tool: Skill');
    expect(awarenessIndex).toBeGreaterThan(-1);
    expect(skillIndex).toBeGreaterThan(awarenessIndex);
  });

  it("tells the grader to follow the transcript's own legend instead of a copy of it", () => {
    const sys = buildGraderSystemPrompt();
    const legendIndex = sys.indexOf('## Transcript Legend');
    expect(legendIndex).toBeGreaterThan(-1);
    expect(sys.slice(legendIndex)).toContain('legend:');
    expect(sys.slice(legendIndex)).toMatch(/authoritative/i);
    // No per-tool field list or hard-coded claims about what transcripts omit.
    expect(sys).not.toContain('old_string');
    expect(sys).not.toMatch(/exit_code|is_error|PreToolUse|outcome/);
    expect(sys).not.toMatch(/slash/i);
  });

  it('names every scuttlerun entry kind, hook and result included, and defers their meaning to the legend', () => {
    const sys = buildGraderSystemPrompt();
    const awareness = sys.slice(
      sys.indexOf('## Transcript Awareness'),
      sys.indexOf('## Transcript Legend'),
    );
    expect(awareness).toContain('`- hook:');
    expect(awareness).toContain('`- result:');
    expect(awareness).toMatch(/the legend names every kind/);
  });

  it('gives the grader a generic fallback when the output has no legend', () => {
    const sys = buildGraderSystemPrompt();
    const legendSection = sys.slice(sys.indexOf('## Transcript Legend'));
    expect(legendSection).toMatch(/without a legend/i);
    expect(legendSection).toMatch(/no assumption/i);
  });

  it('tells the grader to fail checks whose evidence the legend says is dropped or not recorded', () => {
    const legendSection = buildGraderSystemPrompt().slice(
      buildGraderSystemPrompt().indexOf('## Transcript Legend'),
    );
    expect(legendSection).toMatch(/dropped or not recorded/i);
    expect(legendSection).toMatch(/cannot be verified/i);
  });
});

describe('buildGraderUserPrompt', () => {
  it('includes the output file path', () => {
    const prompt = buildGraderUserPrompt(baseCheck, '/tmp/output.md');
    expect(prompt).toContain('/tmp/output.md');
  });

  it('includes the check text', () => {
    const prompt = buildGraderUserPrompt(baseCheck, '/tmp/output.md');
    expect(prompt).toContain('The output contains a greeting');
  });

  it('includes the note when present', () => {
    const check: Check = { ...baseCheck, note: 'check the header' };
    const prompt = buildGraderUserPrompt(check, '/tmp/output.md');
    expect(prompt).toContain('**Note:** check the header');
  });

  it('omits the note when absent', () => {
    const prompt = buildGraderUserPrompt(baseCheck, '/tmp/output.md');
    expect(prompt).not.toContain('**Note:**');
  });

  it('includes context section when provided', () => {
    const prompt = buildGraderUserPrompt(baseCheck, '/tmp/output.md', '  task ctx  ');
    expect(prompt).toContain('## Context');
    expect(prompt).toContain('task ctx');
    expect(prompt).not.toContain('  task ctx  ');
  });

  it('omits context section when not provided', () => {
    const prompt = buildGraderUserPrompt(baseCheck, '/tmp/output.md');
    expect(prompt).not.toContain('## Context');
  });

  it('does not contain static instructions or grading rules', () => {
    const prompt = buildGraderUserPrompt(baseCheck, '/tmp/output.md');
    expect(prompt).not.toContain('Reason step-by-step');
    expect(prompt).not.toContain('## Grading Rules');
    expect(prompt).not.toContain('You are an eval grader');
  });
});
