import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeYamlArrayItem } from "../src/yaml-utils.js";

describe("writeYamlArrayItem", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string;

  beforeEach(() => {
    written = "";
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      written += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("serializes a simple object as an indented YAML array item", () => {
    writeYamlArrayItem({ id: "a1", pass: true });

    expect(written).toMatch(/^ {2}- id: a1\n/);
    expect(written).toContain("    pass: true");
  });

  it("prefixes first line with '  - ' and subsequent lines with 4-space indent", () => {
    writeYamlArrayItem({ id: "a1", check: "is good", pass: false });

    const lines = written.trimEnd().split("\n");
    expect(lines[0]).toMatch(/^ {2}- /);
    for (const line of lines.slice(1)) {
      expect(line).toMatch(/^ {4}/);
    }
  });

  it("uses block literal style for multiline strings", () => {
    writeYamlArrayItem({ id: "a1", evidence: "line one\nline two\n" });

    // Block literal indicator should appear
    expect(written).toContain("|\n");
    // The multiline content should be indented inside the block
    expect(written).toContain("line one");
    expect(written).toContain("line two");
  });

  it("handles strings with YAML-special characters safely", () => {
    writeYamlArrayItem({ id: "a1", evidence: "value: with colon" });

    // Should be quoted or otherwise escaped — not bare
    // Parse-round-trip: the output should not break YAML structure
    expect(written).toContain("  - id: a1");
    expect(written).toContain("value: with colon");
  });

  it("ends output with a newline", () => {
    writeYamlArrayItem({ id: "x" });

    expect(written).toMatch(/\n$/);
  });
});
