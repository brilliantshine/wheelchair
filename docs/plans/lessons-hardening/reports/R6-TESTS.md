# R6-TESTS

Changed `viewer/test/app-lessons-history.test.js`: added coverage for restore scope and order, collision avoidance, export shape, merge validation and thread handling, waiting actions, normalization and import version. Production mutations were temporary and restored; no real bug was exposed.

## Mutation results

Each mutation ran separately with `node --test test/app-lessons-history.test.js test/app-lessons.test.js` from `viewer/`. The first result precedes the new assertions; the re-run is shown for survivors. The removed-restore order mutation was first run after adding its assertion because its initial replacement matched two sites.

### Restore project from current

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 12 - restore preserves version scope and appends removed lessons
    Expected values to be strictly equal:
    
    undefined !== '/a'
    
```

### Restore provider from current

Before: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'L1d320d',
        provider: 'gpt',
    +   saved_at: '2026-11-22T08:00:19.215Z',
    -   saved_at: '2026-11-22T08:00:19.209Z',
        saved_by: 'user',
        text: 'First',
        thread: 'thread-old'
      }
    
```

Re-run: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'L8f75f2',
        provider: 'gpt',
    +   saved_at: '2026-11-22T08:07:31.686Z',
    -   saved_at: '2026-11-22T08:07:31.679Z',
        saved_by: 'user',
        text: 'First',
        thread: 'thread-old'
      }
    
not ok 12 - restore preserves version scope and appends removed lessons
    Expected values to be strictly equal:
    
    undefined !== 'gpt'
    
```

### Generate import/Waiting IDs without checking history

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 13 - import and Waiting Add avoid removed history ids
    import
    + actual - expected
    
    + 'L123456'
    - 'Labcdef'
    
```

Independent import and Waiting Add re-run after splitting the cases: Caught: exit 1.
```text
not ok 13 - import avoids removed history ids
    import
    + actual - expected
    
    + 'L123456'
    - 'Labcdef'
    
not ok 14 - waiting avoids removed history ids
    waiting
    + actual - expected
    
    + 'L123456'
    - 'Labcdef'
    
```

### Export history and waiting

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 14 - export contains exactly the specified fields
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
    +   'lesson_history',
    +   'lesson_waiting',
        'format',
        'version',
        'exported_at',
        'lessons'
      ]
    
```

### recordHistory marks agent changes as user

Before: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    
    'user' !== 'agent'
    
not ok 3 - agent removal appends the current text to existing history
    Expected values to be strictly equal:
    
    'user' !== 'agent'
    
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly equal:
    
    'user' !== 'agent'
    
```

Re-run: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    
    'user' !== 'agent'
    
not ok 3 - agent removal appends the current text to existing history
    Expected values to be strictly equal:
    
    'user' !== 'agent'
    
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly equal:
    
    'user' !== 'agent'
    
```

### recordHistory omits thread

Before: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    + actual - expected
    
    + undefined
    - 'thread-old'
    
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'L0eefdf',
        saved_by: 'user',
        text: 'Edit 22',
    -   thread: undefined
      }
    
```

Re-run: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    + actual - expected
    
    + undefined
    - 'thread-old'
    
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'L72f1c9',
        saved_by: 'user',
        text: 'Edit 22',
    -   thread: undefined
      }
    
```

### recordHistory reuses a vid

Before: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    
    'agent' !== 'user'
    
not ok 3 - agent removal appends the current text to existing history
    Expected values to be strictly equal:
    
    1 !== 2
    
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
    +   'First'
    -   'Edit 2',
    -   'Edit 3',
    -   'Edit 4',
    -   'Edit 5',
    -   'Edit 6',
    -   'Edit 7',
    -   'Edit 8',
    -   'Edit 9',
    -   'Edit 10',
    -   'Edit 11',
    -   'Edit 12',
    -   'Edit 13',
    -   'Edit 14',
    -   'Edit 15',
    -   'Edit 16',
    -   'Edit 17',
    -   'Edit 18',
    -   'Edit 19',
    -   'Edit 20',
    -   'Edit 21'
      ]
    
not ok 9 - merge skips older versions of current and removed lessons
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
    +   added: 1,
    -   added: 0,
        invalid: 0,
    +   skipped: 2,
    -   skipped: 3,
        unknown_project: 0,
        waiting: 0
      }
    
```

Re-run: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    
    'agent' !== 'user'
    
not ok 3 - agent removal appends the current text to existing history
    Expected values to be strictly equal:
    
    1 !== 2
    
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
    +   'First'
    -   'Edit 2',
    -   'Edit 3',
    -   'Edit 4',
    -   'Edit 5',
    -   'Edit 6',
    -   'Edit 7',
    -   'Edit 8',
    -   'Edit 9',
    -   'Edit 10',
    -   'Edit 11',
    -   'Edit 12',
    -   'Edit 13',
    -   'Edit 14',
    -   'Edit 15',
    -   'Edit 16',
    -   'Edit 17',
    -   'Edit 18',
    -   'Edit 19',
    -   'Edit 20',
    -   'Edit 21'
      ]
    
not ok 9 - merge skips older versions of current and removed lessons
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
    +   added: 1,
    -   added: 0,
        invalid: 0,
    +   skipped: 2,
    -   skipped: 3,
        unknown_project: 0,
        waiting: 0
      }
    
```

### merge match key omits provider

Before: Caught: exit 1.
```text
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
    +   added: 1,
    -   added: 2,
        invalid: 1,
    +   skipped: 2,
    -   skipped: 1,
        unknown_project: 1,
        waiting: 0
      }
    
```

Re-run: Caught: exit 1.
```text
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
    +   added: 1,
    -   added: 2,
        invalid: 1,
    +   skipped: 2,
    -   skipped: 1,
        unknown_project: 1,
        waiting: 0
      }
    
```

### merge skips saved_by validation

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 15 - merge validates authors, handles threads, and fills the twelfth slot
    Expected values to be strictly equal:
    
    0 !== 1
    
```

### merge keeps file thread

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 15 - merge validates authors, handles threads, and fills the twelfth slot
    Expected values to be strictly equal:
    + actual - expected
    
    + 'file-thread'
    - undefined
    
```

### merge drops handoff thread

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 15 - merge validates authors, handles threads, and fills the twelfth slot
    Expected values to be strictly equal:
    + actual - expected
    
    + undefined
    - 'handoff-thread'
    
```

### merge leaves incoming kept_at

Before: Caught: exit 1.
```text
not ok 6 - history caps, removals, merge and waiting
    The expression evaluated to a falsy value:
    
      assert.ok(Number.isFinite(Date.parse(kept_at)) && Date.parse(kept_at) >= mergeTime)
    
not ok 7 - handoff projects and file routes
    The expression evaluated to a falsy value:
    
      assert.ok(lesson.kept_at)
    
```

Re-run: Caught: exit 1.
```text
not ok 6 - history caps, removals, merge and waiting
    The expression evaluated to a falsy value:
    
      assert.ok(Number.isFinite(Date.parse(kept_at)) && Date.parse(kept_at) >= mergeTime)
    
not ok 7 - handoff projects and file routes
    The expression evaluated to a falsy value:
    
      assert.ok(lesson.kept_at)
    
```

### merge waits at 11 lessons

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 15 - merge validates authors, handles threads, and fills the twelfth slot
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
    +   added: 0,
    -   added: 1,
        invalid: 0,
        skipped: 0,
        unknown_project: 0,
    +   waiting: 1
    -   waiting: 0
      }
    
```

### restore keeps version saved_by

Before: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    
    'agent' !== 'user'
    
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'L663109',
    +   saved_by: 'agent',
    -   saved_by: 'user',
        text: 'Edit 22',
        thread: 'one'
      }
    
```

Re-run: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    
    'agent' !== 'user'
    
not ok 6 - history caps, removals, merge and waiting
    Expected values to be strictly deep-equal:
    + actual - expected
    
      {
        id: 'Ld2324f',
    +   saved_by: 'agent',
    -   saved_by: 'user',
        text: 'Edit 22',
        thread: 'one'
      }
    
```

### restore keeps version saved_at

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 12 - restore preserves version scope and appends removed lessons
    Expected "actual" to be strictly unequal to:
    
    '1970-01-01T00:00:00.000Z'
```

### restore inserts removed lesson at start

Before: Not run.

Re-run: Caught: exit 1.
```text
not ok 12 - restore preserves version scope and appends removed lessons
    Expected values to be strictly equal:
    + actual - expected
    
    + 'L100003'
    - 'L100004'
             ^
    
```

### restore skips cap check

Before: Caught: exit 1.
```text
not ok 8 - user edits and removals, capacity, and history matching
    Expected values to be strictly equal:
    
    200 !== 422
    
```

Re-run: Caught: exit 1.
```text
not ok 8 - user edits and removals, capacity, and history matching
    Expected values to be strictly equal:
    
    200 !== 422
    
```

### Keep changes saved_at

Before: Caught: exit 1.
```text
not ok 2 - Keep clears staleness without changing the saved lesson or history
    Expected values to be strictly equal:
    + actual - expected
    
    + '2026-11-22T08:00:35.946Z'
    - '2026-08-14T08:00:35.945Z'
            ^
    
```

Re-run: Caught: exit 1.
```text
not ok 2 - Keep clears staleness without changing the saved lesson or history
    Expected values to be strictly equal:
    + actual - expected
    
    + '2026-11-22T08:07:48.609Z'
    - '2026-08-14T08:07:48.608Z'
            ^
    
```

### Keep appends history

Before: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    
    3 !== 2
    
not ok 2 - Keep clears staleness without changing the saved lesson or history
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + {
    +   L123456: {
    +     role: 'worker',
    +     versions: [
    +       {
    +         changed_at: '2026-11-22T08:00:36.979Z',
    +         changed_by: 'user',
    +         saved_at: '2026-08-14T08:00:36.978Z',
    +         saved_by: 'agent',
    +         text: 'Old lesson',
    +         vid: '5f50d6b4bccbf85f7df7ea842ddd7f81'
    +       }
    +     ]
    +   }
    + }
    - {}
    
```

Re-run: Caught: exit 1.
```text
not ok 1 - agent changes, restore, keep and normalization retain history
    Expected values to be strictly equal:
    
    3 !== 2
    
not ok 2 - Keep clears staleness without changing the saved lesson or history
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + {
    +   L123456: {
    +     role: 'worker',
    +     versions: [
    +       {
    +         changed_at: '2026-11-22T08:07:49.670Z',
    +         changed_by: 'user',
    +         saved_at: '2026-08-14T08:07:49.669Z',
    +         saved_by: 'agent',
    +         text: 'Old lesson',
    +         vid: 'bb69085c072e3f7a5d874f1e43ea13a5'
    +       }
    +     ]
    +   }
    + }
    - {}
    
```

### Discard removes index 0

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 16 - waiting actions select role and id and discard the requested entry
    Expected values to be strictly deep-equal:
    + actual - expected
    
      [
    +   'two'
    -   'one'
      ]
    
```

### Waiting Add ignores role

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 16 - waiting actions select role and id and discard the requested entry
'Missing expected rejection.'
```

### normalize keeps invalid changed_by

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 17 - normalization rejects invalid history authors and waiting sources
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + {
    +   L123456: {
    +     removed: {
    +       at: '1970-01-01T00:00:00.000Z',
    +       by: 'agent'
    +     },
    +     role: 'worker',
    +     versions: [
    +       {
    +         changed_at: '1970-01-01T00:00:00.000Z',
    +         changed_by: 'bad',
    +         saved_at: '1970-01-01T00:00:00.000Z',
    +         saved_by: 'agent',
    +         text: 'Old',
    +         vid: 'v'
    +       }
    +     ]
    +   }
    + }
    - {}
    
```

### normalize keeps unknown waiting source

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 17 - normalization rejects invalid history authors and waiting sources
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + [
    +   {
    +     received_at: '1970-01-01T00:00:00.000Z',
    +     role: 'worker',
    +     saved_at: '1970-01-01T00:00:00.000Z',
    +     saved_by: 'agent',
    +     source: 'bad',
    +     text: 'Waiting',
    +     wid: 'w'
    +   }
    + ]
    - []
    
```

### normalize keeps duplicate waiting key

Before: Caught: exit 1.
```text
not ok 10 - file limits, known directories, waiting recheck and normalization
    Expected values to be strictly deep-equal:
    + actual - expected
    ... Skipped lines
    
      [
        {
          project: '/saved',
          provider: 'gpt',
          received_at: '1970-01-01T00:00:00.000Z',
    ...
        },
    +   {
    +     project: '/saved',
    +     provider: 'gpt',
    +     received_at: '1970-01-01T00:00:00.000Z',
    +     role: 'worker',
    +     saved_at: '1970-01-01T00:00:00.000Z',
    +     saved_by: 'agent',
    +     source: 'file',
    +     text: 'wait',
    +     thread: 'thread-wait',
    +     wid: 'two'
    +   }
      ]
    
```

Re-run: Caught: exit 1.
```text
not ok 10 - file limits, known directories, waiting recheck and normalization
    Expected values to be strictly deep-equal:
    + actual - expected
    ... Skipped lines
    
      [
        {
          project: '/saved',
          provider: 'gpt',
          received_at: '1970-01-01T00:00:00.000Z',
    ...
        },
    +   {
    +     project: '/saved',
    +     provider: 'gpt',
    +     received_at: '1970-01-01T00:00:00.000Z',
    +     role: 'worker',
    +     saved_at: '1970-01-01T00:00:00.000Z',
    +     saved_by: 'agent',
    +     source: 'file',
    +     text: 'wait',
    +     thread: 'thread-wait',
    +     wid: 'two'
    +   }
      ]
    
```

### import accepts version 2

Before: Survived: exit 0, no failing test.

Re-run: Caught: exit 1.
```text
not ok 18 - import refuses a newer lessons file version
    Expected values to be strictly equal:
    
    200 !== 400
    
```

### import accepts body over 1 MB

Before: Caught: exit 1.
```text
not ok 10 - file limits, known directories, waiting recheck and normalization
    Expected values to be strictly equal:
    
    400 !== 413
    
```

Re-run: Caught: exit 1.
```text
not ok 10 - file limits, known directories, waiting recheck and normalization
    Expected values to be strictly equal:
    
    400 !== 413
    
```

## Validation

An initial invocation from the repository root could not find the test paths (exit 1); the command was then run from `viewer/` as specified.

### `node --test test/app-lessons-history.test.js test/app-lessons.test.js`

```text
exit 0
  ---
  duration_ms: 87.223907
  type: 'test'
  ...
# Subtest: restore scope after agent replacement
ok 20 - restore scope after agent replacement
  ---
  duration_ms: 9.087784
  type: 'test'
  ...
# Subtest: card schema and saver pairs
ok 21 - card schema and saver pairs
  ---
  duration_ms: 42.829404
  type: 'test'
  ...
# Subtest: sub-lead can save a worker lesson for another provider
ok 22 - sub-lead can save a worker lesson for another provider
  ---
  duration_ms: 7.594492
  type: 'test'
  ...
# Subtest: reviewers and verifiers cannot save lessons through the hub
ok 23 - reviewers and verifiers cannot save lessons through the hub
  ---
  duration_ms: 3.937184
  type: 'test'
  ...
# Subtest: scope, repeat safety, replacement, removal and user ownership
ok 24 - scope, repeat safety, replacement, removal and user ownership
  ---
  duration_ms: 48.466506
  type: 'test'
  ...
# Subtest: normalization, cap, prompts and preview
ok 25 - normalization, cap, prompts and preview
  ---
  duration_ms: 16.934276
  type: 'test'
  ...
# Subtest: lead roleLayers keeps reviewer, verifier and mapper blocks
ok 26 - lead roleLayers keeps reviewer, verifier and mapper blocks
  ---
  duration_ms: 0.281109
  type: 'test'
  ...
# Subtest: card.js lesson validation refuses reviewer and missing why
ok 27 - card.js lesson validation refuses reviewer and missing why
  ---
  duration_ms: 0.275208
  type: 'test'
  ...
# Subtest: settings PUT merges edits and removals over HTTP
ok 28 - settings PUT merges edits and removals over HTTP
  ---
  duration_ms: 198.880069
  type: 'test'
  ...
# Subtest: all saver and target pairs enforce the role matrix
ok 29 - all saver and target pairs enforce the role matrix
  ---
  duration_ms: 18.293883
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-a484c012c226.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 30 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 201.950272
  type: 'test'
  ...
1..30
# tests 30
# suites 0
# pass 30
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1077.581878
```

### `npm test`

Two untouched tests failed with a port collision. After more than five minutes their processes remained open and were terminated, allowing the suite to exit.

```text
exit 1
ok 830 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 65.974157
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 831 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 82.540669
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 832 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 84.127228
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 833 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 77.0453
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 834 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 75.645226
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 835 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 74.254502
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 836 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 89.627207
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 837 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 95.169716
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 838 - unknown win op fails without sending a request
  ---
  duration_ms: 92.444014
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 839 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.86601
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 840 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 79.473231
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 841 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 67.441979
  type: 'test'
  ...
1..841
# tests 857
# suites 0
# pass 855
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 339124.052638
```

Failure excerpts:

```text
681:not ok 97 - GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
682-  ---
683-  duration_ms: 276.35914
684-  type: 'test'
685-  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-chat.test.js:326:1'
686-  failureType: 'testCodeFailure'
687-  error: |-
688-    server exited before ready (1): Refused to use a port held by a process it cannot identify.
689-    
690:  code: 'ERR_TEST_FAILURE'
691-  stack: |-
692-    ChildProcess.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/helpers/server.js:54:14)
693-    Object.onceWrapper (node:events:634:26)
694-    ChildProcess.emit (node:events:531:35)
695-    ChildProcess._handle.onexit (node:internal/child_process:293:12)
696-  ...
697-# Subtest: a failed transcript read keeps the last copy for the chat, not for a report
698-ok 98 - a failed transcript read keeps the last copy for the chat, not for a report
699-  ---
700-  duration_ms: 1.369554
701-  type: 'test'
702-  ...
703-# Subtest: stamped chat polls share parsed items and invalidate them when parser context changes
704-ok 99 - stamped chat polls share parsed items and invalidate them when parser context changes
705-  ---
706-  duration_ms: 4.125975
707-  type: 'test'
708-  ...
709-# Subtest: old machines, missing entries, empty replies and failures follow transcript fallback rules
710-ok 100 - old machines, missing entries, empty replies and failures follow transcript fallback rules
711-  ---
712-  duration_ms: 0.784133
713-  type: 'test'
714-  ...
715-# Subtest: idle transcript pruning protects queued and active chat operations
716-ok 101 - idle transcript pruning protects queued and active chat operations
717-  ---
718-  duration_ms: 0.674332
719-  type: 'test'
720-  ...
--
745:# auto-merge: TypeError: hub.withThread is not a function
746-#     at attempt (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/auto-merge.js:21:13)
747-#     at Object.afterCheck (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/auto-merge.js:99:19)
748-#     at acceptCard (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/cards.js:207:65)
749-#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-check-card.test.js:35:3)
750-#     at async Test.run (node:internal/test_runner/test:1054:7)
751-#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
752:# auto-merge: TypeError: hub.withThread is not a function
753-#     at attempt (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/auto-merge.js:21:13)
754-#     at Object.afterCheck (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/auto-merge.js:99:19)
755-#     at acceptCard (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/cards.js:207:65)
756-#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-check-card.test.js:36:140)
757-#     at async Test.run (node:internal/test_runner/test:1054:7)
758-#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
759-# Subtest: GET reports each machine, and POST forwards to all of them
760-ok 106 - GET reports each machine, and POST forwards to all of them
761-  ---
762-  duration_ms: 329.863663
763-  type: 'test'
764-  ...
765-# Subtest: one machine failing gives 502 with the per-machine map; the others keep the level
766-ok 107 - one machine failing gives 502 with the per-machine map; the others keep the level
767-  ---
768-  duration_ms: 138.240838
769-  type: 'test'
770-  ...
771-# Subtest: a machine that does not answer is "did not answer" within the timeout, on GET and POST
772-ok 108 - a machine that does not answer is "did not answer" within the timeout, on GET and POST
773-  ---
774-  duration_ms: 743.785041
775-  type: 'test'
776-  ...
777-# Subtest: a refused connection is "did not answer", and a bad level is 400 without calling machines
778-ok 109 - a refused connection is "did not answer", and a bad level is 400 without calling machines
779-  ---
780-  duration_ms: 174.166591
781-  type: 'test'
782-  ...
--
1251:# Could not register plan: Error: registration failed
1252-#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-handoff-restart.test.js:151:78)
1253-#     at Hub.init (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/hub.js:73:26)
1254-#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-handoff-restart.test.js:159:3)
1255-#     at async Test.run (node:internal/test_runner/test:1054:7)
1256-#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
1257:# Could not register plan: Error: registration failed
1258-#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-handoff-restart.test.js:151:78)
1259-#     at startSession (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/sessions.js:424:21)
1260-#     at async Object.restartLead (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/threads.js:170:18)
1261:# Could not register plan: Error: registration failed
1262-#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-handoff-restart.test.js:151:78)
1263-#     at startSession (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/sessions.js:424:21)
1264-#     at async Object.restartLead (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/app/threads.js:170:18)
1265-# Subtest: partial imported start is repaired, killed, and restarted twice with the right context
1266-ok 188 - partial imported start is repaired, killed, and restarted twice with the right context
1267-  ---
1268-  duration_ms: 1517.296946
1269-  type: 'test'
1270-  ...
1271-# Subtest: imported Claude lead receives context immediately on start
1272-ok 189 - imported Claude lead receives context immediately on start
1273-  ---
1274-  duration_ms: 947.282825
1275-  type: 'test'
1276-  ...
1277-# Subtest: imported waiting lead retries with checkout SHA and delivers context
1278-ok 190 - imported waiting lead retries with checkout SHA and delivers context
1279-  ---
1280-  duration_ms: 915.082691
1281-  type: 'test'
1282-  ...
1283-# Subtest: failed pending start retains non-context queue for the next restart and failed inspect is tolerated
1284-ok 191 - failed pending start retains non-context queue for the next restart and failed inspect is tolerated
1285-  ---
1286-  duration_ms: 1368.979987
1287-  type: 'test'
1288-  ...
1289-# Subtest: ordinary chat and merge watcher retain their different done-card rules
1290-ok 192 - ordinary chat and merge watcher retain their different done-card rules
1291-  ---
--
1824:not ok 281 - reads archived PLAN.md with git show from the thread branch
1825-  ---
1826-  duration_ms: 79.603922
1827-  type: 'test'
1828-  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-hub.test.js:845:3'
1829-  failureType: 'testCodeFailure'
1830-  error: |-
1831-    server exited before ready (1): Refused to use a port held by a process it cannot identify.
1832-    
1833:  code: 'ERR_TEST_FAILURE'
1834-  stack: |-
1835-    ChildProcess.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/helpers/server.js:54:14)
1836-    Object.onceWrapper (node:events:634:26)
1837-    ChildProcess.emit (node:events:531:35)
1838-    ChildProcess._handle.onexit (node:internal/child_process:293:12)
1839-  ...
1840-# Subtest: refuses archived documents outside MAP, IDEA and PLAN
1841-ok 282 - refuses archived documents outside MAP, IDEA and PLAN
1842-  ---
1843-  duration_ms: 265.671412
1844-  type: 'test'
1845-  ...
1846-# Subtest: finds a worktree plan slug on thread and chat routes
1847-ok 283 - finds a worktree plan slug on thread and chat routes
1848-  ---
1849-  duration_ms: 276.361984
1850-  type: 'test'
1851-  ...
1852-# Subtest: groups features by the current plan status and lists open needs
1853-ok 284 - groups features by the current plan status and lists open needs
1854-  ---
1855-  duration_ms: 238.994318
1856-  type: 'test'
1857-  ...
1858-# Subtest: returns every machine session and persists its last-seen time
1859-ok 285 - returns every machine session and persists its last-seen time
1860-  ---
1861-  duration_ms: 271.409536
1862-  type: 'test'
1863-  ...

```

### `node --test test/app-chat.test.js test/app-hub.test.js`

The permitted isolated re-run encountered another port collision in app-hub; it was stopped after this repeated gate failure while the process remained open. No final TAP counts were emitted.

```text
exit 1 (terminated after repeated port failure)
  type: 'test'
  ...
# Subtest: talking about an approval keeps it open for Needs you and Start building
ok 98 - talking about an approval keeps it open for Needs you and Start building
  ---
  duration_ms: 315.509851
  type: 'test'
  ...
# Subtest: successful submits record their destination, source, text, and time
ok 99 - successful submits record their destination, source, text, and time
  ---
  duration_ms: 279.778569
  type: 'test'
  ...
# Subtest: sent history keeps 500 entries and appends older entries beside the thread file
ok 100 - sent history keeps 500 entries and appends older entries beside the thread file
  ---
  duration_ms: 332.577579
  type: 'test'
  ...
# Subtest: restart context includes the latest twenty the user and card messages
ok 101 - restart context includes the latest twenty the user and card messages
  ---
  duration_ms: 452.086122
  type: 'test'
  ...
# Subtest: runs Codex preflight before a lead start and records its failure as a need
ok 102 - runs Codex preflight before a lead start and records its failure as a need
  ---
  duration_ms: 212.933384
  type: 'test'
  ...
# Subtest: terminal Enter marks its session busy before the next hook event
ok 103 - terminal Enter marks its session busy before the next hook event
  ---
  duration_ms: 326.596828
  type: 'test'
  ...
# Subtest: unreachable sessions are public and marked unreachable
ok 104 - unreachable sessions are public and marked unreachable
  ---
  duration_ms: 289.087528
  type: 'test'
  ...
# Subtest: a kept rebase makes a need and leaves the thread open
ok 105 - a kept rebase makes a need and leaves the thread open
  ---
  duration_ms: 310.449445
  type: 'test'
  ...
# Subtest: a second archive records the thread after a retained rebase worktree is removed
ok 106 - a second archive records the thread after a retained rebase worktree is removed
  ---
  duration_ms: 249.032802
  type: 'test'
  ...
# Subtest: serializes concurrent card and event arrivals without losing either
ok 107 - serializes concurrent card and event arrivals without losing either
  ---
  duration_ms: 317.498954
  type: 'test'
  ...
# Subtest: Features includes an opened stub but not an unopened one, and needs need no slug
ok 108 - Features includes an opened stub but not an unopened one, and needs need no slug
  ---
  duration_ms: 372.718952
  type: 'test'
  ...
# Subtest: stub commits persist and reach the opened lead context
ok 109 - stub commits persist and reach the opened lead context
  ---
  duration_ms: 374.282608
  type: 'test'
  ...
# Subtest: registers a diagram plan before persisting its card
ok 110 - registers a diagram plan before persisting its card
  ---
  duration_ms: 256.971725
  type: 'test'
  ...
```

Failure excerpt:

```text
543:not ok 91 - projects.json records each thread project once and GET /projects lists them
544-  ---
545-  duration_ms: 66.443275
546-  type: 'test'
547-  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/app-hub.test.js:1206:1'
548-  failureType: 'testCodeFailure'
549-  error: |-
550-    server exited before ready (1): Refused to use a port held by a process it cannot identify.
551-    
552:  code: 'ERR_TEST_FAILURE'
553-  stack: |-
554-    ChildProcess.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-0f0e04f0cd97-w15/viewer/test/helpers/server.js:54:14)
555-    Object.onceWrapper (node:events:634:26)
556-    ChildProcess.emit (node:events:531:35)
557-    ChildProcess._handle.onexit (node:internal/child_process:293:12)
558-  ...
559-# Subtest: the sessions list passes unmanaged tmux sessions through as read-only
560-ok 92 - the sessions list passes unmanaged tmux sessions through as read-only
561-  ---
562-  duration_ms: 277.0866
563-  type: 'test'
564-  ...
565-# Subtest: serializes concurrent cards and de-duplicates a delivered card
566-ok 93 - serializes concurrent cards and de-duplicates a delivered card
567-  ---
568-  duration_ms: 283.380651
569-  type: 'test'
570-  ...
571-# Subtest: a failed event submit records its delivery id and leaves its queue for a later retry
572-ok 94 - a failed event submit records its delivery id and leaves its queue for a later retry
573-  ---
574-  duration_ms: 304.713402
575-  type: 'test'
576-  ...
577-# Subtest: a failed result-card submit is accepted, queued, and never rejected
578-ok 95 - a failed result-card submit is accepted, queued, and never rejected
579-  ---
580-  duration_ms: 496.918895
581-  type: 'test'
582-  ...

```

## Files changed

- `viewer/test/app-lessons-history.test.js`
- `docs/plans/lessons-hardening/reports/R6-TESTS.md`

## Choices

- `viewer/test/app-lessons-history.test.js`: used fixed epoch timestamps and synthetic IDs for deterministic fixtures; added a separate agent-replacement scope case alongside direct restore fixtures.
- `viewer/test/app-lessons-history.test.js`: grouped related merge and normalization assertions in focused tests and split collision paths into separately named tests.
- Validation: terminated the two stalled unrelated test processes after over five minutes, and stopped their isolated re-run after the same port failure recurred.
