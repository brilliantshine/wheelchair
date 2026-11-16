---
slug: app-risks
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Close the app's remaining risks

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Scope: smoke suite, live tier check, live permission-prompt check, duplicate-card fix, slow-start test. `projects.json`/D4 and the other 5-second calls are out | MAP.md shows starts already get 60 s with one retry (`viewer/app/sessions.js:74-85`) and the picker scans the projects folder (`viewer/app/routes.js:88-115`) | user (IDEA confirmed) |
| D2 | Duplicate-card fix: on the direct relay path the machine treats a hub 500 like 502/503/504 — it keeps the spool item and tells the agent the card is accepted for later delivery. The drain then redelivers with the same delivery id, which the hub already deduplicates | The duplicate comes only from the agent resending with a new id (`machine/service.js:685-690,1019-1028`); the spool already retries 5xx in order (`:703-735`). No new id scheme needed | defaulted |
| D3 | The slow-start check lives in the smoke suite: a real git origin whose fetch takes longer than 5 s and well under 60 s, and the start must succeed in one request | No fix is expected; the test pins the 60 s behaviour so a regression to 5 s fails | defaulted |
| D4 | The smoke suite is a separate, opt-in command, not part of `machine/test/run.sh`; it skips with a clear message (non-zero exit) when `tmux`, `git` or `claude` is missing | It needs real tools; the existing suites must keep running anywhere | defaulted |
| D5 | The live checks (model tiers, permission prompt) are a rerunnable script on the smoke suite's isolated hub and machine, run by hand, not part of any automated suite | Only form that can be rerun after the next change; leaves live services and Settings alone | user (Q1) |
| D6 | The live script keeps the real `HOME`, so the CLIs use their logged-in default accounts; everything else (hub, machine state, ports, tmux server) stays isolated. Its transcripts land in the CLIs' own folders | A temporary `HOME` has no CLI login (`loginEnv` is empty for the default account, `machine/adapters/*.js`); transcripts are data, not config | defaulted |
| D7 | Tiers checked: light, standard, heavy and critical, each on Claude and on GPT (8 sessions), as pinned by `codex/model.sh` | "One worker per tier" across both families; a one-line prompt keeps the cost to a few turns | defaulted |
| D8 | The permission prompt is forced by an `ask` rule in the test origin's project `.claude/settings.json`, not by hoping `auto` mode prompts | `auto` may approve a harmless command on its own; an `ask` rule prompts every time | defaulted |

## Spec

Three deliverables. Nothing here changes what Collin sees in the app.

### Shared harness

A small Node module, `test-support/smoke/harness.js`, used by both scripts below. It:

1. Makes one run folder (via `test-support/run-dir.js`) holding: the hub's cache root, the
   machine's state folder, a `TMUX_TMPDIR`, and a local bare git origin plus its seed
   commit.
2. Picks two free loopback ports.
3. Starts the real hub: `node viewer/server.js --port <p1> --cache-root <dir>` with
   `WHEELCHAIR_NO_BROWSER=1`. Never on the default port, never the default cache root
   (root `AGENTS.md`, "Never check the viewer by starting a server by hand").
4. Starts the real machine service (`machine/service.js`) with an explicit state folder,
   port `<p2>` on `127.0.0.1`, its own secret, and `hub_url` pointing at the harness hub,
   with `TMUX_TMPDIR` set to the run folder, so every tmux call (including through
   `systemd-run --user --scope`) talks to a private tmux server. Registers that machine
   with the harness hub the same way install does (whatever `install.sh` /
   `machine/AGENTS.md` describe), using the harness's secret.
5. Exposes helpers: call a hub route, run `wc.js` against the harness hub (via
   `WHEELCHAIR_MACHINE_ORIGIN` / the hub URL env that `wc.js` already reads,
   `viewer/app/wc.js:119`), list the private tmux server's sessions, wait for a condition
   with a timeout.
6. On exit (pass, fail or signal): stops every session it started, kills the private tmux
   server (`tmux -L`/`TMUX_TMPDIR` scoped, never the user's default server), stops both
   processes, and lets `run-dir.js` remove the run folder. No `git worktree` or tmux session
   it created survives.

If the hub or service lacks a flag or env var needed for any isolation point above (state
folder, port, host, hub URL, secret path), add it, defaulting to today's behaviour, with a
unit test in that component's existing suite. The live services must never be contacted:
the harness asserts at startup that neither port is 7374 nor the viewer's default port and
that no path it passes is under `~/.local/state/wheelchair`.

### 1. Smoke suite — `bash test-support/smoke/run.sh`

Requires `tmux`, `git` and `claude` on `PATH`; if one is missing it prints which and exits 2
without starting anything (D4). Uses a temporary `HOME` (no model turn, so no login needed).
Runs no model turn. Checks, each a named pass/fail line, exit 0 only if all pass:

1. **Readiness:** the hub's view of the machine reports Claude installed with the same
   version string `claude --version` prints directly (`machine/service.js:893-896`).
2. **Start:** a `wc.js session start` for a worker on the harness thread creates a
   worktree from the bare origin on a `wc/` branch and a live tmux session on the private
   server, and the hub lists the session. The CLI launched is the real `claude`; it may sit
   at its login screen, which is fine — the check is that tmux and the worktree exist.
3. **Slow start (D3):** the origin is reached through git's `ext::` transport (with
   `protocol.ext.allow=always` set only in the harness's git config) wrapping
   `git-upload-pack` behind an 8-second sleep. The start succeeds in one request, takes
   longer than 5 s, and the hub's start route returns 200, not 503.
4. **Stop:** `wc.js session stop` removes the tmux session and the hub stops listing it.
5. **Clean:** after teardown, the private tmux server is gone and the run folder is
   removed.

"Fails before it": check 3 would fail against a hub that used the 5-second default for
starts. Demonstrate once by temporarily setting the start timeout to 5000 and recording the
failing output in the build report; do not commit that change.

### 2. Live checks — `bash test-support/smoke/live.sh`

Same harness, but with the real `HOME` (D6). Costs real model turns; never run by any
other suite. Exit 0 only if every check passes; prints a table.

**Model tiers (D7).** For each tier in light, standard, heavy, critical and each provider
in claude, gpt: start a worker with `--tier <tier> --provider <p>` and the brief "Reply with
the single word ok and stop." Wait for its turn to end (the hub's session status), then
read the model the CLI actually used from its own transcript — Claude: the `model` field of
the assistant message in the session's JSONL under `~/.claude/projects/`, found by its
`cli_session_id`; Codex: the model in the rollout file for its thread id. Compare with the
pin `codex/model.sh <provider> <tier>` returns. A provider whose CLI is not logged in is
reported `skipped (not logged in)` and fails the run. Stop each session afterwards.

**Permission prompt (D8).** The harness origin's seed commit includes
`.claude/settings.json` with `{"permissions":{"ask":["Bash(touch:*)"]}}`. With the harness
hub's Settings `permission_mode` set to `auto` (harness hub only), start a Claude worker
whose brief is "Run the shell command `touch smoke-ok` and then stop." Check, in order:

1. the hub marks the session `permission_open` and its thread gains an open system
   `needs` card for the permission prompt;
2. the script answers by sending the approve keys to the pane on the private tmux server;
3. within 30 s the hub clears `permission_open` and the card is marked answered;
4. `smoke-ok` exists in the worktree.

Record a run's output in the build's report; that is the "seen on a live run" evidence.

### 3. Duplicate cards (D2)

In `machine/service.js` (`/v1/agent/cards`, around `:1016-1030`), a hub answer of 500 on
the direct relay is treated like 502/503/504: the spool item stays, the agent gets
`202 { ok: true, spooled: true }`, and the periodic drain redelivers it with the same
delivery id. 4xx handling is unchanged (rejected, reported to the agent). The drain already
keeps 5xx items in order (`:703-735`), and the hub already drops a repeated delivery id
(`viewer/app/cards.js:38-46`).

Test in `machine/test/service.test.js`: a fake hub that stores the card and answers 500 on
its first delivery, 200 after. `card.js` exits 0 reporting it queued; after one drain the
fake hub has stored the card once and has seen the same delivery id twice. Run the test
against the code before the fix and record that it fails (agent gets 500).

### Docs

- Root `AGENTS.md` Verification: add both commands, each marked "hearth only"; the live one
  "costs model turns". Add `test-support/smoke/` to the `test-support/` row.
- `docs/proposals/app-followups/proposal.md` "Risks to close": mark each item closed or out
  of scope, pointing at this plan.

### Non-goals

`projects.json` and the picker (D1); other 5-second hub calls (D1); any change to the
app's screens; running either script in CI or from `install.sh`.

### Validation

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
node --test test-support/test/*.test.js
bash test-support/smoke/run.sh        # on hearth
bash test-support/smoke/live.sh       # on hearth, costs model turns
```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-15

**Lanes:** pending; cross-family: pending.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
