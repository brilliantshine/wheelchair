# R1-A report

- `machine/lib/http-tool-proxy.js`: forwards client responses and aborts initialization and recovery work at the deadline, preventing late output.
- `machine/test/http-tool-proxy.test.js`: covers a client response on an open SSE stream and a late initialization response.
- Implementation commit: `b1e3273f`.

Validation: `node --test machine/test/http-tool-proxy.test.js`

```text
exit 0
TAP version 13
# Subtest: SSE delivers multiline events before EOF
ok 1 - SSE delivers multiline events before EOF
  ---
  duration_ms: 18.305775
  type: 'test'
  ...
# Subtest: redirects are refused
ok 2 - redirects are refused
  ---
  duration_ms: 4.90243
  type: 'test'
  ...
# Subtest: HTTP handshake negotiates, lists and deletes session
ok 3 - HTTP handshake negotiates, lists and deletes session
  ---
  duration_ms: 6.404543
  type: 'test'
  ...
# Subtest: proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
ok 4 - proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
  ---
  duration_ms: 349.429222
  type: 'test'
  ...
# Subtest: oversized JSON is reported with its prefix
ok 5 - oversized JSON is reported with its prefix
  ---
  duration_ms: 3055.639994
  type: 'test'
  ...
# Subtest: proxy refuses Node network debugging
ok 6 - proxy refuses Node network debugging
  ---
  duration_ms: 52.771507
  type: 'test'
  ...
# Subtest: failed initialized notification gates queued calls and the next call recovers
ok 7 - failed initialized notification gates queued calls and the next call recovers
  ---
  duration_ms: 183.924115
  type: 'test'
  ...
# Subtest: proxy forwards client replies to server requests on an open SSE stream
ok 8 - proxy forwards client replies to server requests on an open SSE stream
  ---
  duration_ms: 61.803624
  type: 'test'
  ...
# Subtest: initialization deadline aborts late replies
ok 9 - initialization deadline aborts late replies
  ---
  duration_ms: 1006.214549
  type: 'test'
  ...
1..9
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6809.90798
```

Nothing left undone.

## Choices

- `machine/lib/http-tool-proxy.js`: Treat only positive safe integer deadline overrides as valid; otherwise use 30,000 ms.
