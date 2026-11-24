# Remediation 7 — mockup-polish

Verification attempt 7 (commit b3e1f8f4). Both verifiers reported, verbatim (GPT, then Claude, shortened):

```
GAP: S2 — On a 390×844 screen, tapping the right side of a 1000px-wide mockup leaves the pin visible and the entire comment box offscreen to the left. Panning left reveals the box and hides the pin. Reproduced in Chromium and Firefox. — viewer/pages/diagram.js:151
GAP: S2 — On the picture page at 390×844, a tap on the right side of a wide mockup now hides the comment box ... `.spot-text` is at x=−628, width 358 (entirely off screen) ... One possible fix: keep the box in the visible part of the pane, for example `position: sticky; left: 0` on the picture page's `.spot-box`.
GAP: S3 — A positioned gradient on a short body changes size and position in the PNG ... (judged rare; Accepted Risks verification-7)
```

The lead answered: fix the wide-mockup box. This is the second fix attempt on the wide-mockup gap (R6 was the first); if it fails again it goes to the lead as a plan defect.

# Task R7 — mockup-polish remediation 7: keep the comment box in view on a wide mockup

Plan slug: `mockup-polish`. Task id: `R7`. The lead's session is `wc-c06d283728e9-lead`; message it if you hit a question this brief does not settle.

Read `docs/plans/mockup-polish/PLAN.md` Spec S2 (Comment on a spot) and `docs/plans/mockup-polish/REMEDIATION-7.md` (the gap).

## The problem

On the picture page (`viewer/pages/picture.js` `offerSpotComment`, which calls `WCDiagram.spot(wrap, wrap, …)` ~line 83), the comment box (`.spot-box`, built in `viewer/pages/diagram.js` `spot()` and inserted with `after.after(panel)`) is a block sibling of `.picture-mockup-wrap` inside the scrolling pane `.picture-body` (`viewer/pages/picture.css`, `overflow: auto`, `container-type: inline-size`). On a mockup wider than the screen (1000px wide on a 390x844 phone), the pane is scrolled right to the spot Collin taps. Remediation 6 (`diagram.js` ~145-154) keeps that sideways scroll so the pin stays in view, but the box sits at the pane's left edge (x≈-628) and is off screen. The Spec says the tap drops a visible pin and opens a small text box with Send and Cancel under the mockup: both must be on screen.

## Objective

On the picture page, after a tap anywhere on a wide mockup, at whatever sideways scroll: the pin stays where it is on screen (no sideways scroll change, as now), and the whole comment box (text box, Send, Cancel, error line) is horizontally inside the visible pane, under the mockup. It must stay inside the visible pane when Collin scrolls the pane sideways afterwards. Both lead and verifiers suggested `position: sticky; left: 0` for the box. Note why plain sticky fails today: a block child of the pane is only as wide as the visible pane, and sticky can't move it past its containing block. Choose a layout that works, for example putting the box in a container as wide as the scrolled content, or sizing the box with `100cqw` (the pane is an inline-size container). Keep these intact:
- The transparent tap layer still covers exactly the mockup, so tap coordinates are unchanged. The existing coordinate tests must still pass.
- Taps on the box never reach the layer.
- The thread's inline mockups (`viewer/pages/thread.js` `spotButton`) look and behave as now. Those mockups are never wider than their card, so limit the change to the picture page (a picture-page CSS rule or a `spot()` option that only picture.js passes).

## Test (extend `viewer/test/app-spot-comment.spec.js`, the existing test "on the picture page, a tap on the right of a wide mockup keeps the pin in view", ~line 221)

After the tap, also assert that the bounding boxes of `.spot-text`, the Send button and the Cancel button lie horizontally inside the pane's bounding box (±1px) and are visible. Then scroll the pane 200px further left and assert the box is still inside the pane. Show the extended test fails on the current code: run it before your change and paste the failure.

## Ownership boundary

Only `viewer/pages/picture.css`, `viewer/pages/picture.js`, `viewer/pages/diagram.js`, `viewer/test/app-spot-comment.spec.js`. Report: `docs/plans/mockup-polish/reports/R7.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`. Take a 390x844 screenshot of the picture page after the tap (save it under your scratch directory, not in the repo) and name its absolute path in the report.

## Validation (paste output with exit codes)

```bash
npm --prefix viewer run test:browser -- app-spot-comment app-mockups app-chat-stability app-picture app-mockup-png
npm --prefix viewer run test:browser -- app-spot-comment --repeat-each=3
```
Paste the exact `git diff` of your commit.

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
