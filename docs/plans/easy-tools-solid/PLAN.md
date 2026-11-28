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
| 7 | Use `codex sandbox -P wc -C <worktree>` with explicit `permissions.wc.filesystem` and `permissions.wc.network.enabled` overrides plus the worktree `projects={...}` trust override (verified against `codex-cli 0.172.0`). | `codex-cli 0.172.0` requires `--permission-profile <NAME>` and a `[permissions]` table; probing confirmed this preserves injected env vars, allows writes in `<worktree>` and `/tmp`, and blocks writes outside them. | defaulted |
| 8 | Skip Windows-side stdio and script folder tools in sandboxed Codex sessions on WSL with a warning instead of running them unconfined. | Linux `bwrap` cannot confine Windows executables, and `machine/lib/win.js:454` already rejects Windows `run`/`start` in sandboxed sessions to preserve the worktree write boundary. | review-round-1 |

## Spec

### Non-goals
- Do not change folder-tool discovery roots (`.wheelchair/tools/<name>`), project-over-shared precedence, or the Settings shared-repo pinning flow.
- Do not change `TOOL_ROLES` (`machine/lib/project-mcp.js:9`) or enable folder tools for reviewers, mappers, or project leads.
- Do not change the project/shared key store format or key-redaction algorithm (`machine/lib/project-keys.js`, `machine/lib/shared-keys.js`, `machine/lib/key-redact.js`).
- Do not add a web editor on the Tools page for creating or editing folder tools.

---

### S1. Launcher output-drain fix (`machine/lib/tool-launch.js`)

**Problem:** In keyless mode (`machine/lib/tool-launch.js:51-54`), `child.stdout.pipe(process.stdout)` runs asynchronously while `child.on('close', ...)` immediately calls `process.exit(code)`, truncating buffered stdout under load.

**Required behavior:**
1. In `machine/lib/tool-launch.js` keyless mode:
   - Extract and export a small `pipeKeyless({ child, stdin, stdout, kill, exit })` helper (called from `start()` when `require.main === module`):
     - Pipe `stdin` to `child.stdin` (ignoring `child.stdin` errors) and `child.stdout` to `stdout` with `{ end: false }`.
     - Handle `EPIPE` on `stdout` (`stdout.on('error', e => { if (e.code === 'EPIPE') { kill(); exit(0); } })`) so a closed consumer pipe exits cleanly without crashing or hanging.
     - On `stdin` `'end'`: call `kill()` and `exit(0)`.
     - On `child` `'close'` (`code`, `signal`): call `kill()`, pause and unref `stdin` (if supported), and exit only after `stdout` has flushed its buffered bytes via `stdout.write('', () => exit(signal ? 1 : (code ?? 1)))` (if `stdout.writableEnded || stdout.destroyed`, call `exit` directly).
   - Keep `SIGINT`/`SIGTERM`/`SIGHUP` process-group cleanup unchanged.
2. In `machine/test/folder-tools-run.test.js`:
   - Keep `launcher drains output and propagates child exit` testing 1,000,000 bytes of stdout and exit code 7.
   - Add a deterministic unit test calling `pipeKeyless` directly with a fake `stdout` whose `write` holds its callback pending until the test explicitly releases it *after* emitting `child` `'close'`, proving `exit(7)` is NOT invoked while `stdout` still has pending writes and IS invoked once the pending write completes.
   - Add a matching 1,000,000-byte drain test for the keyed launcher path (`server-relay.js`) confirming all bytes arrive cleanly.

---

### S2. Windows-side folder tools from WSL

**Goal:** Folder tools that run Windows programs (or point to Windows-marked localhost HTTP servers) work from WSL sessions (except Windows executables in sandboxed Codex — see S5) with the same readiness handoff, `WHEELCHAIR_WINDOWS_PROJECT`/`WSLENV` env passing, `tools/list` caching (for unkeyed servers), and localhost port forwarding as `.mcp.json` project tools.

**Required behavior:**
1. **Detection (`machine/lib/folder-tools.js`, `machine/service.js`):**
   - Add a helper `resolveProgram(argv0, toolDir, pathText)` in `machine/lib/folder-tools.js` that returns the first existing executable path (matching `findProgram` at `machine/lib/folder-tools.js:37-39`: `path.resolve(toolDir, argv0)` when `argv0` includes `/`, otherwise searching `pathText` entries), or `null` if none exists.
   - Classify Windows executability separately from proxy wrapping:
     - `isWindowsExecutable(row, pathText, mount)` is true for a folder `script` or stdio `server` on WSL when `isWindowsProgram(resolveProgram(argv0, row.dir, pathText) || argv0, mount)` is true (covering both explicit paths and `PATH`-resolved `.exe` programs, including `mcp-for-unity`).
     - `shouldWrapWindowsProxy(row, pathText, mount)` is true for a stdio `server` when `isWindowsExecutable(...)` is true AND `!row.tool.start.slice(1).includes('mcp-for-unity')`.
   - An HTTP folder server (`kind: 'server'` with `url`) is Windows-side on WSL when `tool.windows === true` (see S4).
2. **Readiness & proxy wiring (`machine/service.js`, `machine/lib/folder-tools.js`, `machine/lib/tool-launch.js`, `machine/lib/tool-bridge.js`, `machine/lib/win-tool-proxy.js`):**
   - When `wsl && tools && connectors.manifest(input.cli).wrapProjectTools`:
     - Compute `readyFile = path.join(this.stateDir, 'win-ready', name)` and `commonDir` (same git-common-dir lookup as `.mcp.json` at `machine/service.js:1043-1047`, even when `.mcp.json` is absent).
     - **Stdio folder servers:**
       - If the session is sandboxed Codex (`adapter.sandboxed?.(session)`) and `isWindowsExecutable(...)` is true (including `mcp-for-unity`), skip the server with a warning: `tool <name>: skipped in sandboxed Codex (Windows programs cannot run inside Codex's Linux sandbox; set Codex to unrestricted in Settings to use it)`.
       - Otherwise, if `shouldWrapWindowsProxy(...)` is true, `serverEntry` passes `--win-ready-file <readyFile>` (and `--win-list-cache <cacheFile>` **only when `row.tool.keys.length === 0`**, keyed with `cacheKey(commonDir, row.name, { command: resolvedProgram, args: row.tool.start.slice(1) })` — keyed servers omit `--list-cache` so unredacted tool lists are never written to disk before `server-relay.js` sees them) to `tool-launch.js`, and sets `windows: true, wrapped: true` on the returned `extraServers` object.
       - Update `machine/lib/win-tool-proxy.js` so `--list-cache` is optional: when omitted, it never reads or writes a cache file AND it holds `tools/list` requests in stand-in mode (just like `tools/call`) until `--ready-file` settles (`ready` -> forward to the spawned Windows server; `failed` -> return JSON-RPC error), instead of replying with an empty `[]` list.
       - Inside `tool-launch.js`, when `--win-ready-file` is set:
         - For keyed servers, append each declared key name in `keys` to `env.WSLENV` (colon-delimited, without duplicates) so WSL passes those key env vars to the Windows process.
         - Spawn `process.execPath` with `[PROXY, '--ready-file', winReadyFile, ...(winListCache ? ['--list-cache', winListCache] : []), '--name', tool.name, '--', program, ...tool.start.slice(1)]` (keeping `cwd: dir`, `env`, and keyed `server-relay.js` redaction intact).
     - **Folder scripts:**
       - If the session is sandboxed Codex (`adapter.sandboxed?.(session)`), exclude every script where `isWindowsExecutable(...)` is true from `scriptRows` and add a warning per skipped script: `tool <name>: skipped in sandboxed Codex (Windows programs cannot run inside Codex's Linux sandbox; set Codex to unrestricted in Settings to use it)`.
       - Otherwise, mark each Windows-side script row (`row.windows = true`). If any script in `scriptRows` has `row.windows === true`, `bridgeEntry` passes `--win-ready-file <readyFile>` to `tool-bridge.js`, passes `--win` right after each Windows script's `--tool <dir>` (so `tool-bridge.js` uses the service's exact classification rather than re-running `isWindowsProgram` with a default mount), and sets `windows: true, wrapped: true` on the returned bridge `extraServers` object.
       - Export `waitReady(readyFile, { timeoutMs, signal })` from `machine/lib/win-tool-proxy.js` reusing its ready-file polling (`waiting` / `ready` / `failed`). If `readyFile` stays missing or `waiting` past `timeoutMs` or `signal` aborts, reject with a timeout/cancelled error.
       - When `tool-bridge.js` runs a script flagged `--win`, it awaits `waitReady(winReadyFile, { timeoutMs: tool.timeout_seconds * 1000 })`, deducts elapsed wait time from the script's remaining `timeout_seconds` (failing with an MCP error if readiness fails or time runs out), sets `WHEELCHAIR_WINDOWS_PROJECT` from the ready file's Windows path, and appends `WHEELCHAIR_WINDOWS_PROJECT/p` plus each declared key name in `entry.keys` to `env.WSLENV` (colon-delimited, without duplicates) before calling `runScript`.
     - **Windows-marked HTTP folder servers:**
       - When `this.win?.detected?.kernel` and `row.tool.windows === true`, resolve `target = windowsTarget({ type: 'http', url: row.tool.url })`, acquire `port = await this.win.forwards.get(target.port)`, rewrite the URL with `rewriteUrl(row.tool.url, port)`, and pass the rewritten URL (for unkeyed HTTP entries directly; for keyed HTTP entries via `--url-override <rewrittenUrl>` to `http-tool-proxy.js`), marking `windows: true, wrapped: false` on the `extraServers` object. If forwarding fails, leave that server out and add a problem line (`tool <name>: couldn't reach Windows (<reason>); left out of this session`).
3. **Connector `loaded` & Codex `WSLENV` propagation:**
   - Update `connectors/claude/machine.js:86`, `connectors/codex/machine.js` (where `loaded` is built), and `connectors/agy/machine.js` so `extraServers` items propagate `windows: !!extra.windows` and `wrapped: !!extra.wrapped` into `built.loaded`, triggering Windows project sync and ready-file creation in `machine/service.js:1072-1073`.
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
1. **`tool.json` schema (`machine/lib/folder-tools.js`, `machine/lib/project-tools.js`):**
   - For `kind: "server"`, require **exactly one** of `start` (non-empty array of non-empty strings) or `url` (string parsing as an `http:` or `https:` URL with no whitespace or control characters). If both are present, fail with `tool.json cannot have both "start" and "url"`; if neither is present, fail with `tool.json is missing "start"` (keeping existing test expectations intact).
   - When `url` is present:
     - Record `tool.url` and `tool.transport = 'http'` (`start` servers get `tool.transport = 'stdio'`).
     - Optional `headers`: plain object (not array/null), at most 20 entries; every key is a non-empty valid HTTP header token (`/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/`) with no case-insensitive duplicates; every value is a non-empty string with no `\r` or `\n`.
     - Placeholder check on `headers` values: every `${...}` occurrence must match `\$\{([A-Za-z_][A-Za-z0-9_]*)\}` (embedded placeholders like `Bearer ${API_KEY}` are allowed). Every referenced key name must appear in `tool.keys`; any unclosed `${`, invalid placeholder syntax, or undeclared key fails validation with `tool.json has an invalid "headers"`.
     - Optional `windows`: boolean (`true` or `false`). If `true`, `windowsTarget({ type: 'http', url: tool.url })` must succeed (localhost HTTP URL); otherwise fail validation with `tool.json has an invalid "windows"`.
   - Reject `headers` or `windows` on `kind: "script"` or on `start` servers.
   - Skip executable checks for HTTP servers (`row.tool.transport === 'http'`) in **both** `machine/lib/folder-tools.js` (`discover`) and `machine/lib/project-tools.js:102-113` (`folderRows`, the Git-tree reader for the Tools page).
2. **Unkeyed HTTP folder servers (`tool.keys.length === 0`):**
   - `serverEntry` returns `{ name: row.name, folder: 'server', windows: !!windowsUrl, wrapped: false, entry: { type: 'http', url: effectiveUrl, ...(tool.headers ? { headers: tool.headers } : {}) } }`.
   - Connectors (`claude`, `codex`, `agy`) already handle `{ type: 'http', url, headers }` entries with literal headers.
3. **Keyed HTTP folder servers (`tool.keys.length > 0`) — local stdio-to-HTTP proxy (`machine/lib/http-tool-proxy.js`):**
   - `serverEntry` returns a stdio entry launching `process.execPath` with `[path.join(__dirname, 'http-tool-proxy.js'), '--project-dir', worktree, '--tool', row.dir, '--state-dir', stateDir, '--key-store', row.key_store, ...row.tool.keys.flatMap(k => ['--key', k]), ...(urlOverride ? ['--url-override', urlOverride] : [])]` (and `env: {}`).
   - `machine/lib/http-tool-proxy.js` behavior:
     - Validates `tool.json` at startup (same 32 KiB / regular-file / `validateToolJson` checks as `tool-launch.js`), confirms `kind === 'server'` and `transport === 'http'`, and checks that `--key` args match `tool.keys` (exiting non-zero with the same "its keys changed" message if not).
     - Rejects startup if any of `debuglog('child_process').enabled`, `debuglog('http').enabled`, `debuglog('https').enabled`, or `debuglog('net').enabled` is true (so Node debug logging cannot leak headers or keys).
     - Reads declared keys from `readSharedKeys(stateDir)` or `readKeyStore(stateDir, await projectIdentity(projectDir))` (failing with the standard missing-key error if any key is missing/unusable).
     - Reads newline-delimited JSON-RPC messages from `process.stdin`, substitutes `${KEY}` placeholders in `tool.headers` with loaded key values (in memory only, never written to disk or stderr), and POSTs each message to `urlOverride || tool.url` using Node's `http`/`https` without following redirects (any `3xx` status returns a JSON-RPC error `HTTP server returned redirect (<status>); redirects are not followed for keyed tools` so headers are never sent to another origin).
     - Sends headers `Content-Type: application/json`, `Accept: application/json, text/event-stream`, plus `MCP-Protocol-Version` (once negotiated from `initialize`, falling back to `'2025-06-18'`) and `Mcp-Session-Id` (once returned by the server).
     - Remembers the client's original `initialize` request params. If a subsequent request with an active `Mcp-Session-Id` (`expiredId`) receives HTTP `404`, coordinate recovery with a single shared in-flight recovery promise keyed to `expiredId` (`recovering = { expiredId, promise }`): concurrent requests failing with 404 for the same `expiredId` await that one recovery instead of starting duplicate `initialize` calls; recovery clears `Mcp-Session-Id`, re-sends `initialize` + `notifications/initialized` once (updating `Mcp-Session-Id` and `MCP-Protocol-Version`), and then each affected request retries once with the new session ID.
     - Parses responses:
       - `202 Accepted` (for notifications): no stdout reply.
       - `application/json`: parses JSON body, compacts to one JSON line, and checks it with `checker.check(Buffer.from(line))`.
       - `text/event-stream`: parses complete SSE events (buffering lines until a blank line `\n\n` or `\r\n\r\n`, joining all `data:` lines of an event with `\n`, ignoring `:` comments and non-`data` fields), compacts each JSON event to one line, and checks it with `checker.check(Buffer.from(line))`. If the HTTP stream ends for a request with an `id` before any response matching that `id` is received, replies with a JSON-RPC error (`code: -32603`, `HTTP stream ended before response arrived`).
     - Redaction uses `const checker = createLineChecker({ name: tool.name, values })` from `machine/lib/server-lines.js:160`:
       - For each `res = checker.check(buf)`: if `res.out` is non-null, write `res.out` + `\n` to `process.stdout`; if `res.toServer` is non-null, POST `res.toServer` back to the HTTP server (with active headers, ignoring its body) without forwarding to `process.stdout`; if `res.note` is non-null, log `res.note` to `process.stderr` (never raw keys).
     - On non-2xx HTTP status or network error for a request with an `id`, replies with a JSON-RPC error (`code: -32603`, redacted message naming HTTP status or error code; never raw keys).
     - Exits cleanly when `process.stdin` closes or on `SIGINT`/`SIGTERM`/`SIGHUP`, aborting any in-flight HTTP request via `AbortController`.
4. **CLI `wc.js tool check` for HTTP folder tools (`viewer/app/tool-cli.js`):**
   - For an HTTP server with `row.tool.windows === true` on WSL (`process.platform === 'linux'` and `/proc/version` indicates WSL), skip live network handshake (since Windows localhost requires the session's machine port forward) and print `<name>: ok (Windows localhost HTTP tool — live check runs through the Windows forward at session start)`.
   - For all other HTTP servers, `wc.js tool check` performs an HTTP MCP handshake (`initialize` -> capture `Mcp-Session-Id` and negotiated `protocolVersion` -> `notifications/initialized` with both `MCP-Protocol-Version` and `Mcp-Session-Id` -> `tools/list` with both headers if `capabilities.tools` is present) against `row.tool.url` using the remaining check deadline and abort signal, sending only literal (non-`${...}`) headers (never reading saved keys), and parsing both `application/json` and multi-line `text/event-stream` responses.
   - On success, prints the same format as stdio servers (`<name>: <serverInfo.name> tools: ...`, appending ` (checked without its keys)` if `row.tool.keys.length > 0`).
   - On failure (including HTTP 401/403 when keyed), prints `<name>: <error>` plus `it ran without its keys; that may be why` when `row.tool.keys.length > 0`, and exits non-zero.
5. **Tools page, `wc.js tool list` & docs:**
   - Keep `kind: 'server'` in `wc.js tool list` and Tools page API; include `transport: 'http' | 'stdio'` on the tool object.
   - Update `protocol/tools.md` to document HTTP folder servers (`url`, `headers`, `keys`, `windows`).

---

### S5. Folder tools over MCP in sandboxed Codex sessions

**Goal:** Sandboxed Codex sessions in `TOOL_ROLES` connect to folder tools (scripts via bridge, stdio servers via launcher, and HTTP servers) directly over MCP, with local Linux tool execution confined inside `codex sandbox` to the worktree and matching the session's `CODEX_HOME` and worktree trust.

**Required behavior:**
1. **Remove sandboxed-Codex exclusion (`connectors/codex/machine.js`, `machine/service.js`, `machine/lib/project-tools.js`, `viewer/pages/project-tools.js`, `protocol/tools.md`):**
   - In `connectors/codex/machine.js`:
     - Remove `shellToolsOnly` and `keyedToolsReason` (so `machine/service.js` includes both unkeyed and keyed folder tools for sandboxed Codex sessions). Because those methods are removed, sandboxed Codex sessions no longer receive the shell-only startup prompt line (`machine/service.js:1136`), no longer set `keyed_unavailable` on `/v1/agent/tools` (`machine/service.js:2433`), and no longer filter keyed scripts out of `wheelchair-tools` (`machine/service.js:1009-1013`).
     - Remove the `if (extras.length && module.exports.sandboxed(session))` skip branch in `command(...)` (`connectors/codex/machine.js:169-171`). Register all `extraServers` via `codexOverrides` (preserving `tool_timeout_sec=260` on `wheelchair-tools` and the `PROJECT_OVERRIDE_BUDGET` check).
   - Keep `TOOL_ROLES` (`machine/lib/project-mcp.js:9`) and existing role gating in `machine/service.js:974-976,994` unchanged (reviewers, mappers, and project leads remain gated as today).
   - Update `viewer/pages/project-tools.js:314` from `"server tools don't work on Kimi, Pi or sandboxed Codex"` to `"server tools don't work on Kimi or Pi"`.
   - Update `machine/lib/project-tools.js:160` from `'uses keys: not available to sandboxed Codex, Kimi or Pi'` to `'uses keys: not available to Kimi or Pi'`.
2. **Dedicated folder-tool sandbox wrapper (`connectors/codex/machine.js`, `machine/lib/folder-tools.js`, `machine/service.js`):**
   - Leave `sandboxWrap(command)` (`connectors/codex/machine.js:126`) completely unchanged so `machine/lib/screen.js:225` and `machine/test/screen.test.js:102-110` continue to work untouched.
   - Add `sandboxWrapTool(command, { worktree, toolDir })` in `connectors/codex/machine.js`:
     - Filesystem TOML table: `permissions.wc.filesystem={"/"="read",${tomlString(worktree)}="write","/tmp"="write"}`.
     - Network TOML override: `permissions.wc.network.enabled=true`.
     - Trust TOML table: `projects={${tomlString(worktree)}={trust_level="trusted"}}`.
     - Returned argv:
       `['codex', 'sandbox', '-P', 'wc', '-C', worktree, '-c', fsOverride, '-c', 'permissions.wc.network.enabled=true', '-c', trustOverride, '--', '/bin/sh', '-c', 'cd "$1" && shift && exec "$@"', '--', toolDir, ...command]`.
   - When `adapter.sandboxed?.(session)` is true (sandboxed Codex session in `TOOL_ROLES`):
     - `machine/service.js` passes `{ sandbox: { codexHome: session.account_dir ? loginEnv(session.account_dir).CODEX_HOME : null } }` when building `bridgeEntry` and stdio `serverEntry`.
     - `bridgeEntry` and stdio `serverEntry` pass `--sandbox` (and set `CODEX_HOME` in the entry's `env` when `codexHome` is set) to `tool-bridge.js` and `tool-launch.js`.
     - `tool-bridge.js` (via `tool-run.js`) and `tool-launch.js` run **outside** `codex sandbox` so they can read the machine key store (`stateDir`) and perform output redaction, and wrap only the spawned child tool command using `sandboxWrapTool([program, ...args], { worktree: projectDir, toolDir: dir })` with `cwd: projectDir` (the wrapper's `/bin/sh -c 'cd "$1" ...'` changes to `toolDir` inside the sandbox so the writable root is `projectDir`, not `toolDir`).
     - HTTP folder servers (both direct unkeyed entries and `http-tool-proxy.js`) are registered normally for sandboxed Codex sessions, matching `.mcp.json` HTTP behavior.
3. **Real Codex sandbox test (`machine/test/folder-tools-codex-sandbox.test.js`) & router update (`machine/AGENTS.md`):**
   - Uses the real `codex` binary (skipped with a clear skip reason only when `codex` is not installed on the host; runs unconditionally when `codex` is present).
   - Creates its fixture directory **outside `/tmp`** (under `path.join(os.homedir(), '.cache', 'wheelchair-sandbox-test-<pid>-<rand>')`, removed in a `finally` block), containing sibling `worktree/`, `outside/`, `state/`, and `codex-home/` directories so neither `worktree/` nor `outside/` falls under the `/tmp` write grant. Before invoking the sandbox, asserts that the test process itself can create and delete a probe file in `outside/`.
   - Tests both `tool-bridge.js` (script tool) and `tool-launch.js` (stdio server tool), including a keyed tool:
     1. Tool can create a file inside `worktree/` and read its injected key (and stdout redaction masks the key).
     2. Tool attempting to write a file inside `outside/` fails with a permission/read-only error and does not create the file.
     3. Named account `CODEX_HOME`: verifies the sandboxed invocation receives the configured `CODEX_HOME`.
   - Update `machine/AGENTS.md` to note the real-Codex sandbox test exception (runs when `codex` is installed using isolated temp directories, skips otherwise).
4. **Update existing tests & docs:**
   - Update `machine/test/folder-tools-launch.test.js` and `machine/test/project-mcp-codex.test.js:145-160` to assert that sandboxed Codex sessions register folder MCP entries with `--sandbox` and `CODEX_HOME`, preserve ordering and `tool_timeout_sec=260`, retain the `PROJECT_OVERRIDE_BUDGET` check, and skip Windows executables on WSL.
   - Update `machine/test/project-tools.test.js:478` and `viewer/test/app-project-tools.spec.js:1518` for the updated Tools page / API status strings, and add a Git-tree HTTP folder tool test in `machine/test/project-tools.test.js`.
   - Update `protocol/tools.md` to document that sandboxed Codex runs folder tools over MCP confined to the worktree and `/tmp` (noting that servers cannot write under `$HOME` and should place caches/state in `/tmp` or the worktree).

---

### Validation

Targeted validation commands (full run is executed separately before push):
```bash
node --test machine/test/folder-tools.test.js
node --test machine/test/folder-tools-run.test.js
node --test machine/test/folder-tools-launch.test.js
node --test machine/test/folder-tools-codex-sandbox.test.js
node --test machine/test/project-tools.test.js
node --test machine/test/project-mcp-codex.test.js
node --test machine/test/screen.test.js
node --test viewer/test/wc-tool.test.js
npm --prefix viewer run test:browser -- test/app-project-tools.spec.js
```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-28

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | S5.2 changes `sandboxWrap` signature, breaking `machine/lib/screen.js:225` | upheld | S5.2 keeps `sandboxWrap(command)` untouched and adds dedicated `sandboxWrapTool(command, opts)` |
| intent | major | S5.2 skips HTTP folder tools in read-only Codex sessions for an invalid reason | upheld | S5.2 removes the HTTP skip; HTTP tools register normally as in `.mcp.json` |
| intent | minor | S5.2 runs Windows folder tools unconfined in sandboxed Codex without a Decision | upheld | Decision 8 + S2/S5: skip Windows stdio/script folder tools in sandboxed Codex on WSL |
| mechanics | blocking | S5 runs Windows folder executables outside sandbox for sandboxed Codex (`win.js:454` forbids it) | upheld | Decision 8 + S2/S5: skip Windows stdio/script folder tools in sandboxed Codex on WSL |
| mechanics | blocking | S5 changes `sandboxWrap` signature, breaking `machine/lib/screen.js:225` | upheld | Same fix: keep `sandboxWrap` untouched, add `sandboxWrapTool` |
| mechanics | major | S5 read-only handling for reviewers/project leads is unreachable under `TOOL_ROLES` | upheld | Non-goals + S5.1: keep `TOOL_ROLES` gating unchanged |
| mechanics | major | S2 keyed Windows stdio server writes unredacted tool list to `win-tool-proxy.js` disk cache | upheld | S2.2: omit `--list-cache` for keyed Windows stdio servers; make `--list-cache` optional in `win-tool-proxy.js` |
| mechanics | major | S2 keyed Windows tools only forward `WHEELCHAIR_WINDOWS_PROJECT` in `WSLENV`, not declared keys | upheld | S2.2: append declared key names to `env.WSLENV` for keyed Windows scripts and stdio servers |
| mechanics | major | S2 mentions attempt-token logic absent from ready file, and script waiter lacks timeout | upheld | S2.2: removed attempt-token claim; `waitReady(readyFile, { timeoutMs, signal })` enforces script timeout |
| mechanics | major | S4 skips executable check in `discover`, but `machine/lib/project-tools.js:103` still dereferences `tool.start[0]` | upheld | S4.1: skip executable check for `transport === 'http'` in `project-tools.js` (`folderRows`) too |
| mechanics | major | S4 omits `MCP-Protocol-Version` header and `tool check` session ID retention | upheld | S4.3 & S4.4: send negotiated `MCP-Protocol-Version` and retained `Mcp-Session-Id` on all follow-up requests |
| mechanics | major | S4 treats HTTP 404 after session ID as generic failure instead of reinitializing | upheld | S4.3: on HTTP 404 with active session ID, clear ID, transparently re-run `initialize` + `notifications/initialized`, and retry once |
| mechanics | major | S4 redaction wording risks leaking structural keys or corrupting JSON-RPC framing | upheld | S4.3: reuse `createLineChecker` from `machine/lib/server-lines.js` |
| mechanics | major | S4 rejects `debuglog('http')` but leaves `debuglog('https')` enabled | upheld | S4.3: reject `child_process`, `http`, `https`, and `net` debuglogs |
| mechanics | major | S4 `tool check` hits raw localhost URL for Windows-marked HTTP tools on WSL | upheld | S4.4: skip live localhost handshake on WSL for `windows: true` HTTP tools with clear message |
| mechanics | minor | S1 slow-reader test does not prove launcher stdout still has pending writes when child closes | upheld | S1.2: deterministic unit test |
| mechanics | minor | S5 omits `machine/lib/project-tools.js:160` string and existing test assertions | upheld | S5.1 & S5.4 + Validation: update `project-tools.js:160` and all affected tests |
| mechanics | minor | S5 adds real CLI test to machine glob without updating `machine/AGENTS.md` or requiring temp dirs | upheld | S5.3: document real-Codex exception in `machine/AGENTS.md` |

### Round 2 — 2026-11-28

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** S1.2 drain test; S2.2 Windows proxy/WSLENV/waitReady; S4.1/S4.3/S4.4 HTTP proxy/check/`project-tools.js`; S5 `sandboxWrapTool`/status strings/router/Validation.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | S2 omitting `--list-cache` makes `win-tool-proxy.js` answer `tools/list` with `[]` while waiting | upheld | S2.2: when `--list-cache` is omitted, hold `tools/list` (like `tools/call`) until ready file settles |
| intent | minor | S5.2 adds unused `read-only` mode, `--codex-trust` flag, and read-only real-Codex test | upheld | S5.2 & S5.3: simplified to fixed workspace-write/trusted `sandboxWrapTool(command, { worktree, toolDir })` and boolean `--sandbox` |
| intent | minor | S5.1 does not state effect on `shellToolsOnly`/`keyedToolsReason` consumers in `machine/service.js` | upheld | S5.1 explicitly names the three affected consumers (`service.js:1009-1013,1136,2433`) |
| mechanics | blocking | S1 marker test can deadlock or race | upheld | S1.1 & S1.2: extract `pipeKeyless` and unit-test pending `stdout.write` directly against `child` `'close'` |
| mechanics | blocking | S4 calls `createLineChecker(values)` instead of `createLineChecker({ name, values })` and omits `out`/`toServer` handling | upheld | S4.3 specifies `createLineChecker({ name: tool.name, values })` and handling of `out`, `toServer`, and `note` |
| mechanics | major | S2 misses `PATH`-resolved Windows executables and conflates Unity exclusion with sandbox denial | upheld | S2.1 & S2.2: add `resolveProgram`, separate `isWindowsExecutable` from `shouldWrapWindowsProxy` |
| mechanics | major | S2 script bridge re-classifies with default mount instead of service classification | upheld | S2.2: `bridgeEntry` passes per-tool `--win` flag from service classification |
| mechanics | major | S4 does not coordinate concurrent 404 session recoveries | upheld | S4.3: single shared in-flight recovery promise per expired session ID |
| mechanics | major | S4 SSE parser assumes single-line `data:` and ignores incomplete streams | upheld | S4.3 & S4.4: full blank-line-delimited SSE event parsing; incomplete stream returns JSON-RPC error |
| mechanics | major | S4 leaves redirect handling open for keyed HTTP requests | upheld | S4.3: reject `3xx` redirects without forwarding headers |
| mechanics | major | S5 real Codex sandbox test under `/tmp` is already inside writable `/tmp` | upheld | S5.3: fixture under `$HOME/.cache/wheelchair-sandbox-test-...` outside `/tmp`, with pre-sandbox write probe on `outside/` |
| mechanics | minor | S5 omits updating `machine/test/project-mcp-codex.test.js:145-160` | upheld | S5.4 explicitly includes updating `project-mcp-codex.test.js:145-160` |
| mechanics | minor | Targeted browser command doesn't use `viewer/playwright.config.js` | upheld | Validation uses `npm --prefix viewer run test:browser -- test/app-project-tools.spec.js` |

### Round 3 — 2026-11-28

**Lanes:** (pending)

**Changed since Round 2:**
- S1.1 & S1.2: extracted `pipeKeyless` helper and deterministic unit test for pending `stdout` write across `child` `'close'`.
- S2.1 & S2.2: added `resolveProgram`, separated `isWindowsExecutable` from `shouldWrapWindowsProxy`, passed per-tool `--win` flag into `tool-bridge.js`, and made `win-tool-proxy.js` hold `tools/list` until ready when `--list-cache` is omitted.
- S4.3 & S4.4: fixed `createLineChecker({ name: tool.name, values })` signature and `out`/`toServer`/`note` handling, serialized concurrent 404 recovery per expired session ID, parsed multi-line SSE events and errored on incomplete streams, and rejected `3xx` redirects on keyed HTTP requests.
- S5.1–S5.4 & Validation: dropped unused `read-only` mode and `--codex-trust` flag; documented `service.js` consumers of removed `shellToolsOnly`/`keyedToolsReason`; moved real-Codex sandbox test fixture outside `/tmp` with pre-sandbox write probe; added `project-mcp-codex.test.js` update; fixed Playwright validation command.

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
- 2026-11-28: Probed real `codex sandbox` (`codex-cli 0.172.0`): confirmed `-P wc -C <worktree>` with `permissions.wc.filesystem` and `permissions.wc.network.enabled` preserves env vars, allows writes in `<worktree>` and `/tmp`, and blocks writes outside them.
- 2026-11-28: Checked `session leads` before setting `status: ready-for-review`; still no overlapping active threads.
- 2026-11-28: Completed Round 1 triage (18 findings, all upheld and resolved); advancing to Round 2.
- 2026-11-28: Completed Round 2 triage (13 findings, all upheld and resolved); advancing to Round 3.
