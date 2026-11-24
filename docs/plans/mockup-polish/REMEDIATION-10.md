# Remediation 10 — mockup-polish

Verification attempt 10 (commit 130e6a93). Gaps, verbatim:

```
GAP: S1 — When a poll replaces the only visible chat entry, the page anchors to a row hidden behind the composer and jumps 642px. S1 says to leave `scrollY` alone when no visible entry survives. Reproduced in Chromium and Firefox at 390×844 — viewer/pages/thread.js:141–155, /tmp/wc-mockup-attempt10-kbkvtj/hidden-anchor-native.log
GAP: S2 — A failed Send can cover the pin with the sticky comment box ... (both verifiers; judged rare, Accepted Risks verification-10)
```

The lead answered: fix the S1 gap.

# Task R10 — mockup-polish remediation 10: the scroll anchor ignores rows behind the composer

Plan slug: `mockup-polish`. Task id: `R10`. The lead's session is `wc-c06d283728e9-lead` (message it only if something below is impossible).

## The change (exact), `viewer/pages/thread.js` `chatPlace()` (~lines 135-147)

Today a chat entry counts as on screen if `r.bottom > covered && r.top < window.innerHeight`. But the sticky composer (`#composer`) covers the bottom of the window. When a poll replaces the only entry truly on screen, the anchor falls back to a row hidden behind the composer and the page jumps. Compute the bottom edge once, next to `covered`:

```js
const composer = $('composer');
const cb = composer && !composer.hidden ? composer.getBoundingClientRect() : null;
const visibleBottom = cb && cb.height > 0 ? Math.min(window.innerHeight, cb.top) : window.innerHeight;
```

Then change the condition to `r.bottom > covered && r.top < visibleBottom`. Update the comment above `covered` to say the composer covers the bottom. Nothing else in the file changes.

## The test (add to `viewer/test/app-chat-stability.spec.js`, next to "an entry hidden under the sticky header is not the scroll anchor" ~line 116; copy its setup)

"an entry hidden behind the composer is not the scroll anchor": at 390x844, build a thread whose chat is scrolled away from the bottom so that exactly one entry is visible between the top bars and the composer (e.g. a tall mockup card, as the header test does), while the next entry below it starts behind the composer (its top is below the composer's top edge but above the window bottom). Assert that setup in the test. Then make a poll replace that one visible entry by changing its card so its signature changes (as the header test or the other tests in that file do). Assert `window.scrollY` is unchanged (±2px). Show it fails on the current code: run it before your thread.js change and paste the failure.

## Ownership boundary

Only `viewer/pages/thread.js` (`chatPlace`) and `viewer/test/app-chat-stability.spec.js`. Report: `docs/plans/mockup-polish/reports/R10.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`.

## Validation (paste output with exit codes)

```bash
npm --prefix viewer run test:browser -- app-chat-stability app-threads app-spot-comment app-handoff app-try
npm --prefix viewer run test:browser -- app-chat-stability --repeat-each=3
```
Paste the exact `git diff` of your commit.

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

## Attempt 2

Attempt 1 stopped: its test queried a nonexistent `#dead-lead`. Attempt 2's brief writes the test out: the visible mockup card fills the band between the top bars and the composer, and the next row starts behind the composer. A poll then swaps that card for a shorter one with a new id, and scrollY must not move. Effort is raised one step (xhigh).
