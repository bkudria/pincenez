#!/usr/bin/env node

import { Command } from "commander";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRubric } from "./config.js";
import { run } from "./runner.js";
import { runLint } from "./lint-runner.js";

const HELP_TEXT = `
Rubric Schema (YAML):
  Only 'assertions' is required. All other fields are optional.

    # --- Context (optional) ---
    context: |                              # What task produced this output
      The agent was asked to write a haiku
      about the ocean and save it to ocean.txt

    # --- Assertions ---
    assertions:
      - id: file-created                    # Unique ID (auto-generated if omitted)
        check: "ocean.txt was created"      # Binary claim to evaluate (required)
        note: "Look for Write tool usage"   # Grading hint (optional)
        model: claude-sonnet-4-6            # Model override (optional)

  Field Reference:
    context             What task produced this output. Orients the judge.
    assertions[].id     Unique identifier. Auto: assertion-0, assertion-1, ...
    assertions[].check  The statement to evaluate. Objective, verifiable claim.
    assertions[].note   Grading hint. Improves human-judge alignment significantly.
    assertions[].model  Model override. Overrides --model and the default.

Output Format:
  Grading YAML is streamed to stdout as assertions complete (arrival order):

    assertions:
      - id: file-created
        check: "ocean.txt was created"
        pass: true
        evidence: "The agent used Write to create ocean.txt"
    pass_rate: 1

  pass_rate is written after all assertions finish.

Examples:
  # Grade a file against a rubric
  pincenez rubric.yml output.md

  # Pipe from stdin (e.g. scuttlerun output)
  scuttlerun run session.yml | pincenez rubric.yml

  # Use a stronger model for all assertions
  pincenez rubric.yml output.md --model claude-sonnet-4-6

  # CI quality gate with yq
  pincenez rubric.yml output.md | yq -e '.pass_rate == 1.0'

  # Save results to file
  pincenez rubric.yml output.md > grading.yml

  # Lint assertions for quality anti-patterns
  pincenez lint rubric.yml

Exit Codes:
  0   Ran successfully (regardless of assertion results)
  1   Rubric error (invalid YAML, missing fields)
  2   Runtime error (API failure, etc.)`;

async function gradeAction(
  rubricFile: string | undefined,
  outputArg: string | undefined,
  opts: { model?: string; context?: string; verbose?: boolean },
  program: Command,
) {
  if (!rubricFile || rubricFile === "help") {
    program.help();
    return;
  }

  try {
    const rubricPath = resolve(rubricFile);
    const rubric = await loadRubric(rubricPath);

    let outputPath: string;
    let tempFile: string | undefined;

    if (outputArg) {
      outputPath = resolve(outputArg);
    } else {
      const stdinContent = await readStdin();
      if (!stdinContent) {
        process.stderr.write("[pincenez] Error: no output provided (pass a file or pipe to stdin)\n");
        process.exit(1);
      }
      tempFile = join(tmpdir(), `pincenez-stdin-${process.pid}-${Date.now()}`);
      await writeFile(tempFile, stdinContent, "utf8");
      outputPath = tempFile;
    }

    try {
      const { passRate } = await run(rubric, outputPath, {
        model: opts.model,
        context: opts.context,
        verbose: opts.verbose,
      });

      if (opts.verbose) {
        process.stderr.write(`[pincenez] Done: ${rubric.assertions.length} assertions, pass_rate=${passRate}\n`);
      }
    } finally {
      if (tempFile) {
        await unlink(tempFile).catch(() => {});
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      process.stderr.write(`[pincenez] Rubric error: ${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(
      `[pincenez] Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  }
}

async function lintAction(
  rubricFile: string,
  opts: { model?: string; context?: string; verbose?: boolean },
) {
  try {
    const rubricPath = resolve(rubricFile);
    const rubric = await loadRubric(rubricPath);

    const { assertionsWithIssues } = await runLint(rubric, {
      model: opts.model,
      context: opts.context,
      verbose: opts.verbose,
    });

    if (opts.verbose) {
      process.stderr.write(
        `[pincenez] Lint done: ${rubric.assertions.length} assertions, ${assertionsWithIssues} with issues\n`,
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      process.stderr.write(`[pincenez] Rubric error: ${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(
      `[pincenez] Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  }
}

async function main() {
  const program = new Command();

  program
    .name("pincenez")
    .description(
      "Grade LLM outputs against rubrics using an LLM judge.\n" +
      "Evaluates each assertion independently in parallel.\n" +
      "Returns structured YAML to stdout.",
    )
    .version("0.1.0")
    .argument("[rubric.yml]", "Rubric file defining assertions to evaluate")
    .argument("[output]", "File or directory for the LLM to read and evaluate (default: stdin)")
    .option("--model <model>", "LLM judge model (default: claude-haiku-4-5)")
    .option("--context <text>", "Override or supplement the rubric's context field")
    .option("--verbose", "Include verbose output on stderr")
    .addHelpText("after", HELP_TEXT)
    .action(async (rubricFile: string | undefined, outputArg: string | undefined, opts) => {
      await gradeAction(rubricFile, outputArg, opts, program);
    });

  program
    .command("lint <rubric.yml>")
    .description("Check assertion quality for common anti-patterns")
    .option("--model <model>", "LLM model for lint analysis (default: claude-haiku-4-5)")
    .option("--context <text>", "Scenario prompt (helps detect tautological assertions)")
    .option("--verbose", "Include verbose output on stderr")
    .action(async (rubricFile: string, opts) => {
      await lintAction(rubricFile, opts);
    });

  await program.parseAsync(process.argv);
}

/**
 * Read all of stdin as a string. Returns empty string if stdin is a TTY.
 */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Only run CLI when executed directly
const isDirectExecution =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith("/dist/cli.js"));

if (isDirectExecution) {
  main();
}
