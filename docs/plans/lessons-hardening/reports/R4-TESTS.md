# R4-TESTS — partial result

Changed `viewer/test/app-lessons-history.test.js`: the two caps now compare the exact survivors; the removal fixture assigns increasing timestamps; identical restore compares deep snapshots; the repeated merge and overflow check compare the returned counts and actual records. No application change is retained.

The S9 audit is **not complete**. In particular, these pre-existing checks remain weaker than the requested exact-outcome standard: the added and scoped merge records, all fields of normalized history and waiting, restored removed lesson and capacity refusal state, Add rechecking key and capacity, and user edit/removal state. They need stronger fixtures and mutation runs before this task can be considered done. The following inventory names the relevant tests and current assertions; except as specified below, mutations were not tried and are meaningful. Handoff-specific S9 items are covered in other files outside this task's scope.

- Agent replace, scope-only replace, restore by vid, restore thread, saved_by, identical retry, Keep, 409, stale boundary and normalization: `agent changes, restore, keep and normalization retain history` checks changed_by/text, restored thread/saved_by, full retry snapshots, 409 and stale booleans; normalization checks existence and invalid absence, not full retained data. The timestamp mutation below targets the retry.
- Keep/staleness: `Keep clears staleness without changing the saved lesson or history` checks timestamps, saved_by, empty history and stale status; it does not deep-compare the full lesson.
- Caps, agent removal, removed restore, match/skip/add/waiting/invalid/retry, overflow, capacity and Discard: `history caps, removals, merge and waiting` checks exact cap survivors, removal attribution, restored text, merge counts and retry snapshot, 72 waiting identities, prior waiting entries and status/results. It does not fully compare all add and removal state; four mutations are shown below.
- File round trip, refusal, known project and handoff project: `handoff projects and file routes` checks exported format, imported named fields, dropped thread, kept_at, counts, and refusal status, but not the complete exported object or all state.
- User edit/removal, full restore refusal, prompt unchanged, waiting Add: `user edits and removals, capacity, and history matching` checks old text and changed_by, removal append and marker, 422, exact prompt equality and Add result. Full state after refusal and Add is not compared.
- Older history match: `merge skips older versions of current and removed lessons` checks exact counts and unchanged lessons and waiting, but does not snapshot history.
- Known/unknown project import, waiting Add duplicate/gone wid, normalize kept_at/waiting: `file limits, known directories, waiting recheck and normalization` checks counts, project, status and action results; remaining records and exact normalized waiting are not pinned.
- New id and distinct project scopes: `new ids avoid removed history and different project scopes remain distinct` checks the exact generated id and only the added count for the scoped records.
- Gone Discard wid: `history caps, removals, merge and waiting` checks 409 after discarding; gone Add wid is in the file-limits test.

## Mutation runs

Each used `node --test test/app-lessons-history.test.js test/app-lessons.test.js` from `viewer/`, followed by `git checkout -- viewer/app/` and the same command again. Outputs below are excerpts from the actual logs.

### Drop second-oldest history version

Mutation: `exit 1`

```text
not ok 3 - history caps, removals, merge and waiting
  ---
  duration_ms: 19.51625
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w12/viewer/test/app-lessons-history.test.js:42:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
    +   'First',
    -   'Edit 2',
        'Edit 3',
        'Edit 4',
        'Edit 5',
        'Edit 6',
        'Edit 7',
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
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
# duration_ms 803.943661
```

Restored: `exit 0`

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
# duration_ms 819.132912
```

### Evict newest removed record

Mutation: `exit 1`

```text
not ok 3 - history caps, removals, merge and waiting
  ---
  duration_ms: 120.969335
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w12/viewer/test/app-lessons-history.test.js:42:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    ... Skipped lines
    
      [
        'L0b21f3',
        'L0f8390',
        'L10ab70',
    -   'L119b39',
        'L130d1b',
        'L132f2e',
        'L1d7fe9',
        'L1e4c01',
        'L21b1db',
    ...
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
# duration_ms 816.182622
```

Restored: `exit 0`

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
# duration_ms 795.844636
```

### Rewrite saved_at on identical restore

Mutation: `exit 1`

```text
not ok 1 - agent changes, restore, keep and normalization retain history
  ---
  duration_ms: 37.367916
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w12/viewer/test/app-lessons-history.test.js:13:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'Lef8d9a',
    +   saved_at: '2026-11-22T07:34:21.875Z',
    -   saved_at: '2026-11-22T07:34:21.868Z',
        saved_by: 'user',
        text: 'First',
        thread: 'thread-old'
      }
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
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
# duration_ms 790.359283
```

Restored: `exit 0`

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
# duration_ms 794.975936
```

### Corrupt incoming waiting text

Mutation: `exit 1`

```text
not ok 3 - history caps, removals, merge and waiting
  ---
  duration_ms: 145.824563
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w12/viewer/test/app-lessons-history.test.js:42:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
        {
          role: 'lead',
          saved_at: '1970-01-01T00:00:00.000Z',
          saved_by: 'agent',
          source: 'file',
    +     text: 'wrong'
    -     text: 'Incoming 0'
        },
        {
    -     role: 'lead',
    -     saved_at: '1970-01-01T00:00:00.000Z',
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
# duration_ms 838.065669
```

Restored: `exit 0`

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
# duration_ms 886.938737
```

## Validation

Focused command, final test file: `node --test test/app-lessons-history.test.js test/app-lessons.test.js` (exit 0)

```text
  ---
  duration_ms: 16.927284
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-1b82f9f2bea3.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 18 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 203.91295
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
# duration_ms 1037.659455
```

Full suite: `npm test` (exit 0)

```text
ok 819 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 65.449186
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 820 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 63.622171
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 821 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 65.345047
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 822 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 61.016625
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 823 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 54.685474
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 824 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 62.627685
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 825 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 61.636334
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 826 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 67.190855
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 827 - unknown win op fails without sending a request
  ---
  duration_ms: 48.704384
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 828 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.692759
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 829 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 53.952348
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 830 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 50.019716
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
# duration_ms 58662.510255
```

## Files changed

- `viewer/test/app-lessons-history.test.js`
- `docs/plans/lessons-hardening/reports/R4-TESTS.md`

## Choices

- `viewer/test/app-lessons-history.test.js`: seeded the first 50 removal timestamps at one-second increments from the epoch, ensuring the actual 51st removal is newest.
- `viewer/test/app-lessons-history.test.js`: waited 5 ms before the repeated restore so a mutation setting `saved_at` to now is observable.
- `viewer/test/app-lessons-history.test.js`: compared the 72 waiting entries in input order by role, text, saved_by, saved_at and source; random ids and receipt timestamps are not predetermined.
