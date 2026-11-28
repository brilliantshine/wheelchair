# Remediation 3 — easy-tools-solid

Verification Attempt 3 (`8b0b03b964cab86833b723aa59d62588d00f1be5`) returned `VERDICT: PASS` from Claude (`claude-opus-5-5`) and `VERDICT: FAIL` from GPT (`gpt-6.2-sol`). GPT's rare-path trailing-SSE-notification gap was recorded in `PLAN.md` Accepted Risks (`verification-3`). The remaining 3 gaps go to remediation below.

## Merged Gap List (verbatim)

1. `GAP: S4.3 — HTTP 404 recovery drops the server’s initialization ping and fails the original request — machine/lib/http-tool-proxy.js:46,64. The loopback fixture saw a second initialization, received zero ping replies, and returned JSON-RPC -32603 to the client.`
2. `GAP: S4.4 — wc.js tool check times out when an HTTP server sends a ping during initialization — machine/lib/mcp-http.js:54–59. The unkeyed fixture received no pong, and the CLI exited 1 with Server handshake timed out.`
3. `GAP: repo law CONTRIBUTING.md:50 — The completion report cites a nonexistent line in the remediation tests — docs/plans/easy-tools-solid/COMPLETION.md:104 cites machine/test/http-tool-proxy.test.js:130–167, but the file ends at line 166.`

## Tasks

### R3-A — Reply to server `ping` during `recover` and `httpHandshake` (Gaps 1 & 2)
- **Provider / tier:** `gpt` / `standard` (same provider that built T3 / R1-A / R2-A)
- **Ownership boundary:** `machine/lib/http-tool-proxy.js`, `machine/lib/mcp-http.js`, `machine/test/http-tool-proxy.test.js`, `docs/plans/easy-tools-solid/reports/R3-A.md`
- **Objective:**
  1. In `machine/lib/http-tool-proxy.js`: when `post(...)` runs with `forward === false` (internal 404 recovery `initialize`) and receives a server-initiated `ping` (`response && typeof response === 'object' && response.method === 'ping' && response.id !== undefined`), POST `{ jsonrpc: '2.0', id: response.id, result: {} }` back to `url` (using `responseHeaders?.['mcp-session-id'] || sid` and `version`, ignoring its body) so 404 recovery never stalls on a server `ping` during re-initialization.
  2. In `machine/lib/mcp-http.js`: in `httpHandshake`, when `onMessage` receives a server-initiated `ping` (`msg.method === 'ping' && msg.id !== undefined`), POST `{ jsonrpc: '2.0', id: msg.id, result: {} }` back to `url` (using current `headers`, `sessionId`, `protocolVersion: version`, `signal: controller.signal`, ignoring errors) so `wc.js tool check` answers server `ping` requests during handshake.
  3. Add regression tests in `machine/test/http-tool-proxy.test.js` covering both: (a) 404 recovery when the server sends a `ping` during the recovery `initialize` SSE stream; and (b) `httpHandshake` when the server sends a `ping` during `initialize` SSE stream.
- **Validation:** `node --test machine/test/http-tool-proxy.test.js && node --test viewer/test/wc-tool.test.js`

### R3-B — Fix line bounds in `COMPLETION.md` (Gap 3)
- **Owner:** sub-lead (applied directly after R3-A merges, verifying every single `file:line` range against `wc -l` at HEAD).
