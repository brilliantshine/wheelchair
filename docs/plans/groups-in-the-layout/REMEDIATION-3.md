# Remediation 3 — 2026-09-21

Round 2 closure review: `FAIL`, two new gaps plus one document error. Neither new gap is the
one that survived round 1 — that is dead, and so are all seven originals, each re-run red
under its mutation and green without on a copy baselined at 51/51. `viewer/server.js` is still
byte-identical to the verifier's round-1 snapshot.

Both new gaps are **second readings of mutations already killed**. That is the same failure
shape as round 2's and it is worth naming plainly: a mutation described in a sentence can have
more than one implementation, killing one of them leaves a green suite, and a green suite looks
identical either way. The verifier went looking for this deliberately — it wrote twenty
mutations against explicit Spec sentences and eighteen die.

## The gaps, verbatim

```
GAP: Placement / the third pass's snapshot rule — the Spec's first pass-three bullet is a two-sided rule ("one snapshot of every node **outside** the group being reordered… a member's *own* group-mates are read live rather than from the snapshot"), and the suite guards only one side. Making the snapshot live for outsiders is caught by `the third pass freezes other groups before it walks either group`; making it frozen for group-mates — replacing `viewer/server.js:853`'s `centre` with `(id) => snapshot.get(id)`, which is the Round 5 finding read the other way round — leaves the suite at 51/51 and the browser suite at 64/64. Non-equivalent: it changes output on 1 of 600 fuzzed group graphs. Minimal discriminating fixture, confirmed end-to-end through a real server: nodes `n0 n1 n4 n5 n6 n7 n8 n9 n10`, visible group `{n0, n1, n6, n9}`, edges `n9->n1, n5->n4, n10->n4, n8->n5, n0->n8, n9->n7, n0->n6` — the real build lays out `n1@141 n6@401`, the mutant swaps them to `n1@401 n6@141`.

GAP: Placement / the crossing guard's external half — the Spec says the external inversion count deduplicates endpoint pairs "exactly as the median key deduplicates them", the Round 5 fix for "duplicating one external arrow could flip a row's proposal from accepted to rejected". Removing the dedupe from the key *and* the count is caught by the parallel-arrow test; removing it from the count alone — `externalCrossings` iterating `incoming.edges` instead of the deduplicated `pairs` at `viewer/server.js:858` — leaves both suites green. Non-equivalent: 4 of 600 fuzzed graphs. Minimal fixture, confirmed through a real server: nodes `n0..n6`, visible groups `{n5, n6}` and `{n1, n2}`, edges `n0->n6, n0->n2, n3->n2, n4->n3, n6->n3, n1->n6, n1->n6, n1->n5, n3->n5` — the duplicated `n1->n6` is the whole point; the real build gives `n6@24 n5@284`, the mutant `n6@284 n5@24`.

GAP: REMEDIATION-2.md accuracy — its Task table records R2-A as "**unstarted — lane killed**" and its "Lane status" section asserts `viewer/test/server.test.js` is "untouched at 50 tests" and the suite "50/50". The re-dispatch landed: the file has 51 tests and `the third pass gives internal and external neighbours equal weight in its median` at `:704`. COMPLETION.md's Remediation 2 section is correct and the two documents now contradict each other; a reader who opens the detail doc alone concludes the gap is still open.
```

## A shape note the verifier raised, adopted

Not a gap, but worth acting on. The test added in round 2 asserts absolute positions
(`{ a: 414, c: 154 }`) where the property it names is ordinal — `a` sits to the right of `c`.
The absolute form kills the mutation, but it will also go red on any future change to pitch,
gutter or component order that leaves the property perfectly intact, and the next reader then
has to re-derive two magic numbers to find out whether anything actually broke. Reshaped to
the ordinal assertion, which kills the same mutation and survives the irrelevant changes.

The verifier confirmed separately that the expected values were genuinely derived — it re-ran
the fixture end to end through a fresh server rather than through its own harness and got
`a@414,202 b@154,342 c@154,202 p@0,0 q@260,0 r@130,506`. So the test passed for the right
reason; the reshape is about what it will cost later, not about whether it works now.

## The stopping rule

The verifier volunteered one and it is the right one, recorded here because the next session
will otherwise ask the same question:

> the criterion "every sentence of the Spec has a mutation that kills it" is not reachable by
> inspection, and the honest version is that the suite now guards every property the plan
> spent a review round arguing about, with these two the last of them.

Both remaining gaps are refinements the plan added in review Round 5 to sentences that were
already roughly right — the class of detail a fixture built for the coarse version of a rule
will always miss. With them closed, every property the plan argued about is guarded. That is
the exit condition for this stage; a further sweep would be looking for sentences nobody ever
disagreed about.

## Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|
| R3-A | Two tests, on the two fixtures the verifier supplied: one killing a frozen-snapshot-for-group-mates mutation, one killing dedupe-removed-from-the-external-count-only. Reshape the round-2 test's absolute assertion to the ordinal one | `viewer/test/server.test.js` | GPT / gpt-5.6-terra at `xhigh`, fresh lane | | `node --test 'viewer/test/*.test.js'` plus both mutation checks | dispatched |
| R3-B | Correct `REMEDIATION-2.md`'s stale status | `docs/plans/groups-in-the-layout/REMEDIATION-2.md` | lead | — | read | done |

The implementation is not to be touched. Three verification passes have now failed to break it.
