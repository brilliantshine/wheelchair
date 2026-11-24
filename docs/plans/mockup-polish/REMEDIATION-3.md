# Remediation 3 — mockup-polish

Verification attempt 3 (gpt-6.2-sol, commit 192b501e). Gap list verbatim:

```
GAP: S2 — A spot comment stays locked after the hub accepts it and the lead receives it. With only the follow-up chat refresh held, the pin and disabled draft remained for seven seconds and the user bubble was absent. Releasing the refresh cleared the draft. — `viewer/pages/thread.js:173–177`, [delivery log](/tmp/wc-mockup-verify3-z7c4YF/delivery-probe.log)
GAP: S3 — Firefox exports a mockup centered with `min-height: 100vh` with its foreground shifted to the bottom and half clipped. The fixture uses no media queries. — `viewer/pages/picture-export.js:135–143`
GAP: S3 — The PNG loses `background-blend-mode` when moving the body background to the export root. In both browsers, the same pixel was RGB `(73, 46, 71)` in the preview and `(208, 74, 74)` in the download. — `viewer/pages/picture-export.js:83–95`
```

Gap 3 was judged a rare path (Accepted Risks, verification-3). The lead answered: fix gap 1; defer gap 2 (Deferred D4, commit c84e64e7).

# Task R3 — mockup-polish remediation 3 (spot draft clears on acceptance)

Plan slug: `mockup-polish`. Task id: `R3`. The lead's session is `wc-c06d283728e9-lead` (message it only if something below is impossible).

## The change (exact)

`viewer/pages/thread.js`, in `spotButton` (~line 170-177), the `send` function currently ends:
```js
        await sendAsUser(text);
        sigs.chat = null; await poll(); render();
```
Change those two lines to:
```js
        await sendAsUser(text);
        sigs.chat = null; render(); // the pending bubble shows now; the draft clears when this returns
        poll();                     // refresh in the background; poll() handles its own errors
```
so `send` resolves as soon as the hub accepts the POST. `WCDiagram.spot` (diagram.js ~151-157) already clears the draft when `opts.send` resolves; do not change diagram.js. Do not change the composer's handler.

## The test (add to `viewer/test/app-spot-comment.spec.js`)

"a spot comment clears as soon as the hub accepts it, even while the chat refresh is slow": seed and open a thread with a mockup card as the existing tests in that file do; open the spot comment, tap, type a comment. Then install `page.route` on the thread's `**/chat` GET so it is held (await a promise you resolve later, then `route.continue()`); let the `POST .../messages` through. Press Send. While the chat refresh is still held, assert: the pin and box are gone (no `.spot-pin` / `.spot-box` or whatever selectors the existing tests use for them), and a pending bubble (`.bubble.human.pending`) with the comment text is visible. Then release the held route. Copy selectors and helpers from the existing tests in the same file. Show the test fails on the old code: run it before making the thread.js change and paste the failure.

## Ownership boundary

Only `viewer/pages/thread.js` (those lines) and `viewer/test/app-spot-comment.spec.js`. Report: `docs/plans/mockup-polish/reports/R3.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`.

## Validation (paste the output in your report)

```bash
npm --prefix viewer run test:browser -- app-spot-comment app-chat-stability app-send-now
npm --prefix viewer run test:browser -- app-spot-comment --repeat-each=3
```
Also paste `git diff` of your commit.

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
