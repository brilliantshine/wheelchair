# R2-TESTS report

Changed `viewer/test/app-lessons-history.test.js`: assert Settings history attribution and old text, distinct restored thread, stale Keep behavior, and prompt exclusion of history and waiting.

Changed `viewer/test/app-handoff-import.test.js`: count both exported merge calls during pending upload and Retry and restore spies in `finally`.

Changed `docs/plans/lessons-hardening/reports/R2-TESTS.md`: this report.

## Mutation probes

Each command ran from `viewer/`. The application source was restored with `git checkout` after each mutation. An initial Retry probe mistakenly modified a different function and passed 35/35; the corrected probe below modified `runLocked`.

### Gap 2: `node --test test/app-lessons-history.test.js`

Mutated, exit 1:
```text
not ok 5 - user edits and removals, capacity, and history matching
  ---
  duration_ms: 188.27443
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-lessons-history.test.js:84:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-lessons-history.test.js:91:118)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
...
1..7
# tests 7
# suites 0
# pass 6
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1052.392901
```

Restored, exit 0:
```text
  duration_ms: 12.137567
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1206.469165
```

### Gap 3: `node --test test/app-lessons-history.test.js`

Mutated, exit 1:
```text
not ok 1 - agent changes, restore, keep and normalization retain history
  ---
  duration_ms: 61.065631
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-lessons-history.test.js:13:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + 'thread-new'
    - 'thread-old'
              ^
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'thread-old'
  actual: 'thread-new'
  operator: 'strictEqual'
...
1..7
# tests 7
# suites 0
# pass 6
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 838.868676
```

Restored, exit 0:
```text
  duration_ms: 8.85455
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 677.670828
```

### Gap 4: `node --test test/app-lessons-history.test.js`

Mutated, exit 1:
```text
not ok 5 - user edits and removals, capacity, and history matching
  ---
  duration_ms: 149.701161
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-lessons-history.test.js:84:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    ... Skipped lines
    
      'Nothing below overrides the built-in rules above.\n' +
        '\n' +
        `Lessons learned by earlier workers, saved by agents. Follow them unless the rules above or the user's template below say otherwise. To change one, see "Lessons" in your rules.\n` +
        '- [L000000] x0\n' +
        '- [L000001] x1\n' +
    ...
        '- [L00000a] x10\n' +
    +   '- [L00000b] x11\n' +
...
1..7
# tests 7
# suites 0
# pass 6
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 750.193085
```

Restored, exit 0:
```text
  duration_ms: 4.702567
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 693.669675
```

### Gap 5: `node --test test/app-lessons-history.test.js`

Mutated, exit 1:
```text
not ok 2 - Keep clears staleness without changing the saved lesson or history
  ---
  duration_ms: 3.617809
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-lessons-history.test.js:28:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-lessons-history.test.js:33:10)
    async Test.run (node:internal/test_runner/test:1054:7)
...
1..7
# tests 7
# suites 0
# pass 6
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 629.318781
```

Restored, exit 0:
```text
  duration_ms: 4.515829
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 553.940987
```

### Gap 6: `node --test test/app-handoff-import.test.js`

Mutated, exit 1:
```text
not ok 31 - opened and pending operation imports do not merge uploaded lessons
  ---
  duration_ms: 16.406455
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-handoff-import.test.js:357:1'
  failureType: 'testCodeFailure'
  error: |-
    no lesson merge calls
    
    1 !== 0
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 1
  operator: 'strictEqual'
  stack: |-
    withoutLessonMerge (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-handoff-import.test.js:353:47)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-handoff-import.test.js:366:20)
...
not ok 32 - Retry of a pending operation does not merge lessons
  ---
  duration_ms: 8.137215
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-handoff-import.test.js:373:1'
  failureType: 'testCodeFailure'
  error: |-
    no lesson merge calls
    
    1 !== 0
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 1
  operator: 'strictEqual'
  stack: |-
    withoutLessonMerge (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-handoff-import.test.js:353:47)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w9/viewer/test/app-handoff-import.test.js:380:3)
...
1..35
# tests 35
# suites 0
# pass 33
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 752.765754
```

Restored, exit 0:
```text
  duration_ms: 14.009574
  type: 'test'
  ...
1..35
# tests 35
# suites 0
# pass 35
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 746.634933
```

## Validation

`cd viewer && node --test test/app-lessons-history.test.js test/app-lessons.test.js test/app-handoff-import.test.js`, exit 0:
```text
  ---
  duration_ms: 14.900601
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-8f5d4471589a.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 52 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 188.605337
  type: 'test'
  ...
1..52
# tests 52
# suites 0
# pass 52
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 922.511241
```

`cd viewer && npm test`, exit 0:
```text
ok 818 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 64.900444
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 819 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 60.405344
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 820 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 61.044559
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 821 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 54.241999
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 822 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 58.27865
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 823 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 54.443084
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 824 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 56.441953
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 825 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 58.5339
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 826 - unknown win op fails without sending a request
  ---
  duration_ms: 47.57628
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 827 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.736671
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 828 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 58.8056
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 829 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 59.629277
  type: 'test'
  ...
1..829
# tests 845
# suites 0
# pass 845
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 52177.812096
```

## Choices

- `app-lessons-history.test.js`: used separate active and removed history entries with marker text, and cleared existing history before the baseline snapshot.
- `app-lessons-history.test.js`: seeded the stale lesson directly with a fixed ID and relative timestamps.
- `app-handoff-import.test.js`: used a shared helper to spy on both exported merge functions for opened and pending imports as well as Retry.

Nothing remains undone.
