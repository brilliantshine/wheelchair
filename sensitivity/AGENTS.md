# `sensitivity/` — the diagram-sensitivity block writer

Owned by [the repo root](../AGENTS.md). `set.sh` is the only writer of the two global
files; it renders the delimited region from `protocol/sensitivity.md` into them.

The organizing idea: **one level is resolved across both files before either is written,
so the harnesses cannot disagree.**

| File | Role |
|---|---|
| `set.sh` | Renders, validates, reports, and updates `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` — both files together, or neither |
| `test/run.sh` | Fixture assertions under the system temp directory; gates on exit code |

## Boundaries

- Content between the markers is this repo's and is overwritten. Do not hand-edit it
  expecting the edit to survive; bytes outside the markers are never touched.
- The paired write is all-or-nothing. A refusal is never a repair. What delivers that is the
  preflight, which is what the suite reaches; the rollback after the first rename is a race
  guard for a window the preflight cannot close, and nothing exercises it.
- **The region probes are a regression tripwire, not a conformance test.** `test/run.sh` greps
  the landed region for a phrase per rule, keyed by number to the plan's region-contents list,
  and three further assertions check the paths it names are absolute rather than relative to
  nowhere. That catches the common failure — a rule quietly disappearing from a block nobody
  re-reads. It is not a proof the region is correct, and treating it as one is the way it gets
  trusted for more than it can carry. The authority for what the region must contain is the
  plan, read by a person editing the region.
- **What no grep here can see is a rule qualified rather than removed.** "Ignores this block
  entirely, unless the dial is at `high`" keeps every probed phrase and reverses the meaning.
  The region is thirty-one lines; when you edit it, read it.
- No fixture is ever written inside this repository or at the real global paths.

## Tests

```bash
bash sensitivity/test/run.sh
```
