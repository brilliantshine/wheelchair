---
slug: graph-legibility
status: confirmed   # draft | confirmed
created: 2026-08-29
---

# A graph you can read without touching it

## What we're building

Three changes to the graph viewer, all aimed at the same thing: getting the answer off the
screen without a hover, a click, or a guess.

Boxes stop cutting their own text off. The sentence an agent wrote in a box is the sentence you
read, at whatever size or shape that takes.

A phrase in the explanation panel becomes something you can point at. When an agent writes "the
left branch" or "option A", the words are marked, and putting the pointer on them lights up the
boxes it means. The agent decides what the phrase refers to, so nobody has to work it out from
the picture.

The text on an arrow reads as belonging to that arrow, even when several are crowded together.

## Why — the problem

A node's label is cut to three short lines and the rest becomes an ellipsis, so reading a
crowded graph means hovering box by box. The information is on disk and on the screen, just not
where the eye is.

An agent describing a picture reaches for position words — "the left branch", "the bottom
cluster", "branch A". Since a graph now opens laid out by the server and gets dragged around
afterwards, those words point at an arrangement the reader may not be looking at, and the reader
has to reverse-engineer which boxes were meant. It is worst exactly where it matters most: when
an agent lays out options to choose between.

Where several arrows run near each other, their labels are pushed apart to stay legible, far
enough that a label can sit nearer a different arrow than its own. Each label is readable; which
arrow it belongs to is not.

## What good looks like

- A box holds the labels agents actually write. The measured case: "today: every lane points at
  the balancer's slot, and that works - about 15 ran this session" is 91 characters, and today's
  box holds 72 and cuts it at "about". That length reads in full without a hover.
- A genuinely long outlier still truncates, and the hover tooltip and detail panel still rescue
  it. Fitting everything at any length is explicitly not the bar — it drags the picture out of
  scale for one bad label.
- Boxes still do not overlap each other on that first render, and arrows still run down the
  page — the untangled first render already built is not traded away for room to write in.
- Reading an explanation that says "the left branch", you put the pointer on those words and the
  boxes it means light up. You never count boxes to find out what was meant.
- An agent can offer "option A" and "option B" and each is a thing you can point at, rather than
  a description you have to resolve yourself.
- With several arrows crowded together, you can tell at a glance which text goes with which
  arrow — by following something drawn, not by guessing from proximity.
- An agent still writes a graph by reading one file and sending one request. Anything added here
  is optional to send, and a graph that ignores all of it still draws exactly as it does today.

## Not doing

- **The wording agents choose for node labels.** Collin has separate complaints about how nodes
  are phrased. That is a rule about what agents write, not about what the viewer draws, and it is
  a different change.
- **Rewriting the layout.** The Sugiyama first render stays. It gets whatever size information it
  needs to keep working, and nothing else.
- **Making a graph durable.** A graph is still disposable, still redrawn from nothing when it goes
  stale, still not documentation.
- **Editing in the browser.** The page still writes only positions and verdicts. Nothing here lets
  a person create, rename, or connect anything.
- **Groups as a structural feature.** A named set of nodes exists to be pointed at from prose. It
  is not containment, it is not a new kind of node, and it does not nest.

## Constraints

- **The page and the server share no code.** Two standalone files, no bundler, no shared module.
  Any rule both need either exists twice or lives on one side only, and duplicating a rule across
  them is how the two get to disagree.
- **The server's layout has its own size assumptions.** Rows 140 apart, boxes 260 apart
  (`viewer/server.js:376-377`). Boxes that grow past those numbers overlap on first render unless
  the layout is told.
- **The file format is byte-canonical and closed.** Seven top-level keys in a fixed order, every key
  present on every entry, unknown keys dropped (`viewer/server.js:86`, `:110`). Anything new is a
  format change, not an extra field the server will quietly carry.
- **The verdict contract is untouchable.** Agents propose; only a person rules. Rejected entries
  are preserved verbatim forever, agreed ones may only be reset through a visible two-step. Nothing
  here may give an agent a way around that.
- **`protocol/graphs.md` is the only thing an agent reads before its first write.** Whatever is
  added has to be teachable there, in that one file, or agents will not use it.
- **One person's browser, on one machine.** No shared state, no multi-user concerns, no support
  burden beyond this repo.
