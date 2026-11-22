# R5-TESTS

Changed `viewer/test/app-lessons-history.test.js` to assert agent removal history, repeated Waiting merges, Add already cleanup and no duplicate, and trimmed matching. No application changes remain.

## Mutation checks

Each command was `node --test test/app-lessons-history.test.js` from `viewer/`. Each mutation was restored with `git checkout -- viewer/app/` before the passing run.

### Agent removal skips snapshot when history exists

```text
exit 1
not ok 3 - agent removal appends the current text to existing history
  ---
  duration_ms: 7.798121
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:42:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:49:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..11
# tests 11
# suites 0
# pass 10
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 771.65669
```

Restored: `ok 3 - agent removal appends the current text to existing history`; exit 0, 11 passed, 0 failed.

### Remove Waiting match clause

```text
exit 1
not ok 4 - a second merge skips a lesson already waiting
  ---
  duration_ms: 4.816033
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:51:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        added: 0,
        invalid: 0,
    +   skipped: 0,
    -   skipped: 1,
        unknown_project: 0,
    +   waiting: 1
    -   waiting: 0
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    added: 0
    skipped: 1
    invalid: 0
    unknown_project: 0
    waiting: 0
  actual:
    added: 0
    skipped: 0
    invalid: 0
    unknown_project: 0
    waiting: 1
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:57:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..11
# tests 11
# suites 0
# pass 10
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 643.178474
```

Restored: `ok 4 - a second merge skips a lesson already waiting`; exit 0, 11 passed, 0 failed.

### Keep Waiting entry on already

```text
exit 1
not ok 10 - file limits, known directories, waiting recheck and normalization
  ---
  duration_ms: 121.56445
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:163:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:174:50)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..11
# tests 11
# suites 0
# pass 10
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 699.496153
```

Restored: `ok 10 - file limits, known directories, waiting recheck and normalization`; exit 0, 11 passed, 0 failed.

### Add duplicate on already

```text
exit 1
not ok 10 - file limits, known directories, waiting recheck and normalization
  ---
  duration_ms: 111.273199
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:163:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    ...
1..11
# tests 11
# suites 0
# pass 10
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 656.194476
```

Restored: `ok 10 - file limits, known directories, waiting recheck and normalization`; exit 0, 11 passed, 0 failed.

### Remove trim from match key

```text
exit 1
not ok 5 - merge matches trimmed text in the same scope
  ---
  duration_ms: 4.086775
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:60:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    0 !== 1
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 1
  actual: 0
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w14/viewer/test/app-lessons-history.test.js:63:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..11
# tests 11
# suites 0
# pass 10
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 676.549118
```

Restored: `ok 5 - merge matches trimmed text in the same scope`; exit 0, 11 passed, 0 failed.

## Validation

### `node --test test/app-lessons-history.test.js test/app-lessons.test.js`

```text
exit 0
  ---
  duration_ms: 234.483964
  type: 'test'
  ...
# Subtest: new ids avoid removed history and different project scopes remain distinct
ok 11 - new ids avoid removed history and different project scopes remain distinct
  ---
  duration_ms: 26.970457
  type: 'test'
  ...
# Subtest: card schema and saver pairs
ok 12 - card schema and saver pairs
  ---
  duration_ms: 37.704456
  type: 'test'
  ...
# Subtest: sub-lead can save a worker lesson for another provider
ok 13 - sub-lead can save a worker lesson for another provider
  ---
  duration_ms: 6.564125
  type: 'test'
  ...
# Subtest: reviewers and verifiers cannot save lessons through the hub
ok 14 - reviewers and verifiers cannot save lessons through the hub
  ---
  duration_ms: 3.718599
  type: 'test'
  ...
# Subtest: scope, repeat safety, replacement, removal and user ownership
ok 15 - scope, repeat safety, replacement, removal and user ownership
  ---
  duration_ms: 73.83815
  type: 'test'
  ...
# Subtest: normalization, cap, prompts and preview
ok 16 - normalization, cap, prompts and preview
  ---
  duration_ms: 30.154682
  type: 'test'
  ...
# Subtest: lead roleLayers keeps reviewer, verifier and mapper blocks
ok 17 - lead roleLayers keeps reviewer, verifier and mapper blocks
  ---
  duration_ms: 0.467526
  type: 'test'
  ...
# Subtest: card.js lesson validation refuses reviewer and missing why
ok 18 - card.js lesson validation refuses reviewer and missing why
  ---
  duration_ms: 0.424904
  type: 'test'
  ...
# Subtest: settings PUT merges edits and removals over HTTP
ok 19 - settings PUT merges edits and removals over HTTP
  ---
  duration_ms: 450.07095
  type: 'test'
  ...
# Subtest: all saver and target pairs enforce the role matrix
ok 20 - all saver and target pairs enforce the role matrix
  ---
  duration_ms: 63.397053
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-28911ac27fb9.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 21 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 471.140174
  type: 'test'
  ...
1..21
# tests 21
# suites 0
# pass 21
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1943.58396
```

### `npm test`

```text
exit 0
ok 822 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 72.322894
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 823 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 60.785075
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 824 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 83.432172
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 825 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 65.3412
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 826 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 57.590592
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 827 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 71.984435
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 828 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 64.792538
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 829 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 70.455825
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 830 - unknown win op fails without sending a request
  ---
  duration_ms: 52.210125
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 831 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.776128
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 832 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 59.654157
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 833 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 73.183705
  type: 'test'
  ...
1..833
# tests 849
# suites 0
# pass 849
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 58752.94659
```

## Files changed

- `viewer/test/app-lessons-history.test.js`
- `docs/plans/lessons-hardening/reports/R5-TESTS.md`

## Choices

- `app-lessons-history.test.js`: used separate focused tests for removal, Waiting retry, and trimmed matching, and extended the existing Add recheck test.
- `app-lessons-history.test.js`: filled Waiting retry capacity with deterministic IDs and unscoped lessons; used the existing project-scoped fixture for Add already.

Nothing remained undone.
