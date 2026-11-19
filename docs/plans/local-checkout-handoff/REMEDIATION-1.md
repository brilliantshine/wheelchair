# Remediation 1 — local-checkout-handoff

Verification attempt 1 on `61a04ea9`: Claude verifier PASS, GPT verifier FAIL. The lead's per-gap answer keeps three gaps to fix; the other ten are deferred as PLAN.md D4-D13.

## Gaps to fix (verbatim from the verifier reports)

- **G1** (GPT): "§2 Switch back cleanliness check — Affects normal use when someone commits during a trial and then makes more edits. Switch back creates a saved pin before discovering the dirty files. Two refused attempts with the same HEAD and dirty file created two saved entries. See `machine/lib/try.js:301` and `machine/lib/try.js:307`." (Claude): "If he commits while trying and then presses Switch back with changed files, the commits are pinned before the changed-files check, at `machine/lib/try.js:301-306`. Pressing again after a refusal pins the same commit a second time, so a duplicate entry appears in the saved list."
- **G2** (GPT): "§6 Status after write errors — Affects the normal refusal path. When the machine refuses a write with HTTP 200 and `accepted: false`, the panel displays the error but never issues the required Status read. The browser reproduction recorded two GETs before the refusal and two afterward. See `viewer/pages/thread.js:364` and `viewer/pages/thread.js:368`."
- **G7** (GPT): "Running Git and pre-switch scan failures — Rare process-start failure. If Git fails to spawn, the deadline handler attempts `process.kill(NaN, …)` and crashes Node instead of returning a refusal. An isolated call with a nonexistent Git executable exited `1` with `ERR_INVALID_ARG_TYPE` at `machine/lib/try.js:44`."

## Tasks

| Task | Gaps | Files | Lane |
|------|------|-------|------|
| R1a | G1, G7 | `machine/lib/try.js`, `machine/test/try.test.js` | light, gpt (built the machine side) |
| R1b | G2 | `viewer/pages/thread.js`, `viewer/test/app-try.spec.js` | light, claude (built the panel) |

### R1a — machine

1. G1, in `performBack` (`machine/lib/try.js`): move the "Moved → pin HEAD as kept" block (currently just after `const to = ...`, before the scan) into the final `else` branch, after the submodule and not-clean checks and before `record.pending = { op: 'back', ... }`. This mirrors `performTry`, where the same block already sits after the clean check. Before pinning in both `performTry` and `performBack`, skip the pin when an existing kept entry without `old_identity` already resolves (`await this.resolveRef(folder, entry.ref)`) to `from.sha`.
2. G7, in `runGit`: when `spawn` fails, `child.pid` is undefined. In the `error` handler, if `!child.pid`, clear both timers and resolve at once with `{code: 1, stdout, stderr, error}`. Guard `signal` and `groupAlive` so they do nothing (and report "not alive") when `child.pid` is falsy. Do the same guard in the metadata `git()` timer.
3. Tests, named after the gap: (a) commit while trying, leave a file dirty, press Back twice. Both refused, exactly one kept entry for that commit, and the file intact. Then clean the file and press Back again: success, still one entry. (b) `new TryService({..., gitExecutable: '/nonexistent/git'})`: `runGit` resolves with a non-zero code and the process does not crash, and a `try` on a temp repo ends with `last.outcome` `refused` (or a refusal answer) instead of throwing.

### R1b — panel

1. G2, in `copyWrite` (`viewer/pages/thread.js`): when the answer has `accepted === false`, set `reread = true`. The panel then re-reads Status (`copyLoad(true)`, which keeps the error line) after a refusal, as it already does after a thrown error.
2. Test in `viewer/test/app-try.spec.js`: a POST answered `{accepted: false, reason, status}` shows the reason and is followed by one more GET `/try`. Count the GETs with `page.route`.
