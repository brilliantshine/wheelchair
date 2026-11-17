---
slug: agents-tree-pan
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Drag the Agents tree to see all of it

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md`.

## Open Questions

### Q1: Zoom as well as drag?
- **Context:** Dragging alone lets him reach every box, but never see a 16-agent tree at once. A fit-to-screen button (Q2) only makes sense with zoom.
- **Options:** drag only; drag plus zoom (buttons, and pinch or Ctrl+wheel).
- **Recommendation:** drag plus zoom.

### Q2: A fit-to-screen / reset button?
- **Context:** Depends on Q1. With zoom, "fit" shrinks the whole tree into view; without it, "reset" moves back to the top centre.
- **Options:** none; one button (fit with zoom, reset without); both fit and reset (100%).
- **Recommendation:** decided after Q1.

### Q3: Where can a drag start?
- **Context:** Boxes are buttons that select on click. The graph viewer treats a press that moves more than a few pixels as a drag, not a click (`viewer/index.html:2292-2309`).
- **Options:** empty space only; anywhere, including on a box, with a small movement threshold so a still click selects.
- **Recommendation:** anywhere, with the threshold: in a dense tree, empty space is hard to find.

### Q4: Phones?
- **Context:** Under 900px the tree is an indented list that scrolls normally (`viewer/pages/views.css:165-180`); it never overflows sideways much.
- **Options:** keep the list unchanged; show the drawn tree with drag and pinch on phones too.
- **Recommendation:** keep the list.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | The view (drag offset, and zoom if any) is kept across the five-second rebuild and across selecting a box; it resets when switching to another lead. | IDEA requires no jumping back; a different lead is a different tree. | defaulted |
| 2 | The mouse wheel and two-finger trackpad scroll keep moving the tree as they do now. | Matches today's behaviour and every other page; nothing to relearn. | defaulted |
| 3 | A tree that already fits looks and behaves as it does today (centred, no drag needed). | IDEA "what good looks like". | defaulted |

## Spec

Grown as decisions land.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
