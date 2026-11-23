# T7a — name guard and generic service paths

The lead directed parts 1 and 2 to be committed together: the guard must pass on its first commit, and the real settings hit cannot truthfully be allowlisted. The guard and settings fixes landed in `4cc75ebb`, delegate removal in `2046e0ef`, and narrower guard exceptions and Python tuple matching in `2d97517a`.

## Changes

- `machine/test/name-guard.test.js`: scans the specified surfaces using manifest ids, reports hits, and holds categorized exceptions. Its header records line-based blind spots. A seeded `if (x === 'kimi')` failed at the named line and was removed.
- `viewer/pages/settings.js`: model font and sign-in prompts read connector settings; visible text remains the same.
- `viewer/test/app-openrouter-signin.test.js`: source-regex setup supplies the manifest to the VM and the source assertion follows the prompt variable; existing value assertions remain.
- `machine/service.js`, `connectors/kimi/machine.js`, `connectors/pi/machine.js`: route binding, spool, launch, version and step paths through generic service names and connector members.
- Machine test edits change call and stub targets only; assertions and expected values remain intact.

## Edited test lines

- `machine/test/name-guard.test.js`: new file, lines 1–49.
- `machine/test/char-lib-project-tools.test.js`: 42, 44.
- `machine/test/char-service-branches.test.js`: 114, 125, 126, 127, 128, 129, 159, 197.
- `machine/test/kimi-turns.test.js`: 32, 40, 48, 109, 119, 128, 163, 187, 193, 344.
- `machine/test/kimi.test.js`: 60, 62, 184, 186, 187, 188, 229, 235, 355.
- `machine/test/pi.test.js`: 103, 127, 130, 131, 132, 173.
- `machine/test/service.test.js`: 1425, 1428, 1446, 1448, 1450, 1454, 1458.
- `machine/test/win-forward-service.test.js`: 83.
- `viewer/test/app-openrouter-signin.test.js`: 10, 30.

## Validation

The machine suite's 18 failures match the known missing `wslpath` failures in the brief. Their names are:
- not ok 688 - existing copy remains waiting until a post-start reconcile completes
- not ok 689 - failed readying becomes ready after a later successful sync
- not ok 705 - run timeout syncs, status syncs an exit and launch environment excludes the token
- not ok 706 - readying times out without blocking launch and does not create copies for ordinary sessions
- not ok 707 - worker merge cleanup deletes its copy and stop does not reconcile
- not ok 708 - verifier stop returns immediately and deletes after its apps stop
- not ok 709 - failed copies survive ordinary removal and archive, but verifier and merge removal delete them
- not ok 710 - archive waits for successful final sync then deletes the copy
- not ok 711 - archive removes the thread folder when the copy went with its worktree first
- not ok 712 - archive waits once for a final sync and retains a failed copy
- not ok 713 - sweep reconciles a dead lead with no apps
- not ok 714 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
- not ok 715 - tracker close callback marks the copy used
- not ok 716 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
- not ok 717 - archive deletes copies while retaining conflict refs
- not ok 718 - cleanup removes a vanished linked worktree copy without a reconcile
- not ok 721 - launch marking causes a final reconcile after readying
- not ok 723 - restart recovery tracks a live lead and reconciles on stop

The Chromium run has the three documented midnight-sensitive lead-wait failures; 84 passed.

### `Initial guard run (draft syntax error)`

exit 1

```text
TAP version 13
# /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:17
#   new RegExp(`(?:\\\\?|:|\\\\|\\\\||&&)\\\\s*${literal}\\\\b?`),
#   ^
# SyntaxError: Invalid regular expression: /(?:\\?|:|\\|\\||&&)\\s*['"`](?:claude|codex|gpt|agy|gemini|kimi|pi|openrouter)['"`]\\b?/: Nothing to repeat
#     at new RegExp (<anonymous>)
#     at Object.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:17:3)
#     at Module._compile (node:internal/modules/cjs/loader:1781:14)
#     at Object..js (node:internal/modules/cjs/loader:1913:10)
#     at Module.load (node:internal/modules/cjs/loader:1505:32)
#     at Function._load (node:internal/modules/cjs/loader:1309:12)
#     at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
#     at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)
#     at node:internal/main/run_main_module:36:49
# Node.js v22.23.5
# Subtest: machine/test/name-guard.test.js
not ok 1 - machine/test/name-guard.test.js
  ---
  duration_ms: 33.248967
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  signal: ~
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 39.047828
```

### `Guard baseline before fixes`

exit 1

```text
    +   "viewer/app/settings.js:423: return execFileAsync(path.join(hub.root, 'codex', 'model.sh'), args, { encoding: 'utf8' });",
    +   "viewer/pages/settings.js:180: const select = h('select', { 'aria-label': label, class: provider === 'claude' ? '' : 'mono' },",
    +   "viewer/pages/settings.js:487: const body = PROVIDERS.filter(([provider]) => harnessOn(provider)).map(([provider, name, cli]) => h('tr', { class: toolOf(provider).settings.modelHeadsUp ? 'gpt' : '', 'data-provider': provider },",
    +   "viewer/server.js:1337: !['claude', 'codex', 'other'].includes(body.harness) ||",
    +   "viewer/server.js:1610: const graph = { path: graphPath, title, harness: ['claude', 'codex', 'other'].includes(entry.harness) ? entry.harness : 'other', modified: info.mtimeMs };",
    +   "viewer/server.js:1645: harness: ['claude', 'codex', 'other'].includes(entry?.harness) ? entry.harness : 'other',",
    +   "viewer/server.js:1940: return process.env.CLAUDECODE === '1' ? 'claude' : 'other';",
    +   "viewer/server.js:1948: if (name === 'claude' || name === 'codex') return name;",
    +   'install.sh:102: claude) claude_present=${tool_present[$i]} ;;',
    +   'install.sh:103: codex) codex_present=${tool_present[$i]} ;;',
    +   'codex/model.sh:29: VALUE = FORMATS["gpt"]',
    +   'codex/model.sh:30: KIMI_VALUE = FORMATS["kimi"]',
    +   'codex/model.sh:57: if provider == "claude" and name in CLAUDE_ALIASES:',
    +   'codex/model.sh:106: pins["gpt"][slot] = model, None',
    +   'codex/model.sh:276: active = {slot: cell(pins, "gpt", slot)[0] for slot in WORK_TIERS}',
    +   'codex/model.sh:282: words = {slot: (model_parts(model) or model_parts(DEFAULTS["gpt"][slot][0]))[1] for slot, model in active.items()}',
    +   'codex/model.sh:286: fallback = model_parts(DEFAULTS["gpt"][slot][0])',
    +   'codex/model.sh:308: command, tierless = os.path.join(root, "codex", "model.sh"), 0',
    +   'codex/model.sh:361: if len(argv) == 1 and (slot := slot_for("gpt", argv[0])) in WORK_TIERS:',
    +   'codex/model.sh:362: model, _ = read_cell(pin_path, "gpt", slot)',
    +   'codex/model.sh:380: if len(argv) == 3 and argv[:2] == ["family", "claude"] and (slot := slot_for("claude", argv[2])) is not None:',
    +   'codex/model.sh:381: model, _ = read_cell(pin_path, "claude", slot)',
    +   'codex/model.sh:418: if len(argv) == 3 and argv[0] == "set" and (slot := slot_for("gpt", argv[1])) in WORK_TIERS:',
    +   'codex/model.sh:422: write_pin(pin_path, "gpt", slot, model, None)',
    +   'codex/model.sh:431: if provider == "gpt" and effort is not None and effort not in EFFORTS[provider]:'
    + ]
    - []
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
    0: "viewer/app/balancer.js:81: try { await exec(path.join(hub.root, 'codex', 'model.sh'), [family, slot]); }"
    1: "viewer/app/balancer.js:93: try { await exec(path.join(hub.root, 'codex', 'model.sh'), [provider, slot]); }"
    2: "viewer/app/balancer.js:99: try { await exec(path.join(hub.root, 'codex', 'model.sh'), [p, slot]); } catch (e) { if (e.code === 3) continue; throw e; }"
    3: "viewer/app/sessions.js:107: const model = (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), [provider, slot])).stdout.trim();"
    4: "viewer/app/sessions.js:109: if (PROVIDERS[provider].effort) effort = (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), ['effort', provider, slot])).stdout.trim() || undefined;"
    5: "viewer/app/sessions.js:120: const model = (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), args)).stdout.trim();"
    6: "viewer/app/settings.js:423: return execFileAsync(path.join(hub.root, 'codex', 'model.sh'), args, { encoding: 'utf8' });"
    7: "viewer/pages/settings.js:180: const select = h('select', { 'aria-label': label, class: provider === 'claude' ? '' : 'mono' },"
    8: "viewer/pages/settings.js:487: const body = PROVIDERS.filter(([provider]) => harnessOn(provider)).map(([provider, name, cli]) => h('tr', { class: toolOf(provider).settings.modelHeadsUp ? 'gpt' : '', 'data-provider': provider },"
    9: "viewer/server.js:1337: !['claude', 'codex', 'other'].includes(body.harness) ||"
    10: "viewer/server.js:1610: const graph = { path: graphPath, title, harness: ['claude', 'codex', 'other'].includes(entry.harness) ? entry.harness : 'other', modified: info.mtimeMs };"
    11: "viewer/server.js:1645: harness: ['claude', 'codex', 'other'].includes(entry?.harness) ? entry.harness : 'other',"
    12: "viewer/server.js:1940: return process.env.CLAUDECODE === '1' ? 'claude' : 'other';"
    13: "viewer/server.js:1948: if (name === 'claude' || name === 'codex') return name;"
    14: 'install.sh:102: claude) claude_present=${tool_present[$i]} ;;'
    15: 'install.sh:103: codex) codex_present=${tool_present[$i]} ;;'
    16: 'codex/model.sh:29: VALUE = FORMATS["gpt"]'
    17: 'codex/model.sh:30: KIMI_VALUE = FORMATS["kimi"]'
    18: 'codex/model.sh:57: if provider == "claude" and name in CLAUDE_ALIASES:'
    19: 'codex/model.sh:106: pins["gpt"][slot] = model, None'
    20: 'codex/model.sh:276: active = {slot: cell(pins, "gpt", slot)[0] for slot in WORK_TIERS}'
    21: 'codex/model.sh:282: words = {slot: (model_parts(model) or model_parts(DEFAULTS["gpt"][slot][0]))[1] for slot, model in active.items()}'
    22: 'codex/model.sh:286: fallback = model_parts(DEFAULTS["gpt"][slot][0])'
    23: 'codex/model.sh:308: command, tierless = os.path.join(root, "codex", "model.sh"), 0'
    24: 'codex/model.sh:361: if len(argv) == 1 and (slot := slot_for("gpt", argv[0])) in WORK_TIERS:'
    25: 'codex/model.sh:362: model, _ = read_cell(pin_path, "gpt", slot)'
    26: 'codex/model.sh:380: if len(argv) == 3 and argv[:2] == ["family", "claude"] and (slot := slot_for("claude", argv[2])) is not None:'
    27: 'codex/model.sh:381: model, _ = read_cell(pin_path, "claude", slot)'
    28: 'codex/model.sh:418: if len(argv) == 3 and argv[0] == "set" and (slot := slot_for("gpt", argv[1])) in WORK_TIERS:'
    29: 'codex/model.sh:422: write_pin(pin_path, "gpt", slot, model, None)'
    30: 'codex/model.sh:431: if provider == "gpt" and effort is not None and effort not in EFFORTS[provider]:'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:41:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 69.555579
```

### `Guard after settings fixes`

exit 0

```text
TAP version 13
# Subtest: tool names do not dispatch outside connectors
ok 1 - tool names do not dispatch outside connectors
  ---
  duration_ms: 22.751892
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 69.391929
```

### `Guard bite with seeded line (expected failure)`

exit 1

```text
TAP version 13
# Subtest: tool names do not dispatch outside connectors
not ok 1 - tool names do not dispatch outside connectors
  ---
  duration_ms: 23.537595
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:40:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + [
    +   "viewer/pages/settings.js:2116: if (x === 'kimi') {}"
    + ]
    - []
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
    0: "viewer/pages/settings.js:2116: if (x === 'kimi') {}"
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/name-guard.test.js:48:10)
    Test.runInAsyncScope (node:async_hooks:214:14)
    Test.run (node:internal/test_runner/test:1047:25)
    Test.start (node:internal/test_runner/test:944:17)
    startSubtestAfterBootstrap (node:internal/test_runner/harness:296:17)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 73.756168
```

### `node --test viewer/test/app-openrouter-signin.test.js`

exit 0

```text
TAP version 13
# Subtest: a key-only waiting state shows the paste field with the key hint
ok 1 - a key-only waiting state shows the paste field with the key hint
  ---
  duration_ms: 0.707093
  type: 'test'
  ...
# Subtest: states with a link or without wantsCode keep the existing behaviour
ok 2 - states with a link or without wantsCode keep the existing behaviour
  ---
  duration_ms: 0.265692
  type: 'test'
  ...
# Subtest: the page treats key-only waiting like a link: the startup timeout stops, the key is a password field, 409 offers a restart for OpenRouter only
ok 3 - the page treats key-only waiting like a link: the startup timeout stops, the key is a password field, 409 offers a restart for OpenRouter only
  ---
  duration_ms: 0.781768
  type: 'test'
  ...
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 49.246239
```

### `node --test machine/test/name-guard.test.js`

exit 0

```text
TAP version 13
# Subtest: tool names do not dispatch outside connectors
ok 1 - tool names do not dispatch outside connectors
  ---
  duration_ms: 22.354907
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 66.343522
```

### `node --test machine/test/char-*.test.js machine/test/connectors-contract.test.js`

exit 0

```text
ok 22 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 39.465171
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 23 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 63.941024
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 24 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 26.947068
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 25 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 10.572301
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 26 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 27.796265
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 27 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 10.977972
  type: 'test'
  ...
# Subtest: live switch eligibility rejects unsupported tools before validating the body
ok 28 - live switch eligibility rejects unsupported tools before validating the body
  ---
  duration_ms: 83.75394
  type: 'test'
  ...
# Subtest: usage endpoint allowlist and default account checks distinguish all tools
ok 29 - usage endpoint allowlist and default account checks distinguish all tools
  ---
  duration_ms: 70.961629
  type: 'test'
  ...
# Subtest: Unity launch guidance restricts only sandboxed Codex across all five CLIs
ok 30 - Unity launch guidance restricts only sandboxed Codex across all five CLIs
  ---
  duration_ms: 7.265958
  type: 'test'
  ...
# Subtest: registry, manifests and connector halves satisfy the contract
ok 31 - registry, manifests and connector halves satisfy the contract
  ---
  duration_ms: 49.361528
  type: 'test'
  ...
# Subtest: contract rejects missing and inconsistent members and fields
ok 32 - contract rejects missing and inconsistent members and fields
  ---
  duration_ms: 5.896096
  type: 'test'
  ...
# Subtest: provider snapshot remains unchanged
ok 33 - provider snapshot remains unchanged
  ---
  duration_ms: 1.074471
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
# duration_ms 9385.17809
```

### `Affected machine tests`

exit 0

```text
  duration_ms: 112.52995
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-860fd677d85b.slice
# Subtest: off WSL loads original tool and emits no mark warnings
ok 210 - off WSL loads original tool and emits no mark warnings
  ---
  duration_ms: 62.076688
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-77dcbf401084.slice
# wc-excluded-kimi-worker: project tools: project tools aren't supported on Kimi Code yet; this agent runs without them
# wc-excluded-pi-worker: project tools: project tools aren't supported on Pi yet; this agent runs without them
# Subtest: reviewer, mapper, Kimi and Pi do not request forwards or Claude config
ok 211 - reviewer, mapper, Kimi and Pi do not request forwards or Claude config
  ---
  duration_ms: 112.51004
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-e72015af9231.slice
# Subtest: shared forward survives both stops and concurrent records precede tmux
ok 212 - shared forward survives both stops and concurrent records precede tmux
  ---
  duration_ms: 141.967129
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-9009e0ccbc61.slice
# Subtest: startup restores recorded ports even with interop off and new starts are withheld
ok 213 - startup restores recorded ports even with interop off and new starts are withheld
  ---
  duration_ms: 72.678412
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-fdf84336b38f.slice
# Subtest: startup with no live wheelchair tmux session clears the forward record
ok 214 - startup with no live wheelchair tmux session clears the forward record
  ---
  duration_ms: 54.416852
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-fbff8da6d52a.slice
# machine: failed to start PowerShell (spawn /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ENOENT); WSL_INTEROP=(unset); check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL
# machine: failed to start PowerShell (spawn /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ENOENT); WSL_INTEROP=(unset); check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL
# machine: failed to start PowerShell (spawn /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ENOENT); WSL_INTEROP=(unset); check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL
# machine: failed to start PowerShell (spawn /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ENOENT); WSL_INTEROP=(unset); check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL
# machine: failed to start PowerShell (spawn /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ENOENT); WSL_INTEROP=(unset); check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL
# machine: failed to start PowerShell (spawn /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ENOENT); WSL_INTEROP=(unset); check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL
# wc-proto-off: project tools: tool: couldn't reach Windows (Windows bridge not available); left out of this session
# wc-proto-off: project tools: __proto__: couldn't reach Windows (Windows bridge not available); left out of this session
# machine: failed to start PowerShell (spawn /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ENOENT); WSL_INTEROP=(unset); check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL
# machine: failed to start PowerShell (spawn /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ENOENT); WSL_INTEROP=(unset); check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL
# Subtest: a marked tool named __proto__ next to a wrapped Windows program is rewritten, never left at its Linux URL
ok 215 - a marked tool named __proto__ next to a wrapped Windows program is rewritten, never left at its Linux URL
  ---
  duration_ms: 163.965914
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-5fe88a924436.slice
# Subtest: windows status validates input, reports unavailable, thrown and timed-out checks and off WSL
ok 216 - windows status validates input, reports unavailable, thrown and timed-out checks and off WSL
  ---
  duration_ms: 10040.950443
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-7fd5813e8c2e.slice
# Subtest: project tools read route reports kernel WSL state
ok 217 - project tools read route reports kernel WSL state
  ---
  duration_ms: 56.50111
  type: 'test'
  ...
1..217
# tests 217
# suites 0
# pass 217
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 31712.089382
```

### `timeout 600 bash machine/test/run.sh`

exit 1

```text
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/lib/win.js:109:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/lib/win.js:472:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 719 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.955882
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 720 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 6.121726
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 721 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 39.334519
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/win.test.js:373:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 722 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 40.101937
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 723 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 38.919159
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/win.test.js:402:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..723
# tests 723
# suites 0
# pass 703
# fail 18
# cancelled 0
# skipped 2
# todo 0
# duration_ms 64302.192648
```

### `(cd viewer && npm test)`

exit 0

```text
ok 884 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 81.986216
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 885 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 121.104271
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 886 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 59.975875
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 887 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 49.178922
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 888 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 52.555445
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 889 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 51.460065
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 890 - unknown win op fails without sending a request
  ---
  duration_ms: 35.717477
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 891 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.758932
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 892 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 42.258334
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 893 - the page eligibility regex equals the machine one
  ---
  duration_ms: 1.439202
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 894 - the page eligibility function
  ---
  duration_ms: 0.411623
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 895 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 44.917185
  type: 'test'
  ...
1..895
# tests 911
# suites 0
# pass 911
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 50117.019012
```

### `(cd viewer && npx playwright test test/app-accounts.spec.js test/app-settings*.spec.js --project=chromium)`

exit 1

```text
        - locator resolved to <p hidden="" role="status" id="lead-wait" class="card amber lead-wait"></p>
        - unexpected value ""
        13 × locator resolved to <p role="status" id="lead-wait" class="card amber lead-wait">Waiting for GPT to refill, about Mon 12:53 AM</p>
           - unexpected value "Waiting for GPT to refill, about Mon 12:53 AM"


      578 |     await ctx.patch(made.id, (t) => { Object.assign(t.sessions[0], { status: 'waiting', provider: 'gpt', waiting_until: iso(3 * HOUR) }); });
      579 |     await openThread(page, made.id);
    > 580 |     await expect(page.locator('#lead-wait')).toHaveText(/^Waiting for GPT to refill, about \d/);
          |                                              ^
      581 |     await noSideScroll(page);
      582 |   });
      583 |
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/viewer/test/app-accounts.spec.js:580:46

    Error Context: test-results/app-accounts-lead-waiting--fc4dc-s-when-the-provider-refills-chromium/error-context.md

  2) [chromium] › test/app-accounts.spec.js:584:3 › lead waiting line › a waiting lead pinned to a provider names it when the lead has none 

    Error: expect(locator).toHaveText(expected) failed

    Locator: locator('#lead-wait')
    Expected pattern: /^Waiting for GPT to refill, about \d/
    Received string:  "Waiting for GPT to refill, about Mon 12:53 AM"
    Timeout: 5000ms

    Call log:
      - Expect "toHaveText" with timeout 5000ms
      - waiting for locator('#lead-wait')
        - locator resolved to <p hidden="" role="status" id="lead-wait" class="card amber lead-wait"></p>
        - unexpected value ""
        13 × locator resolved to <p role="status" id="lead-wait" class="card amber lead-wait">Waiting for GPT to refill, about Mon 12:53 AM</p>
           - unexpected value "Waiting for GPT to refill, about Mon 12:53 AM"


      586 |     await ctx.patch(made.id, (t) => { delete t.provider; delete t.sessions[0].provider; Object.assign(t.sessions[0], { status: 'waiting', waiting_provider: 'gpt', waiting_until: iso(3 * HOUR) }); });
      587 |     await openThread(page, made.id);
    > 588 |     await expect(page.locator('#lead-wait')).toHaveText(/^Waiting for GPT to refill, about \d/);
          |                                              ^
      589 |   });
      590 |
      591 |   test('a waiting lead with no provider anywhere says it is waiting for room', async ({ page }) => {
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/viewer/test/app-accounts.spec.js:588:46

    Error Context: test-results/app-accounts-lead-waiting--13014-s-it-when-the-lead-has-none-chromium/error-context.md

  3) [chromium] › test/app-accounts.spec.js:591:3 › lead waiting line › a waiting lead with no provider anywhere says it is waiting for room 

    Error: expect(locator).toHaveText(expected) failed

    Locator: locator('#lead-wait')
    Expected pattern: /^Waiting for room, about \d/
    Received string:  "Waiting for room, about Mon 12:53 AM"
    Timeout: 5000ms

    Call log:
      - Expect "toHaveText" with timeout 5000ms
      - waiting for locator('#lead-wait')
        - locator resolved to <p hidden="" role="status" id="lead-wait" class="card amber lead-wait"></p>
        - unexpected value ""
        13 × locator resolved to <p role="status" id="lead-wait" class="card amber lead-wait">Waiting for room, about Mon 12:53 AM</p>
           - unexpected value "Waiting for room, about Mon 12:53 AM"


      594 |     await ctx.patch(made.id, (t) => { delete t.cli; delete t.provider; delete t.sessions[0].cli; delete t.sessions[0].provider; Object.assign(t.sessions[0], { status: 'waiting', waiting_until: iso(3 * HOUR) }); });
      595 |     await openThread(page, made.id);
    > 596 |     await expect(page.locator('#lead-wait')).toHaveText(/^Waiting for room, about \d/);
          |                                              ^
      597 |   });
      598 |
      599 |   test('a limited running lead names the account', async ({ page }) => {
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w16/viewer/test/app-accounts.spec.js:596:46

    Error Context: test-results/app-accounts-lead-waiting--38248-says-it-is-waiting-for-room-chromium/error-context.md

  3 failed
    [chromium] › test/app-accounts.spec.js:576:3 › lead waiting line › a waiting lead shows when the provider refills 
    [chromium] › test/app-accounts.spec.js:584:3 › lead waiting line › a waiting lead pinned to a provider names it when the lead has none 
    [chromium] › test/app-accounts.spec.js:591:3 › lead waiting line › a waiting lead with no provider anywhere says it is waiting for room 
  84 passed (1.1m)
```

### `node --test machine/test/name-guard.test.js after tightening`

exit 0

```text
TAP version 13
# Subtest: tool names do not dispatch outside connectors
ok 1 - tool names do not dispatch outside connectors
  ---
  duration_ms: 22.100674
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 67.664806
```

### `node connectors/export.js --check`

exit 0

```text

```

### `grep for removed methods in machine/service.js (no matches expected)`

exit 1

```text

```

## Choices

- `machine/service.js`: retained generic `bindTranscript`, `spoolWaiting`, and `launchPath` delegates so per-service test stubs remain isolated while dispatch uses connector members.
- `viewer/test/app-openrouter-signin.test.js`: supplied manifest data to the existing source-regex VM setup on that same line; the existing rendered-value assertions are unchanged.
- `machine/test/name-guard.test.js`: used line-scoped regular expressions and narrowly patterned allowlist entries; multiline and escaped forms are recorded as blind spots in the file.
