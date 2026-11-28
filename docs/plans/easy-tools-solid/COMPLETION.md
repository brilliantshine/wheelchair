---
slug: easy-tools-solid
date: 2026-11-28
implemented-by: standard (gpt / gpt-6.1-terra: T1, T2, T3, T4, T6, T7, R1-A, R1-B; claude / claude-sonnet-5-5: T5)
verified-by:
  - round: 1
    lane: claude / claude-opus-5-5
    checks: standard (gpt / gpt-6.1-terra, claude / claude-sonnet-5-5)
  - round: 1
    lane: gpt / gpt-6.2-sol
    checks: standard (gpt / gpt-6.1-terra, claude / claude-sonnet-5-5)
---

# Completion Report — Make folder tools solid

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1.1 Keyless launcher output-drain fix (`pipeKeyless`) | this run | `machine/lib/tool-launch.js:55,62-79` | `node --test machine/test/folder-tools-run.test.js` (32/32 pass) |
| S1.2 Deterministic flush/EPIPE unit test + 1 MB keyed drain test | this run | `machine/test/folder-tools-run.test.js:50-77` | `node --test machine/test/folder-tools-run.test.js` (32/32 pass) |
| S2.1 Windows executable detection (`resolveProgram`, `isWindowsExecutable`, `shouldWrapWindowsProxy`) | this run | `machine/lib/folder-tools.js:65-85` | `node --test machine/test/win-tool-service.test.js` (10/10 pass) |
| S2.2 WSL readiness/proxy wiring for stdio servers, scripts, and Windows-marked HTTP servers; optional `--list-cache` + `waitReady` | this run | `machine/service.js:981-984,1003-1056`, `machine/lib/folder-tools.js:115-124`, `machine/lib/tool-launch.js:12-13,40-44`, `machine/lib/tool-bridge.js:6-11,24-36`, `machine/lib/win-tool-proxy.js:9-27,38,46,68,100` | `node --test machine/test/win-tool-proxy.test.js` (29/29 pass), `node --test machine/test/win-tool-service.test.js` (10/10 pass) |
| S2.3 `WSLENV` reservation, connector `windows`/`wrapped`/`unity` propagation, Unity prompt, Codex `WSLENV` passthrough | this run | `machine/lib/project-keys.js:12`, `machine/lib/win-prompt.js:8`, `machine/service.js:1152`, `connectors/claude/machine.js:86`, `connectors/codex/machine.js:174,189`, `connectors/agy/machine.js:108` | `node --test machine/test/project-keys.test.js` (11/11 pass), `node --test machine/test/win-launch.test.js` (2/2 pass), `node --test machine/test/win-tool-service.test.js` (10/10 pass) |
| S2.4 WSL folder tool tests | this run | `machine/test/win-tool-proxy.test.js`, `machine/test/win-tool-service.test.js:58-172` | `node --test machine/test/win-tool-proxy.test.js`, `node --test machine/test/win-tool-service.test.js` |
| S3.1 CLI `--lang node\|python` parsing | this run | `viewer/app/tool-cli.js:62-86` | `node --test viewer/test/wc-tool.test.js` (15/15 pass) |
| S3.2 Python stdlib MCP server starter template (`server-python/`) | this run | `machine/templates/tools/server-python/tool.json`, `machine/templates/tools/server-python/server.py` (mode `0o755`) | `node --test viewer/test/wc-tool.test.js` (real `python3` handshake pass) |
| S3.3 Tests and `protocol/tools.md` `--lang python` docs | this run | `viewer/test/wc-tool.test.js`, `protocol/tools.md:123` | `node --test viewer/test/wc-tool.test.js` (15/15 pass); rendered doc reviewed |
| S4.1 HTTP `tool.json` schema (`url`, `headers`, `windows`, `transport`) and Git-tree exec check skip | this run | `machine/lib/folder-tools.js:20-48,91`, `machine/lib/project-tools.js:102` | `node --test machine/test/folder-tools.test.js` (11/11 pass), `node --test machine/test/project-tools.test.js` (47/47 pass) |
| S4.2 Unkeyed HTTP folder server entries | this run | `machine/lib/folder-tools.js:116-120` | `node --test machine/test/folder-tools.test.js` (11/11 pass) |
| S4.3 Shared HTTP MCP client (`mcp-http.js`) and keyed stdio-to-HTTP proxy (`http-tool-proxy.js`) | this run | `machine/lib/mcp-http.js:1-66`, `machine/lib/http-tool-proxy.js:1-105` | `node --test machine/test/http-tool-proxy.test.js` (7/7 pass) |
| S4.4 `wc.js tool check` for HTTP folder tools + WSL `windows: true` skip | this run | `viewer/app/tool-cli.js:36-39,136-153` | `node --test viewer/test/wc-tool.test.js` (15/15 pass) |
| S4.5 HTTP proxy tests, `transport` on tool object, `protocol/tools.md` HTTP docs | this run | `machine/test/http-tool-proxy.test.js`, `protocol/tools.md:45-68,87,95` | `node --test machine/test/http-tool-proxy.test.js` (7/7 pass); rendered doc reviewed |
| S5.1 Remove sandboxed-Codex exclusion; update Tools page/API status strings | this run | `connectors/codex/machine.js:121-125,168-182`, `machine/lib/project-tools.js:160`, `viewer/pages/project-tools.js:314` | `node --test machine/test/folder-tools-launch.test.js` (52/52 pass), `node --test machine/test/project-tools.test.js` (47/47 pass), `npm --prefix viewer run test:browser -- test/app-project-tools.spec.js` (109 passed, 1 skipped) |
| S5.2 Dedicated `sandboxWrapTool`, `connectors/contract.js` & `README.md`, shared `CODEX_HOME`, `--sandbox-cli` dispatch | this run | `connectors/codex/machine.js:125`, `connectors/contract.js:24`, `connectors/README.md:79,119`, `machine/service.js:865-866,977-978,1043,1056,1139`, `machine/lib/folder-tools.js:115-122`, `machine/lib/tool-bridge.js:10-11,36`, `machine/lib/tool-run.js:17-36`, `machine/lib/tool-launch.js:12-13,44-45` | `node --test machine/test/folder-tools-launch.test.js`, `node --test machine/test/project-mcp-codex.test.js` (18/18 pass), `node --test machine/test/screen.test.js` (46/47 + 1 host-openbox skip), `node --test machine/test/name-guard.test.js` (2/2 pass), `node --test machine/test/connectors-contract.test.js` (5/5 pass) |
| S5.3 Real Codex sandbox test, `test-support/run-dir.js` custom `base` root, `machine/AGENTS.md` | this run | `machine/test/folder-tools-codex-sandbox.test.js:1-40`, `test-support/run-dir.js`, `machine/AGENTS.md:60-61` | `node --test machine/test/folder-tools-codex-sandbox.test.js` (2/2 pass, 0 skipped on `codex-cli 0.172.0`), `node --test test-support/test/*.test.js` (39/39 pass) |
| S5.4 Updated existing tests and `protocol/tools.md` sandboxed Codex docs | this run | `machine/test/folder-tools-launch.test.js`, `machine/test/project-mcp-codex.test.js`, `machine/test/project-tools.test.js`, `viewer/test/app-project-tools.spec.js`, `protocol/tools.md:43,127-129` | All targeted validation suites pass |

## Deviations from plan

- `viewer/app/tool-cli.js:144`: passes `timeoutMs: Math.max(1, remaining - 100)` to `httpHandshake` so the handshake timeout fires slightly before the CLI's outer `AbortController` timer, allowing best-effort `DELETE` session teardown on timeout.
- `machine/lib/mcp-http.js:51-52`: fixed a timer-ordering bug discovered during T5 (`a9f6a8c7`) so `timedOut = true` is set before `controller.abort()` fires, reporting `'Server handshake timed out'` on timeout.

## Routers

- `machine/AGENTS.md`: added `lib/mcp-http.js` and `lib/http-tool-proxy.js` to the file/role table, and updated the `test/` entry to note the `test/folder-tools-codex-sandbox.test.js` real-Codex exception (using isolated `run-dir.js` directories outside `/tmp`, skipping only when `codex` is not installed).
- `connectors/README.md`: documented the new optional machine member `sandboxWrapTool(command, { worktree, toolDir })` alongside `sandboxWrap`.

## Validation evidence

All targeted validation commands from `PLAN.md` passed during task acceptance:
- `node --test machine/test/folder-tools.test.js` — 11/11 pass
- `node --test machine/test/folder-tools-run.test.js` — 32/32 pass
- `node --test machine/test/folder-tools-launch.test.js` — 52/52 pass
- `node --test machine/test/folder-tools-codex-sandbox.test.js` — 2/2 pass, 0 skipped (`codex-cli 0.172.0`)
- `node --test machine/test/http-tool-proxy.test.js` — 7/7 pass
- `node --test machine/test/win-tool-proxy.test.js` — 29/29 pass
- `node --test machine/test/win-tool-service.test.js` — 10/10 pass
- `node --test machine/test/win-launch.test.js` — 2/2 pass
- `node --test machine/test/project-keys.test.js` — 11/11 pass
- `node --test machine/test/project-tools.test.js` — 47/47 pass
- `node --test machine/test/project-mcp-codex.test.js` — 18/18 pass
- `node --test machine/test/screen.test.js` — 46/47 pass (1 skip: `openbox installed on host`)
- `node --test machine/test/name-guard.test.js` — 2/2 pass
- `node --test machine/test/connectors-contract.test.js` — 5/5 pass
- `node --test test-support/test/*.test.js` — 39/39 pass
- `node --test viewer/test/wc-tool.test.js` — 15/15 pass (real `python3` handshake passed)
- `npm --prefix viewer run test:browser -- test/app-project-tools.spec.js` — 109 passed, 1 skipped (screenshot capture)
- Reviewed `protocol/tools.md` end-to-end for consistency across `--lang python`, HTTP servers, and sandboxed Codex MCP.

Full-run `summary.txt` will be appended once the full run completes on the verified commit.

## Known gaps / residual risks

- Check Once Built row 1: starting a keyed Windows stdio folder server against a slow ready file to verify whether holding `tools/list` without `--list-cache` interacts with Codex/Claude client startup timeout (to be checked by verifiers).
- Accepted Risks from `PLAN.md` (mid-session folder Unity server + account switch; >32 MiB server-initiated SSE request with `method` after 32 MiB prefix).

## Remediation rounds

### Remediation 1 (for Attempt 1 commit `858dfa51934cceb91976b751384d10e559a5728c`)

Attempt 1 verifiers (`claude / claude-opus-5-5` and `gpt / gpt-6.2-sol`) reported 4 normal-use/repo-law gaps plus Check Once Built #1 (recorded in `PLAN.md` Accepted Risks under `verification-1` per lead decision). All 4 gaps were fixed:

1. **R1-A (`machine/lib/http-tool-proxy.js`, `machine/test/http-tool-proxy.test.js`, `gpt / gpt-6.1-terra`):**
   - Forward client JSON-RPC responses (messages without `method` carrying `id` + `result`/`error`) to the HTTP server without waiting for a response matching `msg.id` or emitting `-32603` on failure.
   - Pass an `AbortController` into `deadline()` so expiring `initGate`/`initNotice`/`recover` deadlines abort the in-flight HTTP request and suppress late stdout writes, ensuring at most one terminal reply per request ID.
   - Validated: `node --test machine/test/http-tool-proxy.test.js` — 9/9 pass (including server-initiated `roots/list` on an open SSE stream and aborted late `initialize` reply).
2. **R1-B (`viewer/test/wc-tool.test.js`, `gpt / gpt-6.1-terra`):**
   - Guard only the Python starter live `wc.js tool check` assertions on `python3` availability on `PATH`, keeping template creation, mode, and flag checks unconditional.
   - Validated: `node --test viewer/test/wc-tool.test.js` — 15/15 pass with `python3` on `PATH` and 15/15 pass on an isolated Python-free `PATH`.
3. **R1-C (`docs/plans/easy-tools-solid/COMPLETION.md`):**
   - Corrected S1.2 evidence line reference from `machine/test/folder-tools-run.test.js:158-190` to `machine/test/folder-tools-run.test.js:50-77`.
