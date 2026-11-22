# T3b report

## Changes

- `machine/lib/win.js`: `beforeLaunch` and `prepareLaunch` now log and continue when `beginReady` cannot write the initial waiting file.
- `machine/test/win-tool-ready.test.js`: added polling for asynchronous state and task registration, repaired the two late-task assertions, and covered an unwritable `win-ready` path.
- `machine/test/win-tool-service.test.js`: waits for the readying task to register before observing late completion in cleanup and failed/cancelled starts.
- `machine/test/win-tool-sweep.test.js`: added coverage that recent dead-session ready and MCP files survive sweeping.

## Validation

`for i in 1 2 3; do node --test machine/test/win-tool-ready.test.js machine/test/win-tool-service.test.js machine/test/win-tool-sweep.test.js 2>&1 | grep -E "^ℹ (pass|fail)"; done`

```text
ℹ pass 12
ℹ fail 0
ℹ pass 12
ℹ fail 0
ℹ pass 12
ℹ fail 0
```

`bash machine/test/run.sh 2>&1 | tail -40` (captured to a log so the exit code and requested tail could both be retained):

```text
exit 1
✔ post-spawn and failed state write errors preserve handover outcome (615.595051ms)
✔ asynchronous spawn error retains null process ids (475.815908ms)
✔ active scope followed by launcher exit without marker fails (2033.270698ms)
✔ stopping during handover fences failure and stops app scope (2846.327108ms)

ℹ tests 605
ℹ pass 601
ℹ fail 4

✖ Pi asides validate, fork, resume, settle and redact
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 'failed' !== 'ok'
✖ new login clears previous result and uses exact target
  Error: Kimi Code is not installed
✖ plan files use committed refs and enforce input and size limits
  Error: listen EADDRINUSE: address already in use 127.0.0.1:7374
✖ archive keeps selected regular uploads, retries and reserves numbers
  Error: listen EADDRINUSE: address already in use 127.0.0.1:7374
```

The full suite had only the four pre-existing failures listed in the brief; no other failures were reported.

## Choices

none
