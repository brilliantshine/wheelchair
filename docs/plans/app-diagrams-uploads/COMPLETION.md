---
slug: app-diagrams-uploads
date: 2026-11-15
implemented-by: "gpt standard (gpt-6.1-terra) for T1–T6; sub-lead claude-opus-5-5 (one test-fixture fix)"
verified-by:
  - round: 1
    lane: gpt (verifier, gpt-6.1-sol) — FAIL, REMEDIATION-1.md
    checks: gpt standard (gpt-6.1-terra)
  - round: 2
    lane: gpt (verifier, gpt-6.1-sol) — FAIL, REMEDIATION-2.md
    checks: gpt standard (gpt-6.1-terra)
  - round: 3
    lane: gpt (verifier, gpt-6.1-sol) — PASS on 7fe7baf
    checks: gpt standard (gpt-6.1-terra), gpt light (gpt-6-luna)
---

# Completion Report — More diagram forms and file uploads in app threads

Written for a hostile reviewer: every claim checkable, no claim without evidence. Feature
branch `wc/c56d4b2c5f5f`. Per-task reports: `docs/plans/app-diagrams-uploads/reports/T1.md`–`T6.md`.

## Spec coverage

No Prior Work items: every row is `this run`.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| 1. `diagram` card optional `format` graph/form/html, others refused | this run | viewer/app/card.js:98 | viewer/test/app-hub.test.js:1720 |
| 1. Graph registered only for format graph/absent | this run | viewer/app/cards.js:54 | viewer/test/app-hub.test.js:1720 |
| 1. JSON forms drawn in the card as text (timeline, before-after, layers, side-by-side), `explanation` above | this run | viewer/pages/thread.js:393 (drawForm), :421 (formCard, cached per card id) | viewer/test/app-diagrams-uploads.spec.js:15 |
| 1. One column under 600 px card width; long words wrap | this run | viewer/pages/thread.css:244 (container), :245 (overflow-wrap), :265 (@container) | app-diagrams-uploads.spec.js:15 (390 px, scrollWidth <= innerWidth) |
| 1. Drawing error "This diagram could not be drawn" + reason (load failure, bad shape, missing/unknown form) | this run | viewer/pages/thread.js:393-430 | app-diagrams-uploads.spec.js:15 (invalid timeline) |
| 1. No Open full screen link for forms | this run | viewer/pages/thread.js:627 | code reading |
| 1. `GET /wheelchair/diagram-form` (registered plan's graphs/ only, unchanged JSON, 2 MiB) | this run | viewer/server.js:1823, :2259 | viewer/test/routes.test.js:355 |
| 1. Archived form via existing `/threads/<id>/graph` | this run (page side) | viewer/pages/thread.js:170-176 | code reading |
| 1. `GET /wheelchair/diagram-html` live + `/threads/<id>/diagram-html` archived, exact headers and CSP | this run | viewer/server.js:1823; viewer/app/routes.js:13, :370; viewer/app/threads.js:217 | routes.test.js:355; app-hub.test.js:1797; app-diagrams-uploads.spec.js:15 (CSP read from the live response) |
| 1. HTML embedded as `<iframe sandbox>` (no tokens), 340 px, Open full screen link | this run | viewer/pages/thread.js:635 | app-diagrams-uploads.spec.js:15 (text and inline-style colour visible via frameLocator; no request to script/img/link/meta-refresh URLs; Chromium and Firefox, so the cookie reaches the sandboxed frame) |
| 1. Protocol: cards.md `diagram` format, schemas, HTML rules, picking line; lead.md pointer | this run | protocol/app/cards.md:185-215; protocol/app/lead.md:347-348 | reports/T4.md |
| 2. `image` card, lead only, `path` + `title`; documented | this run | viewer/app/card.js:31, :99; protocol/app/cards.md:217 | app-hub.test.js:1720 |
| 2. Machine checks file (exists, regular, <= 25 MB, png/jpg/jpeg/gif/webp) → 422; copies into uploads, rewrites `path` | this run | machine/service.js:224 (copyImage), :960 | machine/test/service.test.js:962 |
| 2. Hub stores `file` = basename, never reads `path` | this run | viewer/app/cards.js:79 | app-hub.test.js:1720 |
| 2. Page shows `<img>` from `/threads/<id>/files/<file>`, opens in a new tab | this run | viewer/pages/thread.js:638-641 | app-diagrams-uploads.spec.js:49 (naturalWidth > 0, both browsers) |
| 2. Hub files route: name pattern, streams from machine | this run | viewer/app/routes.js:358 | app-hub.test.js:1739 |
| 2. Machine `GET /v1/uploads/<thread>/<file>`: types, attachment, nosniff, 404 | this run | machine/service.js:938 | service.test.js:938 |
| 2. Archived thread: "Image removed when the thread was archived", no fetch | this run | viewer/pages/thread.js:640 | app-diagrams-uploads.spec.js:49 |
| 2. `MachineClient.stream` | this run | viewer/app/machine-client.js:80 | app-hub.test.js:1739, :1762 |
| 3. Composer: attach button, paste, drop, chips with remove, pasted-image naming | this run | viewer/pages/thread.html:36-43; viewer/pages/thread.js:792-822 | app-diagrams-uploads.spec.js:49 (paste → chip `pasted-…`) |
| 3. File over 25 MB never added, "<name> is over 25 MB" | this run | viewer/pages/thread.js:814 | app-diagrams-uploads.spec.js:49 (no upload request reaches the machine) |
| 3. Send uploads in order; failure keeps chips and text; success posts `[attached: <path>]` lines | this run | viewer/pages/thread.js:823-845 | app-diagrams-uploads.spec.js:49 (message ends with the line; bytes on disk match) |
| 3. Hub `POST /threads/<id>/uploads`, before the JSON parse; 409 archived/no lead; 413 length; 201 {path} | this run | viewer/app/routes.js:39, :66 | app-hub.test.js:1739 |
| 3. Hub answers 409 when the machine cancels an upload (not 500) | this run | viewer/app/routes.js:72-80 | app-hub.test.js:1762; viewer/test/app-uploads-archive.test.js:65 |
| 3. Machine `POST /v1/uploads`: sanitizer, `<n>-` counter with `wx`, mode 0700, `.part` then rename, 413 with no file | this run | machine/service.js:31, :175, :191, :933 | service.test.js:938 |
| 3. Per-thread lock covering archive, uploads, image copy; admission check inside the lock on record state | this run | machine/service.js:164, :196-198, :226-228 | service.test.js:962 (test 2), :994 (test 3), :938 |
| 3. Archive sets `closing` and destroys in-flight uploads before the lock | this run | machine/service.js:526-528 | service.test.js:979 (test 1); app-uploads-archive.test.js:65 (through the real hub, default timeout) |
| 3. Archive removes `uploads/<thread-id>` unless a rebase is kept; reports `uploads_removed` | this run | machine/service.js:582-586 | service.test.js:938, :152 (kept on rebase) |
| 3. Hub: `uploads_removed === false` keeps the thread open with "Uploads could not be removed" | this run | viewer/app/threads.js:162-175 | app-hub.test.js:1783 |

## Deviations from plan

- `uploads_removed` is `null`, not `true` or `false`, when a rebase is kept and the folder is left on purpose (machine/service.js:582). Settled in the T1 brief so the hub does not add an uploads card beside the rebase card. The hub treats only `false` as failure.
- `/wheelchair/diagram-form` answers 422 for malformed JSON and 413 over 2 MiB (the Spec gave no status codes).
- The hub's "machine cancelled the upload" answer is `409 {"error": "upload cancelled by the machine"}` (T6); the Spec allowed 409 or a dropped connection.

## Routers

highways not installed; routers not maintained. (viewer/app/API.md and machine/API.md were updated with the new routes and fields.)

## Validation evidence

Run by the sub-lead on the feature branch at `767497d` (all tasks merged).

`bash machine/test/run.sh`:
```text
# tests 89
# suites 0
# pass 89
# fail 0
# cancelled 0
# skipped 0
# todo 0
exit 0
```

`node --test viewer/test/*.test.js`:
```text
not ok 233 - a starter that loses the freed port registers through the new holder
# tests 349
# suites 0
# pass 348
# fail 1
# cancelled 0
# skipped 0
# todo 0
exit 1
```

The one failure, `a starter that loses the freed port registers through the new holder`, fails the same way on the feature branch before T2 was merged (sub-lead run at `d4b6cab`, logged in PLAN.md).

`npm --prefix viewer run test:browser` (Chromium and Firefox):
```text
  ✘  325 [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph (273ms)
  ✓  372 [firefox] › test/render.spec.js:129:3 › list page › a failed poll shows an error and keeps the last good list (587ms)
  ✓  454 [firefox] › test/app-accounts.spec.js:423:3 › lead waiting line › hidden when the lead is fine or the limit has passed (2.4s)
  ✘  542 [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph (440ms)
  2 failed
  2 skipped
  568 passed (2.0m)
exit 1
```

The two failures are the known issue `docs/known-issues.md:53` ("no drawn arrow's line passes through either box it connects"), which fails on `main` too.

New browser spec, all four (two tests × two browsers):
```text
  ✓  2 [chromium] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (1.0s)
  ✓  1 [firefox] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (1.7s)
  ✓  4 [firefox] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (2.9s)
  ✓  3 [chromium] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (6.0s)
  4 passed (7.6s)
```

## Known gaps / residual risks

- Browser tests run at 390 × 844 only; desktop layout of the composer and forms was checked by reading the CSS, not by a test.
- Drag-and-drop onto the composer and the attach button's file picker are not tested in a browser (paste and `setInputFiles` on the hidden input are).
- The archived HTML route's header test stubs the git reader (app-hub.test.js:1797), so `git show` of an `.html` file is exercised only by code reading of threads.js:217, which mirrors `archivedGraph`.
- Any socket-level failure between hub and machine during an upload now answers 409 "upload cancelled by the machine", including a machine crash, not only an archive.
- The fake machine used by the browser suite (viewer/test/helpers/app-machine.js) always serves `image/png`; real content types are covered by machine/test/service.test.js:938.
- The sub-lead, not a worker, replaced the browser spec's embedded PNG (bad IDAT CRC, rejected by Firefox) with a valid one (commit `af83eaf`).

## Remediation rounds

### Remediation 1 — 2026-11-15

Verification 1 (GPT, on `8ec85f3`) failed on three gaps; list verbatim in `REMEDIATION-1.md`. Fixed by R1a and R1b (GPT standard, `gpt-6.1-terra`).

| Gap | Fix (file:line) | Validated by |
|-----|-----------------|--------------|
| Spec 3, upload each file in order (removing a chip mid-upload skipped the next file) | viewer/pages/thread.js:829 (send uploads a snapshot), :802 (remove disabled while uploading); textarea, attach, paste and drop do nothing while uploading; success removes exactly the sent files | viewer/test/app-diagrams-uploads.spec.js:74 (both browsers) |
| Spec 3, show upload failure reason ("Upload failed: app-error") | viewer/pages/thread.js:87 (`out.detail || out.error`) | viewer/test/app-diagrams-uploads.spec.js:101 (both browsers) |
| Spec 2, absolute image path | viewer/app/card.js:100; machine/service.js:229 (422 "image path must be absolute", nothing spooled or copied) | viewer/test/app-hub.test.js:1725; machine/test/service.test.js:966 |

Validation after remediation, sub-lead run on `6e8f883`:

`bash machine/test/run.sh`:
```text
# tests 89
# pass 89
# fail 0
exit 0
```

`node --test viewer/test/*.test.js`:
```text
not ok 233 - a starter that loses the freed port registers through the new holder
# tests 349
# pass 348
# fail 1
exit 1
```

`npm --prefix viewer run test:browser`:
```text
  ✓    1 [chromium] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (1.6s)
  ✓   13 [chromium] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (6.1s)
  ✓   49 [chromium] › test/app-diagrams-uploads.spec.js:74:1 › attachments stay fixed during upload and are sent in order (2.0s)
  ✓   68 [chromium] › test/app-diagrams-uploads.spec.js:101:1 › upload app error shows detail and preserves the draft (580ms)
  ✓  155 [firefox] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (2.2s)
  ✓  175 [firefox] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (4.6s)
  ✓  207 [firefox] › test/app-diagrams-uploads.spec.js:74:1 › attachments stay fixed during upload and are sent in order (2.6s)
  ✓  223 [firefox] › test/app-diagrams-uploads.spec.js:101:1 › upload app error shows detail and preserves the draft (1.0s)
  ✘  324 [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph (563ms)
  ✘  552 [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph (408ms)
  2 failed
  2 skipped
  572 passed (2.2m)
exit 1
```

Remaining failures are the same two known ones as before: the port-race unit test and the drawn-arrow browser test (`docs/known-issues.md:53`).

### Remediation 2 — 2026-11-15

Verification 2 (GPT, on `6a65da5`) failed on one new gap; verbatim in `REMEDIATION-2.md`. Fixed by R2 (GPT light, `gpt-6-luna`).

| Gap | Fix (file:line) | Validated by |
|-----|-----------------|--------------|
| Spec 2, archived image cards (image stayed visible after archive until reload) | viewer/pages/thread.js:766 (`t.archived` in the chat render signature) | viewer/test/app-diagrams-uploads.spec.js:74 (archive while the page is open, no reload; both browsers) |

Validation after remediation, sub-lead run on `45430fc`:

`bash machine/test/run.sh`:
```text
# tests 89
# pass 89
# fail 0
exit 0
```

`node --test viewer/test/*.test.js`:
```text
not ok 233 - a starter that loses the freed port registers through the new holder
# tests 349
# pass 348
# fail 1
exit 1
```

`npm --prefix viewer run test:browser`:
```text
  ✓    1 [chromium] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (1.6s)
  ✓   47 [chromium] › test/app-accounts.spec.js:148:5 › phone › a failed sign-in shows the fallback and an Open terminal link (377ms)
  ✓   48 [chromium] › test/app-settings.spec.js:240:3 › desktop › a failed preview shows one plain line under the panel (217ms)
  ✓   51 [chromium] › test/app-new-thread.spec.js:163:1 › a failed Remove shows inside that entry; an Add refusal shows under the Add row (326ms)
  ✓   16 [chromium] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (6.2s)
  ✓   97 [chromium] › test/render.spec.js:129:3 › list page › a failed poll shows an error and keeps the last good list (91ms)
  ✓   60 [chromium] › test/app-diagrams-uploads.spec.js:74:1 › archiving redraws an open image card without reloading (4.3s)
  ✓  120 [chromium] › test/app-diagrams-uploads.spec.js:90:1 › attachments stay fixed during upload and are sent in order (514ms)
  ✓  139 [chromium] › test/app-accounts.spec.js:148:5 › desktop › a failed sign-in shows the fallback and an Open terminal link (309ms)
  ✓  128 [chromium] › test/app-diagrams-uploads.spec.js:117:1 › upload app error shows detail and preserves the draft (2.0s)
  ✓  165 [firefox] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (2.4s)
  ✓  192 [firefox] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (2.9s)
  ✓  217 [firefox] › test/app-accounts.spec.js:148:5 › phone › a failed sign-in shows the fallback and an Open terminal link (492ms)
  ✓  206 [firefox] › test/app-diagrams-uploads.spec.js:74:1 › archiving redraws an open image card without reloading (3.4s)
  ✓  229 [firefox] › test/app-diagrams-uploads.spec.js:90:1 › attachments stay fixed during upload and are sent in order (947ms)
  ✓  233 [firefox] › test/app-diagrams-uploads.spec.js:117:1 › upload app error shows detail and preserves the draft (735ms)
  ✓  242 [chromium] › test/app-accounts.spec.js:423:3 › lead waiting line › hidden when the lead is fine or the limit has passed (788ms)
  ✓  293 [firefox] › test/app-new-thread.spec.js:163:1 › a failed Remove shows inside that entry; an Add refusal shows under the Add row (765ms)
  ✘  313 [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph (383ms)
  ✓  311 [firefox] › test/app-accounts.spec.js:148:5 › desktop › a failed sign-in shows the fallback and an Open terminal link (836ms)
  ✓  321 [firefox] › test/app-settings.spec.js:240:3 › desktop › a failed preview shows one plain line under the panel (2.3s)
  ✓  373 [firefox] › test/render.spec.js:129:3 › list page › a failed poll shows an error and keeps the last good list (501ms)
  ✓  473 [firefox] › test/app-accounts.spec.js:423:3 › lead waiting line › hidden when the lead is fine or the limit has passed (2.2s)
  ✘  550 [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph (398ms)
  2 failed
  2 skipped
  574 passed (2.2m)
exit 1
```

Remaining failures are the same two known ones: the port-race unit test and the drawn-arrow browser test (`docs/known-issues.md:53`).
