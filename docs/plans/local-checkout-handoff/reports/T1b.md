# T1b — partial implementation

Outcome: **blocked / incomplete**. Back, Dismiss and Forget are implemented and both prescribed suites pass, but Dismiss on identity mismatch and Forget of an old-identity entry still invoke read-only Git commands, including while constructing the returned Status. The brief explicitly requires no Git commands in those cases. The implementation avoids Git ref writes in the replacement repository, but that narrower guarantee does not satisfy the contract. Do not merge as complete.

## Files changed

- `machine/lib/try.js`: asynchronous bounded Git metadata reads, background Switch Back, Dismiss, and Forget.
- `machine/test/try.test.js`: asynchronous metadata and recovery, return, lock, version, and file-safety cases.
- `machine/API.md`: describes the implemented action response shapes.
- `docs/plans/local-checkout-handoff/reports/T1b.md`: this report.

## Progress and limitations

Step 1 is implemented and its focused tests pass. Step 2 is implemented and its focused tests pass. Steps 3 and 4 are implemented, but both retain the no-Git-on-old-identity gap above; Status itself calls Git for metadata and identity detection currently uses Git. Step 5 includes most requested scenarios, but the replacement-folder test checks only that no `update-ref` occurs, and the smudge-failure test checks an array was returned rather than asserting exact interrupted file paths; those tests do not prove the full requested guarantees. The untracked-before-and-after example exercises a protected file that is untracked before Back and ignored after Back, so a separate test where it is untracked on both sides is still needed. No automatic backups or recovery were added.

The lead was notified of the no-Git gap. Commits in order: `90aef13b` (metadata), `fed0a5dc` (Back), `523d07f1` (Done), `9c552537` (Forget), and `7881c6d8` (coverage and API).

## Validation

Each command below was run with output redirected to a scratch log; excerpts include the actual exit line and test totals. The first Step 1 run failed because tests still treated two newly async helpers synchronously. The failed Step 5 run had a clone fixture with no local thread branch; the fixture was corrected and the retry passed.

**Step 1, first run (fixture tests needed async awaits)** — `node --test machine/test/try.test.js`:

```text
exit 1
  duration_ms: 367.147253
  type: 'test'
  ...
1..25
# tests 25
# suites 0
# pass 23
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5313.007687
```

**Step 1, retry** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 395.768185
  type: 'test'
  ...
1..25
# tests 25
# suites 0
# pass 25
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5160.150616
```

**Step 1, timing test added** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 1007.703012
  type: 'test'
  ...
1..26
# tests 26
# suites 0
# pass 26
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5080.463783
```

**Step 2** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 322.026094
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
# duration_ms 6217.1363
```

**Step 3** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 317.943807
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7639.237053
```

**Step 4** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 213.493179
  type: 'test'
  ...
1..34
# tests 34
# suites 0
# pass 34
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7526.326571
```

**Step 5, initial edge cases** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 378.324999
  type: 'test'
  ...
1..45
# tests 45
# suites 0
# pass 45
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 17208.738483
```

**Step 5, additional edge cases (clone fixture lacked local branch)** — `node --test machine/test/try.test.js`:

```text
exit 1
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..47
# tests 47
# suites 0
# pass 46
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 60582.300847
```

**Final focused run** — `node --test machine/test/try.test.js`:

```text
exit 0
  duration_ms: 739.949934
  type: 'test'
  ...
1..47
# tests 47
# suites 0
# pass 47
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 25878.725274
```

**Full machine validation** — `bash machine/test/run.sh`:

```text
exit 0
ok 381 - a thread that removes an ignore rule: file not counted, back succeeds, file intact
  ---
  duration_ms: 790.694071
  type: 'test'
  ...
# Subtest: files appearing after back are listed
ok 382 - files appearing after back are listed
  ---
  duration_ms: 702.06348
  type: 'test'
  ...
# Subtest: a file untracked before and after Back is not in appeared
ok 383 - a file untracked before and after Back is not in appeared
  ---
  duration_ms: 664.87018
  type: 'test'
  ...
# Subtest: a new file in an originally ignored directory whose rule the thread removed is listed on Back
ok 384 - a new file in an originally ignored directory whose rule the thread removed is listed on Back
  ---
  duration_ms: 717.682867
  type: 'test'
  ...
# Subtest: Back refused while pending is set
ok 385 - Back refused while pending is set
  ---
  duration_ms: 580.055135
  type: 'test'
  ...
# Subtest: after an interrupted move between threads active is kept
ok 386 - after an interrupted move between threads active is kept
  ---
  duration_ms: 747.549104
  type: 'test'
  ...
# Subtest: return branch deleted or checked out elsewhere is refused
ok 387 - return branch deleted or checked out elsewhere is refused
  ---
  duration_ms: 1434.254841
  type: 'test'
  ...
# Subtest: stale record: Back refused; Dismiss deletes return pin when its branch contains it, else keeps it
ok 388 - stale record: Back refused; Dismiss deletes return pin when its branch contains it, else keeps it
  ---
  duration_ms: 1494.19947
  type: 'test'
  ...
# Subtest: folder replaced by another clone during a trial: Dismiss keeps entries marked old identity
ok 389 - folder replaced by another clone during a trial: Dismiss keeps entries marked old identity
  ---
  duration_ms: 433.766414
  type: 'test'
  ...
# Subtest: stale version on back, dismiss and forget is refused
ok 390 - stale version on back, dismiss and forget is refused
  ---
  duration_ms: 596.036383
  type: 'test'
  ...
# Subtest: required smudge filter failing on Back is interrupted, files recorded and no file deleted
ok 391 - required smudge filter failing on Back is interrupted, files recorded and no file deleted
  ---
  duration_ms: 872.693903
  type: 'test'
  ...
# Subtest: re-cloning after a completed Back allows Try
ok 392 - re-cloning after a completed Back allows Try
  ---
  duration_ms: 900.069631
  type: 'test'
  ...
1..392
# tests 392
# suites 0
# pass 392
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 60804.003802
```

## Choices

- `machine/lib/try.js`: metadata commands use a one-second deadline and terminate their process group; the brief specified only a few seconds.
- `machine/lib/try.js`: missing or invalid kept entries are refused with “That kept entry no longer exists.”
- `machine/lib/try.js`: an old-identity pin is shown as missing because it cannot be checked in the current repository; the wire contract does not specify the missing flag when the old repository is unavailable.
