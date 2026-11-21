---
slug: sidebar-files-followup
date: 2026-11-21
implemented-by: "T1, T2: standard, gpt-6.1-terra; T3, T4: standard, claude-sonnet-5-5 (sub-lead: claude-opus-5-5)"
verified-by: []
---

# Completion Report — Thread files: the parts saved for later

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are at commit `4166191a` (feature branch `wc/291bff9fbda1`). The plan has no Prior
Work section, so every row is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 Download button on the picture page, for every picture it shows | this run | `viewer/pages/picture.js:32-36,73`; `viewer/pages/picture.html` | `viewer/test/app-picture-download.spec.js:60,101,120` |
| S1 Graph PNG: clone, drop the pan/zoom transform, viewBox = group bbox + 24 px, computed styles inlined, `text.label-metric` removed, 2× on page background, 8192 cap | this run | `viewer/pages/picture-export.js:9-11,42-70` (`graphCanvas`), `:12` (`scaleFor`), `:55` (metric removal) | `app-picture-download.spec.js:60` (wide graph, panned/zoomed; exact PNG size; content in every quarter), `:85` (`fill-opacity` kept, no metric element) |
| S1 Form PNGs (timeline, before-after, layers, side-by-side), every on-screen string, wrapped, 2×, 8192 cap | this run | `viewer/pages/picture-export.js:104-196` (`formCanvas` at `:181`) | `app-picture-download.spec.js:101` (timeline form: every string drawn) |
| S1 HTML pictures: download = displayed URL + `&download=1`, attachment named after the `.html` file | this run | client `viewer/pages/picture.js:73`; local-live route `viewer/server.js:1691-1694`; archived route `viewer/app/routes.js:564-570` | `app-picture-download.spec.js:120`; `viewer/test/routes.test.js:389-391`; `viewer/test/app-hub.test.js:2030-2032` |
| S1 Saved HTML inert: charset + CSP metas after a leading doctype (BOM, whitespace, comments allowed before it) else at byte 0; refresh metas removed | this run | `viewer/app/html-download.js:3-10` | `viewer/test/html-download.test.js`; `viewer/test/app-files-followup.spec.js:187,195,204` (both routes: metas first, non-ASCII intact, no script runs, form does not submit; doctype and comment+doctype stay first, no refresh meta) |
| S1 PNG file name rule; blob URL on `<a download>` | this run | `viewer/pages/picture-export.js:19-35` | `app-picture-download.spec.js:60` (`Wide-graph.png`) |
| S2 `GET /threads/:id/docs.zip` (auth as doc route, names `<slug>/<FILE>`, `<slug>-documents.zip`, 404 when none, remote live list then read, any remote failure 502, local missing file skipped) | this run | `viewer/app/routes.js:574-597` | `viewer/test/app-documents.test.js` ("ZIP serves live and archived eligible documents and 404 for an empty plan"); `viewer/test/app-remote-plan.test.js` (remote ZIP 200, read 404 → 502, unreachable → 502) |
| S2 ZIP writer (stored, CRC-32, central directory, end record, no dependency) | this run | `viewer/app/zip.js:1-15` | `viewer/test/zip.test.js` (Python `zipfile` reads names and bytes) |
| S2 Local archived listing checks blob size ≤ 2 MiB; cache key adds branch tip | this run | `viewer/app/documents.js:41-50` | `app-documents.test.js` ("archived listing follows branch tip and excludes oversized blobs") |
| S2 Download all link (sidebar and phone panel) when a document exists | this run | `viewer/pages/thread.js:425` | `app-files-followup.spec.js:45,56,114,124` |
| S3 Previewable rule (extensions, ≤ 2 MiB) | this run | `viewer/pages/file.js:7-11` (`window.WCFilePreview`) | `viewer/test/app-file-preview.spec.js:50` |
| S3 Sent row and file chat card open the preview page; others keep download | this run | `viewer/pages/thread.js:415,447,1146`; `viewer/pages/thread.html` loads `file.js` | `app-files-followup.spec.js:63,114` |
| S3 Preview page: file route fetch, "Too big to preview" past 2 MiB, UTF-8, Markdown via `renderMarkdown` with http(s)-only links, other text in `<pre>` via `textContent`, file name, Download, back link | this run | `viewer/pages/file.html`, `viewer/pages/file.js:12-56`, `viewer/pages/file.css`; page registered `viewer/server.js:1709` | `app-file-preview.spec.js:22,34,43` |
| S4 Hub archive sends `keep` (lead `file`/`image` cards, not retracted, deduplicated) | this run | `viewer/app/threads.js:217-219` | `viewer/test/app-kept-files.test.js` |
| S4 Machine moves kept names to `kept/<thread>/` inside the lock (regex, lstat regular file, 0700, rename/EXDEV copy), failure → `uploads_removed: false`, `kept_uploads` | this run | `machine/service.js:1249-1268` | `machine/test/plan-files.test.js` ("archive keeps selected regular uploads, retries and reserves numbers") |
| S4 Older machine (no `kept_uploads`) treated as empty; only strings kept | this run | `viewer/app/threads.js:245` | `app-kept-files.test.js` (non-string entry dropped) |
| S4 `GET /v1/uploads` falls back to `kept/`, same checks | this run | `machine/service.js:2026-2036` | `plan-files.test.js` (kept file served after archive) |
| S4 `reserveUpload` numbering across `kept/` | this run | `machine/service.js:337-342` | `plan-files.test.js` (`5-new.txt`) |
| S4 `thread.kept_files` recorded; archived rows, file cards and image cards show links only for kept names | this run | `viewer/app/threads.js:245`; `viewer/pages/thread.js:413-414,445,1137,1144,1345` | `app-kept-files.test.js` (stored on retry, in chat response); `app-files-followup.spec.js:79,101` |
| S4 A rebase-kept or uploads-failed archive still stays unarchived | this run (unchanged contract) | `viewer/app/threads.js:226-241` | `app-kept-files.test.js` (uploads-failed archive stays open); existing archive tests in the viewer suite |
| S5 Machine `POST /v1/plan-files` discover/list/read, input checks, 2 MiB rule, maxBuffer ≥ 3 MiB, async `execFile` | this run | `machine/service.js:54-80,2050`; `machine/API.md` | `plan-files.test.js` ("plan files use committed refs and enforce input and size limits": 1.5 MiB listed and read whole; > 2 MiB unlisted and 404; refusals 400; missing ref/file 404; status) |
| S5 Hub remote reads with a 10 s whole-response deadline | this run | `viewer/app/remote-plan.js:14-23`; `viewer/app/machine-client.js:33-34` | `app-remote-plan.test.js` (machine 404 → 404, 500 → 502, unreachable → 502) |
| S5 Discovery and listing never under a lock; background refresh after the chat lock and the thread-list poll; 30 s since last attempt; in-flight cleared in `finally`; snapshot re-checked under `withThread` | this run | `viewer/app/remote-plan.js:24-44`; `viewer/app/hub.js:293`; `viewer/app/routes.js:452`; `viewer/app/views.js:38,102`; `viewer/app/documents.js:36` | `app-remote-plan.test.js` ("refresh checks its snapshot and never starts a machine call under the lock") |
| S5 Features and Agents stage from `last_status` | this run | `viewer/app/remote-plan.js:39` (saves `last_status`); readers unchanged | `app-remote-plan.test.js` ("remote refresh saves committed status for Features") |
| S5 Archived remote threads read through the machine; local archived keep local git | this run | `viewer/app/routes.js` doc route (`remote.isRemote` first, then `archivedDocument`) | `app-remote-plan.test.js` (live and archived remote doc and ZIP) |
| S5 Picture routes and pages unchanged for remote threads | this run (no change) | no S5 edits to `viewer/pages/diagram.js`, `viewer/index.html`, graph/form routes | diff `ad70513e..4166191a` |
| Check Once Built 1: 1–2 MiB document listed and read whole | this run | `machine/service.js` `git show` with 4 MiB `maxBuffer` | `plan-files.test.js` (1.5 MiB `MAP.md` read whole) |

## Deviations from plan

None from the Spec. Choices the Spec left open are logged in PLAN.md's Log (lines starting
`Choice:`). One edit was made outside a task's ownership boundary and disclosed:
`viewer/test/app-files.spec.js` gained `exact: true` on two Download locators so the new
"Download all" link does not match them. No assertion was weakened.

## Routers

`viewer/AGENTS.md`: rows added for the new `viewer/app` modules (`zip.js`, `remote-plan.js`,
`html-download.js`) and the new pages (`file.html`/`file.js`, `picture-export.js`). No
ownership moved between directories. `machine/API.md` (a contract, not a router) documents
`/v1/plan-files`, `keep` and `kept_uploads`; `viewer/app/API.md` documents `docs.zip`,
`download=1` and `kept_files`.

## Validation evidence

Run by the sub-lead on the merged feature branch at `4166191a`:

```text
$ bash machine/test/run.sh
# tests 449
# pass 449
# fail 0
# duration_ms 89780.60419

$ node --test viewer/test/*.test.js
# tests 732
# pass 732
# fail 0
# duration_ms 101338.726435

$ npm --prefix viewer run test:browser
  1142 passed (16.7m)
EXIT 0
```

Each worker's branch was also re-run by the sub-lead before merging (T1 machine 449/449;
T2 viewer 732/732; T3 browser 1120 passed; T4 browser 1142 passed and viewer 732/732).

## Known gaps / residual risks

- The wide-graph test's "panned and zoomed" check compares the transform string to the
  identity; it does not prove the mouse actions changed the view. "Every node" is checked as
  content in each quarter of the PNG's width, not node by node.
- Only the timeline form has a PNG test; before-after, layers and side-by-side drawers are
  untested.
- The machine tests do not cover discover returning `null`, discover excluding directories
  present at the base, the `origin/<default_branch>` fallback, or the EXDEV copy path.
- No test drives a full chat → refresh → doc route cycle checking lock state at every
  caller; the lock rule is tested on `remote-plan.refresh` directly and is evident from the
  route code (doc and ZIP routes read outside `withThread`).
- Rare paths noted at review (Accepted Risks) still apply. Also rare: `kept/<thread>` existing
  as a file makes uploads for that thread fail; an `lstat` error other than ENOENT after
  uploads are removed fails a finished archive's response.

## Remediation rounds

### Remediation 1 — 2026-11-21

Verification attempt 1 (at `acfde7a0`): Claude verifier PASS; GPT verifier FAIL with 7
gaps (verbatim in `REMEDIATION-1.md`). 3 were rare paths, now in PLAN.md Accepted Risks
(round verification-1). The lead ruled 1 not a gap: the thread-list responses carry no
document list for any thread. The other 3 were fixed:

| Gap | Fix | Evidence |
|-----|-----|----------|
| S1: the form PNG could differ from the form on screen (Download fetched again) | `viewer/pages/picture.js:52-58,71`: the PNG uses the cache entry `draw` filled (key `card.id`); no fetch on Download | `viewer/test/app-picture-download.spec.js` "a form PNG draws the form that is on screen, not a later version" (serves A then B; A drawn, B not, one fetch) |
| S1 Validation: the wide-graph test's plain drag did not pan | The test zooms with the wheel and pans with an alt-drag, asserting the scale changed after the zoom and the translation moved after the pan, before Download | `viewer/test/app-picture-download.spec.js:60-95` |
| S5 Validation: the lock test called `refresh` directly on a mock | It now drives the real server for `/threads`, `/threads?view=list`, chat, the doc route and `docs.zip`, sampling lock state when each `/v1/plan-files` request arrives and before it is answered. A deliberate lock-held mutation failed it (worker report R3) | `viewer/test/app-remote-plan.test.js`; `viewer/test/helpers/plan-lock-probe.js` |

Lanes: R1 and R2 by claude-sonnet-5-5; R3 by gpt-6.1-terra.

Validation on the merged branch after remediation:

```text
$ bash machine/test/run.sh
# tests 449
# pass 449
# fail 0

$ node --test viewer/test/*.test.js
# tests 733
# pass 733
# fail 0

$ npm --prefix viewer run test:browser
  34 skipped
  1144 passed (11.9m)
EXIT 0
```

### Verification attempt 2 — 2026-11-21

At `bd1d90f9`. The Claude verifier (claude-opus-5-5) PASSED: all three Remediation 1 fixes
were confirmed against the code, and Check Once Built #1 passed. The GPT verifier
(gpt-6.2-sol) confirmed S1–S5 and the three fixes, and reported only two test-run failures:
`app-quiet.test.js` "6 message clears debt" and Firefox `app-views.spec.js:111` (tree
viewport). Neither test, nor the code under it, is changed on this branch. Both pass alone,
and the first is already recorded as load-sensitive
(`docs/plans/owner-name-identifiers/COMPLETION.md:23,41`). The Claude verifier's clean-copy
run of the full viewer suite gave exit 0 with 733/733 at the tip (and 724/724 at the merge
base). The lead ruled both failures timing flakes outside this build: attempt 2 counts as a
pass, and the tests are not hardened here.
