# T3c — Typographic quote escaping in the disk walk

## Changes

- `machine/lib/win-disk.js:36`: PowerShell literal escaping now doubles each matched quote character itself, preserving typographic quotes in Windows copy paths.
- `machine/test/win-disk.test.js:81`: Added a run-dir-backed regression test for a copy directory named `O’Brien`. It captures the fake PowerShell script and checks for `O’’Brien` while rejecting `O''Brien`.

## Validation

`node --test machine/test/win-disk.test.js` (initial run; test assertion was too broad because the escaped path should not retain the undoubled quote):

```text
exit 1
ℹ tests 4
ℹ pass 3
ℹ fail 1
```

`node --test machine/test/win-disk.test.js` (after correcting the assertion):

```text
exit 0
✔ disk cache, thresholds, failures and real repository measurements (53.387898ms)
✔ warning thresholds and no git size warning (48.032265ms)
✔ large git storage never produces a warning (4.070818ms)
✔ copy walk doubles typographic quotes without changing them (5.547996ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 159.774307
```

`bash machine/test/run.sh`:

```text
exit 1
ℹ tests 568
ℹ suites 0
ℹ pass 564
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 39599.176638
```

The four failures were `aside-turns.test.js:152`, `kimi.test.js:166`, and `plan-files.test.js:21,36`, matching the known pre-existing failure list. The two plan-files failures reported `EADDRINUSE` on `127.0.0.1:7374` during this run.

## Choices

none
