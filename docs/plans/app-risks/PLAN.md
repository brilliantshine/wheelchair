---
slug: app-risks
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Close the app's remaining risks

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

### Q1: How are the two live checks (model tiers, permission prompt) run?
- **Context:** Both need real model turns, which the smoke suite avoids. Sessions run in
  `bypass` permission mode today (`viewer/app/settings.js:188`), and a permission prompt
  only appears in `auto` mode (`machine/adapters/claude.js:22`). The app records the model
  it asked for (`viewer/app/sessions.js:190`); what the CLI actually ran is only in the
  CLI's own transcript.
- **Options:**
  - **A script on the smoke suite's isolated hub and machine.** One command starts one
    session per tier and provider with a one-line prompt, reads each transcript for the
    model it ran, then starts one `auto`-mode Claude session that triggers a permission
    prompt, answers it, and checks the app's card clears. Rerunnable; costs a few model
    turns each run; uses the real logged-in CLI accounts.
  - **By hand in this thread's own build.** The sub-lead spreads workers across tiers and
    the verifier reads their transcripts; Collin flips Settings to `auto` for one session
    and answers a prompt. Nothing reusable left behind.
- **Recommendation:** the script. It is the only form that can be run again after the
  next change, and it leaves live services and Settings alone.

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

## Spec

Draft; grows as decisions land.

### Smoke suite

- One command runs a real hub (`viewer/server.js` with `--port` and `--cache-root`, per
  root `AGENTS.md`) and a real machine service with its own state folder, secret, free
  loopback port and a temporary `HOME`, so nothing reads or writes the live services'
  ports, `~/.local/state/wheelchair`, `~/.claude` or `~/.codex` (defaults at
  `machine/service.js:26,144,252`, `machine/adapters/*.js:5`).
- Real `tmux` on a private socket, real `git` with a local bare origin, real
  `claude --version` through the machine's readiness check (`machine/service.js:893-896`).
- No model turn.
- Checks: readiness reports Claude installed with a version; a session start creates a
  worktree from the origin and a live tmux session; stop removes it; a start whose fetch
  is slow (D3) succeeds; afterwards no process, socket or temp folder is left behind.

### Duplicate cards

Per D2. Test: a fake hub that stores the card and answers 500 once; the agent's
`card.js` reports accepted; after the drain the hub holds exactly one card. Before the fix
the test fails (agent sees 500, resends, two cards).

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
