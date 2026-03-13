import { describe, it, expect } from "vitest";
import { parseRubric, loadRubric } from "../src/config.js";
import { resolve } from "node:path";

describe("parseRubric", () => {
  it("parses a valid rubric with all fields", () => {
    const yaml = `
context: "some context"
assertions:
  - id: my-check
    check: "the thing happened"
    note: "look carefully"
    model: claude-sonnet-4-5
`;
    const rubric = parseRubric(yaml);
    expect(rubric.context).toBe("some context");
    expect(rubric.assertions).toHaveLength(1);
    expect(rubric.assertions[0]).toEqual({
      id: "my-check",
      check: "the thing happened",
      note: "look carefully",
      model: "claude-sonnet-4-5",
    });
  });

  it("auto-generates IDs when missing", () => {
    const yaml = `
assertions:
  - check: "first"
  - check: "second"
`;
    const rubric = parseRubric(yaml);
    expect(rubric.assertions[0].id).toBe("assertion-0");
    expect(rubric.assertions[1].id).toBe("assertion-1");
  });

  it("preserves explicit IDs and fills gaps", () => {
    const yaml = `
assertions:
  - id: custom-id
    check: "first"
  - check: "second"
`;
    const rubric = parseRubric(yaml);
    expect(rubric.assertions[0].id).toBe("custom-id");
    expect(rubric.assertions[1].id).toBe("assertion-1");
  });

  it("returns undefined context when absent", () => {
    const yaml = `
assertions:
  - check: "first"
`;
    const rubric = parseRubric(yaml);
    expect(rubric.context).toBeUndefined();
  });

  it("throws on empty assertions array", () => {
    const yaml = `
assertions: []
`;
    expect(() => parseRubric(yaml)).toThrow();
  });

  it("throws on missing check field", () => {
    const yaml = `
assertions:
  - id: no-check
    note: "oops"
`;
    expect(() => parseRubric(yaml)).toThrow();
  });

  it("throws on non-object YAML", () => {
    expect(() => parseRubric("just a string")).toThrow();
  });

  it("throws on invalid YAML syntax", () => {
    expect(() => parseRubric("assertions:\n  - check: [unterminated")).toThrow();
  });
});

describe("loadRubric", () => {
  it("loads and parses the example rubric file", async () => {
    const rubric = await loadRubric(resolve("examples/rubric.yml"));
    expect(rubric.context).toContain("haiku");
    expect(rubric.assertions.length).toBeGreaterThanOrEqual(1);
    expect(rubric.assertions[0].id).toBe("asked-topic");
    expect(rubric.assertions[0].check).toBeTruthy();
  });
});
