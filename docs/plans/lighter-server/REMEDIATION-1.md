# Remediation 1 — lighter-server

Verification attempt 1 on commit 4406c6d97104e599e7ebd363c087ca6147a41e03.

- Claude verifier (`wc-f42d7a5b5e2f-verifier`, claude-opus-5-5): VERDICT: PASS. Noted, not a gap: `bash install/test/run.sh` fails its "real wheelchair directory is byte-identical after suite" check while a live agent writes under `~/.wheelchair`; this branch changes nothing under `install/`.
- GPT verifier (`wc-f42d7a5b5e2f-verifier-2`, gpt-6.2-sol): stopped by its provider's content filter before reporting. Its last probe printed `chat: 'Alpha'` against `disk: 'Omega'`. The sub-lead reproduced the cause below; the session was stopped, and attempt 2 starts both verifiers fresh.

## Gaps (verbatim from the probe, with the sub-lead's reproduction)

1. **Stale cached thread after a quick same-size in-place rewrite.** The probe's output: `chat: 'Alpha', disk: 'Omega'`. Cause: file timestamps advance in coarse ticks, so a same-size in-place write in the same tick as the previous write leaves `(mtimeMs, ctimeMs, size, ino)` identical and `State.cachedThread` (`viewer/app/state.js:141`) serves the old record until the file changes again. Reproduced: 198 of 200 back-to-back same-size rewrites on ext4 (`~/.local/state/wheelchair`) left the stat identical; 200 of 200 on tmpfs. The hub's own writes are unaffected (atomic rename to a new inode, and the cache entry is dropped after the write); outside in-place writers (tests, hand edits) are. Decision #51's premise (any write changes ctime) does not hold within one tick.

## Tasks

### R1-T1 — do not trust an entry cached right after its file changed

Lane: light / gpt (same provider that built T1). Ownership: `viewer/app/state.js`, `viewer/test/app-snapshot.test.js`. Change: record `checkedAt = Date.now()` before the stat; reuse a cached record only when the key matches and `max(mtimeMs, ctimeMs) < checkedAt - SETTLE_MS` (2000 ms); otherwise re-read. Test: an immediate same-size in-place rewrite after a cached read is seen; a file settled longer than `SETTLE_MS` is reused without a read. Validation: `node --test viewer/test/app-snapshot.test.js`; `node --test viewer/test/*.test.js`.
