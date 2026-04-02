# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Pincenez

A TypeScript CLI that grades LLM outputs against YAML checks files using an LLM judge. Each check is evaluated independently in parallel by a separate LLM call (via `@anthropic-ai/claude-agent-sdk`), producing structured YAML results streamed to stdout.

Extracted from the [skillcraft](~/.claude/skills/skillcraft/) eval framework to be a standalone, composable UNIX tool. Pairs with `scuttlerun` (headless session driver) in the eval pipeline.

## Commands

```bash
npm run build            # TypeScript → dist/ (tsc)
npm test                 # Run tests (vitest, looks in tests/**/*.test.ts)
npm run test:watch       # Watch mode
npm run test:coverage    # Tests with V8 coverage (excludes src/cli.ts)
npm run dev -- <args>    # Run via tsx without building (e.g. npm run dev -- checks.yaml output.md)
```

## Architecture

Five source files in `src/`, each with a single responsibility:

- **cli.ts** — Commander-based CLI entry point. Parses args, reads stdin to temp file if needed, calls `run()`. Not covered by tests.
- **config.ts** — Checks file schema (Zod validation) and YAML parsing. Exports `loadChecksFile()` / `parseChecksFile()` and the `ChecksFile` / `Check` types.
- **prompt.ts** — Builds the grader prompt for a single check. Includes chain-of-thought instructions and grading rules.
- **grader.ts** — Calls the Claude Agent SDK (`query()`) with Read-only tool access and `outputFormat` (JSON schema) to evaluate one check. Structured output guarantees valid `{pass, evidence}` response.
- **runner.ts** — Orchestrates parallel check evaluation. Streams each result to stdout as YAML array items as they complete, then writes `pass_rate`.

Data flow: `CLI → loadChecksFile() → run() → gradeCheck() (parallel, one per check) → stdout YAML`

## Key Design Decisions

- **One LLM call per check** — prevents cross-contamination between verdicts
- **Parallel by default** — N checks = N concurrent LLM calls via `Promise.allSettled`
- **Exit code 0 = operational success** — check failures are data, not errors. Exit 1 = checks file error, Exit 2 = runtime error.
- **Default model: claude-haiku-4-5** — cheapest/fastest. Per-check `model` field overrides `--model` flag.
- **Agent SDK with Read-only tools** — LLM can read the output file but not write anything
- **ESM throughout** — `"type": "module"` in package.json, `NodeNext` module resolution. Imports use `.js` extensions.
