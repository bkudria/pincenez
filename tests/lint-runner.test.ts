import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChecksFile } from "../src/config.js";

// Mock the linter module
vi.mock("../src/linter.js", () => ({
  lintCheck: vi.fn(),
}));

import { lintCheck } from "../src/linter.js";
import { runLint } from "../src/lint-runner.js";

const mockLintCheck = vi.mocked(lintCheck);

const checksFile: ChecksFile = {
  checks: [
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

  it("runs all checks and returns results", async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues: check.id === "a1"
        ? [{ anti_pattern: "vague", suggestion: "Name the metric" }]
        : check.id === "a3"
          ? [{ anti_pattern: "compound", suggestion: "Split into two" }]
          : [],
    }));

    const { results, checksWithIssues } = await runLint(checksFile);

    expect(results).toHaveLength(3);
    expect(checksWithIssues).toBe(2);
  });

  it("writes checks header to stdout", async () => {
    mockLintCheck.mockResolvedValue({
      id: "a1",
      check: "test",
      issues: [],
    });

    await runLint({ checks: [{ id: "a1", check: "test" }] });

    expect(stdoutChunks[0]).toBe("checks:\n");
  });

  it("writes summary stats to stdout", async () => {
    mockLintCheck.mockImplementation(async (check) => ({
      id: check.id,
      check: check.check,
      issues: check.id === "a1"
        ? [{ anti_pattern: "vague", suggestion: "fix" }]
        : [],
    }));

    await runLint(checksFile);

    const output = stdoutChunks.join("");
    expect(output).toContain("checks_total: 3");
    expect(output).toContain("checks_with_issues: 1");
  });

  it("passes context from checks file to linter", async () => {
    mockLintCheck.mockResolvedValue({
      id: "a1",
      check: "test",
      issues: [],
    });

    const checksFileWithContext: ChecksFile = {
      context: "Write a haiku",
      checks: [{ id: "a1", check: "test" }],
    };

    await runLint(checksFileWithContext);

    expect(mockLintCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ context: "Write a haiku" }),
    );
  });

  it("passes model option to linter", async () => {
    mockLintCheck.mockResolvedValue({
      id: "a1",
      check: "test",
      issues: [],
    });

    await runLint(
      { checks: [{ id: "a1", check: "test" }] },
      { model: "claude-sonnet-4-6" },
    );

    expect(mockLintCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: "claude-sonnet-4-6" }),
    );
  });
});
