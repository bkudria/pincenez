import pLimit from "p-limit";
import { stringify as yamlStringify } from "yaml";
import type { ChecksFile } from "./config.js";
import { gradeCheck, type CheckResult } from "./grader.js";
import { writeYamlArrayItem } from "./yaml-utils.js";

export interface RunOptions {
  model?: string;
  context?: string;
  controller?: AbortController;
  concurrency?: number;
}

const DEFAULT_CONCURRENCY = 10;

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

  const limit = pLimit(options.concurrency ?? DEFAULT_CONCURRENCY);

  // Launch all checks under the concurrency limit, streaming each result on completion
  const promises = checks.map((check) =>
    limit(() =>
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
    ),
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
  const cacheCreationTotal = results.reduce((sum, r) => sum + (r.cache_creation_tokens ?? 0), 0);
  const cacheReadTotal = results.reduce((sum, r) => sum + (r.cache_read_tokens ?? 0), 0);
  if (cacheCreationTotal > 0) summary.cache_creation_tokens = cacheCreationTotal;
  if (cacheReadTotal > 0) summary.cache_read_tokens = cacheReadTotal;
  process.stdout.write(yamlStringify(summary, { lineWidth: 0 }));

  return { results, passRate, costUsd };
}
