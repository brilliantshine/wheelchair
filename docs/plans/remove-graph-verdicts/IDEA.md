---
slug: remove-graph-verdicts
status: confirmed   # draft | confirmed
created: 2026-11-15
---

# Remove agree/reject from node graphs

## What we're building

Node graphs stop having an agree/reject step. Today a person selects boxes and arrows in
the browser and marks each one agreed or rejected, and the server stops an agent from
changing or dropping those marks. After this change a graph is just a picture: boxes,
arrows, groups and positions, with nothing to rule on.

## Why — the problem

Collin no longer uses the agree/reject step. It still costs something:

- Every agent that draws a graph has to follow rules about keeping marks.
- The server refuses some agent writes for removing or changing a mark.
- Planning has to account for every rejected entry before review.

All of that is upkeep for a feature nobody uses.

## What good looks like

- The graph page has no agree/reject buttons, no struck-through or colored "verdict"
  styling, and no legend for it. Dragging boxes to move them still works.
- An agent can redraw a graph freely, as long as the drawing itself is valid.
- The graph rules and the planning rules no longer mention agreeing or rejecting entries.
- Every graph already committed, including archived threads' graphs, still opens and
  looks right.
- The test suites pass, with the verdict tests removed rather than skipped.

## Not doing

- Not changing how graphs are drawn otherwise: layout, groups, run pictures, the thread's
  diagram card, dragging and saving positions all stay.
- Not touching reviewer or verifier "verdicts" on plans. Those are a different thing with
  the same word.
- Not touching the server's check on which website a request comes from. It is also
  called "origin", but it is unrelated.

## Constraints

- Old graph files that still carry the agree/reject fields must keep loading.
