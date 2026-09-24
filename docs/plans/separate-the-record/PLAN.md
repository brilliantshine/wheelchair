---
slug: separate-the-record
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-09-03
---

# Separating a plan's specification from the record of how it was argued

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q2: How much of the round-by-round record does a Stage 2 reviewer read?

- **Context:** Decision 7 moves rejected alternatives out of the specification and into a
  list the reviewer is pointed at. What remains unanswered is the finding tables — the
  round-by-round record of what each reviewer reported and how the lead ruled on it, which
  is the bulk of the 3121 lines.

  Measured across all eight plans: 932 findings, of which **23 are `declined` or
  `accepted-risk`**. Every other one was upheld, and an upheld finding's fix is already in
  the specification — there is nothing left to re-raise. So today's reviewer reads roughly
  3100 lines of tables in order to learn 23 rows, and `protocol/plan-review.md:67-71` names
  exactly those two verdicts as the thing it must not re-raise.

- **Options:**
  - **The whole record, as today.** The reviewer's share of the cost is untouched, which is
    the idea's first stated cost.
  - **A settled list only.** Declined findings and accepted risks are promoted onto the same
    list the rejected alternatives live on, at the moment the lead rules on them. The tables
    stay where they are and stop being something anyone routinely reads. Costs: the
    promotion is a step the lead can forget, and a forgotten one silently re-opens a closed
    finding.
  - **A settled list, and the tables not handed to the reviewer at all.** Same as above, but
    the reviewer cannot read the tables even if it wants to. Only possible if the tables live
    in a document the reviewer is not given, which decides Q3 rather than leaving it open.

- **Recommendation:** the second. It is the only one that moves the reviewer's cost without
  spending the no-re-raise rule, and it keeps Q3 a real choice instead of settling it by
  side effect.

### Q3: Two files, or one file with a boundary?

- **Context:** The idea leaves this open. A second file is the only version where a stage
  can be handed less — Stage 4's verifier gets a path, and a path it does not have is a
  document it cannot read. A boundary inside one file is a prose rule with nothing behind
  it, and nothing tests these documents (`AGENTS.md:116-118`).

- **Options:**
  - **Two files.** `PLAN.md` becomes the specification; a second document holds the record.
    Costs: a fifth document in a list `README.md:175-185` presents to someone arriving cold,
    and seven code comments citing `PLAN.md §N` go stale silently.
  - **One file, hard boundary.** Nothing new to learn, no citations break. Costs: every
    reader still loads the whole file, which is most of what is being paid.

- **Recommendation:** two files, contingent on Q2. If the reviewer keeps reading everything,
  the second file buys only Stages 3 and 4 and the case is much weaker.

### Q4: What happens to the eight plans already in the tree?

- **Context:** Seven are in `docs/plans/`, mostly finished; `windows-support` is mid-flight
  on its own branch and will be reviewed again under whichever format is live when it
  resumes. Their records total 3121 lines.

- **Options:**
  - **Convert all eight.** Every plan reads the same way. Costs a mechanical pass over
    3121 lines with no test to catch a mistake.
  - **Convert nothing; new plans only.** Zero risk, and two formats coexist in one directory
    indefinitely.
  - **Convert only what is still live** — `windows-support`, and anything not yet `done`.
    Finished plans stay as they are, since nothing reads them again.

- **Recommendation:** the third. A finished plan has no future reader whose budget this is
  protecting, and converting it spends the one thing this change has no way to verify.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | 2026-09-03 | Two plan documents reason from "PLAN.md, which is archived when a plan closes" (`docs/plans/editable-node-graphs/PLAN.md:175,825`); no archive step exists anywhere in the tree | no | open |
| 2 | 2026-09-03 | Seven comments in `viewer/index.html:1661` and `viewer/test/browser.spec.js` cite `PLAN.md §N`; nothing verifies them, so a filename change breaks them silently | no | open |
| 3 | 2026-09-03 | `protocol/adopt.md:30` builds PLAN.md from the same template — how adoption populates a separated record is unstated | no | open |
| 4 | 2026-09-03 | `protocol/planning.md`'s exit gate requires the Spec to account in prose for every rejected graph entry, which is a rule pushing rejection rationale *into* the Spec | yes | settled by decision 7 — the gate repoints at the rejected-alternatives list |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Accepted Risks and Prior Work stay with the specification, not the record | `protocol/templates/PLAN.md:53-57` already calls Accepted Risks "part of the spec, not review scaffolding — an implementer should read these", and `protocol/implementation.md:26` has Stage 3 read Prior Work before decomposing. Both are inputs to building, not history | defaulted |
| 2 | Open Questions and the Watch List stay with the specification side | Both must be empty before Stage 1 exits (`protocol/planning.md:173`), so they cost a downstream reader nothing and moving them buys nothing | defaulted |
| 3 | Implementation Tasks and the free-form Log move with the record; Stage 3 reads the record when resuming an interrupted run | They are Stage 3's account of what it did, which is history by the same test as the review rounds. Resuming already reconciles against the tree rather than the table (`protocol/implementation.md:32-36`), so the table is evidence, not specification | defaulted |
| 4 | Nothing mechanically enforces history-free specification prose | A grep for "an earlier draft" is a string-absence gate, which this repo's own testing rules rule out as a one-time proof masquerading as a permanent test. The rule is stated where the writer meets it and checked by reading, like every other rule in `protocol/` | defaulted |
| 5 | `status:` stays in `PLAN.md`'s frontmatter and remains the state machine | `AGENTS.md:36-38` and `CONTRIBUTING.md` both name that field as the gate; moving it would change every stage's precondition for no gain | defaulted |
| 6 | `MAP.md`, `IDEA.md`, `COMPLETION.md`, `REMEDIATION-N.md` and `graphs/` are untouched | Stated as a non-goal in `IDEA.md` | user |
| 7 | A rejected alternative goes to a rejected-alternatives list in the record, never into the specification. The Stage 2 reviewer brief points at it under the existing no-re-raise rule and its `RE-RAISE:` escape hatch | The leakage is a missing home, not sloppiness — `docs/plans/diagram-sensitivity/PLAN.md:300,410` records cut designs in the Spec explicitly so a later round will not re-propose them. This gives prose the home graphs already have for a rejected box, and the escape hatch at `protocol/plan-review.md:69-71` caps the risk of suppressing a rejection that later became correct | user |

## Spec

### A rejected alternative is recorded, and never in the specification

A design the lead considered and dropped is written to a **rejected-alternatives list** in
the record: what was proposed, and why it was not taken. The lead writes an entry at the
moment it drops the alternative, whether that happens in the Stage 1 discussion loop or in
Stage 2 triage.

The Stage 2 reviewer reads it. The reviewer brief names the list alongside the settled
findings it already names, under the same rule and the same escape hatch: do not propose a
listed alternative unless you have concrete evidence its rationale is factually wrong, and
if you do, prefix the line `RE-RAISE:` and cite the evidence
(`protocol/plan-review.md:69-71`).

Stages 3 and 4 do not read it. An implementer builds the settled design; a verifier checks
the built thing against the settled design. Neither has a use for a design that was cut.

The specification states what is true. It does not say what was considered, what an earlier
draft said, or what was struck. Those sentences either become entries on the
rejected-alternatives list or are deleted.

`protocol/planning.md`'s exit gate — today requiring the specification to "account in prose
for every `rejected` entry" across the plan's graphs — repoints at this list. A rejected box
in a graph and a rejected design in prose are the same kind of thing and get the same home.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
