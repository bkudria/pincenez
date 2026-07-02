#!/usr/bin/env node

import { Command } from 'commander';
import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { loadChecksFile } from './config.js';
import { parseAuthMode } from './auth.js';
import { run } from './runner.js';
import { runLint } from './lint-runner.js';
import { getLintRulesText } from './lint-prompt.js';
import { EXIT_CONFIG_ERROR, EXIT_SIGINT } from './exit-codes.js';
import { formatCliError, cliExitCode } from './errors.js';
import { HELP_TEXT } from './help-text.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export async function gradeAction(
  checksFileArg: string | undefined,
  outputArg: string | undefined,
  opts: {
    model?: string;
    context?: string;
    verbose?: boolean;
    concurrency?: string;
    auth?: string;
  },
  program: Command,
) {
  if (!checksFileArg || checksFileArg === 'help') {
    program.help();
    return;
  }

  try {
    const auth = opts.auth ? parseAuthMode(opts.auth) : undefined;
    const checksPath = resolve(checksFileArg);
    const checksFile = await loadChecksFile(checksPath);

    let outputPath: string;
    let tempFile: string | undefined;

    if (outputArg) {
      outputPath = resolve(outputArg);
    } else {
      const stdinContent = await readStdin();
      if (!stdinContent) {
        process.stderr.write(
          '[pincenez] Error: no output provided (pass a file or pipe to stdin)\n',
        );
        process.exit(EXIT_CONFIG_ERROR);
      }
      tempFile = join(tmpdir(), `pincenez-stdin-${process.pid}-${Date.now()}`);
      await writeFile(tempFile, stdinContent, 'utf8');
      outputPath = tempFile;
    }

    const controller = new AbortController();
    const sigintHandler = () => {
      process.stderr.write('[pincenez] Aborting in-flight checks...\n');
      controller.abort();
    };
    process.once('SIGINT', sigintHandler);

    try {
      const { passRate } = await run(checksFile, outputPath, {
        model: opts.model,
        context: opts.context,
        controller,
        concurrency: opts.concurrency ? parseInt(opts.concurrency, 10) : undefined,
        auth,
      });

      if (opts.verbose) {
        process.stderr.write(
          `[pincenez] Done: ${checksFile.checks.length} checks, pass_rate=${passRate}\n`,
        );
      }

      if (controller.signal.aborted) {
        process.exit(EXIT_SIGINT);
      }
    } finally {
      process.removeListener('SIGINT', sigintHandler);
      if (tempFile) {
        await unlink(tempFile).catch(() => {});
      }
    }
  } catch (err) {
    process.stderr.write(formatCliError(err) + '\n');
    process.exit(cliExitCode(err));
  }
}

export async function lintAction(
  checksFileArg: string | undefined,
  opts: {
    model?: string;
    context?: string;
    availableTools?: string;
    verbose?: boolean;
    concurrency?: string;
    auth?: string;
  },
  lintCmd: Command,
) {
  if (!checksFileArg) {
    lintCmd.help();
    return;
  }

  const controller = new AbortController();
  const sigintHandler = () => {
    process.stderr.write('[pincenez] Aborting in-flight checks...\n');
    controller.abort();
  };
  process.once('SIGINT', sigintHandler);

  try {
    const auth = opts.auth ? parseAuthMode(opts.auth) : undefined;
    const checksPath = resolve(checksFileArg);
    const checksFile = await loadChecksFile(checksPath);

    const { checksWithIssues } = await runLint(checksFile, {
      model: opts.model,
      context: opts.context,
      availableTools: opts.availableTools
        ? opts.availableTools
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : undefined,
      controller,
      concurrency: opts.concurrency ? parseInt(opts.concurrency, 10) : undefined,
      auth,
    });

    if (opts.verbose) {
      process.stderr.write(
        `[pincenez] Lint done: ${checksFile.checks.length} checks, ${checksWithIssues} with issues\n`,
      );
    }

    if (controller.signal.aborted) {
      process.exit(EXIT_SIGINT);
    }
  } catch (err) {
    process.stderr.write(formatCliError(err) + '\n');
    process.exit(cliExitCode(err));
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
}

/* v8 ignore start -- Commander wiring; action handlers are tested directly */
async function main() {
  const program = new Command();

  program
    .name('pincenez')
    .description(
      'Grade LLM outputs against checks using an LLM judge.\n' +
        'Evaluates each check independently in parallel.\n' +
        'Returns structured YAML to stdout.',
    )
    .version(pkg.version)
    .argument('[checks.yaml]', 'Checks file defining checks to evaluate')
    .argument('[output]', 'File or directory for the LLM to read and evaluate (default: stdin)')
    .option('--model <model>', 'LLM judge model (default: claude-haiku-4-5)')
    .option('--context <text>', "Override the checks file's context field (replaces it entirely)")
    .option(
      '--auth <mode>',
      'Credential preference: auto (subscription when present), subscription, or api-key (default: auto)',
    )
    .option('--concurrency <n>', 'Max parallel checks', '10')
    .option('-v, --verbose', 'Print completion summary to stderr')
    .addHelpText('after', HELP_TEXT)
    .action(async (checksFileArg: string | undefined, outputArg: string | undefined, opts) => {
      await gradeAction(checksFileArg, outputArg, opts, program);
    });

  const lintCmd = program
    .command('lint [checks.yaml]')
    .description('Check quality for common anti-patterns')
    .option('--model <model>', 'LLM model for lint analysis (default: claude-sonnet-5)')
    .option('--context <text>', 'Scenario prompt (helps detect tautological checks)')
    .option(
      '--available-tools <tools>',
      'Tools available in the session under test, comma-separated (grounds tool-availability judgments)',
    )
    .option(
      '--auth <mode>',
      'Credential preference: auto (subscription when present), subscription, or api-key (default: auto)',
    )
    .option('--concurrency <n>', 'Max parallel checks', '10')
    .option('-v, --verbose', 'Print completion summary to stderr')
    .addHelpText('after', getLintRulesText())
    .action(async (checksFileArg: string | undefined, opts) => {
      await lintAction(checksFileArg, opts, lintCmd);
    });

  await program.parseAsync(process.argv);
}
/* v8 ignore stop */

/**
 * Read all of stdin as a string. Returns empty string if stdin is a TTY.
 */
export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/* v8 ignore start -- module-load-time direct-execution guard */
// Only run CLI when executed directly
const isDirectExecution =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith('/dist/cli.js'));

if (isDirectExecution) {
  main();
}
/* v8 ignore stop */
