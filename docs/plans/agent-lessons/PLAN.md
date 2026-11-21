---
slug: agent-lessons
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Agents save lessons learned

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q2: Who writes lessons for reviewers and verifiers?
- **Context:** Reviewers and verifiers are fresh each time, cannot post cards (`viewer/app/card.js:28`), and never see a mistake cost time: the lead triaging them does. IDEA.md says an agent saves lessons only for its own type.
- **Options:** the lead writes lessons for the reviewers/verifiers it oversees; reviewers/verifiers get no lessons; they propose one in their report and the lead saves it.
- **Recommendation:** they propose one in their report, the lead decides and saves it (keeps "own type" authorship of the wording, lead applies the bar).

### Q3: Does Collin hear about a new lesson?
- **Context:** Lessons are agent-managed and take effect for agents started afterwards.
- **Options:** saved quietly (visible in Settings); a short notice in the thread; needs Collin's OK first.
- **Recommendation:** a short notice in the thread, no approval needed.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | Collin's pick; learn what lessons are useful before hardening | user |
| 2 | A lesson reaches only agents of the type that saved it | Collin: an agent saves lessons only for its own type of agent | user |
| 3 | Lessons are shared across AIs; an agent may mark one as only for its own AI | Most lessons are about the job; a few are one AI's quirks | user |
| 4 | Shown in Settings › Behavior templates as one agent-written "Lessons learned" entry per agent type, marked apart from Collin's templates, editable with a warning | Collin: no new row per lesson; a template that can be edited but isn't recommended to | user |
| 5 | Bar for a lesson: cost real time and proven wrong (Collin's correction or a check failing twice for the same reason), recurs for that agent type across threads, one or two sentences | Collin picked "Cost + proof" | user |
| 6 | Lessons are their own always-on layer between wheelchair's role rules and Collin's in-use template; Collin's template wins where they disagree | Only one template per role is in use (`viewer/app/settings.js:131`); lessons must not replace it | defaulted |
| 7 | Lessons are stored by the hub with the other settings (`settings.json`, queued writes, `viewer/app/state.js:241`) and added to role layers at session start | One store every machine's agents get through role layers (`viewer/app/sessions.js:324`); works for every AI | defaulted |
| 8 | A lesson that conflicts with the rules or should always apply is not saved; the lead offers a stub for a protocol change instead | IDEA.md Not doing | defaulted |
| 9 | Running agents keep the lessons they started with | IDEA.md Not doing; prompts are a snapshot at start (`machine/service.js:781`) | defaulted |
| 10 | Lessons apply to all projects; an agent may mark one as only for the project it learned it in | Collin picked "All, unless marked" | user |

## Spec

To be written as decisions land.

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
