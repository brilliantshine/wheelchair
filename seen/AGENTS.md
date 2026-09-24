# `seen/` — the seen record and wording-list scripts

Owned by [the repo root](../AGENTS.md). Rules live in `protocol/seen.md`; nothing here
carries its own copy of them.

The organizing idea: **the hook never reads inside a repository, and only one script ever
writes the wording list.**

| File | Role |
|---|---|
| `hook.sh` | The one `UserPromptSubmit` hook both harnesses call. Reads a few small files, runs no model and no git, never reads anything inside a repository |
| `wording.sh` | The only writer of `~/.wheelchair/wording.md` — `suggest`, `confirm`, `strike`, `remove` |
| `set.sh` | The installer's writer of both harnesses' hook entry and write grants for `wording.sh`. Never touches any other hook |
| `test/run.sh` | Runs the suites below; exit-code gated |
| `test/hook_test.sh` | Fixture assertions for `hook.sh` |
| `test/wording_test.sh` | Fixture assertions for `wording.sh` |
| `test/set_test.sh` | Fixture assertions for `set.sh` |

## Boundaries

- **The hook never reads inside a repository.** A user-level hook fires in every repository
  it is pointed at, trusted or not — reading anything there would let a hostile clone
  inject text into every turn.
- **`set.sh` edits files the user owns and refuses rather than repairs them.** A malformed
  target is reported and left untouched, the same contract `sensitivity/set.sh` uses for
  the diagram-sensitivity dial.
- **No fixture ever touches a real home.** `test/*.sh` build their own `HOME` and cache
  root under the system temp directory; the real `~/.claude`, `~/.codex`, and
  `~/.wheelchair` stay untouched.

## Tests

```bash
bash seen/test/run.sh
```
