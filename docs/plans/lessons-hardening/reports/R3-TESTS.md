# R3-TESTS report

Changed files:
- `viewer/test/app-lessons-history.test.js`: assert Settings removal appends the immediately preceding text as a user version; exercise oldest and middle versions for a current lesson and oldest for a removed lesson, with no additions or waiting entries.
- `docs/plans/lessons-hardening/reports/R3-TESTS.md`: this report.

Both application mutations were restored with `git checkout -- viewer/app/...`; neither is committed. The removal mutation sets only the marker and also triggers an unrelated 500 in an existing test when no history entry exists. The new assertion independently fails on the missing version count.

## Mutation: removal marker without snapshot

`node --test test/app-lessons-history.test.js test/app-lessons.test.js` (from viewer; exit 1):

```text
not ok 5 - user edits and removals, capacity, and history matching
  ---
  duration_ms: 132.796339
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w11/viewer/test/app-lessons-history.test.js:84:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    1 !== 2
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 2
  actual: 1
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w11/viewer/test/app-lessons-history.test.js:94:12)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
  ...
1..18
# tests 18
# suites 0
# pass 16
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1143.597055
```

## Mutation: match only the newest history version

`node --test test/app-lessons-history.test.js test/app-lessons.test.js` (from viewer; exit 1):

```text
not ok 6 - merge skips older versions of current and removed lessons
  ---
  duration_ms: 14.521966
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w11/viewer/test/app-lessons-history.test.js:106:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
    +   added: 3,
    -   added: 0,
        invalid: 0,
    +   skipped: 0,
    -   skipped: 3,
        unknown_project: 0,
        waiting: 0
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    added: 0
    skipped: 3
    invalid: 0
    unknown_project: 0
    waiting: 0
  actual:
    added: 3
    skipped: 0
    invalid: 0
    unknown_project: 0
    waiting: 0
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w11/viewer/test/app-lessons-history.test.js:115:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
  ...
1..18
# tests 18
# suites 0
# pass 17
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1134.095165
```

## Restored validation

`node --test test/app-lessons-history.test.js test/app-lessons.test.js` (from viewer; exit 0):

```text
  ---
  duration_ms: 14.341828
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-fdc43f4b5fde.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 18 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 210.213151
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
# duration_ms 988.768287
```

`npm test` (from viewer; exit 0):

```text
ok 829 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 179.417382
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 830 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 69.328731
  type: 'test'
  ...
1..830
# tests 846
# suites 0
# pass 846
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 96600.717932
```

## Choices

- `viewer/test/app-lessons-history.test.js`: used agent replacements to create three distinct history versions and merged all three older matches together; compared the entire lessons and waiting collections before and after.
