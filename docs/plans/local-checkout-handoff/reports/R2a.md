# R2a — machine Try fixture

Changed `machine/test/try.test.js`: `tryFixture()` now keeps `repo` on `main` and checks out `wc/0123456789ab` in a linked worktree at `root/agent`. The fixture returns `agent` and `agentGit`; tests that add commits to the main thread branch now write and commit through that worktree. Product code was unchanged.

## Validation

`node --test machine/test/try.test.js`

```text
exit 0
ok 55 - a long switch does not delay the same project agent worktree queue
  ---
  duration_ms: 2189.532573
  type: 'test'
  ...
# Subtest: two symlink spellings of one folder pressed together are refused
ok 56 - two symlink spellings of one folder pressed together are refused
  ---
  duration_ms: 1163.171232
  type: 'test'
  ...
# Subtest: index.lock is shown after nothing moved and hidden while a switch runs
ok 57 - index.lock is shown after nothing moved and hidden while a switch runs
  ---
  duration_ms: 241.488655
  type: 'test'
  ...
# Subtest: Status for stale, moved, trying-other and mismatch includes the right fields
ok 58 - Status for stale, moved, trying-other and mismatch includes the right fields
  ---
  duration_ms: 291.674232
  type: 'test'
  ...
# Subtest: capped file lists retain full files_count and appeared_count
ok 59 - capped file lists retain full files_count and appeared_count
  ---
  duration_ms: 356.279655
  type: 'test'
  ...
# Subtest: kept entries show missing and old_identity flags
ok 60 - kept entries show missing and old_identity flags
  ---
  duration_ms: 55.576994
  type: 'test'
  ...
# Subtest: Status runs no content filter while active
ok 61 - Status runs no content filter while active
  ---
  duration_ms: 189.174356
  type: 'test'
  ...
# Subtest: required smudge filter failing on a move between threads records exact interrupted paths
ok 62 - required smudge filter failing on a move between threads records exact interrupted paths
  ---
  duration_ms: 292.239147
  type: 'test'
  ...
# Subtest: real git switch unable to unlink warning is interrupted
ok 63 - real git switch unable to unlink warning is interrupted
  ---
  duration_ms: 175.116629
  type: 'test'
  ...
# Subtest: commit subject containing unable to unlink gives plain success
ok 64 - commit subject containing unable to unlink gives plain success
  ---
  duration_ms: 165.038991
  type: 'test'
  ...
# Subtest: hanging filter subprocess outlives deadline and its whole process group is killed
ok 65 - hanging filter subprocess outlives deadline and its whole process group is killed
  ---
  duration_ms: 586.040721
  type: 'test'
  ...
# Subtest: delayed process filter failing after HEAD moved records files across reload
ok 66 - delayed process filter failing after HEAD moved records files across reload
  ---
  duration_ms: 252.279024
  type: 'test'
  ...
1..66
# tests 66
# suites 0
# pass 66
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 26186.952433
```

`bash machine/test/run.sh`

```text
exit 0
ok 400 - a long switch does not delay the same project agent worktree queue
  ---
  duration_ms: 2415.859576
  type: 'test'
  ...
# Subtest: two symlink spellings of one folder pressed together are refused
ok 401 - two symlink spellings of one folder pressed together are refused
  ---
  duration_ms: 1355.451232
  type: 'test'
  ...
# Subtest: index.lock is shown after nothing moved and hidden while a switch runs
ok 402 - index.lock is shown after nothing moved and hidden while a switch runs
  ---
  duration_ms: 386.136953
  type: 'test'
  ...
# Subtest: Status for stale, moved, trying-other and mismatch includes the right fields
ok 403 - Status for stale, moved, trying-other and mismatch includes the right fields
  ---
  duration_ms: 534.204399
  type: 'test'
  ...
# Subtest: capped file lists retain full files_count and appeared_count
ok 404 - capped file lists retain full files_count and appeared_count
  ---
  duration_ms: 780.758908
  type: 'test'
  ...
# Subtest: kept entries show missing and old_identity flags
ok 405 - kept entries show missing and old_identity flags
  ---
  duration_ms: 105.910074
  type: 'test'
  ...
# Subtest: Status runs no content filter while active
ok 406 - Status runs no content filter while active
  ---
  duration_ms: 428.662849
  type: 'test'
  ...
# Subtest: required smudge filter failing on a move between threads records exact interrupted paths
ok 407 - required smudge filter failing on a move between threads records exact interrupted paths
  ---
  duration_ms: 630.425438
  type: 'test'
  ...
# Subtest: real git switch unable to unlink warning is interrupted
ok 408 - real git switch unable to unlink warning is interrupted
  ---
  duration_ms: 483.322774
  type: 'test'
  ...
# Subtest: commit subject containing unable to unlink gives plain success
ok 409 - commit subject containing unable to unlink gives plain success
  ---
  duration_ms: 295.354938
  type: 'test'
  ...
# Subtest: hanging filter subprocess outlives deadline and its whole process group is killed
ok 410 - hanging filter subprocess outlives deadline and its whole process group is killed
  ---
  duration_ms: 670.03984
  type: 'test'
  ...
# Subtest: delayed process filter failing after HEAD moved records files across reload
ok 411 - delayed process filter failing after HEAD moved records files across reload
  ---
  duration_ms: 273.735734
  type: 'test'
  ...
1..411
# tests 411
# suites 0
# pass 411
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 38283.96839
```

## Files changed

- `machine/test/try.test.js`
- `docs/plans/local-checkout-handoff/reports/R2a.md`

## Choices

none
