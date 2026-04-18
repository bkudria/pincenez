import { stringify as yamlStringify } from "yaml";
import type { ChecksFile } from "./config.js";
import { lintCheck, type LintResult } from "./linter.js";
import { writeYamlArrayItem } from "./yaml-utils.js";

export interface LintRunOptions {
  model?: string;
  context?: string;
  controller?: AbortController;
}

/**
 * Lint all checks in parallel, streaming results to stdout as YAML.
 */
export async function runLint(
  checksFile: ChecksFile,
  options: LintRunOptions = {},
): Promise<{ results: LintResult[]; checksWithIssues: number }> {
  const { checks } = checksFile;
  const context = options.context ?? checksFile.context;
  const results: LintResult[] = [];

  // Write YAML array header immediately
  process.stdout.write("checks:\n");

  // Launch all checks in parallel, streaming each result on completion
  const promises = checks.map((check) =>
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
  );

  // Wait for all to settle
  await Promise.allSettled(promises);

  const checksWithIssues = results.filter((r) => r.issues.length > 0).length;

  process.stdout.write(yamlStringify({
    checks_total: checks.length,
    checks_with_issues: checksWithIssues,
  }, { lineWidth: 0 }));

  return { results, checksWithIssues };
}
