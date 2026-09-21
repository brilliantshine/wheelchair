# Remediation 2 — 2026-09-21

Closure review of round 1: the GPT verifier returned `PASS` on the page, the browser suite and
`protocol/graphs.md`. The Claude verifier returned `FAIL` with **one** surviving gap out of the
seven it raised, and confirmed the other six are dead — each red under its mutation and green
without, on a freshly rebuilt copy baselined at 50/50. It also confirmed no source file was
touched, by sha256 against a snapshot it committed during round 1 rather than by reading a
diffstat.

## The surviving gap, verbatim

```
GAP: Tests — "A group where the all-neighbour key and an external-only key disagree comes out ordered by the all-neighbour key" — the mutation I named in round 1 still survives. The new test `the third pass keys a member on every neighbour, including members of its group` (`viewer/test/server.test.js:694`) kills only one reading of "external-only": making a member with no external arrow *ineligible* to move turns it red, but the reading Round 2 of the plan actually settled on before D20 superseded it — external-only median with the member's own x-centre as the fallback, `placeComponent:721`'s fallback, which the Spec's Log names at PLAN.md:685 — leaves the suite at 50/50 and the browser suite at 64/64. It is not an equivalent mutant: it changes output on 34 of 600 fuzzed group graphs, and on the new test's own fixture it produces byte-identical positions, so that fixture cannot see it. A six-edge fixture does: group `{a,b,c}` with `a->b`, `p->a`, `q->a`, `c->r` lays out `a@414 c@154` under the all-neighbour key and `a@154 c@414` under the external-only-with-own-x key.
```

## Why it survived, and what rung this is

The round-1 brief named the mutation as "rewrite the key to read only neighbours outside the
group". That has two readings and the lane killed the wrong one. Under the reading it tested,
a member with no external arrow becomes ineligible to move at all; under the reading that
matters — the pre-D20 algorithm, external-only median with the member's own x-centre as the
fallback — the member still moves, just by a different key. The lane's fixture produces
byte-identical output under the second, so it cannot see it.

That is nearly-right work that missed an edge case, not a lane holding the wrong problem. Per
`protocol/lanes.md` the rung is **`xhigh` at the same tier, in a fresh lane** rather than a
resume — a resume would hand the next attempt a context full of the reading that already
failed. The brief is also now much tighter than round 1's, because the verifier supplied the
discriminating fixture and both expected outputs.

## Also carried out by the lead, not delegated

- `PLAN.md`'s Log now records that **neither** counter-example shape written during review can
  be built into a fixture that kills the guard-free build. The verifier confirmed the
  remediating lane's report and explained why: the first falls 1→0 crossings so an unguarded
  sort accepts the same proposal; the second raises the *internal* count 0→1 exactly as
  described, but the guard counts internal plus external and that total falls 2→1, so the
  guard correctly accepts it. Both shapes are true about the hazard and false as fixtures.
  Recorded in the Log itself, not only in COMPLETION.md, so the next reader does not repeat
  the dead end.
- `COMPLETION.md`'s Remediation 1 section carried a lead claim of "thirty-five failures" for
  the component-cursor mutation. The verifier checked it: that figure came from a mutation
  written as `right - sizeOf('x').w - min + NODE_PITCH + …`, which perturbs more than the
  faithful revert does. The real revert turns **two** tests red. Corrected in place.

## Task

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|
| R2-A | One test that distinguishes the all-neighbour median key from the pre-D20 external-only-with-own-x-centre key, using the fixture the verifier supplied | `viewer/test/server.test.js` | GPT / gpt-5.6-terra at `xhigh`, fresh lane | — | `node --test 'viewer/test/*.test.js'` plus the mutation check | **done** on the second dispatch, session `01a0c5c5-3484-7f70-bb55-901ecb6718a6`. Suite 51/51 |

The implementation is not to be touched. Two verifiers have now failed to break it.

## Lane status

The R2-A lane was **killed before it wrote anything**, so the task is recorded unstarted rather
than attempted — `protocol/lanes.md`'s rule, since a lane that never ran has nothing to
escalate and its brief is not evidence of anything. Checked rather than assumed:

- Its `-o` file is empty; the event log ends with the lane still reading
  `viewer/test/helpers/server.js`, before any edit.
- `viewer/server.js` is byte-identical to the version both verifiers checked — compared
  against a copy taken before the lead's own mutation spot-checks, not against a diffstat.
  This mattered: the brief asked the lane to apply a mutation and revert it, so a kill in the
  wrong moment could have left one in place. It did not.
- `viewer/test/server.test.js` is untouched at 50 tests.
- `node --test 'viewer/test/*.test.js'` is 50/50.

The tree is exactly where the closure review left it. One gap outstanding, nothing corrupted,
and re-dispatch is a clean start rather than a resume.

**Update — the re-dispatch landed.** Everything above describes the *first* dispatch and stays
true of it. The second ran clean: the test is at `viewer/test/server.test.js:704`, the suite is
51/51, and `viewer/server.js` is byte-identical to the pre-dispatch hash. Round 2's closure
review caught this section still claiming the task was unstarted — a stale status in the
detail document while `COMPLETION.md` said the opposite, which is exactly the trap of writing
status in two places.
