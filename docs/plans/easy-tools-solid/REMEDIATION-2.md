# Remediation 2 — easy-tools-solid

Verification Attempt 2 (`23f5ffa4113e10dd15b200ca48dcfdf45fb04547`) returned `VERDICT: FAIL` from both Claude (`claude-opus-5-5`) and GPT (`gpt-6.2-sol`). The 3 merged gaps go to remediation below.

## Merged Gap List (verbatim)

1. `GAP: S4.3 — A server ping during initialization deadlocks the keyed HTTP proxy. The proxy delivers the ping to the client, then holds the client’s reply behind the initialization promise the server is waiting to complete — machine/lib/http-tool-proxy.js:98. The loopback fixture received -32603, and the server never received the ping reply.`
2. `GAP: S4.4 — wc.js tool check crashes when an HTTP endpoint returns JSON null. It exits with an uncaught TypeError before printing the tool-specific failure or deleting the assigned session — machine/lib/mcp-http.js:23 and machine/lib/mcp-http.js:56.`
3. `GAP: repo law CONTRIBUTING.md:50 — Stale file:line references in docs/plans/easy-tools-solid/COMPLETION.md (S2.3 cites machine/lib/project-keys.js:12 instead of :17; S4.1 cites machine/lib/folder-tools.js:91 instead of :105; S4.3 cites machine/lib/http-tool-proxy.js:1-105 when the file is longer and R1-A lacks file:line references).`

## Tasks

### R2-A — Fix client reply during init & JSON `null` in `httpHandshake` (Gaps 1 & 2)
- **Provider / tier:** `gpt` / `standard` (same provider that built T3 / R1-A)
- **Ownership boundary:** `machine/lib/http-tool-proxy.js`, `machine/lib/mcp-http.js`, `machine/test/http-tool-proxy.test.js`, `docs/plans/easy-tools-solid/reports/R2-A.md`
- **Objective:**
  1. In `machine/lib/http-tool-proxy.js`: send client JSON-RPC replies (messages where `typeof msg.method !== 'string'`) immediately via `send(msg)` WITHOUT awaiting `initGate`, `initNotice`, or `recovering`, so a server-initiated `ping` (or other server request) sent during `initialize` can be answered without deadlocking.
  2. In `machine/lib/mcp-http.js`: guard `onMessage` in `httpHandshake` (and `request`) against non-object / `null` parsed JSON (`if (msg && typeof msg === 'object' && ...)`), so an HTTP endpoint returning JSON `null` (or primitive/array) never throws an uncaught `TypeError`, instead failing cleanly with a normal handshake error and still running `deleteSession` in `finally`.
  3. Add regression tests in `machine/test/http-tool-proxy.test.js` covering both: (a) a server-initiated `ping` during `initialize` answered by the client before `initialize` completes; and (b) `httpHandshake` against an HTTP endpoint returning `200 application/json` with body `null` (and `Mcp-Session-Id`), asserting `result.ok === false` (no crash) and `DELETE` teardown still runs.
- **Validation:** `node --test machine/test/http-tool-proxy.test.js && node --test viewer/test/wc-tool.test.js`

### R2-B — Verify and update all `file:line` citations in `COMPLETION.md` (Gap 3)
- **Owner:** sub-lead (applied directly after R2-A merges, verifying every single `file:line` reference in `COMPLETION.md` against the actual files at HEAD).
