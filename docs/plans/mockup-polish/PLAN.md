---
slug: mockup-polish
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-23
---

# Mockups that behave well in a thread

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

**Map:** `MAP.md` and `docs/maps/mockup-viewer-flow.md`.

## Open Questions

(none)

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
| 7 | A mockup PNG is drawn in the phone's browser (fetch the mockup HTML, draw it to a canvas), not on the machine. | Collin picked it: no new install, same as diagram PNGs. If a browser refuses, the HTML download stays and the machine route is Deferred. | user |
| 8 | A spot comment's message names the mockup by file path, not by card (supersedes that part of Decision 4); the lead handles it by the existing Mockups rules for the current stage. | Round 1: a designer may not be running, and comments on a build's Mockup half are usually about the build; the versioned file path already identifies the mockup. | review-round-1 |

## Spec

Four changes in the viewer, plus two short protocol lines. Background on the code is in
`MAP.md` and `docs/maps/mockup-viewer-flow.md`.

### S1. The chat updates in place

Today `render()` in `viewer/pages/thread.js` (~1467-1476) calls `renderChat()` whenever a
signature covering every message, card, pin and lead state changes, and `renderChat()`
(~603) empties the chat and rebuilds every node. That reloads every mockup iframe and loses
the reader's place.

- `renderChat()` reconciles instead of rebuilding. Each chat entry (message bubble, card,
  the lead-name line, pending bubble, queued and notice rows) gets a stable key and a
  signature of what it draws. An entry whose key and signature are unchanged keeps its
  existing DOM node. **An unchanged entry that contains an iframe is never removed or
  moved** (detaching an iframe reloads it); other unchanged entries may be moved when the
  order changes (for example queued messages reordered by Send now). Cards are in time
  order, so iframe entries never need to move. New entries are inserted at their place;
  changed entries are replaced in place; gone entries are removed. A card's signature covers its own fields and every outside state
  its drawing reads (pinned, archived, slug, worktree, card errors, open/folded state).
- Everything the current rebuild does after building (placeIds, aside anchors, pending
  bubble matching, the import cutoff) still works; a full rebuild stays allowed only where
  the cutoff moves (import, hand-off).
- Scroll: near the bottom (existing 80px test) the page still follows new entries. Away
  from the bottom, the top visible chat entry stays at the same screen position after an
  update. Record it and its position at the start of `render()`, before the banners and
  pins above the chat update, and correct `scrollY` once the chat is updated. If that
  entry is gone, use the first entry after it that survived.
- A mockup reserves its final height when created: `mockup()` in `viewer/pages/diagram.js`
  sets the frame box's height from `aspect-ratio: width / height` (CSS) so the box never
  starts at zero and grows later. The scale transform still follows the box width.

### S2. Comment on a spot in a mockup

Where: every mockup shown in a thread (a `diagram` card with `format: mockup`, and the
Mockup half of an image card) and the mockup on the picture page.

- A **Comment on a spot** button sits with the mockup's Open full size link. It is shown
  only while the thread composer could send (live lead, not archived, not frozen: the same
  `canSend` test as the Send button), and hidden otherwise.
- Pressing it puts a transparent layer over the mockup (the iframe stays sandboxed and is
  never read). The next tap on the layer drops a visible pin there and opens a small text
  box with Send and Cancel under the mockup. Tapping elsewhere on the mockup moves the
  pin. Cancel, or sending, removes the layer, pin and box.
- The tap is converted to the mockup's own pixels: x and y divided by the current scale,
  rounded, clamped to 0..width-1 and 0..height-1.
- Send posts Collin's own message the way the composer's send handler does
  (`POST <thread>/messages` with `{text}`, then the pending-bubble push; `thread.js`
  ~1577-1579; share that code rather than copy it), so it appears as Collin's bubble and
  queues to the lead like any message. `sendNow` is not involved. On the picture page it
  is the same `POST <thread>/messages`.
- Send keeps the pin, coordinates and text until the hub accepts the message. On a
  failure, show the error beside the box ("Comment not sent: <reason>") and keep
  everything so Send can be pressed again. Only acceptance or Cancel clears them.
- The picture page has no live state: it checks whether the thread can take a message
  when it loads and again (re-reading `<thread>/chat`) when Send is pressed. If it can't,
  it shows "The lead isn't running, so the comment can't be sent now" and keeps the
  draft. Text:
  `Comment on mockup "<title>" (docs/plans/<plan>/graphs/<graph>.html, <width>x<height>) at x=<x>, y=<y>: <comment>`.
  An empty comment cannot be sent. On the picture page a sent comment shows "Sent to the
  thread" with a link back.
- Protocol: `protocol/app/lead.md` Mockups gets one sentence: a spot comment is feedback
  like any other, handled by the Mockups rules for the stage the thread is in; whatever
  it is passed on to keeps its location line verbatim. `protocol/app/designer.md` gets one
  sentence: a spot comment's x and y are in the mockup's own pixels; render the file to
  see what sits there before changing it.
- The file path (which carries the mockup's version) identifies the mockup; the message
  does not name the card.

### S3. Download a mockup as a PNG

On the picture page for a mockup (`viewer/pages/picture.js`, the mockup branch of
`showCard`), Download makes a PNG using the existing `offerPng` / `WCPictureExport.save`
path, and a second link **Download HTML** keeps today's HTML download.

- The PNG is drawn in the browser: fetch the mockup HTML from its source URL, parse it,
  serialize it as XHTML inside an SVG `foreignObject` of exactly width x height, load
  that SVG as an image and draw it to a canvas sized with the existing `scaleFor`. Add the
  function to `viewer/pages/picture-export.js` beside `graphCanvas` and `formCanvas`.
- No script from the mockup runs at any point (scripts are stripped before drawing).
- If the browser refuses (load error or a tainted canvas), the note under Download says
  "This browser could not make a PNG of this mockup. Download HTML instead." The HTML link
  stays.

### S4. Screenshots open at true size

- The picture page gains a screenshot view: `picture?thread=<id>&card=<id>&view=image`.
  It shows the image card's file at its natural pixel size (no max-width) inside the
  picture page's scrolling area, with a Download link to the original file. A file removed
  on archive shows the existing "Image removed when the thread was archived" text.
- In the thread, the Built half's Open full size and the tap on any image card's picture
  (with or without a mockup) open that view instead of the raw file URL.

### Not in this plan

Saving comments as pins that stay on the mockup; comments on screenshots or ordinary
diagrams; a machine-side PNG.

### Validation

```bash
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

New browser tests (Chromium and Firefox, phone viewport 390x844 where it matters):

1. Chat stability: a thread with two mockup cards, scrolled to the middle; a new card and
   a lead-state change arrive. Each mockup iframe is the same element and fired no second
   `load`; the top visible entry moved by at most 2px. Scrolled to the bottom, the new card
   comes into view.
2. A mockup box has its final height before the iframe loads.
3. Spot comment: tap at a known point on a scaled mockup; the sent message text has the
   exact format above with the expected rounded coordinates; the button is hidden in an
   archived thread.
4. PNG: Download on a mockup's picture page saves a PNG whose pixel size is width x height
   times the export scale, and in which a known foreground block and the background of a fixture mockup
   have their expected colours; Download HTML still gives HTML.
5. True size: at 390px viewport, the screenshot view of a 1200px-wide image renders it
   1200 CSS px wide and the page scrolls sideways; Built's Open full size links to it.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Earlier spot comments stay as pins on the mockup | The comment's text already says where; pins are a convenience | planning | Needs storing comments per mockup and drawing them on the overlay layer from S2 |
| D2 | Make the mockup PNG on the machine when the phone's browser refuses | Only needed if Collin's browser refuses; HTML download still works | planning | Headless browser screenshot served from the machine; see Decision 7 |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| The mockup PNG is tested only in Chromium and Firefox; on an iPhone (WebKit) it may fail | A failure shows the "Download HTML instead" note and the HTML link stays; D2 covers a machine-side PNG | review-round-1 |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-23

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Lead sentence assumes a live designer; Mockup half comments arrive during build | downgraded (minor) | Real, but the existing Mockups rules already route feedback by stage, so a careful lead reconciles it. Rewrote the sentence to defer to those rules (S2, Decision 8) |
| intent | minor | Decision 4 says the message names the card; the format does not | upheld | Decision 8: the versioned file path identifies it; S2 says so |
| intent | minor | PNG untested in WebKit (iPhone) | accepted-risk | Fallback note and HTML link; D2 |
| mechanics | blocking | S2 names `sendNow`, which re-sends a queued message, not a new one | upheld | S2 now names the composer's `POST /messages` + pending bubble, shared |
| mechanics | blocking | Queued rows reorder (Send now), contradicting "never moved" | downgraded (major) | Real contradiction, but only a reorder case; S1 now pins only iframe entries in place |
| mechanics | major | Spot-comment forwarding assumes a live designer during build | downgraded (minor) | Same as intent finding 1; fixed by Decision 8 |
| mechanics | major | A failed send discards the draft and pin | upheld | S2: keep everything until accepted; show the error |
| mechanics | minor | Picture page checks send eligibility only at load | upheld | S2: re-check on Send, keep the draft |
| mechanics | minor | Scroll anchor measured after banners update; no fallback if it disappears | upheld | S1: record at start of render; fall back to next surviving entry |
| mechanics | minor | PNG test passes with a blank image | upheld | Validation 4 checks known pixels |

### Round 2 — 2026-11-23

**Lanes:** pending.

**Changed since Round 1:**
- S1: only unchanged entries containing an iframe are pinned in place; others may move. Scroll anchor recorded at the start of `render()`, with a fallback.
- S2: protocol sentence defers to the Mockups rules by stage (Decision 8); sending uses the composer's `POST /messages` path; draft kept on failure; picture page re-checks before sending; message names the file, not the card.
- Validation 4 checks known pixels. Accepted Risk: PNG untested in WebKit.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
