# R1-B report

## File state

- `viewer/test/wc-tool.test.js`: detect python3 on PATH and guard only the Python starter live checks; creation, manifest, mode, and flag checks remain unconditional.
- `docs/plans/easy-tools-solid/reports/R1-B.md`: this report.

Both requested commands passed. Their PATH contains `/usr/bin/python3`, so an additional isolated PATH was used. The first isolated run failed because the unrelated script starter needs `cat`; adding `cat` made the Python-free run pass.

## Validation

### `node --test viewer/test/wc-tool.test.js`

```text
exit 0
TAP version 13
# Subtest: templates work, reject existing folders and names, and use checkout top
ok 1 - templates work, reject existing folders and names, and use checkout top
  ---
  duration_ms: 599.245207
  type: 'test'
  ...
# Subtest: server languages and new argument validation
ok 2 - server languages and new argument validation
  ---
  duration_ms: 752.107966
  type: 'test'
  ...
# Subtest: session list reads pinned shared tools and hides collisions
ok 3 - session list reads pinned shared tools and hides collisions
  ---
  duration_ms: 95.210397
  type: 'test'
  ...
# Subtest: run and check sanitize environment and report failures
ok 4 - run and check sanitize environment and report failures
  ---
  duration_ms: 338.34282
  type: 'test'
  ...
# Subtest: check deadline and SIGTERM kill stalled server and grandchild
ok 5 - check deadline and SIGTERM kill stalled server and grandchild
  ---
  duration_ms: 1374.070932
  type: 'test'
  ...
# Subtest: keyed lists report session status, unavailable sessions, failure and scratch checkout
ok 6 - keyed lists report session status, unavailable sessions, failure and scratch checkout
  ---
  duration_ms: 464.95473
  type: 'test'
  ...
# Subtest: keyed server lists report key status
ok 7 - keyed server lists report key status
  ---
  duration_ms: 445.878533
  type: 'test'
  ...
# Subtest: keyed check and run describe key handling while preserving caller environment
ok 8 - keyed check and run describe key handling while preserving caller environment
  ---
  duration_ms: 332.682153
  type: 'test'
  ...
# Subtest: check handshakes unkeyed and keyed HTTP servers and list reports transport
ok 9 - check handshakes unkeyed and keyed HTTP servers and list reports transport
  ---
  duration_ms: 206.093275
  type: 'test'
  ...
# Subtest: check reports HTTP server failures with the keyed note only for keyed tools
ok 10 - check reports HTTP server failures with the keyed note only for keyed tools
  ---
  duration_ms: 133.111327
  type: 'test'
  ...
# Subtest: check deadline on a stalled HTTP server reports a timeout and closes its session
ok 11 - check deadline on a stalled HTTP server reports a timeout and closes its session
  ---
  duration_ms: 1956.389817
  type: 'test'
  ...
# Subtest: check skips the live handshake only for Windows HTTP servers on WSL
ok 12 - check skips the live handshake only for Windows HTTP servers on WSL
  ---
  duration_ms: 218.503635
  type: 'test'
  ...
# Subtest: bridge reports keys added after the tool was offered
ok 13 - bridge reports keys added after the tool was offered
  ---
  duration_ms: 51.693415
  type: 'test'
  ...
# Subtest: machine keyed runs handle results, transport failures, and local fallback
ok 14 - machine keyed runs handle results, transport failures, and local fallback
  ---
  duration_ms: 455.29846
  type: 'test'
  ...
# Subtest: machine run reports refusal after successful discovery
ok 15 - machine run reports refusal after successful discovery
  ---
  duration_ms: 59.025599
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7549.477272
```

### `PATH="$(dirname "$(command -v node)"):$(dirname "$(command -v git)")" node --test viewer/test/wc-tool.test.js`

```text
exit 0
TAP version 13
# Subtest: templates work, reject existing folders and names, and use checkout top
ok 1 - templates work, reject existing folders and names, and use checkout top
  ---
  duration_ms: 513.816173
  type: 'test'
  ...
# Subtest: server languages and new argument validation
ok 2 - server languages and new argument validation
  ---
  duration_ms: 664.038763
  type: 'test'
  ...
# Subtest: session list reads pinned shared tools and hides collisions
ok 3 - session list reads pinned shared tools and hides collisions
  ---
  duration_ms: 78.211115
  type: 'test'
  ...
# Subtest: run and check sanitize environment and report failures
ok 4 - run and check sanitize environment and report failures
  ---
  duration_ms: 305.677994
  type: 'test'
  ...
# Subtest: check deadline and SIGTERM kill stalled server and grandchild
ok 5 - check deadline and SIGTERM kill stalled server and grandchild
  ---
  duration_ms: 1371.833789
  type: 'test'
  ...
# Subtest: keyed lists report session status, unavailable sessions, failure and scratch checkout
ok 6 - keyed lists report session status, unavailable sessions, failure and scratch checkout
  ---
  duration_ms: 438.630382
  type: 'test'
  ...
# Subtest: keyed server lists report key status
ok 7 - keyed server lists report key status
  ---
  duration_ms: 450.677815
  type: 'test'
  ...
# Subtest: keyed check and run describe key handling while preserving caller environment
ok 8 - keyed check and run describe key handling while preserving caller environment
  ---
  duration_ms: 308.931627
  type: 'test'
  ...
# Subtest: check handshakes unkeyed and keyed HTTP servers and list reports transport
ok 9 - check handshakes unkeyed and keyed HTTP servers and list reports transport
  ---
  duration_ms: 209.410077
  type: 'test'
  ...
# Subtest: check reports HTTP server failures with the keyed note only for keyed tools
ok 10 - check reports HTTP server failures with the keyed note only for keyed tools
  ---
  duration_ms: 137.287881
  type: 'test'
  ...
# Subtest: check deadline on a stalled HTTP server reports a timeout and closes its session
ok 11 - check deadline on a stalled HTTP server reports a timeout and closes its session
  ---
  duration_ms: 1963.489233
  type: 'test'
  ...
# Subtest: check skips the live handshake only for Windows HTTP servers on WSL
ok 12 - check skips the live handshake only for Windows HTTP servers on WSL
  ---
  duration_ms: 235.110156
  type: 'test'
  ...
# Subtest: bridge reports keys added after the tool was offered
ok 13 - bridge reports keys added after the tool was offered
  ---
  duration_ms: 51.888168
  type: 'test'
  ...
# Subtest: machine keyed runs handle results, transport failures, and local fallback
ok 14 - machine keyed runs handle results, transport failures, and local fallback
  ---
  duration_ms: 443.148178
  type: 'test'
  ...
# Subtest: machine run reports refusal after successful discovery
ok 15 - machine run reports refusal after successful discovery
  ---
  duration_ms: 57.678261
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7285.804865
```

### `PATH=/tmp/r1b-validation/bin node --test viewer/test/wc-tool.test.js (node and git only)`

```text
exit 1
TAP version 13
# Subtest: templates work, reject existing folders and names, and use checkout top
not ok 1 - templates work, reject existing folders and names, and use checkout top
  ---
  duration_ms: 317.5852
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-75ffcfd42cfb-w9/viewer/test/wc-tool.test.js:19:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /hello/. Input:
    
    'Input: \n'
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual: |-
    Input: 
    
  operator: 'match'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-75ffcfd42cfb-w9/viewer/test/wc-tool.test.js:23:117)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
# Subtest: server languages and new argument validation
ok 2 - server languages and new argument validation
  ---
  duration_ms: 532.503374
  type: 'test'
  ...
# Subtest: session list reads pinned shared tools and hides collisions
ok 3 - session list reads pinned shared tools and hides collisions
  ---
  duration_ms: 74.327949
  type: 'test'
  ...
# Subtest: run and check sanitize environment and report failures
ok 4 - run and check sanitize environment and report failures
  ---
  duration_ms: 300.658148
  type: 'test'
  ...
# Subtest: check deadline and SIGTERM kill stalled server and grandchild
ok 5 - check deadline and SIGTERM kill stalled server and grandchild
  ---
  duration_ms: 1369.699658
  type: 'test'
  ...
# Subtest: keyed lists report session status, unavailable sessions, failure and scratch checkout
ok 6 - keyed lists report session status, unavailable sessions, failure and scratch checkout
  ---
  duration_ms: 450.844031
  type: 'test'
  ...
# Subtest: keyed server lists report key status
ok 7 - keyed server lists report key status
  ---
  duration_ms: 474.084338
  type: 'test'
  ...
# Subtest: keyed check and run describe key handling while preserving caller environment
ok 8 - keyed check and run describe key handling while preserving caller environment
  ---
  duration_ms: 300.8369
  type: 'test'
  ...
# Subtest: check handshakes unkeyed and keyed HTTP servers and list reports transport
ok 9 - check handshakes unkeyed and keyed HTTP servers and list reports transport
  ---
  duration_ms: 210.141264
  type: 'test'
  ...
# Subtest: check reports HTTP server failures with the keyed note only for keyed tools
ok 10 - check reports HTTP server failures with the keyed note only for keyed tools
  ---
  duration_ms: 139.815738
  type: 'test'
  ...
# Subtest: check deadline on a stalled HTTP server reports a timeout and closes its session
ok 11 - check deadline on a stalled HTTP server reports a timeout and closes its session
  ---
  duration_ms: 1957.926341
  type: 'test'
  ...
# Subtest: check skips the live handshake only for Windows HTTP servers on WSL
ok 12 - check skips the live handshake only for Windows HTTP servers on WSL
  ---
  duration_ms: 192.345134
  type: 'test'
  ...
# Subtest: bridge reports keys added after the tool was offered
ok 13 - bridge reports keys added after the tool was offered
  ---
  duration_ms: 51.930568
  type: 'test'
  ...
# Subtest: machine keyed runs handle results, transport failures, and local fallback
ok 14 - machine keyed runs handle results, transport failures, and local fallback
  ---
  duration_ms: 434.351479
  type: 'test'
  ...
# Subtest: machine run reports refusal after successful discovery
ok 15 - machine run reports refusal after successful discovery
  ---
  duration_ms: 58.250838
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 14
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6926.882371
```

### `PATH=/tmp/r1b-validation/bin node --test viewer/test/wc-tool.test.js (node, git, and cat)`

```text
exit 0
TAP version 13
# Subtest: templates work, reject existing folders and names, and use checkout top
ok 1 - templates work, reject existing folders and names, and use checkout top
  ---
  duration_ms: 488.741294
  type: 'test'
  ...
# Subtest: server languages and new argument validation
ok 2 - server languages and new argument validation
  ---
  duration_ms: 475.382051
  type: 'test'
  ...
# Subtest: session list reads pinned shared tools and hides collisions
ok 3 - session list reads pinned shared tools and hides collisions
  ---
  duration_ms: 68.74542
  type: 'test'
  ...
# Subtest: run and check sanitize environment and report failures
ok 4 - run and check sanitize environment and report failures
  ---
  duration_ms: 261.524551
  type: 'test'
  ...
# Subtest: check deadline and SIGTERM kill stalled server and grandchild
ok 5 - check deadline and SIGTERM kill stalled server and grandchild
  ---
  duration_ms: 1370.96315
  type: 'test'
  ...
# Subtest: keyed lists report session status, unavailable sessions, failure and scratch checkout
ok 6 - keyed lists report session status, unavailable sessions, failure and scratch checkout
  ---
  duration_ms: 518.891811
  type: 'test'
  ...
# Subtest: keyed server lists report key status
ok 7 - keyed server lists report key status
  ---
  duration_ms: 515.613478
  type: 'test'
  ...
# Subtest: keyed check and run describe key handling while preserving caller environment
ok 8 - keyed check and run describe key handling while preserving caller environment
  ---
  duration_ms: 331.321387
  type: 'test'
  ...
# Subtest: check handshakes unkeyed and keyed HTTP servers and list reports transport
ok 9 - check handshakes unkeyed and keyed HTTP servers and list reports transport
  ---
  duration_ms: 266.358488
  type: 'test'
  ...
# Subtest: check reports HTTP server failures with the keyed note only for keyed tools
ok 10 - check reports HTTP server failures with the keyed note only for keyed tools
  ---
  duration_ms: 186.444471
  type: 'test'
  ...
# Subtest: check deadline on a stalled HTTP server reports a timeout and closes its session
ok 11 - check deadline on a stalled HTTP server reports a timeout and closes its session
  ---
  duration_ms: 1969.51367
  type: 'test'
  ...
# Subtest: check skips the live handshake only for Windows HTTP servers on WSL
ok 12 - check skips the live handshake only for Windows HTTP servers on WSL
  ---
  duration_ms: 187.324017
  type: 'test'
  ...
# Subtest: bridge reports keys added after the tool was offered
ok 13 - bridge reports keys added after the tool was offered
  ---
  duration_ms: 47.500973
  type: 'test'
  ...
# Subtest: machine keyed runs handle results, transport failures, and local fallback
ok 14 - machine keyed runs handle results, transport failures, and local fallback
  ---
  duration_ms: 431.049421
  type: 'test'
  ...
# Subtest: machine run reports refusal after successful discovery
ok 15 - machine run reports refusal after successful discovery
  ---
  duration_ms: 63.641393
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7246.661305
```

## Choices

- Isolated PATH validation: included `cat` alongside `node` and `git` because the existing script-starter test requires it; Python remained absent.

## Not done

None.
