---
slug: account-switchover
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Switch accounts when one hits its limit

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

**Map:** `MAP.md` and `docs/maps/account-switchover-runtime.md`.

## Open Questions

(None.)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part. | Chosen on the mode card. | user |
| 2 | The new account is picked by the existing placement rules (`viewer/app/balancer.js`), limited to the same provider and excluding the limited account. | Reuses the existing usage, reserve and sign-in checks; IDEA.md rules out crossing providers. | defaulted |
| 3 | Switching applies to every role the hub starts (lead, sub-lead, worker, reviewer, verifier, mapper). | IDEA.md "What good looks like". | defaulted |
| 4 | With no other account of that provider having room, today's hold-until-reset then `Continue.` is kept unchanged. | IDEA.md fallback. | defaulted |
| 5 | The switched session keeps its session name and role, so cards, messages and the starter relationship carry on. | Other sessions address it by name; renaming would break messages in flight. | defaulted |
| 6 | A switched agent resumes its same conversation on the new account; if resume fails for that CLI, it restarts fresh with its original brief and a pointer to the old transcript. | Picked on Q1: resuming keeps the agent's working memory. | user |
| 7 | The fresh-restart fallback reuses today's restart paths: a lead gets the `[wc:context restart]` context, a worker `--replaces`, a sub-lead resumes from PLAN.md and `reports/`, reviewers, verifiers and mappers start fresh with their original brief. | These paths already exist and are tested. | defaulted |
| 8 | A switch happens only when a limit is actually hit, never ahead of it. | IDEA.md Not doing: no spreading work ahead of time. | defaulted |
| 9 | A switch is shown only on the agent's details on the Agents screen (the account it is on now, and which account it moved from); nothing is posted in the thread. | Picked on Q2. | user |
| 10 | Only the `claude` and `gpt` (Codex) providers switch; gemini, kimi and openrouter keep today's behaviour. | IDEA.md names Claude and Codex. | defaulted |
| 11 | A switched session that hits a limit again on its new account switches again by the same rule; the accounts it has already hit limits on are excluded until their limit resets. | Same rule each time; no special casing. | defaulted |

## Spec

### Scope

A live session on the `claude` or `gpt` provider whose account hits its usage limit moves
to another signed-in account of the same provider and carries on, with no action from
Collin. Every role the hub starts is covered (lead, sub-lead, worker, reviewer, verifier,
mapper). Other providers, and every non-limit failure, behave as today.

Today, for reference: a limit-hit event makes the hub record the limit and hold delivery;
at reset it queues `Continue.` to the same session on the same account
(`viewer/app/sessions.js:593-608`, `:886-893`). That path stays as the fallback.

### 1. Noticing the limit

- Claude: the existing StopFailure `rate_limit` classification
  (`machine/adapters/claude.js:94-96`).
- Codex: the existing reached-limit reading from transcript usage at turn end
  (`machine/adapters/codex.js:149-151`, `machine/service.js:1519-1543`).
- Both already arrive at the hub as a limit-hit event for the session. This plan adds no
  new detection; it changes what the hub does with the event.

### 2. Choosing the new account

On a limit-hit event for a live `claude` or `gpt` session, the hub runs the existing
placement (`viewer/app/balancer.js:42-118`, usage and reserves from `viewer/app/usage.js`)
for that session's role, restricted to the session's provider and machine, excluding the
limited account and any account with a recorded limit not yet reset. For `gpt`, the chosen
account must pass `codex/preflight.sh` as in `viewer/app/sessions.js:292-314` (a failure
marks it unavailable and reselects once).

- No account found: keep today's hold-until-reset and `Continue.`, unchanged.
- Found: switch (section 3).

### 3. Switching

1. Stop the session's CLI in its tmux session (the tmux session, worktree, session name,
   role, starter, attempt id and session token stay).
2. Copy the CLI's conversation file from the old account directory into the new one, at
   the path that CLI expects:
   - Claude: `<config dir>/projects/<project key>/<session-id>.jsonl` (the adapter already
     locates it, `machine/adapters/claude.js:86`).
   - Codex: the rollout file under `<CODEX_HOME>/sessions/` for the bound thread id
     (`machine/adapters/codex.js:114-125`, `:149`).
   The default account's directory is the CLI's own default (`~/.claude`, `~/.codex`);
   others are `~/.wheelchair/accounts/<id>`. Copy, never move: the old file stays.
3. Relaunch the CLI in the same tmux session with the new account's environment
   (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`, none for a default account) and resume:
   Claude `--resume <session-id>`; Codex `resume <thread-id>`. Same model, effort and
   permission settings as the original launch.
4. When the session is ready, type into it: `[wc:from app] Your account hit its usage
   limit, so this conversation was moved to another account. Carry on from where you
   stopped.` Then deliver any messages the hub was holding for it.
5. Record on the session: `account` = new account id, and append
   `{from, to, at}` to a `switches` list. Usage readings and `recordChosen` are updated for
   the new account as for a normal start.
6. The machine keeps transcript copying working across the switch: the machine copy for
   the session continues (Claude's session id is unchanged; Codex's thread id is unchanged
   on resume), so chat, reports and the reviewer/verifier "last assistant message" still
   read from one place.

### 4. When resume fails

Resume fails if the CLI exits, refuses the conversation, or the session does not become
ready within the existing startup window (the 30-second readiness check,
`machine/service.js:1141-1152`). Then the session is restarted fresh on the new account
through today's restart path for its role:

- lead: a new lead with the `[wc:context restart]` context;
- worker: a replacement with `--replaces`, briefed from its original brief;
- sub-lead: resumes from PLAN.md's Implementation Tasks and committed `reports/`;
- reviewer, verifier, mapper: a fresh session with its original brief.

The fresh session's first message also names the path of the machine's copy of the old
transcript so it can read what was done. Its starter is told by the usual "replaced"
notice. A failed resume never falls back to waiting on the old account.

### 5. What Collin sees

- No card, no thread line, no notice.
- On the Agents screen (`viewer/pages/agents.js:246`), the selected agent's details show
  the account it is on now by its Settings name (`settings.accounts[].name`), and, if it
  has switched, "moved from <old name>" for the latest switch.

### Non-goals

Crossing providers; switching before a limit is hit; switching back when the old account
resets; other providers; changing how accounts are signed in.

### Validation

- `bash machine/test/run.sh` and `node --test viewer/test/*.test.js` pass.
- New viewer tests (fake machine, as in `viewer/test/app-balancer.test.js`): a limit-hit
  for a `claude` session with a second signed-in Claude account switches it (session's
  `account` changes, `switches` has one entry, the carry-on message is queued, held
  messages are delivered after it); with no second account, today's hold and `Continue.`
  happen; a `gemini` session never switches; a failed resume takes the role's restart path.
- New machine tests (fake CLIs): the switch copies the Claude and Codex conversation files
  into the new account directory and relaunches with the resume arguments and the new
  environment; the old file is left in place.
- `npm --prefix viewer run test:browser` passes, with a check that the Agents details show
  the account name and "moved from".
- First build task: on this machine, with two signed-in accounts per CLI, prove by hand
  that a conversation copied into the other account's directory resumes (Claude and
  Codex), and record the result in the plan's Log. If one CLI cannot resume across
  accounts, that CLI always uses section 4 and the Log says so.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** intent lens and mechanics lens, families recorded on triage.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
