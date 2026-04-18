import pLimit from "p-limit";
import { stringify as yamlStringify } from "yaml";
import type { ChecksFile } from "./config.js";
import { lintCheck, type LintResult } from "./linter.js";
import { writeYamlArrayItem } from "./yaml-utils.js";

export interface LintRunOptions {
  model?: string;
  context?: string;
  controller?: AbortController;
  concurrency?: number;
}

const DEFAULT_CONCURRENCY = 10;

/**
 * Lint all checks in parallel, streaming results to stdout as YAML.
 */
export async function runLint(
  checksFile: ChecksFile,
  options: LintRunOptions = {},
): Promise<{ results: LintResult[]; checksWithIssues: number; costUsd: number }> {
  const { checks } = checksFile;
  const context = options.context ?? checksFile.context;
  const results: LintResult[] = [];

  // Write YAML array header immediately
  process.stdout.write("checks:\n");

  const limit = pLimit(options.concurrency ?? DEFAULT_CONCURRENCY);

  // Launch all checks under the concurrency limit, streaming each result on completion
  const promises = checks.map((check) =>
    limit(() =>
      lintCheck(check, {
        model: options.model,
        context,
        controller: options.controller,
      }).then((result) => {
        results.push(result);
        writeYamlArrayItem({
          id: result.id,
          check: result.check,
          issues: result.issues,
        });
        return result;
      }),
    ),
  );

  // Wait for all to settle
  await Promise.allSettled(promises);

  const checksWithIssues = results.filter((r) => r.issues.length > 0).length;
  const costUsdRaw = results.reduce((sum, r) => sum + r.cost_usd, 0);
  const costUsd = Math.round(costUsdRaw * 10000) / 10000;

  const summary: Record<string, unknown> = {
    checks_total: checks.length,
    checks_with_issues: checksWithIssues,
  };
  if (costUsd > 0) {
    summary.cost_usd = costUsd;
  }
  process.stdout.write(yamlStringify(summary, { lineWidth: 0 }));

  return { results, checksWithIssues, costUsd };
}
