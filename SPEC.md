# judge — Specification

## Synopsis

```
judge [options] <rubric.yml> [output]
```

Grade a single output against a rubric using an LLM judge. Returns structured evaluation JSON.

## Core Operation

```
judge <rubric> <output> → grading JSON (stdout)
```

The fundamental primitive: one rubric, one output, one evaluation. Everything else composes on top.

## Rubric Schema

The rubric is a YAML file defining what to evaluate. Both `assertions` and `rubric` sections are optional — use either or both.

```yaml
# --- Context (optional) ---
# What task produced this output. Helps the judge understand intent
# without being prescriptive about what "good" looks like.
context: |
  The agent was asked to write a haiku about the ocean
  and save it to ocean.txt

# --- Assertions (optional) ---
# Binary checks: pass or fail, with evidence.
# Phrased as objective, verifiable statements.
assertions:
  - id: file-created                                    # optional (auto-generated from index)
    check: "A file named ocean.txt was created or written to"
  - id: three-lines
    check: "The output contains exactly 3 lines of poetry"
  - id: syllable-pattern
    check: "Lines follow a 5-7-5 syllable pattern"

```

### Rubric Design Principles

- **Assertions** should be objectively verifiable — the judge can determine pass/fail unambiguously from the output
- **Context** tells the judge what the task was, not what the answer should be
- `id` fields are optional; auto-generated as `assertion-0`, `assertion-1`, etc. if omitted

## Output Schema

Judge writes grading JSON to stdout (or `--output` file):

```json
{
  "assertions": [
    {
      "id": "file-created",
      "check": "A file named ocean.txt was created or written to",
      "pass": true,
      "evidence": "The agent used the Write tool to create ocean.txt with haiku content"
    },
    {
      "id": "syllable-pattern",
      "check": "Lines follow a 5-7-5 syllable pattern",
      "pass": false,
      "evidence": "Line 2 has 8 syllables: 'the waves are crashing on the shore'"
    }
  ],
  "summary": "Haiku written to correct file with creative content but syllable count error on line 2."
}
```

### Output Schema Notes

- `assertions` array present only if rubric defines assertions
- `pass_rate` is `assertions_passed / assertions_total` (omitted if no assertions)
- `summary` is always present — one-sentence overall assessment
- `evidence` and `reasoning` fields provide the judge's justification

## CLI Interface

```
Usage: judge [options] <rubric.yml> [output]

Grade an output against a rubric using an LLM judge.

Arguments:
  rubric.yml          Rubric file defining assertions and/or dimensions
  output              File or directory for the LLM to read and evaluate
                      If omitted, reads from stdin (written to temp file)

Options:
  --model <model>     Judge model (default: claude-haiku-4-5)
  --output <file>     Write grading JSON to file (default: stdout)
  --context <text>    Override or supplement the rubric's context field
  --verbose           Include full judge reasoning chain in output
  -h, --help          Show help
```

## Execution Model

1. Judge reads the rubric YAML
2. Judge builds a grader prompt combining:
   - Built-in grader instructions
   - Context, assertions from the rubric file
   - Path to the output file (or temp file if stdin)
3. Judge invokes `claude -p "$prompt" --allowedTools Read --output-format json --model $model` (or uses the SDK)
4. The LLM reads the output file via the Read tool, evaluates against the rubric
5. The LLM returns grading JSON as its text response
6. Judge extracts the JSON from Claude's response envelope
7. Judge writes the grading JSON to stdout or `--output` file

Key: the LLM gets **Read-only** tool access. Judge handles all output routing.

## Usage Examples

```bash
# Grade a file against a rubric
judge rubric.yml output.md

# Grade and save to file
judge rubric.yml output.md --output grading.json

# Pipe from warren
warren run session.yml | judge rubric.yml

# Use a stronger model for nuanced rubric scoring
judge rubric.yml output.md --model claude-sonnet-4-6

# Inline context supplement
judge rubric.yml output.md --context "This was a timed exercise with a 30-second limit"
```

## Composition with Other Tools

### Standalone grading
```bash
judge rubric.yml output.md > grading.json
```

### Paired evaluation (how skillcraft uses it)
```bash
# Run both variants
warren run with-skill.yml    | tee with_skill/output.md
warren run without-skill.yml | tee without_skill/output.md

# Grade each independently
judge rubric.yml with_skill/output.md    --output with_skill/grading.json
judge rubric.yml without_skill/output.md --output without_skill/grading.json

```

### CI quality gate
```bash
warren run test-scenario.yml | judge rubric.yml | jq '.pass_rate >= 0.8'
```

## Impact on Skillcraft

| Current (inlined in run-eval.sh) | After extraction |
|---|---|
| `run-eval.sh` builds ~30-line grading prompt | `run-eval.sh` generates `rubric.yml` per scenario from `evals.yml` |
| Embeds `grader.md` instructions in prompt | `judge` has built-in grader prompt |
| Invokes `claude -p` with `--allowedTools Read,Write` | Invokes `judge rubric.yml output.md` |
| Extracts JSON from Claude's envelope (`extract_claude_text`) | `judge` handles extraction, outputs clean JSON |
| `grading.json` schema coupled to `grader.md` | `grading.json` schema is `judge`'s published contract |
| ~100 lines of `run_grader()` function | ~3-line `judge` call per variant |
| Discrimination computed during grading (LLM sees both) | Discrimination computed downstream from paired gradings (pure data) |
