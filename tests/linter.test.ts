import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseLintOutput, lintAssertion } from "../src/linter.js";
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
  check: "Output is high quality",
};

describe("parseLintOutput", () => {
  it("parses valid JSON with issues array", () => {
    const json = JSON.stringify({
      issues: [{ anti_pattern: "vague", suggestion: "Be more specific" }],
    });
    expect(parseLintOutput(json)).toEqual([
      { anti_pattern: "vague", suggestion: "Be more specific" },
    ]);
  });

  it("parses empty issues array (no problems)", () => {
    expect(parseLintOutput('{"issues": []}')).toEqual([]);
  });

  it("returns null for invalid JSON", () => {
    expect(parseLintOutput("not json")).toBeNull();
  });

  it("returns null when issues is not an array", () => {
    expect(parseLintOutput('{"issues": "string"}')).toBeNull();
  });

  it("returns null when issue has wrong field types", () => {
    expect(parseLintOutput('{"issues": [{"anti_pattern": 42, "suggestion": "ok"}]}')).toBeNull();
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

describe("lintAssertion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns LintResult with issues on success", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage('{"issues": [{"anti_pattern": "vague", "suggestion": "Name the metric"}]}'),
      ]),
    );

    const result = await lintAssertion(assertion);
    expect(result).toEqual({
      id: "test-1",
      check: "Output is high quality",
      issues: [{ anti_pattern: "vague", suggestion: "Name the metric" }],
    });
  });

  it("returns empty issues for clean assertions", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage('{"issues": []}'),
      ]),
    );

    const result = await lintAssertion(assertion);
    expect(result.issues).toEqual([]);
  });

  it("passes outputFormat with json_schema to query", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage('{"issues": []}'),
      ]),
    );

    await lintAssertion(assertion);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          outputFormat: expect.objectContaining({
            type: "json_schema",
          }),
          tools: [],
          maxTurns: 1,
        }),
      }),
    );
  });

  it("returns error issue when SDK throws", async () => {
    mockQuery.mockImplementation(() => {
      throw new Error("SDK connection failed");
    });

    const result = await lintAssertion(assertion);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].anti_pattern).toBe("error");
    expect(result.issues[0].suggestion).toContain("SDK connection failed");
  });

  it("returns error issue when structured output parsing fails", async () => {
    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage("not valid json"),
      ]),
    );

    const result = await lintAssertion(assertion);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].anti_pattern).toBe("error");
  });

  it("deletes CLAUDECODE env var", async () => {
    process.env.CLAUDECODE = "something";

    mockQuery.mockReturnValue(
      asyncMessages([
        resultMessage('{"issues": []}'),
      ]),
    );

    await lintAssertion(assertion);
    expect(process.env.CLAUDECODE).toBeUndefined();
  });
});
