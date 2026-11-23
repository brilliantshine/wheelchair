# Map: mockup polish

Checked against `25f34a4572c4beb9032f16f818b6502cc59f62bd` (origin/main). Detailed flow and test pointers: [mockup viewer flow](../../maps/mockup-viewer-flow.md).

```text
new card -> chat signature changes -> entire chat rebuilt -> mockup iframes reload and resize -> scroll may move
spot feedback -> card press or new route -> session queue -> designer turn
full-size mockup -> sandboxed HTML -> PNG needs compatible rasterization
Built link -> raw image tab -> browser controls image scaling
```

The strongest source-backed cause of the flash and reload is full chat replacement on every changed card, recreating all iframes; only near-bottom scroll is explicitly restored and ResizeObserver sets mockup height later (`viewer/pages/thread.js:603-605,630,1467-1476,1484`; `viewer/pages/diagram.js:72-86`). This remains a hypothesis for the complete reported behavior until reproduced.

A card press currently targets the lead and normally marks the card answered; direct designer delivery must account for the session queue and the special reopening of a finished designer for its starter's session message (`viewer/app/threads.js:411-426,439`; `viewer/app/sessions.js:498-520,547-548`). The mockup's empty iframe sandbox and response CSP constrain both tap capture and DOM-based PNG export (`viewer/pages/diagram.js:76`; `viewer/app/routes.js:21-22`). Full-size mockups currently download HTML, while Built opens a raw file URL; the picture page does not expose Built as a case (`viewer/pages/picture.js:61-79`; `viewer/pages/thread.js:1217-1227`).

What I did not look at: live reproduction, browser-specific anchoring, candidate PNG libraries, all transcript and validation paths, and remote deployment. No application tests were run for this documentation-only map.
