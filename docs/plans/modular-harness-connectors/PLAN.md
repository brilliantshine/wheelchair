---
slug: modular-harness-connectors
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-22
---

# Make harness connectors modular

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/harness-connector-dispatch.md` (current inventory of every
name-based branch, with file:line).

## Open Questions

### Q1: Where does each connector live?
- **Context:** A connector has two halves today: the machine part (`machine/adapters/<cli>.js`: launch, login, turn end, transcript) and app-side behaviour scattered in the hub and settings page (chat parsing, report picking, model rules, usage display, install recipe, model defaults in `codex/model.sh`). Every machine runs from a full clone of the repo, so a shared folder both sides import is possible.
- **Options:** (A) one folder per connector, `connectors/<name>/`, holding both halves, its install recipe, settings details and model defaults; (B) keep the machine adapter where it is and add a matching app-side connector file, both checked against a written contract.
- **Recommendation:** A — it is what "adding a tool is one connector" means; B leaves every new tool touching two places.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Chosen on the mode card | user |
| 2 | The settings page gets the tool list and per-tool details from the hub instead of its own copy (`viewer/pages/settings.js:15-16`) | A second hand-kept list is exactly what this refactor removes | defaulted |
| 3 | `codex/model.sh` reads its provider list and default pins from the same registry data (via a generated or shared JSON file), not its own tuple (`codex/model.sh:14-38`) | Same reason; bash/python cannot import the JS table directly | defaulted |
| 4 | A connector must provide: launch, ready detection, first message, turn-end detection, transcript binding and chat parsing, login and login status. Everything else (usage probe, spend, live account switch, aside turns, effort levels, preflight, version check, startup diagnostics) is optional and declared; the app treats an undeclared optional feature as "not supported" the way it does today for tools that lack it | Lets a new tool be added minimally without silently missing required pieces | defaulted |
| 5 | A conformance test loads every connector and registry entry and fails on a missing required piece or an undeclared capability being used | In IDEA.md's "What good looks like" | defaulted |
| 6 | Behaviour is pinned before moving code: existing tests stay green, and each of the five tools gets characterization tests for the branches being moved where none exist | IDEA.md constraint: no behaviour change | defaulted |
| 7 | One pull request; no new tool added | Thread scope; IDEA.md Not doing | defaulted |

## Spec

_Grown as decisions land._

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
