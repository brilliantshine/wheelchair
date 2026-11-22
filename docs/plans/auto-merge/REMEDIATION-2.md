# Remediation 2 — auto-merge

Verification attempt 2 at `96068dd6`: Claude (claude-opus-5-5) PASS; GPT (gpt-6.2-sol) FAIL.

## Gap list (verbatim)

> GAP: Spec Validation, step 8 readiness retry — The new retry test is timing-sensitive under the required `npm test` command. Its 20 ms budget expired after the first stubbed `gh pr view` call on the standalone rerun, so `assert.ok(calls.length > 1)` failed. — `viewer/test/app-auto-merge.test.js:16,75` and `viewer/app/auto-merge.js:72–74`.

## Judgment (sub-lead, realism.md)

1. Timing-sensitive retry test: a Spec validation command (`npm test`) fails under ordinary load, so this is **always fixed**. It is new, not a gap that survived attempt 1. → R2-a. The same 100 ms merge timeout in that file carries the same risk, so R2-a covers it too.

The `app-quiet.test.js:38` and `app-uploads-archive.test.js:65` failures that both verifiers saw under full-suite load are in code and tests this build does not touch. Both pass on targeted reruns, so they are not counted as gaps.

## Tasks

### R2-a

Plan slug: `auto-merge`. Task id: R2-a (remediation of verification attempt 2). Spec Validation (`npm test` must pass).
Lead session: `wc-91de6c1c2eb1-lead`.

## The gap
`viewer/test/app-auto-merge.test.js:16` sets `merge.timing.retryMs = 5; waitMs = 20; mergeTimeoutMs = 100` for the whole
file. Under the full parallel `npm test`, spawning the stub `gh` can take longer than 20 ms, so the UNKNOWN case in
'GitHub outcomes and exact merge arguments' (~line 66) makes only one `gh pr view` call and
`assert.ok(calls.length > 1)` (~line 75) fails. For the same reason, a 100 ms `mergeTimeoutMs` could turn a stubbed
successful merge into `unknown` under load.

Test-only fix. Do not change `viewer/app/auto-merge.js`.

## Ownership boundary
- `viewer/test/app-auto-merge.test.js`
- report `docs/plans/auto-merge/reports/R2-a.md`

## Exact change
1. Line 16: `merge.timing.retryMs = 20; merge.timing.waitMs = 20; merge.timing.mergeTimeoutMs = 5000;`
   (keep waitMs short so cases that wait out the budget stay fast, but give real `gh` calls plenty of time).
2. In 'GitHub outcomes and exact merge arguments', for the `UNKNOWN` row only, before `f.run()` set
   `merge.timing.retryMs = 50; merge.timing.waitMs = 1500;` and restore `retryMs = 20; waitMs = 20` in that iteration's
   `finally`. That guarantees several calls even on a loaded machine.
3. In 'merge timeout produces unknown and its specific notice' (~line 130): set `merge.timing.mergeTimeoutMs = 300`
   before the run and restore it to `5000` in its `finally`; change the stub's `exec sleep 2` to `exec sleep 5`.
4. In 'switching off during the readiness wait prevents merge', its `finally` restores `merge.timing.waitMs = 20`;
   keep that (it matches the new default).
5. Search the file for any other `merge.timing.` assignment and make its restore value match the new defaults.

## Validation (paste the summary lines of each)
```bash
cd viewer && node --test test/app-auto-merge.test.js
cd viewer && for i in 1 2 3 4 5; do node --test test/app-auto-merge.test.js 2>&1 | grep -E '^# (pass|fail)'; done
cd viewer && node --test test/*.test.js
```
For the full suite, any failure outside `app-auto-merge.test.js` should be reported by name, not fixed.
If the same gate fails twice, stop and report rather than iterating. Your own `wc.js` and `card.js` calls are always
allowed. Never delete files (no `rm`).

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
