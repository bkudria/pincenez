import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Rubric } from "../src/config.js";
import type { AssertionResult } from "../src/grader.js";

// Mock gradeAssertion
vi.mock("../src/grader.js", () => ({
  gradeAssertion: vi.fn(),
}));

import { gradeAssertion } from "../src/grader.js";
import { run } from "../src/runner.js";

const mockGrade = vi.mocked(gradeAssertion);

function makeRubric(overrides: Partial<Rubric> = {}): Rubric {
  return {
    assertions: [
      { id: "a1", check: "first check" },
      { id: "a2", check: "second check" },
    ],
    ...overrides,
  };
}

function makeResult(id: string, pass: boolean | null, evidence = "evidence"): AssertionResult {
  return { id, check: `check for ${id}`, pass, evidence };
}

describe("run", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string;

  beforeEach(() => {
    vi.clearAllMocks();
    written = "";
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
      written += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("writes assertions header first", async () => {
    mockGrade.mockResolvedValue(makeResult("a1", true));

    await run(
      { assertions: [{ id: "a1", check: "c" }] },
      "/tmp/out.md",
    );

    expect(written).toMatch(/^assertions:\n/);
  });

  it("writes each result as a YAML array item", async () => {
    mockGrade.mockImplementation(async (assertion) =>
      makeResult(assertion.id, true, "found it"),
    );

    await run(makeRubric(), "/tmp/out.md");

    expect(written).toContain("  - id: a1");
    expect(written).toContain("  - id: a2");
  });

  it("writes pass_rate line after all results", async () => {
    mockGrade.mockResolvedValue(makeResult("a1", true));

    await run(
      { assertions: [{ id: "a1", check: "c" }] },
      "/tmp/out.md",
    );

    const lines = written.trimEnd().split("\n");
    expect(lines[lines.length - 1]).toMatch(/^pass_rate: /);
  });

  it("computes pass_rate = 1 when all pass", async () => {
    mockGrade.mockImplementation(async (assertion) =>
      makeResult(assertion.id, true),
    );

    const { passRate } = await run(makeRubric(), "/tmp/out.md");
    expect(passRate).toBe(1);
    expect(written).toContain("pass_rate: 1");
  });

  it("computes pass_rate = 0 when all fail", async () => {
    mockGrade.mockImplementation(async (assertion) =>
      makeResult(assertion.id, false),
    );

    const { passRate } = await run(makeRubric(), "/tmp/out.md");
    expect(passRate).toBe(0);
    expect(written).toContain("pass_rate: 0");
  });

  it("computes correct pass_rate for mixed results", async () => {
    mockGrade
      .mockResolvedValueOnce(makeResult("a1", true))
      .mockResolvedValueOnce(makeResult("a2", false));

    const { passRate } = await run(makeRubric(), "/tmp/out.md");
    expect(passRate).toBe(0.5);
  });

  it("counts null pass results as failures", async () => {
    mockGrade
      .mockResolvedValueOnce(makeResult("a1", true))
      .mockResolvedValueOnce(makeResult("a2", null));

    const { passRate } = await run(makeRubric(), "/tmp/out.md");
    expect(passRate).toBe(0.5);
  });

  it("prefers options.context over rubric.context", async () => {
    mockGrade.mockResolvedValue(makeResult("a1", true));

    await run(
      { assertions: [{ id: "a1", check: "c" }], context: "rubric ctx" },
      "/tmp/out.md",
      { context: "options ctx" },
    );

    expect(mockGrade).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/out.md",
      expect.objectContaining({ context: "options ctx" }),
    );
  });

  it("falls back to rubric.context when options.context is absent", async () => {
    mockGrade.mockResolvedValue(makeResult("a1", true));

    await run(
      { assertions: [{ id: "a1", check: "c" }], context: "rubric ctx" },
      "/tmp/out.md",
    );

    expect(mockGrade).toHaveBeenCalledWith(
      expect.anything(),
      "/tmp/out.md",
      expect.objectContaining({ context: "rubric ctx" }),
    );
  });

  it("returns results and passRate", async () => {
    mockGrade.mockImplementation(async (assertion) =>
      makeResult(assertion.id, true),
    );

    const { results, passRate } = await run(makeRubric(), "/tmp/out.md");
    expect(results).toHaveLength(2);
    expect(passRate).toBe(1);
  });
});
