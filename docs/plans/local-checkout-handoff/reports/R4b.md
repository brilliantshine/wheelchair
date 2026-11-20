# R4b — stale connection error (K1)

## What changed, by file

- `viewer/pages/thread.js`
  - `copyLoad`: its catch sets `copy.errorFrom = 'load'` with the error. Its success branch clears the error when `!quiet` (as before) **or** when `copy.errorFrom === 'load'`, and clears `errorFrom` with it.
  - `copyWrite`: wherever it sets `copy.error` (refusal reason, or thrown error), it also sets `copy.errorFrom = 'write'`. A refusal reason or a failed write's error still survives the quiet re-read that follows a write.
- `viewer/test/app-try.spec.js`
  - New test `a failed background poll clears its hub error once a later poll succeeds`, placed before the existing "a refused write shows the reason and re-reads Status once" test. The existing test is unchanged.

## Validation

### 1. `cd viewer && npx playwright test app-try --reporter=list` (final run)

Exit 0, 32 tests, 2 workers, both chromium and firefox. Tail:

```
  ✓  25 [chromium] › test/app-try.spec.js:180:1 › a failed background poll clears its hub error once a later poll succeeds (6.6s)
  ✓  26 [firefox] › test/app-try.spec.js:180:1 › a failed background poll clears its hub error once a later poll succeeds (6.7s)
  ✓  27 [chromium] › test/app-try.spec.js:194:1 › a refused write shows the reason and re-reads Status once (1.0s)
  ✓  29 [chromium] › test/app-try.spec.js:207:1 › refused is shown instead of Try; Done and Dismiss send the version (766ms)
  ✓  28 [firefox] › test/app-try.spec.js:194:1 › a refused write shows the reason and re-reads Status once (1.3s)
  ✓  30 [chromium] › test/app-try.spec.js:225:1 › nothing overflows at phone width with long paths (507ms)
  ✓  31 [firefox] › test/app-try.spec.js:207:1 › refused is shown instead of Try; Done and Dismiss send the version (957ms)
  ✓  32 [firefox] › test/app-try.spec.js:225:1 › nothing overflows at phone width with long paths (538ms)

  32 passed (29.5s)
```

Earlier runs in this session failed on my own new test, not on the fix (see the Choices below). Those runs were replaced by the passing run above.

### 2. `node --test viewer/test/*.test.js` (from the repo root, glob unquoted)

Exit 0. Tail:

```
# tests 695
# suites 0
# pass 695
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 49170.740903
```

## Not done

- I did not run the new test against the unfixed `thread.js` to watch it fail. By reading the code, without the fix a quiet successful poll leaves `copy.error` set, so the `toHaveCount(0)` assertion would fail. That is the reasoning, not a recorded run.
- No file was deleted. The Playwright run writes `viewer/test-results/` as usual; that is test output, not something I removed.

## Choices

- `viewer/pages/thread.js` (`copyLoad`): the quiet success branch also resets `copy.errorFrom` to `''` when it clears the error, so a later write error starts from a clean origin.
- `viewer/pages/thread.js` (`copyWrite`): `errorFrom` is not reset at the start of a write, where `copy.error` is cleared. It is only read when `copy.error` is set, and every path that sets `copy.error` in `copyWrite` also sets `errorFrom`, so the stale value is never read.
- `viewer/test/app-try.spec.js` (new test): before aborting the GET, the test waits for the page-load read to show `A switch is running.`. The first attempt aborted the page-load GET, which set no busy status and so scheduled no follow-up poll. That made the test fail for a test reason, not the fix. This is a test-setup choice only; the product code is unaffected.
- `viewer/test/app-try.spec.js` (new test): the success is checked with `Switched your copy to this thread.`, using `thread_id` equal to the test's own thread id. That is what the page shows for a successful last outcome on this thread.

## Files changed

- `viewer/pages/thread.js`
- `viewer/test/app-try.spec.js`
- `docs/plans/local-checkout-handoff/reports/R4b.md`
