import { stringify as yamlStringify } from "yaml";
import type { Rubric } from "./config.js";
import { gradeAssertion, type AssertionResult } from "./grader.js";

export interface RunOptions {
  model?: string;
  context?: string;
  verbose?: boolean;
}

/**
 * Run all assertions in parallel, streaming results to stdout as YAML.
 */
export async function run(
  rubric: Rubric,
  outputPath: string,
  options: RunOptions = {},
): Promise<{ results: AssertionResult[]; passRate: number }> {
  const { assertions } = rubric;
  const context = options.context ?? rubric.context;
  const results: AssertionResult[] = [];

  // Write YAML array header immediately
  process.stdout.write("assertions:\n");

  // Launch all assertions in parallel, streaming each result on completion
  const promises = assertions.map((assertion) =>
    gradeAssertion(assertion, outputPath, {
      model: options.model,
      context,
      verbose: options.verbose,
    }).then((result) => {
      results.push(result);
      writeAssertionYaml(result);
      return result;
    }),
  );

  // Wait for all to settle (don't abort on individual failures)
  await Promise.allSettled(promises);

  // Compute pass rate (null results count as failures)
  const passed = results.filter((r) => r.pass === true).length;
  const passRate = assertions.length > 0
    ? Math.round((passed / assertions.length) * 100) / 100
    : 0;

  process.stdout.write(`pass_rate: ${passRate}\n`);

  return { results, passRate };
}

/**
 * Write a single assertion result as a YAML array item to stdout.
 */
function writeAssertionYaml(result: AssertionResult): void {
  // Use yaml library for proper escaping/quoting of evidence strings
  const item = {
    id: result.id,
    check: result.check,
    pass: result.pass,
    evidence: result.evidence,
  };

  // Serialize as a single YAML value, then indent as array item
  const serialized = yamlStringify(item, { lineWidth: 0 }).trimEnd();
  const lines = serialized.split("\n");

  // First line gets "  - ", subsequent lines get "    " (4-space indent)
  const yamlItem = lines
    .map((line: string, i: number) => (i === 0 ? `  - ${line}` : `    ${line}`))
    .join("\n");

  process.stdout.write(yamlItem + "\n");
}
