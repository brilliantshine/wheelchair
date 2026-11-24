# Remediation 6 — mockup-polish

Verification attempt 6 (commit ee575590): the Claude verifier passed; the GPT verifier (gpt-6.2-sol) reported, verbatim:

```
GAP: S2 — On the picture page at 390×844, tapping the right side of a wide mockup opens the comment box and scrolls the pane back to the left, hiding the pin. In Chromium and Firefox, `scrollLeft` went from 594 to 0 and the pin ended up at x=888–904, outside the visible pane at x=16–374. — viewer/pages/diagram.js:145 · /tmp/wc-mockup-verify6-8kVwTI/edges.log
GAP: S3 — A mockup's `div { padding: 24px }` rule also styles the export wrapper. The downloaded PNG shifts the whole mockup 24 CSS pixels down and right and clips its right edge in both browsers. At mockup coordinate (100, 10), the preview is green and the export is white. — viewer/pages/picture-export.js:122 · /tmp/wc-mockup-verify6-8kVwTI/pixels.log
```

The lead answered: fix both (tablet-size mockups viewed on a phone are normal use for Collin).

# Task R6 — mockup-polish remediation 6 (two small fixes)

Plan slug: `mockup-polish`. Task id: `R6`. The lead's session is `wc-c06d283728e9-lead` (message it only if something below is impossible).

## Fix 1 — the PNG root box must not match mockup CSS (`viewer/pages/picture-export.js`)

In `mockupCanvas` (~line 122) the root box is `doc.createElementNS(NS, 'div')`, so a mockup rule such as `div { padding: 24px }` also styles it and shifts the whole picture. Change it to `doc.createElementNS(NS, 'wc-export-root')` and add `display:block;margin:0;padding:0;border:0;` at the start of its inline `style` string (before `box-sizing:border-box;...`). Nothing else in the file changes.

Test (in `viewer/test/app-mockup-png.spec.js`): add a fixture `divrule` next to the others:
```
'<style>html{background:#fff}body{margin:0}div{padding:24px}.b{position:absolute;left:0;top:0;width:120px;height:40px;padding:0;background:rgb(0, 128, 0)}</style><body><div class="b"></div></body>'
```
and a test "a mockup's div rule does not move the picture", written like the rem test (k = 2): pixel (100k, 10k) green `[0,128,0]`, pixel (130k, 10k) white, pixel (100k, 50k) white.

## Fix 2 — showing the comment box scrolls only vertically (`viewer/pages/diagram.js`)

In the layer's click handler (~line 145), `panel.scrollIntoView({ block: 'nearest' })` also scrolls horizontally, so on the picture page a tap on the right side of a wide mockup jumps the pane back to the left and hides the pin. Replace that line with: record `window.scrollX` and the `scrollLeft` of every ancestor element of `panel` (walk `parentElement` up to `document.body`), call `panel.scrollIntoView({ block: 'nearest', inline: 'nearest' })`, then put every recorded `scrollLeft` back and `window.scrollTo(savedX, window.scrollY)`. Keep the `if (panel.scrollIntoView)` guard. Nothing else in the file changes.

Test (in `viewer/test/app-spot-comment.spec.js`): "on the picture page, a tap on the right of a wide mockup keeps the pin in view". Use the existing picture-page helpers (`seed`, `openPicture`, ~line 216) with a mockup card whose declared width is 1000 and height 600 (see how the existing picture-page tests create their card and mockup and pass a different size). At 390x844: press Comment on a spot, scroll the picture pane (the element that scrolls on that page; find it in `viewer/pages/picture.css`, `overflow: auto`) fully right, tap the layer at 90% of the mockup's width, 20% of its height, then assert the pane's `scrollLeft` is unchanged (within 1px) and the `.spot-pin`'s bounding box lies inside the pane's bounding box horizontally. Show this test and the div-rule test fail on the current code (run them before your fixes and paste the failures).

## Ownership boundary

Only `viewer/pages/picture-export.js`, `viewer/pages/diagram.js`, `viewer/test/app-mockup-png.spec.js`, `viewer/test/app-spot-comment.spec.js`. Report: `docs/plans/mockup-polish/reports/R6.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`.

## Validation (paste the output, with exit codes, in your report)

```bash
npm --prefix viewer run test:browser -- app-mockup-png app-picture-download app-spot-comment app-mockups app-chat-stability
npm --prefix viewer run test:browser -- app-mockup-png app-spot-comment --repeat-each=3
```
Also paste the exact `git diff` of your commit (not condensed).

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

## Follow-up R6b

R6's div-rule test passed on the old code because the brief's fixture positioned its block absolutely. R6b rewrites that fixture and proves the test fails with the old root box.
