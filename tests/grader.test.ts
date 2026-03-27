import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseVerdict, gradeAssertion } from "../src/grader.js";
import type { Assertion } from "../src/config.js";
import type { Query, SDKMessage, SDKResultSuccess } from "@anthropic-ai/claude-agent-sdk";

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

describe("parseVerdict", () => {
  it("parses valid JSON with pass and evidence", () => {
    expect(parseVerdict('{"pass": true, "evidence": "found the thing"}')).toEqual({
      pass: true,
      evidence: "found the thing",
    });
  });

  it("parses false verdicts", () => {
    expect(parseVerdict('{"pass": false, "evidence": "not found"}')).toEqual({
      pass: false,
      evidence: "not found",
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseVerdict("not json at all")).toBeNull();
  });

  it("returns null when pass is not boolean", () => {
    expect(parseVerdict('{"pass": "yes", "evidence": "found it"}')).toBeNull();
  });

  it("returns null when evidence is not string", () => {
    expect(parseVerdict('{"pass": true, "evidence": 42}')).toBeNull();
  });

  it("handles evidence with special characters", () => {
    const json = JSON.stringify({ pass: true, evidence: 'The agent said "hello" and used a backslash \\' });
    expect(parseVerdict(json)).toEqual({
      pass: true,
      evidence: 'The agent said "hello" and used a backslash \\',
    });
  });
});

function resultMessage(result: string): SDKResultSuccess {
  return {
    type: "result",
    subtype: "success",
    result,
    duration_ms: 0,
    duration_api_ms: 0,
    is_error: false,
    num_turns: 1,
    stop_reason: "end_turn",
    total_cost_usd: 0,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
    modelUsage: {},
    permission_denials: [],
    uuid: "test-uuid" as SDKResultSuccess["uuid"],
    session_id: "test-session",
  };
}

function asyncMessages(msgs: SDKMessage[]): Query {
  return {
    async *[Symbol.asyncIterator]() {
      for (const m of msgs) yield m;
    },
  } as unknown as Query;
}

describe("gradeAssertion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns AssertionResult with pass/evidence on success", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage('{"pass": true, "evidence": "looks good"}'),
      ]),
    );

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result).toEqual({
      id: "test-1",
      check: "The output is correct",
      pass: true,
      evidence: "looks good",
    });
  });

  it("passes outputFormat with json_schema to query", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage('{"pass": true, "evidence": "ok"}'),
      ]),
    );

    await gradeAssertion(assertion, "/tmp/out.md");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          outputFormat: {
            type: "json_schema",
            schema: expect.objectContaining({
              type: "object",
              properties: {
                pass: { type: "boolean" },
                evidence: { type: "string" },
              },
              required: ["pass", "evidence"],
            }),
          },
        }),
      }),
    );
  });

  it("uses assertion.model over options.model and default", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage('{"pass": true, "evidence": "ok"}'),
      ]),
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
        resultMessage('{"pass": true, "evidence": "ok"}'),
      ]),
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
        resultMessage('{"pass": true, "evidence": "ok"}'),
      ]),
    );

    await gradeAssertion(assertion, "/tmp/out.md");

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ model: "claude-haiku-4-5" }),
      }),
    );
  });

  it("returns null pass when structured output parsing fails", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage("not valid json"),
      ]),
    );

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.pass).toBeNull();
    expect(result.evidence).toContain("could not parse structured output");
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
        resultMessage('{"pass": true, "evidence": "ok"}'),
      ]),
    );

    await gradeAssertion(assertion, "/tmp/out.md");
    expect(process.env.CLAUDECODE).toBeUndefined();
  });
});
