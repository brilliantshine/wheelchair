# Remediation 2 — mockup-polish

Verification attempt 2 (gpt-6.2-sol, commit 699c1a26). Gap list verbatim:

```
GAP: S1 — A kept Done card's "Start a thread about it" handler passes the card object from its initial render. After the next poll, the click reached the hub, but the debugger confirmed that `press()` received the stale object. [Handler](viewer/pages/thread.js:93) · [Reproduction log](/tmp/wc-mockup-verify-WvBg2G/done-handler.log)
GAP: S3 — Firefox drops a width-based CSS rule from the mockup content during PNG export. The preview button was green (`#267453`), and the downloaded PNG button was blue (`#4258dc`). Chromium preserved the preview colour. [Pixel comparison](/tmp/wc-mockup-verify-WvBg2G/responsive.log)
GAP: S1/S2 validation — The Firefox hand-off test starts counting before the iframe's initial load finishes. The suite got `Expected: 0, Received: 1` while the iframe identity check passed. [Assertion](viewer/test/app-spot-comment.spec.js:259) · [Controlled check](/tmp/wc-mockup-verify-WvBg2G/handoff-frame.log)
```

The lead answered: fix gap 1 and gap 3; defer gap 2 (PLAN.md Deferred D3, commit 5c6073e9).

# Task R2 — mockup-polish remediation 2 (two exact edits)

Plan slug: `mockup-polish`. Task id: `R2`. The lead's session is `wc-c06d283728e9-lead` (message it only if something below is impossible).

Make exactly these edits; invent nothing else.

1. `viewer/pages/thread.js`, in `threadLinkRow` (~line 93): change `press(card, 'start-thread', text);` to `press(live(card), 'start-thread', text);`. `live` is already defined in the same file (`const live = (c) => data.cards.find((x) => x.id === c.id) || c;`) and used the same way in every other press handler (e.g. `press(live(card), 'keep')`). `live` is a `const` defined later in the file; that is fine because the handler runs only on click, as for the other handlers.

2. `viewer/test/app-spot-comment.spec.js`, test "a hand-off starting hides the button in place without redrawing the mockup" (~line 248): before the `page.evaluate` that installs the load counter, wait until the mockup iframe's first load has finished:
   ```js
   const frame = await (await page.locator('.card-diagram iframe').elementHandle()).contentFrame();
   await frame.waitForLoadState('load');
   ```
   Do the same in `viewer/test/app-chat-stability.spec.js`, test "new cards and a lead-state change leave mockups loaded and the reader in place" (~line 38): in the existing loop over the iframes, after `waitForSelector('#proof')`, also `await` that frame's `waitForLoadState('load')` (keep the `#proof` wait).

## Ownership boundary

Only `viewer/pages/thread.js` (that one line), `viewer/test/app-spot-comment.spec.js`, `viewer/test/app-chat-stability.spec.js`. Report: `docs/plans/mockup-polish/reports/R2.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`.

## Validation (paste the output in your report)

```bash
npm --prefix viewer run test:browser -- app-spot-comment app-chat-stability app-threads
npm --prefix viewer run test:browser -- app-spot-comment app-chat-stability --repeat-each=3
```
Also show `git diff` of your commit in the report.

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
