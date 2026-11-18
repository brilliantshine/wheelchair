---
slug: self-check-steps
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Check-it-yourself steps after Done

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: Where does Collin run the checks?
- **Context:** Threads change different things: the app's screens (seen on his phone), the
  machine service or scripts (seen by running a command), protocol docs (seen by reading a
  lead's behaviour). He reads threads on a phone.
- **Options:** phone-only steps; machine commands; whatever fits the change, phone first.
- **Recommendation:** whatever fits the change, phone first.

### Q2: How the steps are shown
- **Context:** MAP.md: the done card holds `can_do`/`left_as_is` lists and is only accepted
  once GitHub says the PR is ready (`viewer/app/card.js:125-132`, `viewer/app/pr-gate.js`).
  A new field needs schema, protocol, page and handoff changes; a new kind also needs role,
  pin and kind handling (`viewer/app/cards.js:9-34`, `viewer/app/handoff.js:34-46`).
- **Options:** a "Check it yourself" section on the done card; a separate card posted right
  after done.
- **Recommendation:** a section on the done card: one card, same gate, less to build.

### Q3: Are the steps tried before he sees them?
- **Context:** PLAN validation commands and verifier reports describe agent checks, not
  steps a person follows; small fixes have no plan (MAP.md). The lead writes the steps
  either way; the open point is whether a verifier follows them first.
- **Options:** lead writes them, unchecked; the verifier also follows the steps and the lead
  fixes any that do not match.
- **Recommendation:** the verifier follows them, so a step never shows something untrue.

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
| 1 | Plan mode: thorough | Collin's pick on the mode card | user |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

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
