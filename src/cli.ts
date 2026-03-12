#!/usr/bin/env node

import { Command } from "commander";
import { writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRubric } from "./config.js";
import { run } from "./runner.js";

async function main() {
  const program = new Command();

  program
    .name("judge")
    .description(
      "Grade LLM outputs against rubrics using an LLM judge.\n" +
      "Evaluates each assertion independently in parallel.\n" +
      "Returns structured YAML to stdout.",
    )
    .version("0.1.0")
    .argument("<rubric.yml>", "Rubric file defining assertions to evaluate")
    .argument("[output]", "File or directory for the LLM to read and evaluate (default: stdin)")
    .option("--model <model>", "Judge model (default: claude-haiku-4-5)")
    .option("--context <text>", "Override or supplement the rubric's context field")
    .option("--verbose", "Include verbose output on stderr")
    .action(async (rubricFile: string, outputArg: string | undefined, opts) => {
      try {
        // Load and validate rubric
        const rubricPath = resolve(rubricFile);
        const rubric = await loadRubric(rubricPath);

        // Resolve output path (file arg or stdin → temp file)
        let outputPath: string;
        let tempFile: string | undefined;

        if (outputArg) {
          outputPath = resolve(outputArg);
        } else {
          // Read stdin to temp file
          const stdinContent = await readStdin();
          if (!stdinContent) {
            process.stderr.write("[judge] Error: no output provided (pass a file or pipe to stdin)\n");
            process.exit(1);
          }
          tempFile = join(tmpdir(), `judge-stdin-${process.pid}-${Date.now()}`);
          await writeFile(tempFile, stdinContent, "utf8");
          outputPath = tempFile;
        }

        try {
          // Run all assertions
          const { passRate } = await run(rubric, outputPath, {
            model: opts.model,
            context: opts.context,
            verbose: opts.verbose,
          });

          if (opts.verbose) {
            process.stderr.write(`[judge] Done: ${rubric.assertions.length} assertions, pass_rate=${passRate}\n`);
          }
        } finally {
          // Clean up temp file
          if (tempFile) {
            await unlink(tempFile).catch(() => {});
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "ZodError") {
          process.stderr.write(`[judge] Rubric error: ${err.message}\n`);
          process.exit(1);
        }
        process.stderr.write(
          `[judge] Error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(2);
      }
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
