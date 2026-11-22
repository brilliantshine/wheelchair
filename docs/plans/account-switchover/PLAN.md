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
| 19 | Launch identity is removed. Events from the old CLI arriving after a switch are an accepted rare path; the machine drops hook events for a session while its status is `switching`, and after the respawn the old CLI no longer exists. | Review round 4: launch numbering drew findings every round, and it only guards against an event spooled during a limit hit and replayed after the switch, which needs the machine's own hook post to fail at that moment. | review-round-4 |
| 20 | Keep the current design with Claude and Codex together and keep reviewing (budget reset). | Picked after review round 5. | user |

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

The hub records the limit against `target.account` before it changes the account (§3 hub
step 1 comes before step 4). While a session's machine status is `switching` (§3), the
machine drops hook events for it.

### 2. Choosing the new account

On a trigger for a live `claude` or `gpt` session, the hub picks a new account with a
switch selector (new, in `viewer/app/balancer.js`), not the public `choose()`, whose
constraint rules refuse a pinned provider for leads, sub-leads and mappers and drop it for
reviewers and verifiers (`viewer/app/balancer.js:45-80`). The switch selector:

- considers only the session's provider and the thread's machine (the session keeps its
  saved model and effort, so no model slot or `codex/model.sh` check is involved);
- applies the same per-provider rules `choose()` applies for that role, computed over the
  provider's full account list exactly as `choose()` does: the lead reserve gate
  (`margin`/`held_back`, `viewer/app/balancer.js:78`) and live-session counts for the
  tie-break. Factor those out of `choose()` so both use one copy;
- runs only after the hub has recorded the limit on the old account's reading (§3 hub
  step 1), then calls the existing `usage.rank()` unchanged and takes the account it marks
  `next`. `rank()` already skips paused, signed-out and limited accounts
  (`viewer/app/usage.js:112-132`), so the limited account is never picked;
- for `gpt`, runs `codex/preflight.sh` on the winner as in `viewer/app/sessions.js:292-314`
  (a failure marks it unavailable and picks once more).

No account left: today's hold-until-reset and `Continue.`, unchanged.

### 3. Switching

**Hub**, in this order:

1. Record the limit as today (the old account's reading gets `limited_until`). Then choose
   the new account (§2); none means today's hold, and the steps below do not run.
2. Set `target.switching = {id, to, at}`, where `id` is a new `switch_id`. While it is set, nothing is delivered to the session
   (add it to `held()`, `viewer/app/sessions.js:505-511`). Only then delete
   `target.limited_until` and cancel its pending reset `Continue.`
   (`viewer/app/sessions.js:886-893`). The old account's reading keeps its `limited_until`.
3. Send the machine the switch request (new endpoint) with the `switch_id`, the new
   account (id and directory), the session's `model` from the hub's session record
   (`viewer/app/sessions.js:353`), never from current Settings, and the thread's `project`
   and `project_dir` (as a start sends them, `viewer/app/sessions.js:369`). Every other launch value
   comes from the machine's own session record (machine step 4). The machine answers at once that it has accepted it and does the work in
   the background, so the client's short timeout (`viewer/app/machine-client.js:66`) is
   not a problem. On a network error the hub retries the same request (same `switch_id`;
   the machine treats a repeat as the same switch). If it still cannot reach the machine,
   or the machine refuses the request (any HTTP error, such as a 404 from a machine on an
   older build), it gives up the switch: clears `switching`, and restores today's hold-until-reset and
   `Continue.`
4. On acceptance: set `target.account` to the new account, append `{from, to, at}` to
   `target.switches`, `recordChosen` the new account. Save.
5. While `switching` is set, only a `ready` or `switch-failed` carrying
   `target.switching.id` completes it (the machine adds its current `switch_id` to both);
   others are ignored. With no `switching` set, `ready` works as today. Quiet reminders
   (`viewer/app/quiet.js`) are not armed or fired for a session while `switching` is set.
   On the matching `ready`: queue the carry-on
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
   Before step 1 it keeps a snapshot of the session record. The `switch_id` and the
   switch's outcome are kept outside the snapshot, so a restore never erases them and a
   repeated request with the same id gets the same outcome.
3. Updates the session record: `account`, `account_dir`,
   `status = 'switching'` and `ready = false` (the readiness poller,
   `machine/service.js:1117-1165`, ignores a `switching` session), `source_transcript`
   pointing at the copied file and `transcript_source` rebound to the copied file's path and
   inode with its offset kept (`machine/service.js:1375`, `:1421`), and clears `last_reading` and the statusline throttle
   (`machine/lib/statusline.js:19-28`) so a limit on the new account is never computed
   from the old account's reset windows (with no reading, `machine/lib/limits.js` uses its
   one-hour default). Parser and copy offsets carry over
   unchanged, since the copied file is identical; they reset only if the CLI turns out to
   write a new file on resume (the first build task finds out; then they start at 0 of that
   new file).
4. Builds the relaunch command. Factor the command-building slice out of `startIn`
   (`machine/service.js:800-950`) so a start and a switch share it:
   - **Reused:** the adapter's launch command and environment, project tools, project keys
     and MCP config.
   - **Inputs:** every value the original start used, taken from the machine session
     record as saved at start (`machine/service.js:832`): `role` (the Codex adapter uses it
     for the reviewer's read-only sandbox, `machine/adapters/codex.js:136`), `thread_id`,
     `worktree`, `branch`, `default_branch`, session name and token,
     `cli`, `effort`, `permission_mode`, `codex_mode`; `model`, `project` and `project_dir` from the switch request;
     the role prompt is the session's existing saved prompt file (`prompts/<name>.md`,
     `machine/service.js:196`, `:817`), reused as is, never rebuilt; the new account's environment (`CLAUDE_CONFIG_DIR` /
     `CODEX_HOME`, none for a default account); resume: Claude `--resume <session-id>`,
     Codex `resume <thread-id>`.
   - **Skipped:** worktree creation and the worker worktree reservation
     (`machine/service.js:812-825`, `:626-656`), the first message (`pending_initial` stays
     empty, `:925`, so the carry-on message is the only input), the session-ledger line,
     and the tmux `new-session` call.
   Nothing is rebuilt from stored, redacted arguments.
5. Replaces the CLI process with `tmux respawn-pane -k` on the session's pane, so the tmux
   session itself never goes away, then sets `status = 'starting'` so the readiness poller
   watches the new process.

   If anything in steps 1-5 fails (no transcript found, copy, launch preparation or
   `respawn-pane` fails), the old CLI is still running; the machine restores the snapshot
   (account, directory, status, transcript binding, reading, everything) and emits
   `switch-failed`. The hub then clears
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
  - an unreachable machine, a refused request (404), and a `switch-failed` event, each
    restore today's hold on the old account; no quiet reminder fires while `switching` is set;
  - a `ready` or `switch-failed` with another `switch_id` is ignored.
- New machine tests (fake CLIs): the switch copies the Claude and Codex conversation files
  into the new account directory and relaunches with the resume arguments and the new
  environment; the old file is left in place; the relaunch uses `respawn-pane -k` and the
  same launch preparation as a start (project tools present); a resume that exits, and one
  that misses readiness, each end the session without a `stuck` event; a repeated
  `switch_id` does not switch twice; the relaunch uses the request's model, `project_dir` (the
  thread's project) and `project` (its basename), as a start sends them
  (`viewer/app/sessions.js:369-370`), and the record's role, thread, effort and permission modes (a resumed Codex reviewer keeps its
  read-only sandbox flags; project tools are set up), the session's existing worktree and branch, creates no worktree and
  sends no first message; `switch_id` and outcome survive a snapshot restore; hook events for a `switching` session are dropped; a copy,
  launch-preparation or `respawn-pane` failure emits `switch-failed`, leaves the old CLI
  running and restores the whole session record;
  after a switch `last_reading` is empty until the new account reports one.
- `npm --prefix viewer run test:browser` passes, with a check that the Agents details show
  the account name, "moved from", and the removed-account label. A chat test shows a
  `[wc:context switch]` message hidden with its reply shown.
- First build task: on this machine, with two signed-in accounts per CLI, prove by hand
  that a conversation copied into the other account's directory resumes (Claude and
  Codex), and record the result in the plan's Log. The probe goes through the machine, not just the CLI:
  the resumed session must reach `ready`, take one carry-on turn whose reply uses a fact
  given only before the switch, and produce a turn-end event the hub sees; for Codex, that
  turn's usage reading reaches the hub under the new account. Also record whether the resumed CLI
  appends to the copied file or starts a new one; if a new one, the machine's transcript
  copy must follow it, and the Log says how. If one CLI cannot resume across accounts, stop
  and report it (Decision 16).

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| An event from the old CLI that was spooled and replays after the switch is applied to the switched session. | Rare path: needs the hook's own post to the machine to fail at the moment of the limit hit. | review-round-4 |
| A machine-service restart during a switch's background work leaves the session held. | Rare path: needs a service restart inside the few seconds of a switch. | review-round-4 |
| After a `switch-failed`, the Agents details may show a "moved from" for a switch that did not happen. | Rare path: `switch-failed` needs a copy or tmux failure on a healthy machine; display only. | review-round-4 |
| The hub restarting in the seconds between asking the machine to switch and hearing back may leave the hub unsure of the outcome. | Rare path: needs a limit hit and a hub restart within the same short window. The switch request is idempotent, which covers a plain retry. | review-round-1 |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|
| 1 | Whether Claude's relaunch keeps or drops `--session-id <id>` (`machine/adapters/claude.js:73`) beside `--resume <id>`; the first build task's probe settles it. | review-round-7 |

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
| intent | minor | `switches` entry left after `switch-failed` | accepted-risk (rare path) | Accepted Risks |
| mechanics | blocking | Hub cannot tell which launch a `ready` or `switch-failed` belongs to | upheld | §3: both carry `switch_id`; launch numbers removed (Decision 19) |
| mechanics | blocking | Relaunch lacks original launch inputs such as the model | upheld (`viewer/app/sessions.js:353-379`) | §3 hub step 3 sends the full launch payload |
| mechanics | major | Untagged launch-1 events lack account attribution | upheld | Cut: Decision 19 removes launch identity; limit recorded before the account changes |
| mechanics | major | Rollback leaves the transcript binding and reading on the new copy | upheld | §3: snapshot restored whole |
| mechanics | major | A rejected `respawn-pane` has no outcome | upheld | §3: failure scope covers step 5 |
| mechanics | major | Rare path: machine restart mid-switch leaves the session held | accepted-risk (rare path) | Accepted Risks |
| mechanics | minor | False "moved from" after a failed switch | accepted-risk (rare path) | Same as intent's |

### Round 5 — 2026-11-21

**Lanes:** intent / claude; mechanics / gpt; cross-family: yes.

**Changed since Round 4:**
- §1: launch identity removed (Decision 19); machine drops hook events while `switching`; limit recorded before the account changes.
- §3: switch request carries the full start payload; `ready` and `switch-failed` carry `switch_id`; snapshot restored whole on failure, including a failed `respawn-pane`.
- Three rare paths added to Accepted Risks. Validation updated to match.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Reusing the start payload creates a new worktree, losing the agent's work | upheld (`machine/service.js:812`, `:820`) | §3 machine step 4: worktree and branch from the session record; creation skipped |
| intent | major | Shared preparation re-sends the first message on resume | upheld (`machine/service.js:925`) | §3 machine step 4: `pending_initial` empty |
| intent | minor | Spec should list what is reused and what is skipped | upheld | §3 machine step 4 lists both |
| mechanics | blocking | `switch_id` not in the hub hold; snapshot restore erases it; untagged ordinary `ready` must still work | upheld | §3 hub steps 2 and 5; machine keeps id and outcome outside the snapshot |
| mechanics | blocking | Start path reads current Settings, so a switch could change permission modes | upheld (`viewer/app/sessions.js:319`, `:375`) | §3 hub step 3: values from the session record; pre-change sessions not switched |
| mechanics | major | Model slot is not saved on the session | upheld | §2: no slot check; session keeps its model |
| mechanics | major | First message re-sent on resume | upheld | Same fix as intent major |
| mechanics | major | An explicit refusal (404 from an older machine) has no outcome | upheld | §3 hub step 3: refusal restores the hold |
| mechanics | minor | Quiet reminders can fire during a switch | upheld | §3 hub step 5: no quiet while `switching` |

### Round 6 — 2026-11-21

**Lanes:** intent / claude; mechanics / gpt; cross-family: yes.

**Changed since Round 5:**
- §2: no model-slot check; the session keeps its saved model and effort.
- §3 hub: `switching` holds the `switch_id`; launch values (`model`, `effort`, `permission_mode`, `codex_mode`) come from the hub session record, which now saves the permission modes at start; sessions without them are not switched; a refused request restores the hold; only switch callbacks need a matching id; no quiet reminders while switching.
- §3 machine: `switch_id` and outcome kept outside the snapshot; step 4 lists what the relaunch reuses from `startIn`, its inputs, and what it skips (worktree creation, reservation, first message, ledger line, `new-session`).
- Validation updated to match.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | New hub permission fields and the pre-change exclusion are unnecessary; the machine record already has them | upheld (`machine/service.js:832`) | §3: launch values from the machine record; exclusion removed |
| mechanics | blocking | Relaunch inputs omit `role`, so a resumed Codex reviewer loses its read-only sandbox | upheld (`machine/adapters/codex.js:136`) | §3 machine step 4: all start values from the record, `role` named |
| mechanics | blocking | Relaunch needs `thread_id` and project identity for project tools | upheld (`machine/service.js:734`, `:751`) | Same fix |
| mechanics | minor | Permission-mode presence check doesn't identify pre-change sessions | upheld | Check removed |
| mechanics | minor | Build gate should prove readiness and a turn-end through the machine | upheld | Validation: probe goes through the machine |

### Round 7 — 2026-11-21

**Lanes:** intent / claude; mechanics / gpt; cross-family: yes.

**Changed since Round 6:**
- §3 hub step 3: the switch request carries only `switch_id`, new account and `model`; the new hub permission fields and the pre-change exclusion are gone.
- §3 machine step 4: every other launch input comes from the machine session record as saved at start (`role`, `thread_id`, project identity, worktree, branch, cli, effort, permission modes).
- Validation: the first build task's probe goes through the machine (ready, one carry-on turn, a turn-end the hub sees).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Machine record lacks project identity and role layers | upheld | §3: project from the switch request; saved prompt file reused |
| intent | note | Claude `--session-id` beside `--resume` | check-once-built | Check Once Built row 1 |
| mechanics | blocking | No source of project identity for sessions started before the update | upheld (`machine/service.js:832`) | §3 hub step 3 sends `project`, `project_dir` |
| mechanics | major | No source for the original role prompt | upheld | §3 machine step 4 reuses `prompts/<name>.md` |
| mechanics | major | Excluding accounts before the reserve forecast lets workers take lead capacity | upheld (`viewer/app/balancer.js:78`) | §2: forecast over the full list; exclusions after ranking |
| mechanics | minor | Copier offset resets unless `transcript_source` path and inode are rebound | upheld | §3 machine step 3 |
| mechanics | minor | Probe should prove the conversation actually carried over | upheld | Validation probe uses a pre-switch fact |

### Round 8 — 2026-11-21

**Lanes:** intent / claude; mechanics / gpt; cross-family: yes.

**Changed since Round 7:**
- §2: reserve gate computed over the full account list; limited accounts removed after ranking.
- §3 hub step 3: request also carries `project` and `project_dir`.
- §3 machine: role prompt reused from the saved prompt file; `transcript_source` path and inode rebound, offset kept.
- Validation probe uses a fact given only before the switch. One Check Once Built row.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Taking "the first" after `rank()` can pick a paused, signed-out or limited account; recording the limit first lets `rank()` choose unchanged | upheld (`viewer/app/usage.js:114-132`) | §2 and §3 hub step 1: record limit, then take `rank()`'s `next` |
| mechanics | blocking | Same selection problem | upheld | Same fix |
| mechanics | minor | Test should assert project fields come from the request like a start | upheld | Validation reworded |
| mechanics | minor | Codex probe should prove the usage reading reaches the hub under the new account | upheld | Validation probe extended |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
