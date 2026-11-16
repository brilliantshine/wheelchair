# Remediation 2 — app-diagrams-uploads

Verification attempt 2 (verifier `wc-c56d4b2c5f5f-verifier-2`, GPT, on `6a65da54753e83e26da23fccef3fd389d618d60b`): FAIL.

## Gap list (verbatim)

```
GAP: Spec 2, archived image cards — Archiving an open thread leaves its image visible instead of showing “Image removed when the thread was archived” until reload. Reproduced in Chromium and Firefox: archived badge visible, image naturalWidth 2, removal notice absent. Evidence: viewer/pages/thread.js:766 omits archive state from the chat render signature; the required notice is at :640.
```

Verifier's other results: machine 89/89; node 348/349 (port-allocation setup failure; that file rerun passed 98/98); browser 572 passed, the two documented arrow failures, two skipped; all eight feature tests passed.

## Tasks

### R2 — redraw chat cards when the thread's archived state changes

- **Objective:** In viewer/pages/thread.js the `sync('chat', [...])` signature (line 766) gains `t.archived`, so image cards (and diagram sources, which also depend on it) redraw when the thread is archived without a reload.
- **Ownership:** viewer/pages/thread.js, viewer/test/app-diagrams-uploads.spec.js.
- **Lane:** GPT light (the exact change is given; a new gap, not a repeat).
- **Validation:** `npm --prefix viewer run test:browser -- app-diagrams-uploads`; `npm --prefix viewer run test:browser`.
- **New test:** an open thread showing an image card is patched to archived while the page is open (no reload); within the poll interval the image is gone and "Image removed when the thread was archived" is visible.
