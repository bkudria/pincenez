# Ideas

Candidate future directions — under consideration, not commitments.
[GOALS.md](GOALS.md) describes what is built and why; this file holds what
might come next. Entries come from a hand-driven probe of Claude Code hooks
and dialogs on 2026-11-04 and the fabrica eval suite written the same day;
scuttlerun's IDEAS.md holds the transcript changes these pair with. Not
ordered by priority.

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
  text-only. Narrower since scuttlerun 0.5.0: a hook's stdout and stderr are
  now `hook:` transcript entries, so craboodle's hook example no longer
  routes evidence through a file. Narrower again since scuttlerun 0.6.0:
  every Bash call's output, and any call's error, is a `result:` entry, so
  the judge no longer needs the session log to see what a command printed.
  Hook input (the JSON a hook receives) and files a hook writes still need
  this channel.
- **Build before `npm publish`.** The release workflow's publish job runs
  `npm publish` right after `npm ci`, so `dist/` exists only once
  `prepublishOnly` builds it. npm checks `bin` before that script runs: the
  0.3.0 publish logged "No bin file found at dist/cli.js" and that
  `bin[pincenez]` "was invalid and removed". The published tarball kept `bin`
  and an executable `dist/cli.js` (checked by downloading it), so the warning
  is noise today, but it would hide a real loss of the command if npm began
  enforcing it. Shape: an `npm run build` step before `npm publish` in
  `release-please.yml`.

## Decided against

- **A probe artifact layout graded by pincenez** (2026-11-04). A fixed
  `steps/NN/{sent,screen}` layout plus an index file so TUI-only facts
  (dialog rendering, option order, the `!` prompt) could be graded outside
  craboodle. Rejected: pincenez already accepts any text, so no contract was
  ever needed; rendering facts are exact assertions better served by scrut
  interactive ASSERT or grep than by an LLM judge; the per-version re-run is a
  scrut document (see scuttlerun's IDEAS.md). Only the per-step artifact
  layout survives, as a helper of the tmux driver's screen verb.
