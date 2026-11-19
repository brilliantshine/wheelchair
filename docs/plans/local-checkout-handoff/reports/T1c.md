# T1c — heavy Git deadlines and remaining tests

Outcome: **done**. Heavy ignored-file, gitlink diff and ancestry operations now use the five-minute scan deadline; metadata uses the configurable four-second deadline. Folder-check metadata timeouts are reported as a timeout rather than an in-progress Git operation. Identity timeouts are also distinguished from a replacement folder, and Dismiss refuses on an identity timeout.

## Files changed

- `machine/lib/try.js`: configurable metadata deadline; scan deadline for the three repository-sized Git calls; folder-check and identity timeout handling.
- `machine/test/try.test.js`: delayed ignored-file scan and timeout tests; real-repository collision, worktree, am, filter, lock, queue, warning, status and reload coverage; stronger existing assertions.
- `docs/plans/local-checkout-handoff/reports/T1c.md`: this report.

The delayed-process filter fixture explicitly moves HEAD with `git update-ref --no-deref HEAD` after reporting a delayed blob, then fails the delayed fetch. This deterministically exercises the requested post-move failure and reload behavior; the natural Git checkout on this machine had not moved HEAD at the time of that failure. The descendant test checks the PID is gone and checks the outcome against HEAD and cleanliness. The warning test checks the actual Git exit code is zero and its stderr contains the removal warning. No extra product bug surfaced in the remaining tests.

The first coverage run failed because the test expected only `file`, whereas the interrupted checkout also reported `.gitattributes`. The assertion was corrected to require both exact paths. The first delayed-filter target check failed because HEAD had not moved naturally; the deterministic fixture described above corrected that setup. Both required suites pass on the final committed code.

Commits: `1f514dd1`, `b0ffd8b5`, `c49ee4d9`, `244bfe1b`, `ffa5239d` (plus this report commit).

## Validation

**Step 1** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 2315.957339
  type: 'test'
  ...
1..49
# tests 49
# suites 0
# pass 49
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 47311.670173
```

**Initial coverage run** — `node --test machine/test/try.test.js`:

```text
exit 1
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
        'file',
    +   '.gitattributes'
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'file'
  actual:
    0: 'file'
    1: '.gitattributes'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-74b646d1bdd0-w6/machine/test/try.test.js:436:164)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: real git switch unable to unlink warning is interrupted
ok 61 - real git switch unable to unlink warning is interrupted
  ---
  duration_ms: 521.302527
  type: 'test'
  ...
# Subtest: commit subject containing unable to unlink gives plain success
ok 62 - commit subject containing unable to unlink gives plain success
  ---
  duration_ms: 524.581158
  type: 'test'
  ...
1..62
# tests 62
# suites 0
# pass 61
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 46029.448767
```

**Filter target checks** — `node --test --test-name-pattern='hanging filter subprocess|smudge filter failing on a move' machine/test/try.test.js`:

```text
exit 0
  duration_ms: 1170.668606
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3136.915371
```

**Initial delayed filter fixture** — `node --test --test-name-pattern='delayed process filter' machine/test/try.test.js`:

```text
exit 1
TAP version 13
# Subtest: delayed process filter failing after HEAD moved records files across reload
not ok 1 - delayed process filter failing after HEAD moved records files across reload
  ---
  duration_ms: 656.79335
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-74b646d1bdd0-w6/machine/test/try.test.js:460:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + '62e35d2b1f96df4c57bd1a762c53330b94dc0193'
    - '44628a7264bea1e5b31c13a0f67aa43c7a335f02'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: '44628a7264bea1e5b31c13a0f67aa43c7a335f02'
  actual: '62e35d2b1f96df4c57bd1a762c53330b94dc0193'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-74b646d1bdd0-w6/machine/test/try.test.js:497:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 799.995848
```

**Corrected delayed filter fixture** — `node --test --test-name-pattern='delayed process filter' machine/test/try.test.js`:

```text
exit 0
  duration_ms: 1579.528635
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1839.889883
```

**Filter and warning checks** — `node --test --test-name-pattern='second write while|hanging filter|delayed process filter|required smudge filter failing on a move|real git switch unable' machine/test/try.test.js`:

```text
exit 0
  duration_ms: 271.384975
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2620.197812
```

**Coverage run** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 219.742563
  type: 'test'
  ...
1..64
# tests 64
# suites 0
# pass 64
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 25637.48473
```

**Full machine run** — `bash machine/test/run.sh`:

```text
exit 0
  duration_ms: 277.758356
  type: 'test'
  ...
1..409
# tests 409
# suites 0
# pass 409
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 34467.581425
```

**Queue and warning assertions** — `node --test --test-name-pattern='long switch does not delay|real git switch unable' machine/test/try.test.js`:

```text
exit 0
  duration_ms: 189.65417
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2449.465104
```

**Focused rerun** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 227.692397
  type: 'test'
  ...
1..64
# tests 64
# suites 0
# pass 64
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 30044.008914
```

**Full machine rerun** — `bash machine/test/run.sh`:

```text
exit 0
  duration_ms: 280.352251
  type: 'test'
  ...
1..409
# tests 409
# suites 0
# pass 409
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 34930.813497
```

**Hanging filter outcome** — `node --test --test-name-pattern='hanging filter subprocess' machine/test/try.test.js`:

```text
exit 0
  duration_ms: 1130.672021
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1268.421364
```

**Final focused validation** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 216.150178
  type: 'test'
  ...
1..64
# tests 64
# suites 0
# pass 64
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 23901.057819
```

**Final machine validation** — `bash machine/test/run.sh`:

```text
exit 0
  duration_ms: 212.365871
  type: 'test'
  ...
1..409
# tests 409
# suites 0
# pass 409
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 42668.724494
```

## Choices

- `machine/test/try.test.js`: move HEAD explicitly from the delayed process-filter fixture to reproduce a post-move failure deterministically; the natural delayed failure left HEAD at the source on this Git version.
