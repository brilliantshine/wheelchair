# R1a report

Implemented the R1a machine changes in `machine/lib/try.js`: Back now checks cleanliness before saving a kept pin, both Try and Back avoid duplicating a kept pin that resolves to the same commit, and Git process-start failures are handled without signaling a missing PID. Added coverage in `machine/test/try.test.js` for spawn failure and repeated dirty Back attempts after a commit.

Files changed:

- `machine/lib/try.js`
- `machine/test/try.test.js`
- `docs/plans/local-checkout-handoff/reports/R1a.md`

## Validation

Command: `node --test machine/test/try.test.js`

```text
exit 1
...
# Subtest: Back after a commit pins once across dirty refusals, then succeeds
not ok 33 - Back after a commit pins once across dirty refusals, then succeeds
  ---
  duration_ms: 410.070047
  type: 'test'
  location: 'machine/test/try.test.js:258:1'
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
    TestContext.<anonymous> (machine/test/try.test.js:268:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..66
# tests 66
# suites 0
# pass 65
# fail 1
```

I ran this validation twice while adjusting only the new regression assertion; the same gate failed twice, so I stopped per the task rule. The isolated failure is the new regression test's expectation that the commit has a saved kept entry.

Command: `bash machine/test/run.sh`

```text
exit 1
...
1..411
# tests 411
# suites 0
# pass 410
# fail 1
# cancelled 0
# skipped 0
# todo 0
```

The full suite includes the same R1a regression failure; no unrelated test failure was reported in the output.

## Choices

- Regression test assertion in `machine/test/try.test.js`: inspected the persisted record instead of the status projection to count kept refs; the commit pin still was not present.
