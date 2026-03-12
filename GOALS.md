# judge — Goals

## Origin

Extracted from the [skillcraft](~/.claude/skills/skillcraft/) eval framework. The skillcraft eval pipeline previously inlined LLM-based grading inside `run-eval.sh` — building prompts, invoking `claude -p`, parsing output envelopes, and writing grading JSON. `judge` extracts this into a standalone tool, following the same path as `warren` (headless session driver) before it.

## Design Philosophy

**UNIX philosophy**: small, does one thing well, composable.

- `warren` runs a headless Claude session → produces output
- `judge` grades a single output against a rubric → produces structured evaluation

Each tool owns one step of the pipeline. They compose via files and stdout.

### Research-Informed Principles

- **Binary assertions over numeric scales.** LLMs are text generators, not calibrated scorers. Binary pass/fail per criterion is dramatically more reliable and reproducible than 1-5 scoring.
- **One assertion per evaluation.** Evaluating assertions independently avoids cross-contamination where earlier verdicts influence later ones. More expensive (N calls), but more reliable.
- **Grading notes boost accuracy.** Short per-assertion hints about what pass/fail looks like significantly improve human-judge alignment.
- **Code-based checks first, LLM only for what code can't verify.** Judge is LLM-only by design, but its output schema is composable with deterministic check results (grep, jq, test).
- **Evaluate the evaluator.** Judge reliability must be measured against human labels. The tool should support this workflow.

## Goals

1. **Single-output grading as the primitive.** Judge evaluates ONE output against a rubric. A/B comparison is composed on top — grade each output independently, then diff the results downstream. This prevents cross-contamination (judge can't be biased by seeing both outputs) and maximizes composability.

2. **Own rubric spec.** Judge defines its own YAML schema for rubrics, independent of skillcraft's `evals.yml`. Skillcraft translates its scenarios to judge rubrics at runtime — a thin mapping layer.

3. **Useful beyond skillcraft.** Primary audience is skillcraft users, but the tool should be valuable to LLM eval practitioners and Claude Code power users building evaluation workflows.

4. **Replace ~100 lines of inlined grading code** in `run-eval.sh` with a ~3-line `judge` call per variant.

5. **Reliable by default.** Independent per-assertion evaluation, structured output extraction, grading notes, and chain-of-thought reasoning — all research-backed techniques for maximizing judge accuracy.

## Non-Goals (for now)

- A/B comparison mode (built on top of single-output grading)
- Blind comparison (was `comparator.md` in skillcraft — may become a `judge` mode later)
- Cross-iteration trend analysis (stays in skillcraft)
- Warren-specific input parsing (judge accepts any text; warren-awareness deferred)
- Replacing the full eval orchestrator (`run-eval.sh` remains the pipeline coordinator)
- Deterministic/code-based assertion types (use grep, jq, test — judge is LLM-only)
- Rubric dimensions / qualitative scoring (too subjective, prone to hallucination)

## Open Questions

- **Form factor**: Shell script? Node.js CLI (like warren)? TBD.
- **Grader prompt**: Built-in default vs shipped file vs both? Deferred.
- **Feature scope**: Should discrimination classification, claims extraction, meta-evaluation of assertions be part of judge or stay in skillcraft? Deferred.
- **Input format**: Warren-aware parsing vs plain text only? Deferred.
