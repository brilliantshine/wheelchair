---
slug: graph-legibility
---

# How this works today

The current system, before any of this plan's changes. Written before planning starts and
extended as questions dig deeper.

## End to end

```
agent PUTs JSON → server validates shape → first write only: Sugiyama layout → canonical file on disk
                        ↓ refused                                                  ↓
                  422 with a code                                  browser GETs it → fit to view → draw
                                                                                          ↓
                                                               Collin drags a box → PUT /view → same file
                                                                                          ↓
                                                                page polls GET every second
```

## What happens

1. An agent writes a graph by `PUT /graph` (`viewer/server.js:882`, unchanged handler shape
   after the layout work). The server checks the shape, fills defaults for every key the agent
   omitted, and refuses a write that claims a verdict the agent has no authority over
   (`viewer/server.js:110`, `:268`).

2. On a **first** write only, the server invents positions, and since PR #2 it does a small
   Sugiyama pass rather than a grid (`viewer/server.js:383-604`): turn back edges around so
   every arrow points down, put each node one row below its deepest parent, reorder each row by
   median to cut crossings, then slide each box toward the middle of what it connects to.
   Disconnected pieces go side by side. Every later write keeps the position already on disk for
   any id it recognizes.

3. The layout's sense of size is four constants: rows 140 apart, boxes 260 apart across, a
   bend point 160, a gap of 200 between disconnected pieces (`viewer/server.js:376-381`).
   The across-pitch is assigned **per node** into a map before packing (`viewer/server.js:535`),
   so the machinery for a per-node width already exists — what does not exist is any function
   telling the server how wide a given node is.

4. The file is written byte-canonical: six top-level keys in a fixed order, nodes and edges
   sorted by id, every key present on every entry (`viewer/server.js:86`). The six are `schema`,
   `title`, `source`, `source_detail`, `explanation`, `nodes`, `edges`. There is no seventh, and
   nothing in the format names a *set* of nodes.

5. The browser loads the graph, scales it to fit the viewport capped at 1x
   (`viewer/index.html:476`), then draws every node, every edge, and a detail panel if exactly
   one thing is selected (`viewer/index.html:1043`).

6. A node is a box of **fixed width 200** and variable height (`viewer/index.html:169`, `:606`).
   The label wraps to at most 3 lines of 24 characters — 16 on the first line if the node carries
   a child graph, so the "open ›" badge does not sit on the text (`viewer/index.html:221`, `:605`).
   Past that the tail becomes an ellipsis. Height grows 16 pixels per extra line from a 74-pixel
   floor, so the tallest box is 84.

7. When the label was cut, two things offer the rest: a native browser tooltip on the box, and
   the detail panel that opens on selection (`viewer/index.html:617`, `:682`, `:889`). Both cost
   a hover or a click.

8. An edge is trimmed to each box's real boundary, then its label is placed by search
   (`viewer/index.html:843-856`). Sixty candidate spots: six sideways steps out from the line,
   five positions along it (the midpoint, then a sixth and a quarter of the way toward either
   end), each on both sides. The first spot hitting nothing already placed wins. Since PR #2 the
   placed set is seeded with **every node box** (`viewer/index.html:1078`), so a label no longer
   sits on a box's own words.

9. The explanation is one string, written into the page with `textContent`
   (`viewer/index.html:591`). It is agent-owned: the page's own write route refuses any change to
   it (`viewer/server.js:858`), and `protocol/graphs.md` says it carries no verdict and is
   rewritten freely on every redraw.

10. Collin drags boxes and rules on entries; the page writes back through `PUT /view`, which
    refuses anything that is not a position or a verdict (`viewer/server.js:843`, `:664`).

## What matters for this change

**Node width is a constant read from twelve places.** `NODE_W` at `viewer/index.html:169` drives
edge trimming, the fan-out separating two edges between one pair, the child badge and fork tag
positions, fit-to-view, box-select hit testing, the detail panel's collision search, and the
seeded box list the edge-label search avoids. Making width vary is not one edit; it is replacing
a constant with a function everywhere it is read.

**The server has a second, independent set of size assumptions.** Its 260 across-pitch and
140 row-gap (`viewer/server.js:376-377`) are the same numbers restated in the other file. Two
consequences: a page drawing wider boxes than the server spaced for produces a first render
with boxes overlapping, and a box allowed to grow past 140 tall collides vertically, because the
row gap is a constant rather than the tallest box in that row. The vertical half is already
live — heights vary today and 140 works only because the cap is 84.

**The two files share no code.** `viewer/index.html` and `viewer/server.js` are standalone by
design — no bundler, no module both import. A size rule the server needs in order to lay out and
the page needs in order to draw either exists twice or moves entirely to one side.

**Nothing in the format names a group of nodes.** Highlighting "the left branch" from a phrase in
the explanation needs both a way to name a set of node ids and a way to mark which words in the
prose point at it. Neither exists. That is a schema change reaching canonicalization
(`viewer/server.js:86`), validation (`:110`), the structural check deciding what the page may not
touch (`:649`), and `protocol/graphs.md`, which is the only thing an agent reads before drawing.

**Two tests pin the current geometry.** `assertNoOverlap` hardcodes a 200×84 box
(`viewer/test/server.test.js:30`) and gates three layout tests. The Chromium test at
`viewer/test/browser.spec.js:153` asserts no edge label overlaps any node box on a freshly laid
out fixture built to crowd them (`viewer/test/fixtures/label-crowding.json`).

## Problems found

**The label search still gives up silently.** If all sixty spots are taken it falls back to the
natural midpoint offset and draws there anyway (`viewer/index.html:855`), overlapping whatever
was already placed. Rarer than before PR #2, not gone.

**Which label gets the good spot is arbitrary.** Placement is first-come in `graph.edges` order
(`viewer/index.html:1079`), which is the file's id sort — the label that lands cleanly is the one
whose id sorts first, not the one that needs it most.

**A label never sits on its own line.** The search's nearest candidate is already half the
taller endpoint plus 16 pixels off to one side (`viewer/index.html:842`) — 53 pixels for the
smallest box, 58 for the tallest today — and it steps out to 133 or 138 from there, in either
direction, and up to a quarter of the way along the line as well. Every label is therefore
floating in the gap between rows with no drawn tie to the arrow it belongs to, which is the
"which text belongs to which arrow" complaint. The offset's original reason was that a centred
label would land inside a node box, but since PR #2 the search is seeded with every box
(`viewer/index.html:1078`) and rejects those spots on its own. The detail panel already has the
missing mechanism: a dashed leader line back to the item it belongs to
(`viewer/index.html:990`).

**The label's collision rectangle is a guess.** Width is estimated as `text.length * 6.2 + 14`
(`viewer/index.html:843`) against text actually rendered at 11px in a proportional font. A
mis-estimate means the search tests a rectangle that is not the one drawn, so a spot it called
clear can still overlap.

## Not checked

- The Playwright suite past the two tests bearing on truncation and on label-vs-box overlap, plus
  the names of the other 24. I do not know which others would move.
- `pack` and `crossings` in the layout (`viewer/server.js:570`, and the crossing counter) beyond
  reading their comments — I have not traced their arithmetic.
- Whether the 6.2-pixels-per-character estimate is close in practice; I read it, I did not measure
  a rendered label against it.
- The Codex-side wrapper (`codex/prompts/`) and `skills/graph/SKILL.md` past confirming they are
  one-line pointers.
