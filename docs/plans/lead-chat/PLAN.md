---
slug: lead-chat
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Leads that know about each other

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: When does a lead look at what the other leads are doing?
- **Context:** Without a trigger in the lead rules, leads will rarely think to look. Each look costs a lead turn.
- **Options:** (A) at set points: once mapping finishes, before Start building, and whenever the user asks; (B) only when the user asks; (C) the hub tells every lead in the project whenever a thread starts or changes plan status.
- **Recommendation:** A.

### Q2: How does the user allow a message to a lead in another project?
- **Context:** The user wants cross-project messages only with their OK; no extra security.
- **Options:** (A) the lead asks with a question card naming the other thread; a yes lets this lead message that thread for the rest of this thread; (B) a yes covers one message only; (C) a Settings switch per project pair.
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
| 1 | Plan mode is two-part | User's pick on the mode card | user |
| 2 | A lead addresses another lead by its session name (`wc-<thread-id>-lead[-n]`) in a `message` card's `to`; the hub resolves names across threads only for lead-to-lead messages | Session names are already unique; no new card kind needed | defaulted |
| 3 | "Same project" means the same resolved project path on the same machine; other machines are never listed or reachable | IDEA.md: same machine, same project | defaulted |
| 4 | The listing shows threads that are not archived and have a live lead, excluding the caller's own thread | Archived or dead threads cannot answer | defaulted |
| 5 | The summary is built from what the hub already has: thread title, latest lead, pinned idea bullets, pinned progress line, plan slug and status, PR link if any; no new summary text written by leads | Cheapest; always current; no extra lead turns | defaulted |
| 6 | Cross-thread messages stay hidden in both threads, like in-thread messages; the receiving lead answers with its own `message` back | IDEA.md constraint; reuses existing delivery | defaulted |
| 7 | `asks` works across threads; `passes_on` still only references a question from the poster's own thread | A lead that needs its user's decision posts its own question card | defaulted |
| 8 | If two leads agree on a split that changes what either user-facing plan promises, each lead takes it to its user as a card before acting | Leads may not change scope without the user (lead.md, IDEA.md stability) | defaulted |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

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
