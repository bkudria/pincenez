# judge — Specification

## Synopsis

```
judge [options] <rubric.yml> [output]
```

Grade a single output against a rubric using an LLM judge. Returns structured evaluation YAML.

## Core Operation

```
judge <rubric> <output> → grading YAML (stdout)
```

The fundamental primitive: one rubric, one output, one evaluation. Everything else composes on top.

## Rubric Schema

The rubric is a YAML file defining what to evaluate.

```yaml
# --- Context (optional) ---
# What task produced this output. Helps the judge understand intent
# without being prescriptive about what "good" looks like.
context: |
  The agent was asked to write a haiku about the ocean
  and save it to ocean.txt

# --- Assertions ---
# Binary checks: pass or fail, with evidence.
# Each assertion is evaluated by an independent LLM call.
assertions:
  - id: file-created                                    # optional (auto-generated from index)
    check: "A file named ocean.txt was created or written to"
    note: "Look for Write tool usage targeting ocean.txt"  # optional grading hint
  - id: three-lines
    check: "The output contains exactly 3 lines of poetry"
  - id: syllable-pattern
    check: "Lines follow a 5-7-5 syllable pattern"
    note: "Count syllables carefully; common errors include diphthongs and silent vowels"
    model: claude-sonnet-4-6                             # optional per-assertion model override
```

### Rubric Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `context` | No | What task produced this output. Orients the judge without prescribing the answer. |
| `assertions` | Yes | List of binary checks to evaluate. |
| `assertions[].id` | No | Unique identifier. Auto-generated as `assertion-0`, etc. if omitted. |
| `assertions[].check` | Yes | The statement to evaluate. Phrased as an objective, verifiable claim. |
| `assertions[].note` | No | Grading hint — what pass/fail looks like for this assertion. Short, specific guidance that helps the judge evaluate accurately. Research shows these improve human-judge alignment from ~70-80% to 93-96%. |
| `assertions[].model` | No | Model override for this assertion. Overrides `--model` and the global default. Use a stronger model for nuanced assertions that need more reasoning. |

### Rubric Design Principles

- **Assertions** should be objectively verifiable — the judge can determine pass/fail unambiguously from the output
- **Context** tells the judge what the task was, not what the answer should be
- **Notes** are hints for the judge, not definitions of correctness — they help with edge cases and ambiguity
- Each assertion is evaluated **independently** by a separate LLM call, so assertions need not be ordered or depend on each other

## Output Schema

Judge writes grading YAML to stdout:

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

### Output Schema Notes

- `assertions` array mirrors the rubric's assertion list, in the same order
- Each assertion has `id`, `check` (echoed from rubric), `pass` (boolean), and `evidence` (judge's reasoning)
- `pass_rate` is `assertions_passed / assertions_total`
- No summary field — the assertions speak for themselves
- Exit code 0 means judge ran successfully, regardless of assertion results. Parse output for pass/fail.
- YAML output is consistent with YAML input (rubric) — same format throughout the pipeline

## CLI Interface

```
Usage: judge [options] <rubric.yml> [output]

Grade an output against a rubric using an LLM judge.

Arguments:
  rubric.yml          Rubric file defining assertions to evaluate
  output              File or directory for the LLM to read and evaluate
                      If omitted, reads from stdin (written to temp file)

Options:
  --model <model>     Judge model (default: claude-haiku-4-5)
  --context <text>    Override or supplement the rubric's context field
  --verbose           Include full judge reasoning chain in output
  -h, --help          Show help
```

## Execution Model

1. Judge reads the rubric YAML and parses assertions
2. If output is stdin, writes it to a temp file
3. **For each assertion (in parallel):**
   a. Builds a grader prompt combining:
      - Built-in grader instructions (chain-of-thought, then verdict)
      - The assertion's `check` and `note` fields
      - Context from the rubric (and/or `--context` override)
      - Path to the output file
   b. Invokes the LLM with **Read** tool access and **structured output** (function calling / JSON schema) to enforce the response shape: `{ pass: boolean, evidence: string }`
   c. The LLM reads the output file, reasons about the assertion, returns its verdict
4. Judge collects all assertion results
5. Computes `pass_rate`
6. Assembles and writes the grading YAML to stdout

### Key Design Decisions

- **One LLM call per assertion.** Each assertion is evaluated independently to avoid cross-contamination. Earlier verdicts cannot influence later ones.
- **Parallel by default.** All assertion evaluations run concurrently. N assertions = N parallel LLM calls.
- **LLM gets Read-only tool access.** The LLM reads the output file (or directory) to evaluate each assertion. Judge handles all output writing.
- **Structured output.** Results are extracted via function calling / JSON schema, not free-text parsing. Each call returns `{ pass: boolean, evidence: string }`.
- **Exit code = operational success.** Exit 0 if judge ran successfully. Exit non-zero only for errors (bad rubric, API failure, etc.). Assertion failures are data, not errors.
- **Default model: claude-haiku-4-5.** Cheapest and fastest. Adequate for most binary assertion checks. Use `--model` globally or `model` per-assertion for stronger models on nuanced assertions.

## Usage Examples

```bash
# Grade a file against a rubric
judge rubric.yml output.md

# Grade and save to file
judge rubric.yml output.md > grading.yml

# Pipe from warren
warren run session.yml | judge rubric.yml

# Use a stronger model for all assertions
judge rubric.yml output.md --model claude-sonnet-4-6

# Or set model per-assertion in the rubric (overrides --model)

# Inline context supplement
judge rubric.yml output.md --context "This was a timed exercise with a 30-second limit"

# CI: check pass rate with yq
judge rubric.yml output.md | yq -e '.pass_rate == 1.0'
```

## Composition with Other Tools

### Standalone grading
```bash
judge rubric.yml output.md > grading.yml
```

### Paired evaluation (how skillcraft uses it)
```bash
# Run both variants
warren run with-skill.yml > with_skill/output.md
warren run without-skill.yml > without_skill/output.md

# Grade each independently (same rubric, different outputs)
judge rubric.yml with_skill/output.md    > with_skill/grading.yml
judge rubric.yml without_skill/output.md > without_skill/grading.yml

# Compute discrimination downstream (pure data, no LLM needed):
# "assertion X passed for with_skill but failed for without_skill"
```

### CI quality gate
```bash
warren run test-scenario.yml | judge rubric.yml | yq -e '.pass_rate >= 0.8'
```

## Impact on Skillcraft

| Current (inlined in run-eval.sh) | After extraction |
|---|---|
| `run-eval.sh` builds ~30-line grading prompt | `run-eval.sh` generates `rubric.yml` per scenario from `evals.yml` |
| Embeds `grader.md` instructions in prompt | `judge` has built-in grader prompt |
| Invokes `claude -p` with `--allowedTools Read,Write` | Invokes `judge rubric.yml output.md` |
| Extracts JSON from Claude's envelope (`extract_claude_text`) | `judge` handles extraction, outputs clean YAML |
| `grading.json` schema coupled to `grader.md` | Grading schema is `judge`'s published contract |
| ~100 lines of `run_grader()` function | ~3-line `judge` call per variant |
| All assertions in one LLM call (cross-contamination risk) | One LLM call per assertion (independent, parallel) |
| Discrimination computed during grading (LLM sees both) | Discrimination computed downstream from paired gradings (pure data) |
