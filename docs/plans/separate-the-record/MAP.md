---
slug: separate-the-record
---

# How this works today

The "code" this plan touches is prose: `protocol/planning.md`, `protocol/plan-review.md`,
and `protocol/templates/PLAN.md`. There is no test suite for them — what keeps them true is
that each stage refuses to run out of order and every stage's output is the next stage's
input (`AGENTS.md:116-118`).

## End to end

```
/plan          writes Open Questions, Watch List, Decision Log, Spec  ─┐
                                                                      │
/plan-review   round N: two fresh reviewers get IDEA.md + PLAN.md     │  all four
               lead triage appends a Review Rounds table              ├─ stages read
               loop back to /plan for a user-decision finding  ───────┘  ONE file
                                                                         PLAN.md
/implement     lead reads Prior Work, decomposes the Spec into briefs
/verify        verifier gets PLAN.md + COMPLETION.md, checks the Spec

                    each round appends ~40 lines and never removes any
```

## What happens

1. **Stage 1 writes four sections into one file.** The question queue drains into the
   Decision Log, which is append-only — a reversal is a new entry, never an edit
   (`protocol/planning.md:151-157`). Answers fold into the Spec as they land. Nothing is
   ever deleted except a question moving to the Log.

2. **Stage 2 hands the reviewer the whole file.** The brief says read `IDEA.md`, then
   `docs/plans/<slug>/PLAN.md` (`protocol/plan-review.md:49`). No section is named, no
   section is excluded. Every reviewer is fresh-context by design and never sees the
   conversation.

3. **The record is deliberately in the reviewer's path.** The same brief points at the
   record on purpose: "The Review Rounds table and Accepted Risks section record findings
   already settled… do not re-raise it unless you have concrete evidence that rationale is
   factually wrong" (`protocol/plan-review.md:67-71`). That instruction is why eleven rounds
   produced zero `RE-RAISE:` cases. **The record is load-bearing for the no-re-raise rule,
   not dead weight** — any separation has to keep it reachable.

4. **Round 2+ already scopes reviewers by hand.** The lead writes a "Changed since Round
   N-1" list into the round's section, and that list is what scopes the round
   (`protocol/plan-review.md:29-34`). So a mechanism for pointing a reviewer at a subset of
   the document already exists; it is prose in the record, and it is the thing that went
   wrong in round 11 of `windows-support` (its own Changed-since list contradicted the Spec
   it introduced).

5. **Stages 3 and 4 read only two sections each.** Implementation reads Prior Work, then
   decomposes the Spec (`protocol/implementation.md:26,38`). Verification hands its lane the
   PLAN.md path and asks it to verify "against the Spec in `docs/plans/<slug>/PLAN.md`"
   (`protocol/verification.md:35,62`). Neither has any use for the record, and neither is
   told to skip it.

6. **The template fixes the order.** `protocol/templates/PLAN.md` puts Spec at line 44 and
   Review Rounds at 62, so the record sits *after* the Spec in every plan. A top-down reader
   meets the Spec first; a reader who loads the whole file pays for all of it.

## What matters for this change

**The record is not a tail wagging one plan — it is the size of the Spec, across the whole
corpus.** Measured on the eight plans in `docs/plans/` plus `windows-support`
(Review Rounds + Decision Log, against Spec):

| Plan | Spec | Record | Record/Spec | Rounds |
|---|---|---|---|---|
| editable-node-graphs | 616 | 649 | 105% | 10 |
| windows-support | 518 | 502 | 97% | 12 |
| one-account-setups | 427 | 409 | 96% | 7 |
| router-spine | 407 | 333 | 82% | 7 |
| how-a-graph-reads | 361 | 258 | 71% | 6 |
| graph-legibility | 431 | 246 | 57% | 5 |
| diagram-sensitivity | 577 | 312 | 54% | 7 |
| group-boxes | 500 | 256 | 51% | 6 |

Totals: 3837 Spec lines against 3121 record lines, 81%. The IDEA's framing of
`windows-support` as the worked example holds, and it is not an outlier — it is the
second-worst of eight.

**History leaks into the Spec in every plan, not just this one.** Counting phrases like
"an earlier draft", "was wrong", "struck" inside the Spec section only: diagram-sensitivity
13, how-a-graph-reads 6, windows-support 6, editable-node-graphs 5, one-account-setups 4,
graph-legibility 3, router-spine 2, group-boxes 1. Spot-checked
`docs/plans/diagram-sensitivity/PLAN.md:299,351,367,379,409,417,430,495,500,633` — all
genuine correction history, addressed to a reader who is tracking the argument, sitting in
the section a worker implements from. This is the corpus-wide version of the problem the
IDEA describes, and **the leakage is the worse half**: a reader can skip a tail, but cannot
skip a sentence embedded in the spec item they are building.

**Three consumers want three different documents.** Stage 2's reviewer wants Spec plus the
settled-findings record. Stages 3 and 4 want the Spec and nothing else. Stage 1 resuming
wants everything (`protocol/planning.md:25`). Today all three get the same file, and only
Stage 2's need justifies bundling.

## Problems found

- **A template change is a contract change.** `CONTRIBUTING.md:48` states it directly:
  "template changes are contract changes that must agree with the stage which consumes the
  template." Any new file or section boundary lands in `protocol/templates/PLAN.md`,
  `protocol/planning.md`, and `protocol/plan-review.md` in the same change, and the IDEA
  already carries this as a constraint.

- **Nothing archives a plan today, though two documents claim it does.** Decision 32 in
  `docs/plans/editable-node-graphs/PLAN.md:175` and a round-1 finding at
  `:825` both reason from "PLAN.md, which is archived when a plan closes." Grepping the tree
  for "archiv" outside that plan returns nothing: there is no archive step in any of the
  four protocol files, and `status: done` is the terminal state. If this plan reaches for an
  archive rule, it is inventing one, not using one.

- **Landed code cites plan sections by number, and those citations would go stale.**
  `viewer/index.html:1661` and `viewer/test/browser.spec.js:7,399,512,607,1723,2155` all
  point at `PLAN.md §N` for the reasoning behind a behavior. Nothing parses the file — I
  grepped `spine/`, `sensitivity/`, `install/` and `viewer/`, and the only other hit is a
  test asserting the dial's landed region does *not* contain the string
  (`sensitivity/test/run.sh:277`). So these are comments a human follows, not a contract a
  program breaks on. But moving the Spec to a different filename silently invalidates seven
  of them, and there is no check that would catch it.

- **A new file has to earn its place against the four that exist.** `README.md:175-185`
  lists MAP, IDEA, PLAN, `graphs/`, COMPLETION and REMEDIATION-N to a person arriving cold.
  A fifth document is a real cost paid by every future reader, and the alternative — a hard
  boundary inside PLAN.md plus a rule about what may cross it — costs nothing structural.
  That is the plan's first real fork.

## Not checked

- I did not read the eight plans' Spec sections in full — the leakage count is a grep, and
  I hand-verified only `diagram-sensitivity`'s ten hits.
- I did not read `protocol/adopt.md`'s handling of the record beyond noting it writes
  PLAN.md from the same template (`protocol/adopt.md:30`), so how adoption would populate a
  separated record is open.
- I did not measure how much of a reviewer's context budget the record actually consumes;
  the line counts are a proxy, and the IDEA's claim about reviewer attention is inference
  from round-11 findings, not measurement.
