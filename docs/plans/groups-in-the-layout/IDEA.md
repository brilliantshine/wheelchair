---
slug: groups-in-the-layout
status: confirmed   # draft | confirmed
created: 2026-09-20
---

# A box inside a drawn group gets laid out like every other box

## What we're building

Two changes to the graph viewer. First, boxes that belong to a drawn group get their
positions from the same layered layout that places everything else, instead of being
repacked alphabetically and then shoved around afterwards. Second, a graph that is too big
for the screen opens at a size you can read, and you pan to the rest, instead of being
shrunk until all of it fits.

## Why — the problem

Drawing a group around a set of boxes currently makes that part of the picture worse than
if the group were not there. The layered layout works out a row and a column for every box,
and then a second pass throws that answer away for anything inside a drawn group: the
members get repacked into a square-ish block in alphabetical order, and whole groups get
slid up, down or sideways whenever two group boxes come within sixteen pixels of each
other. Neither pass looks at a single arrow.

What comes out is a group whose insides are scrambled — a box sitting above the box that
feeds it, arrows running backwards, boxes off the row grid the rest of the picture is on.
On one real file, a four-pixel clearance problem moved two boxes 296 pixels the wrong way.
The tangle is worst exactly where a group is most useful: a set of steps that reads as one
system, which is the thing the reader most needs to follow in order.

Separately, the page shrinks every graph to fit one screen when it opens, down to a third
of normal size. Panning and scrolling have worked from the beginning, so nothing required
the whole picture to be visible at once, and a large graph opens unreadable instead of
opening readable and continuing off the edge.

## What good looks like

- A graph with drawn groups reads the same as one without: a box sits below what feeds it
  and arrows point down the page, inside a group as well as outside.
- No group's contents are arranged by the alphabet.
- Group boxes still never overlap each other or swallow a box that does not belong to them,
  and getting that right never costs a box its row.
- A graph too large for the window opens at a size you can read, showing the part you would
  want to start at, with the rest reachable by panning.
- Dragging still works and still lasts: a box stays where it was put across a page reload
  and across the viewer's own refresh. It is an agent's redraw that is free to move it.

## Not doing

- No change to the graph file format: no new fields, no stored group rectangle, nothing an
  agent writes differently.
- Not touching invisible groups. They are highlight sets behind a phrase in the
  explanation, they have never affected placement, and they will not start to.
- No nested groups. The server already refuses two drawn groups naming the same box, and
  that stays.
- No change to how arrows are drawn or routed — still one straight line, still choosing a
  face on the page rather than the server.
- Not preserving a dragged arrangement through an agent's redraw. A redraw lays the picture
  out fresh, and dragging is how you fix what it got wrong until the next one.

## Constraints

- Verdicts are still Collin's and are still preserved across a redraw — a box he has agreed
  to or struck keeps that ruling, which is what the preservation contract in
  `protocol/graphs.md` is for. Positions are not verdicts and are not covered by it.
- The server and the page each compute a group's rectangle and share no module. The three
  numbers involved are stated once in `protocol/graphs.md` and copied into both files, so
  changing how a group is sized or spaced is a change in three places.
- The page has to keep rendering a hand-dragged arrangement that obeys none of the layout's
  rules — dragging is unrestricted and nothing snaps.
- About a dozen tests in `viewer/test/server.test.js` assert the current shoving and lattice
  mechanics directly. They test the mechanism being removed, so they go with it, and the
  outcomes worth keeping have to be re-asserted against whatever replaces it.
