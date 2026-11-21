# R1b report

- `machine/lib/aside-turns.js`: decode child streams as UTF-8 and report redacted Pi errors and limit status when an invalid header accompanies a failed process or stderr.
- `machine/test/aside-turns.test.js`: cover split UTF-8, pre-header rate limits and key redaction, and invalid headers on successful exit.

## Validation

`bash machine/test/run.sh` (first run: fixture newline escaping caused a syntax error; corrected before the second run):

```text
exit 1
# Subtest: delayed process filter failing after HEAD moved records files across reload
ok 488 - delayed process filter failing after HEAD moved records files across reload
  ---
  duration_ms: 203.035329
  type: 'test'
  ...
1..488
# tests 488
# suites 0
# pass 487
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 37222.882564
```

Failure excerpt:

```text
not ok 19 - Pi asides validate, fork, resume, settle and redact
  ---
  duration_ms: 75.373167
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-32fed9258dca-w7/machine/test/aside-turns.test.js:150:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    'failed' !== 'ok'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'ok'
  actual: 'failed'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-32fed9258dca-w7/machine/test/aside-turns.test.js:174:39)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
```

`bash machine/test/run.sh` (second run):

```text
exit 0
ok 477 - a long switch does not delay the same project agent worktree queue
  ---
  duration_ms: 2160.261175
  type: 'test'
  ...
# Subtest: two symlink spellings of one folder pressed together are refused
ok 478 - two symlink spellings of one folder pressed together are refused
  ---
  duration_ms: 1140.271023
  type: 'test'
  ...
# Subtest: index.lock is shown after nothing moved and hidden while a switch runs
ok 479 - index.lock is shown after nothing moved and hidden while a switch runs
  ---
  duration_ms: 205.88352
  type: 'test'
  ...
# Subtest: Status for stale, moved, trying-other and mismatch includes the right fields
ok 480 - Status for stale, moved, trying-other and mismatch includes the right fields
  ---
  duration_ms: 251.642105
  type: 'test'
  ...
# Subtest: capped file lists retain full files_count and appeared_count
ok 481 - capped file lists retain full files_count and appeared_count
  ---
  duration_ms: 389.296756
  type: 'test'
  ...
# Subtest: kept entries show missing and old_identity flags
ok 482 - kept entries show missing and old_identity flags
  ---
  duration_ms: 52.976505
  type: 'test'
  ...
# Subtest: Status runs no content filter while active
ok 483 - Status runs no content filter while active
  ---
  duration_ms: 171.5287
  type: 'test'
  ...
# Subtest: required smudge filter failing on a move between threads records exact interrupted paths
ok 484 - required smudge filter failing on a move between threads records exact interrupted paths
  ---
  duration_ms: 290.027794
  type: 'test'
  ...
# Subtest: real git switch unable to unlink warning is interrupted
ok 485 - real git switch unable to unlink warning is interrupted
  ---
  duration_ms: 157.119923
  type: 'test'
  ...
# Subtest: commit subject containing unable to unlink gives plain success
ok 486 - commit subject containing unable to unlink gives plain success
  ---
  duration_ms: 124.741803
  type: 'test'
  ...
# Subtest: hanging filter subprocess outlives deadline and its whole process group is killed
ok 487 - hanging filter subprocess outlives deadline and its whole process group is killed
  ---
  duration_ms: 594.992697
  type: 'test'
  ...
# Subtest: delayed process filter failing after HEAD moved records files across reload
ok 488 - delayed process filter failing after HEAD moved records files across reload
  ---
  duration_ms: 192.333018
  type: 'test'
  ...
1..488
# tests 488
# suites 0
# pass 488
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 35684.64649
```

## Choices

none
