# T3a — machine connector dispatch

Changed `machine/hook.sh` and added `machine/lib/hook-in.js` for manifest-driven hook transport. Reworked `machine/lib/aside-turns.js`, `screen.js`, `win.js`, `win-prompt.js`, `project-tools.js`, `steps.js`, `harness-install.js` and `harness-recipes.js` to consult connectors. Moved `machine/lib/codex-steps.js` to `connectors/codex/steps.js`, updating its service and test require paths. Updated connector machine halves, install manifests, contract, registry and manifest validation tests.

The full machine suite has the 18 known missing-wslpath failures and no other failures:

```text
not ok 687 - existing copy remains waiting until a post-start reconcile completes
not ok 688 - failed readying becomes ready after a later successful sync
not ok 704 - run timeout syncs, status syncs an exit and launch environment excludes the token
not ok 705 - readying times out without blocking launch and does not create copies for ordinary sessions
not ok 706 - worker merge cleanup deletes its copy and stop does not reconcile
not ok 707 - verifier stop returns immediately and deletes after its apps stop
not ok 708 - failed copies survive ordinary removal and archive, but verifier and merge removal delete them
not ok 709 - archive waits for successful final sync then deletes the copy
not ok 710 - archive removes the thread folder when the copy went with its worktree first
not ok 711 - archive waits once for a final sync and retains a failed copy
not ok 712 - sweep reconciles a dead lead with no apps
not ok 713 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
not ok 714 - tracker close callback marks the copy used
not ok 715 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
not ok 716 - archive deletes copies while retaining conflict refs
not ok 717 - cleanup removes a vanished linked worktree copy without a reconcile
not ok 720 - launch marking causes a final reconcile after readying
not ok 722 - restart recovery tracks a live lead and reconciles on stop
```

## Choices

- `aside-turns.js` and connector halves: `asideNewId`, `asideModel`, `asidePrepare`, `asideMessage`, `asideResult`, and `asideProblem` carry fork-ID validation, model regex, preflight server listing, stdin composition, result parsing, and Pi availability respectively; `redact` handles provider redaction.
- `connectors/codex/machine.js`: `projectToolFileWarning` returns the full warning or null, and `projectToolReason` returns the full skip reason or null.
- `connectors/*/manifest.js`: `install.lookup` is `path`, `absolute`, or `fallback`; the latter uses the existing `fallbackPath` and executable check.
- `steps.js` and connector halves: vocabulary is plain data. Pi's hook explicitly uses Claude's vocabulary; its generic classifier vocabulary matches the historical non-Claude behavior, as do Antigravity and Kimi.
- `hook-in.js`: strip trailing newlines from stdin to preserve bash command-substitution behavior.

## Validation

`node --test machine/test/char-*.test.js machine/test/connectors-contract.test.js (first run)`

```text
exit 1
#     at Module.load (node:internal/modules/cjs/loader:1505:32)
#     at Function._load (node:internal/modules/cjs/loader:1309:12)
#     at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
#     at Module.require (node:internal/modules/cjs/loader:1527:12)
#     at require (node:internal/modules/helpers:147:16)
#     at Object.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/service.js:38:40)
#     at Module._compile (node:internal/modules/cjs/loader:1781:14)
# Node.js v22.23.5
# Subtest: machine/test/char-switch.test.js
not ok 12 - machine/test/char-switch.test.js
  ---
  duration_ms: 120.133258
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/test/char-switch.test.js:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/lib/screen.js:9
# const connectors = require('../../connectors');
#       ^
# SyntaxError: Identifier 'connectors' has already been declared
#     at wrapSafe (node:internal/modules/cjs/loader:1713:18)
#     at Module._compile (node:internal/modules/cjs/loader:1755:20)
#     at Object..js (node:internal/modules/cjs/loader:1913:10)
#     at Module.load (node:internal/modules/cjs/loader:1505:32)
#     at Function._load (node:internal/modules/cjs/loader:1309:12)
#     at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
#     at Module.require (node:internal/modules/cjs/loader:1527:12)
#     at require (node:internal/modules/helpers:147:16)
#     at Object.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/service.js:38:40)
#     at Module._compile (node:internal/modules/cjs/loader:1781:14)
# Node.js v22.23.5
# Subtest: machine/test/char-usage.test.js
not ok 13 - machine/test/char-usage.test.js
  ---
  duration_ms: 149.173373
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/test/char-usage.test.js:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 20 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 9.020948
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 21 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 41.846787
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 22 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 2.565092
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 23 - provider snapshot remains unchanged
  ---
  duration_ms: 0.744488
  type: 'test'
  ...
1..23
# tests 23
# suites 0
# pass 14
# fail 9
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9398.330756
```

`node --test machine/test/char-*.test.js machine/test/connectors-contract.test.js (second run)`

```text
exit 1
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 56.121749
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 73.053604
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 31.101759
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 9.483013
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 28.90272
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 11.776413
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 112.078833
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 86.146793
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 10.253421
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 55.827115
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 2.977161
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.763214
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
# duration_ms 9410.630646
```

`node --test machine/test/char-*.test.js machine/test/connectors-contract.test.js (corrected)`

```text
exit 0
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 48.640372
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 74.456187
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 34.970518
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 10.600546
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 30.042934
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 11.811269
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 108.932057
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 92.813014
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 15.21099
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 52.34015
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 4.017306
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 0.860371
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
# duration_ms 9401.264679
```

`node --test machine/test/aside-turns.test.js machine/test/steps.test.js machine/test/codex-steps.test.js`

```text
exit 0
ok 7 - Pi asides validate, fork, resume, settle and redact
  ---
  duration_ms: 592.157314
  type: 'test'
  ...
# Subtest: real immediate script completes at its matching output
ok 8 - real immediate script completes at its matching output
  ---
  duration_ms: 9.121339
  type: 'test'
  ...
# Subtest: real yielded cell finishes on wait
ok 9 - real yielded cell finishes on wait
  ---
  duration_ms: 0.881211
  type: 'test'
  ...
# Subtest: real mixed scripts start operations and cut short yielded steps
ok 10 - real mixed scripts start operations and cut short yielded steps
  ---
  duration_ms: 0.700644
  type: 'test'
  ...
# Subtest: real poll chain ends yielded operation with exit 1
ok 11 - real poll chain ends yielded operation with exit 1
  ---
  duration_ms: 0.542641
  type: 'test'
  ...
# Subtest: real token count uses last usage and context window
ok 12 - real token count uses last usage and context window
  ---
  duration_ms: 0.25005
  type: 'test'
  ...
# Subtest: script targets, polls, state round trip and failure
ok 13 - script targets, polls, state round trip and failure
  ---
  duration_ms: 0.396821
  type: 'test'
  ...
# Subtest: script headers control completion and failure, not error words in the body
ok 14 - script headers control completion and failure, not error words in the body
  ---
  duration_ms: 0.334922
  type: 'test'
  ...
# Subtest: classifies both CLI tool tables and labels and keys
ok 15 - classifies both CLI tool tables and labels and keys
  ---
  duration_ms: 10.630986
  type: 'test'
  ...
# Subtest: Claude step hooks omit raw input and map ends
ok 16 - Claude step hooks omit raw input and map ends
  ---
  duration_ms: 0.498286
  type: 'test'
  ...
# Subtest: statusline independently throttles and spools both events
ok 17 - statusline independently throttles and spools both events
  ---
  duration_ms: 230.553872
  type: 'test'
  ...
# Subtest: empty commands, command arrays and empty patches have useful labels and keys
ok 18 - empty commands, command arrays and empty patches have useful labels and keys
  ---
  duration_ms: 0.420707
  type: 'test'
  ...
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3165.617791
```

`timeout 600 bash machine/test/run.sh`

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/lib/win.js:109:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/lib/win.js:472:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 718 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 1.069772
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 719 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 8.871047
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 720 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 48.012914
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/test/win.test.js:373:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 721 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 48.036588
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 722 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 46.308122
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/test/win.test.js:402:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w7/machine/test/win.test.js:414:10)
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
# duration_ms 66865.474635
```

`(cd viewer && npm test)`

```text
exit 0
ok 883 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 58.267911
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 884 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 51.502826
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 885 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 49.218414
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 886 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 56.703641
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 887 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 52.223388
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 888 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 66.084324
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 889 - unknown win op fails without sending a request
  ---
  duration_ms: 53.964948
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 890 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.929714
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 891 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 54.040593
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 892 - the page eligibility regex equals the machine one
  ---
  duration_ms: 1.898231
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 893 - the page eligibility function
  ---
  duration_ms: 0.603267
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 894 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 54.2682
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
# duration_ms 56471.180544
```

`node connectors/export.js --check`

```text
exit 0

```

`grep -rnE "adapters/(index|claude|codex|agy|kimi|pi)" machine viewer codex install.sh test-support`

```text
exit 1

```

`node -e "console.log(JSON.stringify(require('./viewer/app/providers')))"`

```text
exit 0
{"PROVIDERS":{"claude":{"cli":"claude","label":"Claude","effort":true,"preflight":false,"typesRoleMessage":false,"asideFork":true,"singleAccount":false},"gpt":{"cli":"codex","label":"GPT","effort":true,"preflight":true,"typesRoleMessage":true,"asideFork":true,"singleAccount":false},"gemini":{"cli":"agy","label":"Antigravity","effort":true,"preflight":false,"typesRoleMessage":true,"asideFork":false,"singleAccount":true},"kimi":{"cli":"kimi","label":"Kimi Code","effort":false,"preflight":false,"typesRoleMessage":true,"asideFork":false,"singleAccount":false},"openrouter":{"cli":"pi","label":"OpenRouter","effort":true,"preflight":false,"typesRoleMessage":false,"asideFork":true,"singleAccount":false}},"DISPLAY_NAMES":{"claude":"Claude Code","gpt":"Codex","gemini":"Antigravity","kimi":"Kimi Code","openrouter":"Pi (OpenRouter)"}}
```

`grep -nE tool-name self-check from brief`

```text
exit 1

```

The first characterization run found a duplicate import and an undefined vocabulary; the second found the Pi generic-classifier compatibility case. Both were fixed before the passing run. The name-check searches returned no hits.
