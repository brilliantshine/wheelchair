---
slug: lessons-hardening
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Make agent lessons solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q3: How are incoming lessons (file import or handoff) added?
- **Context:** Ids don't match across installs, so incoming lessons are matched by agent type + text. The cap of 12 per type stays. Handoff import may complete later and retry (`viewer/app/handoff-import.js:26`), so adding must be safe to repeat.
- **Options:** (a) added automatically: identical ones skipped, new ones added, overflow past 12 held for you to pick; (b) all held in Settings for you to accept or reject each; (c) automatic, incoming replaces a similar existing one.
- **Recommendation:** (a).

### Q2: What marks a lesson as possibly stale?
- **Context:** Nothing records reconfirmation; `saved_at` changes on every edit (`viewer/app/settings.js:213`). Lessons don't reference rules.
- **Options:** (a) age only: not saved or kept for N days; (b) age plus agents reconfirming lessons that helped; (c) also rule-file changes since the lesson was saved.
- **Recommendation:** (a), 90 days, with a Keep button that resets it.

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
| 1 | Mode: thorough | Chosen by Collin before planning | user |
| 2 | Every change to a lesson (agent add/replace/remove, Settings edit/remove, restore, import) records the previous version with who changed it and when; up to 20 versions per lesson are kept, oldest dropped first | Enough to undo any realistic run of changes without growing settings without bound | defaulted |
| 3 | Removed lessons stay findable in Settings with their history (the 50 most recently removed across all agent types) and can be restored | "A removed lesson can be found again" (IDEA.md) needs a home for them | defaulted |
| 4 | Restoring is a user action: the restored lesson is marked "(edited by the user)" | Matches how Settings edits already make a lesson user-owned (`viewer/app/routes.js:229`) | defaulted |
| 5 | Restoring a removed lesson into an agent type that already has 12 is refused with a plain message to remove one first | The cap of 12 stays (IDEA.md Constraints) | defaulted |
| 6 | Lessons travel two ways: Export/Import of a lessons file in Settings, and handoffs carry lessons automatically; both use the same merge rule | Q1 answered "File and handoffs" | user |
| 7 | A project-only lesson in a handoff is re-scoped to the project path the thread is imported into; in a file import it keeps its path | The exact path differs between installs (`viewer/app/settings.js:183`); a handoff knows the destination, a file does not | defaulted |
| 8 | Handoffs from an install without lessons support still import; an install without support importing a newer handoff is out of scope | IDEA.md Constraints name only the first direction | defaulted |
|   |          |           | user / defaulted / adopted / idea-change / review-round-N |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

### S1 History (draft)
Decisions 2–5.

### S2 Carrying lessons (draft)
Decisions 6–8. Merge rule: Q3.

## Deferred

Optional; present only in the lighter modes.

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
