import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractVerdict, gradeAssertion } from "../src/grader.js";
import type { Assertion } from "../src/config.js";

// Mock the Agent SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

import { query } from "@anthropic-ai/claude-agent-sdk";
const mockQuery = vi.mocked(query);

const assertion: Assertion = {
  id: "test-1",
  check: "The output is correct",
};

describe("extractVerdict", () => {
  it("extracts from a ```json code block", () => {
    const text = `Some analysis here.
\`\`\`json
{"pass": true, "evidence": "found the thing"}
\`\`\``;
    expect(extractVerdict(text)).toEqual({
      pass: true,
      evidence: "found the thing",
    });
  });

  it("extracts from loose JSON in text", () => {
    const text = `The result is {"pass": false, "evidence": "not found"} as shown.`;
    expect(extractVerdict(text)).toEqual({
      pass: false,
      evidence: "not found",
    });
  });

  it("returns null when no JSON found", () => {
    expect(extractVerdict("just some text with no json")).toBeNull();
  });

  it("returns null for invalid JSON inside code block", () => {
    const text = `\`\`\`json
{not valid json}
\`\`\``;
    expect(extractVerdict(text)).toBeNull();
  });

  it("returns null when pass is not boolean", () => {
    const text = `\`\`\`json
{"pass": "yes", "evidence": "found it"}
\`\`\``;
    expect(extractVerdict(text)).toBeNull();
  });

  it("returns null when evidence is not string", () => {
    const text = `\`\`\`json
{"pass": true, "evidence": 42}
\`\`\``;
    expect(extractVerdict(text)).toBeNull();
  });

  it("handles extra whitespace in code block", () => {
    const text = `\`\`\`json

  {"pass": true, "evidence": "ok"}

\`\`\``;
    expect(extractVerdict(text)).toEqual({
      pass: true,
      evidence: "ok",
    });
  });

  it("prefers code block over loose JSON", () => {
    const text = `{"pass": false, "evidence": "loose"}
\`\`\`json
{"pass": true, "evidence": "block"}
\`\`\``;
    expect(extractVerdict(text)).toEqual({
      pass: true,
      evidence: "block",
    });
  });
});

// Helper: create an async iterable from an array of messages
function asyncMessages(msgs: unknown[]): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const m of msgs) yield m;
    },
  };
}

describe("gradeAssertion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns AssertionResult with pass/evidence on success", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        { type: "result", result: '```json\n{"pass": true, "evidence": "looks good"}\n```' },
      ]) as any,
    );

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result).toEqual({
      id: "test-1",
      check: "The output is correct",
      pass: true,
      evidence: "looks good",
    });
  });

  it("uses assertion.model over options.model and default", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        { type: "result", result: '```json\n{"pass": true, "evidence": "ok"}\n```' },
      ]) as any,
    );

    await gradeAssertion(
      { ...assertion, model: "custom-model" },
      "/tmp/out.md",
      { model: "options-model" },
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ model: "custom-model" }),
      }),
    );
  });

  it("uses options.model when assertion has no model", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        { type: "result", result: '```json\n{"pass": true, "evidence": "ok"}\n```' },
      ]) as any,
    );

    await gradeAssertion(assertion, "/tmp/out.md", { model: "options-model" });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ model: "options-model" }),
      }),
    );
  });

  it("falls back to default model", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        { type: "result", result: '```json\n{"pass": true, "evidence": "ok"}\n```' },
      ]) as any,
    );

    await gradeAssertion(assertion, "/tmp/out.md");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ model: "claude-haiku-4-5" }),
      }),
    );
  });

  it("returns null pass when verdict extraction fails", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        { type: "result", result: "no json here at all" },
      ]) as any,
    );

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.pass).toBeNull();
    expect(result.evidence).toContain("could not extract verdict");
  });

  it("returns null pass with error when SDK throws", async () => {
    mockQuery.mockImplementation(() => {
      throw new Error("SDK connection failed");
    });

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.pass).toBeNull();
    expect(result.evidence).toContain("SDK connection failed");
  });

  it("deletes CLAUDECODE env var", async () => {
    process.env.CLAUDECODE = "something";

    mockQuery.mockReturnValue(
      asyncMessages([
        { type: "result", result: '```json\n{"pass": true, "evidence": "ok"}\n```' },
      ]) as any,
    );

    await gradeAssertion(assertion, "/tmp/out.md");
    expect(process.env.CLAUDECODE).toBeUndefined();
  });
});
