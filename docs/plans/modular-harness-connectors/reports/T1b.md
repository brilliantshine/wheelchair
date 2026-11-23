# T1b — characterization tests (partial)

## Changes and inventory

- `machine/test/char-hook-suppression.test.js`: agent hook route suppresses only Kimi and forwards every other CLI.
- `machine/test/char-win-prompt.test.js`: Unity launch guidance restricts only sandboxed Codex across all five CLIs, including unrestricted mode.
- `viewer/test/char-ready.test.js`: readiness uses each CLI login and reserves preflight for Codex, including exact failure text.
- `viewer/test/char-settings-defaults.test.js`: fresh and migrated placement orders preserve exclusions and add unseen families, and reviewer-family values survive normalization.
- Pi report retry → already covered by `Pi retries an empty transcript until its entry arrives` (`viewer/test/app-report-retry.test.js`).
- Exact GPT effort error → already covered by `viewer/test/app-settings.test.js`.

Each new test was run with a deliberate mutation of its target, observed to fail, and the production file restored. These tests do not finish the inventory. The remaining unaudited or unfinished branches from T1 are Pi recovery retry, login-state output scrubbing, per-tool launch/status version checks, preflight cases, hook usage payloads, per-provider asides, other sandbox checks, project tools checks, installer version arguments and sensitivity trigger, hub idle-poll coverage, hub session model and effort, hub live switching, balancing, usage display, route validation and reviewer wording, Claude aside parent, and other map and S4 inventory. They are not classified as real-CLI/network skips.

## Validation

`bash machine/test/run.sh (first, interrupted after stall)`:

```text
exit 1 (interrupted)
  type: 'test'
  ...
# Subtest: refuses after two changes during apply without losing edits
ok 620 - refuses after two changes during apply without losing edits
  ---
  duration_ms: 1882.5685
  type: 'test'
  ...
# Subtest: interrupted Windows apply is resumed after another Linux edit
ok 621 - interrupted Windows apply is resumed after another Linux edit
  ---
  duration_ms: 1459.449357
  type: 'test'
  ...
# Subtest: raw bytes, executable mode, force-added and newly ignored files
ok 622 - raw bytes, executable mode, force-added and newly ignored files
  ---
  duration_ms: 1241.432749
  type: 'test'
  ...
# Subtest: seeding copies only ignored paths accepted by the new worktree
ok 623 - seeding copies only ignored paths accepted by the new worktree
  ---
  duration_ms: 728.799928
  type: 'test'
  ...
# Subtest: seeding accepts robocopy success code 1 and reports failure code 8
ok 624 - seeding accepts robocopy success code 1 and reports failure code 8
  ---
  duration_ms: 931.550873
  type: 'test'
  ...
# Subtest: first and second reconciles preserve seeded ignored files outside both indexes and base
ok 625 - first and second reconciles preserve seeded ignored files outside both indexes and base
  ---
  duration_ms: 1241.393416
  type: 'test'
  ...
# Subtest: seeding collapses a large ignored folder and keeps the command short
ok 626 - seeding collapses a large ignored folder and keeps the command short
  ---
  duration_ms: 774.289986
  type: 'test'
  ...
# Subtest: deleting unresolved copies saves the Windows snapshot and removes copy refs
ok 627 - deleting unresolved copies saves the Windows snapshot and removes copy refs
  ---
  duration_ms: 796.979837
  type: 'test'
  ...
# Subtest: concurrent reconciles for the same copy are serialized
ok 628 - concurrent reconciles for the same copy are serialized
  ---
  duration_ms: 834.983554
  type: 'test'
  ...
# Subtest: interrupted conflict application retains marker masking on the next sync
ok 629 - interrupted conflict application retains marker masking on the next sync
  ---
  duration_ms: 1099.267752
  type: 'test'
  ...
# Subtest: later force-add, repeated tracked deletion, and successive Windows edits sync
ok 630 - later force-add, repeated tracked deletion, and successive Windows edits sync
  ---
  duration_ms: 1685.805502
  type: 'test'
  ...
# Subtest: clean checkout LFS and eol attributes do not transform bridge bytes
ok 631 - clean checkout LFS and eol attributes do not transform bridge bytes
  ---
  duration_ms: 464.622852
  type: 'test'
  ...
# Subtest: a force-tracked ignored file survives repeated syncs and edits in both directions
ok 632 - a force-tracked ignored file survives repeated syncs and edits in both directions
  ---
  duration_ms: 2568.827329
  type: 'test'
  ...
```

`(cd viewer && npm test) (first, interrupted after stall)`:

```text
exit 130 (interrupted)
  type: 'test'
  ...
# Subtest: wc.js passes worktree-remove through with the worker session, and requires a commit message
ok 431 - wc.js passes worktree-remove through with the worker session, and requires a commit message
  ---
  duration_ms: 4.573849
  type: 'test'
  ...
# Subtest: wc.js preserves git flags and the worker replacement option
ok 432 - wc.js preserves git flags and the worker replacement option
  ---
  duration_ms: 0.726838
  type: 'test'
  ...
# Subtest: a hub keeps the version captured at construction after its clone advances
ok 433 - a hub keeps the version captured at construction after its clone advances
  ---
  duration_ms: 95.057521
  type: 'test'
  ...
# Subtest: wc.js sends provider constraints and prints waiting and notice output
ok 434 - wc.js sends provider constraints and prints waiting and notice output
  ---
  duration_ms: 125.18246
  type: 'test'
  ...
# Subtest: MERGED posts exactly one card and marker; a second poll posts nothing
ok 435 - MERGED posts exactly one card and marker; a second poll posts nothing
  ---
  duration_ms: 67.576025
  type: 'test'
  ...
# Subtest: overlapping sweeps return immediately and call gh once per thread
ok 436 - overlapping sweeps return immediately and call gh once per thread
  ---
  duration_ms: 44.317204
  type: 'test'
  ...
# Subtest: archiving during gh leaves no merged card
ok 437 - archiving during gh leaves no merged card
  ---
  duration_ms: 105.525763
  type: 'test'
  ...
# Subtest: init resolves while gh is still running
ok 438 - init resolves while gh is still running
  ---
  duration_ms: 65.682225
  type: 'test'
  ...
# Subtest: OPEN, CLOSED and failing gh leave threads unchanged and do not throw
ok 439 - OPEN, CLOSED and failing gh leave threads unchanged and do not throw
  ---
  duration_ms: 55.380653
  type: 'test'
  ...
# Subtest: archived and invalid URLs are not checked; newest unreplaced done URL wins
ok 440 - archived and invalid URLs are not checked; newest unreplaced done URL wins
  ---
  duration_ms: 53.060731
  type: 'test'
  ...
# Subtest: merged needs attention until keep resolves without a live lead
ok 441 - merged needs attention until keep resolves without a live lead
  ---
  duration_ms: 56.367679
  type: 'test'
  ...
# Subtest: successful archive resolves merged cards; failed archive leaves them open
ok 442 - successful archive resolves merged cards; failed archive leaves them open
  ---
  duration_ms: 92.424923
  type: 'test'
  ...
# Subtest: card.js refuses merged from a session
ok 443 - card.js refuses merged from a session
  ---
  duration_ms: 137.469086
  type: 'test'
  ...
```

`bash machine/test/run.sh (timeout 180 wrapper)`:

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w2/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w2/machine/lib/win.js:107:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w2/machine/lib/win.js:470:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w2/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 692 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.962659
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 693 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 5.327727
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 694 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 40.041543
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w2/machine/test/win.test.js:373:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w2/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 695 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 40.848785
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 696 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 42.506733
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w2/machine/test/win.test.js:402:1'
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
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w2/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..696
# tests 696
# suites 0
# pass 676
# fail 18
# cancelled 0
# skipped 2
# todo 0
# duration_ms 63599.755143
```

The completed machine run had these 18 known `wslpath` failures, and no others:

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

`(cd viewer && npm test)` (timeout 180 wrapper):

```text
exit 0
ok 873 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 42.901652
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 874 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 42.13132
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 875 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 42.046318
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 876 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 39.40352
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 877 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 43.333297
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 878 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 38.730053
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 879 - unknown win op fails without sending a request
  ---
  duration_ms: 33.512838
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 880 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.504374
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 881 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 45.086145
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 882 - the page eligibility regex equals the machine one
  ---
  duration_ms: 1.736317
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 883 - the page eligibility function
  ---
  duration_ms: 0.574778
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 884 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 39.80669
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
# duration_ms 48744.181939
```

## Choices

- Validation: ran the two suites sequentially after parallel runs stalled; wrapped each retry in a 180-second timeout.
