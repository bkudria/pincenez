# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Authoritative artifacts

`GOALS.md`, `pincenez.allium`, the implementation in `src/`, and the tests in `tests/` are co-equal peer artifacts of the same system — design intent, behavioural contract, mechanism, and verification respectively. The four must reflect each other. Changing any one obliges checking and updating the others; conflicts between them are reconciled, not decided unilaterally. `pincenez.allium` is the authoritative source of behavioural truth; `GOALS.md` records _why_ the project exists and the constraints behind its design.

## What is Pincenez

A TypeScript CLI that grades LLM outputs against YAML checks files using an LLM judge. Each check is evaluated independently in parallel by a separate LLM call (via `@anthropic-ai/claude-agent-sdk`), producing structured YAML results streamed to stdout.

Pincenez is a standalone, composable UNIX tool. It sits in the middle of a three-tool pipeline:

- **[scuttlerun](https://github.com/bkudria/scuttlerun)** (upstream) drives a headless Claude session and emits the transcript pincenez grades.
- **pincenez** grades any text against a checks file.
- **[craboodle](https://github.com/bkudria/craboodle)** (typical orchestrator) invokes scuttlerun + pincenez across a directory of eval scenarios.

Pincenez is intentionally usable standalone; the pipeline framing should not leak into the CLI surface or checks schema.

## Commands

```bash
npm run build            # TypeScript → dist/ (tsc)
npm test                 # Run tests (vitest, looks in tests/**/*.test.ts)
npm run test:watch       # Watch mode
npm run test:coverage    # Tests with V8 coverage (excludes src/cli.ts)
npm run dev -- <args>    # Run via tsx without building (e.g. npm run dev -- checks.yaml output.md)
```

## Architecture

Source files in `src/`, each with a single responsibility (grading core shown; lint mirrors it as `lint-prompt.ts` / `linter.ts` / `lint-runner.ts`):

- **cli.ts** — Commander-based CLI entry point. Parses args, reads stdin to temp file if needed, calls `run()`. Not covered by tests.
- **config.ts** — Checks file schema (Zod validation) and YAML parsing. Exports `loadChecksFile()` / `parseChecksFile()` and the `ChecksFile` / `Check` types.
- **prompt.ts** — Builds the grader prompt for a single check. Includes chain-of-thought instructions and grading rules.
- **grader.ts** — Calls the Claude Agent SDK (`query()`) with Read-only tool access and `outputFormat` (JSON schema) to evaluate one check. Structured output guarantees valid `{pass, evidence}` response.
- **runner.ts** — Orchestrates parallel check evaluation. Streams each result to stdout as YAML array items as they complete, then writes `pass_rate`.

Data flow: `CLI → loadChecksFile() → run() → gradeCheck() (parallel, one per check) → stdout YAML`

## Key Design Decisions

- **One LLM call per check** — prevents cross-contamination between verdicts
- **Judge verdicts are non-deterministic** — each check (grade and lint alike) is a single un-seeded LLM call; the Agent SDK exposes no seed/temperature, and there is no retry/voting layer. Disclosed in README and `--help`; GOALS.md lists verdict determinism as a non-goal.
- **Parallel by default** — N checks = N concurrent LLM calls via `Promise.allSettled`
- **Exit code 0 = operational success** — check failures are data, not errors. Exit 1 = checks file error, Exit 2 = runtime error.
- **Default model: claude-haiku-4-5 for grading** — cheapest/fastest. Per-check `model` field overrides `--model` flag. Lint defaults to claude-sonnet-4-6 for stronger anti-pattern judgment.
- **Agent SDK with Read-only tools** — LLM can read the output file but not write anything
- **Judge prompts embed scuttlerun's transcript field contract** — `buildTranscriptFieldContractSection()` in `prompt.ts` (shared by the grader and lint system prompts) mirrors `scuttlerun.allium`'s `@guarantee TranscriptToolFieldContract` (which tool-call fields the YAML transcript keeps vs. drops). If scuttlerun changes the captured fields, this section must be updated in lockstep.
- **Unsets `CLAUDECODE` per call via `options.env`** — when pincenez runs inside a Claude Code session, the SDK errors with nested-session failures if `CLAUDECODE=1` is inherited. Each `query()` call in `grader.ts` and `linter.ts` passes `env: { ...process.env, CLAUDECODE: undefined }` so the subprocess never sees it; the parent's `process.env` is not mutated.
- **ESM throughout** — `"type": "module"` in package.json, `NodeNext` module resolution. Imports use `.js` extensions.
