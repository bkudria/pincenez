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
