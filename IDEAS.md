# Ideas

Candidate future directions — under consideration, not commitments.
[GOALS.md](GOALS.md) describes what is built and why; this file holds what
might come next. Entries come from a hand-driven probe of Claude Code hooks
and dialogs on 2026-11-04 and the fabrica eval suite written the same day;
scuttlerun's IDEAS.md holds the transcript changes these pair with. Not
ordered by priority.

- **Honour the transcript's own contract instead of mirroring it.** The grader
  and lint prompts embed a hand-maintained copy of scuttlerun's transcript
  field contract plus hard-coded claims that hooks and slash commands never
  appear; every new entry kind in scuttlerun (hook events, permission
  decisions, tool results, plan approval) costs an edit here in lockstep, and
  the claim about hooks is about to become false. Shape: when the output
  carries its own `legend:` section (scuttlerun will write one from a single
  pinned table), the prompts say only to honour it, and the mirror and the
  hook and slash prose go; the plain-text non-goal holds, since the judge
  reads the legend as text. Lint run standalone without craboodle loses the
  contract unless given it, so it keeps a weaker generic fallback. Lands when
  scuttlerun emits the legend.
- **State the judge's file-reading channel.** The ReadOnlyAccess invariant
  already lets the judge read the output and the files it references, the
  grader grants the output's directory, and the prompt says so; but `--help`
  says nothing about reading files or how to name evidence, no test pins
  `tools: ['Read']` or the permission mode, and the invariant covers files
  the output references, not paths a check note names. A fabrica check
  pointed at a hook log outside the output directory and the judge read it,
  through bypassPermissions rather than the directory grant — a hardened
  grader would silently lose that. Shape: phrase the guarantee by capability
  (the judge may read the output's directory and any absolute path the output
  or a check note names), pin tools and permission mode in a test, and
  document in `--help` how to name evidence; craboodle's help then says a
  note may point under the transcript's `project:` directory. Temp paths are
  unknowable at authoring time, so the convention leans on that key, which is
  scuttlerun knowledge living in a note; acceptable while pincenez stays
  text-only.

## Decided against

- **A probe artifact layout graded by pincenez** (2026-11-04). A fixed
  `steps/NN/{sent,screen}` layout plus an index file so TUI-only facts
  (dialog rendering, option order, the `!` prompt) could be graded outside
  craboodle. Rejected: pincenez already accepts any text, so no contract was
  ever needed; rendering facts are exact assertions better served by scrut
  interactive ASSERT or grep than by an LLM judge; the per-version re-run is a
  scrut document (see scuttlerun's IDEAS.md). Only the per-step artifact
  layout survives, as a helper of the tmux driver's screen verb.
