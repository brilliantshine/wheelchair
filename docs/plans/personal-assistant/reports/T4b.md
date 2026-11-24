# T4b report

- `viewer/app/routes.js:560`: strip `_assistant_title` from browser thread creation; assistant actions retain their existing private input path. No other production behaviour bug was exposed.
- `viewer/test/assistant.test.js:190`: add separate cases for browser title isolation, two-machine/archive listing, failed launch, press attribution and browser clearing, approval `recheck` refresh, token-free results, archived/handed-off refusals, all self-target refusals, and CLI file arguments.
- Mutation check: deliberately broke each new test's covered behaviour simultaneously and ran the focused suite; all nine new cases failed. Restored source before the full run. The token mutation deliberately added the seeded token to archive output.

## Focused validation

`node --test viewer/test/assistant.test.js`

```
exit 0
  ...
# Subtest: assistant CLI sends the contents of message and text files
ok 13 - assistant CLI sends the contents of message and text files
  ---
  duration_ms: 70.343727
  type: 'test'
  ...
1..13
# tests 13
# suites 0
# pass 13
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7168.012679
```

Initial focused run: exit 1, 12 passed and 1 failed due to the test expecting 200 instead of the browser press route's 202; corrected the assertion.

## Mutation run

`node --test viewer/test/assistant.test.js` with deliberate mutations (restored afterward)

```
exit 1
1..13
# tests 13
# suites 0
# pass 3
# fail 10
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6518.84474
```

## Full viewer validation

`node --test viewer/test/*.test.js` first attempt: exit 1, terminated after the suite stopped progressing following a port-collision failure. It also hit the documented pre-existing `app-harnesses.test.js:311` timing failure; no final test counts were produced.

```
exit 1
# Subtest: restart context carries recent peer messages after import cutoff and omits empty history
ok 369 - restart context carries recent peer messages after import cutoff and omits empty history
  ---
  duration_ms: 513.900664
  type: 'test'
  ...
# Subtest: stub additions validate and append only to unopened candidates
ok 370 - stub additions validate and append only to unopened candidates
  ---
  duration_ms: 273.449041
  type: 'test'
  ...
```

`node --test --test-name-pattern='opens a waiting stub after the 10-minute check' viewer/test/app-hub.test.js` (isolated recheck of the port-collision test)

```
exit 0
TAP version 13
# Subtest: opens a waiting stub after the 10-minute check finds its parent merged
ok 1 - opens a waiting stub after the 10-minute check finds its parent merged
  ---
  duration_ms: 1349.97793
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
# duration_ms 1470.692327
```

`node --test viewer/test/*.test.js` retry:

```
exit 1
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 935 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 62.521943
  type: 'test'
  ...
1..935
# tests 951
# suites 0
# pass 949
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 70685.894727
```

The retry failed the documented pre-existing `app-harnesses.test.js:311` timing check and `server.test.js:579` global write-lock assertion (`null !== 'left'`), also reported as intermittent in T4. The full gate therefore did not pass.

## Choices

- `viewer/app/routes.js`: strip the private `_assistant_title` field at the browser route, preserving the assistant's existing internal argument.
- `viewer/test/assistant.test.js`: use approval `recheck` as the refresh-only press path and an idea card for the later browser press.
