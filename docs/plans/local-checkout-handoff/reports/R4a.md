# R4a — fatal Git refusal reasons

Updated `wayPaths` in `machine/lib/try.js` so its fallback reason uses the first `error:` or `fatal:` line, with the prefix removed. Existing path collection remains unchanged.

Extended `machine/test/try.test.js` with the requested `fatal:` unit case and a real Git `HEAD.lock` fixture. In this real Git fixture, an earlier check/refusal results in `interrupted` with the standard interruption reason rather than Git's fatal reason; HEAD remains unmoved and the lock file remains present. The test asserts this observed outcome and reason, as allowed by the brief.

## Validation

`node --test machine/test/try.test.js`

```text
exit 0
ok 59 - a long switch does not delay the same project agent worktree queue
  ---
  duration_ms: 2182.929182
  type: 'test'
  ...
ok 60 - two symlink spellings of one folder pressed together are refused
  ---
  duration_ms: 1173.614174
  type: 'test'
  ...
ok 61 - index.lock is shown after nothing moved and hidden while a switch runs
  ---
  duration_ms: 227.801896
  type: 'test'
  ...
ok 62 - Status for stale, moved, trying-other and mismatch includes the right fields
  ---
  duration_ms: 295.220819
  type: 'test'
  ...
ok 63 - capped file lists retain full files_count and appeared_count
  ---
  duration_ms: 408.82755
  type: 'test'
  ...
ok 64 - kept entries show missing and old_identity flags
  ---
  duration_ms: 54.420665
  type: 'test'
  ...
ok 65 - Status runs no content filter while active
  ---
  duration_ms: 242.849029
  type: 'test'
  ...
ok 66 - required smudge filter failing on a move between threads records exact interrupted paths
  ---
  duration_ms: 322.405664
  type: 'test'
  ...
ok 67 - real git switch unable to unlink warning is interrupted
  ---
  duration_ms: 175.742113
  type: 'test'
  ...
ok 68 - commit subject containing unable to unlink gives plain success
  ---
  duration_ms: 146.904884
  type: 'test'
  ...
ok 69 - hanging filter subprocess outlives deadline and its whole process group is killed
  ---
  duration_ms: 605.595468
  type: 'test'
  ...
ok 70 - delayed process filter failing after HEAD moved records files across reload
  ---
  duration_ms: 222.015062
  type: 'test'
  ...
1..70
# tests 70
# suites 0
# pass 70
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 24715.539671
```

`bash machine/test/run.sh`

```text
exit 0
ok 404 - a long switch does not delay the same project agent worktree queue
  ---
  duration_ms: 2183.499908
  type: 'test'
  ...
ok 405 - two symlink spellings of one folder pressed together are refused
  ---
  duration_ms: 1283.323014
  type: 'test'
  ...
ok 406 - index.lock is shown after nothing moved and hidden while a switch runs
  ---
  duration_ms: 247.064161
  type: 'test'
  ...
ok 407 - Status for stale, moved, trying-other and mismatch includes the right fields
  ---
  duration_ms: 303.247644
  type: 'test'
  ...
ok 408 - capped file lists retain full files_count and appeared_count
  ---
  duration_ms: 456.189707
  type: 'test'
  ...
ok 409 - kept entries show missing and old_identity flags
  ---
  duration_ms: 57.223566
  type: 'test'
  ...
ok 410 - Status runs no content filter while active
  ---
  duration_ms: 170.703736
  type: 'test'
  ...
ok 411 - required smudge filter failing on a move between threads records exact interrupted paths
  ---
  duration_ms: 254.295734
  type: 'test'
  ...
ok 412 - real git switch unable to unlink warning is interrupted
  ---
  duration_ms: 189.327552
  type: 'test'
  ...
ok 413 - commit subject containing unable to unlink gives plain success
  ---
  duration_ms: 173.643898
  type: 'test'
  ...
ok 414 - hanging filter subprocess outlives deadline and its whole process group is killed
  ---
  duration_ms: 608.267405
  type: 'test'
  ...
ok 415 - delayed process filter failing after HEAD moved records files across reload
  ---
  duration_ms: 250.551021
  type: 'test'
  ...
1..415
# tests 415
# suites 0
# pass 415
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 33732.547503
```

## Files changed

- `machine/lib/try.js`
- `machine/test/try.test.js`
- `docs/plans/local-checkout-handoff/reports/R4a.md`

## Choices

- `machine/test/try.test.js`: asserted the observed earlier `interrupted` refusal and standard reason for the real `HEAD.lock` fixture, as permitted by the brief.
