---
slug: easy-tools-solid
status: ready-for-review
created: 2026-11-28
---

# Make folder tools solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

(None — all planning questions settled.)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Skip mockups for this thread. | Almost all work is machine/connector/CLI behavior; any Tools page change is a single status text update on the existing read-only list (`viewer/pages/project-tools.js:314`). | defaulted |
| 2 | Fix the keyless launcher output-drain race in `machine/lib/tool-launch.js` by waiting for `process.stdout` to flush before exiting, and verify both keyless and keyed drain paths under load in `machine/test/folder-tools-run.test.js`. | `child.on('close')` currently calls `process.exit(code)` while piped `process.stdout` still has buffered bytes under load. | defaulted |
| 3 | Support Windows-side folder tools from WSL for stdio servers, scripts, and Windows-marked localhost HTTP servers by reusing the existing Windows readiness file, `win-tool-proxy.js`, and `this.win.forwards`. | Matches existing `.mcp.json` WSL behavior and `IDEA.md`. | defaulted |
| 4 | Enable both unkeyed and keyed folder tools over MCP in sandboxed Codex sessions. The bridge/launcher runs outside the sandbox to load keys and redact output, and confines each tool process inside `codex sandbox` with the worktree as writable root and matching `CODEX_HOME` and worktree trust. | Gives sandboxed Codex full folder-tool parity without exposing raw keys in the agent's config or environment. | user |
| 5 | Route keyed HTTP folder tools through a local stdio-to-HTTP proxy (`machine/lib/http-tool-proxy.js`) that loads declared keys from the project/shared key store, injects header values on outbound HTTP requests, and redacts any leaked key values from responses so raw keys never appear in the agent's MCP config or environment. | Matches how script and stdio server folder tools protect keys and works uniformly across Claude, Codex, and Antigravity with zero open local ports. | user |
| 6 | Support `--lang node` (default) and `--lang python` (stdlib-only Python 3) for `wc.js tool new --kind server`. | Covers the main non-Node MCP server language with zero extra dependencies and passes `wc.js tool check` out of the box. | user |
| 7 | Use `codex sandbox -P wc -C <worktree>` with explicit `permissions.wc.filesystem` and `permissions.wc.network.enabled` overrides plus the worktree `projects={...}` trust override (verified against `codex-cli 0.172.0`). | `codex-cli 0.172.0` requires `--permission-profile <NAME>` and a `[permissions]` table; probing confirmed this preserves injected env vars, allows writes in `<worktree>` and `/tmp`, blocks writes under `$HOME` in workspace-write mode, and blocks all writes in read-only mode. | defaulted |

## Spec

### Non-goals
- Do not change folder-tool discovery roots (`.wheelchair/tools/<name>`), project-over-shared precedence, or the Settings shared-repo pinning flow.
- Do not change the project/shared key store format or key-redaction algorithm (`machine/lib/project-keys.js`, `machine/lib/shared-keys.js`, `machine/lib/key-redact.js`).
- Do not add a web editor on the Tools page for creating or editing folder tools.

---

### S1. Launcher output-drain fix (`machine/lib/tool-launch.js`)

**Problem:** In keyless mode (`machine/lib/tool-launch.js:51-54`), `child.stdout.pipe(process.stdout)` runs asynchronously while `child.on('close', ...)` immediately calls `process.exit(code)`, truncating buffered stdout under load.

**Required behavior:**
1. In `machine/lib/tool-launch.js` keyless mode:
   - Pipe `child.stdout` to `process.stdout` with `{ end: false }` (or manual `data`/`drain` forwarding with backpressure) so `tool-launch.js` controls shutdown.
   - Ignore `EPIPE` on `process.stdout` (`process.stdout.on('error', e => { if (e.code === 'EPIPE') { kill(); process.exit(0); } })`) so a closed consumer pipe exits cleanly without crashing or hanging.
   - Track both `child` `'close'` (`code`, `signal`) and `child.stdout` `'end'`. Once `child` has closed, call `kill()` (to reap any leftover process-group descendants), pause/unref `process.stdin`, and flush `process.stdout` using a final `process.stdout.write('', () => process.exit(signal ? 1 : (code ?? 1)))` (if `process.stdout.writableEnded` or `destroyed`, exit directly).
   - Keep `process.stdin.on('end', () => { kill(); process.exit(0); })` and `SIGINT`/`SIGTERM`/`SIGHUP` process-group cleanup unchanged.
2. In `machine/test/folder-tools-run.test.js`:
   - Keep `launcher drains output and propagates child exit` testing 1,000,000 bytes of stdout and exit code 7, and add a backpressure test case where the parent reads stdout slowly in small chunks (pausing between reads) so `process.stdout` is guaranteed to buffer in userspace before `child` exits — proving the launcher drains every byte before exiting with code 7.
   - Add a matching 1,000,000-byte drain test for the keyed launcher path (`server-relay.js`) to confirm no truncation occurs under backpressure there either.

---

### S2. Windows-side folder tools from WSL

**Goal:** Folder tools that run Windows programs (or point to Windows-marked localhost HTTP servers) work from WSL sessions with the same readiness handoff, `WHEELCHAIR_WINDOWS_PROJECT`/`WSLENV` env passing, `tools/list` caching, and localhost port forwarding as `.mcp.json` project tools.

**Required behavior:**
1. **Detection (`machine/lib/folder-tools.js`, `machine/service.js`):**
   - A stdio folder server (`kind: 'server'` with `start`) is Windows-side on WSL when `isWindowsProgram(resolvedProgram, mount)` is true (where `resolvedProgram` is `tool.start[0].includes('/') ? path.resolve(row.dir, tool.start[0]) : tool.start[0]`), excluding any server whose `start` args include `mcp-for-unity`.
   - A folder script (`kind: 'script'`) is Windows-side on WSL when `isWindowsProgram(resolvedProgram, mount)` is true (same resolution on `tool.run[0]`).
   - An HTTP folder server (`kind: 'server'` with `url`) is Windows-side on WSL when `tool.windows === true` (see S4 for validation).
2. **Readiness & proxy wiring (`machine/service.js`, `machine/lib/folder-tools.js`, `machine/lib/tool-launch.js`, `machine/lib/tool-bridge.js`, `machine/lib/win-tool-proxy.js`):**
   - When `wsl && tools && connectors.manifest(input.cli).wrapProjectTools`:
     - Compute `readyFile = path.join(this.stateDir, 'win-ready', name)` and `commonDir` (same git-common-dir lookup already used for `.mcp.json` at `machine/service.js:1043-1047`, even if `.mcp.json` is absent).
     - **Stdio folder servers:** If a server row is Windows-side, `serverEntry` passes `--win-ready-file <readyFile>` and `--win-list-cache <cacheFile>` (keyed with `cacheKey(commonDir, row.name, { command: program, args: row.tool.start.slice(1) })`) to `tool-launch.js`, and sets `windows: true, wrapped: true` on the returned `extraServers` object. Inside `tool-launch.js`, when `--win-ready-file` is set, instead of spawning `program` directly, it spawns `process.execPath` with `[PROXY, '--ready-file', winReadyFile, '--list-cache', winListCache, '--name', tool.name, '--', program, ...tool.start.slice(1)]` (keeping `cwd: dir`, `env`, and keyed `server-relay.js` redaction intact!).
     - **Folder scripts:** If any script row in `scriptRows` is Windows-side, `bridgeEntry` passes `--win-ready-file <readyFile>` to `tool-bridge.js`, and sets `windows: true, wrapped: true` on the returned bridge `extraServers` object. Export a `waitReady(readyFile)` helper from `machine/lib/win-tool-proxy.js` (reusing its existing readiness-file polling and attempt-token logic); when `tool-bridge.js` runs a script whose resolved `run[0]` is a Windows program (`isWindowsProgram`), it awaits `waitReady(winReadyFile)` before calling `runScript` and sets `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV` (appending `WHEELCHAIR_WINDOWS_PROJECT/p` if not present) in the script env (returning an MCP tool error if readiness fails).
     - **Windows-marked HTTP folder servers:** When `this.win?.detected?.kernel` and `row.tool.windows === true`, resolve `target = windowsTarget({ type: 'http', url: row.tool.url })`, acquire `port = await this.win.forwards.get(target.port)`, rewrite the URL with `rewriteUrl(row.tool.url, port)`, and pass the rewritten URL (for unkeyed HTTP entries directly; for keyed HTTP entries via `--url-override <rewrittenUrl>` to `http-tool-proxy.js`), marking `windows: true, wrapped: false` on the `extraServers` object. If forwarding fails, leave that server out and add a problem line (same message style as `.mcp.json` at `machine/service.js:1065`).
3. **Connector `loaded` & Codex `WSLENV` propagation:**
   - Update `connectors/claude/machine.js:86`, `connectors/codex/machine.js` (where `loaded` is built), and `connectors/agy/machine.js` so `extraServers` items propagate `windows: !!extra.windows` and `wrapped: !!extra.wrapped` into `built.loaded` (instead of hardcoding `false`), so `machine/service.js:1072-1073` triggers Windows project sync and writes the readiness file whenever a Windows folder tool is loaded.
   - In `connectors/codex/machine.js`, when `wsl` is true and an `extraServers` entry has `extra.windows === true`, ensure `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV` are included in its `env_vars` passthrough (same as wrapped `.mcp.json` entries at `connectors/codex/machine.js:83-88`).

---

### S3. Non-Node server templates (`wc.js tool new --kind server --lang`)

**Required behavior:**
1. **CLI parsing (`viewer/app/tool-cli.js`):**
   - Syntax: `wc.js tool new <name> --kind script|server [--lang node|python]`.
   - Allow `--kind <kind>` and `--lang <lang>` in any order after `<name>`, rejecting duplicate flags or extra positional arguments with `usage: wc.js tool new <name> --kind script|server [--lang node|python]`.
   - If `--lang` is passed with `--kind script`, fail with `--lang is only supported with --kind server`.
   - If `--kind server` and `--lang` is omitted, default to `node`.
   - If `--lang` is not `node` or `python`, fail with `unsupported --lang "<value>"; supported: node, python`.
2. **Templates (`machine/templates/tools/`):**
   - `--lang node`: existing `machine/templates/tools/server/` + copied `machine/lib/mcp-stdio.js` (unchanged).
   - `--lang python`: new `machine/templates/tools/server-python/` containing:
     - `tool.json`:
       ```json
       {
         "name": "__NAME__",
         "description": "Echoes text back (starter MCP server — replace with your own tools).",
         "kind": "server",
         "start": ["python3", "server.py"]
       }
       ```
     - `server.py`: executable (`0o755`), Python 3 standard library only (`sys`, `json`), implementing newline-delimited JSON-RPC 2.0 matching `machine/lib/mcp-stdio.js` (`initialize` returning `protocolVersion`, `capabilities: {"tools": {}}`, `serverInfo: {"name": "__NAME__", "version": "1"}`; `ping` returning `{}`; ignoring notifications without `id`; `tools/list` returning one `echo` tool with `{ text: string }` inputSchema; `tools/call` for `echo` returning `{"content": [{"type": "text", "text": ...}], "isError": false}`; `-32601` for unknown methods and `-32603` for errors), flushing stdout after every line.
   - Do NOT copy `mcp-stdio.js` when `--lang python` is used.
3. **Documentation (`protocol/tools.md`):**
   - Document `--lang python` alongside the default Node.js server starter and note that `python3` must be on `PATH`.

---

### S4. HTTP MCP folder tools (with local key-hiding proxy)

**Required behavior:**
1. **`tool.json` schema (`machine/lib/folder-tools.js`):**
   - For `kind: "server"`, require **exactly one** of `start` (non-empty array of non-empty strings) or `url` (string parsing as an `http:` or `https:` URL with no whitespace or control characters). If both or neither are present, fail validation with a clear reason (`tool.json must have either "start" or "url", not both` / `tool.json is missing "start" or "url"`).
   - When `url` is present:
     - Record `tool.url` (and `tool.transport = 'http'`; `start` servers get `tool.transport = 'stdio'`).
     - Optional `headers`: plain object (not array/null), at most 20 entries; every key is a non-empty valid HTTP header token (`/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/`) with no case-insensitive duplicates; every value is a non-empty string with no `\r` or `\n`.
     - Placeholder check on `headers` values: every `${...}` occurrence must match `/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/` (embedded placeholders like `Bearer ${API_KEY}` are allowed; scan all `${...}` occurrences in each header value). Every referenced key name must appear in `tool.keys`; any unclosed `${`, invalid placeholder syntax, or undeclared key fails validation with `tool.json has an invalid "headers"`.
     - Optional `windows`: boolean (`true` or `false`). If `true`, `windowsTarget({ type: 'http', url: tool.url })` must succeed (localhost HTTP URL); otherwise fail validation with `tool.json has an invalid "windows"`.
   - Reject `headers` or `windows` on `kind: "script"` or on `start` servers.
   - In `discover`: skip `findProgram` for HTTP servers (`tool.transport === 'http'`).
2. **Unkeyed HTTP folder servers (`tool.keys.length === 0`):**
   - `serverEntry` returns `{ name: row.name, folder: 'server', windows: !!windowsUrl, wrapped: false, entry: { type: 'http', url: effectiveUrl, ...(tool.headers ? { headers: tool.headers } : {}) } }`.
   - Connectors (`claude`, `codex`, `agy`) already handle `{ type: 'http', url, headers }` entries with literal headers.
3. **Keyed HTTP folder servers (`tool.keys.length > 0`) — local stdio-to-HTTP proxy (`machine/lib/http-tool-proxy.js`):**
   - `serverEntry` returns a stdio entry launching `process.execPath` with `[path.join(__dirname, 'http-tool-proxy.js'), '--project-dir', worktree, '--tool', row.dir, '--state-dir', stateDir, '--key-store', row.key_store, ...row.tool.keys.flatMap(k => ['--key', k]), ...(urlOverride ? ['--url-override', urlOverride] : [])]` (and `env: {}`).
   - `machine/lib/http-tool-proxy.js` behavior:
     - Validates `tool.json` at startup (same 32 KiB / regular-file / `validateToolJson` checks as `tool-launch.js`), confirms `kind === 'server'` and `transport === 'http'`, and checks that `--key` args match `tool.keys` (exiting non-zero with the same "its keys changed" message if not).
     - Rejects startup if `debuglog('child_process').enabled` or `debuglog('http').enabled` (so debug logging cannot leak keys).
     - Reads declared keys from `readSharedKeys(stateDir)` or `readKeyStore(stateDir, await projectIdentity(projectDir))` (failing with the standard missing-key error if any key is missing/unusable).
     - Reads newline-delimited JSON-RPC messages from `process.stdin`, substitutes `${KEY}` placeholders in `tool.headers` with loaded key values (in memory only, never written to disk or stderr), and POSTs each message to `urlOverride || tool.url` with headers `Content-Type: application/json`, `Accept: application/json, text/event-stream`, plus any tracked `Mcp-Session-Id` header from earlier responses.
     - Handles HTTP responses:
       - `202 Accepted` (for notifications): no stdout reply.
       - `application/json`: parses JSON body, redacts all declared key values from any string fields (or via `redactCapture` on the UTF-8 buffer before writing), and writes newline-delimited JSON-RPC to `process.stdout`.
       - `text/event-stream`: parses SSE `data:` frames, redacts declared key values, and writes each JSON-RPC message as one newline-delimited line to `process.stdout`.
       - Non-2xx HTTP status or network error: for requests with an `id`, replies with a JSON-RPC error (`code: -32603`, redacted message naming HTTP status or error code); never includes raw key values in errors.
     - Exits cleanly when `process.stdin` closes or on `SIGINT`/`SIGTERM`/`SIGHUP`, aborting any in-flight HTTP request via `AbortController`.
4. **CLI `wc.js tool check` for HTTP folder tools (`viewer/app/tool-cli.js`):**
   - For an HTTP server (`row.tool.transport === 'http'`), `wc.js tool check` performs an HTTP MCP handshake (`initialize` -> `notifications/initialized` -> `tools/list` if `capabilities.tools` is present) against `row.tool.url` using the remaining check deadline and abort signal, sending only literal (non-`${...}`) headers (never reading saved keys).
   - On success, prints the same format as stdio servers (`<name>: <serverInfo.name> tools: ...`, appending ` (checked without its keys)` if `row.tool.keys.length > 0`).
   - On failure (including HTTP 401/403 when keyed), prints `<name>: <error>` plus `it ran without its keys; that may be why` when `row.tool.keys.length > 0`, and exits non-zero.
5. **Tools page & `wc.js tool list`:**
   - Keep `kind: 'server'` in `wc.js tool list` and Tools page API so existing consumers stay compatible; include `transport: 'http' | 'stdio'` on the tool object.
   - Update `protocol/tools.md` to document HTTP folder servers (`url`, `headers`, `keys`, `windows`).

---

### S5. Folder tools over MCP in sandboxed Codex sessions

**Goal:** Sandboxed Codex sessions connect to folder tools (scripts via bridge, stdio servers via launcher, and HTTP servers) directly over MCP, with local tool execution confined inside `codex sandbox` to the worktree and matching the session's `CODEX_HOME` and worktree trust.

**Required behavior:**
1. **Remove sandboxed-Codex exclusion (`connectors/codex/machine.js`, `viewer/pages/project-tools.js`, `protocol/tools.md`):**
   - In `connectors/codex/machine.js`:
     - Remove `shellToolsOnly` (or return `false`) and remove `keyedToolsReason` (or return `null`) so `machine/service.js` includes both unkeyed and keyed folder tools for sandboxed Codex sessions instead of skipping them or falling back to shell-only warnings.
     - Remove the `if (extras.length && module.exports.sandboxed(session))` skip branch in `command(...)` (`connectors/codex/machine.js:169-171`). Register all `extraServers` via `codexOverrides` (preserving `tool_timeout_sec=260` on `wheelchair-tools` and the `PROJECT_OVERRIDE_BUDGET` check).
   - In `viewer/pages/project-tools.js:314`, update the server-tool hint from `"server tools don't work on Kimi, Pi or sandboxed Codex"` to `"server tools don't work on Kimi or Pi"`.
2. **Sandbox wrapper (`connectors/codex/machine.js`, `machine/lib/folder-tools.js`, `machine/service.js`):**
   - Update `connectors/codex/machine.js` `sandboxWrap(command, { worktree, toolDir, mode, trustLevel })`:
     - `mode` is `'read-only'` when `input.role === 'reviewer' || session.project_lead === true`, otherwise `'workspace-write'`.
     - `trustLevel` is `'untrusted'` when `session.project_lead === true`, otherwise `'trusted'` (matching `connectors/codex/machine.js:160`).
     - Filesystem TOML table:
       - `'workspace-write'`: `permissions.wc.filesystem={"/"="read",${tomlString(worktree)}="write","/tmp"="write"}` and `permissions.wc.network.enabled=true`.
       - `'read-only'`: `permissions.wc.filesystem={"/"="read"}` and `permissions.wc.network.enabled=false`.
     - Trust TOML table: `projects={${tomlString(worktree)}={trust_level=${tomlString(trustLevel)}}}`.
     - Returned argv:
       `['codex', 'sandbox', '-P', 'wc', '-C', worktree, '-c', fsOverride, '-c', netOverride, '-c', trustOverride, '--', '/bin/sh', '-c', 'cd "$1" && shift && exec "$@"', '--', toolDir, ...command]`.
   - When `adapter.sandboxed?.(session)` is true (sandboxed Codex session):
     - `machine/service.js` passes `{ sandbox: { mode, trustLevel, codexHome: session.account_dir ? loginEnv(session.account_dir).CODEX_HOME : null } }` when building `bridgeEntry` and stdio `serverEntry`.
     - `bridgeEntry` and stdio `serverEntry` pass `--sandbox <mode>`, `--codex-trust <trustLevel>` (and set `CODEX_HOME` in the entry's `env` when `codexHome` is set) to `tool-bridge.js` and `tool-launch.js`.
     - `tool-bridge.js` (via `tool-run.js`) and `tool-launch.js` stay **outside** `codex sandbox` so they can read the machine key store (`stateDir`) and perform output redaction, and wrap only the spawned child tool command using `sandboxWrap([program, ...args], { worktree: projectDir, toolDir: dir, mode, trustLevel })` with `cwd: projectDir` (the wrapper's `/bin/sh -c 'cd "$1" ...'` changes to `toolDir` inside the sandbox so the sandbox's writable root is `projectDir`, not `toolDir`!).
     - Note: if a tool is also a Windows-side tool on WSL, WSL Windows tools run on the Windows host via `win-tool-proxy.js` (Linux `bwrap` cannot confine Windows binaries); on WSL, Windows-side tools use the Windows wrapper rather than `codex sandbox`, while Linux tools use `codex sandbox`.
     - For `read-only` sessions with network disabled (`mode === 'read-only'`), skip HTTP folder tools (both direct and `http-tool-proxy.js`) with a warning `tool <name>: skipped in read-only Codex session (network disabled)`.
3. **Real Codex sandbox test (`machine/test/folder-tools-codex-sandbox.test.js`):**
   - Uses the real `codex` binary (skipped with a clear skip reason only when `codex` is not installed on the host; runs unconditionally when `codex` is present).
   - Tests both `tool-bridge.js` (script tool) and `tool-launch.js` (stdio server tool), including a keyed tool:
     1. Workspace-write mode: tool can create a file inside `worktree` and read its injected key (and stdout redaction masks the key).
     2. Workspace-write mode: tool attempting to write a file under a temp path inside `$HOME` (outside `worktree`) fails with permission/read-only error and does not create the file.
     3. Read-only mode: tool attempting to write a file inside `worktree` fails and does not create the file.
     4. Named account `CODEX_HOME`: verifies the sandboxed invocation receives the configured `CODEX_HOME`.
4. **Update existing tests & docs:**
   - Update `machine/test/folder-tools-launch.test.js` to assert that sandboxed Codex sessions register folder MCP entries with `--sandbox` and `CODEX_HOME` (replacing the old "sandboxed Codex omits folder extras" assertion).
   - Update `protocol/tools.md` to document that sandboxed Codex runs folder tools over MCP confined to the worktree and `/tmp` (with notes that servers cannot write under `$HOME` and should place caches/state in `/tmp` or the worktree).

---

### Validation

Targeted validation commands (full run is executed separately before push):
```bash
node --test machine/test/folder-tools-run.test.js
node --test machine/test/folder-tools-launch.test.js
node --test machine/test/folder-tools-codex-sandbox.test.js
node --test machine/test/project-mcp-codex.test.js
node --test viewer/test/wc-tool.test.js
```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-28

**Lanes:** (pending)

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-28: Checked `session leads` right after creating PLAN.md; no overlapping active threads.
- 2026-11-28: Probed real `codex sandbox` (`codex-cli 0.172.0`): confirmed `-P wc -C <worktree>` with `permissions.wc.filesystem` and `permissions.wc.network.enabled` preserves env vars, allows writes in `<worktree>` and `/tmp`, blocks writes under `$HOME` in workspace-write mode, and blocks writes in `<worktree>` in read-only mode.
- 2026-11-28: Checked `session leads` before setting `status: ready-for-review`; still no overlapping active threads.
