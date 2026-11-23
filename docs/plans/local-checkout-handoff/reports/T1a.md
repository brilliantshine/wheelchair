# T1a — partial implementation

Outcome: **partial; do not treat this as complete or merge for use yet.** The core Try path is implemented and the tests below pass, but the Status timeout guarantee and the complete prescribed fault-injection coverage are still outstanding. In particular, `git()` uses synchronous Git subprocesses with a four-second timeout per command, and Status runs several such commands sequentially; a slow or stuck Git command can therefore block the service and exceed the five-second hub timeout. This needs asynchronous, bounded metadata reads and tests before the feature is ready.

## Files changed

- `machine/lib/try.js`: request validation, record and protected side file, identity, folder lock and generation, deadline-controlled Git runner, scan/filter, outcome table, folder checks, metadata Status and background Try.
- `machine/service.js`: hub-authorized `/v1/try` route and service construction.
- `machine/test/try.test.js`: isolated repository and route tests.
- `machine/API.md`: endpoint documentation, including the unfinished actions.
- `machine/AGENTS.md`: file table entries.
- `docs/plans/local-checkout-handoff/reports/T1a.md`: this report.

## Progress and remaining work

Numbered items 1–5 have implementations and focused checks, although the process-group test does not yet prove child-process SIGTERM/SIGKILL behavior. Items 6–8 have substantial implementations but are not complete against the timing guarantee and exhaustive validation; item 9 leaves pending records untouched and exercises interrupted status on reload. Back, Dismiss and Forget intentionally return `Not built yet`, as assigned to T1b.

The Status/Try portions covered by tests include a clean Try and return pin, same-sha thread change, dirty untracked and staged-rename refusals, an ignored collision, gitlink changes despite `diff.ignoreSubmodules=all`, service-root and operation checks, a required smudge failure on first Try and reload, post-checkout hooks with zero and nonzero exit, lock-file reporting, pending refusal, concurrent Try refusal and busy status, accepted-then-last behavior, stale state, moved commit pinning, identity mismatch through a changed common-dir path, pre-switch scan timeout, lock-generation race, newest target, metadata-only Status with an LFS filter configured, and hub authentication/input validation.

The following Status/Try cases from the validation list still need explicit end-to-end tests: detached first Try; switching to a different thread at a different sha; both directions of ignored/tracked collision and a thread removing an ignore rule; worktrees-dir and real `git am` refusals; smudge failures on a move and a delayed failure after HEAD moved; a hanging filter with descendants that survive SIGTERM and are killed as a group; a long switch concurrent with an agent worktree start; a real switch emitting the removal warning and a commit subject containing that text; index-lock reporting after a nothing-moved outcome; two real symlink aliases pressed concurrently; and the remaining Status states, capped lists and missing/old-identity kept entries. The Back/Dismiss/Forget portions of the validation bullets are left to T1b by the brief. Tests currently exercise the warning override as a unit, not as an actual Git checkout.

The focused suite initially exposed two test-fixture mistakes (missing `path` import, then replacing a repository at the same identity paths rather than changing its common-dir path); both were corrected and the following reruns passed.

## Validation

`node --test machine/test/try.test.js`:

```text
exit 0
ok 14 - post-checkout hook exiting nonzero or printing error follows its exit code
  ---
  duration_ms: 389.706851
  type: 'test'
  ...
# Subtest: gitlink change with diff.ignoreSubmodules=all is refused
ok 15 - gitlink change with diff.ignoreSubmodules=all is refused
  ---
  duration_ms: 182.408965
  type: 'test'
  ...
# Subtest: a second write while one runs refuses at once and Status hides index.lock
ok 16 - a second write while one runs refuses at once and Status hides index.lock
  ---
  duration_ms: 1253.377232
  type: 'test'
  ...
# Subtest: ignored file in the way stays nothing moved with its path listed and file intact
ok 17 - ignored file in the way stays nothing moved with its path listed and file intact
  ---
  duration_ms: 225.257935
  type: 'test'
  ...
# Subtest: a pre-switch scan timing out writes refused in last with no pending
ok 18 - a pre-switch scan timing out writes refused in last with no pending
  ---
  duration_ms: 154.917905
  type: 'test'
  ...
# Subtest: Status lock generation check does not publish interruption across a switch
ok 19 - Status lock generation check does not publish interruption across a switch
  ---
  duration_ms: 80.790484
  type: 'test'
  ...
# Subtest: tracked and staged rename changes are listed and untouched
ok 20 - tracked and staged rename changes are listed and untouched
  ---
  duration_ms: 163.984395
  type: 'test'
  ...
# Subtest: Status for the wheelchair clone returns refused
ok 21 - Status for the wheelchair clone returns refused
  ---
  duration_ms: 51.139323
  type: 'test'
  ...
# Subtest: POST /v1/try requires the hub secret and validates inputs
ok 22 - POST /v1/try requires the hub secret and validates inputs
  ---
  duration_ms: 153.775294
  type: 'test'
  ...
# Subtest: required smudge filter failing on a first Try records interruption across reload
ok 23 - required smudge filter failing on a first Try records interruption across reload
  ---
  duration_ms: 274.206078
  type: 'test'
  ...
# Subtest: folder replaced during a trial shows identity mismatch
ok 24 - folder replaced during a trial shows identity mismatch
  ---
  duration_ms: 237.217332
  type: 'test'
  ...
# Subtest: same thread target advances and Status offers newest
ok 25 - same thread target advances and Status offers newest
  ---
  duration_ms: 350.955235
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
# duration_ms 5808.345773
```

`bash machine/test/run.sh`:

```text
exit 0
ok 359 - post-checkout hook exiting nonzero or printing error follows its exit code
  ---
  duration_ms: 584.2668
  type: 'test'
  ...
# Subtest: gitlink change with diff.ignoreSubmodules=all is refused
ok 360 - gitlink change with diff.ignoreSubmodules=all is refused
  ---
  duration_ms: 177.32042
  type: 'test'
  ...
# Subtest: a second write while one runs refuses at once and Status hides index.lock
ok 361 - a second write while one runs refuses at once and Status hides index.lock
  ---
  duration_ms: 1207.579697
  type: 'test'
  ...
# Subtest: ignored file in the way stays nothing moved with its path listed and file intact
ok 362 - ignored file in the way stays nothing moved with its path listed and file intact
  ---
  duration_ms: 351.943068
  type: 'test'
  ...
# Subtest: a pre-switch scan timing out writes refused in last with no pending
ok 363 - a pre-switch scan timing out writes refused in last with no pending
  ---
  duration_ms: 177.499964
  type: 'test'
  ...
# Subtest: Status lock generation check does not publish interruption across a switch
ok 364 - Status lock generation check does not publish interruption across a switch
  ---
  duration_ms: 94.694848
  type: 'test'
  ...
# Subtest: tracked and staged rename changes are listed and untouched
ok 365 - tracked and staged rename changes are listed and untouched
  ---
  duration_ms: 156.659474
  type: 'test'
  ...
# Subtest: Status for the wheelchair clone returns refused
ok 366 - Status for the wheelchair clone returns refused
  ---
  duration_ms: 61.524882
  type: 'test'
  ...
# Subtest: POST /v1/try requires the hub secret and validates inputs
ok 367 - POST /v1/try requires the hub secret and validates inputs
  ---
  duration_ms: 142.637002
  type: 'test'
  ...
# Subtest: required smudge filter failing on a first Try records interruption across reload
ok 368 - required smudge filter failing on a first Try records interruption across reload
  ---
  duration_ms: 319.055243
  type: 'test'
  ...
# Subtest: folder replaced during a trial shows identity mismatch
ok 369 - folder replaced during a trial shows identity mismatch
  ---
  duration_ms: 270.811209
  type: 'test'
  ...
# Subtest: same thread target advances and Status offers newest
ok 370 - same thread target advances and Status offers newest
  ---
  duration_ms: 490.743998
  type: 'test'
  ...
1..370
# tests 370
# suites 0
# pass 370
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 53110.824244
```

## Choices

- `machine/lib/try.js`: used a random 16-byte hexadecimal record version and an eight-hex-character nonce for pins; the brief specifies randomness but not the version length.
- `machine/lib/try.js`: used plain fallback sentences for Git metadata and scan errors where the Spec does not prescribe exact wording.
