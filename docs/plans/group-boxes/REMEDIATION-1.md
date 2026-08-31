---
slug: group-boxes
round: 1
date: 2026-08-30
verifiers: gpt-5.6-sol (over the Claude-built page, browser tests and format documents); claude default (over the GPT-built server and its tests)
---

# Remediation 1

Both verifiers returned `VERDICT: FAIL`. **Neither found an implementation defect.** Every
upheld gap is a guard that does not bite or a claim in COMPLETION.md that its cited evidence
does not support. The Claude verifier reproduced the pass's correctness by mutation
independently — settled-means-moved, the single predicate at all three sites, the exact
landing, all three mode branches, the lattice enumeration — and the GPT verifier confirmed
the geometry drift assertion bites and the non-goals and routers are intact.

That is still a FAIL worth acting on: the plan's Validation section sits inside its Spec, so
its enumerated cases are contract items, and a case that cannot fail is not satisfied.

## Gap list, verbatim, with the lead's verdict

### From the GPT verifier, over the Claude-built half

| # | Gap | Verdict | Basis |
|---|-----|---------|-------|
| G1 | `group-bad-shape` requires `visible` to be boolean — `visible: null` is instead converted to `false` by nullish defaulting | `declined` — **reversed in Remediation 2, see V1** | Every key in this schema treats null as absent — `kind`, `origin`, `exclusive`, `ref`, `note`, `graph`, `value`, `inferred` all use `??` (`viewer/server.js:156-162`, `:240-241`). `visible: null` yielding an invisible group is the file's own convention, and an agent gets exactly what omitting the key gives. `label`/`note` are the keys where `null` is meaningful, and those are handled |
| G2 | A cache hit returns before applying the requested font size, so a later measurement runs at the stale size | `declined` | The observed state is real — the metric element is left at 13px after a hit — but every cache **miss** sets the size before measuring, so no measurement is ever taken at the wrong size. Run in a real browser: the reported sequence, then a fresh 11px measurement, returned 136.71875, byte-identical to a clean 11px measurement of the same string |
| G3 | The refusal table says `bad-path`/`bad-body` precede authentication; the server checks the token first | `declined` | Pre-existing, about rows this change never touched, in a table sorted by status code whose preamble claims only "rough" order. Out of this Spec's scope |
| G4 | The paint-order test inspects only the boundary; moving the header layer would not fail it | `upheld` | Confirmed at `viewer/test/browser.spec.js:1817-1830`. The plan's own assertion was boundary-only, so the test is faithful to it — but COMPLETION.md cites it for the header layer's position, which it does not check |
| G5 | Neither the click nor the marquee test fails if the hit rect becomes full-width or loses `fill: none` | `upheld` | The plan names both explicitly because a worker guessing "ships either a black bar across the picture or a dead target" (`PLAN.md:379-385`). The dead target is guarded; the black bar is not |
| G6 | The dimming assertion checks class presence and would pass with the CSS selector list removed | `upheld` | The strongest finding of the two reports. Decision 42 exists **because** adding the class alone is a no-op, so the test passes against exactly the bug the decision was written about |
| G7 | `locator.click()` releases on the same element, so it still passes if `setPointerCapture` is removed | `upheld` | Correct. The capture's whole job is making the gesture survive a release elsewhere, which nothing exercises |
| G8 | The hover test asserts only that nothing dims, not that the boundary's stroke lifts | `upheld` | Confirmed at `:1883-1888` |
| G9 | Nothing tests `centreGroupIfNeeded` taking a visible group's full box, or `fitToView` including it | `upheld` | The cited `:1497` uses `groups-basic.json`, whose group is invisible, so it exercises the other branch |
| G10 | Two COMPLETION.md citations are off (`index.html:1052`, `browser.spec.js:1841`) | `upheld` | Verified |

### From the Claude verifier, over the GPT-built half

| # | Gap | Verdict | Basis |
|---|-----|---------|-------|
| C1 | Decision 31's newcomer mode — "the thing that arrived moves, not the picture that was already there" — can be deleted outright with both suites green | `upheld`, on different evidence | The gap is real, but **the verifier's stated mutation does not demonstrate it and neither did the lead's reproduction of it.** Replacing `isResident` so every changed group is resident is a no-op: `isNewcomer` is tested first in the sweep (`viewer/server.js:882`), so an all-new changed group never reaches the `isResident` branch and the edit changes no behaviour. It stays green because nothing happened. The R1 lane caught this and found the mutation that does delete newcomer mode — `isNewcomer` returning `false` for every group — against which the new assertion fails. Collin's round-2 call was genuinely unguarded; the route to proving it was wrong |
| C2 | Decision 39's create-is-resident-mode is untested; the create fixture's free node is already clear by 336px | `upheld` | The assertion is true in either mode |
| C3 | Decision 36's edge-neighbour anchor is asserted with a 1400px-wide window the centroid fallback also satisfies | `upheld` | **Reproduced by the lead.** Deleting the edge-neighbour search and centring on the pre-pack centroid leaves the server suite at 45/45 |
| C4 | Decision 41's least-added-area rule for rings above 0 is not pinned; the bound is satisfied by the wrong cell at both ends | `upheld` | The verifier's mutation puts the newcomer at `(-160, -40)` instead of `(-160, 100)`, nearly doubling the group's box height, with the suite green |
| C5 | The "two group boxes overlap while no node sits inside either" fixture does not reach that case — `report` sits fully inside `anchor`'s box | `upheld` | Verified against the probed positions. The test does correctly cover the separate item it shares a name with, that a moving unit which is itself a group translates whole |
| C6 | Five "Validated by" citations and two `server.js` citations in COMPLETION.md point at the wrong line | `upheld` | Verified |

Non-blocking coverage notes from the same verifier, folded into R1 below because they are the
same class and the same fixtures: the `visible: false → true` trigger in `groupChanged`, the
earlier-resident-is-anchor tie clause, the left/right/up/down tie order, the lattice's
row-then-column order within a ring, and an on-disk free node crowding an *unchanged* group.
Each survives its own mutation with the suite green.

## Tasks

Routed to the family that built the work, per `verification.md`. Round 1 sharpens the brief
rather than reaching for a bigger model, and the tier test re-applied: both lanes have to
build fixtures that actually reach a named case, which is shape-picking, so both stay at the
workhorse tier they started at.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|
| R1 | Make the server's placement assertions bite: C1–C5 plus the five non-blocking coverage notes. Every new or rewritten assertion must fail against a stated mutation | `viewer/test/server.test.js` | GPT / gpt-5.6-terra | `01a05602-0a55-7fa0-9216-9401089681ca` | `node --test 'viewer/test/*.test.js'`, plus the pasted mutation evidence | completed — 52 pass. Lane rejected the brief's C1 mutation as a no-op and supplied a valid one. Lead re-verified four mutations independently: the no-op stays 52/52, and genuine deletions of newcomer mode, the edge-neighbour anchor and the least-added-area rule each fail exactly one test. `viewer/server.js` byte-identical afterwards |
| R2 | Make the page's assertions bite: G4–G9. Assert rendered effect rather than class presence, and prove the pointer capture by releasing off the header | `viewer/test/browser.spec.js` | Claude / sonnet | Agent tool | `npm --prefix viewer run test:browser`, plus the pasted mutation evidence | completed — 51 pass. Lead re-verified four mutations independently: removing the `group-dim` selectors, deleting the header's `setPointerCapture`, letting the hit rect take its default black fill, and dropping the group boxes from `fitToView` each fail exactly one test. `viewer/index.html` byte-identical afterwards |
| R3 | Correct every citation in COMPLETION.md and narrow the two coverage rows whose cited tests do not support them | `docs/plans/group-boxes/COMPLETION.md` | lead | — | each citation re-read against the file | completed — 17 edits: nine wrong test citations, two wrong `server.js` citations, one wrong `index.html` citation, and seven rows narrowed to say what their evidence actually covers |
