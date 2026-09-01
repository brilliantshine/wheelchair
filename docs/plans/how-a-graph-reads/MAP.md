---
slug: how-a-graph-reads
---

# How this works today

The graph viewer as it stands before this plan. Two surfaces are in scope: the sentence an
agent writes about its own picture, and where the first render puts boxes and arrows.

## End to end

```
agent reads protocol/graphs.md
  → --open registers a path, prints port + token          viewer/server.js
  → PUT /graph  { hash, graph }                           agent sends no x/y at all
        ↓ validateGraph                                   server.js:124
      refuses a bad kind, a dangling edge, an unreferenced group
        ↓ layout()                                        server.js:479
      every id the server has never seen gets a row and a column
        ↓ canonical bytes to disk                         x/y now exist, on disk only
  → --show opens a tab
  → index.html renders                                    boxes at disk x/y,
                                                          arrows trimmed to box edges
  → Collin drags boxes, rules on entries                  page PUTs /view
  → next agent turn GETs the file back                    reads Collin's x/y
```

## What happens

1. **The agent never states a position.** `protocol/graphs.md:327` forbids sending `x`/`y`
   on the wire, and the server discards them anyway — `layout()` (`viewer/server.js:479`)
   assigns a position to every id it does not already hold on disk. So at the moment the
   agent writes `explanation`, no layout exists yet in this world: the words are composed
   before any coordinate does.

   The one qualification: on a **redraw**, the read-back rule
   (`protocol/graphs.md:532`) has the agent `GET` the file first, and that response carries
   the `x`/`y` currently on disk. So a second pass can read positions — Collin's, if he
   dragged. They are stale the next time he does.

2. **`layout()` is a small Sugiyama pass.** Cycles are broken by turning back edges around
   (`breakCycles`, `server.js:507`); each node lands one row below its deepest parent
   (`layerByLongestPath`, `server.js:534`); rows are reordered to cut arrow crossings, and
   each box slides toward the median of what it connects to (`placeComponent`,
   `server.js:577`). Rows are 140 apart, columns 260 (`server.js:466`). Disconnected pieces
   are placed side by side rather than stacked.

3. **Every arrow is one straight line, centre to centre, trimmed at the box boundary.**
   `viewer/index.html:1158` takes both box centres, `rectExit` (`index.html:858`) walks out
   along that line until it leaves the rectangle. Which face it leaves through is therefore
   whatever the geometry says — bottom for a steep line, right or left for a shallow one.
   The threshold is the box's own aspect: a box is 200 wide and at least 74 tall, so an
   arrow exits sideways once its slope falls below about `41/104`, and a taller box (a
   five-line label reaches 116) makes sideways more likely, not less.

4. **The explanation is checked for dangling group references and nothing else.**
   `server.js:268` collects every `[phrase](#group-id)` in the explanation and refuses an id
   with no group (`explanation-missing-group`), then refuses an invisible group nothing
   points at (`group-unreferenced`, `server.js:278`). The *phrase* itself is never looked
   at.

5. **The format tells the agent to keep position words and wrap them.**
   `protocol/graphs.md:124` names the problem exactly right — a position word "points at an
   arrangement the reader may since have dragged into a different shape" — and then
   prescribes marking it rather than dropping it. `graphs.md:479` repeats the instruction as
   a command: "Mark a position word, and define its group."

## What matters for this change

**Position words are in nine of the eleven graph explanations that predate this plan, and
marking has not helped.** Measured across `docs/plans/*/graphs/*.json`, excluding the untracked
windows-support plan. Three samples, all committed:

- `one-account-setups/graphs/what-touches-the-two-account-path.json` — "The split down the
  middle is the whole decision… The greyed box **on the right** is the item that was here
  last time." That file has no `groups` at all, so neither phrase is markable, and neither
  is checkable.
- `group-boxes/graphs/group-verdicts.json` — "The reason groups were left out of verdicts
  sits **at the top**, and the two answers hang off it."
- `group-boxes/graphs/who-moves.json` — "[The fresh-graph case](#fresh-case) runs **down
  the left**." Marked, and *then* narrates a position on top of the mark. The reference is
  doing its job; the sentence still claims geometry the agent cannot see.

So the current rule is not merely unenforced — it legitimizes the sentence Collin cannot
use. A marked phrase makes a set of boxes *findable*; it does nothing about a clause that
asserts where they sit.

**Arrows leaving through a side face are 21 of 186 edges**, in 9 of the 16 graph files that predate
this plan, computed by running the real `layout()` and the real `nodeHeight()` over each file.
Worst offender is `group-boxes/graphs/boundary-choice.json` at 5. None of the 186 points up
the page.

**Branch arms already sit side by side in the ordinary case.** Of 46 nodes with more than
one outgoing arrow, 38 have every arm on one row. The 8 that stagger do so because an arm
has a second, deeper parent. `diagram-sensitivity/graphs/which-surface.json` is the clearest:
the fork `which-surface` sits at row 1 and its three arms land on rows 2, 3 and 4, because
`worth-ruling → viewer` and `worth-ruling → throwaway → inline` push two of the arms down.
Levelling them would point an arrow back up the page.

## Problems found

**The stated rule "branch arms side by side" and the existing rule "every arrow points down
the page" cannot both hold on the graphs that stagger.** The downhill rule is not incidental:
`protocol/graphs.md:327` states it, and `viewer/test/server.test.js:1098` is a test named
for it. In `which-surface.json` no arm can be raised — `viewer`'s other parent is one row
above it, and `inline`'s is one row above *that*. Settled during planning, and not by taking that trade: the
ask turned out to be that arms not stack in one column, which they never do. The plan does not
touch layering — see Decision 27.

**The fixture that exercises group references is itself written in position words.**
`viewer/test/fixtures/groups-basic.json` uses "the left branch" and "the far branch", and
`viewer/test/browser.spec.js:1714` asserts those exact strings. Any rule that bans position
words has to move that fixture, or the suite encodes the thing being banned.

**A word-list check refusing a write is fragile in an obvious way.** "right" is in "the
right answer", "left" in "what is left over", "below" in "the section below". A false refusal
blocks the whole `PUT`, not just the sentence. This is a design question, not a detail.

## Not checked

- The page's own write route, `PUT /view`, and the two refusals that police it
  (`structural-difference`, `bulk-not-additive`). Nothing here touches bulk verdicts.
- Group boundary rendering beyond the constants: I read `GROUP_PAD`/`GROUP_HEADER`/
  `GROUP_GAP` and the box formula, not `placeGroupUnits` (`server.js:832`) or
  `placeNewGroupMembers` (`server.js:764`) in detail. A port change that alters where an
  arrow meets a box may interact with a drawn boundary; I have not established whether it
  does.
- `sensitivity/set.sh` and the rendered dial region. The dial decides *whether* a picture is
  drawn, not how it reads, so I assumed it is out of scope and did not read it.
- Whether Playwright is installed and the browser suite currently passes on this machine. I
  ran neither suite.
