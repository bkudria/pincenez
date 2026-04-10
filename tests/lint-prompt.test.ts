import { describe, it, expect } from "vitest";
import { buildLintPrompt, getLintRulesText } from "../src/lint-prompt.js";
import type { Check } from "../src/config.js";

const baseCheck: Check = {
  id: "test-1",
  check: "The output contains a greeting",
};

describe("buildLintPrompt", () => {
  it("includes the check text", () => {
    const prompt = buildLintPrompt(baseCheck);
    expect(prompt).toContain("The output contains a greeting");
  });

  it("includes all five anti-pattern definitions", () => {
    const prompt = buildLintPrompt(baseCheck);
    expect(prompt).toContain("**vague**");
    expect(prompt).toContain("**compound**");
    expect(prompt).toContain("**tautological**");
    expect(prompt).toContain("**always_passes**");
    expect(prompt).toContain("**unverifiable**");
  });

  it("includes fix examples in the LLM prompt", () => {
    const prompt = buildLintPrompt(baseCheck);
    expect(prompt).toContain("Fixed:");
    expect(prompt).toContain("markdown table");
  });

  it("includes context section when provided", () => {
    const prompt = buildLintPrompt(baseCheck, "  Write a haiku about nature  ");
    expect(prompt).toContain("## Scenario Context");
    expect(prompt).toContain("Write a haiku about nature");
  });

  it("trims context whitespace", () => {
    const prompt = buildLintPrompt(baseCheck, "  padded  ");
    expect(prompt).toContain("padded");
    expect(prompt).not.toContain("  padded  ");
  });

  it("omits context section when not provided", () => {
    const prompt = buildLintPrompt(baseCheck);
    expect(prompt).not.toContain("## Scenario Context");
  });

  it("includes note when check has one", () => {
    const check: Check = { ...baseCheck, note: "check the header" };
    const prompt = buildLintPrompt(check);
    expect(prompt).toContain("**Note:** check the header");
  });

  it("omits note when check lacks one", () => {
    const prompt = buildLintPrompt(baseCheck);
    expect(prompt).not.toContain("**Note:**");
  });

  it("includes domain detection section", () => {
    const prompt = buildLintPrompt(baseCheck);
    expect(prompt).toContain("## Domain Detection");
    expect(prompt).toContain("**technical**");
    expect(prompt).toContain("**creative**");
    expect(prompt).toContain("**mixed**");
  });

  it("includes self-consistency rule", () => {
    const prompt = buildLintPrompt(baseCheck);
    expect(prompt).toContain("suggestions must not introduce other anti-patterns");
  });
});

describe("getLintRulesText", () => {
  it("contains all five anti-pattern names", () => {
    const rules = getLintRulesText();
    expect(rules).toContain("vague");
    expect(rules).toContain("compound");
    expect(rules).toContain("tautological");
    expect(rules).toContain("always_passes");
    expect(rules).toContain("unverifiable");
  });

  it("contains descriptions and examples for each anti-pattern", () => {
    const rules = getLintRulesText();
    // vague example
    expect(rules).toContain("high quality");
    // compound example
    expect(rules).toContain("split");
    // tautological description
    expect(rules).toContain("prompt");
    // always_passes description
    expect(rules).toContain("baseline");
    // unverifiable description
    expect(rules).toContain("internal state");
  });

  it("contains fix examples for each anti-pattern", () => {
    const rules = getLintRulesText();
    expect(rules).toContain("Fixed:");
    // vague fix
    expect(rules).toContain("markdown table");
    // compound fix
    expect(rules).toContain("parameterized queries for SQL");
    // tautological fix
    expect(rules).toContain("5-7-5 syllable pattern");
    // always_passes fix
    expect(rules).toContain("string concatenation");
    // unverifiable fix
    expect(rules).toContain("performance bottleneck");
  });

  it("does not contain check-specific interpolation", () => {
    const rules = getLintRulesText();
    expect(rules).not.toContain("## Check to Analyze");
    expect(rules).not.toContain("**Check:**");
  });

  it("stays in sync with buildLintPrompt anti-patterns", () => {
    const rules = getLintRulesText();
    const prompt = buildLintPrompt(baseCheck);
    // Both should reference the same 5 anti-patterns
    for (const name of ["vague", "compound", "tautological", "always_passes", "unverifiable"]) {
      expect(rules).toContain(name);
      expect(prompt).toContain(name);
    }
  });
});
