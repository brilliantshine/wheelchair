# R4-A report

- `machine/lib/http-tool-proxy.js`: Reset the session at the start of initialization and retain a session received before a failed stream for teardown or recovery.
- `machine/test/http-tool-proxy.test.js`: Wait for spawned children to exit during cleanup and cover dropped initialization on shutdown and recovery, including request ordering.
- File state: both implementation and test changes are included with this report. Nothing remains undone.

## Choices

- `machine/test/http-tool-proxy.test.js`: Used a shared cleanup helper and two parameterized cases to exercise shutdown and recovery independently.

## Validation

Command: `for i in 1 2 3 4 5; do node --test machine/test/http-tool-proxy.test.js || exit 1; done`

Exit: 0

```text
TAP version 13
# Subtest: SSE delivers multiline events before EOF
ok 1 - SSE delivers multiline events before EOF
  ---
  duration_ms: 33.029822
  type: 'test'
  ...
# Subtest: redirects are refused
ok 2 - redirects are refused
  ---
  duration_ms: 6.143386
  type: 'test'
  ...
# Subtest: HTTP handshake negotiates, lists and deletes session
ok 3 - HTTP handshake negotiates, lists and deletes session
  ---
  duration_ms: 13.04918
  type: 'test'
  ...
# Subtest: HTTP handshake answers a ping during initialization
ok 4 - HTTP handshake answers a ping during initialization
  ---
  duration_ms: 11.695399
  type: 'test'
  ...
# Subtest: proxy answers a ping during 404 recovery initialization
ok 5 - proxy answers a ping during 404 recovery initialization
  ---
  duration_ms: 241.173477
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on shutdown
ok 6 - dropped initialization deletes its session on shutdown
  ---
  duration_ms: 90.499077
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on recover
ok 7 - dropped initialization deletes its session on recover
  ---
  duration_ms: 138.465665
  type: 'test'
  ...
# Subtest: proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
ok 8 - proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
  ---
  duration_ms: 370.155042
  type: 'test'
  ...
# Subtest: oversized JSON is reported with its prefix
ok 9 - oversized JSON is reported with its prefix
  ---
  duration_ms: 5297.29692
  type: 'test'
  ...
# Subtest: proxy refuses Node network debugging
ok 10 - proxy refuses Node network debugging
  ---
  duration_ms: 87.425917
  type: 'test'
  ...
# Subtest: failed initialized notification gates queued calls and the next call recovers
ok 11 - failed initialized notification gates queued calls and the next call recovers
  ---
  duration_ms: 275.323783
  type: 'test'
  ...
# Subtest: proxy forwards client replies to server requests on an open SSE stream
ok 12 - proxy forwards client replies to server requests on an open SSE stream
  ---
  duration_ms: 140.454696
  type: 'test'
  ...
# Subtest: initialization deadline aborts late replies
ok 13 - initialization deadline aborts late replies
  ---
  duration_ms: 1021.147514
  type: 'test'
  ...
# Subtest: handshake handles null JSON and deletes the session
ok 14 - handshake handles null JSON and deletes the session
  ---
  duration_ms: 5.018031
  type: 'test'
  ...
# Subtest: request rejects errors thrown by message callbacks
ok 15 - request rejects errors thrown by message callbacks
  ---
  duration_ms: 2.277546
  type: 'test'
  ...
# Subtest: proxy forwards a client reply during initialization
ok 16 - proxy forwards a client reply during initialization
  ---
  duration_ms: 93.7247
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10936.81522
TAP version 13
# Subtest: SSE delivers multiline events before EOF
ok 1 - SSE delivers multiline events before EOF
  ---
  duration_ms: 29.653169
  type: 'test'
  ...
# Subtest: redirects are refused
ok 2 - redirects are refused
  ---
  duration_ms: 6.541134
  type: 'test'
  ...
# Subtest: HTTP handshake negotiates, lists and deletes session
ok 3 - HTTP handshake negotiates, lists and deletes session
  ---
  duration_ms: 14.611282
  type: 'test'
  ...
# Subtest: HTTP handshake answers a ping during initialization
ok 4 - HTTP handshake answers a ping during initialization
  ---
  duration_ms: 8.793161
  type: 'test'
  ...
# Subtest: proxy answers a ping during 404 recovery initialization
ok 5 - proxy answers a ping during 404 recovery initialization
  ---
  duration_ms: 210.108253
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on shutdown
ok 6 - dropped initialization deletes its session on shutdown
  ---
  duration_ms: 94.241132
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on recover
ok 7 - dropped initialization deletes its session on recover
  ---
  duration_ms: 114.493517
  type: 'test'
  ...
# Subtest: proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
ok 8 - proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
  ---
  duration_ms: 301.32282
  type: 'test'
  ...
# Subtest: oversized JSON is reported with its prefix
ok 9 - oversized JSON is reported with its prefix
  ---
  duration_ms: 4775.946016
  type: 'test'
  ...
# Subtest: proxy refuses Node network debugging
ok 10 - proxy refuses Node network debugging
  ---
  duration_ms: 104.787816
  type: 'test'
  ...
# Subtest: failed initialized notification gates queued calls and the next call recovers
ok 11 - failed initialized notification gates queued calls and the next call recovers
  ---
  duration_ms: 250.138298
  type: 'test'
  ...
# Subtest: proxy forwards client replies to server requests on an open SSE stream
ok 12 - proxy forwards client replies to server requests on an open SSE stream
  ---
  duration_ms: 123.767468
  type: 'test'
  ...
# Subtest: initialization deadline aborts late replies
ok 13 - initialization deadline aborts late replies
  ---
  duration_ms: 1023.518617
  type: 'test'
  ...
# Subtest: handshake handles null JSON and deletes the session
ok 14 - handshake handles null JSON and deletes the session
  ---
  duration_ms: 9.983964
  type: 'test'
  ...
# Subtest: request rejects errors thrown by message callbacks
ok 15 - request rejects errors thrown by message callbacks
  ---
  duration_ms: 3.077486
  type: 'test'
  ...
# Subtest: proxy forwards a client reply during initialization
ok 16 - proxy forwards a client reply during initialization
  ---
  duration_ms: 127.296014
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10308.743609
TAP version 13
# Subtest: SSE delivers multiline events before EOF
ok 1 - SSE delivers multiline events before EOF
  ---
  duration_ms: 19.949104
  type: 'test'
  ...
# Subtest: redirects are refused
ok 2 - redirects are refused
  ---
  duration_ms: 4.188176
  type: 'test'
  ...
# Subtest: HTTP handshake negotiates, lists and deletes session
ok 3 - HTTP handshake negotiates, lists and deletes session
  ---
  duration_ms: 9.45549
  type: 'test'
  ...
# Subtest: HTTP handshake answers a ping during initialization
ok 4 - HTTP handshake answers a ping during initialization
  ---
  duration_ms: 9.120846
  type: 'test'
  ...
# Subtest: proxy answers a ping during 404 recovery initialization
ok 5 - proxy answers a ping during 404 recovery initialization
  ---
  duration_ms: 197.364355
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on shutdown
ok 6 - dropped initialization deletes its session on shutdown
  ---
  duration_ms: 87.548072
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on recover
ok 7 - dropped initialization deletes its session on recover
  ---
  duration_ms: 109.631261
  type: 'test'
  ...
# Subtest: proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
ok 8 - proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
  ---
  duration_ms: 301.063346
  type: 'test'
  ...
# Subtest: oversized JSON is reported with its prefix
ok 9 - oversized JSON is reported with its prefix
  ---
  duration_ms: 3495.552573
  type: 'test'
  ...
# Subtest: proxy refuses Node network debugging
ok 10 - proxy refuses Node network debugging
  ---
  duration_ms: 66.764931
  type: 'test'
  ...
# Subtest: failed initialized notification gates queued calls and the next call recovers
ok 11 - failed initialized notification gates queued calls and the next call recovers
  ---
  duration_ms: 193.578261
  type: 'test'
  ...
# Subtest: proxy forwards client replies to server requests on an open SSE stream
ok 12 - proxy forwards client replies to server requests on an open SSE stream
  ---
  duration_ms: 70.598052
  type: 'test'
  ...
# Subtest: initialization deadline aborts late replies
ok 13 - initialization deadline aborts late replies
  ---
  duration_ms: 1012.426541
  type: 'test'
  ...
# Subtest: handshake handles null JSON and deletes the session
ok 14 - handshake handles null JSON and deletes the session
  ---
  duration_ms: 5.517071
  type: 'test'
  ...
# Subtest: request rejects errors thrown by message callbacks
ok 15 - request rejects errors thrown by message callbacks
  ---
  duration_ms: 2.234204
  type: 'test'
  ...
# Subtest: proxy forwards a client reply during initialization
ok 16 - proxy forwards a client reply during initialization
  ---
  duration_ms: 87.058583
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8748.601406
TAP version 13
# Subtest: SSE delivers multiline events before EOF
ok 1 - SSE delivers multiline events before EOF
  ---
  duration_ms: 23.612738
  type: 'test'
  ...
# Subtest: redirects are refused
ok 2 - redirects are refused
  ---
  duration_ms: 4.670923
  type: 'test'
  ...
# Subtest: HTTP handshake negotiates, lists and deletes session
ok 3 - HTTP handshake negotiates, lists and deletes session
  ---
  duration_ms: 9.229694
  type: 'test'
  ...
# Subtest: HTTP handshake answers a ping during initialization
ok 4 - HTTP handshake answers a ping during initialization
  ---
  duration_ms: 7.766345
  type: 'test'
  ...
# Subtest: proxy answers a ping during 404 recovery initialization
ok 5 - proxy answers a ping during 404 recovery initialization
  ---
  duration_ms: 168.01939
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on shutdown
ok 6 - dropped initialization deletes its session on shutdown
  ---
  duration_ms: 75.292179
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on recover
ok 7 - dropped initialization deletes its session on recover
  ---
  duration_ms: 86.536079
  type: 'test'
  ...
# Subtest: proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
ok 8 - proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
  ---
  duration_ms: 294.231266
  type: 'test'
  ...
# Subtest: oversized JSON is reported with its prefix
ok 9 - oversized JSON is reported with its prefix
  ---
  duration_ms: 3276.348571
  type: 'test'
  ...
# Subtest: proxy refuses Node network debugging
ok 10 - proxy refuses Node network debugging
  ---
  duration_ms: 51.662332
  type: 'test'
  ...
# Subtest: failed initialized notification gates queued calls and the next call recovers
ok 11 - failed initialized notification gates queued calls and the next call recovers
  ---
  duration_ms: 195.830675
  type: 'test'
  ...
# Subtest: proxy forwards client replies to server requests on an open SSE stream
ok 12 - proxy forwards client replies to server requests on an open SSE stream
  ---
  duration_ms: 70.043445
  type: 'test'
  ...
# Subtest: initialization deadline aborts late replies
ok 13 - initialization deadline aborts late replies
  ---
  duration_ms: 1012.650487
  type: 'test'
  ...
# Subtest: handshake handles null JSON and deletes the session
ok 14 - handshake handles null JSON and deletes the session
  ---
  duration_ms: 4.954624
  type: 'test'
  ...
# Subtest: request rejects errors thrown by message callbacks
ok 15 - request rejects errors thrown by message callbacks
  ---
  duration_ms: 3.20517
  type: 'test'
  ...
# Subtest: proxy forwards a client reply during initialization
ok 16 - proxy forwards a client reply during initialization
  ---
  duration_ms: 110.054544
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8473.598723
TAP version 13
# Subtest: SSE delivers multiline events before EOF
ok 1 - SSE delivers multiline events before EOF
  ---
  duration_ms: 25.64242
  type: 'test'
  ...
# Subtest: redirects are refused
ok 2 - redirects are refused
  ---
  duration_ms: 4.427944
  type: 'test'
  ...
# Subtest: HTTP handshake negotiates, lists and deletes session
ok 3 - HTTP handshake negotiates, lists and deletes session
  ---
  duration_ms: 8.704308
  type: 'test'
  ...
# Subtest: HTTP handshake answers a ping during initialization
ok 4 - HTTP handshake answers a ping during initialization
  ---
  duration_ms: 8.171054
  type: 'test'
  ...
# Subtest: proxy answers a ping during 404 recovery initialization
ok 5 - proxy answers a ping during 404 recovery initialization
  ---
  duration_ms: 192.056836
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on shutdown
ok 6 - dropped initialization deletes its session on shutdown
  ---
  duration_ms: 82.450585
  type: 'test'
  ...
# Subtest: dropped initialization deletes its session on recover
ok 7 - dropped initialization deletes its session on recover
  ---
  duration_ms: 91.663258
  type: 'test'
  ...
# Subtest: proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
ok 8 - proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown
  ---
  duration_ms: 306.293549
  type: 'test'
  ...
# Subtest: oversized JSON is reported with its prefix
ok 9 - oversized JSON is reported with its prefix
  ---
  duration_ms: 3620.751586
  type: 'test'
  ...
# Subtest: proxy refuses Node network debugging
ok 10 - proxy refuses Node network debugging
  ---
  duration_ms: 65.684436
  type: 'test'
  ...
# Subtest: failed initialized notification gates queued calls and the next call recovers
ok 11 - failed initialized notification gates queued calls and the next call recovers
  ---
  duration_ms: 237.660319
  type: 'test'
  ...
# Subtest: proxy forwards client replies to server requests on an open SSE stream
ok 12 - proxy forwards client replies to server requests on an open SSE stream
  ---
  duration_ms: 87.544053
  type: 'test'
  ...
# Subtest: initialization deadline aborts late replies
ok 13 - initialization deadline aborts late replies
  ---
  duration_ms: 1009.671123
  type: 'test'
  ...
# Subtest: handshake handles null JSON and deletes the session
ok 14 - handshake handles null JSON and deletes the session
  ---
  duration_ms: 5.209318
  type: 'test'
  ...
# Subtest: request rejects errors thrown by message callbacks
ok 15 - request rejects errors thrown by message callbacks
  ---
  duration_ms: 3.571696
  type: 'test'
  ...
# Subtest: proxy forwards a client reply during initialization
ok 16 - proxy forwards a client reply during initialization
  ---
  duration_ms: 94.145259
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8918.103168
```
