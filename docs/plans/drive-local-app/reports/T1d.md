# T1d — screen manager

## Changes

- `machine/lib/screen.js`: per-session queued screen lifecycle, durable generations and counters, user-slice fencing, app launch and environment, screenshots and input delegation, immediate and graceful teardown, startup recovery and sweep.
- `machine/service.js`: route, manager lifecycle hooks, stop/archive cleanup, and shared launch environment extraction. The original tmux command remains unchanged.
- `machine/test/screen.test.js`: fake-tool manager and route coverage, including registration races, teardown deadlines, archive retention, screenshot numbering and input-lock integration.
- `machine/test/service.test.js`: add `systemctl` to its fake executable list.

Validation below used T1c commit `0f4c36c`, cherry-picked as `16efc8d`, as requested by the sub-lead. T1c's follow-up fixes were not included in this validation. No disagreement between the brief and the Spec was identified.

## Validation mapping

The parsing tests are T1a's and the X-tool tests are T1c's; the manager tests exercise their integration through the HTTP route or the actual service lifecycle where practical.

| Spec validation item | Test name |
|---|---|
| Start, idempotence, screen isolation, no screen, screen stop/start, session stop | `screen lifecycle and isolation` |
| Rebuilt launch environment, no token, scope and sandbox wrapping, overrides | `run rebuilds environment, sandbox and command validation`; `systemd versions and executable option-like commands` |
| Reviewer, size limit, unavailable tmux | `route rejects reviewer, invalid size and unavailable tmux`; `operation shapes and basic validation` |
| Fixed key list, invalid tokens, duplicate modifiers and token limits | `fixed key grammar and limits` |
| Held keys, failed keydown and release | `keys: taps, hold order and failed keydown releases` |
| Text validation, literal option and length | `text is literal and limited`; `type: literal option and scaled timeout` |
| Command with equals or lone dash, literal `--help`, missing command, quick exit | `run separates literal environment and command`; `run rebuilds environment, sandbox and command validation`; `systemd versions and executable option-like commands`; `run focus failure succeeds and a finished app is reported exited` |
| Screenshot paths survive stop and restart | `screenshot numbers survive stop and startup` |
| Window listing, screenshot argv and crop | `windows: viewable direct children, untitled, empty and vanished`; `shot: full screen, clipped window, off screen and ffmpeg errors` |
| Auto-focus new window, timeout and probe/focus failure | `autofocus: baseline, first new window, none, failure and stalled probe`; `focus failure after a new window opens still returns a successful run` |
| systemd version flag | `run rebuilds environment, sandbox and command validation`; `systemd versions and executable option-like commands` |
| Late scope registration fenced, reserved starting generation protected from sweep | `starting generation survives sweep and late registration is fenced` |
| Sweep removes unheld older generation, retains current generation | `generation reservation and sweep preserve current slice` |
| Archive thread kill, generation bumps and shared one-second kill/stop deadline | `archive tears down one thread slice and bumps each generation`; `immediate teardown shares its deadline when stop stalls` |
| Key deadline, cutoff tap release, parallel releases and input lock | `keys: deadline cuts tap, releases it, and stops further taps`; `keys: failed and stalled releases lock input without starving others`; `failed key release locks input until screen stop` |
| Archive retains or removes screen directory with uploads | `archive removes screen files and keeps them with an unfinished rebase` |
| Missing tools, no user bus | `missing tools and unavailable user bus` |
| Dead or uncheckable tmux, dead Xvfb | `route rejects reviewer, invalid size and unavailable tmux`; `tmux disappearance kills the screen and dead Xvfb is treated as absent` |
| Graceful screen/sweep teardown; immediate verifier teardown; startup cleanup and deadline | `screen lifecycle and isolation`; `generation reservation and sweep preserve current slice`; `graceful screen stop escalates after three seconds`; `session stop kills the screen before removing a verifier worktree`; `startup clears its own parent and retains counters`; `startup bounds stalled systemctl and still clears durable state` |
| Pointer, type and focus argv | `pointer: exact move click drag and release on failure`; `type: literal option and scaled timeout`; `focus: exact argv and failure` |

## Validation output

A fake `systemctl` was placed first on PATH for the final validation commands. The initial viewer run, before that PATH guard was added, accidentally invoked the real `systemctl --user` from the existing viewer integration fixture during startup; the target names were derived from each fixture's temporary state directory. That run reported one failure in `archive through the hub cancels a stalled upload to the real machine` because the machine registry did not contain the expected lead; 637 of 638 tests passed. Its cause was not established, and the complete failure output is retained in the scratch log. The later viewer run below is the single retry.

The viewer gate failed twice, so the worker stopped rather than retrying or changing code. The repeated failure was the archive/upload test; the retry also failed the sudo-warning test with a `TypeError` and the pruning test because the selected port was held by an unidentified process. No baseline run without the change established whether any of these failures pre-existed.

### `node --test machine/test/screen.test.js`

```text
exit 0
# Subtest: failed key release locks input until screen stop
ok 15 - failed key release locks input until screen stop
  ---
  duration_ms: 708.793055
  type: 'test'
  ...
# Subtest: tmux disappearance kills the screen and dead Xvfb is treated as absent
ok 16 - tmux disappearance kills the screen and dead Xvfb is treated as absent
  ---
  duration_ms: 543.314083
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-762c7e88eac6.slice
# Subtest: startup bounds stalled systemctl and still clears durable state
ok 17 - startup bounds stalled systemctl and still clears durable state
  ---
  duration_ms: 2236.651732
  type: 'test'
  ...
# Subtest: focus failure after a new window opens still returns a successful run
ok 18 - focus failure after a new window opens still returns a successful run
  ---
  duration_ms: 653.429439
  type: 'test'
  ...
# Subtest: graceful screen stop escalates after three seconds
ok 19 - graceful screen stop escalates after three seconds
  ---
  duration_ms: 3377.69799
  type: 'test'
  ...
1..19
# tests 19
# suites 0
# pass 19
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15204.437639
```

### `bash machine/test/run.sh`

```text
exit 0
ok 199 - classifies both CLI tool tables and labels and keys
  ---
  duration_ms: 38.132691
  type: 'test'
  ...
# Subtest: Claude step hooks omit raw input and map ends
ok 200 - Claude step hooks omit raw input and map ends
  ---
  duration_ms: 0.953769
  type: 'test'
  ...
# Subtest: statusline independently throttles and spools both events
ok 201 - statusline independently throttles and spools both events
  ---
  duration_ms: 512.714157
  type: 'test'
  ...
# Subtest: empty commands, command arrays and empty patches have useful labels and keys
ok 202 - empty commands, command arrays and empty patches have useful labels and keys
  ---
  duration_ms: 0.624678
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40183
# machine service listening on 127.0.0.1:40183
# Subtest: sudo registration, delivery, recovery and cancel preserve outcomes
ok 203 - sudo registration, delivery, recovery and cancel preserve outcomes
  ---
  duration_ms: 275.123525
  type: 'test'
  ...
1..203
# tests 203
# suites 0
# pass 203
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 48902.942123
```

### `node --test viewer/test/*.test.js`

```text
exit 1
ok 622 - binary counts zero and errors are prefixed
  ---
  duration_ms: 530.816315
  type: 'test'
  ...
# Subtest: session output compact and full
ok 623 - session output compact and full
  ---
  duration_ms: 787.011885
  type: 'test'
  ...
1..623
# tests 638
# suites 0
# pass 635
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 116620.068178
```

### Viewer failure details, first run

```text
not ok 413 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 6239.085936
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/app-uploads-archive.test.js:65:1'
  failureType: 'testCodeFailure'
  error: |-
    The expression evaluated to a falsy value:
    
      assert.ok(Object.values(context.instance.sessions).some(session => session.thread_id === made.id && session.role === 'lead'))
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/app-uploads-archive.test.js:72:12)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# machine: screen startup cleanup failed: wcscreen-12391aeb5764.slice
```

### Viewer failure details, second run

```text
not ok 390 - the hub stores machine approval warnings
  ---
  duration_ms: 1963.142996
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/app-sudo.test.js:105:1'
  failureType: 'testCodeFailure'
  error: "Cannot read properties of undefined (reading '0')"
  code: 'ERR_TEST_FAILURE'
  name: 'TypeError'
  stack: |-
    post (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/app-sudo.test.js:66:57)
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/app-sudo.test.js:110:26)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: sudo validation: the agent sends only command, does and why
ok 391 - sudo validation: the agent sends only command, does and why
  ---
  duration_ms: 1.610618
  type: 'test'
  ...
# Subtest: sudo validation: agent-side role check refuses everyone but a lead
not ok 413 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 5273.589885
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/app-uploads-archive.test.js:65:1'
  failureType: 'testCodeFailure'
  error: |-
    The expression evaluated to a falsy value:
    
      assert.ok(Object.values(context.instance.sessions).some(session => session.thread_id === made.id && session.role === 'lead'))
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/app-uploads-archive.test.js:72:12)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# machine service listening on 127.0.0.1:36755
not ok 546 - list-build pruning writes only when it removes entries and never rewrites again within an hour
  ---
  duration_ms: 349.80077
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/routes.test.js:232:1'
  failureType: 'testCodeFailure'
  error: |-
    server exited 1: Refused to use a port held by a process it cannot identify.
    
  code: 'ERR_TEST_FAILURE'
  stack: |-
    ChildProcess.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-940599e3df66-w6/viewer/test/routes.test.js:43:64)
    Object.onceWrapper (node:events:634:26)
    ChildProcess.emit (node:events:531:35)
    ChildProcess._handle.onexit (node:internal/child_process:293:12)
  ...
# Subtest: GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
ok 547 - GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
  ---
  duration_ms: 270.410634
  type: 'test'
  ...
# Subtest: a remember cookie reads the graph page, list, plan, document, and graph
```

### `git diff --stat wc/940599e3df66...HEAD`

```text
 docs/plans/drive-local-app/reports/T1c.md | 154 ++++++++++++++++++++
 machine/lib/screen-input.js               | 124 ++++++++++++++++
 machine/lib/screen.js                     | 234 ++++++++++++++++++++++++++++++
 machine/service.js                        |  18 ++-
 machine/test/screen-input.test.js         |  46 ++++++
 machine/test/screen.test.js               | 233 +++++++++++++++++++++++++++++
 machine/test/service.test.js              |   2 +-
 7 files changed, 808 insertions(+), 3 deletions(-)
```

## Choices

- `screen.js`: status app entries use `{n, state, log}`; the Spec names the data but does not give those field names.
- `screen.test.js`: the HTTP fixture registers test sessions directly, so route calls exercise token authentication without relying on a real tmux or CLI.

## Outstanding

The viewer validation gate has failed twice and needs investigation by the sub-lead. Validation was against the first T1c input-layer commit, not the announced follow-up fixes.
