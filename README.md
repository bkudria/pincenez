# Pincenez

> **Unreleased.** Pincenez is under active development and its API, rubric format, and behavior may change without notice.

A TypeScript CLI that grades LLM outputs against rubrics using an LLM judge. Each assertion is evaluated independently in parallel by a separate LLM call, producing structured YAML results streamed to stdout.

## Install

```bash
git clone <repo-url> && cd pincenez
npm install
npm run build
npm link          # makes `pincenez` available globally
```

## Quick Start

```bash
# Grade a file against a rubric
pincenez rubric.yml output.md

# Pipe from scuttlerun
scuttlerun run session.yml | pincenez rubric.yml

# Use a stronger model for all assertions
pincenez rubric.yml output.md --model claude-sonnet-4-6
```

## Rubric Schema

Rubrics are YAML files defining what to evaluate. Only `assertions` is required.

```yaml
context: |
  The agent was asked to write a function and save it to a file.
  A CLAUDE.md instruction required writing tests before production code.

assertions:
  - id: test-before-code
    check: "A test file was written before or alongside the production code"
    note: "Look for Write tool calls — the test file should appear before the implementation file"
  - id: function-exists
    check: "The requested function exists in the output file"
  - id: tests-validate
    check: "At least one test case validates the function's behavior"
    note: "The test should actually exercise the function, not just import it"
    model: claude-sonnet-4-6
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `context` | No | What task produced this output. Orients the judge without prescribing the answer. |
| `assertions` | Yes | List of binary checks to evaluate. |
| `assertions[].id` | No | Unique identifier. Auto-generated as `assertion-0`, etc. if omitted. |
| `assertions[].check` | Yes | The statement to evaluate. Phrased as an objective, verifiable claim. |
| `assertions[].note` | No | Grading hint for the judge. Improves human-judge alignment from ~70-80% to 93-96%. |
| `assertions[].model` | No | Model override for this assertion. Overrides `--model` and the default. |

## Output

Pincenez streams grading YAML to stdout as assertions complete:

```yaml
assertions:
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

Results appear in arrival order (whichever assertion finishes first). `pass_rate` is written after all assertions complete.

## CLI

```
pincenez [options] <rubric.yml> [output]
```

| Option | Description |
|--------|-------------|
| `--model <model>` | LLM judge model (default: claude-haiku-4-5) |
| `--context <text>` | Override or supplement the rubric's context field |
| `--verbose` | Include verbose output on stderr |
| `-V, --version` | Show version |
| `-h, --help` | Show help with full rubric schema reference |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Ran successfully (regardless of assertion results) |
| 1 | Rubric error (invalid YAML, missing fields) |
| 2 | Runtime error |

### Lint

Check assertions for common quality anti-patterns before spending money on eval runs:

```bash
pincenez lint rubric.yml
pincenez lint rubric.yml --context "The prompt that produced this output"
```

Detects 5 anti-patterns: vague, compound, tautological, always_passes, unverifiable. Uses the same `--model` flag as grading.

## Composition

```bash
# Standalone grading
pincenez rubric.yml output.md > grading.yml

# Pipe from scuttlerun
scuttlerun run session.yml | pincenez rubric.yml

# CI quality gate
scuttlerun run test-scenario.yml | pincenez rubric.yml | yq -e '.pass_rate >= 0.8'

# Paired evaluation (grade each independently, diff downstream)
pincenez rubric.yml with_skill/output.md    > with_skill/grading.yml
pincenez rubric.yml without_skill/output.md > without_skill/grading.yml
```

## Development

```bash
npm install
npm run build            # TypeScript compilation
npm test                 # Run all tests (vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Tests with coverage report
npm run dev -- examples/rubric.yml examples/output.md   # Run via tsx
```

## See Also

- [SPEC.md](SPEC.md) — Full specification and design decisions
- [GOALS.md](GOALS.md) — Design philosophy and research principles
