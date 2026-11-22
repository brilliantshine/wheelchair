# R4-AUDIT

Strengthened exact-state assertions in `viewer/test/app-lessons-history.test.js` for merge adds and scopes, normalization, restore, refusal, waiting Add and user edits. No application mutation is retained.

## Mutation checks

Each run used `node --test test/app-lessons-history.test.js test/app-lessons.test.js` from `viewer/`; the application was restored with `git checkout -- viewer/app/` after each.

### 1. Drop provider in addIncoming

Mutation: exit 1

```text
not ok 3 - history caps, removals, merge and waiting
  ---
  duration_ms: 524.116081
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:42:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
    -   provider: 'gpt',
        saved_at: '1970-01-01T00:00:00.000Z',
        saved_by: 'agent',
        text: 'Fresh'
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    text: 'Fresh'
    saved_by: 'agent'
    saved_at: '1970-01-01T00:00:00.000Z'
    provider: 'gpt'
  actual:
    text: 'Fresh'
    saved_by: 'agent'
    saved_at: '1970-01-01T00:00:00.000Z'
  operator: 'deepStrictEqual'
  stack: |-
not ok 4 - handoff projects and file routes
  ---
  duration_ms: 376.71958
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:74:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    undefined !== 'gpt'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'gpt'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:91:91)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: user edits and removals, capacity, and history matching
ok 5 - user edits and removals, capacity, and history matching
  ---
  duration_ms: 437.408255
  type: 'test'
  ...
# Subtest: merge skips older versions of current and removed lessons
ok 6 - merge skips older versions of current and removed lessons
  ---
  duration_ms: 51.828147
  ...
1..18
# tests 18
# suites 0
# pass 16
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2434.52582
```

Restored: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2390.79772
```

### 2. Ignore project in matchKey

Mutation: exit 1

```text
not ok 8 - new ids avoid removed history and different project scopes remain distinct
  ---
  duration_ms: 20.780845
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:156:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
        {
          project: '/a',
          saved_at: '1970-01-01T00:00:00.000Z',
          saved_by: 'agent',
          text: 'scoped'
        },
    -   {
    -     project: '/b',
    -     saved_at: '1970-01-01T00:00:00.000Z',
    -     saved_by: 'agent',
    -     text: 'scoped'
    -   }
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0:
      text: 'scoped'
  ...
1..18
# tests 18
# suites 0
# pass 17
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2544.959248
```

Restored: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1913.093053
```

### 3. Drop thread in fields

Mutation: exit 1

```text
not ok 1 - agent changes, restore, keep and normalization retain history
  ---
  duration_ms: 29.525944
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:13:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + undefined
    - 'thread-old'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'thread-old'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:20:62)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: Keep clears staleness without changing the saved lesson or history
ok 2 - Keep clears staleness without changing the saved lesson or history
  ---
  duration_ms: 4.716463
  type: 'test'
  ...
# Subtest: history caps, removals, merge and waiting
not ok 3 - history caps, removals, merge and waiting
not ok 3 - history caps, removals, merge and waiting
  ---
  duration_ms: 19.846846
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:42:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'La3410f',
        saved_by: 'user',
        text: 'Edit 22',
    -   thread: undefined
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    id: 'La3410f'
    text: 'Edit 22'
    saved_by: 'user'
  actual:
    id: 'La3410f'
    text: 'Edit 22'
    saved_by: 'user'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:51:10)
not ok 7 - file limits, known directories, waiting recheck and normalization
  ---
  duration_ms: 110.373024
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:140:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    ... Skipped lines
    
      [
        {
          project: '/saved',
          provider: 'gpt',
          received_at: '1970-01-01T00:00:00.000Z',
    ...
          text: 'wait',
    -     thread: 'thread-wait',
          wid: 'one'
        }
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0:
      role: 'worker'
      text: 'wait'
      saved_by: 'agent'
  ...
1..18
# tests 18
# suites 0
# pass 15
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 820.257815
```

Restored: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 839.117928
```

### 4. Do not delete entry.removed

Mutation: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 850.857116
```

Restored: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 918.641768
```

The mutation survives: normalization removes a removal marker whenever the lesson is current (`settings.js:295`), so the requested observable state is correct even without the explicit delete.

### 5. Remove waiting entry before capacity check

Mutation: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 862.285989
```

Restored: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 890.601051
```

The mutation survives: the thrown capacity error aborts the update before its changed state is saved. The persisted snapshots remain equal, as required.

### 6. Keep waiting entry after Add

Mutation: exit 1

```text
not ok 5 - user edits and removals, capacity, and history matching
  ---
  duration_ms: 122.802046
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:99:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    true !== false
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: false
  actual: true
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:124:321)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: merge skips older versions of current and removed lessons
ok 6 - merge skips older versions of current and removed lessons
  ---
  duration_ms: 9.618483
  type: 'test'
  ...
# Subtest: file limits, known directories, waiting recheck and normalization
ok 7 - file limits, known directories, waiting recheck and normalization
  ---
  ...
1..18
# tests 18
# suites 0
# pass 17
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 861.30663
```

Restored: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 855.339397
```

### 7. Do not set saved_by on edit

Mutation: exit 1

```text
not ok 5 - user edits and removals, capacity, and history matching
  ---
  duration_ms: 114.705149
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:99:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'L4429ac',
        saved_at: '2026-11-22T07:40:46.666Z',
    +   saved_by: 'agent',
    -   saved_by: 'user',
        text: 'Changed',
        thread: 't'
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    id: 'L4429ac'
    text: 'Changed'
    saved_by: 'user'
    thread: 't'
    saved_at: '2026-11-22T07:40:46.666Z'
  actual:
    id: 'L4429ac'
    text: 'Changed'
not ok 16 - settings PUT merges edits and removals over HTTP
  ---
  duration_ms: 180.80892
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons.test.js:148:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    'agent' !== 'user'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'user'
  actual: 'agent'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons.test.js:159:12)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: all saver and target pairs enforce the role matrix
ok 17 - all saver and target pairs enforce the role matrix
  ---
  duration_ms: 15.109461
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-b92e8ca9039e.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
  ...
1..18
# tests 18
# suites 0
# pass 16
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 896.69853
```

Restored: exit 0

```text
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 948.419912
```

## Validation

Focused command: `node --test test/app-lessons-history.test.js test/app-lessons.test.js` (exit 0)

```text
  ---
  duration_ms: 174.395578
  type: 'test'
  ...
# Subtest: new ids avoid removed history and different project scopes remain distinct
ok 8 - new ids avoid removed history and different project scopes remain distinct
  ---
  duration_ms: 13.824417
  type: 'test'
  ...
# Subtest: card schema and saver pairs
ok 9 - card schema and saver pairs
  ---
  duration_ms: 106.125426
  type: 'test'
  ...
# Subtest: sub-lead can save a worker lesson for another provider
ok 10 - sub-lead can save a worker lesson for another provider
  ---
  duration_ms: 10.735454
  type: 'test'
  ...
# Subtest: reviewers and verifiers cannot save lessons through the hub
ok 11 - reviewers and verifiers cannot save lessons through the hub
  ---
  duration_ms: 8.43879
  type: 'test'
  ...
# Subtest: scope, repeat safety, replacement, removal and user ownership
ok 12 - scope, repeat safety, replacement, removal and user ownership
  ---
  duration_ms: 93.142513
  type: 'test'
  ...
# Subtest: normalization, cap, prompts and preview
ok 13 - normalization, cap, prompts and preview
  ---
  duration_ms: 32.019315
  type: 'test'
  ...
# Subtest: lead roleLayers keeps reviewer, verifier and mapper blocks
ok 14 - lead roleLayers keeps reviewer, verifier and mapper blocks
  ---
  duration_ms: 0.460984
  type: 'test'
  ...
# Subtest: card.js lesson validation refuses reviewer and missing why
ok 15 - card.js lesson validation refuses reviewer and missing why
  ---
  duration_ms: 0.331265
  type: 'test'
  ...
# Subtest: settings PUT merges edits and removals over HTTP
ok 16 - settings PUT merges edits and removals over HTTP
  ---
  duration_ms: 364.510989
  type: 'test'
  ...
# Subtest: all saver and target pairs enforce the role matrix
ok 17 - all saver and target pairs enforce the role matrix
  ---
  duration_ms: 37.495364
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-ccc675f39068.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 18 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 463.05027
  type: 'test'
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1913.093053
```

Full suite: `npm test` (exit 1). It ran while the final two assertion-order changes and their mutation checks were in progress. The failure was an unrelated port collision.

```text
not ok 582 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 256.062871
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-uploads-archive.test.js:65:1'
  failureType: 'testCodeFailure'
  error: 'listen EADDRINUSE: address already in use 127.0.0.1:45747'
  code: 'EADDRINUSE'
  stack: |-
    Server.setupListenHandle [as _listen2] (node:net:1941:16)
    listenInCluster (node:net:1998:12)
    node:net:2207:7
    process.processTicksAndRejections (node:internal/process/task_queues:89:21)
  ...
ok 819 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 75.50226
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 820 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 63.048199
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 821 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 65.460995
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 822 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 76.97337
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 823 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 83.845567
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 824 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 81.370822
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 825 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 79.664961
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 826 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 94.360668
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 827 - unknown win op fails without sending a request
  ---
  duration_ms: 99.967079
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 828 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 1.479707
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 829 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 109.771428
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 830 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 56.397017
  type: 'test'
  ...
1..830
# tests 846
# suites 0
# pass 845
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 69397.334498
```

Retry: `node --test test/app-uploads-archive.test.js` (exit 0)

```text
TAP version 13
# machine: screen startup cleanup failed: wcscreen-da56a83bf6ed.slice
# machine service listening on 127.0.0.1:33623
# machine: screen teardown failed: wcscreen-da56a83bf6ed-97eb017825eb.slice
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 1 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 8929.307338
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-2de007d95721.slice
# machine service listening on 127.0.0.1:40555
# Subtest: a lead still waiting takes uploads on the real machine
ok 2 - a lead still waiting takes uploads on the real machine
  ---
  duration_ms: 3038.518857
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-cd990247e171.slice
# machine service listening on 127.0.0.1:43919
# Subtest: a lead still starting takes uploads on the real machine
ok 3 - a lead still starting takes uploads on the real machine
  ---
  duration_ms: 3118.151317
  type: 'test'
  ...
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15221.541468
```

Initial focused run: exit 1, caused by the test expecting an absent optional project field as `undefined`; corrected before subsequent passes.

```text
not ok 3 - history caps, removals, merge and waiting
  ---
  duration_ms: 27.921307
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w13/viewer/test/app-lessons-history.test.js:42:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'Lf3096d',
    -   project: undefined,
        saved_by: 'user',
        text: 'Edit 22',
        thread: 'one'
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    id: 'Lf3096d'
    text: 'Edit 22'
    thread: 'one'
    saved_by: 'user'
  actual:
    id: 'Lf3096d'
    text: 'Edit 22'
    saved_by: 'user'
    thread: 'one'
  operator: 'deepStrictEqual'
  ...
1..18
# tests 18
# suites 0
# pass 17
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1087.610448
```

## Files changed

- `viewer/test/app-lessons-history.test.js`
- `docs/plans/lessons-hardening/reports/R4-AUDIT.md`

## Choices

- `viewer/test/app-lessons-history.test.js`: waited 5 ms before the edit to make the later saved timestamp observable.
- `viewer/test/app-lessons-history.test.js`: compared scoped incoming lessons in insertion order, excluding generated fields.
