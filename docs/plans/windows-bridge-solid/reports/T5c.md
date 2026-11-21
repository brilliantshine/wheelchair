# T5c — Fix three failing tests

## Changes

- `machine/test/win.test.js:355-368,384-403`: In the readying and restart recovery tests, set `used_since_ok` directly with `writeState` so a live fixture's `sync` cannot re-mark the copy. Added a control test at lines 370-382 that omits `afterLaunch` and asserts that stop performs zero reconciles.
- `machine/test/win-service.test.js:125-136`: Changed the Codex budget fixture to 20 Windows servers with 1,000 single quotes in each argument. The JSON remains under the existing 32 KiB assertion while shell quoting pushes the configuration over Codex's 64 KiB budget.

## Validation

`node --test machine/test/win.test.js machine/test/win-service.test.js`

```text
ℹ tests 28
ℹ suites 0
ℹ pass 28
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 16425.065633
```

`bash machine/test/run.sh`

```text
machine exit 1
ℹ tests 558
ℹ suites 0
ℹ pass 557
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 39526.404392

✖ failing tests:

test at machine/test/kimi.test.js:166:1
✖ new login clears previous result and uses exact target (132.207496ms)
  Error: Kimi Code is not installed
      at MachineService.startLogin (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w10/machine/service.js:1572:88)
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-d5233e17e73d-w10/machine/test/kimi.test.js:170:17)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1402:25)
```

The full machine suite's sole failure is the known environment-dependent Kimi Code installation failure. The changed tests all passed in both commands.

## Choices

none
