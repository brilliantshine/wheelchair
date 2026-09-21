# How the viewer places boxes today

## End to end

An agent sends a graph and never sends a position for anything in it
(`protocol/graphs.md:329`). The server decides every position on the way to disk, and the
page decides how much of the result you see when it opens.

On the server, a write splits two ways at `viewer/server.js:1255`.

For a file that does not exist yet, `layout()` (`:558`) runs over the whole graph. It
turns any arrow that closes a loop around so every arrow can point down the page
(`breakCycles`, `:584`), puts each box one row deeper than its deepest parent
(`layerByLongestPath`, `:611`), splits the graph into pieces that share no arrow and lays
each out separately (`components`, `:635`), then for each piece reshuffles every row until
the fewest arrows cross and slides each box toward the middle of whatever it connects to
(`placeComponent`, `:654`). Rows are a fixed 140 pixels apart and boxes a fixed 260 apart
(`LAYER_GAP`, `NODE_PITCH`, `:545`). The result is clean: every box on a row, every arrow
pointing down.

For a file that already exists, `retainDiskPositions()` (`:779`) keeps whatever position
each known id already had — that is how a dragged arrangement survives an agent redraw —
and gives any unknown id whatever `layout()` computed. Worth noticing: that call lays the
*whole* graph out from scratch and then throws away everything but the new ids
(`:781-786`), so a newcomer's position comes from an arrangement that knows nothing about
where the retained boxes actually sit, and can land straight on top of one.

Then, on both paths, `placeGroupUnits()` (`:909`) runs over the result and moves things
again. This is where the damage is.

It first calls `placeNewGroupMembers()` (`:841`). For a drawn group whose members are
*all* new — which is every drawn group on a first write, since nothing is on disk yet — it
discards the computed positions outright and repacks the members into a
`ceil(sqrt(n))`-wide block in sorted-id order, consulting no arrow between them
(`:860-868`). Five members become three then two, alphabetically. For a group with some
members already placed, a newcomer instead takes whichever free lattice cell grows the
group's rectangle least (`latticeRing`, `:822`, used at `:886-898`).

It then treats each drawn group and each ungrouped node as one unit (`:920-924`) and, for
any two units whose rectangles come within `GROUP_GAP` = 16 pixels, slides one of them the
shortest distance that clears everything it touches, in any of four directions
(`move()`, `:933-961`). Nothing in that search knows the row grid exists.

On the page, `loadGraph()` calls `fitToView()` once per graph opened
(`viewer/index.html:696`) — on first open and on stepping into a child graph, not on the
one-second poll that picks up an agent's redraw (`pollOnce`, `:1914`). `fitToView`
(`:654`) measures the bounding box of every node plus every drawn group rectangle, scales
the whole thing to fit one screen with a 60-pixel margin, caps the scale at 1 and floors
it at `MIN_ZOOM` = 0.3 (`:250`, `:677`), then centres the picture on that box's midpoint
(`:679`). Panning and wheel-zoom are available from the first frame (`:1890-1904`).

```
agent writes, no positions
        ↓
  file on disk?
   ├─ no  → layout(): break cycles → rank rows → order rows → slide columns
   └─ yes → keep every known position; layout() for the new ids only
        ↓
  placeGroupUnits()
   ├─ group all new?  → repack into a sqrt(n) block in id order   ← discards the rows
   ├─ group part new? → newcomer takes the cheapest lattice cell
   └─ two boxes within 16px? → slide a whole unit clear           ← ignores the rows
        ↓
  canonicalize, write to disk
        ↓
  page opens → fitToView(): scale everything to one screen, floor 0.3, centre
```

## The two things that are wrong

The layered layout never gets to place a grouped box. Whatever row and column it earned is
overwritten by either the sorted-id block or the collision slide, both of which read
rectangles and nothing else. This is not the ordering rules doing badly inside a group; it
is the ordering rules not running there at all.

Measured, not inferred: laying `docs/plans/separate-the-record/graphs/what-the-reviewer-reads.json`
out twice through a real server, once with its groups and once with them stripped, gives
four clean rows at y = 0, 140, 280, 420 without groups; with groups, `accepted` and
`declined` — the two boxes `finding` points into — land at y = -156, so two arrows run
backwards up the page. The trigger was a 4-pixel shortfall between two group rectangles,
and the cheapest escape `move()` found was a 296-pixel jump.

Second, `fitToView` shrinks a large graph until all of it fits, down to 0.3 scale, even
though panning and scrolling have worked since the first version. A graph that does not fit
opens unreadable rather than opening readable and partly off-screen.

## What this change has to live with

Positions on disk are Collin's, set by dragging, and an agent redraw must not move them
(`retainDiskPositions`, `:779`). So there will always be two placement paths — a full
layout for a fresh file and an incremental placer for a redraw that adds boxes to an
arrangement someone has already touched. Only the first can be a clean layered pass.

The server and the page both compute a group's rectangle and share no module, so
`GROUP_PAD`, `GROUP_HEADER` and `GROUP_GAP` are stated once in `protocol/graphs.md:200-203`
and copied into `viewer/server.js:548-550`. Only the first two reach the page
(`viewer/index.html:260-261`, which notes at `:259` that it never uses `GROUP_GAP`), so
changing a group's padding is a three-file change and changing its spacing is a two-file
one.

The server holds every node to a fixed 200-by-116 box when it measures a group
(`GROUP_NODE_H`, `viewer/server.js:552`) while the page measures each label's real height,
74 for a short one (`NODE_H`, `viewer/index.html:230`). `protocol/graphs.md:216-219` states
the disagreement deliberately: the server's box is never smaller than the page's.

About a dozen tests in `viewer/test/server.test.js:599-834` assert the current shoving and
lattice behaviour directly — the eviction order, the four-direction tie-break, the exact
16-pixel landing. They are tests of the mechanism being removed, not of the outcome, so
they go with it. `:1195` (no arrow points back up the page) and `:1243` (every component
gets placed) are outcome tests and should survive; `:1224` (consecutive rows exactly 140
apart) pins a constant that a variable-height row would break.

## What I did not check

- The page's own write route, `PUT /view`, and whether anything there depends on positions
  being on a grid.
- How edge labels are placed, beyond noticing that one test displaces a label off a group
  header (`viewer/test/browser.spec.js:2039`).
- The child-graph path: whether stepping into a child re-fits sensibly is governed by the
  same `fitToView` call, but I did not read how a child's own positions are first assigned.
- Anything about how the browser suite measures, beyond the test names.
