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

## Spec

### Behaviour in one paragraph

A new global preference `auto_merge` (`off` | `on`, default `off`) is shown on the Settings
page. When the hub accepts a `check` card and the switch is on, the hub decides whether
that thread's pull request may merge (gates below). If so, it re-checks the pull request
on GitHub and runs `gh pr merge <pr-url> --merge --match-head-commit <head>`. A success
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

`unverified` (boolean, optional; `cards-lead.md` done table): true when the change in this
done card failed its own check and was pushed at the user's request ("push it as it is"
after a small fix's or an after-done fix's surviving gap; a planned build whose surviving
gap the user chose to ship). `card.js` validation accepts it.

### 3. The hub's auto-merge (new module `viewer/app/auto-merge.js`)

Called right after a `check` card is saved in `viewer/app/cards.js` (the `kind === 'check'`
branch), without delaying the card post's response. It runs under `hub.withThread` for
the thread and does nothing more if any gate fails, in this order (a failing gate before 4
is silent: no card, no record):

1. `auto_merge` setting is `on`.
2. The check card's `head` equals the current done card's `head` (`currentDone`), and the
   done card has no `unverified: true`.
3. `thread.auto_merge_attempts` has no entry for this `head`.
4. The check card has at least one step `agent: "matched"` and no step `agent: "broken"`.

Then it records `thread.auto_merge_attempts[head] = { at, outcome: 'started' }` and saves
before contacting GitHub. Then, outside the thread lock:

5. `gh pr view <pr_url> --json state,mergeStateStatus,headRefName,baseRefName,headRefOid,statusCheckRollup`
   and `judgePr` from `viewer/app/pr-gate.js`. If it is `MERGED`, stop (the merged sweep
   reports it). If not ok, outcome `not-ready` with `judgePr`'s reason.
6. Merge queue: `gh api graphql` for `repository(owner,name){ mergeQueue(branch:<base>){ id } }`.
   A non-null queue: outcome `refused`, reason "this repository merges through a merge
   queue, which auto-merge doesn't use".
7. `gh pr merge <pr_url> --merge --match-head-commit <head>` (no `--auto`, no
   `--delete-branch`), timeout 60 s.
8. `gh pr view <pr_url> --json state`. `MERGED`: outcome `merged`. Otherwise, run
   `gh pr merge <pr_url> --disable-auto` (ignore its result), outcome `failed`, with the
   first line of `gh`'s stderr as the reason or "GitHub did not merge it".

For any outcome other than `merged`, update the record and add an app `needs` card
(`{ system: true }`), title "Not merged automatically", body: the reason in plain words,
then "The pull request is still open; you can merge it on GitHub." The `merged` card the
sweep posts later is the success signal; no other card is added on success.

A hub restart while an attempt is `started` leaves it as is: it is not retried.

The hub's own `gh` login is used. If it cannot merge, step 7 fails and the `needs` card
says so.

### 4. Lead protocol (`protocol/app/lead.md`, `cards-lead.md`)

- Step 8: replace "Never merge." with "Never merge: the app merges finished pull requests
  itself when the user's auto-merge setting is on."
- Set `unverified: true` on the done card wherever the lead posts a done for work the user
  chose to push after it failed its check (step 1 small fix, step 7 surviving gap, step 9
  "push it as it is").
- Check card `update` text: phrase the merge so it holds either way ("Once the pull
  request is merged, …"), never "merge the pull request".
- A "Not merged automatically" card is the app's own; the lead does not resolve it and
  need not react.
- `cards-lead.md` done table gets the `unverified` row.

### 5. Not changed

Planning, review, verification, the done gate, `pr-wait.py`, the merged sweep, and after-done
handling of merged pull requests (stubs). A broken check never merges; "Fix it now" fixes
the open pull request, and that fix's own done and check card go through the same gates.
"Leave it" leaves it open.

### Edge cases

- Switch turned off before the check card: nothing happens.
- Every step `not-tried` (for example a protocol-only change): gate 4 fails silently; the PR
  stays open as today.
- PR head moved after the check: `judgePr` or `--match-head-commit` stops it; `needs` card.
- PR already merged by Collin: step 5 stops silently.
- Branch protection or required review: step 7 fails; `needs` card.
- A check failing on the same commit after done: step 5's `judgePr` stops it.
- Check card posted while the hub is down (queued): the merge happens when the hub accepts
  the card, since the trigger is the hub's acceptance.

### Validation

- `cd viewer && npm test` passes, including new tests (stubbed `gh` on PATH) for:
  preferences round-trip and validation of `auto_merge`; every gate in §3 1–4 (no `gh`
  call when one fails); one attempt per head; step 5 not-ready → `needs` card and no
  merge call; merge queue present → no merge call; step 7 argv exactly
  `pr merge <url> --merge --match-head-commit <head>`; step 8 not MERGED → `--disable-auto`
  and `needs` card; `done` card `unverified` accepted by validation.
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

**Lanes:** claude (intent); non-claude (mechanics); cross-family: yes.

**Changed since Round 1:** The merge moved from a lead command to the hub, triggered when it accepts a check card (§3, Decisions 10–15): readiness re-check with `judgePr`, merge-queue refusal, one attempt per head, post-merge state check with `--disable-auto`, app `needs` card on failure; new `unverified` done-card field (§2); lead protocol changes reduced (§4); merge requires at least one `matched` step.

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
