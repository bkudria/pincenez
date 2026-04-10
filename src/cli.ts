#!/usr/bin/env node

import { Command } from "commander";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadChecksFile } from "./config.js";
import { run } from "./runner.js";
import { runLint } from "./lint-runner.js";
import { getLintRulesText } from "./lint-prompt.js";

const HELP_TEXT = `
Checks File Schema (YAML):
  Only 'checks' is required. All other fields are optional.

    # --- Context (optional) ---
    context: |                              # What task produced this output
      The agent was asked to write a haiku
      about the ocean and save it to ocean.txt

    # --- Checks ---
    checks:
      - file-created:                       # ID as key (required)
          check: "ocean.txt was created"    # Binary claim to evaluate (required)
          note: "Look for Write tool usage" # Grading hint (optional)
          model: claude-sonnet-4-6          # Model override (optional)

  Field Reference:
    context             What task produced this output. Orients the judge.
    checks[].{id}       Map key is the unique check identifier.
    checks[].check      The statement to evaluate. Objective, verifiable claim.
    checks[].note       Grading hint. Improves human-judge alignment significantly.
    checks[].model      Model override. Overrides --model and the default.

Output Format:
  Grading YAML is streamed to stdout as checks complete (arrival order):

    checks:
      - id: file-created
        check: "ocean.txt was created"
        pass: true
        evidence: "The agent used Write to create ocean.txt"
    pass_rate: 1

  pass_rate is written after all checks finish.

Examples:
  # Grade a file against a checks file
  pincenez checks.yaml output.md

  # Pipe from stdin (e.g. scuttlerun output)
  scuttlerun session.yaml | pincenez checks.yaml

  # Use a stronger model for all checks
  pincenez checks.yaml output.md --model claude-sonnet-4-6

  # CI quality gate with yq
  pincenez checks.yaml output.md | yq -e '.pass_rate == 1.0'

  # Save results to file
  pincenez checks.yaml output.md > grading.yaml

  # Lint checks for quality anti-patterns
  pincenez lint checks.yaml

Exit Codes:
  0   Ran successfully (regardless of check results)
  1   Checks file error (invalid YAML, missing fields)
  2   Runtime error (API failure, etc.)`;

async function gradeAction(
    checksFileArg: string | undefined,
    outputArg: string | undefined,
    opts: { model?: string; context?: string; verbose?: boolean },
    program: Command,
) {
    if (!checksFileArg || checksFileArg === "help") {
        program.help();
        return;
    }

    try {
        const checksPath = resolve(checksFileArg);
        const checksFile = await loadChecksFile(checksPath);

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
            const { passRate } = await run(checksFile, outputPath, {
                model: opts.model,
                context: opts.context,
                verbose: opts.verbose,
            });

            if (opts.verbose) {
                process.stderr.write(`[pincenez] Done: ${checksFile.checks.length} checks, pass_rate=${passRate}\n`);
            }
        } finally {
            if (tempFile) {
                await unlink(tempFile).catch(() => {});
            }
        }
    } catch (err) {
        if (err instanceof Error && err.name === "ZodError") {
            process.stderr.write(`[pincenez] Checks file error: ${err.message}\n`);
            process.exit(1);
        }
        process.stderr.write(
            `[pincenez] Error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(2);
    }
}

async function lintAction(
    checksFileArg: string | undefined,
    opts: { model?: string; context?: string; verbose?: boolean },
    lintCmd: Command,
) {
    if (!checksFileArg) {
        lintCmd.help();
        return;
    }

    try {
        const checksPath = resolve(checksFileArg);
        const checksFile = await loadChecksFile(checksPath);

        const { checksWithIssues } = await runLint(checksFile, {
            model: opts.model,
            context: opts.context,
            verbose: opts.verbose,
        });

        if (opts.verbose) {
            process.stderr.write(
                `[pincenez] Lint done: ${checksFile.checks.length} checks, ${checksWithIssues} with issues\n`,
            );
        }
    } catch (err) {
        if (err instanceof Error && err.name === "ZodError") {
            process.stderr.write(`[pincenez] Checks file error: ${err.message}\n`);
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
            "Grade LLM outputs against checks using an LLM judge.\n" +
            "Evaluates each check independently in parallel.\n" +
            "Returns structured YAML to stdout.",
        )
        .version("0.1.0")
        .argument("[checks.yaml]", "Checks file defining checks to evaluate")
        .argument("[output]", "File or directory for the LLM to read and evaluate (default: stdin)")
        .option("--model <model>", "LLM judge model (default: claude-haiku-4-5)")
        .option("--context <text>", "Override or supplement the checks file's context field")
        .option("-v, --verbose", "Include verbose output on stderr")
        .addHelpText("after", HELP_TEXT)
        .action(async (checksFileArg: string | undefined, outputArg: string | undefined, opts) => {
            await gradeAction(checksFileArg, outputArg, opts, program);
        });

    const lintCmd = program
        .command("lint [checks.yaml]")
        .description("Check quality for common anti-patterns")
        .option("--model <model>", "LLM model for lint analysis (default: claude-haiku-4-5)")
        .option("--context <text>", "Scenario prompt (helps detect tautological checks)")
        .option("-v, --verbose", "Include verbose output on stderr")
        .addHelpText("after", getLintRulesText())
        .action(async (checksFileArg: string | undefined, opts) => {
            await lintAction(checksFileArg, opts, lintCmd);
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
