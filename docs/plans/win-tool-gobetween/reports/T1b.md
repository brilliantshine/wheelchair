# T1b report

Changed `machine/lib/win-tool-proxy.js` to suppress cancellation of unforwarded requests, ignore duplicate initialized notifications after handoff, and omit an absent or empty copy from the tool environment. Extended `machine/test/win-tool-proxy.test.js` and its fixture for handoff, shutdown, output flushing, broken pipes and command-only launches.

| Go-between validation | Test names |
|---|---|
| Stand-in, ready, 3a, 3b, timeout, failure, stdin and client list | stand-in hands held calls to tool, caches paginated list and sets environment; ready at start pipes messages and returns final exit status with stdin open; 3a starts without synthetic messages and signals stop the tool; handoff with empty list forwards held call after readiness; timeouts, cancellation and failed state resolve stand-in calls; handoff failure replies and exits with stdin open; stdin close before ready exits without spawning; failed probe does not replace cache and client list is not cached |
| Signals, own probe, timeout and cancellation | signals close tool stdin and escalate through TERM and KILL; stand-in hands held calls to tool, caches paginated list and sets environment; handoff timeout covers calls queued during initialization; handoff suppresses cancelled requests and duplicate initialized notifications |
| Environment | stand-in hands held calls to tool, caches paginated list and sets environment; missing or empty copy is absent from tool environment (adapter passthrough belongs to T2) |
| Handoff failure and tool exit | handoff failure replies and exits with stdin open; ready at start pipes messages and returns final exit status with stdin open |
| Final response and signal status | ready at start pipes messages and returns final exit status with stdin open; tool signal status is propagated |
| Probe pagination and failure | stand-in hands held calls to tool, caches paginated list and sets environment; failed probe does not replace cache and client list is not cached |
| Exit during handoff | exiting during handoff fails queued requests |
| Large response to slow client | large final response is flushed with client stdin open |
| Call during failed state | timeouts, cancellation and failed state resolve stand-in calls |
| Finishing, closed reader, child stdin and command only | ready at start pipes messages and returns final exit status with stdin open; handoff failure replies and exits with stdin open; closed client read end during tool output shuts down without crashing; closed client read end during large final response does not crash; tool exiting while receiving input does not crash proxy; command-only entry launches |
| Missing executable | missing executable reports failure, before or after readiness |

The remaining Validation bullets concern other tasks' service, adapter and sweep ownership.

## Validation

`node --test machine/test/win-tool-proxy.test.js`:

```text
exit 0
✔ stand-in hands held calls to tool, caches paginated list and sets environment (130.490056ms)
✔ ready at start pipes messages and returns final exit status with stdin open (62.923142ms)
✔ timeouts, cancellation and failed state resolve stand-in calls (263.271152ms)
✔ handoff failure replies and exits with stdin open (68.037967ms)
✔ missing executable reports failure, before or after readiness (57.678952ms)
✔ handoff timeout covers calls queued during initialization (247.044964ms)
✔ exiting during handoff fails queued requests (80.665416ms)
✔ failed probe does not replace cache and client list is not cached (171.755332ms)
✔ 3a starts without synthetic messages and signals stop the tool (140.030952ms)
✔ large final response is flushed with client stdin open (164.107653ms)
✔ stdin close before ready exits without spawning (32.654441ms)
✔ tool signal status is propagated (51.680096ms)
✔ held calls fail immediately when readiness changes to failed (36.719498ms)
✔ handoff suppresses cancelled requests and duplicate initialized notifications (196.69427ms)
✔ missing or empty copy is absent from tool environment (119.468022ms)
✔ signals close tool stdin and escalate through TERM and KILL (187.787269ms)
✔ closed client read end during tool output shuts down without crashing (62.78506ms)
✔ closed client read end during large final response does not crash (105.320859ms)
✔ tool exiting while receiving input does not crash proxy (51.724057ms)
✔ command-only entry launches (36.200108ms)
✔ handoff with empty list forwards held call after readiness (110.594121ms)
ℹ tests 21
ℹ suites 0
ℹ pass 21
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2423.612289
```

`bash machine/test/run.sh` (captured to a log, exit and last 80 lines):

```text
exit 1
✔ sweep reconciles a dead lead with no apps (876.740784ms)
✔ sweep marks dead app copies and reconciles a shared thread worktree after a worker registered (1212.549613ms)
✔ tracker close callback marks the copy used (522.355674ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (851.354505ms)
✔ archive deletes copies while retaining conflict refs (944.50269ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (572.053659ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.53468ms)
✔ launch and restart mark existing copies used and recover only live copies (3.810882ms)
✔ launch marking causes a final reconcile after readying (899.191495ms)
✔ without launch marking, readying does not cause a final reconcile (546.791031ms)
✔ restart recovery tracks a live lead and reconciles on stop (881.464818ms)
ℹ tests 593
ℹ suites 0
ℹ pass 589
ℹ fail 4
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 51097.872384

✖ failing tests:

test at machine/test/aside-turns.test.js:152:1
✖ Pi asides validate, fork, resume, settle and redact (173.269644ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  'failed' !== 'ok'
  
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-135e4c312559-w3/machine/test/aside-turns.test.js:176:39)
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
✖ new login clears previous result and uses exact target (120.584354ms)
  Error: Kimi Code is not installed
      at MachineService.startLogin (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-135e4c312559-w3/machine/service.js:1609:88)
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-135e4c312559-w3/machine/test/kimi.test.js:170:17)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    status: 409
  }

test at machine/test/plan-files.test.js:21:1
✖ plan files use committed refs and enforce input and size limits (696.979662ms)
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
✖ archive keeps selected regular uploads, retries and reserves numbers (727.943369ms)
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

The four failures match the known exclusions in the brief; no other failures occurred.

## Choices

- `machine/test/fixtures/win-tool/server.js`: used a persistent timer after stdin end to simulate a tool that ignores EOF, and a signal handler to simulate ignoring SIGTERM.
