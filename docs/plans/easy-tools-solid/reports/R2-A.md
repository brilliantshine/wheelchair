# R2-A report

- `machine/lib/http-tool-proxy.js`: Forward client replies immediately, capture initialization session headers before SSE messages, and clear the session after initialization failure.
- `machine/lib/mcp-http.js`: Reject message callback exceptions and ignore non-object handshake messages.
- `machine/test/http-tool-proxy.test.js`: Cover initialization ping replies, null JSON teardown, and callback errors.
- All requested work completed. Mutation checks confirmed the ping and callback tests fail when their fixes are reverted; reverting both null safeguards reproduced the uncaught exception (the test process required interruption). Reverting only the object guard still passes because the callback exception is caught.

## Choices

- `machine/lib/http-tool-proxy.js`: Send client replies without 404 recovery, avoiding a recovery wait for a response to an in-flight server request.
- `machine/lib/mcp-http.js`: Distinguish parser syntax errors from callback syntax errors so callback errors reject consistently.

## Validation

`node --test machine/test/http-tool-proxy.test.js`

```text
exit 0
TAP version 13
# Subtest: SSE delivers multiline events before EOF
ok 1 - SSE delivers multiline events before EOF
  ---
  duration_ms: 19.340621
  type: 'test'
  ...
# Subtest: redirects are refused
ok 2 - redirects are refused
  ---
  duration_ms: 3.995474
  type: 'test'
  ...
# Subtest: HTTP handshake negotiates, lists and deletes session
ok 3 - HTTP handshake negotiates, lists and deletes session
  ---
  duration_ms: 6.434824
  type: 'test'
  ...
# Subtest: proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
ok 4 - proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
  ---
  duration_ms: 344.52922
  type: 'test'
  ...
# Subtest: oversized JSON is reported with its prefix
ok 5 - oversized JSON is reported with its prefix
  ---
  duration_ms: 2793.07103
  type: 'test'
  ...
# Subtest: proxy refuses Node network debugging
ok 6 - proxy refuses Node network debugging
  ---
  duration_ms: 58.327488
  type: 'test'
  ...
# Subtest: failed initialized notification gates queued calls and the next call recovers
ok 7 - failed initialized notification gates queued calls and the next call recovers
  ---
  duration_ms: 198.141248
  type: 'test'
  ...
# Subtest: proxy forwards client replies to server requests on an open SSE stream
ok 8 - proxy forwards client replies to server requests on an open SSE stream
  ---
  duration_ms: 62.269229
  type: 'test'
  ...
# Subtest: initialization deadline aborts late replies
ok 9 - initialization deadline aborts late replies
  ---
  duration_ms: 1005.649718
  type: 'test'
  ...
# Subtest: handshake handles null JSON and deletes the session
ok 10 - handshake handles null JSON and deletes the session
  ---
  duration_ms: 3.397598
  type: 'test'
  ...
# Subtest: request rejects errors thrown by message callbacks
ok 11 - request rejects errors thrown by message callbacks
  ---
  duration_ms: 1.963006
  type: 'test'
  ...
# Subtest: proxy forwards a client reply during initialization
ok 12 - proxy forwards a client reply during initialization
  ---
  duration_ms: 56.321389
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
# duration_ms 7628.061037
```

`node --test viewer/test/wc-tool.test.js`

```text
exit 0
TAP version 13
# Subtest: templates work, reject existing folders and names, and use checkout top
ok 1 - templates work, reject existing folders and names, and use checkout top
  ---
  duration_ms: 506.575347
  type: 'test'
  ...
# Subtest: server languages and new argument validation
ok 2 - server languages and new argument validation
  ---
  duration_ms: 632.742891
  type: 'test'
  ...
# Subtest: session list reads pinned shared tools and hides collisions
ok 3 - session list reads pinned shared tools and hides collisions
  ---
  duration_ms: 72.193356
  type: 'test'
  ...
# Subtest: run and check sanitize environment and report failures
ok 4 - run and check sanitize environment and report failures
  ---
  duration_ms: 274.659791
  type: 'test'
  ...
# Subtest: check deadline and SIGTERM kill stalled server and grandchild
ok 5 - check deadline and SIGTERM kill stalled server and grandchild
  ---
  duration_ms: 1362.456566
  type: 'test'
  ...
# Subtest: keyed lists report session status, unavailable sessions, failure and scratch checkout
ok 6 - keyed lists report session status, unavailable sessions, failure and scratch checkout
  ---
  duration_ms: 433.256011
  type: 'test'
  ...
# Subtest: keyed server lists report key status
ok 7 - keyed server lists report key status
  ---
  duration_ms: 436.817853
  type: 'test'
  ...
# Subtest: keyed check and run describe key handling while preserving caller environment
ok 8 - keyed check and run describe key handling while preserving caller environment
  ---
  duration_ms: 316.398477
  type: 'test'
  ...
# Subtest: check handshakes unkeyed and keyed HTTP servers and list reports transport
ok 9 - check handshakes unkeyed and keyed HTTP servers and list reports transport
  ---
  duration_ms: 233.593795
  type: 'test'
  ...
# Subtest: check reports HTTP server failures with the keyed note only for keyed tools
ok 10 - check reports HTTP server failures with the keyed note only for keyed tools
  ---
  duration_ms: 154.792012
  type: 'test'
  ...
# Subtest: check deadline on a stalled HTTP server reports a timeout and closes its session
ok 11 - check deadline on a stalled HTTP server reports a timeout and closes its session
  ---
  duration_ms: 1956.33988
  type: 'test'
  ...
# Subtest: check skips the live handshake only for Windows HTTP servers on WSL
ok 12 - check skips the live handshake only for Windows HTTP servers on WSL
  ---
  duration_ms: 228.390374
  type: 'test'
  ...
# Subtest: bridge reports keys added after the tool was offered
ok 13 - bridge reports keys added after the tool was offered
  ---
  duration_ms: 57.041221
  type: 'test'
  ...
# Subtest: machine keyed runs handle results, transport failures, and local fallback
ok 14 - machine keyed runs handle results, transport failures, and local fallback
  ---
  duration_ms: 498.45023
  type: 'test'
  ...
# Subtest: machine run reports refusal after successful discovery
ok 15 - machine run reports refusal after successful discovery
  ---
  duration_ms: 72.270433
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7303.497478
```
