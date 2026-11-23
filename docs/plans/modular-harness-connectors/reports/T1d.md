# T1d — machine library characterization

## Changes

- `machine/test/char-lib-aside.test.js`: Pi assistant and thrown failure redaction.
- `machine/test/char-lib-argv.test.js`: full Pi fork and resume argument lists.
- `machine/test/char-lib-basics.test.js`: provider/model eligibility, recipes, and step classification across all five tools.
- `machine/test/char-lib-install.test.js`: fake install jobs, executable names, version arguments, labels, cleanup, sensitivity, and failed recipes.
- `machine/test/char-lib-project-tools.test.js`: project-check warnings and per-CLI launch warnings through the in-process HTTP service.
- `machine/test/char-lib-screen.test.js`: screen launch wrapper matrix.
- `machine/test/char-lib-win.test.js`: bridge denial and status for new and tmux-recovered sessions.

## Checklist

1. `machine/lib/aside-turns.js:61-147`: which providers may start an aside (and the exact rejection for the others), model validation per provider, the argv each accepted provider launches with, and Pi redaction of reply, stderr and failure text. test: aside provider eligibility and model validation (`machine/test/char-lib-basics.test.js`); Pi aside launches with complete fork and resume argument lists (`machine/test/char-lib-argv.test.js`); Pi redacts failure messages thrown before launch and returned by the assistant (`machine/test/char-lib-aside.test.js`); covered: aside turns use isolated CLI commands and persist their outcomes; Pi asides validate, fork, resume, settle and redact (`machine/test/aside-turns.test.js`)
2. Codex sandbox: `machine/lib/screen.js:223` command wrapping (Codex sandboxed vs Codex `codex_mode: 'unrestricted'` vs every other tool), `machine/lib/win.js:436,452,459` launch denial and status, for new and recovered sessions. test: screen launch wraps only sandboxed Codex for every CLI (`machine/test/char-lib-screen.test.js`); Windows bridge denies sandboxed Codex and reports status for new and recovered sessions (`machine/test/char-lib-win.test.js`)
3. `machine/lib/project-tools.js:7,20-34`: the Codex skip reason text ("on Codex: …") and the file-too-large warning, and that other tools get neither. test: project checks name Codex-only skip and command-line budget warnings; project tool launch warnings are specific to each CLI (`machine/test/char-lib-project-tools.test.js`)
4. `machine/lib/harness-install.js`: version-check arguments per tool (`--version`, Pi skipped, `:116-125`), binary names and labels (`:8-9`), and the diagram-sensitivity step (`:102-110`) running only after a Claude or Codex install, with `installedName` and `other` as today, including the `install/unseen.py` call arguments. test: install jobs use provider binaries, versions, cleanup and sensitivity; Node version errors use each npm provider label; failed Claude and Codex recipes do not run cleanup or sensitivity (`machine/test/char-lib-install.test.js`)
5. `machine/lib/harness-recipes.js`: each tool's recipe and Node requirement. test: recipes and Node requirements for all providers (`machine/test/char-lib-basics.test.js`)
6. `machine/lib/steps.js:19-38` / `codex-steps.js`: confirm existing coverage per tool or add. test: step classification uses Claude names only for Claude (`machine/test/char-lib-basics.test.js`); covered: classifies both CLI tool tables and labels and keys (`machine/test/steps.test.js`); real immediate script completes at its matching output and the other rollout tests (`machine/test/codex-steps.test.js`)

## Fault proofs

Each of the 12 new tests was run with a targeted in-memory module-source mutation supplied by a temporary Node preload; each run exited 1 and named the targeted test as `not ok`. No production file was edited. The mutations respectively changed provider acceptance, Pi argument construction, Pi failure redaction, recipe URL, step dispatch, install version execution, install label, failed-recipe setup gating, project-check wording, Codex launch-warning wording, screen wrapping, and Windows bridge sandbox detection.

## Choices

- `char-lib-win.test.js`: recovered tmux sessions have no recorded Codex mode, so the test verifies that default and also explicitly sets `unrestricted` on a recovered record to exercise the existing bridge behavior for that state.
- `char-lib-install.test.js`: only Codex and Pi labels reach the Node-version error branch because the other recipes have no Node requirement; all five executable names are checked through the actual install job.

## Validation

The machine suite was first run before two additional tests were added; it had exactly the 18 listed baseline failures. It was then rerun against the final files. Both full suites ran sequentially. Logs below include the exit line and the last 80 lines of each required command.

### `node --test machine/test/char-lib-*.test.js`

```text
exit 0
ok 1 - Pi aside launches with complete fork and resume argument lists
  ---
  duration_ms: 2021.246883
  type: 'test'
  ...
# Subtest: Pi redacts failure messages thrown before launch and returned by the assistant
ok 2 - Pi redacts failure messages thrown before launch and returned by the assistant
  ---
  duration_ms: 2017.551341
  type: 'test'
  ...
# Subtest: aside provider eligibility and model validation
ok 3 - aside provider eligibility and model validation
  ---
  duration_ms: 4.366735
  type: 'test'
  ...
# Subtest: recipes and Node requirements for all providers
ok 4 - recipes and Node requirements for all providers
  ---
  duration_ms: 0.581088
  type: 'test'
  ...
# Subtest: step classification uses Claude names only for Claude
ok 5 - step classification uses Claude names only for Claude
  ---
  duration_ms: 0.713074
  type: 'test'
  ...
# Subtest: install jobs use provider binaries, versions, cleanup and sensitivity
ok 6 - install jobs use provider binaries, versions, cleanup and sensitivity
  ---
  duration_ms: 5151.902536
  type: 'test'
  ...
# Subtest: Node version errors use each npm provider label
ok 7 - Node version errors use each npm provider label
  ---
  duration_ms: 2053.720777
  type: 'test'
  ...
# Subtest: failed Claude and Codex recipes do not run cleanup or sensitivity
ok 8 - failed Claude and Codex recipes do not run cleanup or sensitivity
  ---
  duration_ms: 2053.959802
  type: 'test'
  ...
# Subtest: project checks name Codex-only skip and command-line budget warnings
ok 9 - project checks name Codex-only skip and command-line budget warnings
  ---
  duration_ms: 11.572971
  type: 'test'
  ...
# Subtest: project tool launch warnings are specific to each CLI
ok 10 - project tool launch warnings are specific to each CLI
  ---
  duration_ms: 146.304101
  type: 'test'
  ...
# Subtest: screen launch wraps only sandboxed Codex for every CLI
ok 11 - screen launch wraps only sandboxed Codex for every CLI
  ---
  duration_ms: 992.711148
  type: 'test'
  ...
# Subtest: Windows bridge denies sandboxed Codex and reports status for new and recovered sessions
ok 12 - Windows bridge denies sandboxed Codex and reports status for new and recovered sessions
  ---
  duration_ms: 12.914054
  type: 'test'
  ...
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9312.182427
```

### `bash machine/test/run.sh` (preliminary)

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/lib/win.js:107:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/lib/win.js:470:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 702 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 1.051186
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 703 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 6.511443
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 704 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 45.751629
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:373:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 705 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 46.46672
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 706 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 39.337675
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:402:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..706
# tests 706
# suites 0
# pass 686
# fail 18
# cancelled 0
# skipped 2
# todo 0
# duration_ms 64913.931439
```

### `bash machine/test/run.sh` (final)

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/lib/win.js:107:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/lib/win.js:470:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 704 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 1.126444
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 705 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 7.401774
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 706 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 44.915496
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:373:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 707 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 41.900669
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 708 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 41.080818
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:402:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w4/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..708
# tests 708
# suites 0
# pass 688
# fail 18
# cancelled 0
# skipped 2
# todo 0
# duration_ms 64782.688648
```

### `(cd viewer && npm test)`

```text
exit 0
ok 873 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 45.934165
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 874 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 48.872894
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 875 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 43.539449
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 876 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 44.177433
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 877 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 43.830242
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 878 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 40.298705
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 879 - unknown win op fails without sending a request
  ---
  duration_ms: 36.099365
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 880 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.551578
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 881 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 43.735549
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 882 - the page eligibility regex equals the machine one
  ---
  duration_ms: 1.769776
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 883 - the page eligibility function
  ---
  duration_ms: 0.464419
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 884 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 47.949807
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
# duration_ms 49576.114808
```

The machine suite exited 1 solely for the 18 known Windows-bridge failures (the environment lacks `wslpath`):

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
