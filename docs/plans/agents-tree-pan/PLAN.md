---
slug: agents-tree-pan
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Drag the Agents tree to see all of it

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md`.

## Open Questions

None.

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
| 8 | A drag can start anywhere in the tree area, on a box or empty space. A press that moves more than 5px (in screen pixels) is a drag and selects nothing; a press that stays within 5px and releases on a box is a click and selects it as today. | Collin picked "Anywhere"; threshold approach follows the graph viewer (`viewer/index.html:2292-2309`). | user |
| 9 | Phones and any window under 900px keep today's indented list unchanged: no view buttons, no drag or zoom handling. | Collin picked "Keep the list". | user |
| 10 | Supersedes 5: a lead's tree opens at 100%, scrolled to the top with the lead box centred horizontally. Today a wide tree opens at its left edge, which can leave the lead off screen; the 100% button returns to this same view. | Decision 5 wrongly said this was today's behaviour; centring the lead is the useful start for a wide tree. | defaulted |
| 11 | Fit fits the tree into the part of the tree area the terminal panel does not cover. | Otherwise Fit would hide the bottom of the tree under an open terminal. | defaulted |
| 12 | The current zoom is shown as a percentage beside the buttons; the buttons sit in a row above the tree area and do not move when the tree moves. | Needs no choice from Collin; keeps the controls reachable. | defaulted |

## Spec

### What changes, in short

On screens 900px and wider, the Agents screen's tree area becomes a fixed-size window
onto the tree. Collin moves the tree by dragging (from anywhere in it), by scrolling, or
with scrollbars, and zooms with buttons, pinch or Ctrl+wheel. Where he has moved survives
the page's own rebuilds. Under 900px nothing changes.

### Files

- `viewer/pages/agents.js`: view state, gestures, toolbar, keeping the view across rebuilds.
- `viewer/pages/views.css`: the layout and toolbar rules (desktop only; the `max-width: 899px` block must leave the phone list as it is).
- `viewer/test/app-views.spec.js`: browser tests (below).

No server, API or other page changes. Leave `.agents-children`, `.agents-branch` and
`.agents-box` geometry alone: the thread "Agents tree: straight connectors, shorter boxes"
may change those, and this design must not depend on box size or connector drawing.

### Layout (desktop, at least 900px wide)

- `.agents-layout` is exactly the height below the nav (`calc(100vh - var(--nav-h))`) instead of a minimum; the sidebar and the side panel each scroll on their own (`overflow: auto`).
- `.agents-main` is a column: heading, thread title, counts line, then the toolbar row, then the tree area, which takes all remaining height (`flex: 1; min-height: 0`).
- The tree area (`.agents-tree`) scrolls on both axes (`overflow: auto`). Inside it, a sizer element sized to the tree's natural size times the zoom, and inside that the tree itself scaled with `transform: scale(zoom)` and `transform-origin: 0 0`. The tree's natural size is its unscaled `offsetWidth`/`offsetHeight`. When the scaled tree is smaller than the area on an axis, it is centred on that axis (as a small tree is centred today, decision 3).
- Moving the tree is changing the tree area's `scrollLeft`/`scrollTop`. So the wheel and two-finger trackpad scroll keep working natively (decision 2), as do scrollbars.

### Toolbar

A row above the tree area, right-aligned: `−`, the zoom as a percentage (for example `60%`, a label, not a button), `+`, `Fit`, `100%`. Plain `<button type="button">`s with accessible names "Zoom out", "Zoom in", "Fit", "Full size" (the visible text can stay `−`, `+`, `Fit`, `100%`). It is hidden under 900px.

### Zoom

- Range 20%–200%, clamped (decision 7). `+` multiplies by 1.25, `−` divides by 1.25; both keep the point at the centre of the tree area still.
- Ctrl+wheel (which is also how Chromium and Firefox deliver a trackpad pinch) zooms by `exp(-deltaY * 0.01)`-style steps, clamped, keeping the point under the pointer still. The wheel listener is non-passive and calls `preventDefault()` only when Ctrl is held, so the browser's own page zoom doesn't fire, and plain scrolling is untouched.
- Two-finger touch pinch on a touch screen at least 900px wide zooms around the midpoint of the two fingers.
- "Keeps a point still" means: after changing zoom from `z0` to `z1`, set scroll so that the tree coordinate under that screen point before is under it after (`scroll = (scroll + p) * z1/z0 - p`, per axis, with `p` the point's offset inside the tree area, adjusted for any centring offset).
- **Fit**: zoom = min(1, available width / natural width, available height / natural height), clamped to 20%, then centre the tree in the available area. Available area is the tree area's client rectangle minus the part covered by the terminal panel when it is open (decision 11), with a small margin (16px).
- **100%**: zoom 1, `scrollTop` 0, `scrollLeft` set so the lead box is centred horizontally in the tree area (decision 10). This is also the view a lead's tree opens at.

### Dragging and clicking (decision 8)

- A pointer down with the primary mouse button, a pen, or one finger anywhere in the tree area (on a box or not) starts a possible drag. Record the start point and scroll.
- Once the pointer has moved more than 5 screen pixels from its start, it is a drag: capture the pointer on the tree area, add a `dragging` class (grabbing cursor, `user-select: none`), and set scroll to start scroll minus movement for every later move.
- If it became a drag, the click that follows the release must not select anything: a capture-phase `click` listener on the tree area calls `preventDefault()` and `stopPropagation()` for that one click. If it never passed 5px, nothing is intercepted and the box's own click selects it, exactly as today.
- Pointer up or cancel ends the gesture. A second touch turns a one-finger drag into a pinch.
- The tree area sets `touch-action: none` on desktop widths so the browser leaves touch drags and pinches to these handlers. The cursor over the tree area is `grab`; boxes keep `pointer` so they still look clickable.
- Asides (non-selectable boxes) are dragged through like empty space.

### Keeping the view (decisions 1, 10)

- The page keeps one view record: `{ lead, zoom, left, top }`, updated on every scroll and zoom of the tree area.
- `render()` rebuilds the tree every five seconds and on every selection. After it puts the new tree area in place, it applies the record if `lead` matches the shown lead's `thread_id`: set zoom, then `scrollLeft`/`scrollTop`. If the lead differs (or there was none), it resets to the 100% view and records the new lead.
- While a drag or pinch is in progress, `render()` is not run: the refresh marks a rebuild as pending and it runs when the gesture ends. A selection cannot happen mid-gesture.
- The terminal panel, its height, full screen and the side panel behave as today.

### Phones (decision 9)

Under 900px: the toolbar is hidden; the tree area has no fixed height, no `touch-action` override and no transform (zoom is treated as 1); pointer and wheel handlers do nothing (check `matchMedia('(max-width: 899px)')` at gesture start). The indented list scrolls and selects exactly as today. Resizing across 900px needs no special handling beyond that: the next render applies the right mode.

### Non-goals

- No change to the tree's layout, connectors or box sizes.
- No keyboard shortcuts for panning or zooming beyond the buttons themselves.
- No remembering the view across page reloads or between leads.
- No change to the graph viewer or any other page.

### Validation

New or updated browser tests in `viewer/test/app-views.spec.js` (desktop project unless said), using a lead with enough children to overflow (for example 12 workers, two of them with children of their own):

1. Opens at 100%: the lead box is horizontally centred in the tree area (within 2px) and `scrollTop` is 0. This replaces the "scroll from the left" assertion of the existing wide-tree test; keep its narrow-tree centring check.
2. A real mouse drag (`page.mouse.down/move/up`, more than 5px) starting on empty space changes `scrollLeft`/`scrollTop` by the movement.
3. A drag starting on a box moves the tree and does not select it (URL has no `agent=`, side panel says "Select an agent").
4. A still click on a box selects it, as today.
5. Ctrl+wheel over the tree changes the zoom label and the box's on-screen width; the page's own zoom (`devicePixelRatio`) is unchanged.
6. `Zoom in`/`Zoom out` change the label by 1.25× steps and stop at 200% and 20%.
7. `Fit` makes every box's bounding rectangle lie inside the tree area; `Full size` returns to the opening view.
8. After dragging and zooming, waiting 5.5s for a poll keeps the same zoom and scroll (within 1px); clicking a box keeps them too.
9. Switching to another lead in the sidebar opens it at 100%.
10. Phone project: the toolbar is not visible and the tree is still the indented list (existing phone tests keep passing).

Commands, all must pass:

```bash
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

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

- 2026-11-17: the thread "Agents tree: straight connectors, shorter boxes" may edit the same CSS file; this plan touches only the layout, tree-area and toolbar rules, not box or connector rules.
