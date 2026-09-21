# Remediation 4 — 2026-09-21

Round 3 closure review: `FAIL`, two gaps. Both are from findings the plan **upheld and wrote
into the Spec** — not new territory, and not second readings this time. Twenty-four of
twenty-six mutations are dead.

The stopping rule got better, and the verifier corrected itself unprompted:

> the rule is right, and I named it too early. I asserted "these two the last of them" off a
> set of twenty mutations I had chosen myself, which was never a basis for a completeness
> claim — I had sampled the Spec, not enumerated the plan.

The version it replaced it with is checkable rather than asserted, and it has been walked end
to end: **every finding in the plan's Review Rounds with a mechanical consequence is killed by
a mutation, except where the mutation cannot be shown to change behaviour, or names a sequence
rather than an outcome.** That is a finite list. Twenty-six mutations, twenty-four dead, these
two left.

It also declined to raise two things it probed, and the reasons are worth keeping:

- Counting external inversions over a whole group at once rather than per row — the Round 4
  major — is indistinguishable from the specified version over 5,600 generated graphs. Candidate
  and incumbent differ in exactly one row and the cross-row pairs contribute the same delta
  either way, so there is no evidence it is a behavioural difference at all.
- Repeating the third pass's sweep instead of running it once — the Round 4 minor on
  granularity — differs on 2 of 600 graphs but violates no outcome the Spec states. The guard
  still holds, so the repeated version is not wrong, only not the specified algorithm. Pinning
  a sweep count would be a mechanism test of exactly the kind D4 deleted.

## The gaps, verbatim

```
GAP: Placement / "A bend point keeps `BEND_PITCH` exactly as now", and through it the headline "A graph with no visible groups must come out byte-identical to today" — no test exercises a bend point, so the byte-identity guard never touches the one term in `placeComponent`'s `pitch` map that is not a node width. Giving bends `NODE_PITCH` instead of `BEND_PITCH` at `viewer/server.js:722` leaves 53/53 and 64/64 green while breaking byte-identity against HEAD. Discriminating fixture, four nodes, no groups, confirmed through a real server: `a->b, b->c, c->d, a->d, a->c` lays out `a@260,0 b@0,140 c@157,280 d@237,420`; the mutant gives `c@202,280 d@266,420`. This is Round 1's own minor finding, upheld with the words "or byte-identity breaks".

GAP: Placement / "Units top-align at the row origin. A unit shorter than its row sits at the row's top edge, not centred and not bottom-aligned" — nothing asserts it. Centring each unit in its row at `viewer/server.js:742` leaves both suites green and changes 372 of 600 fuzzed group graphs. Minimal fixture, confirmed through a real server: nodes `m1 m2 plain sink`, visible group `{m1, m2}`, edges `m1->m2, plain->sink` — the real build puts `plain@508,0`, on the row line and 62 above the group's first member; the mutant puts it at `plain@508,113`. This is Round 6's finding, upheld, written into the Spec with its reasoning and carried as the fifth Accepted Risk, so it is the visual consequence the plan consciously signed off — and the one nothing would catch if it silently changed.
```

The second is the one worth noticing. The 62-pixel offset between a plain box and a
neighbouring group's members is in the Accepted Risks table — the plan looked at it, decided it
was the right trade, and wrote down why. Nothing in the suite would have noticed it changing.
An accepted risk with no test is a decision that can be reversed by accident.

## Task

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|
| R4-A | Two tests on the fixtures above: one exercising a bend point so the byte-identity guard covers `BEND_PITCH`, one pinning top-alignment at the row line | `viewer/test/server.test.js` | lead — see below | — | `node --test 'viewer/test/*.test.js'` plus both mutation checks | **done**, 55/55 |

The implementation is not to be touched. Four verification passes have now failed to break it.

## Lane status, and why the lead wrote these

The dispatched lane was **killed before writing anything** — the second consecutive GPT lane to
die that way, after R2-A's first dispatch. Both left the tree clean, checked the same way:
`viewer/server.js` byte-identical by sha256 against a pre-dispatch hash, the test file untouched,
the suite green. Neither kill has an explanation — the preflight reported a fresh token with
over a week left and neither log carries a quota, rate-limit or authentication marker.

Rather than spend a third dispatch on a channel that has now failed twice, the lead wrote both
tests. That is a deviation from `verification.md`'s routing rule, which sends remediation to the
implementing family, and it is recorded rather than quietly taken. The justification is narrow:
both tests were fully specified by the verifier — fixtures, expected output, and the exact
mutation each had to kill — so nothing was left for a lane to decide, and the work is two tests
rather than a body of implementation.

**A mutation of the lead's own was wrong before it was right**, which is worth recording because
it nearly produced a false negative. The first attempt at the top-alignment mutation computed
each row's height *within a component*. Row heights are global (D21), and in that fixture the
plain box is alone in its component — so the local height equalled the box's own height, centring
was a no-op, and the suite stayed green. Read carelessly that looks like the new test failing to
catch its mutation; it was the mutation failing to mutate. Recomputed against the global row
origins, it turns exactly the intended test red. A mutation that does not change behaviour proves
nothing, in either direction.

```
$ # bends given NODE_PITCH instead of BEND_PITCH
✖ a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
ℹ tests 55   ℹ pass 54   ℹ fail 1

$ # each unit centred in its global row height instead of set on the row line
✖ a unit shorter than its row sits on the row line rather than centred in it
ℹ tests 55   ℹ pass 54   ℹ fail 1

$ # restored
ℹ tests 55   ℹ pass 55   ℹ fail 0
$ sha256sum -c server-hash-before-dispatch
viewer/server.js: OK
```
