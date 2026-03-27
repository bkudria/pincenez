import { describe, it, expect } from "vitest";
import { buildLintPrompt } from "../src/lint-prompt.js";
import type { Assertion } from "../src/config.js";

const baseAssertion: Assertion = {
  id: "test-1",
  check: "The output contains a greeting",
};

describe("buildLintPrompt", () => {
  it("includes the assertion check text", () => {
    const prompt = buildLintPrompt(baseAssertion);
    expect(prompt).toContain("The output contains a greeting");
  });

  it("includes all five anti-pattern definitions", () => {
    const prompt = buildLintPrompt(baseAssertion);
    expect(prompt).toContain("**vague**");
    expect(prompt).toContain("**compound**");
    expect(prompt).toContain("**tautological**");
    expect(prompt).toContain("**always_passes**");
    expect(prompt).toContain("**unverifiable**");
  });

  it("includes context section when provided", () => {
    const prompt = buildLintPrompt(baseAssertion, "  Write a haiku about nature  ");
    expect(prompt).toContain("## Scenario Context");
    expect(prompt).toContain("Write a haiku about nature");
  });

  it("trims context whitespace", () => {
    const prompt = buildLintPrompt(baseAssertion, "  padded  ");
    expect(prompt).toContain("padded");
    expect(prompt).not.toContain("  padded  ");
  });

  it("omits context section when not provided", () => {
    const prompt = buildLintPrompt(baseAssertion);
    expect(prompt).not.toContain("## Scenario Context");
  });

  it("includes note when assertion has one", () => {
    const assertion: Assertion = { ...baseAssertion, note: "check the header" };
    const prompt = buildLintPrompt(assertion);
    expect(prompt).toContain("**Note:** check the header");
  });

  it("omits note when assertion lacks one", () => {
    const prompt = buildLintPrompt(baseAssertion);
    expect(prompt).not.toContain("**Note:**");
  });
});
