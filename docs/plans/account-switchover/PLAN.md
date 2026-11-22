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
| 15 | Supersedes 12: there is no special fresh-restart fallback. A resume that fails ends the session like any session that dies, and today's dead-session handling restarts it (its starter restarts it; a lead gets the Restart button). Placement then skips the limited account on its own. | Review round 2: the in-place fresh relaunch kept drawing blocking findings (role prompt, thread binding, pane lifetime, lost first prompt). Once the build's first task proves resume works, a failed resume is not normal use, and the existing death path already restarts. | review-round-2 |
| 16 | If the first build task shows a CLI cannot resume a conversation under another account, the build stops for that CLI and Collin is asked how to proceed, rather than every switch for that CLI ending in a restart. | Follows from 15: that case would make every switch a restart, which is not what Collin picked. | review-round-2 |
| 17 | The carry-on message is the same for both providers, and no report is delivered from the limited turn (as today). | Review round 2: a Codex limit usually cuts the turn short too; a "nothing was cut off" message would leave the agent idle. | review-round-2 |
| 18 | Confirms 15: a failed carry-over is treated like a crash (usual restart; a lead shows its Restart button). | Picked on the fallback card. | user |

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
  with `limited_until` in the future.
- Codex: a `turn-ended` event whose `reading.limited_until` is in the future
  (`machine/service.js:1519-1533`). This usually means the turn was cut short.

In both, the limited turn's report is not delivered, as today
(`viewer/app/sessions.js:632`).

**Launch identity.** Every CLI launch of a session (the first start and each switch) gets
a `launch` number on the machine session record, starting at 1. The machine passes it to the
CLI in the launch environment (`WHEELCHAIR_LAUNCH`, `WHEELCHAIR_ACCOUNT`), and
`machine/lib/hook-post.js` copies both from its own environment onto every event it posts
or spools; this covers Claude hooks and Codex notify, which both run through it
(`machine/hook.sh:20-36`). Events the machine makes itself (Codex step events,
`machine/service.js:1102-1106`) are stamped with the launch and account current when they
are produced, never at replay. An event with no `launch` (from a CLI started before this
change) counts as launch 1. The machine and the hub both
check it before changing session state:

- An event whose `launch` is older than the session's current launch only records its
  account's usage reading and any `limited_until` against *that event's account*. It does
  not touch turn state, transcript binding, holds, delivery or reports, and never triggers
  a switch.
- The hub records limits against the event's `account`, never `target.account` (today
  `viewer/app/sessions.js:597-598`).

### 2. Choosing the new account

On a trigger for a live `claude` or `gpt` session, the hub picks a new account with a
switch selector (new, in `viewer/app/balancer.js`), not the public `choose()`, whose
constraint rules refuse a pinned provider for leads, sub-leads and mappers and drop it for
reviewers and verifiers (`viewer/app/balancer.js:45-80`). The switch selector:

- considers only the session's provider and the thread's machine, and the session's model
  slot;
- removes the limited account, and any account whose reading has `limited_until` in the
  future, *before* ranking;
- applies the same per-provider rules `choose()` applies for that role: the lead reserve
  gate (`margin`/`held_back`, `viewer/app/balancer.js:78`) and live-session counts for the
  tie-break. Factor those out of `choose()` so both use one copy;
- ranks the rest with the existing `usage.rank()`;
- for `gpt`, runs `codex/preflight.sh` on the winner as in `viewer/app/sessions.js:292-314`
  (a failure marks it unavailable and picks once more).

No account left: today's hold-until-reset and `Continue.`, unchanged.

### 3. Switching

**Hub**, once an account is chosen, in this order:

1. Record the limit as today (the old account's reading gets `limited_until`).
2. Set `target.switching = {to, at}`. While it is set, nothing is delivered to the session
   (add it to `held()`, `viewer/app/sessions.js:505-511`). Only then delete
   `target.limited_until` and cancel its pending reset `Continue.`
   (`viewer/app/sessions.js:886-893`). The old account's reading keeps its `limited_until`.
3. Send the machine the switch request (new endpoint) with the new account and a
   `switch_id`. The machine answers at once that it has accepted it and does the work in
   the background, so the client's short timeout (`viewer/app/machine-client.js:66`) is
   not a problem. On a network error the hub retries the same request (same `switch_id`;
   the machine treats a repeat as the same switch). If it still cannot reach the machine,
   it gives up the switch: clears `switching`, and restores today's hold-until-reset and
   `Continue.`
4. On acceptance: set `target.account` to the new account, append `{from, to, at}` to
   `target.switches`, `recordChosen` the new account. Save.
5. When the session's `ready` event for the new launch arrives: queue the carry-on
   message first, ahead of anything held, then clear `switching` so delivery resumes.
   If instead the session ends, clear `switching`; today's dead-session handling takes over
   (Decision 15).

**Machine**, for that session, in the background:

1. Copies the old source transcript into the machine's own copy one last time
   (`copyTranscript`), so the copy holds the interrupted turn.
2. Copies the CLI's conversation file from the old account directory into the new one at
   the path that CLI expects (copy, never move):
   - Claude: `<config dir>/projects/<project key>/<session-id>.jsonl`
     (`machine/adapters/claude.js:86` finds it).
   - Codex: the rollout file for the bound thread id under `<CODEX_HOME>/sessions/`
     (`machine/adapters/codex.js:114-125`, `:149`).
   Default accounts use the CLI's own default directory (`~/.claude`, `~/.codex`); others
   `~/.wheelchair/accounts/<id>`.
3. Updates the session record: `account`, `account_dir`, `launch + 1`,
   `status = 'switching'` and `ready = false` (the readiness poller,
   `machine/service.js:1117-1165`, ignores a `switching` session), `source_transcript`
   pointing at the copied file, and clears `last_reading` and the statusline throttle
   (`machine/lib/statusline.js:19-28`) so a limit on the new account is never computed
   from the old account's reset windows (with no reading, `machine/lib/limits.js` uses its
   one-hour default). Parser and copy offsets carry over
   unchanged, since the copied file is identical; they reset only if the CLI turns out to
   write a new file on resume (the first build task finds out; then they start at 0 of that
   new file).
4. Builds the relaunch command with the same launch-preparation code a normal start uses
   (`machine/service.js:804-945`: project tools, project keys, MCP config, role
   instructions, model, effort, permissions), with the new account's environment
   (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`, none for a default account), the new
   `WHEELCHAIR_LAUNCH`, and resume: Claude `--resume <session-id>`, Codex
   `resume <thread-id>`. Nothing is rebuilt from stored, redacted arguments.
5. Replaces the CLI process with `tmux respawn-pane -k` on the session's pane, so the tmux
   session itself never goes away, then sets `status = 'starting'` so the readiness poller
   watches the new process.

   If anything in steps 1-4 fails (no transcript found, copy or launch preparation fails),
   the machine leaves the old CLI running, restores the session record's old `account`,
   `account_dir`, `launch` and `status`, and emits `switch-failed`. The hub then clears
   `switching`, sets `target.account` back, and restores today's hold-until-reset and
   `Continue.` on the old account.
6. Gives the relaunch its own readiness window: the 30-second check
   (`machine/service.js:1117-1152`) is measured from the relaunch. Ready: emits `ready` as
   usual. Exits or misses the window: the session ends as a dead session today does (no
   `stuck` card; Decision 15).

The carry-on message, for both providers:
`[wc:context switch] Your account hit its usage limit, so this conversation was moved to
another account. Carry on from where you stopped.`

`[wc:context switch]` is a new marker (`viewer/app/chat.js:125-144`, `protocol/app/cards.md`
markers table): the message itself is hidden with no placeholder line, and the reply is
shown as usual (so a lead's continued answer to Collin appears; other roles' replies are
not shown in the thread anyway).

### 4. When resume fails

There is no special fallback (Decision 15). A resume that exits or misses its readiness
window ends the session; its starter gets today's dead-session notice and restarts it by
its role's usual rule, and a dead lead gets the Restart button. Normal placement skips the
limited account because its reading has a future `limited_until`.

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
- New viewer tests (fake machine, as in `viewer/test/app-balancer.test.js`):
  - a `limit-hit` for a `claude` session, and a `turn-ended` with a future
    `reading.limited_until` for a `gpt` session, each with a second signed-in account of
    that provider, switch it: `account` changes, `switches` has one entry, no report is
    delivered from the limited turn, and after `ready` the carry-on message is delivered
    first, then held messages;
  - a held message is not delivered while `switching` is set;
  - with no second account, today's hold and `Continue.` happen; a `gemini` session never
    switches;
  - the switch selector finds an alternate for a lead, a mapper and a reviewer, and
    honours the lead reserve for a worker;
  - an unreachable machine, and a `switch-failed` event, each restore today's hold on the
    old account;
  - an event from an older `launch` (or untagged, after a switch) changes no turn state and
    sets no hold on the switched session.
- New machine tests (fake CLIs): the switch copies the Claude and Codex conversation files
  into the new account directory and relaunches with the resume arguments and the new
  environment; the old file is left in place; the relaunch uses `respawn-pane -k` and the
  same launch preparation as a start (project tools present); a resume that exits, and one
  that misses readiness, each end the session without a `stuck` event; a repeated
  `switch_id` does not switch twice; hook events (Claude hooks and Codex notify) and machine-made step
  events carry `launch` and account from the launch, not from the current record; a copy
  or launch-preparation failure emits `switch-failed` and leaves the old CLI running;
  after a switch `last_reading` is empty until the new account reports one.
- `npm --prefix viewer run test:browser` passes, with a check that the Agents details show
  the account name, "moved from", and the removed-account label. A chat test shows a
  `[wc:context switch]` message hidden with its reply shown.
- First build task: on this machine, with two signed-in accounts per CLI, prove by hand
  that a conversation copied into the other account's directory resumes (Claude and
  Codex), and record the result in the plan's Log. Also record whether the resumed CLI
  appends to the copied file or starts a new one; if a new one, the machine's transcript
  copy must follow it, and the Log says how. If one CLI cannot resume across accounts, stop
  and report it (Decision 16).

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

### Round 2 — 2026-11-21

**Lanes:** intent / claude; mechanics / gpt; cross-family: yes.

**Changed since Round 1:**
- §1: both trigger forms named (Claude `limit-hit`, Codex `turn-ended` with a future reading); events stamped with their account.
- §2: new switch selector instead of `choose()`, excluding limited accounts before ranking.
- §3: rewritten — hub order (ack, clear session hold, commit new account, ask machine), machine operation (stop, copy, rebind transcript source, relaunch with resume, own readiness window), `[wc:context switch]` carry-on message, Codex variant.
- §4: fallback is now an in-place fresh relaunch (Decision 12), not the per-role restart paths.
- §5: removed-account label. Validation extended. One Accepted Risk added.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Codex "nothing was cut off" carry-on text leaves a cut-short Codex agent idle | upheld | Decision 17: one carry-on text; no report from the limited turn |
| intent | minor | Partial Codex report then a second one | upheld | Same fix |
| mechanics | blocking | Fresh Codex relaunch lacks `[wc:role]` first input and keeps the old thread id | upheld | Cut: Decision 15 removes the fresh fallback |
| mechanics | blocking | Pane can disappear when the resume process exits | upheld | §3 machine step 5 `respawn-pane -k`; a failed resume ends the session (Decision 15) |
| mechanics | major | Clearing the hold before the switch lets a held message reach the old CLI | upheld | §3 hub step 2 `switching` hold |
| mechanics | major | Network drop or short client timeout leaves hub and machine disagreeing | upheld | §3 hub steps 3-4: async accept, `switch_id` retry, restore hold on failure |
| mechanics | major | Delayed old-launch events rebind the transcript or close the new turn | upheld | §1 launch identity |
| mechanics | major | Interrupted turn not flushed; lead with no brief has nothing to recover from | upheld | §3 machine step 1 flush; fresh fallback cut |
| mechanics | major | Relaunch from stored arguments loses project tools and keys | upheld (`machine/adapters/codex.js:138`, `machine/lib/env-launch.js:9`) | §3 machine step 4: same launch preparation |
| mechanics | major | Selector skips the lead reserve and live-session tie-break | upheld (`viewer/app/balancer.js:78`) | §2 shared per-provider rules |
| mechanics | minor | Resetting Codex parser offsets replays old usage | upheld | §3 machine step 3: offsets carry over |

### Round 3 — 2026-11-21

**Lanes:** intent / claude; mechanics / gpt; cross-family: yes.

**Changed since Round 2:**
- §1: launch identity (`launch` number on hook events); old-launch events only record their account's cooldown. Codex limit treated as cut-short; no report from the limited turn (Decision 17).
- §2: selector shares `choose()`'s lead reserve gate and live-session counts.
- §3: `switching` hold; async machine accept with `switch_id` retry and restore-on-failure; final transcript flush; offsets carry over; relaunch through normal launch preparation with `respawn-pane -k`; one carry-on text.
- §4: no special fallback; failed resume ends the session like a crash (Decisions 15, 16, 18).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Validation still says the Codex limited turn's report is delivered, contradicting §1 and Decision 17 | upheld | Validation rewritten: no report from the limited turn |
| intent | minor | Viewer-test list garbled and duplicates the stale-event check | upheld | Validation bullet rewritten as a list |
| mechanics | blocking | Same Codex report contradiction | upheld | Same fix |
| mechanics | blocking | `ready = false` alone leaves `status` ready, so the poller skips the relaunch; `starting` too early sees the old pane | upheld (`machine/service.js:1117-1138`) | §3 machine steps 3 and 5: `switching`, then `starting` after respawn |
| mechanics | major | Codex notify and machine-made step events need launch identity at production, not replay | upheld | §1: identity from launch environment via `hook-post.js`; step events stamped when produced |
| mechanics | major | Untagged events from CLIs started before the update | upheld | §1: untagged counts as launch 1 |
| mechanics | major | No terminal outcome if lookup, copy or preparation fails before respawn | upheld | §3: `switch-failed` restores old account and hold |
| mechanics | major | Cached Claude reading and statusline throttle belong to the old account | upheld (`machine/service.js:1536-1543`) | §3 machine step 3 clears both |

### Round 4 — 2026-11-21

**Lanes:** intent / claude; mechanics / gpt; cross-family: yes.

**Changed since Round 3:**
- §1: launch identity comes from the launch environment through `hook-post.js` (Claude hooks and Codex notify); machine-made step events stamped when produced; untagged events count as launch 1.
- §3 machine: `status = 'switching'` then `starting` after `respawn-pane`; clears `last_reading` and statusline throttle; new `switch-failed` outcome restores the old account and hold.
- Validation: viewer-test list rewritten; no report from the limited turn.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
