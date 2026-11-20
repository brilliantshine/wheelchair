---
slug: windows-bridge
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# A bridge from Wheelchair in WSL to the Windows side of the same PC

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | Machine service runs as a systemd user service | Whether WSL interop works from it | no | Settled: `win info` probes interop and reports the reason when it fails; README setup step; live script checks it (D15, D20) |
| W2 | Codex screen apps run sandboxed | Whether Codex's sandbox blocks interop | no | Settled: all bridge commands run in the machine service, outside any agent sandbox (D11). Codex-launched Windows MCP servers go to Check Once Built |
| W3 | Per-thread Unity Editors | Mapping a Windows MCP server to the thread's Editor | yes (Q3) | Settled by D8 and D12 |
| W4 | Image cards need a Linux path | Windows screenshots | no | Settled: screenshots are written to a Linux path (Spec) |
| W5 | Windows copies accumulate | Cleanup | no | Settled: D14; anything more is Deferred |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode two-part | User's pick | user |
| D2 | Build for WSL on the same Windows PC; a separate Linux computer is out of scope | User's pick; recorded in IDEA.md Not doing | user |
| D3 | Sync around each Windows step, not live: Linux edits copied to the Windows copy right before any bridge command, Windows changes copied back right after, plus an explicit sync command | User's pick; live two-way sync left out | user |
| D4 | What syncs is what git would see: tracked files plus untracked files git does not ignore; deletions sync too. Ignored files (Unity's `Library/`, `Temp/`) live only on the Windows side | Keeps caches on Windows and never pollutes the thread's worktree | defaulted |
| D5 | A file changed on both sides since the last sync: the Linux version wins, the Windows version is saved to a conflicts folder beside the copy, and the command's result names each conflict | Agent edits are the source of truth; nothing is lost silently | defaulted |
| D6 | Each session's Windows copy lives at `%LOCALAPPDATA%\Wheelchair\copies\<thread-id>\<session-name>` | Fast local drive, per session so workers and verifiers do not collide | defaulted |
| D7 | Windows apps open on the user's desktop. Agents may list their windows and screenshot them, but never send mouse or keyboard input; they drive apps through the apps' own tools (MCP, command-line modes) | User's pick: never take over the user's PC | user |
| D8 | No specific Unity MCP: build a general hook, where each session's tools are told its own Windows copy's path | User's pick (none chosen yet) | user |
| D9 | Agents use the bridge through `wc.js win <op>`, a new top-level group beside `wc.js screen` | Same pattern as screens; `windows` is already a screen op name | defaulted |
| D10 | Lead, sub-lead, worker and verifier may use it; reviewer and mapper get 403 | Matches project tools roles; reviewer and mapper are read-only | defaulted |
| D11 | Every Windows action runs in the machine service through WSL interop, never in the agent's shell | One place to own lifecycle, sync and cleanup; no agent sandbox in the way | defaulted |
| D12 | Windows-side tools in `.mcp.json` are ordinary stdio entries whose `command` is a Windows program; the session environment carries `WHEELCHAIR_WINDOWS_PROJECT` and lists it in `WSLENV` so Windows programs see it | Works with every provider's existing stdio support; no new `.mcp.json` fields | defaulted |
| D13 | Available on every WSL machine in every project, no opt-in. On a machine that is not WSL every `win` op returns 422 | No setup per project | defaulted |
| D14 | Copies stay until the thread is archived (so Unity's cache survives); archive deletes the thread's copies folder | Re-importing a Unity project is slow | defaulted |
| D15 | Long jobs: `run` waits at most 9 minutes (fits an agent's 10-minute tool limit); longer work uses `start` plus `status`, which reports the exit code | Unity test runs can be long | defaulted |
| D16 | Windows-side change detection lists the copy from Windows in one PowerShell call (path, size, last-write time), never by stat-ing each file over `/mnt/c` | Unity projects have thousands of files; `/mnt/c` is slow | defaulted |
| D17 | HTTP and SSE Windows-side tools, vendor glue for a specific Unity MCP, warm-starting a copy from another copy's cache, disk caps and a cap on open apps are Deferred | Two-part mode: normal use works without them | defaulted |
| D18 | Agents are told about `wc.js win` in worker.md and verifier.md (sub-lead and lead read the same section through those docs only when briefing) | Same place the screen commands are documented | defaulted |
| D19 | No installer change: the bridge needs nothing installed on Windows; README "On Windows" gains a setup and check section | IDEA: setup is a one-time step, written down plainly | defaulted |
| D20 | A live check script `machine/test/windows-live.sh` exercises the real bridge on a WSL machine; it exits 77 (skipped) elsewhere | The build machine is not WSL; fakes cover CI | defaulted |
| D21 | Supersedes D6's per-session key: a Windows copy belongs to a worktree, at `%LOCALAPPDATA%\Wheelchair\copies\<thread-id>\<worktree-key>`, where `<worktree-key>` is the first 12 hex characters of the SHA-256 of the worktree's absolute Linux path. Sessions sharing a worktree (lead and sub-lead; a replacement worker) share its copy, manifest and warm cache | Every worker and verifier is a new session; per-session copies would always start cold, and two copies could pull into one worktree | review-round-1 |
| D22 | A newly created copy is first seeded on the Windows side with the ignored files (such as Unity's `Library/`) of the thread's most recently synced other copy, then pushed as usual. Pulls Deferred #3 into the Spec | Verifiers get a fresh worktree each; without seeding every one waits through a full Unity import | review-round-1 |
| D23 | The supported way to reach a Windows-side tool is to run its MCP server on Windows as a stdio entry launched through interop; it then reaches its app (such as the Unity Editor) over Windows' own localhost, so no networking settings change. HTTP and SSE servers on Windows stay Deferred #1 | Meets IDEA's "without hand-editing networking settings" for any tool with a stdio server, which both known Unity MCPs offer | review-round-1 |
| D24 | On a machine that is not WSL, `.mcp.json` stdio entries whose command is a Windows program are left out of the session's project tools and are not reported as missing programs | IDEA: machines without WSL are unaffected; a committed `.mcp.json` may carry Windows entries | review-round-1 |

## Spec

### What it is

On a machine where Wheelchair runs inside WSL2, agents get `wc.js win <op>`: a bridge to the
Windows side of the same PC. Each session gets its own Windows copy of its worktree, kept in
step around every bridge command, and can run Windows programs, start Windows apps, list and
screenshot their windows, and stop them. Windows-side MCP tools reach the session's copy
through an environment variable. Nothing changes on Linux machines without WSL or on Macs.

### Detection and availability (D13)

- The machine is WSL when `/proc/sys/fs/binfmt_misc/WSLInterop` (or `WSLInterop-late`)
  exists and `/proc/sys/kernel/osrelease` contains `microsoft` (case-insensitive). Decided
  once at service start.
- PowerShell is found at `<mount>/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`,
  where `<mount>` is the `[automount] root` from `/etc/wsl.conf`, default `/mnt`. Every
  Windows action is a `powershell.exe -NoProfile -NonInteractive -EncodedCommand <base64>`
  child of the machine service (D11), with a timeout.
- Not WSL: every `win` op returns 422 `the Windows bridge only works when Wheelchair runs in WSL`.
- WSL but PowerShell missing or failing to start: 422 naming what failed, including the
  hint `check that interop is enabled in /etc/wsl.conf`.

### Commands (D9, D10)

Route `POST /v1/agent/win`, session-token auth like `/v1/agent/screen`
(`machine/service.js:2044`), body `{op, args}`. `wc.js win <op> [args]` builds it in
`viewer/app/wc.js` like `screenRequest`. Reviewer and mapper sessions get 403. A stopped,
archived or not-running session gets 409. Bad arguments 400. Anything else that fails 422.
Ops act only on the caller's own session; no op takes a session or thread argument.

| Op | Args | Does | Returns |
|---|---|---|---|
| `info` | none | Probes PowerShell; does not create the copy | `{wsl, ok, reason?, copy_windows, copy_linux}` |
| `sync` | none | Both sync directions (below) | `{pushed, pulled, deleted, conflicts}` |
| `run` | `[--timeout <s>] [--env K=V]... -- <program> [args...]` | Push, run in the copy, wait, pull | `{exit_code, timed_out, output, log, sync}` |
| `start` | `[--env K=V]... -- <program> [args...]` | Push, start without waiting | `{id, pid, log, sync}` |
| `status` | `[<id>]` | Running or exited, with exit code; pulls once when it sees an exit | `{apps: [{id, program, running, exit_code, log}]}` |
| `windows` | none | Top-level visible windows of this session's started apps and their child processes | `{windows: [{handle, title, pid, app_id, minimized}]}` |
| `shot` | `<handle>` | Screenshot one of those windows | `{path}`: a Linux PNG path |
| `stop` | `[<id>]` | Kill an app's process tree (all apps if no id), then pull | `{stopped, sync}` |
| `path` | `<path>` | Translate a Linux path to Windows or back (`wslpath -w` / `-u`) | `{path}` |

- `program` is a Windows program name resolved by PowerShell on the Windows PATH, or a full
  Windows path. Working directory is the session's copy. `--env` sets variables for that
  program only. `WHEELCHAIR_SESSION_TOKEN` is never passed to Windows.
- `run`: default timeout 540 s, maximum 540 s (D15); on timeout the process tree is killed,
  `timed_out: true`, and the pull still happens. `output` is the last 64 KiB of combined
  stdout and stderr; the full output is in `log`, a Linux file under
  `<stateDir>/win/<session>/logs/`. Programs started by `run` and `start` get no console window.
- `start` returns once the process exists; its output goes to its log. At most 4 started
  apps per session at once; a fifth gets 422.
- `windows` and `shot` only see windows owned by processes this session started (or their
  descendants). Any other handle gets 400.
- `shot` uses `PrintWindow` with `PW_RENDERFULLCONTENT` so GPU-drawn windows capture; it never
  focuses, moves or restores a window. A minimized window gets 422 `window is minimized`. The
  PNG is written to `<stateDir>/win/<session>/shots/<n>.png` (keep the newest 50), so it can be
  posted with an `image` card.
- No op sends mouse or keyboard input (D7).

### The Windows copy and sync (D3–D6, D14, D16)

- Copy path: `%LOCALAPPDATA%\Wheelchair\copies\<thread-id>\<worktree-key>` (D21), reached
  from Linux through the mount. One copy per worktree: sessions sharing a worktree share its
  copy. Created on the first `sync`, `run` or `start` from that worktree.
- **Seeding (D22):** when a copy is created and the thread has another copy, the one whose
  last sync is newest gives its ignored files: one Windows-side `robocopy` of every path that
  is not in that copy's manifest (so only ignored files) into the new copy, before the first
  push. With no other copy, the new copy starts empty.
- A manifest per copy at `<stateDir>/win/copies/<worktree-key>/manifest.json` records, for every synced
  path, size, Linux mtime, Windows last-write time and SHA-256 at the last sync.
- **Synced set:** paths git would see in the worktree (`git ls-files --cached --others
  --exclude-standard`) plus, on the Windows side, new paths that `git check-ignore --stdin`
  (run in the worktree) does not ignore. `.git` is never synced. Ignored paths on Windows are
  never read, copied or deleted.
- **Push (before run, start, sync):** for each synced Linux path that is new or differs from
  the manifest, copy it to the copy; delete in the copy each manifest path gone from Linux.
- **Pull (after run, after an observed exit, stop, sync):** list the copy from Windows in one
  PowerShell call (D16); every non-ignored path that is new or whose size or last-write time
  differs from the manifest is copied back to the worktree; manifest paths missing in the copy
  are deleted in the worktree.
- **Conflict:** a path changed on both sides since the last sync keeps the Linux file; the
  Windows file is moved to `%LOCALAPPDATA%\Wheelchair\conflicts\<thread-id>\<worktree-key>\<path>`
  and listed in `conflicts` (D5).
- All sync and `win` ops on one copy are serialized, across every session sharing it. Line endings and file modes
  are copied byte for byte; no conversion. A symlink in the worktree is copied as the file it
  points to if that is inside the worktree, otherwise skipped and listed in a `skipped` field.
- Copies are kept when a session ends. Archiving a thread stops its apps and deletes
  `copies\<thread-id>` and `conflicts\<thread-id>` (D14), alongside the existing archive
  cleanup (`machine/service.js:1188`).

### Lifecycle

- When a session is killed or ends (`machine/service.js:1085`), its started apps' process
  trees are killed; no pull happens.
- On service start, any Windows process recorded as started by a session that is not live
  is killed (records kept in `<stateDir>/win/apps.json`).

### Windows-side tools (D8, D12)

- On WSL machines, every session's tmux environment gets `WHEELCHAIR_WINDOWS_PROJECT` set to
  its copy's Windows path. The value is already a Windows path, so `WSLENV` gains `WHEELCHAIR_WINDOWS_PROJECT` (appended to any
  existing value with `:`). Not set on other machines.
- The supported route for a Windows-side tool (D23): its MCP server runs on Windows as a
  stdio entry, so it reaches its app over Windows' own localhost. Example for a tool on the
  Windows PATH: `"command": "/mnt/c/Windows/System32/cmd.exe", "args": ["/c", "<tool>"]`.
- A `.mcp.json` stdio entry whose `command` is a Windows program (an absolute `/mnt/<drive>/...`
  path ending in `.exe`, `.cmd` or `.bat`) is launched by the agent's CLI through interop as
  today. The project-programs check (`machine/lib/project-programs.js`) treats such a path as
  found when the file exists, regardless of the execute bit.
- On a machine that is not WSL, such entries are left out of the session's project tools
  and not reported as missing (D24); `cmd.exe` and `powershell.exe` paths count as Windows
  programs too.
- Such a tool may be used before the copy exists; README tells projects to have the agent run
  `wc.js win sync` first.

### Agent instructions (D18)

Add to `protocol/app/worker.md` and `protocol/app/verifier.md`, next to the screen paragraph:
on a WSL machine, use `wc.js win` to run or look at things on Windows; your Windows copy is
synced around each command; run `win sync` before using a Windows-side tool; Windows apps
appear on the user's desktop, so never leave them running and never try to type into them;
use `win stop` when done. Unity tests: `win run -- <Unity.exe path> -batchmode -runTests
-projectPath <copy> -testResults <copy>\results.xml` with no Editor open on that copy (Unity
refuses a second instance on one project). A verifier reports a `win` 422 for "not WSL" as
COULD NOT TRY. The first Unity open in a thread imports the whole project and can outlast
`run`'s limit: use `win start` and poll `win status` for it.

### Setup (D19)

README "On Windows" gains: interop must be on (`[interop] enabled=true`, the default); check
with `node <wheelchair>/viewer/app/wc.js win info` from a thread; Windows-side tools use full
`/mnt/c/...` paths; `WHEELCHAIR_WINDOWS_PROJECT` names the session's copy. `machine/API.md`
documents `/v1/agent/win`; `machine/AGENTS.md` lists the new files.

### Not in this build

Live syncing, mouse or keyboard input, a separate Linux computer, native Windows, and the
Deferred rows.

### Validation

```bash
bash machine/test/run.sh                 # new machine/test/win*.test.js with a fake powershell.exe and fake /proc and mount roots
node --test viewer/test/*.test.js        # wc.js win argument building
bash machine/test/windows-live.sh        # on a WSL machine only; exit 77 elsewhere (D20)
```

The tests must cover: non-WSL 422; reviewer and mapper 403; push of new, changed and deleted
files; pull of new, changed and deleted files; ignored files never copied either way; a
conflict keeps Linux and moves the Windows file; `run` timeout kills and still pulls; `run`
output cap and log; `start` limit of 4; `windows`/`shot` refuse handles of other processes;
session end kills apps; a second session on the same worktree shares the copy; a new copy is
seeded with another copy's ignored files only; Windows-program `.mcp.json` entries dropped
without warnings on non-WSL; archive deletes the thread's copies; `WHEELCHAIR_WINDOWS_PROJECT` and
`WSLENV` set only on WSL; the token never reaches a Windows program's environment.
`windows-live.sh` runs on real WSL: `info` ok, `sync` round trip, `run -- cmd.exe /c echo hi`,
`start -- notepad.exe`, `windows`, `shot` produces a PNG, `stop`.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Windows-side tools that use HTTP or SSE on Windows `localhost` | Stdio tools cover normal use; WSL's default networking does not forward to Windows localhost | planning | Options: rewrite `localhost` to the Windows host address, or a per-session port forward |
| 2 | Ready-made setup for a specific Unity MCP | The general hook (D8, D12) lets any stdio Unity MCP target the copy | planning | Pick once the user chooses one; Unity's own and MCP for Unity both target an Editor by project path |
| 4 | Disk use report and limits for copies | Archive cleans up | planning | Show size in `win info`; warn past a threshold |
| 5 | Warning at session start when the bridge is broken on a WSL machine | `win info` reports it | planning | Mirror the screen tools warning at `machine/service.js:1999` |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|
| 1 | A Windows stdio MCP server launched by a Codex session works through interop | planning |

## Review Rounds

### Round 1 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Per-session copies make every worker and verifier start cold, against "Unity must work well" | upheld | D21 keys copies by worktree; D22 seeds new copies (Deferred #3 pulled in) |
| intent | major | HTTP Windows tools deferred, yet IDEA promises no networking tweaks | downgraded: minor | A stdio server run on Windows reaches its app over Windows localhost with no networking change; both known Unity MCPs offer stdio. Stated as the supported route (D23) |
| intent | minor | Lead and sub-lead get two copies pulling into one worktree | upheld | Removed by D21 |
| intent | minor | Committed Windows paths in `.mcp.json` flagged on non-WSL machines | upheld | D24 |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-19: The user will export the plan after review and import it on the Windows PC (WSL), so the build and its verification run there. `machine/test/windows-live.sh` is then a real check, not a skip: verifiers on that machine run it.
