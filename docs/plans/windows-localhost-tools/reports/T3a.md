# T3a — Windows forward module

Implemented the Linux private-port forward, serialized atomic record and restart restoration in `machine/lib/win-forward.js`. Added the Node relay stand-in `machine/test/fixtures/fake-relay.js` and module tests in `machine/test/win-forward.test.js`. No files outside the task boundary were changed; this report is `docs/plans/windows-localhost-tools/reports/T3a.md`.

The full machine suite has only the four failures identified in the brief: the Pi aside, missing Kimi, and two tests using port 7374. The PowerShell relay and live Windows test belong to T3b.

## Test case mapping

| Spec case | Test name |
|---|---|
| Shared forward, concurrent gets, record before return, serialized writes, failed write and retry; readiness checked on existing forward | shared forward and serialized concurrent records; retry a failed record |
| Restore recorded port, unavailable bridge, restored connection, occupied port, stale note and new record | restart restores while unavailable, pipes, marks occupied port stale and replaces record |
| No live wheelchair tmux session; missing record | restart without wheelchair tmux empties record; missing record is harmless |
| Unchanged HTTP bytes, Host-built 307 redirect and follow-up, streamed pieces | byte pipe preserves Host redirect and streams response pieces |
| Pre-OK bytes in order; header and tool bytes in one chunk | pre-OK client bytes arrive in order and header leftovers are delivered |
| Buffer over 64 KiB and resume after OK | pre-header buffering pauses a large upload and resumes in order |
| Refusal closes without reply; last refusal and ISO time; next OK clears it | refusal closes without bytes, status last clears on next OK |
| FIN and reset before OK kill relay; later close cannot overwrite previous refusal | client FIN and reset before OK kill relay without changing last refusal |
| Header timeout and later close, no header, oversized header, spawn error | timeout, no header, long header and failed start settle once |
| OK or REFUSED then immediate exit judged by header | immediate OK and REFUSED headers beat process close |
| Relay exits during large upload; another connection works | upload relay failure stays local and later connection succeeds |
| Slow reader bounds buffering and another connection works | stalled response applies backpressure while another connection works |
| Final server bytes arrive before close | last server bytes are delivered before close |
| Relay exits on stdin end | stand-in relay exits on stdin closure |
| Check mode, OK, refusal, capped timeout and kill, start failure, no forward or record | check uses check mode, reports headers and timeout without records or forwards |

## Choices

- `win-forward.js`: Invalid ports throw `RangeError` before relay text is built; malformed relay headers are treated as helper failures.
- `win-forward.js`: Invalid or duplicate entries in a readable restart record are skipped; listener handles are unreferenced so isolated tests can exit while service-owned listeners remain open.
- `win-forward.test.js`: Record-write failure is injected by placing a regular file at the intended directory path, since permission changes do not reliably fail for every test user.

## Validation

Earlier focused runs also passed: first run `15` was not yet present (12 tests: pass 12, fail 0); second run: 15 tests, pass 15, fail 0. Final focused run:

```text
$ node --test machine/test/win-forward.test.js
exit 0
✔ shared forward and serialized concurrent records; retry a failed record (11.067568ms)
✔ restart restores while unavailable, pipes, marks occupied port stale and replaces record (30.178287ms)
✔ restart without wheelchair tmux empties record; missing record is harmless (1.687642ms)
✔ byte pipe preserves Host redirect and streams response pieces (152.464225ms)
✔ pre-OK client bytes arrive in order and header leftovers are delivered (124.066669ms)
✔ refusal closes without bytes, status last clears on next OK (45.104018ms)
✔ client FIN and reset before OK kill relay without changing last refusal (66.663853ms)
✔ timeout, no header, long header and failed start settle once (901.160642ms)
✔ immediate OK and REFUSED headers beat process close (49.872785ms)
✔ upload relay failure stays local and later connection succeeds (71.248806ms)
✔ last server bytes are delivered before close (27.177683ms)
✔ check uses check mode, reports headers and timeout without records or forwards (1057.722131ms)
✔ pre-header buffering pauses a large upload and resumes in order (176.388186ms)
✔ stalled response applies backpressure while another connection works (645.965095ms)
✔ stand-in relay exits on stdin closure (25.439355ms)
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3437.156742
```

```text
$ node --test machine/test/*.test.js
exit 1
✔ sweep reconciles a dead lead with no apps (884.247792ms)
✔ sweep marks dead app copies and reconciles a shared thread worktree after a worker registered (1268.491847ms)
✔ tracker close callback marks the copy used (533.799113ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (891.476895ms)
✔ archive deletes copies while retaining conflict refs (1034.049875ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (535.996207ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.54769ms)
✔ launch and restart mark existing copies used and recover only live copies (3.700671ms)
✔ launch marking causes a final reconcile after readying (858.733118ms)
✔ without launch marking, readying does not cause a final reconcile (524.068494ms)
✔ restart recovery tracks a live lead and reconciles on stop (869.572604ms)
ℹ tests 601
ℹ suites 0
ℹ pass 597
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 41159.985294

✖ failing tests:

test at machine/test/aside-turns.test.js:152:1
✖ Pi asides validate, fork, resume, settle and redact (118.949041ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  'failed' !== 'ok'
  
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-a1a1b7d6016d-w5/machine/test/aside-turns.test.js:176:39)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'failed',
    expected: 'ok',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at machine/test/kimi.test.js:166:1
✖ new login clears previous result and uses exact target (88.368762ms)
  Error: Kimi Code is not installed
      at MachineService.startLogin (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-a1a1b7d6016d-w5/machine/service.js:1609:88)
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-a1a1b7d6016d-w5/machine/test/kimi.test.js:170:17)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    status: 409
  }

test at machine/test/plan-files.test.js:21:1
✖ plan files use committed refs and enforce input and size limits (775.824412ms)
  Error: listen EADDRINUSE: address already in use 127.0.0.1:7374
      at Server.setupListenHandle [as _listen2] (node:net:2390:16)
      at listenInCluster (node:net:2499:12)
      at node:net:2728:7
      at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
    code: 'EADDRINUSE',
    errno: -98,
    syscall: 'listen',
    address: '127.0.0.1',
    port: 7374
  }

test at machine/test/plan-files.test.js:36:1
✖ archive keeps selected regular uploads, retries and reserves numbers (636.439553ms)
  Error: listen EADDRINUSE: address already in use 127.0.0.1:7374
      at Server.setupListenHandle [as _listen2] (node:net:2390:16)
      at listenInCluster (node:net:2499:12)
      at node:net:2728:7
      at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
    code: 'EADDRINUSE',
    errno: -98,
    syscall: 'listen',
    address: '127.0.0.1',
    port: 7374
  }
```
