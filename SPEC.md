# pincenez — Specification

## Synopsis

```
pincenez [options] <checks.yaml> [output]
```

Grade a single output against a checks file using an LLM judge. Returns structured evaluation YAML.

## Core Operation

```
pincenez <checks.yaml> <output> → grading YAML (stdout)
```

The fundamental primitive: one checks file, one output, one evaluation. Everything else composes on top.

## Checks File Schema

The checks file is a YAML file defining what to evaluate.

```yaml
# --- Context (optional) ---
# What task produced this output. Helps the judge understand intent
# without being prescriptive about what "good" looks like.
context: |
  The agent was asked to write a haiku about the ocean
  and save it to ocean.txt

# --- Checks ---
# Binary checks: pass or fail, with evidence.
# Each check is evaluated by an independent LLM call.
checks:
  - file-created:                                          # id as map key
      check: "A file named ocean.txt was created or written to"
      note: "Look for Write tool usage targeting ocean.txt"  # optional grading hint
  - three-lines:
      check: "The output contains exactly 3 lines of poetry"
  - syllable-pattern:
      check: "Lines follow a 5-7-5 syllable pattern"
      note: "Count syllables carefully; common errors include diphthongs and silent vowels"
      model: claude-sonnet-4-6                             # optional per-check model override
```

### Checks File Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `context` | No | What task produced this output. Orients the judge without prescribing the answer. |
| `checks` | Yes | List of binary checks to evaluate. Each item is a single-key map where the key is the check's unique identifier. |
| `checks[].check` | Yes | The statement to evaluate. Phrased as an objective, verifiable claim. |
| `checks[].note` | No | Grading hint — what pass/fail looks like for this check. Short, specific guidance that helps the judge evaluate accurately. Research shows these improve human-judge alignment from ~70-80% to 93-96%. |
| `checks[].model` | No | Model override for this check. Overrides `--model` and the global default. Use a stronger model for nuanced checks that need more reasoning. |

### Checks File Design Principles

- **Checks** should be objectively verifiable — the judge can determine pass/fail unambiguously from the output
- **Context** tells the judge what the task was, not what the answer should be
- **Notes** are hints for the judge, not definitions of correctness — they help with edge cases and ambiguity
- Each check is evaluated **independently** by a separate LLM call, so checks need not be ordered or depend on each other

## Output Schema

Pincenez writes grading YAML to stdout:

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

### Output Schema Notes

- `checks` array mirrors the checks file's check list, in the same order
- Each check has `id`, `check` (echoed from checks file), `pass` (boolean), and `evidence` (judge's reasoning)
- `pass_rate` is `checks_passed / checks_total`
- No summary field — the checks speak for themselves
- Exit code 0 means pincenez ran successfully, regardless of check results. Parse output for pass/fail.
- YAML output is consistent with YAML input (checks file) — same format throughout the pipeline

## CLI Interface

```
Usage: pincenez [options] <checks.yaml> [output]

Grade an output against a checks file using an LLM judge.

Arguments:
  checks.yaml          Checks file defining checks to evaluate
  output              File or directory for the LLM to read and evaluate
                      If omitted, reads from stdin (written to temp file)

Options:
  --model <model>     LLM judge model (default: claude-haiku-4-5)
  --context <text>    Override or supplement the checks file's context field
  --verbose           Include full judge reasoning chain in output
  -h, --help          Show help
```

## Execution Model

1. Pincenez reads the checks file YAML and parses checks
2. If output is stdin, writes it to a temp file
3. **For each check (in parallel):**
   a. Builds a grader prompt combining:
      - Built-in grader instructions (chain-of-thought, then verdict)
      - The check's `check` and `note` fields
      - Context from the checks file (and/or `--context` override)
      - Path to the output file
   b. Invokes the LLM with **Read** tool access and **structured output** (function calling / JSON schema) to enforce the response shape: `{ pass: boolean, evidence: string }`
   c. The LLM reads the output file, reasons about the check, returns its verdict
4. Pincenez collects all check results
5. Computes `pass_rate`
6. Assembles and writes the grading YAML to stdout

### Key Design Decisions

- **One LLM call per check.** Each check is evaluated independently to avoid cross-contamination. Earlier verdicts cannot influence later ones.
- **Parallel by default.** All check evaluations run concurrently. N checks = N parallel LLM calls.
- **LLM gets Read-only tool access.** The LLM reads the output file (or directory) to evaluate each check. Pincenez handles all output writing.
- **Structured output.** Results are extracted via function calling / JSON schema, not free-text parsing. Each call returns `{ pass: boolean, evidence: string }`.
- **Exit code = operational success.** Exit 0 if pincenez ran successfully. Exit non-zero only for errors (bad checks file, API failure, etc.). Check failures are data, not errors.
- **Default model: claude-haiku-4-5.** Cheapest and fastest. Adequate for most binary checks. Use `--model` globally or `model` per-check for stronger models on nuanced checks.

## Usage Examples

```bash
# Grade a file against a checks file
pincenez checks.yaml output.md

# Grade and save to file
pincenez checks.yaml output.md > grading.yaml

# Pipe from scuttlerun
scuttlerun session.yaml | pincenez checks.yaml

# Use a stronger model for all checks
pincenez checks.yaml output.md --model claude-sonnet-4-6

# Or set model per-check in the checks file (overrides --model)

# Inline context supplement
pincenez checks.yaml output.md --context "This was a timed exercise with a 30-second limit"

# CI: check pass rate with yq
pincenez checks.yaml output.md | yq -e '.pass_rate == 1.0'
```

## Lint

Check quality before running evaluations. Catches anti-patterns that cause unreliable or misleading results.

```
pincenez lint [checks.yaml] [--model <model>] [--context <text>]
```

Run with no arguments or `--help` to see the full anti-pattern definitions with examples and check-writing guidance.

### Anti-Patterns Detected

| Anti-Pattern | Description |
|---|---|
| **vague** | Subjective terms without specifics (e.g., "high quality", "follows best practices") |
| **compound** | Multiple independent checks in one check (should be split) |
| **tautological** | Restates the prompt without adding specificity (requires `--context`) |
| **always_passes** | Tests baseline LLM behavior rather than skill/config-specific value |
| **unverifiable** | Tests internal state rather than observable output |
| **over_specific** | Prescribes a single implementation when multiple valid alternatives exist (e.g., "uses eval-all" when load() also works) |

### Lint Output

```yaml
checks:
  - id: file-created
    check: "A file named ocean.txt was created or written to"
    issues: []
  - id: quality-check
    check: "Output is high quality and follows best practices"
    issues:
      - anti_pattern: vague
        suggestion: "Replace 'high quality' with specific criteria..."
checks_total: 2
checks_with_issues: 1
```

### Lint Execution Model

Each check is linted independently in parallel (one LLM call per check), matching the grading execution model. The `--context` flag passes the scenario prompt to enable tautological detection — without it, the linter cannot tell if a check merely restates the prompt.

### Lint Exit Codes

Lint uses the same exit codes as grading:
- 0: Lint completed (regardless of issues found)
- 1: Checks file error
- 2: Runtime error

## Composition with Other Tools

### Standalone grading
```bash
pincenez checks.yaml output.md > grading.yaml
```

### Eval pipeline (how craboodle uses it)
```bash
# craboodle runs scuttlerun for each scenario, then grades with pincenez
scuttlerun base.yaml scenario-override.yaml > output.yaml
pincenez checks.yaml output.yaml > grading.yaml
```

### CI quality gate
```bash
scuttlerun test-scenario.yaml | pincenez checks.yaml | yq -e '.pass_rate >= 0.8'
```
