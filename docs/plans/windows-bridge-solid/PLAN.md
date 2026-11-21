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

## Spec

Background: the bridge as built is described in `docs/maps/windows-bridge-runtime.md` and
`MAP.md`. "WSL machine" means `detectWsl()` reports a Microsoft kernel (see item 5 for the
widened detection). Nothing in this Spec changes behaviour on a machine that is not WSL;
every new code path returns early there, and the non-WSL tests keep passing unchanged.

### 1. Windows localhost tools (HTTP and SSE)

**Marking.** `.mcp.json` may carry a top-level `"wheelchair": {"windows": ["<name>", ...]}`
(D6, D7). A name counts only if it names an `http` or `sse` entry in `mcpServers` whose URL
parses and whose host is `localhost`, `127.0.0.1` or `[::1]`; other names are ignored with a
project tools warning `<tool>: "Runs on Windows" only applies to a localhost address`. Unknown
keys under `wheelchair` are ignored. `readProjectMcp` returns the valid list as
`mcp.windowsHttp` (array of names); `checkDocumentText` still accepts any other top-level key.
`hasWindowsProgram` returns true also when `mcp.windowsHttp` is non-empty, so these tools
trigger copy readying like a Windows `.exe` stdio tool.

**Project tools form** (`viewer/pages/project-tools.js`, saved through
`machine/lib/project-tools.js`): HTTP entries get a "Runs on Windows" switch, shown only when
the machine reports WSL and the URL host is one of the three above. Saving writes or removes the
tool's name in `wheelchair.windows`, removes the `wheelchair` key when the list empties and it
has no other keys, and keeps every other top-level key as today. Renaming or deleting a tool
updates the list. SSE stays not editable in the form (as today) but a hand-written SSE entry
listed in `wheelchair.windows` is honoured.

**Forward.** On a WSL machine whose networking mode is not mirrored, the machine keeps one
forward per distinct port named by a marked tool of any live tool-role session (the URL is
not rewritten: the agent CLI connects to `127.0.0.1:<port>` in WSL as written):

- Linux side: a TCP listener on `127.0.0.1:<port>` in the machine service (and on `::1` when
  the URL used `[::1]`).
- Windows side: one long-lived relay process per port, started through interop
  (`createWinEnv`'s PowerShell or a script shipped in the repo and run by `powershell.exe`),
  which multiplexes all connections for that port over its stdin/stdout with simple framing
  (connection id, open, data, close) and connects each to Windows `127.0.0.1:<port>`. A new
  connection must not spawn a new Windows process.
- If the Windows side refuses a connection, the Linux side closes that connection; the relay
  stays up. If the relay process dies, the next connection restarts it once; a second death
  within 60 s closes the listener and records the reason.
- Started before the agent CLI is launched (in `startIn`, before tmux), kept while any live
  session uses that port, closed within 60 s of the last such session stopping or its thread
  archiving.
- If the Linux port is already taken by another process, no forward is made for it and the
  project tools warning `<tool>: port <port> is in use on Linux, so it can't reach Windows`
  is recorded and printed to the session log, as other project tools warnings are.

**Mirrored networking.** Mode is read with `wslinfo --networking-mode` when that command
exists (output `mirrored` means mirrored); otherwise from `networkingMode` in the `[wsl2]`
section of the Windows user's `.wslconfig`; anything unreadable counts as not mirrored. In
mirrored mode no forward is made; localhost already reaches Windows.

**Per CLI.** URLs pass through unchanged, so Claude (file-loaded), Codex (HTTP override) and
Antigravity (plugin) need no change. SSE is still skipped on Codex and Antigravity as today.

`win info` gains `forwards: [{ tool, port, state: "up" | "port in use" | "failed: <reason>" | "mirrored" }]`
for this session's marked tools.

### 2. MCP for Unity preset

The Project tools form gets an "Add MCP for Unity" button (shown on every machine; the
switch part only on WSL). It adds an entry named `unity` (`unity-2`, ... if taken):
`{"type": "http", "url": "http://localhost:8080/mcp"}`, with "Runs on Windows" on when the
machine is WSL. The user edits or saves it like any entry; the button only fills the form.
Help text under it: "Install the MCP for Unity package in your Unity project, then start its
server from Window > MCP for Unity. The port must match the one shown there." The preset
links to `https://coplaydev.github.io/unity-mcp/getting-started/install`.

`README.md`'s Windows bridge section gets a short "Unity" paragraph saying the same.

### 3. Disk report

`win info` gains a `disk` object:

| Field | Meaning |
|---|---|
| `copies` | `[{ path, bytes }]`, one per Windows copy of this thread (`%LOCALAPPDATA%/Wheelchair/copies/<thread>/*`) |
| `copies_bytes` | Sum of `copies` |
| `git_bytes` | Size of the repository's common `.git` (`git count-objects -v`: `size` + `size-pack`, in bytes) |
| `conflict_refs` | Count of refs under `refs/wheelchair/conflicts/` in that repository |
| `windows_free_bytes` | Free space on the drive holding `%LOCALAPPDATA%` |
| `measured_at` | ISO time of the copy measurement, or null while the first one runs |
| `warnings` | Plain sentences, see below |

Copy sizes are measured on the Windows side (one PowerShell walk per copy), cached per
thread, and refreshed in the background when older than 10 minutes; `win info` never waits
for a copy walk. The git count, ref count and free space are read on every call (fast).
A failed measurement leaves the last value and adds `disk.reason`.

Warnings (D3): `copies_bytes` over 20 GB → "This thread's Windows copies use <n> GB."; `git_bytes`
over 10 GB → "The repository's git data uses <n> GB; `git gc` may shrink it."; `conflict_refs`
over 0 → "<n> kept conflict snapshots; see README to remove them."; `windows_free_bytes` under
10 GB → "Only <n> GB free on the Windows drive." Nothing is ever deleted. `wc.js win info`'s
printed output shows the warnings first.

### 4. Restarting Windows stdio tools after the copy is ready

**Which tools.** On a WSL machine, for tool roles, every stdio entry whose command
`isWindowsProgram` is launched through a go-between: `machine/lib/win-tool-proxy.js`, run as
`<node> <proxy> --ready-file <path> -- <command> <args...>`, where `<node>` is
`process.execPath`. HTTP tools are never wrapped (their server is not started by the CLI).

**Per CLI.**
- Codex and Antigravity: their translated entries get the wrapped command and args. The
  Codex env passthrough of `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV` stays.
- Claude loads `.mcp.json` itself, so its Windows stdio entries are added to
  `disabledMcpjsonServers` and given instead, wrapped and under the same names, in a
  per-session file passed with `--mcp-config` (in `<stateDir>/settings/`, mode 0600).
- Pi loads no project tools; unchanged.

**Ready file.** The machine writes `<stateDir>/win-ready/<session name>` (mode 0600) when
that session's copy is ready: at launch if the copy already exists and its readying has no
error, otherwise when the readying task finishes without error. The file is removed when the
session stops. Its content is the time it became ready.

**Go-between behaviour.**
1. Starts the real tool at once and pipes stdin/stdout both ways; stderr passes through.
2. Remembers the client's `initialize` request and `notifications/initialized` (JSON-RPC
   lines).
3. If the ready file already existed when it started, it only pipes and never restarts.
4. Otherwise it watches for the ready file (poll every 2 s is fine). When it appears: stop the
   real tool (end its process; if it has not exited after 5 s, kill it), answer every request
   the client sent that has no response yet with a JSON-RPC error (`code -32000`, message
   "Windows tool restarted because its project copy became ready; try again"), start the tool
   again, replay `initialize` and `notifications/initialized`, drop the replayed `initialize`
   response, then send the client `notifications/tools/list_changed`, and resume piping.
5. Restarts at most once. If the real tool exits on its own, the go-between exits with its
   code, as an unwrapped tool would.
6. If the client closes stdin, the go-between ends the real tool and exits.

### 5. Broken bridge warning

**Detection.** `detectWsl()` returns `{ wsl, kernel, interop, mount }`: `kernel` is the
Microsoft kernel test, `interop` the binfmt test, and `wsl` stays `kernel && interop` so every
existing caller keeps its meaning. A new `bridgeHealth()` on `WinBridge` returns
`{ ok: true }` or `{ ok: false, reason }`:
- `kernel && !interop` → reason "Windows interop is off in WSL, so Windows programs can't run".
- `wsl` → `winEnv.versions()`; its `reason` if not ok.
- not `kernel` → `{ ok: true }` (never warns).
Results are cached for 60 s.

**Where it shows.**
- Approval card: when a lead posts `approval` on Linux, if `bridgeHealth()` is not ok,
  `warnings` gets "The Windows bridge won't work on <hostname>: <reason>. Builds that don't
  use Windows are unaffected." (beside the screen tools warning, same 10-warning cap).
- Agent at session start: for tool-role sessions, when not ok, one line is added to the
  session's prompt file before launch: "Windows bridge: not working on this machine
  (<reason>). Don't rely on `wc.js win` until the user fixes it." It is checked within the
  existing start, never adding more than the 60 s cached check's single PowerShell call.

### Validation

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
bash machine/test/windows-live.sh   # on the user's WSL2 PC only
```

New tests (fake interop, fake PowerShell, temp dirs, as the existing win tests do):

- `project-mcp-reader`: `wheelchair.windows` parsing, non-localhost names ignored with the
  warning, `hasWindowsProgram` true for a marked HTTP tool.
- Forward: a fake relay pipes two concurrent connections to a local echo server; one
  Windows process for both; port-in-use warning; listener closed after the last session;
  mirrored mode makes no forward.
- Project tools form and save: switch shown only on WSL and for localhost; list kept in step
  with renames and deletes; Unity button fills the entry; other top-level keys kept.
- `win info`: `disk` fields and each warning threshold with fake sizes; `forwards`.
- Go-between: with a fake MCP tool, no restart when ready at start; restart on ready with
  pending request answered by the error, `initialize` replayed, `list_changed` sent; exits
  with the tool's code; Claude gets `--mcp-config` with the wrapped entry and the original
  in `disabledMcpjsonServers`; Codex and Antigravity get wrapped commands.
- Detection and warnings: interop off on a Microsoft kernel gives the reason; approval card
  gets the warning; non-WSL machines get none.

`machine/test/windows-live.sh` gains, when `WHEELCHAIR_UNITY` is set and an MCP for Unity
server answers on Windows `localhost:8080`: a request through the forward to `/mcp`
returns an HTTP response (any status). Otherwise it prints `Unity MCP part skipped`.

### Not doing

As IDEA.md. Also: no rewriting of URLs; no restart of HTTP tools; no automatic cleanup of
copies or git data.


## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
