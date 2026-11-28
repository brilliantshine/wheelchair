# Remediation 4 — easy-tools-solid

Verification Attempt 4 (`d10904010ccc1046a4987e64153493b606c06357`) returned 2 gaps (1 from GPT, 1 from Claude). Both go to remediation below.

## Merged Gap List (verbatim)

1. `GAP: S4.3 — A disconnect during initialization leaves the upstream MCP session open — machine/lib/http-tool-proxy.js:51 captures the session ID, but :106 clears it before recovery (:103) or shutdown (:110) can send DELETE. Two loopback probes confirmed the missing cleanup, both on immediate shutdown and after a successful recovery.`
2. `GAP: S4.5 / Validation node --test machine/test/http-tool-proxy.test.js — The Spec's own validation command failed once in 31 runs. The subtest "proxy injects keys, redacts replies, recovers one expired session and deletes on shutdown" (machine/test/http-tool-proxy.test.js:63) died 71 ms after it started, with an uncaught SyntaxError: Unexpected end of JSON input. The error came from the fixture's JSON.parse(data) at machine/test/http-tool-proxy.test.js:72... That earlier test is new in this remediation ("proxy answers a ping during 404 recovery initialization", :41-61); it calls child.kill() without waiting for the child to exit, and the next test may get the same port.`

## Tasks

### R4-A — Keep captured `sessionId` on mid-init disconnect for `DELETE` teardown & await child exit in `http-tool-proxy.test.js` (Gaps 1 & 2)
- **Provider / tier:** `gpt` / `standard` (same provider that built T3 / R1-A / R2-A / R3-A)
- **Ownership boundary:** `machine/lib/http-tool-proxy.js`, `machine/test/http-tool-proxy.test.js`, `docs/plans/easy-tools-solid/reports/R4-A.md`
- **Objective:**
  1. In `machine/lib/http-tool-proxy.js:106`: remove `if (msg.method === 'initialize') sessionId = null;` so if an `initialize` request receives `2xx` + `Mcp-Session-Id` headers and then disconnects/fails before completing, `sessionId` remains set for best-effort `DELETE` teardown during subsequent `recover(sessionId)` (`:103`) or `shutdown()` (`:110`). (On a fresh `initialize` start at `:88`, reset `sessionId = null` before sending so no prior session ID leaks, and on `4xx`/`5xx` `onHeaders` never runs so `sessionId` stays `null`.)
  2. In `machine/test/http-tool-proxy.test.js`: in every test that spawns `http-tool-proxy.js`, wait for `child` to exit in `finally` (e.g. `if (child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, 'exit'); }`) BEFORE closing the fixture server, so a dying child from one test can never send leftover traffic to the next test's ephemeral port!
  3. Add a regression test in `machine/test/http-tool-proxy.test.js` where `initialize` returns `200 text/event-stream` + `Mcp-Session-Id: s-drop` and disconnects before replying, verifying `DELETE` with `Mcp-Session-Id: s-drop` is sent both on shutdown and on subsequent recovery!
- **Validation:** `node --test machine/test/http-tool-proxy.test.js` (run 5 times in a row to confirm zero flake).
