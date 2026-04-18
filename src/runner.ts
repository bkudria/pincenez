import { stringify as yamlStringify } from "yaml";
import type { ChecksFile } from "./config.js";
import { gradeCheck, type CheckResult } from "./grader.js";
import { writeYamlArrayItem } from "./yaml-utils.js";

export interface RunOptions {
  model?: string;
  context?: string;
  controller?: AbortController;
}

/**
 * Run all checks in parallel, streaming results to stdout as YAML.
 */
export async function run(
  checksFile: ChecksFile,
  outputPath: string,
  options: RunOptions = {},
): Promise<{ results: CheckResult[]; passRate: number; costUsd: number }> {
  const { checks } = checksFile;
  const context = options.context ?? checksFile.context;
  const results: CheckResult[] = [];

  // Write YAML array header immediately
  process.stdout.write("checks:\n");

  // Launch all checks in parallel, streaming each result on completion
  const promises = checks.map((check) =>
    gradeCheck(check, outputPath, {
      model: options.model,
      context,
      controller: options.controller,
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
  const passRate = Math.round((passed / checks.length) * 100) / 100;

  // Write summary as proper YAML
  const summary: Record<string, unknown> = { pass_rate: passRate };
  const erroredCount = results.filter((r) => r.pass === null).length;
  if (erroredCount > 0) {
    summary.errored = erroredCount;
  }
  const costUsdRaw = results.reduce((sum, r) => sum + r.cost_usd, 0);
  const costUsd = Math.round(costUsdRaw * 10000) / 10000;
  if (costUsd > 0) {
    summary.cost_usd = costUsd;
  }
  process.stdout.write(yamlStringify(summary, { lineWidth: 0 }));

  return { results, passRate, costUsd };
}
