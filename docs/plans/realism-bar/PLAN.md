---
slug: realism-bar
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# A realism bar for plan review and verification

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: What happens to a rare-path finding?
- **Context:** In Kimi Code the GPT reviewer and verifier kept reporting new rare paths each round. With no record, the next round raised new variants.
- **Options:** (A) reported, tagged rare, lead records it in Accepted Risks without asking; (B) not reported at all; (C) lead fixes it if the fix is tiny, else accepts.
- **Recommendation:** A.

### Q2: In two-part mode, do rare paths go to Deferred (the follow-up thread) or Accepted Risks?
- **Context:** Deferred feeds a follow-up thread, which would chase the same rare paths again.
- **Options:** (A) Accepted Risks in every mode; Deferred keeps realistic hardening only; (B) Deferred as today.
- **Recommendation:** A.

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
| 1 | Mode is thorough | Collin picked it | user |
| 2 | Normal use means a healthy machine, ordinary user actions, and input the real tool actually produces. A plain restart, a killed session or a closed browser tab is normal use. Rare paths: a crash or restart combined with lost or corrupted state files, sub-second races between two actors, files swapped or edited mid-operation, tampering by a local user or agent, malformed input the source never writes, unusual screen layouts | Follows Collin's Kimi Code decision 59 (wc/01b8cb1bf051:docs/plans/kimi-code/PLAN.md) | defaulted |
| 3 | Always fixed regardless of how rare: security or secret leaks, permission bypass, building the wrong thing, anything a Spec validation command checks, and silent loss of Collin's work in normal use | IDEA.md Not doing; Collin's memory rules on leaks and wrong builds | defaulted |
| 4 | When the lead cannot tell whether a finding is normal use, it asks Collin with a question card; otherwise it decides without asking | IDEA.md What good looks like | defaulted |
| 5 | The clean test and review budget are unchanged: an accepted-risk finding already does not block a clean round | lead.md clean test counts only upheld blocking/major and open user-decisions | defaulted |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

## Deferred

Optional; present only in the lighter modes.

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

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
