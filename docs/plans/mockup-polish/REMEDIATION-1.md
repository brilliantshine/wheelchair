# Remediation 1 — mockup-polish

Verification attempt 1 (gpt-6.2-sol, commit b44a6aac). Gap list verbatim:

```
GAP: S1 — The scroll anchor can be a row fully covered by the sticky header. A late-arriving card pushed the visible mockup down 193 CSS px in Chromium and Firefox. — `viewer/pages/thread.js:135`
GAP: S1 — Rare path: A poll that changes only the lead name or worktree leaves the old chat byline or mockup URL in place. — Both changes were omitted from the reconciliation trigger at `viewer/pages/thread.js:1603` and reproduced in the isolated viewer.
GAP: S2 — A pending hand-off replaces the mockup iframe when it hides the comment button. — With no open draft and an unchanged import cutoff, the browser reported `sameFrame: false`. `viewer/pages/thread.js:667` includes the frozen state in every card signature.
GAP: S3 — PNG export evaluates responsive backgrounds in an 800×600 helper iframe. — A 390×300 mockup preview was green, while the downloaded PNG was red in Chromium and Firefox. `viewer/pages/picture-export.js:88`
```

Gap 2 was judged a rare path and recorded in Accepted Risks (verification-1). The lead answered fix for gaps 1, 3 and 4; nothing deferred.

## Task R1 (one task, all three gaps)

See the brief below; it was given to one worker.
# Task R1 — mockup-polish remediation 1 (three small fixes)

Plan slug: `mockup-polish`. Task id: `R1`. The lead's session is `wc-c06d283728e9-lead`; send it a `message` card if you hit a question the plan does not settle.

Read: `docs/plans/mockup-polish/PLAN.md` Spec S1, S2, S3 (skim), and `docs/plans/mockup-polish/REMEDIATION-1.md` (the verifier's gaps). Code background: `docs/plans/mockup-polish/reports/T1.md`, `T2.md`, `T3.md`.

## Fix exactly these three things

1. **Scroll anchor ignores rows under the pinned header** (`viewer/pages/thread.js`, `chatPlace()` ~135). Today an entry counts as visible if `r.bottom > 0 && r.top < innerHeight`, but the top of the viewport is covered by the sticky pinned header (and anything else fixed/sticky at the top above the chat). Record only entries whose rect reaches below the bottom edge of that covering area (`r.bottom > coveredBottom && r.top < innerHeight`), measured at capture time; find the header element(s) by looking at how the page lays out pins (`renderPinned`, thread.css sticky rules). The restore logic stays: first surviving recorded entry back to its recorded offset. Scenario that must pass: thread scrolled so a mockup card is the first entry visible below the pinned header while an earlier entry sits hidden under the header; a card whose time falls between those two arrives (inserted out of the end position); the visible mockup's top moves by at most 2px.
2. **Hand-off state only in signatures of cards that draw it** (`cardSig()` ~664). `frozen()` is in every card's signature, so a hand-off starting replaces every mockup card (and reloads its iframe). Include `frozen()` only for card kinds whose drawing in `renderCard` actually reads it (check each use: e.g. `off` computed at ~994 and wherever else `frozen()` is read inside `renderCard` and its helpers). `diagram` and `image` cards must not include it, unless their drawing reads it — if it does only for the spot button eligibility, that is handled by the in-place toggle, not the signature. Scenario: a thread with a mockup card and live lead; hand-off starts (`handoff_op` or `handed_off` set) with no open draft and no cutoff change; the mockup iframe is the same element and fires no second `load`, and the spot button becomes `visibility: hidden`.
3. **PNG background read at the mockup's size** (`viewer/pages/picture-export.js` ~82-107, the hidden helper iframe). Size that helper iframe to exactly the mockup's width x height so media queries evaluate as in the mockup's own frame. Scenario: a 390x300 mockup whose `body` background is green under `@media (max-width: 500px)` and red otherwise exports green.

## Ownership boundary

You own: `viewer/pages/thread.js`, `viewer/pages/thread.css` (only if needed), `viewer/pages/picture-export.js`, and tests in `viewer/test/app-chat-stability.spec.js`, `viewer/test/app-spot-comment.spec.js`, `viewer/test/app-mockup-png.spec.js` (add a test for each scenario above). Report: `docs/plans/mockup-polish/reports/R1.md`. Touch nothing else. Never delete files with `rm` (or any other way).

Each new test must fail when its behaviour breaks: run it against the code before your fix (or break the fix once), watch it fail, restore. Paste that evidence. Never start a viewer server by hand; tests start isolated servers (`viewer/test/helpers/server.js`). Never run `./install.sh`.

## Validation (paste output)

```bash
npm --prefix viewer run test:browser -- app-chat-stability app-spot-comment app-mockup-png app-mockups app-threads app-handoff app-picture
node --test viewer/test/*.test.js
```
(`app-harnesses.test.js` "switching a harness off…" is a known load-timing flake that also fails on main.) The sub-lead runs the full browser suite after merge; you need not.

## Deliverable

Commits on your branch (`wc.js git commit --paths a,b,c`), and `docs/plans/mockup-polish/reports/R1.md` with what changed (file:line), pasted output, and:

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
