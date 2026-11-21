---
slug: win-tool-gobetween
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Windows tools that start before their copy is ready

**Idea:** `IDEA.md` — read it first. Mode: two-part. Map: `MAP.md` and
`docs/maps/windows-stdio-gobetween.md`.

Origin: split from `docs/plans/windows-bridge-solid/PLAN.md` (branch merged in PR #149). Its
last full design for this part is Spec item 3 in `5950541c^:docs/plans/windows-bridge-solid/PLAN.md`
(lines 166-296), with decisions D8, D14, D16-D19, D21 there. This plan carries that design
forward; the parent's launch record (`win-sessions.json`) and copy-wide shutdown gate were
never built (MAP.md).

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | Design depends on CLIs re-listing tools on `notifications/tools/list_changed` (parent C4, never checked) | Live test of installed `claude` and `codex` | yes | Claude re-lists; Codex does not → Q2 |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode two-part | User's choice; the parent's review stalled on rare cleanup cases | user |
| D2 | Carry forward the parent's go-between design (parent D18/D19): the real Windows tool is never started before the copy is ready; the go-between answers the handshake, lists no tools, then starts the tool and sends `tools/list_changed` | Reviewed over eleven rounds in the parent; holding `initialize` outlasts Codex's ~10 s start deadline | adopted |
| D3 | The MCP for Unity entry (args include `mcp-for-unity`) is not wrapped (parent D16) | It never reads the copy, and a late start would drop the agent's Editor selection | adopted |
| D4 | Share one per-session entry-replacement map with the "Windows localhost tools from WSL" thread (`wc/a1a1b7d6016d`): `context.replaceEntries = {name: entry}`, applied by the Claude, Codex and Antigravity adapters; Claude gets replaced names in `disabledMcpjsonServers` and one per-session `--mcp-config` file holding every replaced entry. Whichever thread builds first adds it; the other reuses it | Both change the same adapters the same way; one path avoids conflicts | user |
| D5 | Codex never re-lists tools after start (W1), so the go-between remembers each tool's last tool list and the stand-in advertises it at once; a call before the copy is ready waits for it (bounded) and then goes to the real tool. With nothing remembered yet the stand-in lists no tools; `list_changed` is still sent for CLIs that use it | User's choice; only option that makes Codex work in nearly every session without slowing its start | user |
| D6 | `replaceEntries[name] = null` withholds an entry entirely (Claude: disabled, not in `--mcp-config`) | Asked by the localhost thread's lead for its withheld tools; costs nothing here | defaulted |
| D7 | Keep the 45 s pre-launch wait for sessions whose Windows tools are all wrapped | It still supplies the copy path and prompt lines, and IDEA asks only for today's speed | review-round-1 |
| D8 | Wrapped tools keep interop's working directory (`wslpath -w` of the Linux cwd) rather than switching to the copy | Same behaviour as an unwrapped tool today; tools find the copy through `WHEELCHAIR_WINDOWS_PROJECT` | review-round-2 |

## Spec

Background: `docs/maps/windows-stdio-gobetween.md` (how adapters build MCP config, how
readying runs, how stop/sweep/archive work). "WSL machine" means `detectWsl()` reports WSL.
Nothing here changes behaviour off WSL or for non-tool roles: every new path returns early
there, and existing non-WSL tests pass unchanged.

### 1. Which tools are wrapped

On a WSL machine, for tool roles, every **loaded** stdio entry (no `type` or `type: "stdio"`)
whose original `.mcp.json` command is `isWindowsProgram` (`machine/lib/project-programs.js:16`)
is launched through the go-between `machine/lib/win-tool-proxy.js`, except an entry whose
args include `mcp-for-unity` (D3), which stays as today. HTTP/SSE entries are never wrapped.

The wrapped entry's command is `process.execPath` and its args are
`[<abs path to win-tool-proxy.js>, '--ready-file', <ready file>, '--tools-dir', <tools dir>,
'--list-cache', <cache file>, '--name', <entry name>, '--', <original command>,
...<original args>]`. The entry's `env` and `cwd` (if any) are kept unchanged.

**What environment reaches the real Windows tool.** Exactly what WSL interop would pass to the
unwrapped tool today, and never `WHEELCHAIR_SESSION_TOKEN`: the variables named in the
go-between's `WSLENV` (with their WSLENV flags), plus `WHEELCHAIR_WINDOWS_PROJECT`. The
go-between sets `WHEELCHAIR_WINDOWS_PROJECT` from the ready file's `copy` field (item 3) and
adds it to `WSLENV` if missing, so the tool gets the copy path even when the launch-time
environment lookup timed out (`machine/service.js:893-899`). The launcher is spawned with
`interopEnv` (`machine/lib/win-env.js:31`), which removes the token, and its explicit
environment list is filtered the same way `win-apps.js:254` does.

"Loaded" means present in the adapter's final configuration for this session (after its skip
rules and Codex's override size budget). Each adapter's build returns
`loaded: [{ name, windows, wrapped }]`, where `windows` is `isWindowsProgram` of the
original command (not the emitted Node command) and `wrapped` says whether this item wrapped
it. `windowsTools` in `startIn` (`machine/service.js:848-849`) keeps its meaning: any loaded
entry with `windows` true. Pi and Kimi return an empty list.

### 2. Per CLI, through the shared replacement map (D4)

The service fills `context.replaceEntries = { <name>: <wrapped entry> }` before building the
adapter command. This is the same contract the "Windows localhost tools from WSL" thread
writes down as "Shared contract (D17)" in `docs/plans/windows-localhost-tools/PLAN.md` §3
(branch `wc/a1a1b7d6016d`); if the two texts ever differ, the code already on `main` wins. If `main` already has this map when building starts (the "Windows localhost
tools from WSL" thread merged first), reuse it and only add entries; otherwise add it here:

- `replaceEntries[name] = null` means "withhold this entry": it is given to the CLI in no
  form (Claude: disabled, not in `--mcp-config`; Codex/Antigravity: omitted; not in
  `loaded`). Needed by the localhost thread; this plan never sets null (D6).
- Codex (`machine/adapters/codex.js`) and Antigravity (`machine/adapters/agy.js`): a name in
  `replaceEntries` is translated from the replacement entry instead of the `.mcp.json` one,
  through the same translation code, so env handling and Codex's size budget apply as today.
  Codex's `WHEELCHAIR_WINDOWS_PROJECT`/`WSLENV` passthrough (`codex.js:81-86`) is decided from
  the **original** `.mcp.json` command, not the replacement's Node command, so wrapped
  Windows entries keep it.
- Claude (`machine/adapters/claude.js`): replaced names are added to
  `disabledMcpjsonServers` and given, under the same names, in one per-session JSON file
  `{ "mcpServers": { ... } }` holding every replaced entry, written to
  `<stateDir>/settings/<session name>.mcp.json` (mode 0600, atomic) and passed with
  `--mcp-config <path>`. No `--strict-mcp-config`. The file is removed when the session stops.
- **Stale files:** the existing Antigravity tool-file sweep (`sweepAgyTools`,
  `machine/service.js:477`, same live-tmux and `startingNames` rules) also removes
  `<stateDir>/settings/<name>.mcp.json` and `<stateDir>/win-ready/<name>` for sessions not
  live and not starting, and `<stateDir>/win-tools/<name>/` once none of its pids is alive.
- Pi and Kimi: unchanged.

### 3. Ready file

Path `<stateDir>/win-ready/<session name>` (directory 0700, file 0600, written atomically by
write-then-rename), JSON `{"state": "ready" | "waiting" | "failed", "reason": "...", "copy": "<Windows path of
the copy>", "at": "<iso>"}`; `reason` only with `failed`, `copy` only with `ready`. Written by `WinBridge` for sessions with at least one
wrapped entry:

- `waiting` before tmux starts, and kept while the session's readying task runs, including
  past the 45 s launch wait.
- `ready` only after a reconcile of that session's copy (create + sync) **finishes
  successfully after the session's start began**: the session's own readying task, a shared
  readying task it awaited, or any later successful `win sync`/`run`/`start` sync of that
  copy. An existing `.git` alone never counts. So a stale copy counts as not ready until the
  first reconcile after start finishes.
- `failed` when the readying task fails; a later successful sync replaces it with `ready`.
- Removed when the session stops (stop path, after the wait in item 6).
- **Failed or cancelled start:** every path where `startIn` gives up after the ready file or
  the Claude `--mcp-config` file was written (`die`, cancelled start, tmux failure) removes
  both. Writes are tied to the start attempt: `WinBridge` records a per-attempt token when it
  writes `waiting`, and a later readying result writes the file only if that session name is
  still starting or registered with the same token. A late result for a dead attempt writes
  nothing.

The go-between branches on `state` only, never on `reason` text. A missing or unreadable file
counts as `waiting`.

### 4. Go-between behaviour

The go-between reads newline-delimited JSON-RPC from the client (stdin) and, once started,
from the real tool (its stdout). Lines that are not valid JSON are passed through unchanged
when piping and ignored by the stand-in. It polls the ready file every 2 s until it first
reads `ready`.

**Remembered tool list (D5).** The cache file is
`<stateDir>/win-tool-lists/<sha256 hex of JSON [git common dir of the worktree, entry name,
original command, original args]>.json` (directory 0700, file 0600, atomic), holding
`{"tools": [...], "at": "<iso>"}`. Whenever the real tool answers a client `tools/list`
request that had no `cursor` with a result that has no `nextCursor`, the go-between writes
that `tools` array to the cache (it tracks outstanding client request ids and their methods to
match responses). Paginated lists are not cached. A missing or unparseable cache means "no
remembered list". In addition, right after every start of the real tool has finished its
handshake (step 1, 3a or 3b), the go-between sends the real tool its own `tools/list` request
(id `"wc-go-between-list-<random uuid>"`, generated per probe), caches the result as above and does not pass
the response to the client; so a client that never lists again (Codex) still leaves a list for
the next session. The service computes the path; the go-between only reads and writes it.

1. **Ready at start** (ready file says `ready`): start the real tool at once and pipe
   stdin/stdout both ways (stderr passes through), updating the cache as above, until either
   side ends (step 5).
2. **Not ready at start:** do not start the real tool. Answer the client itself (the
   "stand-in"):
   - `initialize` → at once, a successful result with the client's requested
     `protocolVersion`, `capabilities` `{ "tools": { "listChanged": true } }`, `serverInfo`
     `{ "name": "<entry name>", "version": "0" }` and `instructions` saying the state:
     "Waiting for the Windows project copy to be ready; this tool's tools work once it is." or,
     when the ready file says `failed`, "The Windows project copy couldn't be readied:
     <reason>. Run `wc.js win sync` to retry."
   - `notifications/initialized` and other client notifications → swallowed.
   - `tools/list` → the remembered list, or an empty list if none.
   - `ping` → an empty result.
   - `tools/call` → held (not answered) until the handoff (step 3) forwards it to the real
     tool. Deadline: if a client `tools/call` has not been **forwarded** to the real tool within
     50 s of its arrival (held before ready, or queued during the 3b handoff while the real
     tool's `initialize` is pending: the same per-call rule in both phases),
     answer it with JSON-RPC error `code -32000` ("The Windows project copy is not ready yet;
     try again shortly.") and drop it, so it is never forwarded later. If the ready file says
     `failed`, answer every held call at once with the `failed` sentence.
   - `notifications/cancelled` naming a held or queued request id → drop that request; it is
     never forwarded and gets no answer.
   - any other request → JSON-RPC error `code -32000` with the `instructions` sentence.
3. **When the ready file first says `ready`:**
   - **3a. The client has not sent `initialize` yet:** start the real tool and pipe as in
     step 1. Nothing synthetic, no `list_changed`.
   - **3b. The stand-in already answered `initialize`:** queue every new client message;
     start the real tool; send it the client's original `initialize` params; wait up to 60 s
     for a successful response (not passed to the client); send the real tool exactly one
     `notifications/initialized` (every client `notifications/initialized`, including queued
     ones, is dropped); send the still-held `tools/call` requests and then the queue, in
     arrival order, with their original ids; send the client
     `notifications/tools/list_changed`; from then on pipe as in step 1. The real tool's
     answers to forwarded requests go to the client unchanged.
     - A `protocolVersion` different from the one the stand-in answered is logged to stderr;
       carry on.
     - Only tools are exposed in this case: other capabilities are not advertised (the client
       already has its `initialize` result); their requests are still forwarded.
     - If the real tool fails to start, exits, or its `initialize` fails or times out: answer
       every held or queued request with JSON-RPC error `-32000` carrying the reason, write it
       to stderr, and exit 1.
4. While not ready, a ready file that says `failed` changes the sentence for later answers;
   a later `ready` still starts the tool (step 3).
5. Once the real tool runs, if it exits on its own the go-between exits with its exit code.
   If the client closes stdin, **or the go-between receives SIGHUP, SIGTERM or SIGINT** (a
   normal stop kills tmux, which signals it): before the ready point, exit 0 at once without
   starting the tool; during the handoff or afterwards, stop the tool (item 5), remove its
   tools-dir entry, then exit. The signal handlers stay installed until then, so a second
   signal does not cut the stop short.

### 5. Process tree

The go-between starts the real tool so that ending it ends every Windows process it started:
through a PowerShell launcher (spawned with `winEnv.spawnPs` from `machine/lib/win-env.js`,
like `win-apps.js`) that creates a **named** Job Object with kill-on-close, assigns itself, and
starts the tool as `machine/lib/win-apps.js:59-84` does, with these differences:

- **Job name.** The go-between picks `id = "tool-" + <random uuid>`; the job is named
  `wheelchair-<id>`, the same `wheelchair-` prefix `terminateScript(id)` (`win-apps.js:94`)
  adds, so the go-between passes `id`, never the full name.
- **Program and directory in Windows form.** The program is the original command translated
  with `winEnv.translate(command, true)` (`win-env.js:95`; every wrapped command is under the
  mount, item 1). The args are passed unchanged, as WSL interop does today. The working
  directory is the effective Linux working directory (the entry's `cwd` if set, else the
  go-between's own cwd) converted with `wslpath -w`, which is what interop gives the unwrapped
  tool today (a `\\wsl.localhost\...` path for a Linux directory).
- **Stdio.** The tool's stdin, stdout and stderr are the launcher's own (not redirected to a
  log). The launcher writes nothing to stdout. Right after the job exists and the tool has
  started, it writes the line `wc-tool-started` to stderr; the go-between removes that line
  from the stderr it passes through and treats it as the start acknowledgment.
- The launcher exits when the tool and all its descendants have ended, as the app wrapper
  does.

**Stop the tool** (one total budget of 12 s from the moment stopping begins):
1. Close the tool's stdin.
2. If the start acknowledgment has not arrived, wait for it or for the launcher to exit. If
   the launcher exits first, stopping is done.
3. Run `terminateScript(id)` through `winEnv.ps` with `timeoutMs` set to what is left of the
   budget minus 2 s; this ends every process in the job.
4. Wait for the launcher to exit and its pipes to close, within what is left of the budget.
   If the budget runs out at any step, write that to stderr and exit anyway.

### 6. Normal stop waits for the session's own tools

While its real tool runs, a go-between keeps a file `<tools dir>/<go-between pid>`, where
`<tools dir>` is `<stateDir>/win-tools/<session name>/` (created when it starts the real tool,
removed after the job has closed and the pipes are shut). `WinBridge.onStop` for that session,
after tmux is killed and before its final stop reconcile, polls until the directory is empty
or absent (every 250 ms, up to 15 s, which is longer than the go-between's 12 s stop budget; an entry whose pid is not alive is removed). A timeout is
logged and the reconcile goes ahead. Only the stopping session's own directory is checked
(other sessions on the same copy: Deferred 2). The directory is removed after the wait.

`WinBridge.sweep()` does not reconcile a copy while a stop task for a session on that copy is
in progress (an entry in `stopTasks` whose worktree key matches, as `win.js:264` already finds
for archive); the next sweep tries again.

### 7. Marking the copy used

Already built: `WinBridge.afterLaunch` marks the copy used after tmux starts and again when a
late readying task finishes (`machine/lib/win.js:145-150`). Keep it; it must still run for
sessions whose only Windows tools are wrapped.

### Validation

Tests use fake Windows programs and a fake ready file, as the existing win tests do; no real
Windows needed.

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
```

New tests in `machine/test/` must cover:
- Wrapping: a loaded Windows stdio entry is wrapped for Claude (disabled + `--mcp-config`
  file), Codex (override command/args) and Antigravity (plugin config); the Unity entry, HTTP
  entries, Linux stdio entries and non-WSL machines are not; `loaded` reports `windows` and
  `wrapped` correctly; Codex's budget dropping entries still applies.
- Ready file: `waiting` before launch; `ready` only after a reconcile finishing after start
  (not for a pre-existing `.git`); `failed` then `ready` on a later sync; removed on stop.
- Go-between, against a fake MCP server script: ready at start (pure pipe); 3a; 3b with and
  without a remembered list (initialize answered, `tools/list` returns the remembered or empty
  list, a held `tools/call` is answered by the real tool after ready, one
  `notifications/initialized` reaches the real tool, `list_changed` sent once); the 50 s held
  call timeout (with the wait made configurable for the test); `failed` sentence; real tool
  `initialize` failure; stdin close before and after ready; cache written only for
  unpaginated lists.
- Stop: `onStop` waits for a live entry in the session's tools dir, removes dead-pid entries,
  and times out after 15 s (shortened in the test); `sweep()` skips a copy with a stop task in
  progress.
- Go-between: SIGTERM/SIGHUP while the real tool runs stops it (termination script called,
  tools-dir entry removed before exit); own `tools/list` after handshake fills the cache and is
  not passed to the client; a held call past 50 s, including one waiting on the real tool's
  `initialize`, is answered and never forwarded; a cancelled held call is never forwarded.
- Environment: the launcher's environment has no `WHEELCHAIR_SESSION_TOKEN`; the real tool gets
  `WHEELCHAIR_WINDOWS_PROJECT` from the ready file when the launch env lacked it; Codex keeps
  the `WHEELCHAIR_WINDOWS_PROJECT`/`WSLENV` passthrough for wrapped entries.
- Failed start: a cancelled or failed start removes the ready file and Claude config file, and a
  late readying result for it writes nothing.
- Launcher: the program is the Windows form of the command and the directory the `wslpath -w`
  form; the job name passed to `terminateScript` is `tool-<uuid>`; a stop before the start
  acknowledgment waits for it and then terminates; the stop fits in 12 s with a slow
  termination script.
- Shared map: `replaceEntries[name] = null` omits the entry for Codex and Antigravity and only
  disables it for Claude, and leaves it out of `loaded`.
- Stale files: the sweep removes ready, Claude config and empty tools dirs of dead sessions but
  not of starting ones.

Live check once built (needs a WSL machine with a Windows stdio MCP server and a fresh copy):
start a Claude agent and a Codex agent before the copy is ready; Claude's tools appear after
ready; Codex shows the remembered list (or none on first ever use) and a call made before
ready returns the real tool's answer once ready.

### Not doing

As IDEA.md. Also the two items in Deferred.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | After a machine service restart, keep tracking sessions with Windows tools and re-ready wrapped sessions whose ready file is not `ready` (parent's `win-sessions.json` launch record) | Needs a service restart during a live session; today's restart recovery already reconstructs from live sessions and copies (`machine/lib/win.js:339-358`) | planning | Parent Spec item 3 "Launch record" and "Recovery after a service restart" |
| 2 | Stop, the periodic sweep and archive wait for every session sharing a copy, including sessions that ended without a normal stop (CLI crash, handoff kill) | Normal stop of the session itself is covered by Spec 6; the rest needs a sibling or crashed session with a tool still writing | planning | Parent Spec item 3 "Stop waits for wrapped tools" (copy-wide gate, sweep, `archiveCheck` pending) |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A start cancelled in the sub-second window after tmux spawned, where the CLI already started a wrapped tool that is writing, ends without waiting for that tool (the kill-and-throw path never calls `onStop`) | Rare path: needs a cancel inside that window plus a tool already writing to the copy | review-round-2 |
| A go-between that crashes while its Windows tool keeps writing lets the stop wait pass early | Rare path: needs the go-between itself to crash mid-session (parent review-round-8) | adopted |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|
| C1 | Antigravity re-lists a stdio server's tools on `notifications/tools/list_changed` (not installed on the planning machine). If it does not, it behaves like Codex: remembered list only | lead (W1) |
| C3 | With the copy ready at start, a wrapped tool answers the CLI's `initialize` well within Codex's ~10 s start deadline despite the PowerShell launcher's start-up and `Add-Type` compile. If it comes close, fall back to always answering `initialize` from the stand-in (remembered list) and handing off through step 3b | review-round-2 |
| C2 | Codex's default MCP tool-call timeout is longer than the 50 s pre-ready call wait (Spec 4), so a waiting call ends with the go-between's answer, not a Codex timeout | lead (D5) |

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Cache only filled by a client `tools/list`; Codex never lists after handoff, so it stays empty | upheld | Spec 4: go-between's own `tools/list` after every handshake |
| mechanics | blocking | Sweep can reconcile while a normal stop is still waiting for the tool | upheld | Spec 6: sweep skips copies with a stop task in progress |
| mechanics | major | No control path for the go-between to close the Windows job | upheld | Spec 5: named job + `terminateScript` |
| mechanics | major | Copy path missing when ready arrives after the launch budget; Codex passthrough sees the Node command | upheld | Spec 1 env, Spec 3 `copy`, Spec 2 passthrough on original command |
| mechanics | major | Launcher's explicit env could carry the session token | upheld | Spec 1: interop-equivalent env, token removed |
| mechanics | major | Held-call deadline across handoff; cancellation ignored | upheld | Spec 4: 50 s until forwarded; `notifications/cancelled` drops |
| mechanics | major | Failed/cancelled start leaves ready and Claude config files; late readying writes stale state | upheld | Spec 3: cleanup on failed start, per-attempt token |
| intent | major | Codex passthrough skipped for wrapped entries | upheld | Same fix as row 4 |
| intent | major | tmux kill signals the go-between; default exit skips stopping the tool | upheld | Spec 4 step 5: SIGHUP/SIGTERM/SIGINT stop the tool first |
| intent | minor | Drop the 45 s wait for wrapped-only sessions | declined | Not a defect: the wait still supplies the copy path and prompt lines; IDEA asks only for today's speed (D7) |

### Round 2 — 2026-11-21

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round 1:** Spec 1 environment rules (interop-equivalent, no token, copy path
from ready file); Spec 2 `null` withholds (D6) and Codex passthrough on the original command;
Spec 3 `copy` field, failed/cancelled start cleanup and per-attempt token; Spec 4 own
`tools/list` after handshake, held-call 50 s deadline until forwarded, `notifications/cancelled`,
signal handling in step 5; Spec 5 named job and `terminateScript` stop path; Spec 6 sweep skips
copies with a stop in progress; Validation additions; D6, D7.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Launcher gets the WSL path, no working directory rule | upheld | Spec 5: `translate` program, `wslpath -w` cwd (D8) |
| mechanics | blocking | `terminateScript` adds `wheelchair-` itself; full name would open the wrong job | upheld | Spec 5: pass `tool-<uuid>` |
| mechanics | major | Stop during launcher start-up can miss the job | upheld | Spec 5: `wc-tool-started` acknowledgment, stop waits for it |
| mechanics | major | Stop budgets conflict (60 s `ps`, 5 s, 15 s) | upheld | Spec 5: one 12 s budget; Spec 6: 15 s wait exceeds it |
| mechanics | major | Cancelled start after tmux spawn skips the tool wait | accepted-risk | Rare path: sub-second window plus a writing tool; Accepted Risks |
| mechanics | major | Calls queued during handoff escape the 50 s deadline | upheld | Spec 4: per-call rule in both phases |
| mechanics | major | Probe id could collide with a client id | downgraded (minor) | Clients would have to pick that exact string; fixed anyway with a per-probe uuid |
| intent | minor | Launcher start-up may approach Codex's 10 s deadline | check-once-built | C3 |
| intent | minor | `null` withhold path untested | upheld | Validation: shared-map test |

### Round 3 — 2026-11-21

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round 2:** Spec 2 cites the localhost thread's shared contract and adds the
stale-file sweep; Spec 4 per-probe uuid id and per-call 50 s rule during handoff; Spec 5
rewritten (job id, Windows program and directory, start acknowledgment, 12 s stop budget);
Spec 6 wait vs budget; Validation additions; D8; new Accepted Risk (cancel after tmux spawn);
C3.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
