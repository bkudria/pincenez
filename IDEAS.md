# Ideas

Candidate future directions — under consideration, not commitments.
[GOALS.md](GOALS.md) describes what is built and why; this file holds what
might come next. Entries come from a hand-driven probe of Claude Code hooks
and dialogs on 2026-11-04 and the fabrica eval suite written the same day;
scuttlerun's IDEAS.md holds the transcript changes these pair with. Not
ordered by priority.

## Decided against

- **A probe artifact layout graded by pincenez** (2026-11-04). A fixed
  `steps/NN/{sent,screen}` layout plus an index file so TUI-only facts
  (dialog rendering, option order, the `!` prompt) could be graded outside
  craboodle. Rejected: pincenez already accepts any text, so no contract was
  ever needed; rendering facts are exact assertions better served by scrut
  interactive ASSERT or grep than by an LLM judge; the per-version re-run is a
  scrut document (see scuttlerun's IDEAS.md). Only the per-step artifact
  layout survives, as a helper of the tmux driver's screen verb.
