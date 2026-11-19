# `codex/` — the GPT model pins and the Codex login

Owned by [the repo root](../AGENTS.md). This directory holds the scripts that keep the GPT
model pins and the Codex login in order for the Codex sessions the app starts.

The organizing idea: **one script owns each piece of GPT state outside this repo.**
`model.sh` is the only reader and writer of the local model pins, and `preflight.sh` is the
only thing that spends the Codex refresh token. A second writer to either is how a pin file
gets clobbered or a credential gets voided.

| File | Role |
|---|---|
| `model.sh` | Reads and writes the local Claude, GPT, Gemini and Kimi model cells, including the lead, sub-lead and Not used cells. `set`, `skip`, `init` and `reset` render the shared models file; `check` reports newer GPT models and `show --json` is the hub's view of the file. A malformed file falls back to shipped defaults for reads and is left alone except by `reset` |
| `preflight.sh` | Run before the first GPT dispatch and before any parallel fan-out. Under a lock, refreshes the Codex access token if it will not outlive the sessions about to run. Its exit code says whether to fan out, sequence the sessions, or reauthenticate |

## Boundaries

- **Nothing else refreshes the token.** The
  refresh token is single-use and `codex exec` takes no lock on `auth.json`, so the
  one-process, one-spend lock in `preflight.sh` is what makes parallel sessions safe.
- **No fixture touches a real home.** `test/run.sh` builds its own pins file and Codex home
  under the system temp directory, through the path seams `model.sh` reads from the
  environment.

## Children without a router

| Directory | What it holds |
|---|---|
| `test/` | `run.sh`, the fixture suite for `model.sh` and `preflight.sh` |

## Tests

```bash
bash codex/test/run.sh
```
