---
slug: windows-localhost-tools
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Windows localhost tools from WSL

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Background: the parent plan's design for this (removed Spec §1 at
`d861dbb2:docs/plans/windows-bridge-solid/PLAN.md` lines 71-190, Decision Log D2-D20,
Review Rounds and Accepted Risks on `wc/d5233e17e73d`), summarised in `MAP.md`.

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | 2026-11-21 | Thread "Windows bridge: Unity setup, disk use, warnings" (`wc/d5233e17e73d`, verifying, not merged) changes adapters (`loaded: [{name, windows}]`), startIn readying, restart recovery of `WinBridge.toolSessions`, `detectWsl` and the Project tools page. Plan should build on it; confirm whether it merges before build | yes | Merged to main as PR #149 (87923e58) and merged into this branch; Spec builds on it |
| W2 | 2026-11-21 | Claude: does a `--mcp-config` entry with the same name as a disabled `.mcp.json` entry load (parent C2)? Needed if Q1 = private port | no | Checked live 2026-11-21 (claude -p, two stub HTTP servers): with the `.mcp.json` entry in `disabledMcpjsonServers` and a same-name `--mcp-config` entry, only the `--mcp-config` URL is contacted; control without disabling contacts the `.mcp.json` URL. D5 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode thorough | User's choice | user |
| D2 | A marked tool is reached through a private Linux port the machine picks, not the tool's own port; each session's built config points the tool at `http://127.0.0.1:<private port><path>`; the user's `.mcp.json` is never changed | Removes cross-project port meaning, Linux-port clashes and the localhostForwarding loop; restart gap becomes a rare path | user |
| D3 | The forward (Linux private-port listener → Windows relay → Windows `127.0.0.1:<tool port>`) is used in every WSL networking mode, mirrored included; no networking-mode detection | Mirrored-mode direct access could reach a Linux listener on the tool's port; one path is simpler and always safe | defaulted |
| D4 | The switch is stored as parent D7: top-level `"wheelchair": {"windows": ["<name>", ...]}` in `.mcp.json` | CLIs that read `mcpServers` never see an unknown field; save flow already keeps other top-level keys | defaulted |
| D5 | Claude: the marked `.mcp.json` entry is added to `disabledMcpjsonServers` and a same-name entry with the private URL is passed with `--mcp-config <file>`; tool names stay unchanged | Verified live (W2) | defaulted |
| D6 | Only `http` (streamable) entries can be marked; `sse` entries listed in `wheelchair.windows` are ignored with a warning and behave as today. IDEA.md: "(or SSE)" removed, SSE added to Not doing | SSE servers may send a full `endpoint` address at the tool's own port, bypassing the private port; SSE is deprecated and not editable in the form | idea-change |
| D7 | One forward per Windows tool port, shared by every live session that loads a marked tool on that port; forwards are claimed before tmux and released only once the session's tmux is confirmed gone | Same meaning everywhere (the port is the Windows port), fewest relays; parent review rounds 6-8 on early release | defaulted |
| D8 | A marked entry on WSL is always either pointed at its forward or withheld from the session; it never reaches a CLI with its original URL | The original URL points at Linux, where an unrelated program could get the headers | defaulted |
| D9 | Off WSL the mark is ignored and the entry loads as today | No Windows to reach; the same server may run locally | defaulted |
| D10 | The Windows relay refuses a connection when no Windows process listens on the port or the listener is `wslrelay` | Stops a Linux program on the same port receiving the headers through WSL localhostForwarding (parent C3) | defaulted |

## Spec

Builds on main as of `87923e58` (Windows bridge solid merged). Line references are to that
tree. Read `MAP.md` and `docs/maps/project-tools.md`, `docs/maps/windows-bridge-runtime.md`,
`docs/maps/machine-session-lifecycle.md` first.

### Terms

- **Marked tool:** an entry of `.mcp.json` `mcpServers` named in the top-level
  `"wheelchair": {"windows": [...]}` list (D4) that is *eligible*: `type` is `http`, its `url`
  parses, the scheme is `http:`, the host is `localhost` or `127.0.0.1`, and the URL has an
  explicit port (or the default 80). Its **tool port** is that port.
- **Forward:** for one tool port, a Linux TCP listener on `127.0.0.1:<private port>` in the
  machine service plus one Windows relay process, piping each accepted connection to Windows
  `127.0.0.1:<tool port>`.
- **On WSL:** `this.win.detected.wsl` is true (`machine/lib/win-env.js:8-29`).

### 1. Reading the mark

`readProjectMcp` (`machine/lib/project-mcp.js:85`) also returns `mcp.windows`: the eligible
marked names, in list order, de-duplicated. A listed name that is not in `mcpServers` or not
eligible is left out with a warning, recorded like other project tools warnings:
- `sse` entry: `<tool>: "Runs on Windows" doesn't apply to SSE tools; it loads as usual`.
- any other ineligible entry: `<tool>: "Runs on Windows" only applies to an http://localhost
  or http://127.0.0.1 address`.
- unknown name: ignored silently (a rename the user hasn't saved yet).
A `wheelchair` value that is not an object, or `windows` not an array of strings, is ignored
with one warning `"wheelchair" in .mcp.json is not in the expected form; ignored`. Unknown
keys under `wheelchair` are ignored. Validation of the rest of the document is unchanged.
Off WSL, `mcp.windows` is computed but unused (D9): no forwards, no withholding, no
warnings beyond the ones above.

### 2. Which tools a session forwards

In `startIn` (`machine/service.js:832`), on WSL only:
1. Build the session's config once as today (`commandFor`, `:847`) to learn `loaded`.
2. The session's **forwarded tools** are the loaded entries whose name is in `mcp.windows`.
   Kimi loads none, so it forwards none.
3. For each forwarded tool, claim its forward (section 4) and get its private port. Claims
   happen before tmux starts. A claim that fails withholds that tool (section 3).
4. Build the config again, passing `context.windowsUrls`: `{<name>: <rewritten URL>}` for each
   successfully claimed tool. The rewritten URL is the tool's URL with host `127.0.0.1` and port
   the private port; scheme, path, query and fragment unchanged. Headers are unchanged.
5. Use the second build from here on (`loaded`, warnings, settings, tool files).

If the session forwards nothing, steps 3-5 are skipped and startIn behaves exactly as today.
`windowsTools` (copy readying for Windows stdio programs) is unchanged: a forwarded HTTP tool
needs no worktree copy.

### 3. Putting the rewritten URL in each CLI's config (D2, D5, D8)

- **Claude:** for each forwarded or withheld tool, add its name to `disabledMcpjsonServers`.
  For forwarded tools, write `<stateDir>/mcp-config/<session>.json` (atomic, mode 0600, since
  headers may carry keys) as `{"mcpServers": {<name>: {"type": "http", "url": <rewritten>,
  "headers": <as in .mcp.json, if any>}}}` and add `--mcp-config <that path>` to argv. Remove the
  file when the session is released (section 5) and in the existing stale-file sweep pattern
  (`sweepAgyTools`, `service.js:477-535`).
- **Codex:** `codexOverrides` (`machine/adapters/codex.js:52-100`) uses the rewritten URL for
  forwarded tools and omits withheld ones.
- **Antigravity:** `machine/adapters/agy.js:39-43` uses the rewritten URL; withheld tools are
  omitted.
- **Withheld:** a marked loaded tool whose claim failed is not given to the CLI in any form.
  Warning, recorded and printed to the session log like other project tools warnings:
  `<tool>: couldn't reach Windows (<reason>); left out of this session`. Reasons:
  `Windows bridge not available`, `couldn't open a local port`.
- `loaded` reports withheld tools as not loaded.

### 4. Forwards

Kept in a new module `machine/lib/win-forward.js`, owned by `WinBridge`.

- **Table:** tool port → `{private_port, sessions: Set<name>, listener, sockets, relay}`.
- **Claim(session, tool port):** if a forward for that port exists, add the session and reuse
  its private port. Otherwise check `WinBridge` can run Windows programs (interop and
  `powershell.exe` present, as `bridgeHealth()` reports); if not, fail with `Windows bridge not
  available`. Then `net.createServer` and listen on `127.0.0.1` port 0 (the kernel picks a free
  port); a listen error fails the claim with `couldn't open a local port`. Concurrent claims for
  the same tool port share one pending creation (no two listeners for one tool port).
- **Connections:** each accepted socket is relayed (below). The listener only accepts on
  `127.0.0.1`.
- **Relay:** one long-lived `powershell.exe` per forward, started with `spawnPs`
  (`machine/lib/win-env.js:57-61`) running a script shipped in the repo
  (`machine/lib/win-relay.ps1`, embedded by reading the file, never written at run time),
  started on the first connection. It multiplexes all connections for the forward over its
  stdin/stdout with binary frames `[type:1][conn:4][len:4][payload]`, types `open`, `data`,
  `close`, `refused`. A new connection never starts a new Windows process.
  - On `open`, the relay looks up the owning process of a Windows listener on
    `127.0.0.1:<tool port>` (`Get-NetTCPConnection -State Listen -LocalPort <port>` → process
    name; result may be cached 2 s). None, or `wslrelay`, → `refused` (D10). Otherwise it
    connects to `127.0.0.1:<tool port>`; a failed connect → `refused`.
  - `refused` or `close` closes the Linux socket; a Linux socket closing sends `close`.
  - If the relay exits, open sockets are destroyed and the next connection starts it again, at
    most once per 10 s; inside that limit connections are accepted and closed at once, and the
    last reason is kept for `win info`.
  - IPv4 only on Windows: the relay always dials `127.0.0.1` (parent D9).
- **Release(session):** remove the session from every forward. A forward with no sessions
  left closes its listener, destroys every open socket (long-lived streams included) and ends
  the relay (close stdin, then kill after 5 s).

### 5. Lifetime and restarts

- **Record:** `<stateDir>/win/forwards.json`, written atomically (`atomicWrite`,
  `service.js:110-115`, mode 0600) whenever claims or releases change it:
  `{<tool port>: {private_port, sessions: [names]}}`. Claims for a session are recorded
  **before its tmux starts**.
- **Start failed or cancelled:** a session that claimed forwards but never reached
  `this.sessions[name]` is released in `start()`'s `finally` (`service.js:799`).
- **Session gone:** a session is released only once its tmux session is confirmed absent
  from `liveTmux()` (`service.js:470-475`). `stop()` (`:1186-1202`) releases after
  `kill-session` when `liveTmux()` no longer lists it; otherwise the sweep does. The existing
  60 s `win.sweep` (`win.js:303-313`) also releases every recorded session not in `liveTmux()`
  and not in `startingNames` (`service.js:284`). A `null` from `liveTmux()` (tmux state
  unknown) releases nothing.
- **Machine service restart:** in `WinBridge.startup` (after `recoverFromTmux`,
  `service.js:446-447`), read `forwards.json`; for each tool port with at least one session
  still in `liveTmux()`, listen on the recorded private port again with the live sessions.
  Sessions not live are dropped from the record. A port that can no longer be bound is kept in
  the table as `failed: port in use on Linux` with its sessions (released as usual); `win info`
  shows it. A missing or unreadable file means no forwards to restore.

### 6. Visibility

`WinBridge.info` (`win.js:373-381`) adds `forwards: [{tool_port, private_port, sessions,
state, reason?}]`, `state` one of `ok`, `relay-failed`, `failed`. Withheld tools appear only
as session warnings (section 3).

### 7. Project tools page

- The read reply (`machine/lib/project-tools.js:71-88`, passed through at
  `service.js:2084-2087`) gains `wsl: true|false` from `win.detected.wsl`, and the tools list
  carries each entry's mark (`windows: [names]` read from `wheelchair.windows`).
- In `viewer/pages/project-tools.js`, a "Web address" entry shows a **Runs on Windows** switch
  when the read reply has `wsl: true` and the URL is `http://localhost[:port]` or
  `http://127.0.0.1[:port]`. Help text: "Turn on if this tool's server runs on Windows. Agents
  here reach it through wheelchair." Hidden otherwise; a mark on a hidden entry is kept as is.
- Saving sends `windows: [names]` next to `tools`. The dirty check (`:713`) and the machine's
  nothing-changed shortcut (`machine/lib/project-tools.js:100-103`) compare both `mcpServers`
  and `wheelchair.windows`. The machine writes `wheelchair.windows` (keeping other keys under
  `wheelchair`), removes `windows` when empty and `wheelchair` when it then has no keys, and
  keeps every other top-level key as today. Renaming an entry renames it in the list;
  deleting an entry removes it.

### Not doing

As IDEA.md. Also: no change to `.mcp.json` beyond the switch; no networking-mode detection
(D3); no IPv6 Windows servers; no restart of Windows tool servers.

### Validation

```bash
node --test machine/test/*.test.js     # includes new win-forward and project-mcp cases
bash machine/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

New tests, with a fake `spawnPs` that runs a Node stand-in for the relay speaking the same
frames and dialling a local test server:
- `readProjectMcp`: eligible, SSE, non-localhost and malformed `wheelchair` cases and their
  warnings; off WSL nothing forwards.
- Claude settings/argv: marked tool in `disabledMcpjsonServers`, `--mcp-config` file contents
  and mode 0600; Codex and Antigravity rewritten URLs; withheld tools absent from all three
  and never present with the original URL.
- Two sessions on one tool port share one listener; releasing one keeps it; releasing the last
  closes it and destroys an open streaming connection.
- Release waits for tmux to be gone; a starting session is skipped by the sweep; a failed start
  releases.
- Restart: forwards.json restored to the same private port for live sessions; a taken port is
  reported `failed`.
- Relay frames: `refused` closes the socket; relay death restarts at most once per 10 s.
- Project tools page: switch shown only on WSL and for localhost http URLs; dirty on switch
  change alone; rename/delete update the list; save keeps other keys.

Live (Check Once Built): on this WSL machine in default networking, a Windows HTTP MCP server
on `127.0.0.1:<port>`, marked, used from Claude, Codex and Antigravity sessions.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| While the machine service is down (restart or crash), a forward's private port is unbound; a Linux program that binds that exact port in the gap gets a live CLI's requests and headers | Rare path: needs a service restart and another program taking a kernel-picked port within seconds; startup reports it `failed` | planning |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|
| C1 | Live on WSL default networking: a Windows HTTP MCP server on `127.0.0.1:<port>`, marked, is callable from Claude, Codex and Antigravity sessions | planning |
| C2 | With the Windows server stopped and a Linux listener on the tool port, connections are refused (no loop, nothing reaches the Linux listener), and work again once the Windows server starts | planning |
| C3 | Mirrored networking: same as C1 and C2 | planning |

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
