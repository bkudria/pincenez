import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Rubric } from "../src/config.js";

// Mock the linter module
vi.mock("../src/linter.js", () => ({
  lintAssertion: vi.fn(),
}));

import { lintAssertion } from "../src/linter.js";
import { runLint } from "../src/lint-runner.js";

const mockLintAssertion = vi.mocked(lintAssertion);

const rubric: Rubric = {
  assertions: [
    { id: "a1", check: "Output is high quality" },
    { id: "a2", check: "Code uses parameterized queries" },
    { id: "a3", check: "Code works AND handles errors" },
  ],
};

describe("runLint", () => {
  let stdoutChunks: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutChunks = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      stdoutChunks.push(chunk.toString());
      return true;
    });
  });

  it("runs all assertions and returns results", async () => {
    mockLintAssertion.mockImplementation(async (assertion) => ({
      id: assertion.id,
      check: assertion.check,
      issues: assertion.id === "a1"
        ? [{ anti_pattern: "vague", suggestion: "Name the metric" }]
        : assertion.id === "a3"
          ? [{ anti_pattern: "compound", suggestion: "Split into two" }]
          : [],
    }));

    const { results, assertionsWithIssues } = await runLint(rubric);

    expect(results).toHaveLength(3);
    expect(assertionsWithIssues).toBe(2);
  });

  it("writes assertions header to stdout", async () => {
    mockLintAssertion.mockResolvedValue({
      id: "a1",
      check: "test",
      issues: [],
    });

    await runLint({ assertions: [{ id: "a1", check: "test" }] });

    expect(stdoutChunks[0]).toBe("assertions:\n");
  });

  it("writes summary stats to stdout", async () => {
    mockLintAssertion.mockImplementation(async (assertion) => ({
      id: assertion.id,
      check: assertion.check,
      issues: assertion.id === "a1"
        ? [{ anti_pattern: "vague", suggestion: "fix" }]
        : [],
    }));

    await runLint(rubric);

    const output = stdoutChunks.join("");
    expect(output).toContain("assertions_total: 3");
    expect(output).toContain("assertions_with_issues: 1");
  });

  it("passes context from rubric to linter", async () => {
    mockLintAssertion.mockResolvedValue({
      id: "a1",
      check: "test",
      issues: [],
    });

    const rubricWithContext: Rubric = {
      context: "Write a haiku",
      assertions: [{ id: "a1", check: "test" }],
    };

    await runLint(rubricWithContext);

    expect(mockLintAssertion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ context: "Write a haiku" }),
    );
  });

  it("passes model option to linter", async () => {
    mockLintAssertion.mockResolvedValue({
      id: "a1",
      check: "test",
      issues: [],
    });

    await runLint(
      { assertions: [{ id: "a1", check: "test" }] },
      { model: "claude-sonnet-4-6" },
    );

    expect(mockLintAssertion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: "claude-sonnet-4-6" }),
    );
  });
});
