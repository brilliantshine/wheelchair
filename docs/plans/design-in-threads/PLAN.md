---
slug: design-in-threads
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-22
---

# Design work inside a thread

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/thread-visual-design.md`.

## Open Questions

Ordered by leverage; discussed one at a time.

### Q2: How does a mockup show in the thread?
- **Context:** HTML diagrams render live in a 340px-tall box; "Open full size" downloads the HTML instead of showing it (`viewer/pages/thread.css:207`, `viewer/pages/picture.js:61-75`). A phone screen mockup does not fit.
- **Options:** (a) render the mockup HTML to a PNG on the machine (headless browser) and post it as an image; (b) show the HTML live in a phone-shaped frame, with full size showing it rather than downloading; (c) both.
- **Recommendation:** (b), with PNG export as a fallback.

### Q3: How do build screenshots reach the thread?
- **Context:** Workers already screenshot visible work and pass paths up; only the lead posts image cards, so screenshots arrive only if the lead relays them (`protocol/app/worker.md:45`, `protocol/app/sub-lead.md:179`).
- **Options:** (a) let the sub-lead post image cards directly as each visible task finishes; (b) the lead relays each one; (c) one batch per build stage.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode two-part | Collin's pick: core flow first, hardening in a follow-up thread | user |
| 2 | No dedicated Claude Design import path; the build-follows-the-mockup part folds into the screenshot check | Collin: B can go if making designs here and seeing them early are good | user |
| 3 | The agreed mockup is a file in `docs/plans/<slug>/` that the Spec points to; workers build against the file, and a visible difference from it is a gap the verifier reports | Prose paraphrase of a design is where the 20-30% loss happens | defaulted |
| 4 | User feedback on mockups is given in chat (no tap-to-comment on the picture) | Simplest; tap-to-comment is hardening | defaulted |
| 5 | A new design agent role drafts and revises mockups; the lead starts it during planning, briefs it, and posts what it makes | Collin's pick: mockups get a focused agent and the lead stays free to talk | user |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added at approval.

### Mockups as the source of truth

- An agreed mockup is a file under `docs/plans/<slug>/` (location and format settled below). The Spec of a plan with visible work names each mockup file and which screen or state it shows, instead of describing the look in prose.
- Workers building visible work open the mockup and build to match it. Verifiers compare the built screen with the mockup; a visible difference is a gap.

### The design agent

- A new session role, `designer`. Only a lead may start it, during planning (before `approved`). It drafts and revises mockup files on the lead's brief, commits only those files, and reports each version to the lead with a `result`. It does not talk to the user and posts no shown cards; the lead posts the mockups.
- The lead relays the user's chat feedback to it as `message`s while it is live, and stops it when the user has agreed the mockups or planning moves on.

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
