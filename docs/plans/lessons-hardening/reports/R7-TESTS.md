# R7-TESTS

Changed `viewer/test/app-lessons-history.test.js` to compare the archived current fields and `viewer/test/app-handoff.test.js` to check the saved-settings download and version boundaries. No application changes or real bugs found.

## Mutation sweep

Each break was applied, its named Node suite run, and `git checkout -- viewer/app/` restored the app. All were caught; no survivors required another assertion. Part A restore ran `node --test test/app-lessons-history.test.js`; all others ran `node --test test/app-handoff*.test.js`.

- Restore records selected version instead of current: caught by `agent changes, restore, keep and normalization retain history`; error: |- Expected values to be strictly deep-equal:
- Export caller passes empty lessons: caught by `export download includes exactly the saved lessons for the thread`; error: |- Expected values to be strictly deep-equal:
- Export includes other threads: caught by `v3 exports only this thread’s lessons in transferable scope`; error: |- Expected values to be strictly deep-equal:
- Export includes another project path: caught by `exported project lessons are scoped to the destination project`; error: |- Expected values to be strictly deep-equal:
- Export writes project path: caught by `exported project lessons are scoped to the destination project`; error: |- Expected values to be strictly deep-equal:
- Export includes id: caught by `v3 exports only this thread’s lessons in transferable scope`; error: |- Expected values to be strictly deep-equal:
- Export includes thread: caught by `v3 exports only this thread’s lessons in transferable scope`; error: |- Expected values to be strictly deep-equal:
- Export writes version 2: caught by `imports both history versions and retries interrupted old history before export`; error: |- Expected values to be strictly equal:
- Validator accepts lessons on version 2: caught by `v3 exports only this thread’s lessons in transferable scope`; error: |- Expected values to be strictly equal:
- Validator accepts non-array lessons: caught by `v3 exports only this thread’s lessons in transferable scope`; error: |- Expected values to be strictly equal:
- Validator refuses version 3 without lessons: caught by `v3 exports only this thread’s lessons in transferable scope`; error: |- Expected values to be strictly equal:
- Advance passes project instead of targetProject: caught by `Advance merges lessons into the existing thread project`; error: "Cannot read properties of undefined (reading 'text')" 
- Import drops thread stamp: caught by `v3 imports valid lessons into target scope and ignores malformed entries; v2 imports none`; error: |- Expected values to be strictly equal:
- Advance merges before firstPreclaim: caught by `dirty Advance refuses before claim and preserves prior imported content`; error: |- Expected values to be strictly deep-equal:
- startCreate merges lessons: caught by `startCreate and startAdvance do not merge file lessons`; error: |- Expected values to be strictly deep-equal:

## Validation

Full-suite failures were in untouched files: `app-quiet.test.js` expected 0 but got 1 in “6 message clears debt”; `lifecycle.test.js` could not start a server because a port was held by an unidentified process. Both files passed on rerun.

`node --test test/app-lessons-history.test.js test/app-lessons.test.js test/app-handoff*.test.js`

```text
exit 0
  ---
  duration_ms: 136.5506
  type: 'test'
  ...
# Subtest: restore scope after agent replacement
ok 113 - restore scope after agent replacement
  ---
  duration_ms: 30.96783
  type: 'test'
  ...
# Subtest: card schema and saver pairs
ok 114 - card schema and saver pairs
  ---
  duration_ms: 52.263182
  type: 'test'
  ...
# Subtest: sub-lead can save a worker lesson for another provider
ok 115 - sub-lead can save a worker lesson for another provider
  ---
  duration_ms: 7.330659
  type: 'test'
  ...
# Subtest: reviewers and verifiers cannot save lessons through the hub
ok 116 - reviewers and verifiers cannot save lessons through the hub
  ---
  duration_ms: 5.215625
  type: 'test'
  ...
# Subtest: scope, repeat safety, replacement, removal and user ownership
ok 117 - scope, repeat safety, replacement, removal and user ownership
  ---
  duration_ms: 68.650649
  type: 'test'
  ...
# Subtest: normalization, cap, prompts and preview
ok 118 - normalization, cap, prompts and preview
  ---
  duration_ms: 42.293506
  type: 'test'
  ...
# Subtest: lead roleLayers keeps reviewer, verifier and mapper blocks
ok 119 - lead roleLayers keeps reviewer, verifier and mapper blocks
  ---
  duration_ms: 0.698439
  type: 'test'
  ...
# Subtest: card.js lesson validation refuses reviewer and missing why
ok 120 - card.js lesson validation refuses reviewer and missing why
  ---
  duration_ms: 0.524325
  type: 'test'
  ...
# Subtest: settings PUT merges edits and removals over HTTP
ok 121 - settings PUT merges edits and removals over HTTP
  ---
  duration_ms: 334.377777
  type: 'test'
  ...
# Subtest: all saver and target pairs enforce the role matrix
ok 122 - all saver and target pairs enforce the role matrix
  ---
  duration_ms: 29.546265
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-05119002e079.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 123 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 445.237871
  type: 'test'
  ...
1..123
# tests 123
# suites 0
# pass 123
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6659.728311
```

`npm test`

```text
exit 1
ok 832 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 120.790897
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 833 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 90.034662
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 834 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 128.98414
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 835 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 89.387231
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 836 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 128.108972
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 837 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 124.140176
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 838 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 165.240946
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 839 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 103.843969
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 840 - unknown win op fails without sending a request
  ---
  duration_ms: 83.111394
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 841 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.898983
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 842 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 70.626386
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 843 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 76.384272
  type: 'test'
  ...
1..843
# tests 859
# suites 0
# pass 857
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 80165.576173
```

`node --test test/app-quiet.test.js test/lifecycle.test.js`

```text
exit 0
ok 44 - --service gives up after three takeovers
  ---
  duration_ms: 603.589499
  type: 'test'
  ...
# Subtest: a post-bind .server rename failure rolls back listener and record
ok 45 - a post-bind .server rename failure rolls back listener and record
  ---
  duration_ms: 83.69573
  type: 'test'
  ...
# Subtest: --open waits a closing server out and succeeds
ok 46 - --open waits a closing server out and succeeds
  ---
  duration_ms: 188.653338
  type: 'test'
  ...
# Subtest: only localhost and served origins write, and serve false prints localhost
ok 47 - only localhost and served origins write, and serve false prints localhost
  ---
  duration_ms: 178.507221
  type: 'test'
  ...
# Subtest: --url never listens and reports the running token after a timed-out rotation
ok 48 - --url never listens and reports the running token after a timed-out rotation
  ---
  duration_ms: 7146.044505
  type: 'test'
  ...
# Subtest: --rotate-token refuses an old-version holder and leaves it running
ok 49 - --rotate-token refuses an old-version holder and leaves it running
  ---
  duration_ms: 40.793189
  type: 'test'
  ...
# Subtest: --register-plan retries a silent holder until it registers through it
ok 50 - --register-plan retries a silent holder until it registers through it
  ---
  duration_ms: 1264.958667
  type: 'test'
  ...
# Subtest: --rotate-token waits for shutdown and leaves .server removal to the server
ok 51 - --rotate-token waits for shutdown and leaves .server removal to the server
  ---
  duration_ms: 197.691387
  type: 'test'
  ...
# Subtest: --rotate-token prints the new prefixed bookmark for a current server
ok 52 - --rotate-token prints the new prefixed bookmark for a current server
  ---
  duration_ms: 211.291012
  type: 'test'
  ...
# Subtest: shutdown releases the port before it removes only its own .server record
ok 53 - shutdown releases the port before it removes only its own .server record
  ---
  duration_ms: 87.799885
  type: 'test'
  ...
# Subtest: --stop leaves .server removal to the exiting server
ok 54 - --stop leaves .server removal to the exiting server
  ---
  duration_ms: 173.777044
  type: 'test'
  ...
# Subtest: a starter that loses the freed port registers through the new holder
ok 55 - a starter that loses the freed port registers through the new holder
  ---
  duration_ms: 551.946234
  type: 'test'
  ...
1..55
# tests 55
# suites 0
# pass 55
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 26991.606257
```

## Files changed

- `viewer/test/app-lessons-history.test.js`
- `viewer/test/app-handoff.test.js`
- `docs/plans/lessons-hardening/reports/R7-TESTS.md`

## Choices

- `app-handoff.test.js`: included both unthreaded project-only examples and a thread-stamped project lesson, to check the S7 thread filter and the `project: true` conversion in the download.
- `app-handoff.test.js`: added explicit version 2-with-lessons and version 3-without-lessons validator checks before the sweep, matching S7.
- `handoff-ops.js` sweep: moved the advance merge before preclaim; the existing dirty-advance test exercises this ordering.
