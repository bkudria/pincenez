import { stringify as yamlStringify } from "yaml";
import type { Rubric } from "./config.js";
import { lintAssertion, type LintResult } from "./linter.js";

export interface LintRunOptions {
  model?: string;
  context?: string;
  verbose?: boolean;
}

/**
 * Lint all assertions in parallel, streaming results to stdout as YAML.
 */
export async function runLint(
  rubric: Rubric,
  options: LintRunOptions = {},
): Promise<{ results: LintResult[]; assertionsWithIssues: number }> {
  const { assertions } = rubric;
  const context = options.context ?? rubric.context;
  const results: LintResult[] = [];

  // Write YAML array header immediately
  process.stdout.write("assertions:\n");

  // Launch all assertions in parallel, streaming each result on completion
  const promises = assertions.map((assertion) =>
    lintAssertion(assertion, {
      model: options.model,
      context,
      verbose: options.verbose,
    }).then((result) => {
      results.push(result);
      writeLintResultYaml(result);
      return result;
    }),
  );

  // Wait for all to settle
  await Promise.allSettled(promises);

  const assertionsWithIssues = results.filter((r) => r.issues.length > 0).length;

  process.stdout.write(`assertions_total: ${assertions.length}\n`);
  process.stdout.write(`assertions_with_issues: ${assertionsWithIssues}\n`);

  return { results, assertionsWithIssues };
}

/**
 * Write a single lint result as a YAML array item to stdout.
 */
function writeLintResultYaml(result: LintResult): void {
  const item = {
    id: result.id,
    check: result.check,
    issues: result.issues,
  };

  const serialized = yamlStringify(item, { lineWidth: 0 }).trimEnd();
  const lines = serialized.split("\n");

  const yamlItem = lines
    .map((line: string, i: number) => (i === 0 ? `  - ${line}` : `    ${line}`))
    .join("\n");

  process.stdout.write(yamlItem + "\n");
}
