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

## Spec

### Behaviour in one paragraph

A new global preference `auto_merge` (`off` | `on`, default `off`) is shown on the Settings
page. With it on, after a thread's lead has posted the `check` card for its current done
head, the lead asks for the merge with `wc.js pr merge --head <done head>`. The hub allows
it only when every gate below holds; the machine service then runs
`gh pr merge <pr-url> --merge --match-head-commit <done head>` in the thread's worktree.
With it off, the command is refused with `auto-merge is off` and the lead does nothing
more, so threads end exactly as today.

### 1. The setting

- `viewer/app/settings.js`: add `auto_merge` to defaults (`'off'`), normalization (anything
  other than `'on'` becomes `'off'`) and the preferences response.
- `viewer/app/routes.js` PUT preferences: accept `body.auto_merge` in `['off','on']`, else
  400 `auto_merge must be off or on`; include `auto_merge` in the response object.
- `viewer/pages/settings.js`: one on/off control, label "Merge pull requests when done",
  help text: "When on, a thread merges its own pull request after its Check it yourself
  steps were tried and none broke. It never merges past failing checks, conflicts or
  GitHub's rules." Saved like the other preference controls.
- The setting is read by the hub at the moment of each merge request; nothing is written
  into agents' instructions, and running threads see a change at their next request.

### 2. The merge command

- `viewer/app/wc.js`: new top-level command `pr` with one operation, `merge`, requiring
  `--head <40-char lowercase hex>`; anything else is a usage error. It posts to the
  machine service's agent endpoint (same auth path as `/git`), new path `/pr-merge`,
  body `{ head }`.
- `machine/service.js` `/pr-merge`: authenticates the calling session as for `/git`, then
  asks the hub over the existing machine→hub channel (`/api/machine/session`, as session
  start/stop do, `machine/service.js:1563-1580`) with `{ action: 'pr-merge-gate', head,
  calling_session }`. If the hub allows, it gets back `{ pr_url }` and runs
  `gh pr merge <pr_url> --merge --match-head-commit <head>` in the session's recorded
  worktree. It returns `{ ok, status, stdout, stderr }` like `/git`. A hub refusal is
  returned as `{ ok: false, refused: <reason> }` with a non-2xx status and `gh` is not run.
- Hub gate (`pr-merge-gate`), checked in this order, each refusal a 422 with the text shown:
  1. caller is the thread's lead: `only the lead can merge`
  2. `auto_merge` is `on`: `auto-merge is off`
  3. the thread's latest non-retracted `done` card exists and its `head` equals `head`:
     `that is not the current done head`
  4. a non-retracted `check` card with that `head` exists: `no check card for this head yet`
  5. no step on that check card has `agent: "broken"`: `the check found something broken`
  6. the thread has a `pr_url` (from the done card): `this thread has no pull request`
  On success it returns `{ pr_url }`. The gate does not query GitHub; `--match-head-commit`
  and GitHub's own rules decide the rest.
- Update `viewer/app/API.md` and `machine/API.md` for the new command and endpoint.

### 3. Lead protocol (`protocol/app/lead.md`, and `cards.md`'s command list)

- Remove "Never merge." from step 8 and say instead that the lead merges only through
  `wc.js pr merge`, as step 10 describes.
- Step 10, Posting: after the `check` card is accepted (or the duplicate refusal), if no
  step is `broken`, run `wc.js pr merge --head <done head>`:
  - success: say in one line of the reply that the pull request was merged.
  - `auto-merge is off`: do nothing, say nothing about merging.
  - any other refusal or a `gh` failure: say in one line that it was not merged and why,
    in plain words, and that the user can still merge it on GitHub. Never retry, never merge any other way.
- A broken step: no merge. "Fix it now" goes through step 9 as today; the fix's own done
  and check card then follow this same rule. "Leave it": no merge.
- Check card `update` text: phrase the merge step so it holds either way ("Once the pull
  request is merged, …"), never "merge the pull request".
- Restart (step 10 Restart): if the latest current done card has a check card at the
  same head with no broken step, and `gh pr view --json state,headRefOid` shows `OPEN` at
  that head, run `wc.js pr merge --head <head>` as in Posting.
- First release: in the thread that builds this feature the installed hub lacks the
  command; that thread does not merge.
- `cards.md` "The commands, in one place": add `node <root>/viewer/app/wc.js pr merge --head <commit>`.

### 4. Not changed

Planning, review, verification, the done gate, `pr-wait.py`, the merged-card sweep (it
posts the `merged` card within a minute of the merge, as for a manual merge), and after-done
handling of merged PRs (stubs).

### Edge cases

- Setting turned off between the check card and the merge request: refused, PR stays open.
- PR head moved after the check (someone pushed): `--match-head-commit` makes `gh` fail;
  reported in one line, not retried.
- PR already merged by Collin: `gh` fails or reports merged; the lead reports it in one line
  only if it failed.
- Branch protection or required review: `gh` fails; reported, PR stays open.
- Check card with every step `not-tried`: allowed (none broke).

### Validation

- `cd viewer && npm test` passes, including new tests for: preferences round-trip and
  validation of `auto_merge`; each hub gate refusal and the allow case; `wc.js pr merge`
  argument checking.
- `cd machine && node --test test/*.test.js` passes, including a test that `/pr-merge`
  does not run `gh` on a hub refusal and runs exactly
  `gh pr merge <url> --merge --match-head-commit <head>` (stubbed `gh`) on allow.
- `grep -n "Never merge" protocol/app/lead.md` prints nothing.

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

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

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
