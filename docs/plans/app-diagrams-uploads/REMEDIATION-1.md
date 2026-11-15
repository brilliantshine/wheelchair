# Remediation 1 — app-diagrams-uploads

Verification attempt 1 (verifier `wc-c56d4b2c5f5f-verifier`, GPT, on `8ec85f3968253cfc6bf1f8bd3b08e0d3fac4311f`): FAIL.

## Gap list (verbatim)

```
GAP: Spec 3, upload each file in order — Removing the first chip during its paused upload skips the second file, then clears all chips. Reproduced in Chromium: only first.txt uploaded and appeared in the message; second.txt disappeared. Evidence: viewer/pages/thread.js:801, :830, :841.
GAP: Spec 3, show upload failure reason — Hub errors display “Upload failed: app-error” instead of their explanation. Reproduced with a real 409 containing detail “no live lead or thread is archived”. Evidence: viewer/pages/thread.js:835.
GAP: Spec 2, absolute image path — Both validator and machine accept relative paths; the machine resolves them against its working directory. Reproduced successful validation and copying. Evidence: viewer/app/card.js:99; machine/service.js:232.
```

Verifier's other results: machine 89/89; browser 568 passed, the two documented arrow failures, two skipped, all four new tests passed; node 348/349 after dependency install (documented lifecycle/port-race failure); sensitivity, seen, Codex and installer fixture suites passed.

## Tasks

### R1a — composer: upload a snapshot in order; show the hub's explanation (gaps 1, 2)

- **Objective:** On send, upload a snapshot of the attached files in order, with chip removal, the textarea and adding files disabled while uploading; on success remove exactly the sent files. On failure show `out.detail || out.error`.
- **Ownership:** viewer/pages/thread.js, viewer/pages/thread.css, viewer/test/app-diagrams-uploads.spec.js, viewer/test/helpers/app-machine.js.
- **Lane:** GPT standard (same provider that built it; attempt 1 sharpens the brief, no step up).
- **Validation:** `npm --prefix viewer run test:browser -- app-diagrams-uploads`; `npm --prefix viewer run test:browser`; `node --test viewer/test/*.test.js`.
- **New tests:** a held first upload cannot be removed and both files arrive in order; an app-error 409 shows its detail and keeps chips and text.

### R1b — image card `path` must be absolute (gap 3)

- **Objective:** card.js refuses a non-absolute image `path`; the machine's copyImage answers 422 "image path must be absolute" before any file check.
- **Ownership:** viewer/app/card.js, machine/service.js, viewer/test/app-hub.test.js, machine/test/service.test.js.
- **Lane:** GPT standard.
- **Validation:** `bash machine/test/run.sh`; `node --test viewer/test/*.test.js`.
