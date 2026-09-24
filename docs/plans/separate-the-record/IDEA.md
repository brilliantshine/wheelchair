---
slug: separate-the-record
status: draft   # draft | confirmed
created: 2026-09-03
---

# A plan document should say what is true, not how it got there

## What we're building

A plan in this workflow accumulates two different things in one file: the specification a worker
implements, and the record of how that specification was argued into shape. Right now they are
interleaved, and the record grows without bound.

This separates them. What the change looks like concretely is a question for planning, not a
foregone conclusion — it might be two files, or one file with a hard boundary and a rule about
what may cross it.

## Why — the problem

Across the eight plans this workflow has produced — seven in `docs/plans/`, plus
`windows-support` on its own branch — the record — the decision log plus the review-round
tables — comes to 3121 lines against 3837 lines of specification. It is 81% the size of the thing
under review, and on the worst plan it is larger than the specification. It grows by roughly forty
lines a round, and no plan has finished in fewer than five rounds.

Two costs follow, and the second is worse.

Every review lane is fresh-context by design — that blindness is the point, and it is worth
keeping. But it means each lane re-derives the current state from the document, and part of its
budget goes to separating what is live from rounds of archaeology. One round-11 finding on
`windows-support` was literally that a round-10 table row had become false; another was that the
round's own "Changed since" list contradicted the specification it introduced.

Worse, the history leaks into the specification's own prose, and it does so in every plan we have
written. Real examples: "an earlier draft said this case blocks the whole change", "two earlier
attempts to state the check were both wrong — recorded because the third only makes sense against
them", "the sentence that stood here claiming... was wrong, and is struck rather than quietly
edited". Each was the honest thing to write at the time. Collectively they mean an implementer
reads rounds of correction history inside the specification they are supposed to build from — and
unlike a section at the end of the file, that is not something a reader can skip past.

Both of round 11's reviewers on `windows-support`, asked whether that plan was over-repaired, said
no — the design is ten items each tracing to a measured failure — and located the remaining
problems in the prose rather than the design. That is the diagnosis this plan acts on.

## What good looks like

- Someone implementing from the specification reads no correction history. No "an earlier draft",
  no "this was wrong and is struck", no round numbers in the part they build from.
- A reviewer arriving cold finds the current state without reading the argument that produced it,
  and can still find what was already settled — so it does not re-raise a closed finding, which is
  the thing today's arrangement gets right and this change must not lose.
- The record stays complete. A resumed session can still tell "we decided against this" from
  "nobody considered it."
- What a worker reads stops growing with the number of review rounds. On a plan the size of
  `windows-support`, round twelve leaves it the same size as round two did.
- Nothing about the stage gates or the `status:` state machine changes, and every plan already in
  the tree is either still readable as it stands or converted as part of this change.

## Not doing

- **Not discarding the record.** Several superseded decisions in `windows-support` are
  load-bearing — later rows dereference them, and the chain of three attempts at one constraint is
  the only thing explaining why the third is worded as it is.
- **Not giving reviewers the conversation.** The fresh-context blindness is what makes the review
  gate worth running. This plan may not buy legibility by spending it.
- **Not fixing the review loop's convergence problem.** On the two longest plans, blocking
  findings converge across rounds while major findings do not — `windows-support` runs
  8, 9, 7, 7, 3, 8, 6, 5, 3, 7, 6, 6 on majors across twelve rounds. This plan removes one
  small cause of that (22 findings corpus-wide exist only because the record and the
  specification are two places that can disagree) and leaves the rest. It is a separate plan,
  and one worth writing after this lands, because its diagnosis needs round data from a
  document where those two cannot contradict each other.
- **Not changing what happens to a plan when it closes.** There is no step today that retires or
  packs away a finished plan, and this does not invent one.
- **Not touching the other documents.** `MAP.md`, `IDEA.md`, `COMPLETION.md`, `REMEDIATION-N.md`
  and the graphs directory are outside this.

## Constraints

- **Review lanes stay fresh-context.** Stated above as a non-goal; it is also a hard limit on the
  design, because the cheapest way to make a plan legible to a reviewer is to hand it the
  conversation, and that door is closed.
- **The reviewer must still be able to reach the settled findings.** Today's protocol tells every
  reviewer to read the review-round tables and the accepted risks so it does not re-raise what was
  already closed, and that instruction is why twelve rounds produced no re-raised findings. A
  separation that puts the record out of the reviewer's reach breaks a rule that currently works.
- **`protocol/planning.md` and `protocol/plan-review.md` own the affected formats**, and
  `protocol/templates/PLAN.md` is a contract with both stages — a template change must agree with
  the stage that consumes it, per `CONTRIBUTING.md`.
- **Eight plans already exist in the tree**, in states from finished to mid-flight on another
  branch. Whatever lands has to say what happens to them.
- **Nothing tests the protocol documents.** What keeps them true is that each stage refuses to run
  out of order and every stage's output is the next stage's input. A change here is checked by
  reading, so it has to be small enough to check that way.
- **Code comments in the viewer cite plan sections by number** and nothing verifies them, so any
  change to where the specification lives breaks them silently.

## Prior evidence

- Twelve rounds on `windows-support` produced 142 findings with zero `RE-RAISE:` cases, so
  reviewers were *not* losing prior decisions — the record works as a record. The problem is its
  size and its placement, not its content.
- The record-to-specification ratio across all eight plans: 105%, 97%, 96%, 82%, 71%, 57%, 54%,
  51%. `windows-support` is the second-worst, not an outlier.
- History leaking into the specification, counted by phrase across all eight: 13, 6, 6, 5, 4, 3,
  2, 1. Every plan has some.
