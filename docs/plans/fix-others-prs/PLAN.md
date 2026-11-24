---
slug: fix-others-prs
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-23
---

# Fix other people's pull requests

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.


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
| 1 | Mode two-part | Collin's pick on the mode card | user |
| 2 | Collin's OK is given once per pull request per thread, through a dedicated card the app records (target PR link, head branch, head repo), not a plain question card | The done gate and auto-merge must know the target PR; a recorded card is what the app can read | defaulted |
| 3 | Pushes to another person's PR are plain (non-force) pushes; on rejection: fetch, merge, re-verify, push again | Never overwrites the author's work (IDEA) | defaulted |
| 4 | The thread never opens its own PR when it is fixing someone else's; its done card points at the target PR | IDEA: no replacement PR | defaulted |
| 5 | The thread does not post reviews or comments on GitHub; review findings stay in the thread | Keeps scope to fixing; can be added later | defaulted |
| 6 | A thread takes on someone else's PR when Collin names it in chat ("fix PR #173"); no new start screen. A picker is deferred | Collin's pick; matches how Junjie's thread worked | user |
| 7 | The app never auto-merges a PR the thread did not open; the done card says it is fixed and ready, and Collin or the author merges | Collin's pick: it is the author's PR and they may still be working | user |

## Spec

A plan with visible work lists its agreed mockups under “Mockups” (path, screen/state, size) instead of describing the look in prose.

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

## Deferred

Optional; present only in the lighter modes.

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Fixing pull requests that come from a fork | Collaborators push branches to this repo (PR #173 did); forks need the author's "allow edits by maintainers" and pushing to their repo | planning | Query `maintainerCanModify` and `headRepository`; push to the fork URL; until then the thread says it can't push and offers a replacement PR |
| D3 | A "Start from a pull request" picker on the new-thread screen | Naming the PR in chat works for normal use | planning | `viewer/pages/new.js:229-241`, `machine/service.js:668-713` create threads from main today |
| D2 | The machine itself refusing pushes to branches the thread has no OK for | Today's own-branch rule is also only a protocol rule; the recorded OK makes this possible later | planning | `machine/service.js:1588-1613` passes push args through; check refspec against own branch or recorded target |

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

### Round 1 — <date>

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
