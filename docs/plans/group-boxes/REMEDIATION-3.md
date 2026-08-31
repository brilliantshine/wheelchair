---
slug: group-boxes
round: 3
date: 2026-08-30
verifiers: gpt-5.6-sol (closure review, resumed session)
---

# Remediation 3

Third `VERDICT: FAIL`, and all three gaps are the same thing again: citations in COMPLETION.md
that resolve to a real line but do not support the row that cites them. **No gap in any of the
three rounds has been an implementation defect.** The code has been verified correct by both
families, by mutation, twice.

## Gap list, verbatim, with the lead's verdict

| # | Gap | Verdict | Basis |
|---|-----|---------|-------|
| W1 | The row for an absent `visible` cites `server.test.js:251`, which removes the whole top-level `groups` key and never tests a group with an omitted `visible`; the real assertion is at `:208` | `upheld` | Correct. The row now cites all three: `:208` sends groups carrying none of the new keys and asserts the defaults, `:251` covers a file with no `groups` at all, `:264` refuses the explicit null |
| W2 | Four implementation citations miss their claimed code — hit-target sizing points at tooltip and append lines rather than the width computation; dimming points at a comment and a blank line; the hover row stops one line short of its listeners; the drift-test deviation points at an unrelated test | `upheld` | All four verified wrong and corrected to `viewer/index.html:1021-1025`, `:1566` and `:1003`, `:991-993`, and `viewer/test/browser.spec.js:1820-1827` |
| W3 | The checker's own claim is overstated: COMPLETION says 37 while the script reports 39, and the regex only matches fully qualified paths — it silently skips shorthand like `server.test.js:251` and bare `:1007` | `upheld`, and the most useful of the three | This is why the previous two rounds did not catch anything: the check was weaker than the claim made for it. A checker that skips exactly the citations most likely to rot is worse than none, because it buys false confidence |

## What was done

The checker is now a file in this directory rather than a claim: `check-citations.py`. It
resolves **every** `file:line` and `file:line-line` reference in COMPLETION.md — fully
qualified paths, bare filenames, and bare `:N` inheriting the path named earlier on its line —
and exits non-zero on any that is unresolvable, out of range, or lands on a blank line.
`--all` dumps every citation beside the line it resolves to, which is what makes the
"resolves but does not support the claim" class reviewable at all; that dump was read line by
line for the whole coverage table this round, which is how W1 and W2 were confirmed.

```
$ python3 docs/plans/group-boxes/check-citations.py
117 citations, 0 unresolvable/blank
```

COMPLETION.md no longer states a citation count. A number in prose is one more thing that goes
stale; the script's output is the claim.

## Why this took three rounds

Each round I fixed the citations by hand and each time they were stale again before the round
closed — twice because remediation lanes added tests underneath them, once because the check I
wrote to prevent exactly that only looked at whether a reference resolved, not at whether it
resolved to the right thing. The ordering lesson from Remediation 2 was right but insufficient:
fixing citations last does not help if nothing verifies them afterwards. What was missing was a
check strong enough to fail, and the reviewer's W3 is what produced it.

## Validation after remediation

```
$ node --test 'viewer/test/*.test.js'
ℹ tests 52   ℹ pass 52   ℹ fail 0

$ npm --prefix viewer run test:browser
51 passed

$ ./install.sh && ./install.sh
both runs exit 0

$ python3 docs/plans/group-boxes/check-citations.py
117 citations, 0 unresolvable/blank
```

## The Claude verifier's closure review: PASS

Run against the same tree, over the GPT-built server. It applied **twelve** mutations and
every one failed on its intended test, including all four the plan's own decisions rest on.
It confirmed the C1 correction independently and completed it: `isResident` has a second call
site in the victim filter that my reasoning had not covered, and the edit is inert there too —
an all-new group is processed before any later anchor, so it has either already moved and is
skipped as settled, or it crowded nothing and does not crowd that anchor either.

It also re-examined its own C5 finding and reported it does not fully survive: the
padding-only fixture's members poke 4px into each other's boxes, so decision 21's stricter "no
node inside either box" arithmetic is not literally reproduced. The assertion still bites on
the property that matters — making the pass ignore box-vs-box crowding fails that test and
three others — because clearing a node from a box cannot clear the boxes from each other.
Recorded rather than acted on: the case is covered, the fixture is one number short of ideal.

## A process hazard this round exposed

The Claude verifier was mutating and restoring `viewer/server.js` and `viewer/index.html` from
its own backups **while Remediation 2 was being written to the same tree**. It did not collide
— its last restore preceded the R2 write, and it never touched the page — and the tree was
re-checked afterwards: the R2 fix is present, its mutation still bites, and both suites are
green. But the near miss is the finding. A blind verifier restoring a file from a private copy
will silently revert a concurrent lane's edit, and neither side would notice.

`lanes.md` already says never to run two write-lanes in one checkout. A verifier holding
`workspace-write` so it can run a suite, and mutating files to test whether assertions bite,
**is** a write lane — the rule simply was not read as covering it. This is a gap in the
workflow rather than in this feature, so it is recorded here and raised to the user rather
than fixed inside this change.

## Round-4 closure: three more citation gaps, all upheld and fixed

| Gap | Verdict | Fix |
|---|---|---|
| The dimming row cited `viewer/index.html:1003`, which only *computes* `dimmed`; the class is applied at `:1008` | `upheld` | Cited as the span `:1003-1008` rather than one end of it |
| The packing row said `server.test.js:704` pins two-wide packing, but that test's visible group has a single member; the assertion is at `:696`, inside the create test at `:690` | `upheld` | Corrected to `:690-700`, naming `:696` |
| The checker's regex matched only `js`, `html`, `md`, `json`, so a citation to the newly added Python checker itself was skipped silently — injecting `check-citations.py:999999` returned exit 0 | `upheld`, and the sharpest of the three | The regex now matches any extension. Re-proved: the same injection now reports `OUT OF RANGE` and exits 1, and the clean document exits 0 |

The first two are the same failure mode as W2 and are why pinpoint citations are being replaced
with ranges spanning the whole behaviour: a single line number invites citing the place a value
is computed rather than the place it is used, and both are defensible readings until a reviewer
picks the other one.

## Calling the round here

`verification.md` says to stop and bring a gap to the user once it has survived two remediation
rounds. Citation accuracy has now survived three, and this is the point that rule exists for.

The substance is settled and is not what keeps failing. Both families verified the
implementation, by mutation, and the Claude verifier returned **PASS** after twelve mutations
each failing on its intended test. **Across four verification rounds, not one finding has been
an implementation defect.** Every gap in every round has been about this document's evidence —
first tests that could not fail, then citations that pointed a few lines off.

What each round has produced is real and worth having, and the trend is convergence: round 1
found thirteen gaps including tests that guarded nothing, round 4 found three off-by-five line
references. But a three-hundred-line document carrying 117 precise line citations into files
that move under it will always yield one more, and a fifth round would buy a smaller finding at
the same cost. The durable answer is already in place — the checker is a file, it covers every
reference and every extension, and `--all` makes the semantic class reviewable — so the next
person to touch this has a tool rather than a warning.

Recommended: accept, with the citation checker as the standing guard.
