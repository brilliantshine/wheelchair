# Remediation 9 — mockup-polish

Verification attempt 9 (commit 60551a82). Both verifiers reported, verbatim (GPT, then Claude, shortened):

```
GAP: S2, Decision 11 — A tap just above the prompt places the pin behind the expanded comment box. This reproduced in the thread and on the picture page in Chromium and Firefox at 390×844. Scroll positions stayed unchanged and the textarea covered the pin's center. (/tmp/wc-mockup-verify9-soC8vw/phone.log)
GAP: S2, Decision 11 — On a short mockup, the comment box stays beneath the mockup, about 112 px above the thread composer and 255 px above the picture pane bottom. (judged by the sub-lead, confirmed by the lead: meets Decision 11, not a gap)
GAP: S2 (Decision 11: "the pin stays in view") — In the thread, when the mockup sits at the bottom of the chat (the newest card ...), the open comment box covers the pin and most of the mockup ... the hint box is about 84px, the full box 143px. So a pin dropped in a spot that was visible ends up under the text box.
```

The lead answered: fix as proposed. The box is full size from the moment Comment on a spot is pressed, and there is room (a spacer if needed) to scroll the whole mockup above the box. Tests use elementFromPoint and scrolling.

# Task R9 — mockup-polish remediation 9: the comment box never covers the pin

Plan slug: `mockup-polish`. Task id: `R9`. The lead's session is `wc-c06d283728e9-lead`; message it if you hit a question this brief does not settle.

Read `docs/plans/mockup-polish/PLAN.md` Spec S2 (with Decision 11) and `docs/plans/mockup-polish/REMEDIATION-9.md`.

## The problem

Decision 11: after a tap, the comment box (`.spot-box`) sticks to the bottom of the visible area, overlaying the mockup, and nothing scrolls. The pin must stay in view. Today two things break that:
1. Before the first tap the box shows only a hint ("Tap the spot on the mockup.") and Cancel, about 84px tall. After the tap it shows the text box and Send, about 143px. So a pin dropped just above the hint ends up under the grown box.
2. On the newest mockup card at the end of the chat (the usual flow) with a short mockup (390x200), the open box overlays most of the mockup. Collin must be able to scroll any part of the mockup up above the box.

## Changes

1. **Full-size box from the start** (`viewer/pages/diagram.js`, `spot()` → `paint()`): while a draft is active, the text box and Send are always shown. The hint shows only until a pin is placed. Before a pin is placed, the text box and Send are disabled. Concretely, in `paint()`:
   - replace `hint.hidden = placed; text.hidden = !placed; send.hidden = !placed;` with `hint.hidden = placed; text.hidden = false; send.hidden = false;`
   - make the disabled line `text.disabled = d.pending || !placed; send.disabled = d.pending || !placed || !d.text.trim(); cancel.disabled = d.pending;`, and drop the separate `if (!d.pending && !d.text.trim()) send.disabled = true;` line
   - in the `text` input listener, keep Send disabled when no pin is placed.

   The hint line can then make the box taller than after the tap, which is fine: the box only shrinks after the tap. If you prefer, the hint may sit inside the same space, e.g. as the text box's placeholder until a pin exists. Either way, the box must not grow after the tap. Name your choice in the report.
2. **Room to scroll the whole mockup above the box:** while a draft is open, Collin must be able to scroll (by hand; nothing scrolls by itself) until the mockup's bottom edge is above the box's top edge. That must hold in the thread for the newest card at the end of the chat, and on the full-size page. First check whether the layout already allows it: the sticky box keeps its own space under the mockup. If it doesn't, add a spacer under the mockup, as tall as the box, only while the draft is open. Name in the report which was needed and why.

Keep intact: the tap layer covers exactly the mockup and coordinates are unchanged; taps on the box never reach the layer; drafts, pending/disabled state, error line, Cancel and redraw-on-node-replacement work as now; the thread's sticky offset above the composer and the picture page's sticky left/bottom (R7, R8) stay.

## Tests (in `viewer/test/app-spot-comment.spec.js`; 390x844, Chromium and Firefox)

1. **Newest short mockup in the thread:** a thread whose last card is a 390x200 mockup, scrolled to the bottom. Press Comment on a spot and record the box's bounding box. Tap a point of the mockup that is visible above that box (e.g. 4px above the box's top edge). Assert: the box's top edge did not move up after the tap (±1px); `document.elementFromPoint` at the pin's centre is the pin or the tap layer, not part of the box; `window.scrollY` is unchanged.
2. **Low tap on a tall mockup (thread and picture page):** a 390x844 mockup, press Comment, tap 4px above the box's top edge. Assert the same: the box didn't grow upward, the pin's centre isn't covered, and nothing scrolled.
3. **Scroll the whole mockup clear (thread, newest short mockup):** with the draft open, scroll the page to its end and assert the mockup's bottom edge is at or above the box's top edge.
4. Existing tall-mockup, wide-mockup and coordinate tests still pass. Update any existing test that asserted the text box was hidden before the tap, and name it.

Show tests 1-3 fail on the current code: run them before your change and paste the failures. If test 3 already passes on the current code, say so: that means no spacer is needed.

## Ownership boundary

Only `viewer/pages/diagram.js`, `viewer/pages/thread.css`, `viewer/pages/picture.css`, `viewer/test/app-spot-comment.spec.js`. Report: `docs/plans/mockup-polish/reports/R9.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`. Take two 390x844 screenshots after a tap: the newest short mockup in the thread, and a low tap on the picture page. Save them under your scratch directory and name their absolute paths in the report.

## Validation (paste output with exit codes)

```bash
npm --prefix viewer run test:browser -- app-spot-comment app-mockups app-chat-stability app-picture app-mockup-png app-threads
npm --prefix viewer run test:browser -- app-spot-comment --repeat-each=3
```
Paste the exact `git diff` of your commit.

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
