# T5b report

Added tests in `machine/test/win-service.test.js:111` for loaded entries on Pi and Kimi with fake executables, Codex override budget, actual prompt files, and an unresolved bridge probe. Added final-reconcile tests in `machine/test/win.test.js:355` and `:371`.

The final-reconcile tests fail before reaching their stop assertions: the fixture reports the lead as live during readying, and the state remains `used_since_ok: true` even after an explicit sync. This prevents testing the requested false-to-true launch and recovery transition. The repeated failure stopped further iteration; production code was not changed. The suite also has the stated pre-existing Kimi installation failure.

Validation: `node --test machine/test/win-service.test.js machine/test/win.test.js` (first focused run):

```text
exit 1
✔ readying times out without blocking launch and does not create copies for ordinary sessions (524.92828ms)
✔ worker merge cleanup deletes its copy and stop does not reconcile (501.832776ms)
✔ verifier stop returns immediately and deletes after its apps stop (507.633928ms)
✔ failed copies survive ordinary removal and archive, but verifier and merge removal delete them (2117.130553ms)
✔ archive waits for successful final sync then deletes the copy (888.414246ms)
✔ archive waits once for a final sync and retains a failed copy (589.412821ms)
✔ sweep reconciles a dead lead with no apps (928.696768ms)
✔ sweep marks dead app copies and reconciles a shared thread worktree after a worker registered (1291.920051ms)
✔ tracker close callback marks the copy used (502.510903ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (844.573808ms)
✔ archive deletes copies while retaining conflict refs (1000.089131ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (575.683579ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.668553ms)
✔ launch and restart mark existing copies used and recover only live copies (3.983473ms)
✖ launch marking causes a final reconcile after readying (527.876982ms)
✖ restart recovery tracks a live lead and reconciles on stop (543.217417ms)
ℹ tests 27
ℹ suites 0
ℹ pass 24
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13345.957962

✖ failing tests:

test at machine/test/win-service.test.js:125:1
✖ Codex readying follows the override budget (129.097957ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(Buffer.byteLength(json) < 32 * 1024)
  
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w8/machine/test/win-service.test.js:131:12)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at machine/test/win.test.js:355:1
✖ launch marking causes a final reconcile after readying (527.876982ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w8/machine/test/win.test.js:360:10)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at machine/test/win.test.js:370:1
✖ restart recovery tracks a live lead and reconciles on stop (543.217417ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w8/machine/test/win.test.js:374:10)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }
```

Validation: `bash machine/test/run.sh`:

```text
exit 1
✔ a force-tracked ignored file survives repeated syncs and edits in both directions (2766.703549ms)
✔ availability, role, session and argument checks are ordered (7.084856ms)
✔ session environment applies to tool roles without creating state (1.358927ms)
✔ run timeout syncs, status syncs an exit and launch environment excludes the token (2605.880072ms)
✔ readying times out without blocking launch and does not create copies for ordinary sessions (715.621068ms)
✔ worker merge cleanup deletes its copy and stop does not reconcile (669.084342ms)
✔ verifier stop returns immediately and deletes after its apps stop (675.031321ms)
✔ failed copies survive ordinary removal and archive, but verifier and merge removal delete them (2644.858263ms)
✔ archive waits for successful final sync then deletes the copy (938.068291ms)
✔ archive waits once for a final sync and retains a failed copy (577.744651ms)
✔ sweep reconciles a dead lead with no apps (896.804363ms)
✔ sweep marks dead app copies and reconciles a shared thread worktree after a worker registered (1295.900943ms)
✔ tracker close callback marks the copy used (532.315278ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (914.612144ms)
✔ archive deletes copies while retaining conflict refs (1002.524658ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (575.489726ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.632743ms)
✔ launch and restart mark existing copies used and recover only live copies (3.936106ms)
✖ launch marking causes a final reconcile after readying (873.843309ms)
✖ restart recovery tracks a live lead and reconciles on stop (918.700101ms)
ℹ tests 554
ℹ suites 0
ℹ pass 551
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 40033.195058

✖ failing tests:

test at machine/test/kimi.test.js:166:1
✖ new login clears previous result and uses exact target (163.416686ms)
  Error: Kimi Code is not installed
      at MachineService.startLogin (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w8/machine/service.js:1572:88)
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w8/machine/test/kimi.test.js:170:17)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    status: 409
  }

test at machine/test/win.test.js:355:1
✖ launch marking causes a final reconcile after readying (873.843309ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w8/machine/test/win.test.js:361:10)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at machine/test/win.test.js:371:1
✖ restart recovery tracks a live lead and reconciles on stop (918.700101ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w8/machine/test/win.test.js:376:10)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }
```

## Choices

- `machine/test/win-service.test.js`: used fake executables on PATH for Pi and Kimi and a 5-second upper bound for the unresolved probe.
- `machine/test/win.test.js`: used real bridge reconciliation and counted `sync` calls to check final reconciliation.
