import { describe, it, expect } from 'vitest';
import { HELP_TEXT } from '../src/help-text.js';

describe('HELP_TEXT — verdict non-determinism disclosure', () => {
  const help = HELP_TEXT.toLowerCase();

  it('discloses that verdicts are non-deterministic', () => {
    expect(help).toContain('non-deterministic');
  });

  it('explains that re-running identical inputs may change verdicts', () => {
    expect(help).toMatch(/re-run|rerun/);
    expect(help).toMatch(/vary|differ|flip/);
  });

  it('states that no seed or temperature control is available', () => {
    expect(help).toContain('seed');
    expect(help).toContain('temperature');
  });
});
