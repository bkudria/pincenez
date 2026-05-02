# Pincenez

> **Unreleased.** Pincenez is under active development and its API, checks file format, and behavior may change without notice.

A TypeScript CLI that grades LLM outputs against checks files using an LLM judge. Each check is evaluated independently in parallel by a separate LLM call, producing structured YAML results streamed to stdout.

## Installation

```bash
git clone <repo-url> && cd pincenez
npm install
npm run build
npm link          # makes `pincenez` available globally
```

## Usage

```bash
# Grade a file against a checks file
pincenez checks.yaml output.md

# Pipe from scuttlerun
scuttlerun session.yaml | pincenez checks.yaml

# Use a stronger model for all checks
pincenez checks.yaml output.md --model claude-sonnet-4-6
```

## Checks File Schema

Checks files are YAML files defining what to evaluate. Only `checks` is required.

```yaml
context: |
  The agent was asked to write a function and save it to a file.
  A CLAUDE.md instruction required writing tests before production code.

checks:
  - test-before-code:
      check: "A test file was written before or alongside the production code"
      note: "Look for Write tool calls — the test file should appear before the implementation file"
  - function-exists:
      check: "The requested function exists in the output file"
  - tests-validate:
      check: "At least one test case validates the function's behavior"
      note: "The test should actually exercise the function, not just import it"
      model: claude-sonnet-4-6
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `context` | No | What task produced this output. Orients the judge without prescribing the answer. |
| `checks` | Yes | List of binary checks to evaluate. |
| `checks[].check` | Yes | The statement to evaluate. Phrased as an objective, verifiable claim. |
| `checks[].note` | No | Grading hint for the judge. Improves human-judge alignment from ~70-80% to 93-96%. |
| `checks[].model` | No | Model override for this check. Overrides `--model` and the default. |

## Output

Pincenez streams grading YAML to stdout as checks complete:

```yaml
checks:
  - id: file-created
    check: "A file named ocean.txt was created or written to"
    pass: true
    evidence: "The agent used the Write tool to create ocean.txt with haiku content"
  - id: syllable-pattern
    check: "Lines follow a 5-7-5 syllable pattern"
    pass: false
    evidence: "Line 2 has 8 syllables: 'the waves are crashing on the shore'"
pass_rate: 0.67
```

Results appear in arrival order (whichever check finishes first). `pass_rate` is written after all checks complete.

## CLI

```
pincenez [options] <checks.yaml> [output]
```

| Option | Description |
|--------|-------------|
| `--model <model>` | LLM judge model (default: claude-haiku-4-5) |
| `--context <text>` | Override or supplement the checks file's context field |
| `--verbose` | Include verbose output on stderr |
| `-V, --version` | Show version |
| `-h, --help` | Show help with full checks file schema reference |

### Exit Codes

Shared taxonomy across scuttlerun/pincenez/craboodle. Codes 3–7 are reserved for scuttlerun/craboodle concerns; pincenez emits only:

| Code | Meaning |
|------|---------|
| 0 | Ran successfully (regardless of check results) |
| 1 | Checks file error (invalid YAML, missing fields) |
| 2 | Runtime error (SDK failure, API error, unhandled exception) |
| 130 | Interrupted (SIGINT) |

### Lint

Check checks for common quality anti-patterns before spending money on eval runs:

```bash
pincenez lint checks.yaml
pincenez lint checks.yaml --context "The prompt that produced this output"
```

Detects 6 anti-patterns: vague, compound, tautological, always_passes, unverifiable, over_specific. Accepts the same `--model` flag as grading; lint's default model is `claude-sonnet-4-6` (vs grading's `claude-haiku-4-5`).

## Composition

```bash
# Standalone grading
pincenez checks.yaml output.md > grading.yaml

# Pipe from scuttlerun
scuttlerun session.yaml | pincenez checks.yaml

# CI quality gate
scuttlerun test-scenario.yaml | pincenez checks.yaml | yq -e '.pass_rate >= 0.8'

# Grade a specific output
pincenez checks.yaml output.md > grading.yaml
```

## Development

```bash
npm install
npm run build            # TypeScript compilation
npm test                 # Run all tests (vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Tests with coverage report
npm run dev -- examples/checks.yaml examples/output.md   # Run via tsx
```

## See Also

- [SPEC.md](SPEC.md) — Full specification and design decisions
- [GOALS.md](GOALS.md) — Design philosophy and research principles
