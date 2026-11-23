# Remediation 1 — sidebar-files-followup

Verification attempt 1 at `acfde7a001e5b312754fc288746358fa851c3841`. The Claude verifier (claude-opus-5-5) passed. The GPT verifier (gpt-6.2-sol) failed. The gap list from the GPT verifier, verbatim:

```text
GAP: S1 — A form PNG can differ from the form on screen. The page displays the first response and fetches the form again on Download. An isolated browser run displayed "Version on screen" while the PNG drew "Version saved after page opened." — viewer/pages/picture.js:52–70, viewer/pages/diagram.js:57–66
GAP: S3 — The preview buffers the entire streamed file before enforcing the 2 MiB limit. A 3 MiB fixture with no Content-Length was read in full before "Too big to preview" appeared. — viewer/pages/file.js:40–44, viewer/app/routes.js:557–561
GAP: S4 — Rare path: A kept directory with denied access makes archive return HTTP 500 without uploads_removed: false. The move failure is caught, but the subsequent lstat throws again, bypassing the hub's archive retry handling. — machine/service.js:1259–1268, viewer/app/threads.js:219–241, reproduced with EACCES
GAP: S5 — Neither thread-list response includes the cached remote documents. Once the cache contained MAP.md, chat returned it and both /threads and /threads?view=list omitted it. — viewer/app/routes.js:441–470, viewer/app/chat.js:368–372
GAP: S5 — Rare path: A remote machine removed from the registry produces a document 404. The hub mistakes its own machine-lookup 404 for a missing document reported by the machine. — viewer/app/state.js:222–225, viewer/app/machine-client.js:68–79, viewer/app/remote-plan.js:20–22, reproduced by removing the fixture machine entry
GAP: S1 Validation — The required wide-graph test does a plain mouse drag, which selects an area. The graph transform stayed identical before and after that drag in Chromium and Firefox. A separate probe used the pan gesture and verified all four node fills after both zoom and pan. — viewer/test/app-picture-download.spec.js:65–82, viewer/index.html:2225–2245
GAP: S5 Validation — The lock assertion calls remote.refresh directly against a mock hub. It would still pass if chat or the thread-list route moved its refresh call inside a lock. — viewer/test/app-remote-plan.test.js:41–64, viewer/app/hub.js:280–295, viewer/app/routes.js:441–452
```

How each gap was judged:

- S3 streamed preview, S4 kept-directory EACCES, S5 removed machine: rare paths, recorded in PLAN.md Accepted Risks (round verification-1). Not remediated.
- S5 thread-list documents: the lead ruled it not a gap. The thread-list responses carry no document list for any thread, so nothing is missing. No row was added.
- The other three go to remediation as R1–R3, on the lead's answers.

## R1 — Form PNG uses the form on screen (S1)

Owner: `viewer/pages/picture.js` (and `viewer/pages/picture-export.js` only if needed). The picture page draws a form through `window.WCDiagram.draw(card, pictureEl, ctx, cache)`, and `formInto` (`viewer/pages/diagram.js:57-66`) stores one fetch promise per key in that `cache` Map. Today `showCard` passes a throwaway `new Map()` and `formPng` fetches again. Keep the Map that `draw` filled and build the PNG from the same promise's value, so Download never fetches again. Find the key `draw` uses for the Map in `diagram.js`, without editing `diagram.js`. Test: a browser test where the form route serves version A for the first request and version B afterwards. The page shows A, and the PNG's drawn strings (intercept `fillText`) contain A's text and not B's. Lane: claude (built by Claude in T3).

## R2 — Wide-graph test really pans and zooms (S1 Validation)

Owner: `viewer/test/app-picture-download.spec.js`. In the graph viewer (`viewer/index.html:2225-2245`), a pan is an alt-drag or a middle-button drag. A plain drag box-selects. Change the wide-graph test to zoom (wheel over the canvas, or whatever zoom the viewer supports) and pan with alt-drag or middle-button drag. Read the content group's `transform` before and after, and assert that it changed for both the zoom and the pan, before pressing Download. Keep the existing PNG size and content checks. Lane: claude (built by Claude in T3).

## R3 — The lock test covers the real callers (S5 Validation)

Owner: `viewer/test/app-remote-plan.test.js`, plus `viewer/test/helpers/` for additions only. Using the real app server and hub from `viewer/test/helpers/app.js`, with a remote thread as in `remoteContext()`:
1. Track lock state by wrapping the hub's `withThread` and `withChatThread` (`viewer/app/hub.js:120-134`) on the running hub instance, counting active callbacks per thread id.
2. Make the fake machine's `/v1/plan-files` reply a function that records whether a lock for that thread is held when the request arrives, then delays its answer (about 200 ms) and records again before replying.
3. Drive `GET /threads`, `GET /threads?view=list` and `GET /threads/:id/chat`, plus the doc route and `docs.zip`.
4. Assert that at least one plan-files request happened for each trigger and that no recorded sample saw the lock held. The refresh's own `withThread` runs after its `list` reply, so the refresh can still store the result.
5. Check that the assertion has teeth: temporarily move the refresh call inside the lock and see the test fail, revert the change, and say in the report that you did this.

If the hub instance cannot be reached from the test helpers, add a small accessor in `viewer/test/helpers/`. Do not change `viewer/app/` code unless the test exposes a real bug; if it does, report it before fixing it. Lane: gpt (built by GPT in T2).
