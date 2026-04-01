import { stringify as yamlStringify } from "yaml";
import type { Rubric } from "./config.js";
import { gradeAssertion, type AssertionResult } from "./grader.js";
import { writeYamlArrayItem } from "./yaml-utils.js";

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
): Promise<{ results: AssertionResult[]; passRate: number; costUsd: number }> {
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
      writeYamlArrayItem({
        id: result.id,
        check: result.check,
        pass: result.pass,
        evidence: result.evidence,
      });
      return result;
    }),
  );

  // Wait for all to settle (don't abort on individual failures)
  await Promise.allSettled(promises);

  // Compute pass rate (null results count as failures)
  const passed = results.filter((r) => r.pass === true).length;
  const passRate = Math.round((passed / assertions.length) * 100) / 100;

  // Write summary as proper YAML
  const summary: Record<string, unknown> = { pass_rate: passRate };
  const costUsd = results.reduce((sum, r) => sum + r.cost_usd, 0);
  if (costUsd > 0) {
    summary.cost_usd = costUsd;
  }
  process.stdout.write(yamlStringify(summary, { lineWidth: 0 }));

  return { results, passRate, costUsd };
}

