import { describe, it, expect } from "vitest";
import { buildLintPrompt } from "../src/lint-prompt.js";
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
