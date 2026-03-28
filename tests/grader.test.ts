import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseVerdict, gradeAssertion } from "../src/grader.js";
import type { Assertion } from "../src/config.js";
import type { Query, SDKMessage, SDKResultSuccess, SDKResultError } from "@anthropic-ai/claude-agent-sdk";

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

function errorMessage(subtype: string, errors: string[]): SDKResultError {
  return {
    type: "result",
    subtype,
    is_error: true,
    errors,
    duration_ms: 0,
    duration_api_ms: 0,
    num_turns: 1,
    stop_reason: null,
    total_cost_usd: 0.003,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
    modelUsage: {},
    permission_denials: [],
    uuid: "test-uuid" as SDKResultError["uuid"],
    session_id: "test-session",
  } as SDKResultError;
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
      cost_usd: 0,
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

  it("captures total_cost_usd from result message", async () => {
    const msg = resultMessage('{"pass": true, "evidence": "ok"}');
    msg.total_cost_usd = 0.0042;
    mockQuery.mockReturnValue(asyncMessages([msg]));

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.cost_usd).toBe(0.0042);
  });

  it("surfaces SDK error details for error_max_structured_output_retries", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        errorMessage("error_max_structured_output_retries", ["failed after 3 retries"]),
      ]),
    );

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.pass).toBeNull();
    expect(result.evidence).toContain("error_max_structured_output_retries");
    expect(result.evidence).toContain("failed after 3 retries");
  });

  it("surfaces SDK error details for error_during_execution", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        errorMessage("error_during_execution", ["tool execution failed: permission denied"]),
      ]),
    );

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.pass).toBeNull();
    expect(result.evidence).toContain("error_during_execution");
    expect(result.evidence).toContain("permission denied");
  });

  it("extracts verdict from structured_output when result is empty", async () => {
    const msg = resultMessage("");
    (msg as Record<string, unknown>).structured_output = { pass: true, evidence: "found it in structured_output" };
    mockQuery.mockReturnValue(asyncMessages([msg]));

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.pass).toBe(true);
    expect(result.evidence).toBe("found it in structured_output");
  });

  it("prefers structured_output over result when both present", async () => {
    const msg = resultMessage('{"pass": false, "evidence": "from result"}');
    (msg as Record<string, unknown>).structured_output = { pass: true, evidence: "from structured_output" };
    mockQuery.mockReturnValue(asyncMessages([msg]));

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.pass).toBe(true);
    expect(result.evidence).toBe("from structured_output");
  });

  it("includes raw result snippet when success has unparseable result", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage("this is plain text not json"),
      ]),
    );

    const result = await gradeAssertion(assertion, "/tmp/out.md");
    expect(result.pass).toBeNull();
    expect(result.evidence).toContain("this is plain text not json");
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
