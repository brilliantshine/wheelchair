# T3b — partial result

Outcome: blocked/incomplete. The version gate and status implementation, aside problem plumbing, login state, Pi turn completion, Kimi launch context, and style preview still contain tool-specific dispatch. The remaining grep hits below are unfinished work, not allowable `compat` or `not-tool` exceptions. The requested full objective is not met.

Changes committed:
- `connectors/common.js`, `machine/service.js`: shared pane and login scrub; connector transcript redaction.
- `connectors/codex/machine.js`, `connectors/contract.js`, `machine/service.js`: connector step reader and readiness dispatch.
- `connectors/{agy,codex,kimi,pi}/{machine,manifest}.js`, `connectors/registry.json`, `machine/service.js`: restart recognition and loss reasons.
- `connectors/kimi/machine.js`, `connectors/contract.js`, `machine/service.js`, `machine/test/connectors-contract.test.js`: wire polling and transcript identity helper, exactly-one turn-end contract.
- `machine/service.js`: capability-based switch, usage and spend; registry status listing.
- `connectors/*/manifest.js`, `connectors/claude/machine.js`, `connectors/contract.js`, `connectors/registry.json`, `machine/service.js`, `machine/test/connectors-contract.test.js`: pane joining and project tool launch fields.

No test stub targets were edited. Both machine runs had exactly the 18 known Windows-bridge failures listed below; the viewer suite passed. The suite outcomes apply to this partial implementation, not the unfinished task.

## Choices

- `connectors/codex/machine.js`: `stepsReady` encapsulates the persisted thread-id prerequisite.
- `connectors/kimi/machine.js`: `bindTranscript`, `spoolWaiting`, and `validTranscript` expose the existing polling and identity behavior; service compatibility wrappers preserve existing tests.
- `machine/service.js`: usage URL override is read from the option named `<cli>UsageUrl`, preserving `kimiUsageUrl`.
- `connectors/*/manifest.js`: `wrapProjectTools`, `injectProjectKeys`, and `joinPaneLines` hold existing launch and pane behavior; `disableProjectServers` is a Claude connector member.
- `machine/service.js`: status account masking temporarily uses the presence of `resolveCli` until version capability dispatch is migrated.

## Known machine failures

- existing copy remains waiting until a post-start reconcile completes
- failed readying becomes ready after a later successful sync
- run timeout syncs, status syncs an exit and launch environment excludes the token
- readying times out without blocking launch and does not create copies for ordinary sessions
- worker merge cleanup deletes its copy and stop does not reconcile
- verifier stop returns immediately and deletes after its apps stop
- failed copies survive ordinary removal and archive, but verifier and merge removal delete them
- archive waits for successful final sync then deletes the copy
- archive removes the thread folder when the copy went with its worktree first
- archive waits once for a final sync and retains a failed copy
- sweep reconciles a dead lead with no apps
- sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
- tracker close callback marks the copy used
- sessions sharing a worktree share the copy and Windows tool use triggers stop sync
- archive deletes copies while retaining conflict refs
- cleanup removes a vanished linked worktree copy without a reconcile
- launch marking causes a final reconcile after readying
- restart recovery tracks a live lead and reconciles on stop

## Validation output

### `node --test machine/test/char-*.test.js machine/test/connectors-contract.test.js (scrub)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 44.757227
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 82.455381
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 31.164357
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 11.382893
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 34.433816
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 15.440212
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 99.449582
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 101.359033
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 10.876753
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 62.199046
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 3.858267
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.991971
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9431.321784
```

### `same characterization command (steps)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 50.777588
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 83.381704
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 40.834245
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 19.466049
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 41.033256
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 14.170516
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 102.634674
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 99.625225
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 8.697184
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 84.811916
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 9.137638
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.92842
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9469.349965
```

### `same characterization command (recovery)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 56.692225
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 68.877785
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 27.868056
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 9.96789
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 31.022934
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 12.918235
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 97.925883
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 85.317452
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 8.551795
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 58.462228
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 4.723806
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 1.720488
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9409.364891
```

### `same characterization command (poller, first attempt; syntax error corrected)`

```text
exit 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/connectors/kimi/machine.js:171
#   async kimiSpoolWaiting(session) {
#   ^^^^^
# SyntaxError: Unexpected token 'async'
#     at wrapSafe (node:internal/modules/cjs/loader:1713:18)
#     at Module._compile (node:internal/modules/cjs/loader:1755:20)
#     at Object..js (node:internal/modules/cjs/loader:1913:10)
#     at Module.load (node:internal/modules/cjs/loader:1505:32)
#     at Function._load (node:internal/modules/cjs/loader:1309:12)
#     at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
#     at Module.require (node:internal/modules/cjs/loader:1527:12)
#     at require (node:internal/modules/helpers:147:16)
#     at half (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/connectors/index.js:10:148)
#     at Object.machine (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/connectors/index.js:11:64)
# Node.js v22.23.5
# Subtest: machine/test/char-usage.test.js
not ok 13 - machine/test/char-usage.test.js
  ---
  duration_ms: 130.201394
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/char-usage.test.js:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 19 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 9.389962
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
not ok 20 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 17.648984
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/connectors-contract.test.js:10:1'
  failureType: 'testCodeFailure'
  error: "Unexpected token 'async'"
  code: 'ERR_TEST_FAILURE'
  name: 'SyntaxError'
  stack: |-
    wrapSafe (node:internal/modules/cjs/loader:1713:18)
    Module._compile (node:internal/modules/cjs/loader:1755:20)
    Object..js (node:internal/modules/cjs/loader:1913:10)
    Module.load (node:internal/modules/cjs/loader:1505:32)
    Function._load (node:internal/modules/cjs/loader:1309:12)
    wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
    Module.require (node:internal/modules/cjs/loader:1527:12)
    require (node:internal/modules/helpers:147:16)
    half (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/connectors/index.js:10:148)
    Object.machine (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/connectors/index.js:11:64)
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 21 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 2.787654
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 22 - provider snapshot remains unchanged
  ---
  duration_ms: 1.047358
  type: 'test'
  ...
1..22
# tests 22
# suites 0
# pass 12
# fail 10
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9400.063471
```

### `same characterization command (poller retry)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 47.493677
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 79.381507
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 36.51959
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 17.166638
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 41.518712
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 14.509335
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 98.263735
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 76.753539
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 8.912014
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 49.946038
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 3.45321
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.912209
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9395.368718
```

### `same characterization command (poller identity)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 58.608684
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 88.366409
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 35.372029
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 15.296023
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 29.265292
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 13.960452
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 117.33401
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 91.828005
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 10.781388
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 65.642927
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 10.119699
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 1.17366
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9413.595615
```

### `node --test machine/test/kimi-turns.test.js`

```text
exit 0
ok 14 - missing log requires continuous failures and delivery failures never start the clock
  ---
  duration_ms: 2.784888
  type: 'test'
  ...
# Subtest: persistence errors after a successful log read do not start the missing clock
ok 15 - persistence errors after a successful log read do not start the missing clock
  ---
  duration_ms: 0.939612
  type: 'test'
  ...
# Subtest: copier does not open source after fatal and ignores swapped opened file
ok 16 - copier does not open source after fatal and ignores swapped opened file
  ---
  duration_ms: 0.794694
  type: 'test'
  ...
# Subtest: recovery stops Kimi while leaving Claude and marker-priority panes alone
ok 17 - recovery stops Kimi while leaving Claude and marker-priority panes alone
  ---
  duration_ms: 1.865606
  type: 'test'
  ...
# Subtest: outage spools one turn at a time and drains in order even when the clock moves backwards
ok 18 - outage spools one turn at a time and drains in order even when the clock moves backwards
  ---
  duration_ms: 21.561443
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-fe3ec9c55f08.slice
# machine service listening on 127.0.0.1:43411
# machine: screen teardown failed: wcscreen-fe3ec9c55f08-abc.slice
# Subtest: HTTP pending stop, archive and hook preserve pending session and its worktree
ok 19 - HTTP pending stop, archive and hook preserve pending session and its worktree
  ---
  duration_ms: 119.29621
  type: 'test'
  ...
# Subtest: sign-in refuses when no Kimi binary is installed
ok 20 - sign-in refuses when no Kimi binary is installed
  ---
  duration_ms: 2.986986
  type: 'test'
  ...
# Subtest: duplicate turn ends in one read hand off once
ok 21 - duplicate turn ends in one read hand off once
  ---
  duration_ms: 3.814081
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-7651b58fe312.slice
# machine service listening on 127.0.0.1:38801
# Subtest: HTTP start retry and listing keep Kimi binding state private
ok 22 - HTTP start retry and listing keep Kimi binding state private
  ---
  duration_ms: 44.181656
  type: 'test'
  ...
# machine: screen teardown failed: wcscreen-2977ea8c446e-archive.slice
# Subtest: fatal verifier stop and archive remove created worktrees, while worker stop keeps its checkout
ok 23 - fatal verifier stop and archive remove created worktrees, while worker stop keeps its checkout
  ---
  duration_ms: 79.555037
  type: 'test'
  ...
# Subtest: unchanged Kimi copy does not read source content or persist
ok 24 - unchanged Kimi copy does not read source content or persist
  ---
  duration_ms: 4.761568
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
# duration_ms 760.121619
```

### `same characterization command (usage)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 43.011913
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 67.558668
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 27.701873
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 11.84158
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 31.729745
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 13.992453
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 76.044065
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 70.059663
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 7.041929
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 48.705338
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 3.548292
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.887711
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9398.401798
```

### `same characterization command (launch, first attempt; connector target corrected)`

```text
exit 1
        'existing',
    -   'windows'
      ]
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
    0: 'existing'
    1: 'windows'
  actual:
    0: 'existing'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/char-service-branches.test.js:170:12)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 10.179133
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 30.404039
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 11.397337
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 93.8471
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 86.161978
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 10.267473
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 54.094747
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 2.583863
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.733301
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 32
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9384.00639
```

### `same characterization command (launch retry)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 41.394462
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 68.053386
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 28.903073
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 11.108508
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 31.189103
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 13.061436
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 88.789432
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 75.602695
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 8.899196
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 53.998729
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 2.602659
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.813586
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9386.146401
```

### `same characterization command (status)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 44.42008
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 76.170412
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 34.748481
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 14.721547
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 35.722054
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 14.991546
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 89.715135
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 88.905806
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 10.222029
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 71.631519
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 3.65873
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.993191
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9401.799267
```

### `timeout 600 bash machine/test/run.sh`

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/lib/win.js:109:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/lib/win.js:472:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 718 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 1.189942
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 719 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 7.450552
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 720 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 37.209639
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:373:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 721 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 37.338597
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 722 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 37.27839
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:402:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    false !== true
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..722
# tests 722
# suites 0
# pass 702
# fail 18
# cancelled 0
# skipped 2
# todo 0
# duration_ms 64423.822841
```

### `(cd viewer && npm test)`

```text
exit 0
ok 883 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 62.167249
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 884 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 67.440173
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 885 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 64.40536
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 886 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 70.389523
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 887 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 67.637272
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 888 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 64.045095
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 889 - unknown win op fails without sending a request
  ---
  duration_ms: 48.960346
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 890 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.800422
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 891 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 64.179894
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 892 - the page eligibility regex equals the machine one
  ---
  duration_ms: 2.053685
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 893 - the page eligibility function
  ---
  duration_ms: 0.588713
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 894 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 50.659798
  type: 'test'
  ...
1..894
# tests 910
# suites 0
# pass 910
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 60207.095469
```

### `timeout 600 bash machine/test/run.sh (final)`

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/lib/win.js:109:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/lib/win.js:472:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 718 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 1.153158
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 719 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 6.891327
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 720 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 41.103819
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:373:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 721 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 37.650987
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 722 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 35.39604
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:402:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    false !== true
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w11/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..722
# tests 722
# suites 0
# pass 702
# fail 18
# cancelled 0
# skipped 2
# todo 0
# duration_ms 65335.230554
```

### `(cd viewer && npm test) (final)`

```text
exit 0
ok 883 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 57.385462
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 884 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 55.780607
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 885 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 70.008475
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 886 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 64.259721
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 887 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 58.78379
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 888 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 48.067115
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 889 - unknown win op fails without sending a request
  ---
  duration_ms: 41.452687
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 890 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.56681
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 891 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 59.605731
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 892 - the page eligibility regex equals the machine one
  ---
  duration_ms: 1.922957
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 893 - the page eligibility function
  ---
  duration_ms: 0.576329
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 894 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 41.327275
  type: 'test'
  ...
1..894
# tests 910
# suites 0
# pass 910
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 53937.62453
```

### `node connectors/export.js --check`

```text
exit 0

```

### `grep -nE <brief pattern> machine/service.js machine/lib/*.js machine/hook.sh`

```text
exit 0
machine/service.js:280:    this.asideTurns = new AsideTurns(this.stateDir, atomicWrite, accountDir, { piProblem: async () => { await this.checkPiVersion(); const status = this.cliStatus('pi'); return status.installed ? status.problem : 'Pi is not installed'; } });
machine/service.js:806:    if (input.cli === 'pi') { await this.checkPiVersion(); const status = this.cliStatus('pi'); if (!status.installed) die('Pi is not installed'); if (status.problem) die(status.problem); }
machine/service.js:807:    if (input.cli === 'kimi') { await this.checkKimiVersion(); const status = this.cliStatus('kimi'); if (!status.installed) die('Kimi Code is not installed'); if (status.problem) die(status.problem); }
machine/service.js:840:    if (input.cli === 'pi') { await this.checkPiVersion(); const status = this.cliStatus('pi'); if (!status.installed) die('Pi is not installed'); if (status.problem) die(status.problem); session.pi_version = status.version || null; }
machine/service.js:941:    const context = { resume, wsl, mount, ...(input.cli === 'kimi' ? { kimiExecutable: (await this.kimiLaunchPath()).executable } : {}) };
machine/service.js:1161:      await this.emitEvent({ type: 'stuck', session: session.name, thread_id: session.thread_id, ...(session.cli === 'pi' && this.piVersionNote(session.pi_version) ? { note: this.piVersionNote(session.pi_version) } : {}) });
machine/service.js:1537:    if (current.cli === 'pi' && ['turn-ended', 'turn-failed'].includes(event.type)) {
machine/service.js:1540:    if (current.cli === 'pi' && event.type === 'turn-failed') event = { ...event, error: (event.error || '') + this.piVersionNote(current.pi_version) };
machine/service.js:1541:    if (current.cli === 'pi' && event.transcript_path) { event = { ...event }; delete event.transcript_path; }
machine/service.js:1659:    if ((cli === 'kimi' || cli === 'pi') && !adapter.resolveCli()) throw Object.assign(new Error(cli === 'pi' ? 'Pi is not installed' : 'Kimi Code is not installed'), { status: 409 });
machine/service.js:1663:    this.tmux(['kill-session', '-t', cli === 'pi' ? `=${name}:` : cli === 'kimi' ? `=${name}` : name]);
machine/service.js:1680:    if (record.cli === 'kimi' && record.result) return record.result;
machine/service.js:1683:    if (record.cli === 'kimi') {
machine/service.js:1690:    if (record.cli === 'pi') {
machine/service.js:1700:      return { state: logged_in && (record.cli !== 'pi' || /__wc_login_exit 0(?:\s|$)/.test(pane)) ? 'done' : 'failed', url: null, code: null, wantsCode: false, logged_in };
machine/service.js:1702:    if (record.cli !== 'pi' && adapter.loginDone?.(pane)) {
machine/service.js:1742:    if (session.cli !== 'pi' || !['starting', 'stuck'].includes(session.status) || session.end_reason) return;
machine/service.js:1750:  checkPiVersion(executable = adapters.pi.resolveCli()) {
machine/service.js:1774:  checkKimiVersion(executable = adapters.kimi.resolveCli()) {
machine/service.js:1791:    const executable = adapters.kimi.resolveCli();
machine/service.js:1810:    if (cli === 'pi') { const executable = adapters.pi.resolveCli(); if (!executable) return { installed: false, logged_in: false }; let mtime; try { mtime = fs.statSync(executable).mtimeMs; } catch { return { installed: false, logged_in: false }; } this.checkPiVersion(executable); return this.piVersionStatus(this.piVersions.get(JSON.stringify([executable, mtime]))?.version || null, login); }
machine/service.js:1811:    if (cli === 'kimi') {
machine/service.js:1812:      const executable = adapters.kimi.resolveCli(); if (!executable) return { installed: false, logged_in: false };
machine/service.js:1834:      try { child = spawn('claude', ['-p', '--model', model, '--permission-mode', 'dontAsk'], { env: { ...process.env, WHEELCHAIR_LANE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] }); }
```

### `node -e "console.log(JSON.stringify(require('./viewer/app/providers')))"`

```text
exit 0
{"PROVIDERS":{"claude":{"cli":"claude","label":"Claude","effort":true,"preflight":false,"typesRoleMessage":false,"asideFork":true,"singleAccount":false},"gpt":{"cli":"codex","label":"GPT","effort":true,"preflight":true,"typesRoleMessage":true,"asideFork":true,"singleAccount":false},"gemini":{"cli":"agy","label":"Antigravity","effort":true,"preflight":false,"typesRoleMessage":true,"asideFork":false,"singleAccount":true},"kimi":{"cli":"kimi","label":"Kimi Code","effort":false,"preflight":false,"typesRoleMessage":true,"asideFork":false,"singleAccount":false},"openrouter":{"cli":"pi","label":"OpenRouter","effort":true,"preflight":false,"typesRoleMessage":false,"asideFork":true,"singleAccount":false}},"DISPLAY_NAMES":{"claude":"Claude Code","gpt":"Codex","gemini":"Antigravity","kimi":"Kimi Code","openrouter":"Pi (OpenRouter)"}}
```

## T3c

Partial work: groups 6, 7 and 10 only. `machine/service.js` uses connector data for login executable checks, login kill targets and style preview. `connectors/{pi,kimi,claude}/manifest.js`, `connectors/claude/machine.js`, `connectors/contract.js`, `connectors/registry.json`, and `machine/test/connectors-contract.test.js` supply and validate those fields. Remaining groups and final validation are unfinished.

### Group 10: `node --test machine/test/char-*.test.js machine/test/connectors-contract.test.js`

```
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 47.731441
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 70.422571
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 33.693078
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 15.968382
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 42.179924
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 19.752743
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 89.981351
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 91.42347
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 9.251817
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 62.529464
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 3.818126
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.972208
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9409.079663
```

### Group 6: `node --test machine/test/char-*.test.js machine/test/connectors-contract.test.js`

```
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 42.948144
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 63.354168
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 27.657928
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 13.510888
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 39.090391
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 15.113648
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 81.896995
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 83.899231
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 10.530683
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 59.957334
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 4.042817
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.936268
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9382.2249
```

### Group 7: `node --test machine/test/char-*.test.js machine/test/connectors-contract.test.js`

```
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 44.522681
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 85.840786
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 42.143011
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 17.130168
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 35.900438
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 13.118602
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 90.951264
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 88.536988
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 8.778835
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 50.296694
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 4.761728
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 1.091597
  type: 'test'
  ...
1..33
# tests 33
# suites 0
# pass 33
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9400.72852
```

Final machine suite, viewer suite, export check, grep and provider command were not run; the implementation is incomplete.

### Choices

- `login.killTarget`: omitted field defaults to the bare session name, preserving existing behavior for the other connectors.
