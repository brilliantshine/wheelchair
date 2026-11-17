---
slug: agents-tree-pan
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Drag the Agents tree to see all of it

## What we're building

On the app's Agents screen, you can grab the tree of agents and drag it around, so a tree
bigger than the screen can be seen in full. Clicking a box still selects that agent.

## Why — the problem

A busy thread can have 16 or more agents: a lead, a mapper, several reviewers, a sub-lead
and many workers. Its tree is much wider and taller than the main area, so Collin can't
see the whole thing at once, and the scrollbars are an awkward way to get around it.

## What good looks like

- With a large tree on a computer, Collin can press on empty space in the tree and drag
  to move it in any direction, and reach every box.
- A plain click on a box still selects it and shows its details, as today.
- Where he has moved the tree stays put while the page refreshes itself every few
  seconds and when he selects a box; the view never jumps back on its own.
- A small tree that already fits looks and behaves as it does now.

## Not doing

- Changing how the tree is laid out, the connector lines or the size of the boxes (a
  separate thread, "Agents tree: straight connectors, shorter boxes", covers those).
- Changing the side panel, the terminal panel or the list of leads.
- Changing any other page, such as the graph viewer.

## Constraints

- Works in Chromium and Firefox, which the browser tests run.
- The page rebuilds the tree every five seconds and on every selection, so whatever
  Collin has moved has to survive that rebuild.
- The terminal panel can cover the bottom of the tree; dragging must not interfere with it.
