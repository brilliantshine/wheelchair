# T3b report

## Changes

- `machine/lib/win-disk.js:16-19,36-38` adds the shared-style operation header to each copy walk (`copysize`, with `{ path }`) and doubles ASCII and typographic PowerShell quote characters in the path.
- `machine/lib/win-disk.js:27-29,54-57` records each attempt time and uses it to throttle walks for ten minutes after either success or failure. Successful `measured_at` remains unchanged when a walk fails.
- `machine/test/win-disk.test.js:7,11,20-45,49,69-71` uses `makeTempSync` and checks the operation header, the failure retry window, and retry after expiry.

## Validation

Command: `bash machine/test/run.sh`

Pasted output:

```text
exit 1
ℹ tests 552
ℹ suites 0
ℹ pass 551
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 40493.983799

✖ failing tests:

test at machine/test/kimi.test.js:166:1
✖ new login clears previous result and uses exact target (90.364218ms)
  Error: Kimi Code is not installed
```

The sole failure is the pre-existing environment failure identified in the task brief.

`git diff --check` passed.

## Choices

none
