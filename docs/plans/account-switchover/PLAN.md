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
| 12 | Supersedes 7: when resume fails, the session is relaunched fresh *in place* (same tmux session, name, role, starter, worktree, queue) on the new account without resume, and told where the old transcript is. Today's per-role restart paths are not used. | Review round 1: the per-role restart paths rerun placement, lose queues and children's routes, change a verifier's commit and show "Lead restarted". Relaunching in place keeps all of that. | review-round-1 |
| 13 | The switch is one machine operation (stop, copy, relaunch with resume, readiness wait, in-place fresh fallback) started by the hub after it has acknowledged the limit event, not inside the event handler. | Review round 1: the readiness event arrives through the same serial spool and thread lock. | review-round-1 |
| 14 | A new marker `[wc:context switch]` carries the carry-on message: the message is hidden with no placeholder line, and the session's reply is shown as usual. | Review round 1: `[wc:from app]` would hide a lead's continued answer to Collin; Decision 9 rules out a visible line. | review-round-1 |

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

The hub's existing limit condition (`viewer/app/sessions.js:593-595`) is the trigger, in
both of its forms:

- Claude: a `limit-hit` event (StopFailure `rate_limit`, `machine/adapters/claude.js:94-96`)
  with `limited_until` in the future. The turn was cut off mid-way.
- Codex: a `turn-ended` event whose `reading.limited_until` is in the future
  (`machine/service.js:1519-1533`). The turn finished; the limit was read from its usage.

The machine stamps every `limit-hit` and `turn-ended` event with the `account` the session
was on when the CLI produced it. The hub records a limit against that event's `account`,
never against `target.account` (today `viewer/app/sessions.js:597-598`). A limit event whose
`account` is not the session's current account records that account's cooldown and does
not trigger a switch or a hold.

### 2. Choosing the new account

On a trigger for a live `claude` or `gpt` session, the hub picks a new account with a
switch selector (new, in `viewer/app/balancer.js`), not the public `choose()`, whose
constraint rules refuse a pinned provider for leads, sub-leads and mappers and drop it for
reviewers and verifiers (`viewer/app/balancer.js:45-80`). The switch selector:

- considers only the session's provider and the thread's machine;
- removes the limited account, and any account whose reading has `limited_until` in the
  future, *before* ranking;
- then ranks the rest with the existing `usage.rank()` (sign-in, readings, reserves,
  weights), using the session's model slot;
- for `gpt`, runs `codex/preflight.sh` on the winner as in `viewer/app/sessions.js:292-314`
  (a failure marks it unavailable and picks once more).

No account left: today's hold-until-reset and `Continue.`, unchanged.

### 3. Switching

Order in the hub, once an account is chosen:

1. Acknowledge the limit event as today (the old account's reading gets its
   `limited_until`). For Codex, the finished turn's report is delivered as a normal turn
   end (the turn completed); for Claude there is no report, as today.
2. Clear the session's own hold: delete `target.limited_until` and cancel its pending
   reset `Continue.` (`viewer/app/sessions.js:886-893`). The old account's reading keeps its
   `limited_until`, so no other session is placed on it.
3. Set `target.account` to the new account, append `{from, to, at}` to `target.switches`,
   and `recordChosen` the new account. Save.
4. Ask the machine to switch the session to the new account (one new machine endpoint;
   the hub does not wait inside the event handler). It is idempotent: if the machine's
   session is already on that account, it does nothing and reports success.

The machine, for that session:

1. Stops the CLI process in the session's tmux session (tmux session, worktree, session
   token, name stay).
2. Copies the CLI's conversation file from the old account directory into the new one at
   the path that CLI expects (copy, never move):
   - Claude: `<config dir>/projects/<project key>/<session-id>.jsonl`
     (`machine/adapters/claude.js:86` finds it).
   - Codex: the rollout file for the bound thread id under `<CODEX_HOME>/sessions/`
     (`machine/adapters/codex.js:114-125`, `:149`).
   Default accounts use the CLI's own default directory (`~/.claude`, `~/.codex`); others
   `~/.wheelchair/accounts/<id>`.
3. Updates the session record: `account`, `account_dir`, clears `source_transcript` and
   the turn-parsing offsets tied to it, so the next lookup finds the file in the new
   directory (`machine/service.js:1078-1080`, `:1450`, `:1514`). The machine's own copy of
   the transcript (`transcript_path`) keeps its offset: the copied file starts with the same
   content.
4. Relaunches the CLI in the same tmux session with the new account's environment
   (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`, none for a default account), the same launch
   arguments as the original start (model, effort, permissions, role instructions), plus
   resume: Claude `--resume <session-id>`, Codex `resume <thread-id>`.
5. Gives the relaunch its own readiness window: resets the session's `ready` state and
   measures the 30-second check (`machine/service.js:1117-1152`) from the relaunch, not the
   original start. A relaunch that exits or misses that window does not emit `stuck`; it
   goes to section 4.
6. Once ready, emits `ready` as usual.

When the hub sees `ready` after a switch, it puts this first in the session's queue,
ahead of anything held:
`[wc:context switch] Your account hit its usage limit, so this conversation was moved to
another account. Carry on from where you stopped.` For a Codex switch, where the turn had
finished, the text instead ends `Nothing was cut off; wait for your next message.` and is
skipped entirely if other messages are queued (they go first and the session carries on
with them).

`[wc:context switch]` is a new marker (`viewer/app/chat.js:125-144`, `protocol/app/cards.md`
markers table): the message itself is hidden with no placeholder line, and the reply is
shown as usual (so a lead's continued answer to Collin appears; other roles' replies are
not shown in the thread anyway).

### 4. When resume fails

If the resumed CLI exits or misses its readiness window, the machine relaunches the CLI
again in the same tmux session on the new account, with the same launch arguments but no
resume. The session keeps its name, role, starter, worktree, queue and children, so
nothing is re-routed and no placement runs. This relaunch uses the normal startup checks
(its own 30-second window; a miss emits `stuck` as today). Once ready, the hub types first:
`[wc:context switch] Your account hit its usage limit and this conversation could not be
moved, so you are starting fresh on another account. Your earlier conversation is at
<machine transcript_path>; read it to see what was done, then carry on with your task.`
followed by the session's original brief for roles that have one (the brief the hub
already stores, `/api/sessions/<name>/brief`).

### 5. What Collin sees

- No card, no thread line, no notice.
- On the Agents screen (`viewer/pages/agents.js:246`), the selected agent's details show
  the account it is on now by its Settings name (`settings.accounts[].name`) and, after a
  switch, "moved from <old name>" for the latest switch. An account no longer in Settings
  shows as "a removed account".

### Non-goals

Crossing providers; switching before a limit is hit; switching back when the old account
resets; other providers; changing how accounts are signed in.

### Validation

- `bash machine/test/run.sh` and `node --test viewer/test/*.test.js` pass.
- New viewer tests (fake machine, as in `viewer/test/app-balancer.test.js`): a `limit-hit`
  for a `claude` session, and a `turn-ended` with a future `reading.limited_until` for a
  `gpt` session, each with a second signed-in account of that provider, switch it; the
  switch selector finds an alternate for a lead, a mapper and a reviewer; a stale event
  stamped with the old account sets no hold on the switched session; the Codex turn's
  report is delivered. For the `claude` case: (session's
  `account` changes, `switches` has one entry, the carry-on message is queued, held
  messages are delivered after it); with no second account, today's hold and `Continue.`
  happen; a `gemini` session never switches; a failed resume relaunches in place without
  resume and the session name, queue and starter are unchanged.
- New machine tests (fake CLIs): the switch copies the Claude and Codex conversation files
  into the new account directory and relaunches with the resume arguments and the new
  environment; the old file is left in place; a resume that misses readiness relaunches
  without resume and emits no `stuck`; a repeated switch request to the same account does
  nothing.
- `npm --prefix viewer run test:browser` passes, with a check that the Agents details show
  the account name, "moved from", and the removed-account label. A chat test shows a
  `[wc:context switch]` message hidden with its reply shown.
- First build task: on this machine, with two signed-in accounts per CLI, prove by hand
  that a conversation copied into the other account's directory resumes (Claude and
  Codex), and record the result in the plan's Log. Also record whether the resumed CLI
  appends to the copied file or starts a new one; if a new one, the machine's transcript
  copy must follow it, and the Log says how. If one CLI cannot resume across accounts, that
  CLI always uses section 4 and the Log says so.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| The hub restarting in the seconds between asking the machine to switch and hearing back may leave the hub unsure of the outcome. | Rare path: needs a limit hit and a hub restart within the same short window. The switch request is idempotent, which covers a plain retry. | review-round-1 |

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** intent / claude-opus-5-5; mechanics / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Codex sends `turn-ended` with `reading.limited_until`, not `limit-hit`; switching would never fire for Codex | upheld | §1 names both trigger forms; Codex tests added |
| intent | minor | Codex limit is seen after a finished turn; carry-on text may cost an extra turn or repeat a report | upheld | §3: Codex turn's report delivered; Codex carry-on text says nothing was cut off and is skipped when messages are queued |
| mechanics | blocking | Same Codex trigger gap; limit must be handled before report delivery | upheld | Same fix as intent finding 1 |
| mechanics | blocking | `choose()` refuses or drops a pinned provider for leads, sub-leads, mappers, reviewers, verifiers | upheld (`viewer/app/balancer.js:47`, `:55-63`) | §2 switch selector, excluding before ranking |
| mechanics | blocking | Session's `limited_until` stays after switch, holding the carry-on message and leaving a stray `Continue.` | upheld | §3 hub steps 2-3; carry-on goes first in queue |
| mechanics | blocking | Cached `source_transcript` keeps pointing at the old account | upheld (`machine/service.js:1078`, `:1450`) | §3 machine step 3 |
| mechanics | blocking | Readiness check returns early for a previously ready session, times from creation, emits `stuck`; hub must ack before waiting | downgraded to major: would open a stray card, not build the wrong thing | §3 machine step 5; Decision 13 |
| mechanics | major | No persisted switch identity or recovery across a hub restart mid-switch | accepted-risk (rare path) | Accepted Risks; switch request made idempotent |
| mechanics | major | Delayed old-CLI events can put a cooldown on the new account | upheld | §1 events stamped with account; hub uses it |
| mechanics | major | Fresh-restart fallback loses queues and children's routes | upheld | Cut: Decision 12, in-place fallback (§4) |
| mechanics | major | Fallback reruns placement and changes a verifier's commit | upheld | Cut: Decision 12 |
| mechanics | major | `[wc:from app]` hides a lead's continued answer; `[wc:context restart]` shows "Lead restarted" | upheld | Decision 14, `[wc:context switch]` marker |
| mechanics | minor | Agents display needs a label for a removed account | upheld | §5 "a removed account" |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
