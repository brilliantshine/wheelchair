# Remediation 8 — mockup-polish

Verification attempt 8 (commit 42537b7f): the Claude verifier passed; the GPT verifier (gpt-6.2-sol) reported, verbatim:

```
GAP: S2 — Tapping near the top of a 390×844 mockup on the picture page scrolls the pane 313 px to reveal the comment box. The new pin ends up above the viewport in Chromium and Firefox. — viewer/pages/diagram.js:151 · /tmp/wc-mockup-verify8-NcVJEe/followup.log
GAP: S3 — The PNG exporter overrides `display: grid` on the mockup's `html` element ... (judged rare; Accepted Risks verification-8)
```

The first gap is the attempt-6/7 gap (pin and box both on screen after a tap), which survived two fixes (R6, R7). It went to the lead as a plan defect. Collin picked option A (Decision 11): the box sticks to the bottom of the visible area, the bottom of the screen in the thread and the bottom of the pane on the full-size page, overlaying the mockup while open. Nothing scrolls. S2 is updated.

# Task R8 — mockup-polish remediation 8: spot comment box sticks to the bottom of the visible area (Decision 11)

Plan slug: `mockup-polish`. Task id: `R8`. The lead's session is `wc-c06d283728e9-lead`; message it if you hit a question this brief does not settle.

Read `docs/plans/mockup-polish/PLAN.md` Spec S2 (updated by Decision 11) and `docs/plans/mockup-polish/REMEDIATION-8.md`.

## What Collin decided (Decision 11)

After a tap drops the pin, the comment box (`.spot-box`: text box, Send, Cancel, error line) sticks to the bottom of the visible area, overlaying the mockup while open:
- **In the thread:** the bottom of the screen, just above the thread's sticky composer (`#composer` in `viewer/pages/thread.css` ~211 is `position: sticky; bottom: 0`, and there is a `--composer-h` variable). The box must not hide behind the composer.
- **On the full-size page:** the bottom of the scrolling pane `.picture-body`. The box is already `position: sticky; left: 0; width: 100cqw` inside `.picture-mockup-content` (`viewer/pages/picture.css` ~20-22, from R7). Keep that sideways behaviour.
- **Nothing scrolls** when the pin is dropped or moved. Remove the `scrollIntoView` block in the layer's click handler (`viewer/pages/diagram.js` ~145-154, including R6's scroll save/restore, which is no longer needed). The pin stays exactly where it was on screen.

Today the box sits in normal flow under the mockup (`after.after(panel)` in `diagram.js` `spot()`), and the code scrolls to it. A sticky `bottom` (with the composer offset in the thread) on that same box is the likely shape: sticky keeps its space under the mockup and pulls it up to the visible bottom while the mockup is on screen. You choose the exact layout. Requirements:
- The box draws above the transparent tap layer and the pin (`.spot-layer` has `z-index: 2` in thread.css). Taps on the box never reach the layer.
- The tap layer still covers exactly the mockup, so coordinates are unchanged. All existing coordinate tests must pass.
- When the mockup is short and fully on screen, the box may simply sit under it, as now; that already counts as "the bottom of the visible area".
- Drafts, pending/disabled state, the error line, Cancel, and the redraw-on-node-replacement behaviour are unchanged.

## Tests (in `viewer/test/app-spot-comment.spec.js`; 390x844)

1. **Thread, tall mockup:** a mockup card of a 390x844 mockup (scaled to the card width, so taller than the screen). Scroll so the mockup's top is near the top of the screen, press Comment on a spot, and tap at 50% width, 10% height. Assert: `window.scrollY` is unchanged (±1px); the pin's bounding box is inside the viewport; `.spot-text`, Send and Cancel are inside the viewport and above the composer's top edge; and clicking into `.spot-text` focuses it (it is not covered).
2. **Picture page, tall mockup:** the same 390x844 mockup on the picture page. Tap at 50% width, 10% height. Assert: the pane's `scrollTop` and `scrollLeft` are unchanged (±1px); the pin is inside the pane's bounding box; `.spot-text`, Send and Cancel are inside the pane's bounding box.
3. Keep the existing wide-mockup test (`~221`) passing as it is; it checks the sideways case.
Show tests 1 and 2 fail on the current code: run them before your change and paste the failures.

## Ownership boundary

Only `viewer/pages/diagram.js`, `viewer/pages/thread.css`, `viewer/pages/picture.css`, `viewer/pages/picture.js`, `viewer/pages/thread.js` (only if needed for the composer offset), `viewer/test/app-spot-comment.spec.js`. Report: `docs/plans/mockup-polish/reports/R8.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`. Take two 390x844 screenshots after a tap on a tall mockup, one in the thread and one on the picture page. Save them under your scratch directory, not in the repo, and name their absolute paths in the report.

## Validation (paste output with exit codes)

```bash
npm --prefix viewer run test:browser -- app-spot-comment app-mockups app-chat-stability app-picture app-mockup-png app-threads
npm --prefix viewer run test:browser -- app-spot-comment --repeat-each=3
```
Paste the exact `git diff` of your commit.

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
