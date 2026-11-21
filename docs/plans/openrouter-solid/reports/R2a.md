# R2a — Pi aside test store race

Changed `machine/test/aside-turns.test.js` to await the first store's writes and give the blocked store its own state directory. Its input still uses the original working directory.

## Validation

`for n in 1 2 3 4 5; do node --test machine/test/aside-turns.test.js 2>&1 | grep -E '^# (pass|fail)'; done`

```text
exit 0
# pass 7
# fail 0
# pass 7
# fail 0
# pass 7
# fail 0
# pass 7
# fail 0
# pass 7
# fail 0
```

`bash machine/test/run.sh` (tail)

```text
exit 0
ok 477 - a long switch does not delay the same project agent worktree queue
  ---
  duration_ms: 2166.942217
  type: 'test'
  ...
# Subtest: two symlink spellings of one folder pressed together are refused
ok 478 - two symlink spellings of one folder pressed together are refused
  ---
  duration_ms: 1152.465041
  type: 'test'
  ...
# Subtest: index.lock is shown after nothing moved and hidden while a switch runs
ok 479 - index.lock is shown after nothing moved and hidden while a switch runs
  ---
  duration_ms: 186.084439
  type: 'test'
  ...
# Subtest: Status for stale, moved, trying-other and mismatch includes the right fields
ok 480 - Status for stale, moved, trying-other and mismatch includes the right fields
  ---
  duration_ms: 233.947536
  type: 'test'
  ...
# Subtest: capped file lists retain full files_count and appeared_count
ok 481 - capped file lists retain full files_count and appeared_count
  ---
  duration_ms: 394.499919
  type: 'test'
  ...
# Subtest: kept entries show missing and old_identity flags
ok 482 - kept entries show missing and old_identity flags
  ---
  duration_ms: 49.223656
  type: 'test'
  ...
# Subtest: Status runs no content filter while active
ok 483 - Status runs no content filter while active
  ---
  duration_ms: 210.95097
  type: 'test'
  ...
# Subtest: required smudge filter failing on a move between threads records exact interrupted paths
ok 484 - required smudge filter failing on a move between threads records exact interrupted paths
  ---
  duration_ms: 246.299867
  type: 'test'
  ...
# Subtest: real git switch unable to unlink warning is interrupted
ok 485 - real git switch unable to unlink warning is interrupted
  ---
  duration_ms: 125.819296
  type: 'test'
  ...
# Subtest: commit subject containing unable to unlink gives plain success
ok 486 - commit subject containing unable to unlink gives plain success
  ---
  duration_ms: 124.755927
  type: 'test'
  ...
# Subtest: hanging filter subprocess outlives deadline and its whole process group is killed
ok 487 - hanging filter subprocess outlives deadline and its whole process group is killed
  ---
  duration_ms: 594.401016
  type: 'test'
  ...
# Subtest: delayed process filter failing after HEAD moved records files across reload
ok 488 - delayed process filter failing after HEAD moved records files across reload
  ---
  duration_ms: 213.071336
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
# duration_ms 34544.140421
```

## Choices

none
