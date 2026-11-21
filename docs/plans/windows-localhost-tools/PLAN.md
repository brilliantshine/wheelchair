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
| D11 | The relay's refusal reasons are kept per forward and checked once at claim time; a problem becomes a session warning the user sees with other project tools warnings, but the tool is still given (its server may start later) | IDEA: user can see why; refusing at start would break tools started after the session | review-round-1 |
| D12 | Windows warnings are stored per session apart from the per-CLI lines and shown on the thread's project tools card as start-time snapshots | Per-CLI lines are recomputed by other starts and would erase them | review-round-2 |
| D13 | The relay connects first and then identifies the owner of that exact accepted connection; no owner cache | Names the listener the dial really reached (dual-stack `::` servers included), no stale-cache window | review-round-3 |
| D14 | Windows warnings are pruned at the next start in the thread for sessions no longer live, independent of forwards; release never updates the hub | The thread card only updates from starts; keeps all-withheld sessions covered | review-round-3 |
| D15 | Forwards are not tied to sessions: once created, a forward stays open until the machine service stops (its relay ends after 5 idle minutes and restarts on demand); the user sees each Windows tool's live status on the Project tools page instead of thread warnings. Supersedes D7's release rule, D11, D12 and D14 | User chose to simplify after three unclean review rounds; idle private ports cost nothing | user |
| D10 | The Windows relay refuses a connection when no Windows process accepted it or the accepting process is `wslrelay` (mechanism superseded by D13) | Stops a Linux program on the same port receiving the headers through WSL localhostForwarding (parent C3) | defaulted |

## Spec

Builds on main as of `87923e58` (Windows bridge solid merged). Line references are to that
tree. Read `MAP.md` and `docs/maps/project-tools.md`, `docs/maps/windows-bridge-runtime.md`,
`docs/maps/machine-session-lifecycle.md` first.

### Terms

- **Marked tool:** an entry of `.mcp.json` `mcpServers` named in the top-level
  `"wheelchair": {"windows": [...]}` list (D4) that is *eligible*: `type` is `http`, its `url`
  parses with `new URL()`, the scheme is `http:` and the hostname is `localhost` or
  `127.0.0.1`. Path, query and fragment may be anything. Its **tool port** is the URL's port,
  or 80 when none is given. The reader (section 1) and the form (section 7) use this same rule,
  in one shared function.
- **Forward:** for one tool port, a Linux TCP listener on `127.0.0.1:<private port>` in the
  machine service plus one Windows relay process, piping each accepted connection to Windows
  `127.0.0.1:<tool port>`.
- **On WSL:** `this.win.detected.kernel` is true (`machine/lib/win-env.js:8-29`), whether
  or not interop is on. Interop being off only means getting a forward fails (section 4), so marked tools
  are withheld; it never lets a marked tool load with its original URL (D8).

### 1. Reading the mark

`readProjectMcp` (`machine/lib/project-mcp.js:85`) also returns `mcp.windows`: the eligible
marked names, in list order, de-duplicated. A listed name that is in `mcpServers` but not
eligible is left out with a warning, recorded like other project tools warnings:
- `sse` entry: `<tool>: "Runs on Windows" doesn't apply to SSE tools; it loads as usual`.
- any other ineligible entry: `<tool>: "Runs on Windows" only applies to an http://localhost
  or http://127.0.0.1 address`.
- unknown name: ignored silently (a rename the user hasn't saved yet).
A missing `wheelchair` key, or a `wheelchair` object without `windows`, means no marks (no
warning). A `wheelchair` value that is not an object, or `windows` present but not an array of
strings, is ignored
with one warning `"wheelchair" in .mcp.json is not in the expected form; ignored`. Unknown
keys under `wheelchair` are ignored. Validation of the rest of the document is unchanged.
Off WSL, `mcp.windows` is computed but unused (D9): no forwards, no withholding, and none of
the warnings in this section.

### 2. Which tools a session forwards

In `startIn` (`machine/service.js:832`), on WSL only:
1. Build the session's config once as today (`commandFor`, `:847`) to learn `loaded`.
2. The session's **forwarded tools** are the loaded entries whose name is in `mcp.windows`.
   Kimi loads none, so it forwards none.
3. For each forwarded tool, get its forward (section 4) and its private port, before tmux
   starts. A tool whose forward cannot be had is withheld (section 3).
4. Build the config again, passing `context.windowsUrls`: `{<name>: <rewritten URL>}` for each
   tool with a forward. The rewritten URL is the tool's URL with host `127.0.0.1` and port the
   private port; scheme, path, query and fragment unchanged. Headers are unchanged.
5. Use the second build from here on (`loaded`, warnings, settings, tool files). Store on the
   session record `windows_tools: [{name, tool_port}]` for the forwarded tools the second
   build loads (persisted with the session in `sessions.json`, used by `win info`).

A forward obtained for a tool the second build then does not load (for example Codex skipping
all project tools because the overrides grew too large) is left as is: forwards are not owned
by sessions (D15). If the session forwards nothing, steps 3-5 are skipped and startIn behaves
exactly as today. `windowsTools` (copy readying for Windows stdio programs) is unchanged: a
forwarded HTTP tool needs no worktree copy.

### 3. Putting the rewritten URL in each CLI's config (D2, D5, D8)

- **Claude:** for each forwarded or withheld tool, add its name to `disabledMcpjsonServers`.
  For forwarded tools, write `<stateDir>/mcp-config/<session>.json` (atomic, mode 0600, since
  headers may carry keys) as `{"mcpServers": {<name>: {"type": "http", "url": <rewritten>,
  "headers": <as in .mcp.json, if any>}}}` and add `--mcp-config <that path>` to argv. Stale
  files are removed by the existing stale-file sweep pattern (`sweepAgyTools`,
  `service.js:477-535`: no matching live session, older than 60 s).
- **Codex:** `codexOverrides` (`machine/adapters/codex.js:52-100`) uses the rewritten URL for
  forwarded tools and omits withheld ones.
- **Antigravity:** `machine/adapters/agy.js:39-43` uses the rewritten URL; withheld tools are
  omitted.
- **Withheld:** a marked loaded tool without a forward is not given to the CLI in any form, and
  a line is printed to the session log (stderr, as other project tools warnings are):
  `<tool>: couldn't reach Windows (<reason>); left out of this session`. Reasons: `Windows
  bridge not available`, `couldn't open a local port`. The user sees the same reason as the
  tool's status on the Project tools page (section 6).
- `loaded` reports withheld tools as not loaded.

### 4. Forwards (D15)

Kept in a new module `machine/lib/win-forward.js`, owned by `WinBridge`.

- **Table:** tool port → `{private_port, state, listener, sockets, relay, last_refusal}`.
  `state` is `ok` or `failed` (section 5).
- **Get(tool port):** if an `ok` forward for that port exists, return its private port. A
  `failed` forward is never returned; getting its tool port creates a new forward, which
  replaces it in the table and the record. To create one, check the relay can run:
  `this.win.detected.interop` is true and the `powershell.exe` path from `createWinEnv`
  (`machine/lib/win-env.js:54`) exists. This is not `bridgeHealth()`, which also depends on Git
  and starts unknown. If not, fail with `Windows bridge not available`. Then `net.createServer`
  and listen on `127.0.0.1` port 0 (the kernel picks a free port); a listen error fails with
  `couldn't open a local port`. Concurrent gets for the same tool port share one pending
  creation (never two listeners for one tool port). A new forward is written to the record
  (section 5), and that write has finished, before the get returns, so before any tmux that
  uses it starts.
- **Lifetime:** a forward, once created, stays open until the machine service stops. It is not
  tied to sessions and nothing closes it while the service runs. On service stop, listeners
  close, open sockets are destroyed and relays end.
- **Connections:** each accepted socket is relayed (below). The listener only accepts on
  `127.0.0.1`.
- **Relay:** one `powershell.exe` per forward, started with `spawnPs`
  (`machine/lib/win-env.js:57-61`) running a script shipped in the repo
  (`machine/lib/win-relay.ps1`, embedded by reading the file, never written at run time),
  started on demand (a connection or a status check). It multiplexes all connections for the
  forward over its stdin/stdout with binary frames `[type:1][conn:4][len:4][payload]`, types
  `open`, `data`, `close`, `refused`, `check`, `check-result`. A new connection never starts a
  new Windows process while the relay runs. The machine ends a relay (close stdin, kill after
  5 s) once it has had no open connections and no pending check for 5 minutes; the next
  connection or check starts it again.
  - On `open`, the relay **connects first, then identifies who accepted** (D13): it connects to
    `127.0.0.1:<tool port>` (a connect refused outright → `refused`, `nothing on Windows is
    listening on port <n>`; any other connect failure → `refused`, `Windows refused the
    connection`), and sends nothing yet. It then looks up the accepting end of that exact
    connection: `Get-NetTCPConnection -LocalPort <tool port> -RemotePort <relay's own local
    port> -RemoteAddress 127.0.0.1` → `OwningProcess` → process name. This names whatever
    listener the dial really reached, whatever address it is bound to (`127.0.0.1`, `0.0.0.0`,
    dual-stack `::`). An owner named `wslrelay` → close and `refused`, `port <n> on Windows leads
    back to Linux`. An owner that cannot be established (no row, lookup error, process gone) →
    close and `refused`, `couldn't check who holds port <n> on Windows` (fail closed). Only
    then is any data passed. No caching: the check is per connection.
  - `check` runs the same steps, closes the connection without sending data, and answers
    `check-result` with the reason `refused` would carry, or none.
  - The forward keeps the latest `refused` reason as `last_refusal` `{reason, at}`; a
    connection the relay passes clears it.
  - `refused` or `close` closes the Linux socket; a Linux socket closing sends `close`.
  - If the relay exits unexpectedly, open sockets are destroyed and the next connection or
    check starts it again, at most once per 10 s; inside that limit connections are accepted
    and closed at once, and the exit reason is kept as `relay_error` for status.
  - IPv4 only on Windows: the relay always dials `127.0.0.1` (parent D9).

### 5. Record and restarts

- **Record:** `<stateDir>/win/forwards.json`, mode 0600, `{"forwards": [{tool_port,
  private_port}]}`, rewritten (atomic, `atomicWrite`, `service.js:110-115`) whenever a forward
  is created or replaced. Writes are serialized through one in-process queue; each write
  snapshots the table when it runs, so the last write holds the latest state.
- **Machine service restart:** tmux sessions and their CLIs survive a restart and still hold
  private URLs. In `WinBridge.startup` (`service.js:447`), read `forwards.json` and, for each
  entry, listen on `127.0.0.1:<recorded private port>` again as an `ok` forward. A port that can
  no longer be bound becomes a `failed` forward (reason `port in use on Linux`) shown in status
  (section 6); the next get for its tool port replaces it. A missing or unreadable file means
  no forwards to restore. No tmux state is consulted.

### 6. Visibility

- **Project tools page status (D15).** New machine route `POST /v1/project-tools/windows-status`
  (hub-authorized like `/v1/project-tools/read`, `service.js:2084`), reached from the page via
  the viewer's pass-through (`viewer/app/routes.js:68-73`: add `windows-status` to the allowed
  list). Body `{machine, path, token, tools: [{name, url}]}`. On a WSL machine, for each tool
  whose URL is eligible (shared rule), the machine gets its forward (section 4) and runs one
  `check`, all in parallel, each capped at 10 s. Reply `{wsl, status: {<name>: {state, reason?}}}`
  with `state` one of `reachable`, `unreachable` (reason from `check-result`, or `couldn't
  check Windows for port <n>` on timeout) or `unavailable` (reason from a failed get, or the
  forward's `failed` reason). Off WSL: `{wsl: false, status: {}}`.
- In `viewer/pages/project-tools.js`, each entry whose **Runs on Windows** switch is on shows a
  status line under the switch: "Checking…", then "Reachable on Windows", or "Not reachable:
  <reason>" / "Not available: <reason>". The page requests it after load for the marks in the
  loaded file, again for one entry when its switch is turned on or its URL changes (debounced
  500 ms), and on a **Check again** button. It sends the form's current values, saved or not.
- **`win info`.** `WinBridge.info(session)` (`win.js:373-381`) adds `forwards`: one item per
  entry of the calling session's `windows_tools` (section 2), each `{tool, tool_port,
  private_port, state, reason?, last_refusal?, relay_error?}` from the forward currently in the
  table for that tool port (`state` `failed` with its reason if none is `ok`). No other
  session's data. The same list is included in `win info`'s fallback reply when the Windows
  copy lookup fails (`win.js:391` onward): forwarding does not depend on the copy.
- No thread cards or per-session warning state are added.

### 7. Project tools page

- The read reply (`machine/lib/project-tools.js:71-88`, passed through at
  `service.js:2084-2087`) gains `wsl: true|false` from `win.detected.kernel`, and the tools list
  carries each entry's mark (`windows: [names]` read from `wheelchair.windows`).
- In `viewer/pages/project-tools.js`, a "Web address" entry shows a **Runs on Windows** switch
  when the read reply has `wsl: true` and the URL is eligible by the shared rule in Terms
  (so `http://localhost:8080/mcp` shows it). Help text: "Turn on if this tool's server runs on Windows. Agents
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
frames and dialling a local test server (these cover the Linux side and the frames only):
- `readProjectMcp`: eligible (including a URL with a path and query), SSE, non-localhost and
  malformed `wheelchair` cases and their warnings; `wheelchair: {}` and
  `wheelchair: {"other": 1}` give no warning; off WSL nothing forwards and no mark warnings;
  WSL kernel with interop off withholds marked tools.
- Claude settings/argv: marked tool in `disabledMcpjsonServers`, `--mcp-config` file contents
  and mode 0600; Codex and Antigravity rewritten URLs; withheld tools absent from all three
  and never present with the original URL.
- Two sessions with tools on one tool port get the same private port and one listener; the
  listener stays open after both sessions stop.
- Two concurrent starts on different tool ports: both forwards are in `forwards.json`; the
  record is written before tmux starts.
- Restart: forwards restored on their recorded private ports; a taken port gives a `failed`
  forward, and the next get for that tool port gets a new private port and replaces the record
  entry.
- Relay frames: `refused` closes the socket and sets `last_refusal`; a passed connection clears
  it; relay death restarts at most once per 10 s; an idle relay ends after 5 minutes and the
  next connection restarts it.
- `windows-status`: reachable, each unreachable reason, timeout, unavailable (interop off;
  `failed` forward), off WSL; passes through the viewer route.
- `win info` lists one item per tool in `windows_tools` (two tools on one port give two items),
  also after a restart; the fallback reply (copy lookup failing) includes `forwards`.
- Project tools page: switch shown only on WSL and for eligible URLs; dirty on switch change
  alone; rename/delete update the list; save keeps other keys; status line states and Check
  again (browser test).

The shipped relay script itself is tested by `machine/test/win-relay-live.test.js`, which runs
`machine/lib/win-relay.ps1` through the real `powershell.exe` and skips (reporting "skipped:
not WSL") when interop is unavailable. Using Windows-side listeners it starts itself with
PowerShell (`[System.Net.Sockets.TcpListener]`), it checks: a listener on `127.0.0.1`, on
`0.0.0.0` and dual-stack `::` each pass data; no listener gives `nothing on Windows is
listening`; and a Linux listener reached through WSL localhostForwarding (a Node server on the
tool port in WSL, no Windows listener) is refused as `leads back to Linux` (skip that case when
localhostForwarding is off). Run it on this WSL machine before verification:
`node --test machine/test/win-relay-live.test.js`.

Live (Check Once Built): on this WSL machine in default networking, a Windows HTTP MCP server
on `127.0.0.1:<port>`, marked, used from Claude, Codex and Antigravity sessions.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| (No longer applies after D15: no release.) The 60 s sweep's tmux snapshot can predate a start that registered and left `startingNames` during an `await`, releasing that live session's forward | Rare path: sub-second race between the sweep and a start finishing | review-round-2 |
| (No longer applies after D15: no release.) A start cancelled after tmux was created but before the session is registered releases its forwards in `start()`'s `finally` even if the tmux kill did not take | Rare path: needs a cancel inside that window and a failed kill | review-round-1 |
| While the machine service is down (restart or crash), a forward's private port is unbound; a Linux program that binds that exact port in the gap gets a live CLI's requests and headers | Rare path: needs a service restart and another program taking a kernel-picked port within seconds; startup reports it `failed` on the Project tools page | planning |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|
| C1 | Live on WSL default networking: a Windows HTTP MCP server on `127.0.0.1:<port>`, marked, is callable from Claude, Codex and Antigravity sessions | planning |
| C2 | With the Windows server stopped and a Linux listener on the tool port, connections are refused (no loop, nothing reaches the Linux listener), and work again once the Windows server starts | planning |
| C3 | Mirrored networking: same as C1 and C2 | planning |

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since the last round:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Relay refusals (no Windows server, wslrelay) are invisible to the user; `win info` is agent-facing | upheld | §4 refusal reasons kept, claim-time check → session warning; §6; D11 |
| intent | minor | `win info` lists other sessions' names and forwards | upheld | §6 only the caller's forwards, no names |
| intent | minor | Off WSL, mark warnings are noise | upheld | §1 no mark warnings off WSL |
| mechanics | blocking | A restored `failed` forward is reused by new claims, pointing them at the Linux holder | upheld | §4 failed forwards never reused; §5 list record |
| mechanics | blocking | WSL with interop off takes the off-WSL path and loads marked tools with original URLs | upheld | Terms "On WSL" = kernel; §7 switch on kernel |
| mechanics | blocking | Second Codex build can drop all tools while claims stay held | upheld | §2 step 6 reconcile before recording |
| mechanics | blocking | Concurrent `forwards.json` writes can lose a claim | upheld | §5 serialized writes, start waits for its write |
| mechanics | blocking | Restart with tmux state unknown undefined | upheld | §5 restore all when `liveTmux()` is null |
| mechanics | blocking | Rare path: cancel after tmux created releases forwards without confirmed absence | accepted-risk | Accepted Risks (rare path) |
| mechanics | major | Claim check uses `bridgeHealth()` (Git-dependent, starts null) | upheld | §4 relay readiness = interop + powershell.exe present |
| mechanics | major | Refusals leave `win info` showing `ok` | upheld | §4 `last_refusal`, §6 (with intent finding 1) |
| mechanics | major | Switch URL rule could match only bare origins | upheld | Terms shared eligibility rule; §7; tests |
| mechanics | minor | §1 intro contradicts silent unknown names | upheld | §1 intro reworded |

### Round 2 — 2026-11-21

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** Terms (shared eligibility rule incl. paths; "On WSL" = WSL kernel,
interop separate); §1 intro and off-WSL warnings; §2 step 6 reconcile claims after the second
build; §4 claim reuses only active forwards, relay readiness check (interop + powershell.exe),
refusal reasons and `last_refusal`, claim-time `check` frame and warning; §5 list-shaped
record, serialized writes, start waits for its write, sweep covers cancelled starts, restart
with tmux unknown, failed forwards; §6 `info` scoped to the caller; §7 switch on kernel and
shared rule; Validation additions; D11; Accepted Risks (cancel window).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Sweep/restore compare names without tmux's `.`→`_` rewrite | downgraded (minor) | Generated names are `wc-<hex>-<role>[-n]`, no dots; still specified: §5 tmux-aware matching |
| mechanics | blocking | Owner lookup is port-wide; must pick the listener a 127.0.0.1 dial reaches and fail closed | upheld | §4 `127.0.0.1` row, else `0.0.0.0`; unknown owner refused |
| mechanics | major | Reconcile by tool drops shared-port claims | upheld | §2 step 6 by tool port |
| mechanics | major | Windows warnings erased by other CLIs' recomputation | upheld | §6 separate `windows` lines per session; D12 |
| mechanics | major | `win info` tool names for aliases and after restart | upheld | §5 record `tools` per session; §6 one item per tool |
| mechanics | major | `win info` fallback reply omits forwards | upheld | §6 |
| mechanics | major | `check` semantics undefined (owner only vs connect) | upheld | §4 check runs owner lookup and a connect |
| mechanics | major | Rare path: sweep's stale tmux snapshot races a finishing start | accepted-risk | Accepted Risks (rare path) |
| intent | major | Windows warnings can vanish before the user sees them | upheld | Same fix as mechanics finding 4 (§6, D12) |
| intent | minor | Claim-time warning stays after the server starts | upheld | §4 wording "when this session started"; §6 snapshot |

### Round 3 — 2026-11-21

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** §2 step 6 reconcile by tool port; §4 owner row choice
(`127.0.0.1`, else `0.0.0.0`) and fail-closed lookup, new refusal reason, `check` runs owner
lookup plus connect, Windows warnings wording; §5 record holds `tools` per session,
tmux-aware name matching; §6 one `info` item per tool, fallback reply includes forwards,
Windows warnings stored per session apart from per-CLI lines (D12); Validation additions;
Accepted Risks (sweep snapshot race).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Release deletes Windows warnings but the hub card never updates | upheld | §6 warnings pruned at next start, release touches nothing (D14) |
| mechanics | blocking | All-withheld session has warnings but no forward record, never cleaned | upheld | §6 cleanup independent of forwards (D14) |
| mechanics | blocking | Rare path: positive owner cache can pass a Linux listener | declined | No longer applies: §4 now checks per connection with no cache (D13) |
| mechanics | major | Shared-port test expects a dropped alias in `win info` | upheld | Validation split into two cases |
| mechanics | major | Owner selection tested only against a Node stand-in | upheld | Validation: live `win-relay-live.test.js` with real powershell.exe |
| mechanics | minor | `wheelchair` without `windows` warns | upheld | §1 absent = no marks |
| intent | blocking | Dual-stack `::` Windows servers refused | upheld | §4 connect then identify accepting owner (D13) |
| intent | major | Check warnings may miss the start reply's `project_tools` | upheld | §4 start waits for checks before `updateProjectTools` |
| intent | minor | Released session's warning stays on card; viewer drops `windows` | upheld | §6 snapshot semantics; viewer carries `windows` |

### Round 4 — 2026-11-21

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** The user chose to simplify (D15). §2 no per-session claims or
reconcile; `windows_tools` on the session record. §3 withheld tools go to the session log
only; `--mcp-config` file cleanup by the stale-file sweep. §4 rewritten: forwards not tied to
sessions, stay open until the service stops, relay ends after 5 idle minutes and restarts on
demand, `check` frame, refusal reasons. §5 rewritten: record is `{tool_port, private_port}`,
restart restores all recorded forwards without consulting tmux. §6 rewritten: Project tools
page status via new `windows-status` route; `win info` from `windows_tools`; no thread
warnings. Validation rewritten to match. Superseded Accepted Risks marked.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
