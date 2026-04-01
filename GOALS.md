# pincenez — Goals

## Origin

Extracted from the [skillcraft](~/.claude/skills/skillcraft/) eval framework. The skillcraft eval pipeline previously inlined LLM-based grading inside `run-eval.sh` — building prompts, invoking `claude -p`, parsing output envelopes, and writing grading JSON. `pincenez` extracts this into a standalone tool, following the same path as `scuttlerun` (headless session driver) before it.

## Design Philosophy

**UNIX philosophy**: small, does one thing well, composable.

- `scuttlerun` runs a headless Claude session → produces output
- `pincenez` grades a single output against a rubric → produces structured evaluation

Each tool owns one step of the pipeline. They compose via files and stdout.

### Research-Informed Principles

- **Binary assertions over numeric scales.** LLMs are text generators, not calibrated scorers. Binary pass/fail per criterion is dramatically more reliable and reproducible than 1-5 scoring.
- **One assertion per evaluation.** Evaluating assertions independently avoids cross-contamination where earlier verdicts influence later ones. More expensive (N calls), but more reliable.
- **Grading notes boost accuracy.** Short per-assertion hints about what pass/fail looks like significantly improve human-judge alignment.
- **Code-based checks first, LLM only for what code can't verify.** Pincenez is LLM-only by design, but its output schema is composable with deterministic check results (grep, jq, test).
- **Evaluate the evaluator.** Judge reliability must be measured against human labels. The tool should support this workflow.

## Goals

1. **Single-output grading as the primitive.** Pincenez evaluates ONE output against a rubric. A/B comparison is composed on top — grade each output independently, then diff the results downstream. This prevents cross-contamination (the judge can't be biased by seeing both outputs) and maximizes composability.

2. **Own rubric spec.** Pincenez defines its own YAML schema for rubrics, independent of skillcraft's `evals.yaml`. Skillcraft translates its scenarios to pincenez rubrics at runtime — a thin mapping layer.

3. **Useful beyond skillcraft.** Primary audience is skillcraft users, but the tool should be valuable to LLM eval practitioners and Claude Code power users building evaluation workflows.

4. **Replace ~100 lines of inlined grading code** in `run-eval.sh` with a ~3-line `pincenez` call per variant.

5. **Reliable by default.** Independent per-assertion evaluation, structured output extraction, grading notes, and chain-of-thought reasoning — all research-backed techniques for maximizing judge accuracy.

## Non-Goals (for now)

- A/B comparison mode (built on top of single-output grading)
- Blind comparison (was `comparator.md` in skillcraft — may become a `pincenez` mode later)
- Cross-iteration trend analysis (stays in skillcraft)
- Scuttlerun-specific input parsing (pincenez accepts any text; scuttlerun-awareness deferred)
- Replacing the eval orchestrator (craboodle owns pipeline coordination)
- Deterministic/code-based assertion types (use grep, jq, test — pincenez is LLM-only)
- Rubric dimensions / qualitative scoring (too subjective, prone to hallucination)

## Resolved Questions

- **Form factor**: TypeScript CLI (matches scuttlerun). Published via `bin` entry in package.json.
- **Grader prompt**: Built-in default in `prompt.ts`. No shipped file — keeps the tool self-contained.
- **Feature scope**: Assertion linting (`pincenez lint`) implemented for 5 anti-patterns: vague, compound, tautological, always_passes, unverifiable. Discrimination classification stays out of scope.
- **Input format**: Plain text only. Reads any file or stdin. No scuttlerun-specific parsing.
