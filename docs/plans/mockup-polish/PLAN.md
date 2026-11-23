---
slug: mockup-polish
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-23
---

# Mockups that behave well in a thread

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

**Map:** `MAP.md` and `docs/maps/mockup-viewer-flow.md`.

## Open Questions

### Q1: How is a mockup turned into a PNG?
- **Context:** Mockups render in an empty-sandbox iframe under a no-scripts CSP (`viewer/pages/picture.js:75`, `viewer/app/routes.js:21-22`), so the page cannot read the mockup's document the way graph export does. Graph and form PNGs are drawn in the browser (`viewer/pages/picture-export.js`).
- **Options:** (a) in the browser: fetch the mockup HTML and draw it to a canvas through an SVG image; no new install, but some phone browsers may refuse to save a canvas drawn this way, and fonts the mockup names but doesn't embed may differ. (b) on the machine: the server takes a real browser screenshot; exact, but needs a headless browser installed on every machine that serves threads.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part. | Collin picked it on the mode card. | user |
| 2 | No designer mockups for this plan's own screens. | The visible parts are a comment pin and box, a PNG button and a scrolling image page, each following existing patterns in the thread and picture pages. | defaulted |
| 3 | Fix the flashing by updating the chat in place: keep existing card elements (above all mockup iframes) and only add, replace or remove the cards that changed; keep the reader's scroll position when not at the bottom. | The map traces the flash to `renderChat` clearing and rebuilding every card on each change (`viewer/pages/thread.js:603-605,622-637`), which reloads every iframe and loses the scroll anchor. | defaulted |
| 4 | A spot comment is sent as Collin's own message to the lead, naming the mockup file, the card, and the spot in the mockup's own pixels; the lead passes it to the designer verbatim, as the Mockups rules already require. | Press and composer routes already target the lead (`viewer/app/threads.js:411-426`, `viewer/app/routes.js:682-690`); routing straight to a designer would need a new delivery contract, and the lead must see feedback anyway (it may be a design change after agreement). | defaulted |
| 5 | The spot is captured by a transparent layer over the mockup, not by reading the mockup's document. | The mockup iframe is sandboxed with no same-origin access; loosening that is not needed to know where Collin tapped. The designer can render its own file to see what sits there. | defaulted |
| 6 | Built's Open full size opens the picture page with the screenshot at its natural pixel size in a scrolling area. | The picture page already does this for mockups (`viewer/pages/picture.js:61-79`); the raw file link leaves scaling to the phone. | defaulted |

## Spec

(Grown as decisions land.)

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
