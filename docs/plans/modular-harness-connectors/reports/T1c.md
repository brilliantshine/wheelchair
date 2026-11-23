# T1c — machine service characterization

## Changes

- `machine/test/char-service-branches.test.js`: 11 tests covering recovery, pane capture, usage hooks, login output and startup, version gates and status, preflight, launch preparation and transcript copying across the five CLIs.
- `docs/plans/modular-harness-connectors/reports/T1c.md`: checklist outcomes and validation.

Each new test was run against a deliberate, isolated mutation of a scratch copy of the service and failed; the scratch service was restored. No production file was changed. The login output test was subsequently pointed at a temporary account directory instead of the host default, and its mutation and focused validation were repeated. The machine full-suite run below predates that one-line fixture-isolation change; the final focused run includes it.

## Checklist

1. Restart recovery: a non-stopped Pi session that has an `end_reason` is stopped at startup and on each later poll, retrying until the stop succeeds (`machine/service.js:552-568,1097`); a Kimi one is not stopped on that path. Lost-session `end_reason` text for Pi and Kimi, and that a session with an existing `end_reason` keeps it. — test: recovery classifies panes and retries only Pi fatal stops on the recovery path; poll retries Pi fatal stops while other tools do not enter the Pi loop (machine/test/char-service-branches.test.js)
2. Restart pane classification: which cli each kind of adopted pane gets, including the fallback (`machine/service.js:550-564`). — test: recovery classifies panes and retries only Pi fatal stops on the recovery path (machine/test/char-service-branches.test.js); covered: recovery stops Kimi while leaving Claude and marker-priority panes alone (machine/test/kimi-turns.test.js)
3. Login output scrub of OpenRouter keys in login state/status responses, for every tool (`:1740-1794`, `:1757,1763`), and login differences per tool (login executable, cwd, prompt, completion). — test: login state responses scrub keys for every tool; login starts each tool with its own executable and working directory (machine/test/char-service-branches.test.js); covered: login sessions start, expose state, accept code and stay out of session recovery; Claude login menu is answered once across repeated login state reads; Antigravity start, prompt polling, status and login completion (machine/test/service.test.js); Kimi login results persist and require successful exit (machine/test/kimi.test.js); Pi completion handles saved screen, exit marker and missing pane (machine/test/pi-login.test.js); captured login screens parse wrapped URLs and device codes (machine/test/accounts.test.js)
4. Version gate at launch and status/version checks per tool (`:805-806,839`, `:1805-1898`): which tools are checked and the exact messages. — test: launch version gates apply to Pi and Kimi and preserve their exact errors; status version checks retain per-tool results and version messages (machine/test/char-service-branches.test.js); covered: Pi version probe gates old versions and caches by executable mtime (machine/test/pi.test.js); version cache checks semver and invalidates when mtime changes (machine/test/kimi.test.js)
5. `POST /v1/preflight`: with and without an account `dir`, the env it passes (Codex `loginEnv` only with dir) and the 200/409 mapping (use a fake `codex/preflight.sh` via PATH or the existing seam the service test uses; if no seam exists, skip with reason). — test: preflight passes account CODEX_HOME only for a directory and maps exit status (machine/test/char-service-branches.test.js)
6. Usage carried in hook payloads (`:1641`): recorded for Claude and Codex, ignored for the other three. — test: usage-source hook records Claude and Codex and ignores the other tools (machine/test/char-service-branches.test.js)
7. Launch preparation differences: Kimi executable resolution, Claude settings/MCP handling and key injection (`:940-1003`), pane capture options (`:601`). — test: launch preparation selects project keys and dropped MCP settings per tool; pane capture joins wrapped lines only for Pi (machine/test/char-service-branches.test.js); covered: launch rechecks the executable after worktree creation and uses that path (machine/test/kimi.test.js); session launcher passes only selected keys outside recorded commands (machine/test/project-keys.test.js); marked Claude tool is rewritten once, written privately and removed at stop (machine/test/win-forward-service.test.js)
8. Transcript copy: Pi lines redacted, Kimi file-identity checks (`:1478-1489,1554`). — test: transcript copy redacts Pi lines and preserves lines for the other tools (machine/test/char-service-branches.test.js); covered: copier refuses replaced or shortened Kimi logs; chat binds before polling and simultaneous chat and polling share identity (machine/test/kimi-turns.test.js)

The Kimi fatal stop is intentionally not called by the Pi-specific startup recovery loop; Kimi's own later poll loop does stop a Kimi session with an end reason.

## Validation

`node --test machine/test/char-service-*.test.js` (final, after fixture isolation):

```text
exit 0
TAP version 13
# Subtest: recovery classifies panes and retries only Pi fatal stops on the recovery path
ok 1 - recovery classifies panes and retries only Pi fatal stops on the recovery path
  ---
  duration_ms: 14.166033
  type: 'test'
  ...
# Subtest: poll retries Pi fatal stops while other tools do not enter the Pi loop
ok 2 - poll retries Pi fatal stops while other tools do not enter the Pi loop
  ---
  duration_ms: 4.747367
  type: 'test'
  ...
# Subtest: pane capture joins wrapped lines only for Pi
ok 3 - pane capture joins wrapped lines only for Pi
  ---
  duration_ms: 4.589581
  type: 'test'
  ...
# Subtest: usage-source hook records Claude and Codex and ignores the other tools
ok 4 - usage-source hook records Claude and Codex and ignores the other tools
  ---
  duration_ms: 5.771315
  type: 'test'
  ...
# Subtest: login state responses scrub keys for every tool
ok 5 - login state responses scrub keys for every tool
  ---
  duration_ms: 44.457382
  type: 'test'
  ...
# Subtest: launch version gates apply to Pi and Kimi and preserve their exact errors
ok 6 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 31.010024
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 7 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 60.20227
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 8 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 28.37013
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 9 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 11.953989
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 10 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 30.156638
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 11 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 13.933942
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 318.925582
```

`bash machine/test/run.sh` (before the fixture-isolation change):

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w3/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w3/machine/lib/win.js:107:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w3/machine/lib/win.js:470:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w3/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 703 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 2.163411
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 704 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 11.108125
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 705 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 51.158106
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w3/machine/test/win.test.js:373:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w3/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 706 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 48.210506
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 707 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 46.47462
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w3/machine/test/win.test.js:402:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w3/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..707
# tests 707
# suites 0
# pass 686
# fail 19
# cancelled 0
# skipped 2
# todo 0
# duration_ms 66268.114218
```

The machine suite had the 18 expected failures due to absent `wslpath`, plus one additional failure. The additional failure was `project tools launch privately and stale Antigravity files are swept`: `tmux buffer failed` in `MachineService.submit`. Its isolated diagnostic passed below; the full-suite failure remains unverified and the task is blocked under the stated machine validation gate. All 19 failing tests:

- project tools launch privately and stale Antigravity files are swept
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

`node --test --test-name-pattern='project tools launch privately and stale Antigravity files are swept' machine/test/project-tools-service.test.js`:

```text
exit 0
TAP version 13
# machine: screen startup cleanup failed: wcscreen-15fcf11672ae.slice
# Subtest: project tools launch privately and stale Antigravity files are swept
ok 1 - project tools launch privately and stale Antigravity files are swept
  ---
  duration_ms: 160.537871
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
# duration_ms 534.034625
```

`(cd viewer && npm test)`:

```text
exit 0
ok 873 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 112.012106
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 874 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 78.087926
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 875 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 113.783738
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 876 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 81.177629
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 877 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 109.191227
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 878 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 101.644122
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 879 - unknown win op fails without sending a request
  ---
  duration_ms: 73.6767
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 880 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 4.183528
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 881 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 94.39654
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 882 - the page eligibility regex equals the machine one
  ---
  duration_ms: 2.190056
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 883 - the page eligibility function
  ---
  duration_ms: 3.764184
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 884 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 77.439525
  type: 'test'
  ...
1..884
# tests 900
# suites 0
# pass 900
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 67390.156828
```

Earlier focused validation runs as the file grew:

`node --test machine/test/char-service-*.test.js` (own.log):

```text
exit 0
TAP version 13
# Subtest: recovery classifies panes and retries only Pi fatal stops on the recovery path
ok 1 - recovery classifies panes and retries only Pi fatal stops on the recovery path
  ---
  duration_ms: 13.996573
  type: 'test'
  ...
# Subtest: poll retries Pi fatal stops while other tools do not enter the Pi loop
ok 2 - poll retries Pi fatal stops while other tools do not enter the Pi loop
  ---
  duration_ms: 4.435221
  type: 'test'
  ...
# Subtest: pane capture joins wrapped lines only for Pi
ok 3 - pane capture joins wrapped lines only for Pi
  ---
  duration_ms: 3.393081
  type: 'test'
  ...
# Subtest: usage-source hook records Claude and Codex and ignores the other tools
ok 4 - usage-source hook records Claude and Codex and ignores the other tools
  ---
  duration_ms: 5.885321
  type: 'test'
  ...
# Subtest: login state responses scrub keys for every tool
ok 5 - login state responses scrub keys for every tool
  ---
  duration_ms: 42.455549
  type: 'test'
  ...
# Subtest: launch version gates apply to Pi and Kimi and preserve their exact errors
ok 6 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 30.396708
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 7 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 58.806199
  type: 'test'
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 220.60397
```

`node --test machine/test/char-service-*.test.js` (own2.log):

```text
exit 0
TAP version 13
# Subtest: recovery classifies panes and retries only Pi fatal stops on the recovery path
ok 1 - recovery classifies panes and retries only Pi fatal stops on the recovery path
  ---
  duration_ms: 15.370407
  type: 'test'
  ...
# Subtest: poll retries Pi fatal stops while other tools do not enter the Pi loop
ok 2 - poll retries Pi fatal stops while other tools do not enter the Pi loop
  ---
  duration_ms: 4.124629
  type: 'test'
  ...
# Subtest: pane capture joins wrapped lines only for Pi
ok 3 - pane capture joins wrapped lines only for Pi
  ---
  duration_ms: 3.064142
  type: 'test'
  ...
# Subtest: usage-source hook records Claude and Codex and ignores the other tools
ok 4 - usage-source hook records Claude and Codex and ignores the other tools
  ---
  duration_ms: 5.765962
  type: 'test'
  ...
# Subtest: login state responses scrub keys for every tool
ok 5 - login state responses scrub keys for every tool
  ---
  duration_ms: 41.12088
  type: 'test'
  ...
# Subtest: launch version gates apply to Pi and Kimi and preserve their exact errors
ok 6 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 28.72294
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 7 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 60.573352
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 8 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 24.46656
  type: 'test'
  ...
1..8
# tests 8
# suites 0
# pass 8
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 249.916449
```

`node --test machine/test/char-service-*.test.js` (own3.log):

```text
exit 0
TAP version 13
# Subtest: recovery classifies panes and retries only Pi fatal stops on the recovery path
ok 1 - recovery classifies panes and retries only Pi fatal stops on the recovery path
  ---
  duration_ms: 15.198648
  type: 'test'
  ...
# Subtest: poll retries Pi fatal stops while other tools do not enter the Pi loop
ok 2 - poll retries Pi fatal stops while other tools do not enter the Pi loop
  ---
  duration_ms: 5.037391
  type: 'test'
  ...
# Subtest: pane capture joins wrapped lines only for Pi
ok 3 - pane capture joins wrapped lines only for Pi
  ---
  duration_ms: 3.599445
  type: 'test'
  ...
# Subtest: usage-source hook records Claude and Codex and ignores the other tools
ok 4 - usage-source hook records Claude and Codex and ignores the other tools
  ---
  duration_ms: 5.837338
  type: 'test'
  ...
# Subtest: login state responses scrub keys for every tool
ok 5 - login state responses scrub keys for every tool
  ---
  duration_ms: 40.755531
  type: 'test'
  ...
# Subtest: launch version gates apply to Pi and Kimi and preserve their exact errors
ok 6 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 30.496806
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 7 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 61.194418
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 8 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 25.865572
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 9 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 8.669408
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 10 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 28.844792
  type: 'test'
  ...
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 289.548038
```

`node --test machine/test/char-service-*.test.js` (own4.log):

```text
exit 0
TAP version 13
# Subtest: recovery classifies panes and retries only Pi fatal stops on the recovery path
ok 1 - recovery classifies panes and retries only Pi fatal stops on the recovery path
  ---
  duration_ms: 14.459466
  type: 'test'
  ...
# Subtest: poll retries Pi fatal stops while other tools do not enter the Pi loop
ok 2 - poll retries Pi fatal stops while other tools do not enter the Pi loop
  ---
  duration_ms: 4.110431
  type: 'test'
  ...
# Subtest: pane capture joins wrapped lines only for Pi
ok 3 - pane capture joins wrapped lines only for Pi
  ---
  duration_ms: 3.070735
  type: 'test'
  ...
# Subtest: usage-source hook records Claude and Codex and ignores the other tools
ok 4 - usage-source hook records Claude and Codex and ignores the other tools
  ---
  duration_ms: 5.357803
  type: 'test'
  ...
# Subtest: login state responses scrub keys for every tool
ok 5 - login state responses scrub keys for every tool
  ---
  duration_ms: 46.098494
  type: 'test'
  ...
# Subtest: launch version gates apply to Pi and Kimi and preserve their exact errors
ok 6 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 29.363973
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 7 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 60.490231
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 8 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 25.673174
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 9 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 11.852397
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 10 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 31.968978
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 11 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 13.001021
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 311.0036
```

`node --test machine/test/char-service-*.test.js` (validation-own.log):

```text
exit 0
TAP version 13
# Subtest: recovery classifies panes and retries only Pi fatal stops on the recovery path
ok 1 - recovery classifies panes and retries only Pi fatal stops on the recovery path
  ---
  duration_ms: 15.478782
  type: 'test'
  ...
# Subtest: poll retries Pi fatal stops while other tools do not enter the Pi loop
ok 2 - poll retries Pi fatal stops while other tools do not enter the Pi loop
  ---
  duration_ms: 4.03707
  type: 'test'
  ...
# Subtest: pane capture joins wrapped lines only for Pi
ok 3 - pane capture joins wrapped lines only for Pi
  ---
  duration_ms: 4.519712
  type: 'test'
  ...
# Subtest: usage-source hook records Claude and Codex and ignores the other tools
ok 4 - usage-source hook records Claude and Codex and ignores the other tools
  ---
  duration_ms: 6.59732
  type: 'test'
  ...
# Subtest: login state responses scrub keys for every tool
ok 5 - login state responses scrub keys for every tool
  ---
  duration_ms: 56.256342
  type: 'test'
  ...
# Subtest: launch version gates apply to Pi and Kimi and preserve their exact errors
ok 6 - launch version gates apply to Pi and Kimi and preserve their exact errors
  ---
  duration_ms: 33.888363
  type: 'test'
  ...
# Subtest: preflight passes account CODEX_HOME only for a directory and maps exit status
ok 7 - preflight passes account CODEX_HOME only for a directory and maps exit status
  ---
  duration_ms: 60.831541
  type: 'test'
  ...
# Subtest: launch preparation selects project keys and dropped MCP settings per tool
ok 8 - launch preparation selects project keys and dropped MCP settings per tool
  ---
  duration_ms: 29.095138
  type: 'test'
  ...
# Subtest: transcript copy redacts Pi lines and preserves lines for the other tools
ok 9 - transcript copy redacts Pi lines and preserves lines for the other tools
  ---
  duration_ms: 9.562383
  type: 'test'
  ...
# Subtest: status version checks retain per-tool results and version messages
ok 10 - status version checks retain per-tool results and version messages
  ---
  duration_ms: 31.087714
  type: 'test'
  ...
# Subtest: login starts each tool with its own executable and working directory
ok 11 - login starts each tool with its own executable and working directory
  ---
  duration_ms: 10.922801
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 339.287558
```

## Choices

- `char-service-branches.test.js`: used an optional test-only service path and mutated a scratch copy of the service to satisfy mutation checks while staying inside the no-production-edits boundary.
- Preflight test: faked the `python3` subprocess on PATH, leaving the real preflight shell script in place, to capture inherited and account-specific `CODEX_HOME` and control the exit code without network access.
- Launch-preparation test: used a fake command builder to isolate service-level key selection and dropped MCP settings for all five CLIs; existing integration tests cover the real builders.
- Login output test: used a temporary account directory for every CLI so the Kimi authentication check does not inspect host credentials.
