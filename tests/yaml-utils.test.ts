import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { writeYamlArrayItem } from '../src/yaml-utils.js';

describe('writeYamlArrayItem', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string;

  beforeEach(() => {
    written = '';
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written += typeof chunk === 'string' ? chunk : chunk.toString();
        return true;
      });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('serializes a simple object as an indented YAML array item', () => {
    writeYamlArrayItem({ id: 'a1', pass: true });

    expect(written).toMatch(/^ {2}- id: a1\n/);
    expect(written).toContain('    pass: true');
  });

  it("prefixes first line with '  - ' and subsequent lines with 4-space indent", () => {
    writeYamlArrayItem({ id: 'a1', check: 'is good', pass: false });

    const lines = written.trimEnd().split('\n');
    expect(lines[0]).toMatch(/^ {2}- /);
    for (const line of lines.slice(1)) {
      expect(line).toMatch(/^ {4}/);
    }
  });

  it('uses block literal style for multiline strings', () => {
    writeYamlArrayItem({ id: 'a1', evidence: 'line one\nline two\n' });

    // Block literal indicator should appear
    expect(written).toContain('|\n');
    // The multiline content should be indented inside the block
    expect(written).toContain('line one');
    expect(written).toContain('line two');
  });

  it('handles strings with YAML-special characters safely', () => {
    writeYamlArrayItem({ id: 'a1', evidence: 'value: with colon' });

    // Should be quoted or otherwise escaped — not bare
    // Parse-round-trip: the output should not break YAML structure
    expect(written).toContain('  - id: a1');
    expect(written).toContain('value: with colon');
  });

  it('ends output with a newline', () => {
    writeYamlArrayItem({ id: 'x' });

    expect(written).toMatch(/\n$/);
  });

  describe('line wrapping', () => {
    it('renders long single-line strings as block-folded (`>`)', () => {
      const text = 'a long single-line string '.repeat(8).trim();
      writeYamlArrayItem({ evidence: text });
      expect(written).toMatch(/evidence: >-?\n/);
      const parsed = parseYaml('checks:\n' + written);
      expect(parsed.checks[0].evidence).toBe(text);
    });

    it('keeps short single-line strings as plain scalars', () => {
      writeYamlArrayItem({ evidence: 'short' });
      expect(written).not.toMatch(/evidence: >-?\n/);
      expect(written).toContain('evidence: short');
    });

    it('wraps final output to fit 80 cols (block-folded single-line strings)', () => {
      const text = 'x '.repeat(80).trim();
      writeYamlArrayItem({ evidence: text });
      const longest = Math.max(...written.split('\n').map((l) => l.length));
      expect(longest).toBeLessThanOrEqual(80);
    });

    it('hard-wraps long lines inside multi-line strings before block-literal serialization', () => {
      const longInternal =
        'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega extra padding words here';
      writeYamlArrayItem({ evidence: `First line\n${longInternal}\nLast line` });
      const longest = Math.max(...written.split('\n').map((l) => l.length));
      expect(longest).toBeLessThanOrEqual(80);
      const parsed = parseYaml('checks:\n' + written);
      expect(parsed.checks[0].evidence).toContain('First line');
      expect(parsed.checks[0].evidence).toContain('Last line');
      for (const line of parsed.checks[0].evidence.split('\n')) {
        expect(line.length).toBeLessThanOrEqual(72);
      }
    });

    it('leaves unbreakable strings (no whitespace) unwrapped', () => {
      const blob = 'a'.repeat(200);
      writeYamlArrayItem({ evidence: blob });
      const parsed = parseYaml('checks:\n' + written);
      expect(parsed.checks[0].evidence).toBe(blob);
    });
  });
});
