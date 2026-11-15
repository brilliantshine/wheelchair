# `codex/` — the Codex CLI adapter and the GPT lane's scripts

Owned by [the repo root](../AGENTS.md). Two jobs share this directory: the wrappers that
register commands with the Codex CLI, and the two scripts a GPT worker lane runs before and
while it works.

The organizing idea: **one script owns each piece of GPT-lane state outside this repo.**
`model.sh` is the only reader and writer of the local model pins, and `preflight.sh` is the
only thing that spends the Codex refresh token. A second writer to either is how a pin file
gets clobbered or a credential gets voided.

| File | Role |
|---|---|
| `model.sh` | Reads and writes the local Claude and GPT model cells, including the lead and Not used cells. `set`, `skip`, `init` and `reset` render the shared models file; `check` reports newer GPT models and `show --json` is the hub's view of the file. A malformed file falls back to shipped defaults for reads and is left alone except by `reset` |
| `preflight.sh` | Run before the first GPT dispatch and before any parallel fan-out. Under a lock, refreshes the Codex access token if it will not outlive the lanes about to run. Its exit code says whether to fan out, sequence the lanes, or reauthenticate |

## Boundaries

- **A prompt is a pointer, not a document.** Each file in `prompts/` names one `protocol/`
  file and says what the argument is, the same convention `skills/` follows and states.
  A rule copied into a prompt gives the two harnesses different instructions.
- **Nothing else refreshes the token.** The
  refresh token is single-use and `codex exec` takes no lock on `auth.json`, so the
  one-process, one-spend lock in `preflight.sh` is what makes parallel lanes safe.
- **No fixture touches a real home.** `test/run.sh` builds its own pins file and Codex home
  under the system temp directory, through the path seams `model.sh` reads from the
  environment.
- Adding a command means adding a file in `prompts/` *and* a directory in `skills/`.
  `install.sh` globs both.

## Children without a router

| Directory | What it holds |
|---|---|
| `prompts/` | One wrapper per command, same convention and same commands as `skills/` |
| `test/` | `run.sh`, the fixture suite for `model.sh` and `preflight.sh` |

## Tests

```bash
bash codex/test/run.sh
```
