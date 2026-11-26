# T2b: shared tools copy fixes

## Built

- `machine/lib/shared-tools.js:89` sweeps leftover private refs and locks before refresh, and `machine/lib/shared-tools.js:143` removes them again after fetch with a separate three-second Git bound, including failure and timeout. `machine/test/shared-tools.test.js:53` and `machine/test/shared-tools.test.js:103` cover failed and stalled fetches, locks, the initial sweep, and reaping the stalled process.
- `machine/lib/shared-tools.js:111` and `machine/lib/shared-tools.js:178` coordinate refresh and cleanup in both directions, preserving a copy until its pointer is published; the held-publication regression is `machine/test/shared-tools.test.js:125`.
- `machine/lib/shared-tools.js:14`, `machine/lib/shared-tools.js:64` and `machine/lib/shared-tools.js:167` report the step, deadline and first stderr line in at most 200 characters. Identity failures return a clear error without an outcome file when there is no identity (`machine/lib/shared-tools.js:104`). Tests are at `machine/test/shared-tools.test.js:138`, `machine/test/shared-tools.test.js:168` and `machine/test/shared-tools.test.js:179`.
- `machine/lib/shared-tools.js:77` and `machine/lib/shared-tools.js:122` record a waiting caller's deadline failure only if no newer outcome appeared, covered at `machine/test/shared-tools.test.js:77` and `machine/test/shared-tools.test.js:149`.
- `machine/lib/shared-tools.js:36` uses Git's resolved origin first, with config fallback; `machine/test/shared-tools.test.js:25` checks order with two matching candidates, and `machine/test/shared-tools.test.js:138` checks `insteadOf`.
- `machine/lib/shared-tools.js:146` disables automatic Git gc and maintenance for fetch; `machine/test/shared-tools.test.js:103` verifies both flags.

## Choices

- `machine/lib/shared-tools.js`: use a three-second independent deadline for final ref cleanup.
- `machine/lib/shared-tools.js`: serialize cleanup and refresh in both directions, with a waiting refresh subject to its own deadline.
- `machine/lib/shared-tools.js`: atomically compare and record outcomes synchronously so another outcome cannot interleave between the comparison and write.
- `machine/lib/shared-tools.js`: fall back to the configured origin when Git resolves it to a non-GitHub URL, retaining support for local URL rewrites.

## Deliberate break-and-restore checks

The following named tests failed with each fix deliberately disabled, then the code was restored. The publication test also failed against the previous implementation before its fix. The timeout mutation deliberately left the fetch alive; the test detected its PID and the temporary process was allowed to exit before proceeding.

`ref_cleanup`

```text
exit 1
TAP version 13
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
not ok 1 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 93.258237
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:103:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + 'refs/wheelchair/shared-tools/3020ef97-a9fc-4f72-9900-ecd712ec255a'
    - ''
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: ''
  actual: 'refs/wheelchair/shared-tools/3020ef97-a9fc-4f72-9900-ecd712ec255a'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:120:12)
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
# duration_ms 155.206913
```

`sweep`

```text
exit 1
TAP version 13
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
not ok 1 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 81.171277
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:103:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + 'git fetch failed: sweep missing'
    - 'git fetch failed: network broke'
                         ^
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'git fetch failed: network broke'
  actual: 'git fetch failed: sweep missing'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:117:12)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
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
# duration_ms 140.588347
```

`maintenance`

```text
exit 1
TAP version 13
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
not ok 1 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 93.529276
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:103:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /-c gc.auto=0/. Input:
    
    '-C /tmp/wheelchair-test-run-692990-Btopj0/shared-whYqmi/clone fetch --no-write-fetch-head --no-tags origin +refs/heads/main:refs/wheelchair/shared-tools/fe3b39bf-2cdc-4f09-bd54-fa8367c13153\n'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    -C /tmp/wheelchair-test-run-692990-Btopj0/shared-whYqmi/clone fetch --no-write-fetch-head --no-tags origin +refs/heads/main:refs/wheelchair/shared-tools/fe3b39bf-2cdc-4f09-bd54-fa8367c13153
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:118:12)
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
# duration_ms 154.371023
```

`cleanup_race`

```text
exit 1
TAP version 13
# Subtest: cleanup cannot remove a copy before its refresh publishes the pointer
not ok 1 - cleanup cannot remove a copy before its refresh publishes the pointer
  ---
  duration_ms: 156.880708
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:125:1'
  failureType: 'testCodeFailure'
  error: "ENOENT: no such file or directory, stat '/tmp/wheelchair-test-run-693060-86htt9/shared-lJNLzm/state/shared-tools/dfce83fd6e56d6159bad0b3b384bcdd85f13caa7c4e5fea2438f0e16723fc747/70fa116d9747652597834590fbb8d3aa23437009'"
  code: 'ENOENT'
  stack: |-
    async Object.stat (node:internal/fs/promises:1037:18)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:134:5)
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
# duration_ms 214.201426
```

`error_text`

```text
exit 1
TAP version 13
# Subtest: refresh failure messages name the step and fit on one short line
not ok 1 - refresh failure messages name the step and fit on one short line
  ---
  duration_ms: 70.0155
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:168:1'
  failureType: 'testCodeFailure'
  error: |-
    The expression evaluated to a falsy value:
    
      assert.ok(result.error.length <= 200)
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:175:69)
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
# duration_ms 128.221543
```

`waiter`

```text
exit 1
TAP version 13
# Subtest: a waiting caller has its own deadline and stale temporary copies are removed
not ok 1 - a waiting caller has its own deadline and stale temporary copies are removed
  ---
  duration_ms: 1326.04302
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:77:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + null
    - 'refresh was still running after 1.2 s'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'refresh was still running after 1.2 s'
  actual: ~
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:89:12)
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
# duration_ms 3182.136078
```

`newer_outcome`

```text
exit 1
TAP version 13
# Subtest: a waiter does not overwrite a newer recorded outcome
not ok 1 - a waiter does not overwrite a newer recorded outcome
  ---
  duration_ms: 828.913404
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:149:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
    +   at: '2026-11-26T00:22:22.545Z',
    +   error: 'refresh was still running after 0.7 s',
    +   ok: false
    -   at: '2099-01-01T00:00:00.000Z',
    -   error: null,
    -   ok: true
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    at: '2099-01-01T00:00:00.000Z'
    ok: true
    error: ~
  actual:
    at: '2026-11-26T00:22:22.545Z'
    ok: false
    error: 'refresh was still running after 0.7 s'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:163:66)
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
# duration_ms 2183.213068
```

`origin`

```text
exit 1
TAP version 13
# Subtest: origin lookup honors insteadOf and identity errors are clear
not ok 1 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 68.480142
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:138:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + null
    - '/tmp/wheelchair-test-run-693878-e02Sci/shared-BAKTpn/clone'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: '/tmp/wheelchair-test-run-693878-e02Sci/shared-BAKTpn/clone'
  actual: ~
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:143:10)
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
# duration_ms 127.234825
```

`identity`

```text
exit 1
TAP version 13
# Subtest: origin lookup honors insteadOf and identity errors are clear
not ok 1 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 106.987853
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:138:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /git rev-parse failed/. Input:
    
    'identity unavailable'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: 'identity unavailable'
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:145:47)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
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
# duration_ms 200.530499
```

`candidates`

```text
exit 1
TAP version 13
# Subtest: finds first matching repository and skips missing and unrelated candidates
not ok 1 - finds first matching repository and skips missing and unrelated candidates
  ---
  duration_ms: 67.578126
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:25:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + '/tmp/wheelchair-test-run-693983-ttZCkm/shared-WYXA5K/source'
    - '/tmp/wheelchair-test-run-693983-ttZCkm/shared-WYXA5K/clone'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: '/tmp/wheelchair-test-run-693983-ttZCkm/shared-WYXA5K/clone'
  actual: '/tmp/wheelchair-test-run-693983-ttZCkm/shared-WYXA5K/source'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:29:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
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
# duration_ms 126.591413
```

`timeout_cleanup`

```text
exit 1
TAP version 13
# Subtest: concurrent refreshes share one fetch, and deadline kills a stalled process
not ok 1 - concurrent refreshes share one fetch, and deadline kills a stalled process
  ---
  duration_ms: 3119.111293
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:53:1'
  failureType: 'testCodeFailure'
  error: 'Missing expected exception.'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    code: 'ESRCH'
  operator: 'throws'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:64:84)
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
# duration_ms 11188.045574
```

`publication`

```text
exit 1
TAP version 13
# Subtest: a copy publication failure names its step
not ok 1 - a copy publication failure names its step
  ---
  duration_ms: 100.088501
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:179:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + 'disk full'
    - 'copy publication failed: disk full'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'copy publication failed: disk full'
  actual: 'disk full'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:184:12)
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
# duration_ms 174.122358
```

## Validation

The first target run below was the intentional pre-fix regression run. The next exposed a fixture issue: Git removed the empty ref directory; the wrapper was corrected to recreate it. Intermediate full machine runs were started while the fixes and tests were being finalized; one hit `EADDRINUSE` during concurrent runs. The last machine run below is against the final code.

Pre-fix: `node --test machine/test/shared-tools.test.js`

```text
exit 1
TAP version 13
# Subtest: finds first matching repository and skips missing and unrelated candidates
ok 1 - finds first matching repository and skips missing and unrelated candidates
  ---
  duration_ms: 80.864883
  type: 'test'
  ...
# Subtest: refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
ok 2 - refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
  ---
  duration_ms: 254.119402
  type: 'test'
  ...
# Subtest: concurrent refreshes share one fetch, and deadline kills a stalled process
not ok 3 - concurrent refreshes share one fetch, and deadline kills a stalled process
  ---
  duration_ms: 3101.108041
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:53:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /git fetch timed out after 2 s/. Input:
    
    'git timed out'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: 'git timed out'
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:63:50)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: failed copy extraction leaves pointer and no temporary folder
ok 4 - failed copy extraction leaves pointer and no temporary folder
  ---
  duration_ms: 144.287764
  type: 'test'
  ...
# Subtest: a waiting caller has its own deadline and stale temporary copies are removed
not ok 5 - a waiting caller has its own deadline and stale temporary copies are removed
  ---
  duration_ms: 1317.108174
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:76:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + null
    - 'refresh was still running at the deadline'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'refresh was still running at the deadline'
  actual: ~
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:88:12)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: a commit without tools produces an empty copy
ok 6 - a commit without tools produces an empty copy
  ---
  duration_ms: 98.375579
  type: 'test'
  ...
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
not ok 7 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 208.494267
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:102:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + 'git failed: network broke second line'
    - 'git fetch failed: network broke'
            ^
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'git fetch failed: network broke'
  actual: 'git failed: network broke second line'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:116:12)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: cleanup cannot remove a copy before its refresh publishes the pointer
not ok 8 - cleanup cannot remove a copy before its refresh publishes the pointer
  ---
  duration_ms: 136.341643
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:124:1'
  failureType: 'testCodeFailure'
  error: "ENOENT: no such file or directory, stat '/tmp/wheelchair-test-run-606523-tdL0DB/shared-rhjMtA/state/shared-tools/1aece6d5bdde0f39c69da98cd23d4d22835254b81f33cbaac30b55c063ffd22f/1aa8d992046c8a1eaef7e26c0fc956d3fab4cd1f'"
  code: 'ENOENT'
  stack: |-
    async Object.stat (node:internal/fs/promises:1037:18)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:133:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: origin lookup honors insteadOf and identity errors are clear
not ok 9 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 57.675644
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:137:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + null
    - '/tmp/wheelchair-test-run-606523-tdL0DB/shared-g2bIQj/clone'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: '/tmp/wheelchair-test-run-606523-tdL0DB/shared-g2bIQj/clone'
  actual: ~
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:142:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..9
# tests 9
# suites 0
# pass 4
# fail 5
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6760.433753
```

Fixture correction: `node --test machine/test/shared-tools.test.js`

```text
exit 1
TAP version 13
# Subtest: finds first matching repository and skips missing and unrelated candidates
ok 1 - finds first matching repository and skips missing and unrelated candidates
  ---
  duration_ms: 88.073941
  type: 'test'
  ...
# Subtest: refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
ok 2 - refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
  ---
  duration_ms: 274.383521
  type: 'test'
  ...
# Subtest: concurrent refreshes share one fetch, and deadline kills a stalled process
ok 3 - concurrent refreshes share one fetch, and deadline kills a stalled process
  ---
  duration_ms: 3102.082589
  type: 'test'
  ...
# Subtest: failed copy extraction leaves pointer and no temporary folder
ok 4 - failed copy extraction leaves pointer and no temporary folder
  ---
  duration_ms: 143.995081
  type: 'test'
  ...
# Subtest: a waiting caller has its own deadline and stale temporary copies are removed
ok 5 - a waiting caller has its own deadline and stale temporary copies are removed
  ---
  duration_ms: 3115.763459
  type: 'test'
  ...
# Subtest: a commit without tools produces an empty copy
ok 6 - a commit without tools produces an empty copy
  ---
  duration_ms: 104.445882
  type: 'test'
  ...
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
not ok 7 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 90.116766
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:102:1'
  failureType: 'testCodeFailure'
  error: "ENOENT: no such file or directory, scandir '/tmp/wheelchair-test-run-615574-pGq95H/shared-z6qASX/clone/.git/refs/wheelchair/shared-tools'"
  code: 'ENOENT'
  stack: |-
    async Object.readdir (node:internal/fs/promises:955:18)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/shared-tools.test.js:120:23)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: cleanup cannot remove a copy before its refresh publishes the pointer
ok 8 - cleanup cannot remove a copy before its refresh publishes the pointer
  ---
  duration_ms: 150.760008
  type: 'test'
  ...
# Subtest: origin lookup honors insteadOf and identity errors are clear
ok 9 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 62.582669
  type: 'test'
  ...
1..9
# tests 9
# suites 0
# pass 8
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7197.681344
```

Final: `node --test machine/test/shared-tools.test.js`

```text
exit 0
TAP version 13
# Subtest: finds first matching repository and skips missing and unrelated candidates
ok 1 - finds first matching repository and skips missing and unrelated candidates
  ---
  duration_ms: 132.505857
  type: 'test'
  ...
# Subtest: refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
ok 2 - refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies
  ---
  duration_ms: 367.172284
  type: 'test'
  ...
# Subtest: concurrent refreshes share one fetch, and deadline kills a stalled process
ok 3 - concurrent refreshes share one fetch, and deadline kills a stalled process
  ---
  duration_ms: 3133.097977
  type: 'test'
  ...
# Subtest: failed copy extraction leaves pointer and no temporary folder
ok 4 - failed copy extraction leaves pointer and no temporary folder
  ---
  duration_ms: 167.446618
  type: 'test'
  ...
# Subtest: a waiting caller has its own deadline and stale temporary copies are removed
ok 5 - a waiting caller has its own deadline and stale temporary copies are removed
  ---
  duration_ms: 3131.574556
  type: 'test'
  ...
# Subtest: a commit without tools produces an empty copy
ok 6 - a commit without tools produces an empty copy
  ---
  duration_ms: 124.47459
  type: 'test'
  ...
# Subtest: failed fetch removes private refs and stale locks, and disables automatic maintenance
ok 7 - failed fetch removes private refs and stale locks, and disables automatic maintenance
  ---
  duration_ms: 98.371404
  type: 'test'
  ...
# Subtest: cleanup cannot remove a copy before its refresh publishes the pointer
ok 8 - cleanup cannot remove a copy before its refresh publishes the pointer
  ---
  duration_ms: 179.528095
  type: 'test'
  ...
# Subtest: origin lookup honors insteadOf and identity errors are clear
ok 9 - origin lookup honors insteadOf and identity errors are clear
  ---
  duration_ms: 77.331896
  type: 'test'
  ...
# Subtest: a waiter does not overwrite a newer recorded outcome
ok 10 - a waiter does not overwrite a newer recorded outcome
  ---
  duration_ms: 2144.816551
  type: 'test'
  ...
# Subtest: refresh failure messages name the step and fit on one short line
ok 11 - refresh failure messages name the step and fit on one short line
  ---
  duration_ms: 61.507022
  type: 'test'
  ...
# Subtest: a copy publication failure names its step
ok 12 - a copy publication failure names its step
  ---
  duration_ms: 86.337892
  type: 'test'
  ...
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9802.880046
```

Intermediate machine run 1: `bash machine/test/run.sh` (exit and final 80 lines)

```text
exit 0
ok 774 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 557.898625
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 775 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 825.718048
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 776 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 1111.494903
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 777 - tracker close callback marks the copy used
  ---
  duration_ms: 445.618337
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 778 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 780.12651
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 779 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 941.884014
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 780 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 534.070251
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 781 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.985269
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 782 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 6.78732
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 783 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 817.364877
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 784 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 479.07207
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 785 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 792.618002
  type: 'test'
  ...
1..785
# tests 785
# suites 0
# pass 783
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 333801.552318
```

Intermediate machine run 2: `bash machine/test/run.sh` (exit and final 80 lines)

```text
exit 1
ok 776 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 535.581689
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 777 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 842.938909
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 778 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 1134.164587
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 779 - tracker close callback marks the copy used
  ---
  duration_ms: 438.559643
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 780 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 814.164334
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 781 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 924.954527
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 782 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 538.151668
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 783 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 1.060551
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 784 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 6.433718
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 785 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 801.56675
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 786 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 475.734785
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 787 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 776.411931
  type: 'test'
  ...
1..787
# tests 787
# suites 0
# pass 784
# fail 1
# cancelled 0
# skipped 2
# todo 0
# duration_ms 330958.316847
```

Failure details:

```text
not ok 430 - hook posts a turn-ended event
  ---
  duration_ms: 70.087048
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w6/machine/test/service.test.js:236:1'
  failureType: 'testCodeFailure'
  error: 'listen EADDRINUSE: address already in use 127.0.0.1:41003'
  code: 'EADDRINUSE'
  stack: |-
    Server.setupListenHandle [as _listen2] (node:net:1941:16)
    listenInCluster (node:net:1998:12)
    node:net:2207:7
    process.processTicksAndRejections (node:internal/process/task_queues:89:21)
```

Intermediate machine run 3: `bash machine/test/run.sh` (exit and final 80 lines)

```text
exit 0
ok 777 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 674.756671
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 778 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 1096.440572
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 779 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 1517.123009
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 780 - tracker close callback marks the copy used
  ---
  duration_ms: 626.022009
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 781 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 1012.540189
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 782 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 1146.339712
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 783 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 636.557529
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 784 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.836772
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 785 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 7.055439
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 786 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 939.718577
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 787 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 550.796323
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 788 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 969.920752
  type: 'test'
  ...
1..788
# tests 788
# suites 0
# pass 786
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 317813.64467
```

Final: `bash machine/test/run.sh` (exit and final 80 lines)

```text
exit 0
ok 777 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 629.774243
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 778 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 1046.454365
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 779 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 1468.995934
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 780 - tracker close callback marks the copy used
  ---
  duration_ms: 599.187087
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 781 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 979.128361
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 782 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 1114.801564
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 783 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 623.640297
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 784 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 1.046945
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 785 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 6.594037
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 786 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 967.059787
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 787 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 628.503261
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 788 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 992.581333
  type: 'test'
  ...
1..788
# tests 788
# suites 0
# pass 786
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 301997.963487
```
