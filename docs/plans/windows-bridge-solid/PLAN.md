---
slug: windows-bridge-solid
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Make the Windows bridge solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Parent: `docs/plans/windows-bridge/PLAN.md` (merged in PR #140). Map: `MAP.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode is thorough | User's choice | user |
| D2 | Windows `localhost` HTTP/SSE tools are reached through a forward: a Linux listener on `127.0.0.1:<port>` pipes each connection through a Windows-side process (over WSL interop) to Windows `127.0.0.1:<port>`; skipped when WSL uses mirrored networking | Works for tools that bind only to Windows 127.0.0.1 and needs no firewall rule; rewriting to the host address fails for those tools and does not reach Claude's file-loaded config | defaulted |
| D3 | Disk report in `win info`: size of each copy of this thread, size of the repository's `.git`, count of kept conflict refs, and free space on the Windows drive. Warning when this thread's copies pass 20 GB, `.git` passes 10 GB, or the Windows drive has under 10 GB free. Warns only; never deletes | Measurable cheaply; unattributable shared objects are reported as one total; limits are generous so they fire only on real growth | defaulted |
| D4 | Broken bridge warning: added to the approval card's `warnings`, like the screen tools warning, and shown to the agent at session start; fires only on a Microsoft (WSL) kernel. Detection is widened so a WSL kernel with missing interop counts as "WSL, bridge broken: interop off" instead of "not WSL" | Mirrors the existing warning path; the user sees it before building starts | defaulted |
| D5 | The ready-made Unity setup is for MCP for Unity (CoplayDev), in its default HTTP mode (`http://localhost:8080/mcp`, served by the Editor on Windows) | User's choice; free, and it exercises the localhost forward end to end | user |
| D6 | A `localhost` HTTP/SSE tool is sent to Windows only when the user turns on a "Runs on Windows" switch for it in Project tools; the MCP for Unity preset has it on | User's choice; guessing could take a port a Linux service wants later | user |
| D7 | The switch is stored in `.mcp.json` outside `mcpServers`, as a top-level `"wheelchair": {"windows": ["<tool name>", ...]}`, so provider CLIs that load `mcpServers` from the file never see an unknown field in an entry | The save flow already keeps other top-level keys; an extra key inside an entry risks a CLI rejecting the entry | defaulted |
| D8 | Windows stdio tools that started before the copy was ready are restarted by a go-between the bridge puts in front of each one; the agent keeps its connection and starts as fast as today | User's choice; holding the start can take minutes on a first copy | user |
| D9 | Only IPv4 loopback Windows servers are supported; the switch applies to `http://localhost` and `http://127.0.0.1`, not `[::1]` | WSL mirrored mode reaches Windows loopback over IPv4 only; one address family keeps the forward simple; MCP for Unity listens on IPv4 | review-round-1 |
| D10 | Networking mode comes from `wslinfo --networking-mode` only; anything else counts as not mirrored | Simpler than guessing the Windows user's `.wslconfig` | review-round-1 |
| D11 | Supersedes part of D3: no warning on `git_bytes` (information only); conflict snapshot warning at 10 or more; broken-bridge approval warning only when the project has Windows tools | The whole-repository size is noise on large repositories; one kept snapshot is not a limit; warn only where work depends on the bridge | review-round-1 |
| D12 | Each agent binds to its own copy's Editor through instructions added to its prompt: open Unity on its copy, select the MCP for Unity instance whose project path is the copy, verify, never act on another | One MCP for Unity server on Windows serves every Editor and routes per client session; URLs cannot separate threads | review-round-1 |
| D13 | Marked tools are withheld from a session when the Linux port is held by another process; forwards and readying follow only entries the session's CLI loads; forwards are recorded and restored across machine restarts | Stops keys in headers reaching an unrelated Linux service; no wasted ports or 45 s waits for tools never loaded; tmux sessions outlive the service | review-round-1 |
| D14 | Tool readiness is a ready file written only after a successful reconcile following the session's start; the go-between keeps the client connection if the tool exits before that, and handles a restart during an unfinished `initialize` | Fixes skipped restarts on a stale or mid-reconcile copy and lost connections | review-round-1 |
| D15 | Supersedes D5's mode: the MCP for Unity preset is a stdio tool started per agent (`uvx.exe` on Windows, wrapped by the go-between), not the Editor's HTTP address. The localhost forward (item 1) is still built for other tools | User's choice; agents usually start before Unity is open, and the HTTP way would fail for that whole session; one server per agent keeps agents apart | user |
| D16 | Supersedes D15's "wrapped by the go-between": the MCP for Unity entry is not wrapped (it still readies the copy) | It never reads the copy, and a restart would drop the agent's Editor selection | review-round-3 |
| D17 | Before the copy is ready, a go-between whose tool has exited answers `initialize` itself and lists no tools, then sends `tools/list_changed` once the real tool is up | Holding `initialize` would outlast CLI start deadlines (Codex 10 s) | review-round-4 |
| D18 | Supersedes D14's restart and D17: the go-between never starts the real tool before the copy is ready; it answers the handshake itself until then, then starts the tool and sends `tools/list_changed`. Wrapped tools started before ready expose tools only for that session | Same behaviour the user chose (agents start promptly, tools work once the copy is ready) with no restart, so no handshake replay, stall or duplicate-notification cases | review-round-5 |
| D19 | D18 also supersedes D8's "restarted": the go-between holds the tool back until the copy is ready; nothing is restarted | Wording left from the restart design | review-round-6 |
## Spec

Background: the bridge as built is described in `docs/maps/windows-bridge-runtime.md` and
`MAP.md`. "WSL machine" means `detectWsl()` reports a Microsoft kernel (see item 5 for the
widened detection). Nothing in this Spec changes behaviour on a machine that is not WSL;
every new code path returns early there, and the non-WSL tests keep passing unchanged.

**Which tools a session loads.** Several rules below depend on whether the session's CLI
actually loads an entry. Loaded entries per CLI, for tool roles: Claude loads stdio, `http`
and `sse`; Codex and Antigravity load stdio and `http` (they skip `sse`, as today, and skip
anything their existing per-entry reasons reject); Pi and Kimi load none. "Loaded entries"
below always means this set, taken from the adapter's final built configuration for the
session (after item 4's wrapping and after Codex's override size budget, which can drop every
entry), not from `.mcp.json` alone. The order in `startIn` is: (1) work out the candidate
entries the CLI would load **per entry** (its per-entry skip reasons only, ignoring Codex's
aggregate budget), and reserve their loopback ports (§1, "Port reservations"), noting which
entries must be withheld; (2) build the adapter command once, with withheld entries removed and item 4's
wrapping applied; (3) read the loaded entries from that final build; (4) release any forward
reserved in (1) for an entry that did not end up loaded, and decide readying, ready
enrollment, Windows tool tracking (§4) and the Unity prompt lines from the loaded entries
only. The adapter is built exactly once; Codex's budget is applied in (2) to the entries left
after withholding. Launch artifacts (settings files,
`--mcp-config`, Antigravity plugin files) are written only from the final build.

### 1. Windows localhost tools (HTTP and SSE)

**Marking.** `.mcp.json` may carry a top-level `"wheelchair": {"windows": ["<name>", ...]}`
(D6, D7). A name counts only if it names an `http` or `sse` entry in `mcpServers` whose URL
parses, uses `http:`, and whose host is `localhost` or `127.0.0.1`; other names are ignored
with a project tools warning `<tool>: "Runs on Windows" only applies to an http://localhost
or http://127.0.0.1 address`. Unknown keys under `wheelchair` are ignored. `readProjectMcp`
returns the valid list as `mcp.windowsHttp` (array of names); `checkDocumentText` still
accepts any other top-level key.

**Supported addresses.** The Windows server must listen on IPv4 loopback (`127.0.0.1`, or all
addresses); IPv6-only Windows servers are not supported (D9). The Windows side of the forward
always dials `127.0.0.1:<port>`.

**Copy readying.** A session's "Windows tools" (the `windowsTools` flag passed to
`beforeLaunch`) is true when its loaded entries include a Windows `.exe` stdio tool (as
today, `hasWindowsProgram`) or a marked tool. A marked tool its CLI does not load triggers
nothing (no readying, no forward).

**Project tools form** (`viewer/pages/project-tools.js`, saved through
`machine/lib/project-tools.js`): HTTP entries get a "Runs on Windows" switch, shown only when
the machine reports WSL and the URL is `http://localhost` or `http://127.0.0.1`. Saving
writes or removes the tool's name in `wheelchair.windows`, removes the `wheelchair` key when
the list empties and it has no other keys, and keeps every other top-level key as today.
Renaming or deleting a tool updates the list. A change to the switch alone is a change: the
form's dirty check and the machine's save request both carry the Windows list (the save body
gains `windows: [names]`, alongside `tools`), and the machine's "nothing changed" short-cut
compares both `mcpServers` and `wheelchair.windows` against the baseline before skipping the
PR. SSE stays not editable in the form (as today)
but a hand-written SSE entry listed in `wheelchair.windows` is honoured where loaded.

**Forward.** On a WSL machine whose networking mode is not mirrored, the machine keeps one
forward per distinct port named by a loaded marked tool of any live tool-role session. The URL
is not rewritten: the agent CLI connects to the port in WSL as written.

- Linux side: a TCP listener in the machine service on `127.0.0.1:<port>`, and also on
  `[::1]:<port>` when any session using the port has a URL host of `localhost`. A `::1` bind
  that fails because the machine has no IPv6 loopback (`EADDRNOTAVAIL`, `EAFNOSUPPORT`) is
  ignored; one that fails because the address is in use (`EADDRINUSE`) counts as "port taken
  on Linux" below. When a later session needs `::1` on a port the machine already forwards on
  IPv4 only, the machine binds `::1` then, before admitting that session, with the same rules.
  All listeners for a port feed the same Windows relay.
- Windows side: one long-lived relay process per port, started through interop with
  `powershell.exe` running a script shipped in the repo (not written at run time). It
  multiplexes every connection for that port over its stdin/stdout with simple framing
  (connection id, open, data, close) and connects each to Windows `127.0.0.1:<port>`. A new
  connection must not spawn a new Windows process.
- **No loop through WSL.** WSL's default `localhostForwarding` can publish the Linux listener
  on Windows localhost when no Windows server holds the port, so the relay could dial itself.
  Before each connect, the relay looks up the Windows process listening on `127.0.0.1:<port>`
  (`Get-NetTCPConnection -State Listen -LocalPort <port>`, owning process name); if there is
  none, or it is `wslrelay`, it refuses that connection (Linux side closes it) instead of
  dialling. The lookup result may be cached for 2 s.
- If the Windows side refuses a connection, the Linux side closes that connection; the relay
  stays up. If the relay process dies, the next connection starts it again, at most once per
  10 s; while it cannot be started, connections are accepted and closed at once and the
  reason is recorded for `win info`. **The Linux listeners stay bound for as long as any live
  session uses the port**, whatever happens to the relay, so the port is never released to
  another Linux process while a CLI still holds its URL.
- Claimed before the agent CLI is launched (in `startIn`, before tmux), kept while any live
  session uses that port. A session stops using its ports only once its tmux session is
  confirmed gone (absent from `liveTmux()`), not merely marked stopped: the stop path
  releases them after a successful `kill-session` check, and `WinBridge.sweep()` (every 60 s)
  releases the ports, reservations and launch record of any recorded session no longer in
  `liveTmux()` and not still starting (names in the service's `startingNames` are skipped, as
  the Antigravity tool-file sweep already does), which covers handoff kills and crashes. The forward closes as soon as its last
  user is released, or when its thread archives. Teardown closes the listeners, destroys every accepted connection still open
  (for example a long-lived SSE stream) and stops the relay; the port's `windows`
  reservation is released only after all of that has finished, so an opposite-meaning reservation can never reach a listener still open.
- **One meaning per port.** On a WSL machine (not mirrored), a loopback port is either a
  Windows port or a Linux port for all live and starting sessions. "Unmarked loopback entry"
  means an unmarked `http`/`sse` entry whose host is `localhost`, `127.0.0.1` or `[::1]`.
- **Port reservations.** The machine keeps an in-memory table: port → `windows` (with the
  sessions using it) or `linux` (with the sessions using it). In step (1), synchronously
  (no `await` between reading and updating the table), a starting session reserves each
  candidate port with its meaning:
  - Within one session, if a marked entry and an unmarked loopback entry share a port, the
    marked entry wins and the unmarked one is withheld.
  - A `linux` reservation on a port held as `windows` fails: that unmarked entry is withheld,
    warning `<tool>: port <port> is forwarded to Windows for another project, so this Linux
    tool was left out of this session`.
  - A `windows` reservation on a port held as `linux` fails: that marked entry is withheld,
    warning `<tool>: port <port> is used by a Linux tool in another session, so it can't reach
    Windows; left out of this session`, and `win info` shows it as `"used by a Linux tool"`.
  Reservations are released in step (4) for entries not loaded, when a start fails or is
  cancelled, and when the session is confirmed gone as in the Forward bullet above (a
  `windows` one after its listeners close).
  They are recorded in the launch record (below) and rebuilt from it for live sessions at
  startup.
- **Port taken on Linux.** If `127.0.0.1:<port>` (or `[::1]:<port>` when needed, see above)
  cannot be bound because another Linux process holds it, the marked entry is withheld from that
  session's CLI so it never connects to the unrelated process (its headers may carry keys):
  Claude gets the name added to `disabledMcpjsonServers`; Codex and Antigravity drop the
  entry. The project tools warning `<tool>: port <port> is in use on Linux, so it can't reach
  Windows; left out of this session` is recorded and printed to the session log, as other
  project tools warnings are. A session that shares a forward the machine already holds is
  fine.

**Mirrored networking.** Mode is read with `wslinfo --networking-mode` (output `mirrored`
means mirrored); a missing command or any other output counts as not mirrored (D10). In
mirrored mode no forward is made: WSL reaches Windows `127.0.0.1` directly. But a Linux
process listening on the same port on `127.0.0.1` or `[::1]` would receive the CLI's requests
(and headers) instead, so in step (1) the machine checks `/proc/net/tcp` and `/proc/net/tcp6`
for a socket in LISTEN state on that port bound to `127.0.0.1`, `::1`, `0.0.0.0` or `::` (the
binds a loopback URL can reach); if one exists the marked entry is withheld exactly as in
"Port taken on Linux". A listener bound only to another address does not count. Port reservations still apply in mirrored mode.

**Machine service restart and the launch record.** tmux sessions survive a service restart,
so forwards and Windows tool state must too. In step (4), **before tmux is started**, the
machine writes the session's launch record to `<stateDir>/win-sessions.json` (one entry per
session name; written atomically, mode 0600; entry removed when the session is confirmed gone as in §1's Forward bullet, or its start
fails): its port reservations with meanings, the addresses bound for each forwarded port
(`127.0.0.1`, `::1`), each marked tool's name, port and launch outcome (the `forwards` state
`win info` reports, including withheld ones), `wrapped` (has at least one go-between) and
`windows_tools` (has any Windows tool: wrapped stdio, the Unity entry, or a marked HTTP/SSE
entry). This file, not the sessions file, is what startup recovery reads, so a restart during
launch is covered. On startup, after `recoverFromTmux`, it re-claims the listeners for every recorded
session that is still live, with the recorded addresses; a port that can no longer be bound
is recorded as `failed: port in use on Linux` and shown by `win info`. The window while the
service is down is an accepted risk (see Accepted Risks).

**Per CLI.** URLs pass through unchanged, so Claude (file-loaded), Codex (HTTP override) and
Antigravity (plugin) need no URL change.

`win info` gains `forwards: [{ tool, port, state: "up" | "port in use" | "failed: <reason>" |
"mirrored" | "not loaded" | "used by a Linux tool" }]` for this session's marked tools.

### 2. MCP for Unity preset

MCP for Unity runs as a stdio tool started per agent (D15): `uvx --from mcpforunityserver
mcp-for-unity --transport stdio`, which talks to whichever Unity Editors have the MCP for Unity
package open, over Windows localhost. On WSL it runs on Windows (`uvx.exe`), so it is an
ordinary Windows `.exe` stdio tool: it readies the copy and gets `WHEELCHAIR_WINDOWS_PROJECT`.
It is **not** wrapped by item 4's go-between: it never reads the copy, and a restart would drop
the agent's Editor selection. Each agent has its own server process.

**The button.** The Project tools form gets an "Add MCP for Unity" button. It adds an entry
named `unity` (`unity-2`, ... if taken), stdio, args `["--from", "mcpforunityserver",
"mcp-for-unity", "--transport", "stdio"]`, and a command:
- WSL machine: the Linux path of Windows `uvx.exe`. Pressing the button sends a new request
  to the machine (`POST /v1/project-tools/unity-prep`, same auth as the project tools read),
  which resolves the path with PowerShell `(Get-Command uvx.exe).Source` and `winEnv.toLinux`
  (10 s deadline, result cached for 10 minutes), fills the entry, and then fetches the server
  once on Windows in the background (`uvx.exe --from mcpforunityserver mcp-for-unity --help`,
  5 minute deadline) so the first agent does not wait for the download. The form shows
  "Getting MCP for Unity ready on Windows…" then "Ready" or "Couldn't fetch it: <reason>; the
  first agent will fetch it instead" (polling the same route; saving is never blocked by it).
  The page load does not call PowerShell. Not found → the button fills nothing and shows
  "Install uv on Windows first: https://docs.astral.sh/uv/getting-started/installation/".
- Any other machine: `uvx`.
The user edits or saves it like any entry; the button only fills the form. The server version
is not pinned (MCP for Unity's own setup does not pin it).

Help text under it: "Add the MCP for Unity package to your Unity project and commit it, so
every Windows copy has it. In Unity, open Window > MCP for Unity and set the transport to
Stdio (once per Windows user). Each agent opens Unity on its own copy and picks that Editor."
It links to `https://coplaydev.github.io/unity-mcp/getting-started/install`.

**Pointing each agent at its own copy's Editor.** One machine can have several Editors open
(other threads' copies, the user's own). For a tool-role session on a WSL machine whose loaded
entries include a Windows stdio entry with `mcp-for-unity` among its args, the machine adds
these lines to the session's prompt file before launch (same mechanism as item 5's line),
filling every placeholder itself:

> Unity: your project copy on Windows is `<copy_windows path>`. Open Unity on it yourself
> (`wc.js win start -- "<unity exe>" -projectPath "<copy_windows path>"`), never on another
> path.
> Before any other Unity MCP call, list the connected Unity instances, select the one whose
> project path is your copy, and check the selection; if none matches, don't use the Unity
> tools until it appears. Never act on another instance.

`<unity exe>` is `C:\Program Files\Unity\Hub\Editor\<version>\Editor\Unity.exe`, where
`<version>` is `m_EditorVersion` from the session worktree's `ProjectSettings/ProjectVersion.txt`,
used only if that file exists and the resulting `Unity.exe` exists under the Windows mount
(`<mount>/c/Program Files/Unity/Hub/Editor/<version>/Editor/Unity.exe`). Otherwise the sentence reads "Open Unity <version
or 'the project's version'> on it yourself with `wc.js win start -- "<Unity.exe>" -projectPath
"<copy_windows path>"` (Unity is usually under
`C:\Program Files\Unity\Hub\Editor`)".

For a sandboxed Codex session (which cannot `win start`), the second sentence is instead: "You
can't start Windows programs from this sandboxed session; ask whoever started you to have Unity
opened on that path." The rest is the same.

`README.md`'s Windows bridge section gets a short "Unity" paragraph saying the same, including
that uv must be installed on Windows and the package committed to the project.

### 3. Disk report

`win info` gains a `disk` object:

| Field | Meaning |
|---|---|
| `copies` | `[{ path, bytes }]`, one per Windows copy of this thread (`%LOCALAPPDATA%/Wheelchair/copies/<thread>/*`) |
| `copies_bytes` | Sum of `copies` |
| `git_bytes` | Size of the repository's common `.git` (`git count-objects -v`: `size` + `size-pack`, in bytes). Information only: it covers the whole repository, not just what the bridge added |
| `conflict_refs` | Count of refs under `refs/wheelchair/conflicts/` in that repository |
| `windows_free_bytes` | Free space on the drive holding `%LOCALAPPDATA%` |
| `measured_at` | ISO time of the copy measurement, or null while the first one runs |
| `warnings` | Plain sentences, see below |

Copy sizes are measured on the Windows side (one PowerShell walk per copy), cached per
thread, and refreshed in the background when older than 10 minutes; `win info` never waits
for a copy walk. The git count, ref count and free space are read on every call (fast).
A failed measurement leaves the last value and adds `disk.reason`.

Warnings (D3, amended D11): `copies_bytes` over 20 GB → "This thread's Windows copies use <n>
GB."; `conflict_refs` 10 or more → "<n> kept conflict snapshots; see README to remove them.";
`windows_free_bytes` under 10 GB → "Only <n> GB free on the Windows drive." No warning on
`git_bytes`. Nothing is ever deleted. `wc.js win info` keeps printing the JSON on stdout,
unchanged in shape apart from the new fields; it prints each `disk.warnings` line to stderr.

### 4. Windows stdio tools that start before the copy is ready

**Which tools.** On a WSL machine, for tool roles, every loaded stdio entry whose command
`isWindowsProgram`, except one whose args include `mcp-for-unity` (§2), is launched through a
go-between: `machine/lib/win-tool-proxy.js`, run as `<node> <proxy> --ready-file <path> --
<command> <args...>`, where `<node>` is `process.execPath`. HTTP tools are never wrapped
(their server is not started by the CLI).

**Per CLI.**
- Codex and Antigravity: their translated entries get the wrapped command and args. The
  Codex env passthrough of `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV` stays.
- Claude loads `.mcp.json` itself, so its wrapped entries are added to
  `disabledMcpjsonServers` and given instead, wrapped and under the same names, in a
  per-session file passed with `--mcp-config` (in `<stateDir>/settings/`, mode 0600).
- Pi and Kimi load no project tools; unchanged.

**Ready file.** `<stateDir>/win-ready/<session name>` (mode 0600, written atomically) holds
JSON `{"state": "ready" | "waiting" | "failed", "reason": "...", "at": "<iso>"}` (`reason`
only for `failed`). The go-between branches on `state` only, never on reason text.
- `ready` is written only after a reconcile of that session's copy (its `create` + `sync`)
  **finishes successfully after the session's start began**: the session's own readying
  task, a shared readying task it awaited, or any later successful `win sync`/`run`/`start`
  sync of that copy. An existing `.git` alone never counts.
- `waiting` is written before launch and stays while the readying task is still running
  (including past the 45 s wait).
- `failed` is written when the readying task fails; a later success replaces it with `ready`.
- Removed when the session stops.

**Recovery after a service restart.** On startup, after `recoverFromTmux`, for every live
session in the launch record: with `windows_tools`, it is added back to
`WinBridge.toolSessions` (and its copy registered as today), so the copy's "used since last
reconcile" tracking and the final stop reconcile work as before the restart; with `wrapped`
and a ready file that is missing or not `ready`, the machine runs the readying (create and
sync) again and writes the result.

So a copy that existed but was stale at start still counts as not ready until the first
reconcile after start finishes; if that finishes within the 45 s wait, the tool starts after
it and never sees the stale copy.

**Stop waits for wrapped tools.** While a go-between's real tool runs, the go-between keeps
a file `<stateDir>/win-tools/<session name>/<go-between pid>` (created when it starts the real
tool, removed after the tool's job has closed and its pipes are shut). `WinBridge.onStop` for a
`wrapped` session waits until the `win-tools` directories of **every** session registered on
the same copy key are empty (polling, up to 15 s; entries whose pid is no longer alive are
removed) before the final stop reconcile, so a tool's last writes are in
the final Windows snapshot. A timeout logs it and reconciles anyway. The same gate applies to
`WinBridge.sweep()`'s final reconcile: a copy is not swept-reconciled while any session sharing
it (registered for that copy key) still has entries in its `win-tools` directory with live
pids; the next sweep tries again. This covers sessions that end without `onStop` (a CLI
crash, or the handoff `kill` path in `machine/service.js`).

**Process tree.** The go-between starts the real tool so that ending it ends every Windows
process it started: through a launcher that puts the tool in a Windows Job Object with
kill-on-close, as `machine/lib/win-apps.js` does for apps, with the tool's stdio passed
through. "Stop the tool" means: close the job (all descendants end), then wait until the
tool's stdio pipes close (up to 5 s).

**Go-between behaviour (D18).** The real tool is never started before its copy is ready, so
nothing ever needs restarting. The go-between reads JSON-RPC messages line by line.

1. **Ready at start** (ready file says `ready`): it starts the real tool at once and only
   pipes stdin/stdout both ways (stderr passes through), like an unwrapped tool, until either
   side ends (step 5).
2. **Not ready at start:** it does not start the real tool. It answers the client itself:
   - `initialize` → at once, a successful result with the client's requested
     `protocolVersion`, `capabilities` `{tools: {listChanged: true}}`, `serverInfo`
     `{name: "<tool name>", version: "0"}` and `instructions` saying the state: "Waiting for
     the Windows project copy to be ready; this tool's real tools appear when it is." or, when
     the ready file says `failed`, "The Windows project copy couldn't be readied: <reason>.
     This tool has no tools until it is. Run `wc.js win sync` to retry."
   - `notifications/initialized` and other client notifications → swallowed.
   - `tools/list` → an empty list. `ping` → an empty result.
   - any other request → a JSON-RPC error (`code -32000`) with the same sentence as
     `instructions`.
3. **When the ready file first says `ready`** (poll every 2 s is fine), one of two paths:
   - **3a. The client has not sent `initialize` yet:** start the real tool and pipe as in
     step 1 from then on. The client's own handshake goes to the real tool and its answers
     go back unchanged. Nothing synthetic, no `list_changed`.
   - **3b. The stand-in already answered `initialize`:** queue client messages, start the
     real tool, send it the client's `initialize` params, wait up to 60 s for a successful
     response (not passed to the client: it already has one), then send the real tool exactly
     one `notifications/initialized` (the go-between's own; every client
     `notifications/initialized`, including any queued during the handoff, is dropped), flush
     the rest of the queue in order, send the client `notifications/tools/list_changed`, and
     from then on pipe as in step 1.
   The rules below apply to 3b.
   - If its `protocolVersion` differs from the one the go-between answered, the go-between
     writes a line saying so to stderr and carries on.
   - Only tools are exposed for such a session: prompts, resources and other capabilities the
     real tool offers are not advertised (the go-between already answered `initialize`), and
     their requests are still forwarded if a client sends them. Accepted limit: a tool wrapped
     and started before its copy is ready has tools only for that session.
   - If the real tool fails to start, exits, or its `initialize` fails or times out, the
     go-between answers queued requests with a JSON-RPC error carrying the reason, writes it
     to stderr, and exits 1.
4. While not ready, a `failed` ready file changes the `instructions`/error sentence for later
   messages; a later `ready` still starts the tool (step 3).
5. After the real tool is running, if it exits on its own, the go-between exits with its code,
   as an unwrapped tool would. If the client closes stdin at any time, the go-between ends:
   before the ready point it exits at once without ever starting the real tool (and stops
   polling the ready file); during the 3b handoff or afterwards it stops the tool (process tree
   as above), then exits.

### 5. Broken bridge warning

**Detection.** `detectWsl()` returns `{ wsl, kernel, interop, mount }`: `kernel` is the
Microsoft kernel test, `interop` the binfmt test, and `wsl` stays `kernel && interop` so every
existing caller keeps its meaning. A new `bridgeHealth()` on `WinBridge` returns `{ ok: true }`,
`{ ok: false, reason }` or `{ ok: null }` (not known yet):
- not `kernel` → `{ ok: true }` (never warns).
- `kernel && !interop` → reason "Windows interop is off in WSL, so Windows programs can't run".
- `wsl` → `winEnv.versions()` with a 15 s overall deadline; its `reason` if not ok; on the
  deadline, reason "Windows didn't answer within 15 seconds".
On a Microsoft kernel the machine runs the check in the background at startup and every 10
minutes, and caches the result; callers read the cache and never wait for a probe, except as
the approval card says.

**Where it shows.**
- Approval card: when a lead posts `approval` on Linux, the bridge result is not ok, and the
  lead's worktree has Windows tools by `.mcp.json` (a Windows `.exe` stdio entry or a marked
  entry, regardless of CLI), `warnings` gets "The Windows bridge won't work on <hostname>:
  <reason>. Builds that don't use Windows are unaffected." (beside the screen tools warning,
  same 10-warning cap). If the cache is `ok: null`, the post waits up to 15 s for the running
  probe; still unknown → no warning.
- Agent at session start: for tool-role sessions, when the cached result is `ok: false`, one
  line is added to the session's prompt file before launch: "Windows bridge: not working on
  this machine (<reason>). Don't rely on `wc.js win` until the user fixes it." `ok: null` adds
  nothing. Session start never waits on a probe.

### Validation

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
bash machine/test/windows-live.sh   # on the user's WSL2 PC only
```

New tests (fake interop, fake PowerShell, temp dirs, as the existing win tests do):

- `project-mcp-reader`: `wheelchair.windows` parsing; `[::1]`, `https:` and non-local names
  ignored with the warning; `windowsTools` true for a loaded marked HTTP tool, false for a
  marked SSE tool on Codex and for any marked tool on Pi and Kimi.
- Forward: a fake relay pipes two concurrent connections to a local echo server; one
  Windows process for both; relay refuses when the fake listener lookup says none or
  `wslrelay`; Linux port taken → entry withheld (Claude `disabledMcpjsonServers`, Codex and
  Antigravity drop it) with the warning; listener closed after the last session; mirrored
  mode makes no forward and, with no Linux listener on a loopback or wildcard bind for that
  port, withholds nothing (a listener on another address does not count); restart of the service re-claims recorded
  listeners for live sessions.
- Project tools form and save: switch shown only on WSL and for `http://localhost` /
  `http://127.0.0.1`; list kept in step with renames and deletes; Unity button fills the
  entry; other top-level keys kept.
- Unity button: on WSL fills the `uvx.exe` Linux path from the `unity-prep` request and
  reports the background fetch, or shows the install hint when it is missing; the page load
  makes no PowerShell call; elsewhere `uvx`. Prompt lines added only for sessions
  loading a Windows stdio `mcp-for-unity` entry, with the copy path and the Unity path from
  `ProjectVersion.txt` only when that `Unity.exe` exists (else the fallback sentence); the
  sandboxed Codex variant.
- `win info`: `disk` fields and each warning threshold with fake sizes, no `git_bytes`
  warning; `forwards` states.
- Ready file: `ready` only after a successful reconcile after start (not for an existing
  `.git` with readying still running); `waiting` past the 45 s wait; `failed` on failure;
  replaced by a later `win sync` success; after a service restart, a live `wrapped` session
  whose ready file is not `ready` is readied again, including one restarted during launch
  (launch record written before tmux).
- Ports: a forwarded port withholds another session's unmarked entry on the same port
  (including `[::1]`), and the reverse, with the `"used by a Linux tool"` state; a marked and
  an unmarked entry on one port in one project keep the marked one; two starts racing for
  one port with opposite meanings never both get it; an oversized Codex config whose
  withheld entry brings it under budget loads the rest, and a reservation for an entry the
  budget drops is released.
- Teardown: with an open SSE-style stream through the forward, the last session stopping
  destroys it and only then releases the `windows` reservation. Mirrored mode with a Linux
  listener on `[::1]:<port>` withholds the marked entry.
- Stop: a wrapped tool still shutting down delays the final reconcile, in `onStop` and in
  the sweep, until its file is gone; its last write is in the snapshot. A session killed
  through the handoff path has its ports and reservations released by the next sweep.
- Go-between EOF: client closing stdin before ready exits without starting the tool;
  during the handoff stops the tool and exits.
- Restart tracking: after a service restart, a withheld marked tool still shows its launch
  outcome in `win info`; a live session with `windows_tools` in the
  launch record is back in `toolSessions`, and its stop runs the final reconcile. A
  `windows` reservation is not released until its listeners have closed.
- Go-between, with a fake MCP tool: the `mcp-for-unity` entry is not wrapped; ready at start
  pipes only; ready before the client's `initialize` passes the client's own handshake
  through unchanged; not ready at start answers `initialize` (client's version, `instructions` with
  the waiting or failed sentence), swallows `notifications/initialized`, lists no tools, and
  never starts the real tool; on ready after the stand-in answered, it starts it, sends
  `initialize` then exactly one `notifications/initialized` (a client one queued during the
  handoff is dropped) before any queued request, then `list_changed`; a protocol
  version mismatch is logged and tolerated; the real tool failing its `initialize` exits 1;
  exits with the tool's code afterwards; stopping the tool ends a child process it started.
  A real-CLI check (Codex, with a fake Windows tool and a ready file that appears 20 s after
  start) shows the tool's tools appear in the session after ready. Claude gets
  `--mcp-config` with the wrapped entry and the original in `disabledMcpjsonServers`; Codex and
  Antigravity get wrapped commands.
- Detection and warnings: interop off on a Microsoft kernel gives the reason; approval card
  gets the warning only when the project has Windows tools; a probe past 15 s gives the
  timeout reason; session start never waits; non-WSL machines get none.

`machine/test/windows-live.sh` gains a localhost part: it starts, on Windows through `wc.js
win start`, a small PowerShell HTTP listener on a free `127.0.0.1` port that answers every
request with a random token the harness chose; it then starts a session whose `.mcp.json`
marks an HTTP entry on that port (written before the session starts), and checks that a
request to `http://127.0.0.1:<port>/` from WSL returns that token (proving the answer came
from Windows), and that after stopping the listener a request fails within 5 s rather than
hanging. When `WHEELCHAIR_UNITY` is set and Windows has `uvx.exe`, the Unity part also: adds the MCP
for Unity package to the fixture's `Packages/manifest.json` (the git URL from MCP for Unity's
install docs) in the harness's working copy before the copy is made, opens the Editor on the
fixture copy and waits for its window (as today), then, **before** the existing `win stop`,
runs the preset's command directly (not wrapped), sends MCP `initialize`, then
`notifications/initialized`, then `tools/list`, and checks for tools; then reads the instance
list, polling up to 120 s for an instance whose project path is the fixture copy (failing with
"set MCP for Unity's transport to Stdio in Window > MCP for Unity" if none appears); then stops the Editor as today. Otherwise it prints `Unity MCP part skipped`.

### Not doing

As IDEA.md. Also: no rewriting of URLs; no restart of HTTP tools; no automatic cleanup of
copies or git data; no IPv6-only Windows servers.


## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| In mirrored mode, a Linux server started later on a marked tool's loopback port, while the Windows tool is down, receives that live CLI's requests | Rare path: needs the opt-in mirrored mode, the Windows tool down, and a Linux server on the same port; it is the user's own service | review-round-8 |
| A go-between that crashes while its Windows tool keeps writing lets the shutdown gate pass early | Rare path: needs the go-between itself to crash mid-session | review-round-8 |
| A service restart between tmux creation and session persistence can ready a different copy in recovery | Rare path: a restart inside that launch window plus a pane directory that differs from the worktree | review-round-8 |
| An unmarked URL written with an IPv4-mapped address (`http://[::ffff:127.0.0.1]:<port>`) is not covered by port reservations and can reach a Windows forward | Rare path: unusual hand-written address form | review-round-5 |
| While the machine service is down (restart or crash), a forwarded port is unbound; a Linux process that takes it in that window can receive a live CLI's requests and headers for that tool | Rare path: needs a service restart and another Linux process binding that exact port in the gap; startup re-claims it and reports a failure | review-round-2 |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|
| C1 | MCP for Unity's stdio server lists every connected Editor with its project path, and selecting one in one agent's server does not affect another agent's | lead (D12, D15) |
| C2 | Claude accepts a `--mcp-config` server with the same name as a `.mcp.json` server listed in `disabledMcpjsonServers`, and ignores the top-level `wheelchair` key in `.mcp.json` | lead (D7, item 4) |
| C4 | Claude, Codex and Antigravity re-list a tool's tools on `notifications/tools/list_changed` from a stdio server (D17) | review-round-4 |
| C5 | MCP for Unity's Stdio transport choice holds for every project copy opened by the same Windows user | review-round-4 |
| C3 | With default WSL `localhostForwarding`, requests fail promptly while the Windows server is down and reach it once it starts, with no loop through the relay | review-round-1 |

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Unity preset never points the agent at its own copy's Editor; one port serves every Editor | upheld | D12; Spec §2 prompt lines, help text says commit the package |
| intent | minor | Ready file at launch skips the restart for an existing but stale copy | upheld | D14; ready only after a reconcile following start |
| intent | minor | `git_bytes` warning is noise; conflict-ref warning at 1 is not a limit | upheld | D11; §3 |
| intent | minor | Broken-bridge approval warning fires on projects with no Windows tools | upheld | D11; §5 gated |
| intent | minor | `.wslconfig` fallback adds a guess for little gain | upheld | D10 |
| mechanics | blocking | Unity session not bound to its copy's Editor | upheld | D12, C1 |
| mechanics | blocking | Linux port collision lets the CLI reach an unrelated Linux service with its headers | upheld | D13; §1 Port taken on Linux |
| mechanics | blocking | Go-between exits when the tool exits before ready, losing the connection | upheld | D14; §4 step 5 |
| mechanics | blocking | Restart during a pending `initialize` never completes the handshake | upheld | D14; §4 step 4 |
| mechanics | blocking | `[::1]` accepted but Windows dials 127.0.0.1; mirrored mode address families undefined | upheld | D9 |
| mechanics | major | Existing `.git` counted ready while a reconcile still runs | upheld | D14; §4 Ready file |
| mechanics | major | Machine restart drops forwards while tmux sessions survive | upheld | D13; §1 Machine service restart; ready-file restore |
| mechanics | major | Ports and readying for tools the CLI never loads (Pi, Kimi, SSE on Codex/Antigravity) | upheld | D13; "Which tools a session loads" |
| mechanics | major | Cold health probe can exceed the start budget | upheld | §5 background probe, 15 s deadline, start never waits |
| mechanics | major | Live check can pass against a Linux service | upheld | §Validation live part proves a Windows token |
| mechanics | minor | Check once built: localhostForwarding may loop the relay to itself | upheld | §1 No loop through WSL; C3 |

### Round 2 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 1:** "Which tools a session loads" (new); §1 marking limited to IPv4 http hosts, supported addresses, copy readying, `::1` listener, no-loop check, port-taken withholding, mirrored via `wslinfo` only, service-restart restore, `forwards` states; §2 help text and Unity prompt lines; §3 warnings (no `git_bytes` warning, conflict refs at 10); §4 ready file rules, go-between steps 4-7; §5 detection result `ok: null`, background probe with 15 s deadline, approval gating; Validation (new tests, live localhost part); D9-D14; Check Once Built C1-C3.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | `::1` bind failure by another Linux service still lets IPv6 clients reach it | upheld | §1 `EADDRINUSE` on `::1` withholds the entry |
| mechanics | blocking | Relay failure or service restart releases a port while CLIs keep its URL | upheld (restart window accepted-risk) | §1 listeners stay bound while used; restart gap in Accepted Risks |
| mechanics | blocking | Go-between can waste its one restart with no client handshake | upheld | §4 step 4c (ready before `initialize`), step 5 holds `initialize` |
| mechanics | blocking | Unity prompt tells sandboxed Codex to run a refused command | upheld | §2 sandboxed Codex sentence |
| mechanics | major | Ready-file recovery has no durable enrollment | upheld | §4 `win_wrapped` / `win_ready` in the session record |
| mechanics | major | Codex size budget can drop entries counted as loaded | upheld | "Which tools a session loads": from the final built config |
| mechanics | major | Shared forward gains an IPv6 need later | upheld | §1 bind `::1` before admitting; addresses recorded |
| mechanics | major | Switch-only edit skipped by the save short-cut | upheld | §1 save body `windows`, both checks compare it |
| mechanics | major | Live Unity check never claims port 8080 | upheld | §Validation Unity part runs the stdio preset; no port 8080 |
| mechanics | minor | `win info` warning prelude would break JSON stdout | upheld | §3 warnings to stderr |
| intent | major | HTTP preset fails for the whole session when Unity isn't open at agent start | user-decision | D15: stdio per agent |
| intent | minor | `<Unity.exe>` left as a placeholder | upheld | §2 filled from `ProjectVersion.txt` |
| intent | minor | Unity prompt triggered by an unmarked URL | upheld | §2 trigger is a Windows stdio `mcp-for-unity` entry |

### Round 3 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 2:** "Which tools a session loads" (from the final built config); §1 `::1` listener rules and late binding, listeners stay bound while used, save carries the Windows list, restart record holds addresses; §2 rewritten for the stdio preset (D15): button and `windows_uvx`, help text, prompt trigger and filled Unity path, sandboxed Codex sentence; §3 warnings to stderr; §4 enrollment in the session record, go-between steps 4c and 5; Validation (Unity button and prompt tests, live Unity part via the stdio preset); Accepted Risks (restart window); C1 reworded.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Unity preset wrapped by the go-between; a restart drops the Editor selection | upheld | §2, §4: `mcp-for-unity` entries not wrapped |
| intent | minor | `uvx.exe` lookup slows every Project tools page load | upheld | §2 separate request on button press, cached |
| intent | minor | First Unity start may fail while uvx downloads | upheld | §2 server fetched on Windows at button press |
| mechanics | blocking | Unity prompt's `win start` lacks the required `--` | upheld | §2 command text (machine/lib/win-args.js:35) |
| mechanics | blocking | Live Unity check can't discover the fixture Editor | upheld | §Validation adds the package and checks before stop |
| mechanics | blocking | A forward can capture another session's unmarked entry on the same port | upheld | §1 one meaning per port |
| mechanics | major | Port withholding can change Codex's budget result after the build | upheld | "Which tools a session loads" order (1)-(4) |
| mechanics | major | Ready file and session record can disagree after a restart | upheld | §4 file first, recover when either is not ready |
| mechanics | major | Restart stops only the launcher, not its child server | upheld | §4 Process tree (Job Object) |
| mechanics | major | Pre-ready branch keyed on reason text that doesn't match | upheld | §4 ready file `state` field |
| mechanics | major | `notifications/initialized` can be sent twice | upheld | §4 step 4d |

### Round 4 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 3:** "Which tools a session loads" order (1)-(4); §1 one meaning per port; §2 Unity entry not wrapped, `unity-prep` request with background fetch, help text, `win start --` syntax; §4 rewritten parts: which tools (Unity excluded), ready file `state` field, enrollment write order and recovery, process tree, go-between steps 2, 4a, 4d, 5, 7; Validation (ports, ready file, go-between tests, live Unity part).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Decision Log still says the Unity entry is wrapped | upheld | D16 |
| intent | minor | Validation names the removed `windows_uvx` field | upheld | §Validation Unity button |
| intent | minor | Validation says "rebuilds once" against a build-once order | upheld | §Validation Ports |
| intent | minor | Unity path stated without checking it exists | upheld | §2 path used only if it exists |
| intent | minor | No `forwards` state for a port held by a Linux tool | upheld | §1 `"used by a Linux tool"` |
| mechanics | blocking | Port meaning not reserved within one launch or across concurrent starts | upheld | §1 Port reservations |
| mechanics | blocking | Conflict check misses unmarked `[::1]` entries | upheld | §1 unmarked loopback includes `[::1]` |
| mechanics | blocking | Held `initialize` outlasts the CLI's start deadline | upheld | D17; §4 step 5; real-CLI check; C4 |
| mechanics | major | Candidate selection affected by Codex's aggregate budget | upheld | step (1) per entry, budget in (2) |
| mechanics | blocking | No Editor-side Stdio transport step | upheld | §2 help text; live harness waits and names the fix; C5 |
| mechanics | major | Live check skips `notifications/initialized` | upheld | §Validation |
| mechanics | blocking | Restart loses Windows tool tracking, skipping the final reconcile | upheld | §4 Windows tool tracking survives restarts |

### Round 5 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 4:** load order step (1) per entry and build-once; §1 one meaning per port and Port reservations, `[::1]` in conflicts, new `forwards` state; §2 Stdio transport step in help text, Unity path existence check; §4 Windows tool tracking survives restarts, go-between step 5 answers `initialize` itself (D17) and 4c; Validation (ports, restart tracking, go-between, real-CLI check, live Unity part); D16, D17; C4, C5.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Synthetic `initialize` leaves the replacement without `notifications/initialized` | upheld | D18; §4 step 3 sends it before queued requests |
| mechanics | blocking | A pre-ready tool that stalls in `initialize` still hits the CLI deadline | upheld | D18: real tool not started before ready |
| mechanics | major | Synthetic handshake fixes version and capabilities; real ones discarded | upheld | §4 step 3 mismatch logged; tools-only accepted limit |
| mechanics | blocking | IPv4-mapped loopback URL bypasses reservations | accepted-risk | Rare path: unusual hand-written address |
| mechanics | blocking | Reservation released while the listener stays open 60 s | upheld | §1 close at once; release after close |
| mechanics | blocking | Restart during launch loses Windows tool enrollment | upheld | §1 launch record written before tmux; §4 recovery |
| intent | minor | Stand-in tool gives no sign the copy failed | upheld | §4 step 2 `instructions` by state |
| intent | minor | Stand-in drops prompts/resources | upheld | §4 step 3 accepted limit stated |

### Round 6 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 5:** §1 listeners close at once and `windows` reservations release after close; launch record `win-sessions.json` written before tmux (replaces `win-forwards.json` and session-record flags); §4 recovery after restart, go-between rewritten (D18: real tool started only once the copy is ready; stand-in handshake with `instructions`; tools-only limit); Validation (ready file, restart tracking, go-between); D18; Accepted Risks (IPv4-mapped address). The user chose to keep going after three unclean rounds.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Failed-copy sentence doesn't say how to retry | upheld | §4 step 2 adds "Run `wc.js win sync` to retry." |
| intent | minor | Restart wording left in heading and D8 | upheld | §4 heading; D19 |
| mechanics | blocking | Handoff uses one rule for pass-through and stand-in handshakes | upheld | §4 steps 3a / 3b |
| mechanics | blocking | Mirrored mode lets a marked `localhost` URL reach a Linux `[::1]` listener | upheld | §1 Mirrored networking checks `/proc/net/tcp{,6}` |
| mechanics | major | Teardown leaves open relay sockets holding the reservation | upheld | §1 teardown destroys connections first |
| mechanics | major | Final stop reconcile can run before a wrapped tool has ended | upheld | §4 Stop waits for wrapped tools |
| mechanics | major | Launch record can't restore a withheld tool's `win info` state | downgraded (minor: display only after a restart; a worker would not need to ask) | §1 launch record stores each marked tool's port and outcome |

### Round 7 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 6:** §1 mirrored mode Linux-listener check, teardown destroys open connections before releasing, launch record stores each marked tool's port and outcome; §4 heading, failed sentence adds retry, Stop waits for wrapped tools, go-between steps 3a/3b; Validation (teardown, mirrored, stop, handshake orders); D19.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Sweep's final reconcile skips the wrapped-tool shutdown gate | upheld | §4 gate applies to `sweep()` |
| mechanics | major | Port teardown needs confirmed tmux exit and a path for sessions killed without stop | upheld | §1 release on confirmed absence; sweep releases |
| mechanics | blocking | No EOF rule before ready or during handoff | upheld | §4 step 5 |
| mechanics | major | Mirrored check catches non-loopback listeners | upheld | §1 loopback and wildcard binds only |
| intent | minor | Validation still says mirrored mode withholds nothing | upheld | §Validation Forward bullet |

### Round 8 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 7:** §1 port release on confirmed tmux absence and by the sweep; mirrored check limited to loopback and wildcard binds; §4 shutdown gate also in `sweep()`, go-between EOF rule (step 5); Validation (mirrored, stop, EOF).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Sweep can release a starting session's ports before tmux exists | upheld | §1 sweep skips `startingNames` |
| mechanics | blocking | Mirrored mode: a later Linux server takes the port | accepted-risk | Rare path |
| mechanics | blocking | Dead go-between pid doesn't prove the Windows job ended | accepted-risk | Rare path: go-between crash |
| mechanics | blocking | Two sessions on one copy stopping together reconcile before the other's tool ends | upheld | §4 stop gate is copy-wide |
| mechanics | blocking | Rare path: restart between tmux and persistence readies another copy | accepted-risk | Rare path (self-labelled) |
| intent | minor | Older "when the session stops" wording left in §1 | upheld | §1 points to the confirmed-gone rule |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
