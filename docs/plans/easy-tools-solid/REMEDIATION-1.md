# Remediation 1 — easy-tools-solid

Verification Attempt 1 (`858dfa51934cceb91976b751384d10e559a5728c`) returned `VERDICT: FAIL` from both Claude (`claude-opus-5-5`) and GPT (`gpt-6.2-sol`). Check Once Built #1 was judged an Accepted Risk (`verification-1`, per lead decision). The 4 remaining gaps go to remediation below.

## Merged Gap List (verbatim)

1. `GAP: S4.3 — The keyed HTTP proxy drops client replies to server-initiated JSON-RPC requests — machine/lib/http-tool-proxy.js:101 accepts only messages with a method. The fixture delivered a sampling/createMessage request to the client, then the proxy discarded the client’s reply and the tool call failed.` (Also reported by Claude verifier: `machine/lib/http-tool-proxy.js:100` drops `roots/list` client reply.)
2. `GAP: S4.3 — A late initialize reply produces a second terminal response for the same ID — the fixture received -32603 at the 30-second deadline and a success for ID 1 one second later. The deadline at machine/lib/http-tool-proxy.js:34 leaves the upstream POST active.`
3. `GAP: S3.3 — The test requires python3 even when it is unavailable — viewer/test/wc-tool.test.js:42 runs the handshake unconditionally. With Python removed from PATH, the new test failed at that assertion. The case is absent at the comparison commit.`
4. `GAP: repo law CONTRIBUTING.md:50 — The completion report cites unrelated lines as evidence for the S1.2 drain tests — docs/plans/easy-tools-solid/COMPLETION.md:15 points to lines 158–190, while the tests are at machine/test/folder-tools-run.test.js:50 and :66.`

## Tasks

### R1-A — Fix `http-tool-proxy.js` client replies and deadline abort (Gaps 1 & 2)
- **Provider / tier:** `gpt` / `standard` (same provider that built T3)
- **Ownership boundary:** `machine/lib/http-tool-proxy.js`, `machine/test/http-tool-proxy.test.js`, `docs/plans/easy-tools-solid/reports/R1-A.md`
- **Objective:**
  1. Forward client JSON-RPC responses (messages without `method` that carry `id` and `result` or `error`) from `process.stdin` to the HTTP server without waiting for a response matching `msg.id` (settle on HTTP headers/202/2xx, and never emit `-32603` back to stdout on failure).
  2. Abort the in-flight HTTP `AbortController` when the 30-second `initGate` / `recover` deadline expires, and suppress any late stdout forwarding after deadline/abort so a timed-out `initialize` never emits a second terminal reply for the same `id`.
  3. Add regression tests in `machine/test/http-tool-proxy.test.js` covering both: (a) a server-initiated request on an open SSE `tools/call` stream answered by a client reply on stdin, completing the outer `tools/call`; and (b) a slow `initialize` that hits the deadline and replies late, verifying only ONE `-32603` reply is emitted for `id: 1` (using a short configurable deadline env override in tests, defaulting to 30000 ms in production).
- **Validation:** `node --test machine/test/http-tool-proxy.test.js`

### R1-B — Guard Python starter live handshake when `python3` is absent (Gap 3)
- **Provider / tier:** `gpt` / `standard` (same provider that built T2)
- **Ownership boundary:** `viewer/test/wc-tool.test.js`, `docs/plans/easy-tools-solid/reports/R1-B.md`
- **Objective:**
  1. In `viewer/test/wc-tool.test.js`, check whether `python3` is available on `PATH` (using `spawnSync('python3', ['--version']).status === 0`) before running/asserting the live `wc.js tool check` pass on the generated Python starter. Still test template creation, file mode, absence of `mcp-stdio.js`, and flag validation unconditionally; and run the live `wc.js tool check` whenever `python3` is on `PATH` (as on this machine).
- **Validation:** `node --test viewer/test/wc-tool.test.js` (both normally with `python3` on `PATH` AND with a stripped `PATH` without `python3`).

### R1-C — Fix S1.2 line reference in `COMPLETION.md` (Gap 4)
- **Owner:** sub-lead (applied directly when updating `COMPLETION.md` for Remediation 1)
- **Objective:** Update `docs/plans/easy-tools-solid/COMPLETION.md:15` from `machine/test/folder-tools-run.test.js:158-190` to `machine/test/folder-tools-run.test.js:50-77`.
