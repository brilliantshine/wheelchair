---
slug: plan-modes
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Plan modes: thorough, two-part, proof of concept

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q4: Is the follow-up plan reviewed in this thread, or only in the new one?

### Q5: Can the mode change partway through planning?

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | Q1 decided | Where the mode suggestion appears: its own question card after the offer is accepted, or folded into the offer card's buttons (an app change). Depends on the mapper's findings on the offer card | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
|   |          |           | user / defaulted / adopted / idea-change / review-round-N |
| D1 | The lead suggests a mode with a one-line reason when a thread becomes a feature; Collin accepts it or picks another | The lead has read the request and can tell a proof of concept from lasting work; Collin keeps the final say | user |
| D2 | In two-part and proof-of-concept, plan review still runs. Findings that would build the wrong thing or cannot be built must be fixed; findings that only make it sturdier are deferred to the follow-up plan (two-part) or accepted as risks (proof of concept) | Keeps the check that stops a wrong build, drops only the hardening Collin chose to postpone | user |
| D3 | Deferred items show on a pinned running list, like "Your idea so far", updated as items are added in planning or review. Removing one pulls it back into the first build | Collin sees deferrals as they happen and can reverse one with a press, without a card per item | user |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

### Modes

Three modes: `thorough` (default, today's behaviour unchanged), `two-part`, `proof-of-concept`.

### Choosing the mode

When a thread becomes a feature, the lead suggests a mode with a one-line reason and
Collin accepts it or picks another (D1). With no choice made, the mode is `thorough`.

### Plan review in the lighter modes

Review runs in every mode (D2). In `two-part` and `proof-of-concept`, a finding that would
build the wrong thing or cannot be built is fixed in the Spec as today. A finding that only
makes the feature sturdier (edge cases, hardening, polish) is not fixed: in `two-part` it is
moved to the follow-up plan, in `proof-of-concept` to Accepted Risks. Either counts as
resolved for the clean test.

### Seeing what is deferred

In the lighter modes, a pinned list shows every deferred item as it is added, during
planning or review (D3). It works like the idea card: each item has a remove button, and
removing one pulls that item back into the first build's Spec. In `proof-of-concept` the
list shows what is being accepted as risk.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

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
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
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
