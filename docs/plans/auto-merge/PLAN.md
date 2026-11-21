---
slug: auto-merge
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Auto-merge finished pull requests

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

(none)

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Merge method: GitHub merge commit (`gh pr merge --merge`), matching how this repo's PRs are merged today | Keeps history the same as manual merges | defaulted |
| 2 | Applies to every path that ends in a `done` card: planned builds, small fixes, after-done fixes on an open PR | All three end in the same finishing procedure (MAP.md 3) | defaulted |
| 3 | The lead reads the setting at the moment it would merge, not when it started, so turning it off stops merges in running threads | A switch that doesn't take effect until new threads would surprise | defaulted |
| 4 | If GitHub refuses the merge (review required, branch protection, head moved), the PR stays open, the lead says so in one line, and nothing retries the merge | Never bypass GitHub's rules (IDEA Constraints) | defaulted |
| 5 | Merge only after the check agent has tried the Check it yourself steps and the check card has no broken step; a broken step keeps the PR open so Fix it now fixes it in place | One more look before main; fixes stay in the same thread | user |
| 6 | After a broken check, "Leave it" does not merge; the PR stays open for Collin. A later fix that passes its check merges as usual | "Leave it" leaves the decision with Collin | defaulted |
| 7 | One global switch on the Settings page | Matches the other settings; simplest | user |
| 8 | The hub decides whether a merge is allowed; the machine service runs `gh pr merge` in the thread's worktree | The hub holds the setting and the cards; the machine has the credentials that already push and open the PR (MAP.md 6) | defaulted |
| 9 | The check card's `update` text is phrased to work whether or not the merge is automatic ("Once the pull request is merged, …") | The lead writes it before the merge happens | defaulted |
| 10 | Supersedes #8 and #3's mechanism: the hub itself merges, triggered when it accepts a `check` card; there is no lead command. The setting is still read at that moment | Removes the lead command, machine endpoint, restart branch and stale-token path that drew four review findings; the hub already holds the setting, the cards and a `gh` | review-round-1 |
| 11 | Readiness is re-checked against GitHub right before merging, with the same rules as the done gate | Checks can fail on the same commit after done | review-round-1 |
| 12 | One attempt per done head, recorded before `gh` runs; never retried | Decision 4; makes restarts and repeated sweeps safe | review-round-1 |
| 13 | A done card for a fix pushed after it failed its check carries `unverified: true`, and the hub never merges it | Collin's "push it as it is" is permission to push, not to land | review-round-1 |
| 14 | Repositories whose base branch uses a merge queue are not auto-merged | `gh pr merge` would queue instead of merge, and the queue could land it after the switch is turned off | review-round-1 |
| 15 | Merge only when the check card has at least one step `agent: "matched"` and none `broken`; otherwise no merge | Collin: merge only after an agent actually tried it | user |
| 16 | Supersedes #13: the lead marks a done card `verified: true` only when it holds a passing check of this exact change; the hub merges only if **every** done card in the thread carries it. Old leads, restarted leads that can't tell, and "push it as it is" all omit it, so they never auto-merge | Positive evidence instead of a warning flag; one unverified push holds the PR for good | review-round-2 |
| 17 | Supersedes #14 and the `gh pr merge` call: merge through GitHub's REST merge endpoint with the exact `sha`, which merges immediately or refuses, never queues or turns on GitHub auto-merge | Removes the merge-queue lookup, the post-merge state check and `--disable-auto` | review-round-2 |
| 18 | "Still working out" from GitHub is re-checked every 20 s for up to 2 minutes before giving up | It is a passing state right after main moves | review-round-2 |
| 19 | With the switch on, a check card with no `matched` step also gives the "Not merged automatically" card | Collin should not wait for a merge that won't come | review-round-2 |

## Spec

### Behaviour in one paragraph

A new global preference `auto_merge` (`off` | `on`, default `off`) is shown on the Settings
page. When the hub accepts a `check` card and the switch is on, the hub decides whether
that thread's pull request may merge (gates below). If so, it re-checks the pull request
on GitHub and merges it at exactly that commit. A success
shows up as the existing `merged` card; anything else gives one app `needs` card saying it
was not merged and why. With the switch off, nothing happens and threads end exactly as
today. Leads never merge.

### 1. The setting

- `viewer/app/settings.js`: add `auto_merge` to defaults (`'off'`), normalization (anything
  other than `'on'` becomes `'off'`) and the preferences response.
- `viewer/app/routes.js` PUT preferences: accept `body.auto_merge` in `['off','on']`, else
  400 `auto_merge must be off or on`; include `auto_merge` in the response object.
- `viewer/pages/settings.js`: one on/off control, label "Merge pull requests when done",
  help text: "When on, a thread merges its own pull request once an agent has seen at least one
  Check it yourself step work and none broke. It never merges past failing checks, conflicts or
  GitHub's rules." Saved like the other preference controls.
- Nothing is written into agents' instructions.

### 2. The `done` card's new field

`verified` (boolean, optional; `cards-lead.md` done table; `card.js` validation accepts it).
The lead sets `verified: true` only when, for the commits this done card covers, it holds a
passing check: the sub-lead's build `result` (planned build), or a passing verifier
`result` for the small fix, after-done fix or repair at this head (including a lead-check
pass whose only gaps were rare paths). It omits it when the user chose "push it as it is",
when shipping a surviving gap, and whenever it cannot tell (for example a restarted lead
whose context has no such result).

### 3. The hub's auto-merge (new module `viewer/app/auto-merge.js`)

Called right after a `check` card is saved in `viewer/app/cards.js` (the `kind === 'check'`
branch), without delaying the card post's response. Under `hub.withThread`, reload the
thread and check, in order:

1. `auto_merge` setting is `on`. Else stop, silently.
2. The check card's `head` equals the current done card's `head` (`currentDone`). Else stop,
   silently.
3. `thread.auto_merge_attempts` has no entry for this `head`. Else stop, silently.
4. Every non-retracted `done` card in the thread has `verified: true`. Else outcome
   `held`, reason "a change in this pull request was pushed without passing its check".
5. The check card has no step `agent: "broken"`. Else stop, silently (the check card's
   own Fix it now / Leave it already asks Collin).
6. The check card has at least one step `agent: "matched"`. Else outcome `held`, reason "no
   agent could try any of the Check it yourself steps".

A `held` outcome is recorded and noticed as in Finishing below, without contacting GitHub.
Otherwise record `thread.auto_merge_attempts[head] = { at, outcome: 'started' }`, save, and
leave the lock. Then:

7. `gh pr view <pr_url> --json state,mergeStateStatus,headRefName,baseRefName,headRefOid,statusCheckRollup`,
   judged by `judgePr` (`viewer/app/pr-gate.js`). `MERGED`: outcome `already-merged`
   (no card). `CLOSED`: outcome `closed` (no card). While the reason is "GitHub is still
   working out…" or `gh` could not be reached, repeat every 20 s, at most 2 minutes. Any
   other not-ok, or still not ok after 2 minutes: outcome `not-ready` with the reason.
8. `gh api -X PUT repos/<owner>/<repo>/pulls/<number>/merge -f sha=<head> -f merge_method=merge`,
   timeout 60 s. Exit 0 with `"merged": true`: outcome `merged`. A non-zero exit: outcome
   `failed`, reason the API's `message` (for example a required review, branch protection,
   a merge queue, or the head having moved) or the first stderr line. A timeout: outcome
   `unknown`.

**Finishing.** Under `hub.withThread`, reload the thread, set the outcome on
`auto_merge_attempts[head]` (`{ at, outcome, reason }`) and, for `held`, `not-ready`,
`failed` and `unknown`, add an app `needs` card (`{ system: true }`) in the same save:
title "Not merged automatically", body the reason in plain words, then "The pull request is
still open; you can merge it on GitHub." (`unknown`: "GitHub didn't answer in time; check
the pull request on GitHub."). Success adds nothing: the merged sweep posts the `merged`
card.

A hub restart while an attempt is `started` leaves it as is: it is not retried. The hub's
own `gh` login is used; if it cannot merge, step 8 fails and the card says so.

### 4. Lead protocol (`protocol/app/lead.md`, `cards-lead.md`)

- Step 8: replace "Never merge." with "Never merge: the app merges finished pull requests
  itself when the user's auto-merge setting is on."
- Every place the lead posts `done` (steps 1, 8, 9, and Making the pull request mergeable)
  states the `verified` rule from §2.
- Check card `update` text: phrase the merge so it holds either way ("Once the pull
  request is merged, …"), never "merge the pull request".
- A "Not merged automatically" card is the app's own; the lead does not resolve it and
  need not react.
- `cards-lead.md` done table gets the `verified` row.

### 5. Not changed

Planning, review, verification, the done gate, `pr-wait.py`, the merged sweep, and after-done
handling of merged pull requests (stubs). A broken check never merges; "Fix it now" fixes
the open pull request, and that fix's own done and check card go through the same gates.
"Leave it" leaves it open.

### Edge cases

- Switch turned off before the check card: nothing happens.
- Every step `not-tried`: gate 6, `held` card; the PR stays open.
- PR head moved after the check: `judgePr` or the API's `sha` stops it; card.
- PR already merged or closed by Collin: step 7 stops without a card.
- Branch protection, required review or merge queue: step 8 fails; card.
- A check failing on the same commit after done: step 7's `judgePr` stops it.
- Check card posted while the hub is down (queued): the merge happens when the hub accepts
  the card, since the trigger is the hub's acceptance.
- A thread with any earlier done lacking `verified` (pushed as is, or posted by an older
  lead): gate 4 holds it for the rest of the thread.

### Validation

- `cd viewer && npm test` passes, including new tests (stubbed `gh` on PATH) for:
  preferences round-trip and validation of `auto_merge`; gates 1–3 and 5 stop with no
  `gh` call and no card; gates 4 and 6 give a `held` record and card with no `gh` call;
  one attempt per head; step 7 retries "still working out" then gives `not-ready`; step 7
  `MERGED`/`CLOSED` give no card; step 8 argv exactly
  `api -X PUT repos/<o>/<r>/pulls/<n>/merge -f sha=<head> -f merge_method=merge`; a step 8
  failure gives the card with the API message; finishing keeps a card saved by another
  writer during the GitHub calls; `done` card `verified` accepted by validation.
- `grep -n "auto_merge" viewer/app/settings.js viewer/app/routes.js viewer/pages/settings.js`
  shows the setting in all three.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** claude / opus 5.5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | All-`not-tried` check merges, against Decision 5 | user-decision | Collin: leave it open (#15) |
| intent | minor | Restart retries a refused merge | upheld | No lead restart branch: hub records one attempt per head (#12) |
| intent | minor | Hub could merge itself | upheld | Adopted (#10); credentials concern handled by the `needs` card |
| intent | minor | Say why the gate can skip GitHub | upheld | Moot: hub re-checks readiness (#11) |
| mechanics | blocking | All-`not-tried` merges | user-decision | #15 |
| mechanics | blocking | Checks can fail after done; `gh` merges UNSTABLE | upheld | Re-check with `judgePr` before merge (#11) |
| mechanics | blocking | Merge queue / auto-merge reports success while open | upheld | No merge-queue repos; verify MERGED after, else `--disable-auto` (#14) |
| mechanics | blocking | A person's PR from the thread branch could be merged | declined | The `wc/<thread>` branch is the thread's own; the done gate already binds branch, base and head (pr-gate.js:8-14). IDEA excludes PRs not from wheelchair threads, which this is not |
| mechanics | major | Pushed-as-is fix would merge | upheld | `unverified` done flag (#13) |
| mechanics | major | Restart can't tell what happened | upheld | Hub records one attempt per head (#12) |
| mechanics | major | Queued check card | upheld | Trigger is the hub's acceptance |
| mechanics | blocking (rare path) | Stale lead token could merge | upheld | No lead command (#10); permission issues are always fixed |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-21

**Lanes:** claude / opus 5.5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round 1:** The merge moved from a lead command to the hub, triggered when it accepts a check card (§3, Decisions 10–15): readiness re-check with `judgePr`, merge-queue refusal, one attempt per head, post-merge state check with `--disable-auto`, app `needs` card on failure; new `unverified` done-card field (§2); lead protocol changes reduced (§4); merge requires at least one `matched` step.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | A later verified fix merges an earlier unverified push | upheld | Every done must be `verified` (#16) |
| intent | major | One "still working out" read ends the merge | upheld | Re-check for 2 minutes (#18) |
| intent | minor | No notice when no step was tried | upheld | `held` card (#19) |
| mechanics | blocking | Same as intent's first | upheld | #16 |
| mechanics | blocking | Restarted lead loses the push-only decision | upheld | `verified` is positive; a lead that can't tell omits it (#16) |
| mechanics | blocking | Old leads post done without the flag | upheld | Absent `verified` holds (#16) |
| mechanics | major | `--disable-auto` cancels Collin's own auto-merge | upheld | No `--disable-auto`; REST merge never enables it (#17) |
| mechanics | major | Saving after GitHub calls can overwrite | upheld | Finishing reloads under the lock, outcome and card in one save |
| mechanics | blocking (rare path) | Queue enabled between lookup and merge | upheld | Moot: REST merge never queues (#17) |
| mechanics | minor | Notice always says "open" | upheld | Closed/merged give no card; timeout has its own wording |

### Round 3 — 2026-11-21

**Lanes:** claude (intent); non-claude (mechanics); cross-family: yes.

**Changed since Round 2:** §2 replaced: `unverified` became a positive `verified` done-card field, required on every done in the thread (#16). §3 rewritten: gate order (4 verified, 5 broken, 6 matched) with `held` cards; GitHub's REST merge endpoint replaces `gh pr merge`, the merge-queue lookup and `--disable-auto` (#17); "still working out" re-checked for 2 minutes (#18); finishing reloads under the lock. §4 lead rule for `verified`. Edge cases and Validation updated.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           | pre-existing / partial | | high / low |

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
