---
slug: how-a-graph-reads
round: 1
date: 2026-08-31
---

# Remediation 1

Verification round 1 ran two lanes over the whole Spec: `gpt-5.6-sol` (cross-family against
the Claude-built page rendering) returned `FAIL` with two gaps, and a fresh Opus lane
(cross-family against the GPT-built server refusals) returned `PASS` with three non-blocking
observations. One gap is upheld and remediated below; one is declined with evidence; two of
the observations become record fixes and one is dismissed.

## The gap list, verbatim

From `gpt-5.6-sol`:

```
VERDICT: FAIL
GAP: Spec §3, candidate must cross neither box — slotting moves already-validated anchors without rechecking, allowing the rendered line to enter a box — viewer/index.html:984-995 validates centred anchors, :1626-1656 moves them, and :1227-1243 renders them unchanged; Chromium rendered M304,454 L292,351 through target box x=296..496, y=314..388
GAP: Spec §3, reciprocal arrows advance through passing face pairs in edge-id order — every reciprocal edge independently receives the same candidate search — viewer/index.html:967-995 takes no edge identity or offset and :1600-1607 calls it identically for every reciprocal edge
```

From the Opus lane (`PASS`, recorded because they are real):

- §3's reciprocal clause is not implemented literally and is not in COMPLETION.md's
  Deviations section. The lane found no case where it matters, and observed the clause is
  underspecified as written "since each arrow of a reciprocal pair has its own candidate
  list, so 'the next pair' has no shared enumeration to index into."
- `IDEA.md`'s third "what good looks like" bullet is now literally false: it says an arrow
  not carrying the flow forward "uses the sides", and measured, 5 of 31 non-forward arrows
  use top-to-bottom instead, while the forward arm of a two-way pair takes bottom-to-top.
  Both follow from Decision 34.
- A code comment in `viewer/index.html` attributes a rule to the plan — "matching the plan's
  'a fallback edge joins no bundle' rule" — and that phrase appears nowhere in `PLAN.md`.

## Adjudication

### Gap 1 — upheld, and it is the lead's defect

The Spec says a face pair is taken only if its "straight line **crosses neither box**", but
never says whether that test runs against the face-centre anchors or the final slotted ones.
The lead settled it at dispatch as two phases — faces chosen against face centres, slots
assigned afterwards — and measured zero crossings across all 21 committed graphs, which is
what made it look safe. It is not: a slot offset moves an anchor the face check already
cleared, and the moved line can re-enter a box.

Reproduced independently of the verifier's example. Searching three-box layouts with one
source and two outgoing arrows, holding every pair of boxes at least 24px apart — the
smallest gap a fresh layout can produce, since `LAYER_GAP` is 140 against a tallest box of
116 — over **10,723,594 layouts**:

| Rendering | Layouts with an arrow through a box |
|---|---|
| today's pre-change `rectExit` trim | **0** |
| the shipped face choice + slotting | **8,930** |
| the same, plus a post-slot recheck falling back to `rectExit` | **0** |

Every one of the 8,930 is a regression against today's behaviour. A worked instance: source
box at (0,400), targets at (-600,100) and (-192,244), all three disjoint and well separated.
The source's left face carries two departures, so slotting moves one of them 9px down the
face, and the resulting line `(-4,446) → (12,281)` re-enters the source's own box — the face
check had cleared `(-4,437) → (12,281)`, which does not.

Dropping the 24px floor so the search includes boxes touching or overlapping — the
degeneracy the plan already records as an Accepted Risk — today's rendering crosses in
160,410 layouts and the shipped code in 133,226. With the recheck, 123,263 remain and
**none of them is a case today draws cleanly**. So the fix never makes anything worse than
the pre-change behaviour, and its residue is exactly the accepted risk.

The remedy is one task, below.

### Gap 2 — declined, because the reading contradicts the Spec elsewhere

The verifier reads "Every arrow of such a pair is ordered by edge id and takes the next pair
that passes" as consumption: the arrow at edge-id index *k* takes the *k*-th passing
candidate. Run that reading against the repo's own fixture and it breaks a test the Spec
says is untouched.

`viewer/test/fixtures/interactive.json` holds the only reciprocal pair in the suite, `e` at
(150,650) and `f` at (1050,650) — same row, 700px apart. Evaluating the candidate lists:

```
e->f passing candidates: [["right","left"]]
f->e passing candidates: [["left","right"]]
```

Exactly one candidate passes on each side; every flank pair draws through the other box, and
top-to-bottom draws through `f`. Under consumption, `f->e` sorts second by edge id, needs a
*second* passing candidate, has none, and falls to the `rectExit` trim — which for a same-row
pair puts it on `e`'s right face and `f`'s left face at centre height, exactly on top of
`e->f`. That makes `viewer/test/browser.spec.js:761` fail, and Spec §5 states of that test:
"their slots differ in y, and the assertion passes unchanged. It is listed because it reads
arrow geometry, not because it needs rewriting."

Both verifiers independently found the clause underspecified — the Opus lane in the same
words. The reading that keeps the Spec self-consistent is the one shipped: each arrow takes
the first candidate in its own list that passes, and edge id orders slots, which is where
§3's own worked example puts it ("two arrows with the same `from` and `to` share an
other-endpoint, so the edge-id tie-break gives them adjacent slots at both ends"). Both of
the clause's stated purposes hold under the shipped reading — three arrows between one pair
of boxes is defined, and nothing is collinear, measured at zero coincident lines over 250
edges. Recorded as a deviation rather than changed.

### The Opus lane's three observations

The missing Deviations entry and the invented citation are both upheld; the citation fix is
folded into the task below and the Deviations entry is a lead edit to COMPLETION.md. The
`IDEA.md` bullet is upheld as document staleness: Decision 34 is Collin's own decision from
round 6 and explicitly supersedes Decisions 4 and 18, so the north star is what drifted, not
the code. The lead updates the bullet to say what Decision 34 actually delivers and flags the
change to Collin rather than making it silently.

## Task

| # | Objective | Ownership boundary | Lane | Validation | Status |
|---|-----------|--------------------|------|-----------|--------|
| R1-T1 | Re-check each edge's anchors after slotting and route a crossing one to the `rectExit` fallback; a browser test that fails without it; fix the invented citation in the phase-2 comment | `viewer/index.html`, `viewer/test/browser.spec.js` | Claude / sonnet | `cd viewer && npm run test:browser`, `cd viewer && npm test` | complete |

Routed to the Claude family because Claude built `viewer/index.html`. Round 1 sharpens the
brief rather than escalating the model, and this gap is a brief defect precisely: the
original brief told the lane to choose faces against face centres and said nothing about
what happens when a slot moves one, because the lead had not noticed there was anything to
say. The rewritten brief names the recheck, its placement, and the test.
