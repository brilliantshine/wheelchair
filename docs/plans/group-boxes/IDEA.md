---
slug: group-boxes
status: confirmed
created: 2026-08-30
---

# Boxes that show a system without hiding it

## What we're building

A second way for a graph to say "these parts belong together": a named rectangle drawn
around a set of boxes, with a short description, sitting on the canvas as part of the
picture rather than behind a click. It lives alongside the openable box the format already
has, and the two answer different needs — one keeps a system visible, the other puts its
insides away.

## Why — the problem

Today a graph has exactly one way to express that several steps form one thing: move them
into a child graph and leave an openable box in their place. That is the right answer when
the inside matters but showing it would bury the outer flow — the flow within is worth a
click, and the twelve boxes it holds would make the whole picture unreadable.

It is the wrong answer for the other case, which comes up just as often: a set of steps
that reads clearly as one system *and* whose parts belong on screen with everything else.
Pushing those behind a click loses the thing worth showing. Today the only alternative is
to leave them loose and describe the grouping in prose — which the reader has to hold in
their head while looking at boxes that carry no sign of it.

## What good looks like

- Looking at a graph, you can tell at a glance which boxes form a system and what that
  system is called, without hovering, clicking, or reading the prose beneath the title.
- Alongside the name, a sentence saying what the system is — enough that the grouping does
  not need explaining elsewhere.
- Membership is unambiguous in the picture as drawn. A box is plainly inside a group or
  plainly outside it, and no box that belongs to nothing appears to belong to something
  because it happens to sit where a group is drawn. After that the arrangement is the
  reader's own: a box dragged across a boundary reads however it now looks, and nothing
  tries to stop it or put it back.
- Drawing a graph, an agent has a real choice between the two, and the format says clearly
  which case each one is for — a system worth seeing whole gets a group, a flow whose
  insides would clutter gets an openable box.
- The graphs that exist today keep working untouched.

## Not doing

- **Not replacing the openable box.** It stays exactly as it is, for exactly what it is
  for. This is a second tool, not a migration.
- **Not making a group hide anything.** No collapsing a group down to a single box, no
  expanding it back. If the insides should be hidden, that is what the openable box already
  does.
- **Not giving a group its own child file.** A group holds boxes that are in this same
  graph; it is not a doorway to another one.
- **Not a general layout or styling system.** A group has a name and a description and a
  boundary. It does not get colours to choose, shapes to pick, or an appearance an agent
  can decide.

## Constraints

- A graph is disposable and holds no contract — it is redrawn from nothing when it goes
  stale, never patched back into truth. Nothing here may turn a graph into documentation.
- The format, the server that validates it, and the page that draws it are three things
  that have to agree, and the server refuses anything it does not recognise. Any change
  here is a change to all three at once.
- Positions belong to Collin. He sets them by dragging, and the automatic layout runs only
  when a graph is written for the first time and never again. A picture he has arranged is
  never rearranged behind him: the only boxes this feature may move are ones a write has
  just disturbed — a box that has just arrived, or one a newly drawn group has landed on
  top of — and it moves them the least it can.
- The target size of a graph is 10 to 25 boxes. This must not become a reason to draw
  bigger ones.
