import { describe, it, expect } from "vitest";
import { buildGraderPrompt } from "../src/prompt.js";
import type { Assertion } from "../src/config.js";

const baseAssertion: Assertion = {
  id: "test-1",
  check: "The output contains a greeting",
};

describe("buildGraderPrompt", () => {
  it("includes the output path", () => {
    const prompt = buildGraderPrompt(baseAssertion, "/tmp/output.md");
    expect(prompt).toContain("/tmp/output.md");
  });

  it("includes the assertion check text", () => {
    const prompt = buildGraderPrompt(baseAssertion, "/tmp/output.md");
    expect(prompt).toContain("The output contains a greeting");
  });

  it("includes context section when provided", () => {
    const prompt = buildGraderPrompt(baseAssertion, "/tmp/output.md", "  task context here  ");
    expect(prompt).toContain("## Context");
    expect(prompt).toContain("task context here");
  });

  it("trims context whitespace", () => {
    const prompt = buildGraderPrompt(baseAssertion, "/tmp/output.md", "  padded  ");
    expect(prompt).toContain("padded");
    expect(prompt).not.toContain("  padded  ");
  });

  it("omits context section when not provided", () => {
    const prompt = buildGraderPrompt(baseAssertion, "/tmp/output.md");
    expect(prompt).not.toContain("## Context");
  });

  it("includes note when assertion has one", () => {
    const assertion: Assertion = { ...baseAssertion, note: "check the header" };
    const prompt = buildGraderPrompt(assertion, "/tmp/output.md");
    expect(prompt).toContain("**Note:** check the header");
  });

  it("omits note when assertion lacks one", () => {
    const prompt = buildGraderPrompt(baseAssertion, "/tmp/output.md");
    expect(prompt).not.toContain("**Note:**");
  });

  it("includes JSON output format block", () => {
    const prompt = buildGraderPrompt(baseAssertion, "/tmp/output.md");
    expect(prompt).toContain("```json");
    expect(prompt).toContain('"pass"');
    expect(prompt).toContain('"evidence"');
  });

  it("includes grading rules section", () => {
    const prompt = buildGraderPrompt(baseAssertion, "/tmp/output.md");
    expect(prompt).toContain("## Grading Rules");
    expect(prompt).toContain("NEGATIVE assertions");
  });
});
