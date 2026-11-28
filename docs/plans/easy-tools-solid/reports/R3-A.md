# R3-A report

- `machine/lib/http-tool-proxy.js`: Answer server pings on recovery initialization using the response session ID without forwarding or settling the request.
- `machine/lib/mcp-http.js`: Answer server pings during handshake calls using the current session.
- `machine/test/http-tool-proxy.test.js`: Add SSE regression fixtures that wait for each ping reply before completing initialization and check the session and outcome.
- Code commit: `6a2492eb`. The three implementation files were committed; this report is committed separately.

Both regression tests failed as expected when their respective handlers were temporarily disabled, and the handlers were restored. Nothing remains undone.

## Choices

none

## Validation

`node --test machine/test/http-tool-proxy.test.js`

```text
exit 0
TAP version 13
# Subtest: SSE delivers multiline events before EOF
ok 1 - SSE delivers multiline events before EOF
  ---
  duration_ms: 14.673243
  type: 'test'
  ...
# Subtest: redirects are refused
ok 2 - redirects are refused
  ---
  duration_ms: 3.120934
  type: 'test'
  ...
# Subtest: HTTP handshake negotiates, lists and deletes session
ok 3 - HTTP handshake negotiates, lists and deletes session
  ---
  duration_ms: 5.781876
  type: 'test'
  ...
# Subtest: HTTP handshake answers a ping during initialization
ok 4 - HTTP handshake answers a ping during initialization
  ---
  duration_ms: 4.488937
  type: 'test'
  ...
# Subtest: proxy answers a ping during 404 recovery initialization
ok 5 - proxy answers a ping during 404 recovery initialization
  ---
  duration_ms: 124.226325
  type: 'test'
  ...
# Subtest: proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
ok 6 - proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
  ---
  duration_ms: 267.111235
  type: 'test'
  ...
# Subtest: oversized JSON is reported with its prefix
ok 7 - oversized JSON is reported with its prefix
  ---
  duration_ms: 3436.393061
  type: 'test'
  ...
# Subtest: proxy refuses Node network debugging
ok 8 - proxy refuses Node network debugging
  ---
  duration_ms: 56.747555
  type: 'test'
  ...
# Subtest: failed initialized notification gates queued calls and the next call recovers
ok 9 - failed initialized notification gates queued calls and the next call recovers
  ---
  duration_ms: 193.794732
  type: 'test'
  ...
# Subtest: proxy forwards client replies to server requests on an open SSE stream
ok 10 - proxy forwards client replies to server requests on an open SSE stream
  ---
  duration_ms: 62.003833
  type: 'test'
  ...
# Subtest: initialization deadline aborts late replies
ok 11 - initialization deadline aborts late replies
  ---
  duration_ms: 1005.833695
  type: 'test'
  ...
# Subtest: handshake handles null JSON and deletes the session
ok 12 - handshake handles null JSON and deletes the session
  ---
  duration_ms: 2.425491
  type: 'test'
  ...
# Subtest: request rejects errors thrown by message callbacks
ok 13 - request rejects errors thrown by message callbacks
  ---
  duration_ms: 2.468714
  type: 'test'
  ...
# Subtest: proxy forwards a client reply during initialization
ok 14 - proxy forwards a client reply during initialization
  ---
  duration_ms: 57.966862
  type: 'test'
  ...
1..14
# tests 14
# suites 0
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8296.182418
```

`node --test viewer/test/wc-tool.test.js`

```text
exit 0
TAP version 13
# Subtest: templates work, reject existing folders and names, and use checkout top
ok 1 - templates work, reject existing folders and names, and use checkout top
  ---
  duration_ms: 521.396668
  type: 'test'
  ...
# Subtest: server languages and new argument validation
ok 2 - server languages and new argument validation
  ---
  duration_ms: 774.739003
  type: 'test'
  ...
# Subtest: session list reads pinned shared tools and hides collisions
ok 3 - session list reads pinned shared tools and hides collisions
  ---
  duration_ms: 99.328097
  type: 'test'
  ...
# Subtest: run and check sanitize environment and report failures
ok 4 - run and check sanitize environment and report failures
  ---
  duration_ms: 369.243548
  type: 'test'
  ...
# Subtest: check deadline and SIGTERM kill stalled server and grandchild
ok 5 - check deadline and SIGTERM kill stalled server and grandchild
  ---
  duration_ms: 1401.809747
  type: 'test'
  ...
# Subtest: keyed lists report session status, unavailable sessions, failure and scratch checkout
ok 6 - keyed lists report session status, unavailable sessions, failure and scratch checkout
  ---
  duration_ms: 592.487636
  type: 'test'
  ...
# Subtest: keyed server lists report key status
ok 7 - keyed server lists report key status
  ---
  duration_ms: 507.457954
  type: 'test'
  ...
# Subtest: keyed check and run describe key handling while preserving caller environment
ok 8 - keyed check and run describe key handling while preserving caller environment
  ---
  duration_ms: 300.357941
  type: 'test'
  ...
# Subtest: check handshakes unkeyed and keyed HTTP servers and list reports transport
ok 9 - check handshakes unkeyed and keyed HTTP servers and list reports transport
  ---
  duration_ms: 237.670247
  type: 'test'
  ...
# Subtest: check reports HTTP server failures with the keyed note only for keyed tools
ok 10 - check reports HTTP server failures with the keyed note only for keyed tools
  ---
  duration_ms: 158.56285
  type: 'test'
  ...
# Subtest: check deadline on a stalled HTTP server reports a timeout and closes its session
ok 11 - check deadline on a stalled HTTP server reports a timeout and closes its session
  ---
  duration_ms: 1954.703631
  type: 'test'
  ...
# Subtest: check skips the live handshake only for Windows HTTP servers on WSL
ok 12 - check skips the live handshake only for Windows HTTP servers on WSL
  ---
  duration_ms: 201.459158
  type: 'test'
  ...
# Subtest: bridge reports keys added after the tool was offered
ok 13 - bridge reports keys added after the tool was offered
  ---
  duration_ms: 49.864037
  type: 'test'
  ...
# Subtest: machine keyed runs handle results, transport failures, and local fallback
ok 14 - machine keyed runs handle results, transport failures, and local fallback
  ---
  duration_ms: 466.053559
  type: 'test'
  ...
# Subtest: machine run reports refusal after successful discovery
ok 15 - machine run reports refusal after successful discovery
  ---
  duration_ms: 59.797192
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
# duration_ms 7752.344349
```
