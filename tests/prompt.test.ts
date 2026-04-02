import { describe, it, expect } from "vitest";
import { buildGraderPrompt } from "../src/prompt.js";
import type { Check } from "../src/config.js";

const baseCheck: Check = {
  id: "test-1",
  check: "The output contains a greeting",
};

describe("buildGraderPrompt", () => {
  it("includes the output path", () => {
    const prompt = buildGraderPrompt(baseCheck, "/tmp/output.md");
    expect(prompt).toContain("/tmp/output.md");
  });

  it("includes the check text", () => {
    const prompt = buildGraderPrompt(baseCheck, "/tmp/output.md");
    expect(prompt).toContain("The output contains a greeting");
  });

  it("includes context section when provided", () => {
    const prompt = buildGraderPrompt(baseCheck, "/tmp/output.md", "  task context here  ");
    expect(prompt).toContain("## Context");
    expect(prompt).toContain("task context here");
  });

  it("trims context whitespace", () => {
    const prompt = buildGraderPrompt(baseCheck, "/tmp/output.md", "  padded  ");
    expect(prompt).toContain("padded");
    expect(prompt).not.toContain("  padded  ");
  });

  it("omits context section when not provided", () => {
    const prompt = buildGraderPrompt(baseCheck, "/tmp/output.md");
    expect(prompt).not.toContain("## Context");
  });

  it("includes note when check has one", () => {
    const check: Check = { ...baseCheck, note: "check the header" };
    const prompt = buildGraderPrompt(check, "/tmp/output.md");
    expect(prompt).toContain("**Note:** check the header");
  });

  it("omits note when check lacks one", () => {
    const prompt = buildGraderPrompt(baseCheck, "/tmp/output.md");
    expect(prompt).not.toContain("**Note:**");
  });

  it("does not include JSON output format block (structured output handles this)", () => {
    const prompt = buildGraderPrompt(baseCheck, "/tmp/output.md");
    expect(prompt).not.toContain("```json");
    expect(prompt).not.toContain("## Output Format");
  });

  it("includes grading rules section", () => {
    const prompt = buildGraderPrompt(baseCheck, "/tmp/output.md");
    expect(prompt).toContain("## Grading Rules");
    expect(prompt).toContain("NEGATIVE checks");
  });
});
