# T4b report — blocked

The same hub test gate failed twice, so I stopped under the brief's fail-twice rule. This is partial work and has not passed validation.

- `machine/service.js:986` excludes records with `ended_at` or terminal `ended`, `stopped`, or `failed` statuses from shared-copy pins. This change is untested; tests for live, recovering and terminal records remain to be written.
- `viewer/test/app-shared-tools-setting.test.js:43` sends complete machine-shaped project-tools state and includes a subsequent clean ready event. The test has not reached the clean-event assertions.
- The event route at `viewer/app/routes.js:531` returns 202 for a newly accepted event and 200 only for a duplicate; `viewer/test/helpers/app.js:66` posts the event directly. The first run incorrectly expected 200 and received 202. After changing the expectation to 202, the second run failed at line 52: `saved.cards` was undefined, so `.some` raised a TypeError. The response shape and any needed fix remain uninvestigated because the stop rule applied.

The launch matrix, mutation checks, full requested validation, and report's case-to-test mapping are unfinished. The existing shared bridge read-only test was already present; I did not rerun it. No test was mutation-tested in this task.

## Choices

- `machine/service.js`: treat `ended_at` and statuses `ended`, `stopped`, and `failed` as terminal for cleanup; retain other statuses, including recovering records. This implements the brief's listed terminal signals and needs coverage.

## Validation

No requested validation command was completed: the stop rule prevented further runs. The following narrower gate was attempted twice, each time captured in a scratch log.

### `node --test viewer/test/app-shared-tools-setting.test.js` — first attempt

Exit 1.

```text
TAP version 13
# Subtest: shared tools setting defaults, validates and saves
ok 1 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 214.34573
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 2 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 1.15883
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 3 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 365.94138
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
not ok 4 - ready event updates folder problem card
  ---
  duration_ms: 219.17884
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-shared-tools-setting.test.js:43:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    202 !== 200
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 200
  actual: 202
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-shared-tools-setting.test.js:50:12)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..4
# tests 4
# suites 0
# pass 3
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 858.371002
```

### `node --test viewer/test/app-shared-tools-setting.test.js` — second attempt

Exit 1.

```text
TAP version 13
# Subtest: shared tools setting defaults, validates and saves
ok 1 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 213.607676
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 2 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 1.174261
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 3 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 365.905252
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
not ok 4 - ready event updates folder problem card
  ---
  duration_ms: 221.659804
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-shared-tools-setting.test.js:43:1'
  failureType: 'testCodeFailure'
  error: "Cannot read properties of undefined (reading 'some')"
  code: 'ERR_TEST_FAILURE'
  name: 'TypeError'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w8/viewer/test/app-shared-tools-setting.test.js:52:27)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..4
# tests 4
# suites 0
# pass 3
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 864.590902
```
