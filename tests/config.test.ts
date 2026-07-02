import { describe, it, expect } from 'vitest';
import { parseChecksFile, loadChecksFile } from '../src/config.js';
import { resolve } from 'node:path';

describe('parseChecksFile', () => {
  it('parses a valid checks file with all fields', () => {
    const yaml = `
context: "some context"
checks:
  - my-check:
      check: "the thing happened"
      note: "look carefully"
      model: claude-sonnet-5
`;
    const checksFile = parseChecksFile(yaml);
    expect(checksFile.context).toBe('some context');
    expect(checksFile.checks).toHaveLength(1);
    expect(checksFile.checks[0]).toEqual({
      id: 'my-check',
      check: 'the thing happened',
      note: 'look carefully',
      model: 'claude-sonnet-5',
    });
  });

  it('parses multiple checks', () => {
    const yaml = `
checks:
  - first-check:
      check: "first"
  - second-check:
      check: "second"
`;
    const checksFile = parseChecksFile(yaml);
    expect(checksFile.checks[0].id).toBe('first-check');
    expect(checksFile.checks[0].check).toBe('first');
    expect(checksFile.checks[1].id).toBe('second-check');
    expect(checksFile.checks[1].check).toBe('second');
  });

  it('returns undefined context when absent', () => {
    const yaml = `
checks:
  - my-check:
      check: "first"
`;
    const checksFile = parseChecksFile(yaml);
    expect(checksFile.context).toBeUndefined();
  });

  it('throws on empty checks array', () => {
    const yaml = `
checks: []
`;
    expect(() => parseChecksFile(yaml)).toThrow();
  });

  it('throws on missing check field', () => {
    const yaml = `
checks:
  - no-check:
      note: "oops"
`;
    expect(() => parseChecksFile(yaml)).toThrow();
  });

  it('throws on non-object YAML', () => {
    expect(() => parseChecksFile('just a string')).toThrow();
  });

  it('throws on invalid YAML syntax', () => {
    expect(() => parseChecksFile('checks:\n  - bad: [unterminated')).toThrow();
  });

  it('throws when check entry has multiple keys', () => {
    const yaml = `
checks:
  - first-key:
      check: "something"
    second-key:
      check: "other"
`;
    expect(() => parseChecksFile(yaml)).toThrow();
  });

  it('throws when check entry has no keys', () => {
    const yaml = `
checks:
  - check: "bare check without id-as-key"
`;
    expect(() => parseChecksFile(yaml)).toThrow();
  });
});

describe('loadChecksFile', () => {
  it('loads and parses the example checks file', async () => {
    const checksFile = await loadChecksFile(resolve('examples/haiku/checks.yaml'));
    expect(checksFile.context).toContain('haiku');
    expect(checksFile.checks.length).toBeGreaterThanOrEqual(1);
    expect(checksFile.checks[0].id).toBe('asked-topic');
    expect(checksFile.checks[0].check).toBeTruthy();
  });
});
