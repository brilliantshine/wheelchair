# Remediation 4 — local-checkout-handoff

Verification attempt 4 on `e6d49767`: Claude verifier PASS, GPT verifier FAIL with four gaps. The lead's per-gap answer fixes K1 and K3; K2 and K4 are deferred as PLAN.md D17 and D18.

## Gaps to fix (verbatim from the GPT verifier report)

- **K1**: "Spec §6, connection errors — Normal use. After one status poll dropped and the next succeeded, the phone showed both "Switched your copy to this thread" and "Can't reach the hub." Successful background polls leave the earlier connection error displayed. Evidence: phone-size Chromium reproduction and `viewer/pages/thread.js:352–362`."
- **K3**: "Spec §6 and the switch outcome table, Git refusal reason — Rare path: a leftover `HEAD.lock` caused Git to exit 128 and explain the lock while HEAD stayed on clean `main`. The recorded reason was only "Git did not switch your copy." Evidence: real Git reproduction and `machine/lib/try.js:8–24`." (A regression from the J2 fix: before it, git's last line was shown.)

## Tasks

| Task | Gap | Files | Lane |
|------|-----|-------|------|
| R4a | K3 | `machine/lib/try.js`, `machine/test/try.test.js` | light, gpt (built the machine side) |
| R4b | K1 | `viewer/pages/thread.js`, `viewer/test/app-try.spec.js` | light, claude (built the panel) |

### R4a — `fatal:` lines (K3)

1. In `wayPaths` (`machine/lib/try.js`), the fallback sentence reads the first line starting with `error:` **or** `fatal:` (`/^(?:error|fatal):/`), stripping that prefix: `Git did not switch your copy: <rest>`. Path collection is unchanged.
2. Tests: extend the `wayPaths` unit test with a `fatal: Unable to create '/x/.git/HEAD.lock': File exists.` stderr. The result is `Git did not switch your copy: Unable to create '/x/.git/HEAD.lock': File exists.` Also add a real-git test: create `<git-dir>/HEAD.lock` (an empty file) in the fixture repo, then Try. The outcome is nothing-moved, the reason contains `HEAD.lock`, HEAD is unmoved, and `HEAD.lock` still exists (wheelchair never deletes it). If the scan-free `index.lock` check or another check refuses first, assert the outcome and reason you actually get and say so in the report.

### R4b — stale connection error (K1)

1. In `viewer/pages/thread.js`, record where the current error came from: `copy.errorFrom = 'load'` when `copyLoad`'s catch sets it, and `'write'` wherever `copyWrite` sets `copy.error` (refusal reason or thrown error). In `copyLoad`'s success branch, clear the error when `!quiet` (as now) **or** when `copy.errorFrom === 'load'`. A refusal reason, or a failed write's error, still survives the quiet re-read that follows a write.
2. Tests in `viewer/test/app-try.spec.js`: (a) while state is busy, abort one GET, so the error line shows "Can't reach the hub."; the next poll succeeds with a finished state; the error line is gone. (b) The existing "a refused write shows the reason and re-reads Status once" test still passes unchanged, so the refusal reason stays after the re-read.
