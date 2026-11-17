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
| 4 | Zoom as well as drag: + and − buttons, plus pinch (trackpad or touch) and Ctrl+wheel. | Collin picked "Drag and zoom": a big tree can be seen whole. | user |
| 5 | A lead's tree opens at full size (100%), top centre, as today; zoom is never changed automatically. | Keeps decision 3; auto-shrinking would make boxes unreadable without being asked. | defaulted |
| 6 | View buttons: −, +, Fit and 100%. Fit shrinks the whole tree into the visible area, centred; 100% returns to full size, top centre. | Collin picked "Fit and 100%". | user |
| 7 | Zoom is limited to 20%–200%; Fit never enlarges past 100%; + and − step by 1.25×; zoom from the pinch/wheel keeps the point under the pointer still, zoom from buttons keeps the centre of the area still. | Common pan-zoom behaviour, matching the graph viewer's wheel zoom (`viewer/index.html:2362-2379`). | defaulted |

## Spec

Grown as decisions land.

- **View state.** The tree has a view: an offset (drag) and a zoom level. It survives the five-second rebuild and selecting a box; switching lead resets it to 100%, top centre (decisions 1, 5).
- **Zoom.** + and − buttons, pinch on a trackpad or touch screen, and Ctrl+wheel. Wheel and two-finger scroll without Ctrl still move the tree (decision 2, 4).
- **Buttons.** −, +, Fit, 100% (decision 6, limits in decision 7).
- **Small trees** that fit look and behave as today (decision 3).

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
