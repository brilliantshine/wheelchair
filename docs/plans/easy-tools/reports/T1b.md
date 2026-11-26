# T1b report

- `machine/lib/tool-launch.js:34` waits for child close before exiting with its status. The event-order regression is covered at `machine/test/folder-tools-run.test.js:49`; a real launcher round trip and exit status are covered at `machine/test/folder-tools-run.test.js:26`.
- `machine/lib/tool-launch.js:11` reports missing, malformed and invalid descriptions with the discovery reason, and `machine/lib/tool-launch.js:33` reports the program that cannot start; coverage is at `machine/test/folder-tools-run.test.js:19`.
- `machine/lib/tool-bridge.js:9` and `machine/lib/tool-launch.js:9` reject a missing project directory; `machine/test/folder-tools-run.test.js:19` checks both.
- `machine/lib/folder-tools.js:42` treats ENOTDIR as absent; `machine/lib/folder-tools.js:50` preserves other per-tool read errors as invalid rows, covered at `machine/test/folder-tools.test.js:68`.
- `machine/lib/tool-run.js:20` keeps the timeout until resolution; `machine/lib/tool-run.js:21` terminates the group and closes inherited pipes two seconds after the script exits, covered at `machine/test/folder-tools-run.test.js:39` and `machine/test/folder-tools-run.test.js:43`.
- `machine/lib/folder-tools.js:8` distinguishes missing fields from invalid values, and `machine/lib/folder-tools.js:15` rejects empty argv elements; `machine/test/folder-tools.test.js:26` covers these.
- `machine/lib/folder-tools.js:70` omits empty required lists. Size boundaries, entry shapes, schema, discovery and program checks are covered at `machine/test/folder-tools.test.js:39`, `machine/test/folder-tools.test.js:50` and `machine/test/folder-tools.test.js:58`.
- `machine/test/folder-tools-run.test.js:12` gives bridge cleanup a 60-second call timeout; `machine/test/folder-tools-run.test.js:30` covers initialize, ping, unknown methods and a full server tool call; `machine/test/folder-tools-run.test.js:35` covers parallel calls; `machine/test/folder-tools-run.test.js:46` covers SIGKILL escalation.

## Mutation checks

I broke and restored the relevant code and watched each of these tests fail: `valid JSON size boundary`; `required and invalid fields have distinct reasons; argv elements and limits`; `entry shapes and input schema`; `missing server program, real PATH, and non-executable relative program`; `non-directory tools path and per-tool read errors`; `bridge stdin stops tool group`; `launcher errors and required project directory`; `launcher drains output and propagates child exit`; `launcher waits for stdout after child exit`; `launcher serves MCP round trip and stdio methods`; `parallel bridge calls complete`; `exited script cannot leave pipes open`; `timeout stays active while exited script leaves pipes open`; `SIGKILL follows timeout when script ignores SIGTERM`.

The original real-process launcher drain assertion survived replacing `close` with `exit`; the added controlled event-order test failed under that mutation, and was restored. The SIGKILL test was checked by delaying escalation from five to ten seconds.

## Choices

- `machine/lib/tool-run.js`: after the two-second drain deadline, destroy the local pipe readers after sending SIGTERM so a descendant ignoring SIGTERM cannot keep the call open; the existing detached reaper still sends SIGKILL.
- `machine/test/folder-tools-run.test.js`: use a spawned-process shim to deterministically deliver child exit before its final stdout and close events.

- `machine/lib/mcp-stdio.js`: an already-aborted signal avoids spawning the server at all.

## Validation

The first targeted run failed because the fixture itself waited on its spawned child; adding `unref()` made it exercise an exited parent.

### `node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js (first run)`

Exit 1.

```text
TAP version 13
# Subtest: bridge schema, call, environment and changed description
ok 1 - bridge schema, call, environment and changed description
  ---
  duration_ms: 57.459502
  type: 'test'
  ...
# Subtest: runner errors, stderr tail and output cap
ok 2 - runner errors, stderr tail and output cap
  ---
  duration_ms: 60.346897
  type: 'test'
  ...
# Subtest: handshake lists tools and times out on silent server
ok 3 - handshake lists tools and times out on silent server
  ---
  duration_ms: 1026.74258
  type: 'test'
  ...
# Subtest: timeout kills the script process group
ok 4 - timeout kills the script process group
  ---
  duration_ms: 1007.376518
  type: 'test'
  ...
# Subtest: bridge stdin stops tool group
ok 5 - bridge stdin stops tool group
  ---
  duration_ms: 105.122034
  type: 'test'
  ...
# Subtest: bridge signal stops tool group
ok 6 - bridge signal stops tool group
  ---
  duration_ms: 105.95983
  type: 'test'
  ...
# Subtest: launcher stdin close stops server group
ok 7 - launcher stdin close stops server group
  ---
  duration_ms: 104.119623
  type: 'test'
  ...
# Subtest: bridge reports exit code and stderr
ok 8 - bridge reports exit code and stderr
  ---
  duration_ms: 47.385621
  type: 'test'
  ...
# Subtest: handshake deadline kills server descendants
ok 9 - handshake deadline kills server descendants
  ---
  duration_ms: 1003.932837
  type: 'test'
  ...
# Subtest: launcher SIGTERM stops server group
ok 10 - launcher SIGTERM stops server group
  ---
  duration_ms: 103.260405
  type: 'test'
  ...
# Subtest: launcher errors and required project directory
ok 11 - launcher errors and required project directory
  ---
  duration_ms: 124.739177
  type: 'test'
  ...
# Subtest: launcher drains output and propagates child exit
ok 12 - launcher drains output and propagates child exit
  ---
  duration_ms: 54.580353
  type: 'test'
  ...
# Subtest: launcher serves MCP round trip and stdio methods
ok 13 - launcher serves MCP round trip and stdio methods
  ---
  duration_ms: 46.501216
  type: 'test'
  ...
# Subtest: parallel bridge calls complete
ok 14 - parallel bridge calls complete
  ---
  duration_ms: 248.639216
  type: 'test'
  ...
# Subtest: exited script cannot leave pipes open
not ok 15 - exited script cannot leave pipes open
  ---
  duration_ms: 10020.048303
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w4/machine/test/folder-tools-run.test.js:39:1'
  failureType: 'testCodeFailure'
  error: |-
    The expression evaluated to a falsy value:
    
      assert.ok(Date.now()-start<4000)
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: '=='
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w4/machine/test/folder-tools-run.test.js:41:108)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: timeout stays active while exited script leaves pipes open
ok 16 - timeout stays active while exited script leaves pipes open
  ---
  duration_ms: 1007.514789
  type: 'test'
  ...
# Subtest: SIGKILL follows timeout when script ignores SIGTERM
ok 17 - SIGKILL follows timeout when script ignores SIGTERM
  ---
  duration_ms: 6027.48719
  type: 'test'
  ...
# Subtest: description validation and normalization
ok 18 - description validation and normalization
  ---
  duration_ms: 2.55099
  type: 'test'
  ...
# Subtest: directory reading, collision, programs and entries
ok 19 - directory reading, collision, programs and entries
  ---
  duration_ms: 16.528873
  type: 'test'
  ...
# Subtest: required and invalid fields have distinct reasons; argv elements and limits
ok 20 - required and invalid fields have distinct reasons; argv elements and limits
  ---
  duration_ms: 0.252023
  type: 'test'
  ...
# Subtest: valid JSON size boundary
ok 21 - valid JSON size boundary
  ---
  duration_ms: 2.33717
  type: 'test'
  ...
# Subtest: entry shapes and input schema
ok 22 - entry shapes and input schema
  ---
  duration_ms: 0.478788
  type: 'test'
  ...
# Subtest: missing server program, real PATH, and non-executable relative program
ok 23 - missing server program, real PATH, and non-executable relative program
  ---
  duration_ms: 2.604232
  type: 'test'
  ...
# Subtest: non-directory tools path and per-tool read errors
ok 24 - non-directory tools path and per-tool read errors
  ---
  duration_ms: 1.33054
  type: 'test'
  ...
1..24
# tests 24
# suites 0
# pass 23
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 21204.097467
```

### `node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js (after fixture correction)`

Exit 0.

```text
TAP version 13
# Subtest: bridge schema, call, environment and changed description
ok 1 - bridge schema, call, environment and changed description
  ---
  duration_ms: 125.485707
  type: 'test'
  ...
# Subtest: runner errors, stderr tail and output cap
ok 2 - runner errors, stderr tail and output cap
  ---
  duration_ms: 138.763748
  type: 'test'
  ...
# Subtest: handshake lists tools and times out on silent server
ok 3 - handshake lists tools and times out on silent server
  ---
  duration_ms: 1058.206379
  type: 'test'
  ...
# Subtest: timeout kills the script process group
ok 4 - timeout kills the script process group
  ---
  duration_ms: 1018.905835
  type: 'test'
  ...
# Subtest: bridge stdin stops tool group
ok 5 - bridge stdin stops tool group
  ---
  duration_ms: 165.055927
  type: 'test'
  ...
# Subtest: bridge signal stops tool group
ok 6 - bridge signal stops tool group
  ---
  duration_ms: 161.235053
  type: 'test'
  ...
# Subtest: launcher stdin close stops server group
ok 7 - launcher stdin close stops server group
  ---
  duration_ms: 158.066078
  type: 'test'
  ...
# Subtest: bridge reports exit code and stderr
ok 8 - bridge reports exit code and stderr
  ---
  duration_ms: 85.319795
  type: 'test'
  ...
# Subtest: handshake deadline kills server descendants
ok 9 - handshake deadline kills server descendants
  ---
  duration_ms: 1013.110236
  type: 'test'
  ...
# Subtest: launcher SIGTERM stops server group
ok 10 - launcher SIGTERM stops server group
  ---
  duration_ms: 170.131887
  type: 'test'
  ...
# Subtest: launcher errors and required project directory
ok 11 - launcher errors and required project directory
  ---
  duration_ms: 283.597583
  type: 'test'
  ...
# Subtest: launcher drains output and propagates child exit
ok 12 - launcher drains output and propagates child exit
  ---
  duration_ms: 115.206153
  type: 'test'
  ...
# Subtest: launcher serves MCP round trip and stdio methods
ok 13 - launcher serves MCP round trip and stdio methods
  ---
  duration_ms: 115.852441
  type: 'test'
  ...
# Subtest: parallel bridge calls complete
ok 14 - parallel bridge calls complete
  ---
  duration_ms: 332.035992
  type: 'test'
  ...
# Subtest: exited script cannot leave pipes open
ok 15 - exited script cannot leave pipes open
  ---
  duration_ms: 2060.243967
  type: 'test'
  ...
# Subtest: timeout stays active while exited script leaves pipes open
ok 16 - timeout stays active while exited script leaves pipes open
  ---
  duration_ms: 1015.1943
  type: 'test'
  ...
# Subtest: SIGKILL follows timeout when script ignores SIGTERM
ok 17 - SIGKILL follows timeout when script ignores SIGTERM
  ---
  duration_ms: 6043.692708
  type: 'test'
  ...
# Subtest: description validation and normalization
ok 18 - description validation and normalization
  ---
  duration_ms: 4.082967
  type: 'test'
  ...
# Subtest: directory reading, collision, programs and entries
ok 19 - directory reading, collision, programs and entries
  ---
  duration_ms: 46.196592
  type: 'test'
  ...
# Subtest: required and invalid fields have distinct reasons; argv elements and limits
ok 20 - required and invalid fields have distinct reasons; argv elements and limits
  ---
  duration_ms: 0.570784
  type: 'test'
  ...
# Subtest: valid JSON size boundary
ok 21 - valid JSON size boundary
  ---
  duration_ms: 7.780404
  type: 'test'
  ...
# Subtest: entry shapes and input schema
ok 22 - entry shapes and input schema
  ---
  duration_ms: 0.759075
  type: 'test'
  ...
# Subtest: missing server program, real PATH, and non-executable relative program
ok 23 - missing server program, real PATH, and non-executable relative program
  ---
  duration_ms: 4.040886
  type: 'test'
  ...
# Subtest: non-directory tools path and per-tool read errors
ok 24 - non-directory tools path and per-tool read errors
  ---
  duration_ms: 3.624297
  type: 'test'
  ...
1..24
# tests 24
# suites 0
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 14146.801453
```

### `bash machine/test/run.sh (first run; last 80 lines)`

Exit 0.

```text
ok 777 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 557.235777
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 778 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 872.406027
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 779 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 1189.263599
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 780 - tracker close callback marks the copy used
  ---
  duration_ms: 457.7607
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 781 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 817.649426
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 782 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 948.27852
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 783 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 531.842172
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 784 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.725981
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 785 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 5.514822
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 786 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 823.847716
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 787 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 484.113133
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 788 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 801.585303
  type: 'test'
  ...
1..788
# tests 788
# suites 0
# pass 786
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 302805.267002
```

### `node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js (after event-order test)`

Exit 0.

```text
TAP version 13
# Subtest: bridge schema, call, environment and changed description
ok 1 - bridge schema, call, environment and changed description
  ---
  duration_ms: 137.515716
  type: 'test'
  ...
# Subtest: runner errors, stderr tail and output cap
ok 2 - runner errors, stderr tail and output cap
  ---
  duration_ms: 128.483342
  type: 'test'
  ...
# Subtest: handshake lists tools and times out on silent server
ok 3 - handshake lists tools and times out on silent server
  ---
  duration_ms: 1073.417104
  type: 'test'
  ...
# Subtest: timeout kills the script process group
ok 4 - timeout kills the script process group
  ---
  duration_ms: 1036.708753
  type: 'test'
  ...
# Subtest: bridge stdin stops tool group
ok 5 - bridge stdin stops tool group
  ---
  duration_ms: 226.451229
  type: 'test'
  ...
# Subtest: bridge signal stops tool group
ok 6 - bridge signal stops tool group
  ---
  duration_ms: 216.71565
  type: 'test'
  ...
# Subtest: launcher stdin close stops server group
ok 7 - launcher stdin close stops server group
  ---
  duration_ms: 168.058387
  type: 'test'
  ...
# Subtest: bridge reports exit code and stderr
ok 8 - bridge reports exit code and stderr
  ---
  duration_ms: 227.559441
  type: 'test'
  ...
# Subtest: handshake deadline kills server descendants
ok 9 - handshake deadline kills server descendants
  ---
  duration_ms: 1026.435559
  type: 'test'
  ...
# Subtest: launcher SIGTERM stops server group
ok 10 - launcher SIGTERM stops server group
  ---
  duration_ms: 120.705081
  type: 'test'
  ...
# Subtest: launcher errors and required project directory
ok 11 - launcher errors and required project directory
  ---
  duration_ms: 319.212359
  type: 'test'
  ...
# Subtest: launcher drains output and propagates child exit
ok 12 - launcher drains output and propagates child exit
  ---
  duration_ms: 146.287754
  type: 'test'
  ...
# Subtest: launcher serves MCP round trip and stdio methods
ok 13 - launcher serves MCP round trip and stdio methods
  ---
  duration_ms: 106.891733
  type: 'test'
  ...
# Subtest: parallel bridge calls complete
ok 14 - parallel bridge calls complete
  ---
  duration_ms: 316.489074
  type: 'test'
  ...
# Subtest: exited script cannot leave pipes open
ok 15 - exited script cannot leave pipes open
  ---
  duration_ms: 2072.195787
  type: 'test'
  ...
# Subtest: timeout stays active while exited script leaves pipes open
ok 16 - timeout stays active while exited script leaves pipes open
  ---
  duration_ms: 1014.958137
  type: 'test'
  ...
# Subtest: SIGKILL follows timeout when script ignores SIGTERM
ok 17 - SIGKILL follows timeout when script ignores SIGTERM
  ---
  duration_ms: 6053.193594
  type: 'test'
  ...
# Subtest: launcher waits for stdout after child exit
ok 18 - launcher waits for stdout after child exit
  ---
  duration_ms: 2060.02017
  type: 'test'
  ...
# Subtest: description validation and normalization
ok 19 - description validation and normalization
  ---
  duration_ms: 3.102912
  type: 'test'
  ...
# Subtest: directory reading, collision, programs and entries
ok 20 - directory reading, collision, programs and entries
  ---
  duration_ms: 48.617527
  type: 'test'
  ...
# Subtest: required and invalid fields have distinct reasons; argv elements and limits
ok 21 - required and invalid fields have distinct reasons; argv elements and limits
  ---
  duration_ms: 0.503755
  type: 'test'
  ...
# Subtest: valid JSON size boundary
ok 22 - valid JSON size boundary
  ---
  duration_ms: 6.662446
  type: 'test'
  ...
# Subtest: entry shapes and input schema
ok 23 - entry shapes and input schema
  ---
  duration_ms: 1.06016
  type: 'test'
  ...
# Subtest: missing server program, real PATH, and non-executable relative program
ok 24 - missing server program, real PATH, and non-executable relative program
  ---
  duration_ms: 7.003139
  type: 'test'
  ...
# Subtest: non-directory tools path and per-tool read errors
ok 25 - non-directory tools path and per-tool read errors
  ---
  duration_ms: 3.469644
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
# duration_ms 16522.645288
```

### `bash machine/test/run.sh (final run; last 80 lines)`

Exit 0.

```text
ok 778 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 1282.380607
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 779 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 1951.700475
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 780 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 3297.034702
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 781 - tracker close callback marks the copy used
  ---
  duration_ms: 1090.134437
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 782 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 1890.487844
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 783 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 1699.254257
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 784 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 1156.685001
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 785 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 1.036274
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 786 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 11.762834
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 787 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 1620.887837
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 788 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 892.305132
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 789 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 1377.188028
  type: 'test'
  ...
1..789
# tests 789
# suites 0
# pass 787
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 327646.147438
```

## Handshake cancellation amendment

`machine/lib/mcp-stdio.js:23` accepts an optional abort signal, returns the specified cancelled result with no retained server information, and reuses process-group termination and its five-second escalation. `machine/lib/mcp-stdio.js:26` removes the abort listener on settlement. `machine/test/folder-tools-run.test.js:55` covers pre-abort, live cancellation with a grandchild, and cancellation after a partial initialize response. The helper remains self-contained.

The three cancellation tests were run against the original code and all failed; the live cancellation test was also observed failing when group SIGTERM was replaced with SIGCONT, then the implementation was restored.

### `node --test --test-name-pattern 'handshake (returns cancelled|abort)' machine/test/folder-tools-run.test.js (before implementation)`

Exit 1.

```text
TAP version 13
# Subtest: handshake returns cancelled for an already aborted signal without starting
not ok 1 - handshake returns cancelled for an already aborted signal without starting
  ---
  duration_ms: 1008.840386
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w4/machine/test/folder-tools-run.test.js:55:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected

      {
    +   error: 'Server handshake timed out',
    -   error: 'cancelled',
        ok: false,
        serverInfo: null,
        tools: null
      }

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    ok: false
    serverInfo: ~
    tools: ~
    error: 'cancelled'
  actual:
    ok: false
    serverInfo: ~
    tools: ~
    error: 'Server handshake timed out'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w4/machine/test/folder-tools-run.test.js:58:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
# Subtest: handshake abort stops an unresponsive server and its grandchild
not ok 2 - handshake abort stops an unresponsive server and its grandchild
  ---
  duration_ms: 3007.719307
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w4/machine/test/folder-tools-run.test.js:60:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected

      {
    +   error: 'Server handshake timed out',
    -   error: 'cancelled',
        ok: false,
        serverInfo: null,
        tools: null
      }

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    ok: false
    serverInfo: ~
    tools: ~
    error: 'cancelled'
  actual:
    ok: false
    serverInfo: ~
    tools: ~
    error: 'Server handshake timed out'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w4/machine/test/folder-tools-run.test.js:65:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: handshake abort discards a partial initialize response
not ok 3 - handshake abort discards a partial initialize response
  ---
  duration_ms: 3005.313593
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w4/machine/test/folder-tools-run.test.js:67:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected

      {
    +   error: 'Server handshake timed out',
    -   error: 'cancelled',
        ok: false,
    +   serverInfo: {
    +     name: 'partial'
    +   },
    -   serverInfo: null,
        tools: null
      }

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    ok: false
    serverInfo: ~
    tools: ~
    error: 'cancelled'
  actual:
    ok: false
    serverInfo:
      name: 'partial'
    tools: ~
    error: 'Server handshake timed out'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w4/machine/test/folder-tools-run.test.js:72:30)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..3
# tests 3
# suites 0
# pass 0
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7066.982352
```

### `node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js`

Exit 0.

```text
TAP version 13
# Subtest: bridge schema, call, environment and changed description
ok 1 - bridge schema, call, environment and changed description
  ---
  duration_ms: 60.744587
  type: 'test'
  ...
# Subtest: runner errors, stderr tail and output cap
ok 2 - runner errors, stderr tail and output cap
  ---
  duration_ms: 58.086898
  type: 'test'
  ...
# Subtest: handshake lists tools and times out on silent server
ok 3 - handshake lists tools and times out on silent server
  ---
  duration_ms: 1029.387796
  type: 'test'
  ...
# Subtest: timeout kills the script process group
ok 4 - timeout kills the script process group
  ---
  duration_ms: 1008.452194
  type: 'test'
  ...
# Subtest: bridge stdin stops tool group
ok 5 - bridge stdin stops tool group
  ---
  duration_ms: 105.072911
  type: 'test'
  ...
# Subtest: bridge signal stops tool group
ok 6 - bridge signal stops tool group
  ---
  duration_ms: 105.430986
  type: 'test'
  ...
# Subtest: launcher stdin close stops server group
ok 7 - launcher stdin close stops server group
  ---
  duration_ms: 105.65177
  type: 'test'
  ...
# Subtest: bridge reports exit code and stderr
ok 8 - bridge reports exit code and stderr
  ---
  duration_ms: 45.518933
  type: 'test'
  ...
# Subtest: handshake deadline kills server descendants
ok 9 - handshake deadline kills server descendants
  ---
  duration_ms: 1003.779726
  type: 'test'
  ...
# Subtest: launcher SIGTERM stops server group
ok 10 - launcher SIGTERM stops server group
  ---
  duration_ms: 53.988087
  type: 'test'
  ...
# Subtest: launcher errors and required project directory
ok 11 - launcher errors and required project directory
  ---
  duration_ms: 120.720765
  type: 'test'
  ...
# Subtest: launcher drains output and propagates child exit
ok 12 - launcher drains output and propagates child exit
  ---
  duration_ms: 51.495141
  type: 'test'
  ...
# Subtest: launcher serves MCP round trip and stdio methods
ok 13 - launcher serves MCP round trip and stdio methods
  ---
  duration_ms: 43.651536
  type: 'test'
  ...
# Subtest: parallel bridge calls complete
ok 14 - parallel bridge calls complete
  ---
  duration_ms: 269.931314
  type: 'test'
  ...
# Subtest: exited script cannot leave pipes open
ok 15 - exited script cannot leave pipes open
  ---
  duration_ms: 2062.047372
  type: 'test'
  ...
# Subtest: timeout stays active while exited script leaves pipes open
ok 16 - timeout stays active while exited script leaves pipes open
  ---
  duration_ms: 1023.142321
  type: 'test'
  ...
# Subtest: SIGKILL follows timeout when script ignores SIGTERM
ok 17 - SIGKILL follows timeout when script ignores SIGTERM
  ---
  duration_ms: 6048.141632
  type: 'test'
  ...
# Subtest: launcher waits for stdout after child exit
ok 18 - launcher waits for stdout after child exit
  ---
  duration_ms: 2035.811862
  type: 'test'
  ...
# Subtest: handshake returns cancelled for an already aborted signal without starting
ok 19 - handshake returns cancelled for an already aborted signal without starting
  ---
  duration_ms: 0.748594
  type: 'test'
  ...
# Subtest: handshake abort stops an unresponsive server and its grandchild
ok 20 - handshake abort stops an unresponsive server and its grandchild
  ---
  duration_ms: 56.542249
  type: 'test'
  ...
# Subtest: handshake abort discards a partial initialize response
ok 21 - handshake abort discards a partial initialize response
  ---
  duration_ms: 56.231054
  type: 'test'
  ...
# Subtest: description validation and normalization
ok 22 - description validation and normalization
  ---
  duration_ms: 1.616296
  type: 'test'
  ...
# Subtest: directory reading, collision, programs and entries
ok 23 - directory reading, collision, programs and entries
  ---
  duration_ms: 17.004673
  type: 'test'
  ...
# Subtest: required and invalid fields have distinct reasons; argv elements and limits
ok 24 - required and invalid fields have distinct reasons; argv elements and limits
  ---
  duration_ms: 0.253586
  type: 'test'
  ...
# Subtest: valid JSON size boundary
ok 25 - valid JSON size boundary
  ---
  duration_ms: 2.277353
  type: 'test'
  ...
# Subtest: entry shapes and input schema
ok 26 - entry shapes and input schema
  ---
  duration_ms: 0.451195
  type: 'test'
  ...
# Subtest: missing server program, real PATH, and non-executable relative program
ok 27 - missing server program, real PATH, and non-executable relative program
  ---
  duration_ms: 1.941399
  type: 'test'
  ...
# Subtest: non-directory tools path and per-tool read errors
ok 28 - non-directory tools path and per-tool read errors
  ---
  duration_ms: 1.77482
  type: 'test'
  ...
1..28
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15397.103572
```

### `bash machine/test/run.sh (last 80 lines)`

Exit 0.

```text
ok 781 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 497.305219
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 782 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 829.886589
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 783 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 1063.540579
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 784 - tracker close callback marks the copy used
  ---
  duration_ms: 435.211625
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 785 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 771.650347
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 786 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 842.801803
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 787 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 508.473635
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 788 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.698007
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 789 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 4.832758
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 790 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 759.80574
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 791 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 446.363549
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 792 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 792.510529
  type: 'test'
  ...
1..792
# tests 792
# suites 0
# pass 790
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 288315.683955
```

