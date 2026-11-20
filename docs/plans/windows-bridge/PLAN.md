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
| W1 | Machine service runs as a systemd user service | Whether WSL interop works from it | no | Settled: D29, and the live script runs through the service |
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
| D25 | Sync is one reconcile that reads both sides against the manifest before writing either, instead of push then pull | A push could overwrite a Windows edit before the pull saw it | review-round-1 |
| D26 | Letter case: Linux case collisions refused; case-only renames applied as renames | Windows storage is case-insensitive; delete-plus-copy would delete the file | review-round-1 |
| D27 | Apps run under a PowerShell wrapper the service holds, and are identified by PID plus creation time; a 60 s sweep kills apps of dead sessions | Exit codes need a waiting parent; PIDs get reused; crashed sessions must not leave apps on the desktop | review-round-1 |
| D28 | Modes never come from Windows; new pulled files get 0644 | The Windows mount cannot round-trip Linux modes | review-round-1 |
| D29 | Repair a missing `WSL_INTEROP` from `/run/WSL/*_interop` for each Windows call; the setup check runs through the installed service | systemd user services often lack it | review-round-1 |
| D30 | When `.mcp.json` has a Windows program, session start readies the copy before the CLI launches | Tools start before the agent could sync | review-round-1 |
| D31 | Stop and the sweep reconcile before the copy is left; archive keeps the conflicts folder | Archive must not lose Windows-side changes or saved conflicts | review-round-1 |
| D32 | Only `.exe` counts as a Windows program; other tools go through `cmd.exe` or `powershell.exe` | Interop launches only PE executables | review-round-1 |
| D33 | The live check exercises Unity on a fixture project when `WHEELCHAIR_UNITY` is set, and rejects single-colour screenshots | A blank PNG must not pass, and Unity is the main use | review-round-1 |
| D34 | Supersedes D17's clause on warm-starting copies: that is in the Spec as D22, not Deferred | D17 contradicted D22 | review-round-2 |
| D35 | A copy is deleted when Wheelchair removes its worktree (verifier at stop, worker at merge) | Seeded copies are several GB each; their worktrees are gone | review-round-2 |
| D36 | The Unity fixture has its own `.gitignore`; the live check confirms the worktree stays clean | Unity's generated folders would otherwise be pulled into the worktree | review-round-2 |
| D37 | `WHEELCHAIR_WINDOWS_PROJECT` and the start-time copy only for `TOOL_ROLES` | Reviewers and mappers cannot use the copy | review-round-2 |
| D38 | Seeding copies only paths the new worktree's git ignores, checked by `git check-ignore` | A path missing from the source manifest may be a new asset, not a cache file | review-round-2 |
| D39 | Apps run inside a Job Object; running means the job has processes; the full exit code comes from a JSON line, not the wrapper's exit status | Launchers exit while children run; Linux truncates exit status to 8 bits | review-round-2 |
| D40 | Conflicts are saved under a time folder per reconcile | A second conflict on one path must not overwrite the first | review-round-2 |
| D41 | A copy is deleted only after a successful reconcile; a failed one keeps the copy | Deleting after a failed reconcile could lose the only Windows version | review-round-2 |
| D42 | Stop does not wait for its reconcile; archive returns `pending` until the thread's reconciles finish | The hub gives machine calls 5 s; archive already has a retry contract | review-round-2 |
| D43 | The live check drives the candidate bridge module from the worktree with a stub service, and runs once without `WSL_INTEROP` | The installed service runs the canonical clone's code, not the build under test | review-round-2 |
| D44 | Workers run `win sync` and commit before reporting done | The merge happens before the worker is stopped | review-round-2 |
| D45 | `used_since_ok` is set at session start only when the worktree's copy exists or is being readied | Otherwise every worktree on a WSL machine would get a copy | review-round-3 |
| D46 | A verifier's copy is deleted after its apps stop, with no reconcile | Its worktree is force-removed, so a reconcile is wasted | review-round-3 |
| D47 | Start-time readying waits at most 20 s, then continues in the background with a project tools line | The hub's start limit is 60 s; a Unity copy can take longer | review-round-3 |
| D48 | Sync uses git: the Windows copy is a git repository; each side is snapshotted as a commit and merged with git's merge. Supersedes the home-made reconcile rules of D4, D5, D16, D25, D26, D28, D38's listing method and D40, and D19's "nothing installed on Windows". Git for Windows is required on the PC; WSL git 2.38 or newer | User's pick after the review budget: git already handles renames, case, folders, modes and ignored files | user |
| D49 | Reconcile: snapshot both sides, merge with `merge-tree`, apply with `read-tree -m -u` on both sides; conflicts keep text markers and a ref holding the Windows side | Follows from D48; nothing is lost and git's own refusal catches files that changed mid-sync | defaulted |
| D50 | A worker's copy is never reconciled at stop or merge; deleted at merge cleanup only if unused since its last sync | Reconciling after the merge would pull edits outside the accepted work; workers sync before done (D44) | review-round-3 |
| D51 | Archive waits only for reconciles running or not yet tried since last use; a finished or failed one never holds it | Archive retries must end | review-round-3 |
| D52 | Apps record wrapper and program PID with creation times; start-time sweep ends a surviving wrapper first | The wrapper holds the job; after a service restart it may survive | review-round-3 |
| D53 | Supersedes D47's 20 s and its project tools line: wait at most 45 s; readiness is reported through `win info` only | The hub keeps project tools lines only for the thread worktree (`machine/service.js:662-707`) | review-round-3 |
| D54 | Sandboxed sessions cannot `run` or `start` Windows programs | Windows programs run outside any Linux sandbox | review-round-3 |
| D55 | Supersedes D43: the live check runs the candidate service under `systemd-run --user` and calls it through `wc.js win` | Exercises the real route and a service environment | review-round-3 |
| D56 | WSL git must be 2.40 or newer | `merge-tree --merge-base` arrived in 2.40; Debian 12 ships 2.39 | review-round-4 |
| D57 | Bridge git commands disable line-ending conversion and every filter driver (LFS included), so files travel as raw bytes | Unity projects often use LFS; pointer files would break the copy | review-round-4 |
| D58 | The copy gets the Linux version of conflicted paths; markers only on Linux | Unity's YAML files are the likeliest to conflict; an open Editor must not load markers | review-round-4 |
| D59 | Supersedes D50's kept-if-flagged rule: a worker's copy is deleted at merge cleanup regardless, and a copy whose worktree is gone is deleted, never reconciled | Otherwise a several-GB copy could stay forever | review-round-4 |

## Spec

### What it is

On a machine where Wheelchair runs inside WSL2, agents get `wc.js win <op>`: a bridge to the
Windows side of the same PC. Each worktree gets its own Windows copy (a git repository), kept in
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
- **Interop from the service (D29):** before every Windows call, if `WSL_INTEROP` is unset
  or names a socket that does not exist, the service sets it, for that child only, to the
  newest socket matching `/run/WSL/*_interop`. A systemd user service often lacks it while
  an interactive shell has it.
- WSL but PowerShell missing or failing to start: 422 naming what failed, the `WSL_INTEROP`
  value tried, and the hint `check that interop is enabled in /etc/wsl.conf, then run
  wsl --shutdown from Windows and reopen WSL`. `win info` reports the same as `reason`.

### Commands (D9, D10)

Route `POST /v1/agent/win`, session-token auth like `/v1/agent/screen`
(`machine/service.js:2044`), body `{op, args}`. `wc.js win <op> [args]` builds it in
`viewer/app/wc.js` like `screenRequest`. Reviewer and mapper sessions get 403. A stopped,
archived or not-running session gets 409. Bad arguments 400. Anything else that fails 422.
Ops act only on the caller's own session; no op takes a session or thread argument.

| Op | Args | Does | Returns |
|---|---|---|---|
| `info` | none | Probes PowerShell, `git.exe` and Linux git's version; does not create the copy | `{wsl, ok, ready, reason?, copy_windows, copy_linux, sandboxed}` |
| `sync` | none | Reconcile (below) | `{to_windows, to_linux, conflicts, skipped}` |
| `run` | `[--timeout <s>] [--env K=V]... -- <program> [args...]` | Reconcile, run in the copy, wait, reconcile | `{exit_code, timed_out, output, log, sync}` |
| `start` | `[--env K=V]... -- <program> [args...]` | Reconcile, start without waiting | `{id, pid, log, sync}` |
| `status` | `[<id>]` | Running or exited, with exit code; reconciles once when it first sees an exit | `{apps: [{id, program, running, exit_code, log}], sync?}`; `sync` present when a reconcile ran |
| `windows` | none | Top-level visible windows of this session's started apps and their child processes | `{windows: [{handle, title, pid, app_id, minimized}]}` |
| `shot` | `<handle>` | Screenshot one of those windows | `{path}`: a Linux PNG path |
| `stop` | `[<id>]` | Kill an app's process tree (all apps if no id), then reconcile | `{stopped, sync}` |
| `path` | `<path>` | Translate a Linux path to Windows or back (`wslpath -w` / `-u`) | `{path}` |

- **Sandbox (D54):** in a session whose apps run sandboxed (Codex not in `unrestricted`
  mode, the same test as `machine/lib/screen.js:191`), `run` and `start` return 403
  `Windows programs would run outside your sandbox; the bridge can't run them in this
  session`, and `info` reports `sandboxed: true`. Other ops work.
- `program` is a Windows program name resolved by PowerShell on the Windows PATH, or a full
  Windows path. Working directory is the worktree's copy. `--env` sets variables for that
  program only. `WHEELCHAIR_SESSION_TOKEN` is never passed to Windows.
- `run`: default timeout 540 s, maximum 540 s (D15); on timeout the process tree is killed,
  `timed_out: true`, and the reconcile still happens. `output` is the last 64 KiB of combined
  stdout and stderr; the full output is in `log`, a Linux file under
  `<stateDir>/win/<session>/logs/`. Programs started by `run` and `start` get no console window.
- **Process tracking (D27, D39):** `run` and `start` launch a PowerShell wrapper as a child of
  the machine service. The wrapper creates a Windows Job Object with
  `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, starts the program inside it (so every descendant is
  in the job), prints one JSON line `{"started": {pid, created}}` with the program's PID and
  process creation time, waits until the job has no active processes, then prints one JSON
  line `{"done": {exit_code}}` with the program's full 32-bit exit code and exits. The
  service reads the exit code only from that line, never from the wrapper's own exit status
  (which Linux truncates to 8 bits). An app is **running** while its job has any process,
  even after the program itself exited. `windows` and `shot` see every process in the job;
  `stop` and the sweep terminate the job. Each app is recorded in `<stateDir>/win/apps.json`
  with session, PID and creation time. After a service restart, for a recorded app the
  service no longer holds, a process with that PID is killed (its tree) only if its creation
  time matches; its exit code is `null` with `running: false`. A wrapper that ends without a
  `done` line reports `exit_code: null`.
- `start` returns once the wrapper has printed its line; output goes to the log. At most 4
  started apps per session at once; a fifth gets 422.
- `windows` and `shot` only see windows owned by processes this session started (or their
  descendants). Any other handle gets 400.
- `shot` uses `PrintWindow` with `PW_RENDERFULLCONTENT` so GPU-drawn windows capture; it never
  focuses, moves or restores a window. A minimized window gets 422 `window is minimized`. The
  PNG is written to `<stateDir>/win/<session>/shots/<n>.png` (keep the newest 50), so it can be
  posted with an `image` card.
- No op sends mouse or keyboard input (D7).


### The Windows copy and sync (D3, D14, D21, D35, D41, D45, D46, D48–D50)

- Copy path: `%LOCALAPPDATA%\Wheelchair\copies\<thread-id>\<worktree-key>` (D21), reached
  from Linux through the mount. One copy per worktree: sessions sharing a worktree share its
  copy. Created on the first `sync`, `run` or `start` from that worktree, or at session start
  (D30).
- **The copy is a git repository (D48).** It is created by Windows `git.exe init` with
  `core.autocrlf=false`, `core.ignorecase=true`, `core.filemode=false` and
  `core.longpaths=true`. All work on the Windows side uses `git.exe` (Git for Windows, found
  by PowerShell on the Windows PATH); Linux-side work uses the worktree's `git`, which must be
  2.40 or newer (for `git merge-tree --write-tree --merge-base`, D56). Linux git reaches the copy's repository
  through its mount path for `fetch` and `push` only; checkouts in the copy are always done by
  `git.exe`.
- **Refs.** In the Linux repository: `refs/wheelchair/<worktree-key>/base`, `/windows` and
  `/conflict/<UTC time>`. In the copy: `refs/wheelchair/base` and `refs/wheelchair/linux`.
  The thread's branch, `HEAD` and the worktree's real index are never changed by sync. These
  refs are deleted with the copy.
- **Snapshots.** A snapshot of a side is a commit, parent `base` (none for the first), whose
  tree is that side's files as `git add -A` sees them, built with a temporary index
  (`GIT_INDEX_FILE` set to a file in the state directory, started from a copy of the side's
  index or `base`). So ignore rules, deletions, renames, letter case (Windows side ignores
  case), executable bits (kept from Linux; Windows has `core.filemode=false`) and file/folder
  changes all follow git. Ignored files are never in a snapshot and never touched.
- **Raw bytes (D57).** Every git command the bridge runs, on either side, runs with
  `-c core.autocrlf=false -c core.eol=lf`, and with every filter driver named in the
  worktree's `.gitattributes` files (for example `lfs`) overridden as
  `-c filter.<name>.clean=cat -c filter.<name>.smudge=cat -c filter.<name>.process=
  -c filter.<name>.required=false`. So Git LFS files and other filtered files travel as their
  real contents, never as pointer files, and the copy needs no LFS remote. These raw blobs
  live only under the bridge's refs and are pruned by git's normal garbage collection once
  the copy and its refs are deleted.
- **Reconcile (D49)** is the only sync step; every op that syncs runs it, serialized per
  copy across every session sharing it:
  1. Snapshot Linux (`L`) and, with `git.exe` in the copy, Windows (`W`). Fetch `W` into
     `refs/wheelchair/<key>/windows`.
  2. Result `R`: `L` if `W`'s tree equals `base`'s; `W` if `L`'s tree equals `base`'s;
     otherwise `git merge-tree --write-tree --merge-base=base L W`. On a clean merge `R` is
     that tree. On conflicts `R` is the tree merge-tree wrote (text conflicts carry the usual
     conflict markers; for a binary conflict it holds the Linux version), `W` is kept as
     `refs/wheelchair/<key>/conflict/<UTC time>`, and every conflicted path is listed in
     `conflicts` with that ref name, so `git show <ref>:<path>` gets the Windows version back.
  3. Apply `R` to the Linux worktree with `git read-tree -m -u L R` on the temporary index.
     For the copy, build `R'`: `R` with every conflicted path taken from `L` (D58), so the
     Windows side never holds conflict markers and an open Editor keeps loading valid files;
     push `R'` to the copy's `refs/wheelchair/linux` and run `git.exe read-tree -m -u W R'`
     there. Git refuses if a file changed since its snapshot;
     the reconcile then starts again from step 1 once, and on a second refusal fails with 422
     naming the paths, having changed nothing further.
  4. Move `base` to `R'` on both sides (so after the agent resolves a conflict on Linux, the
     next sync sees a Linux-only change). Record `last_ok`.
  Result fields: `{to_windows, to_linux, conflicts: [{path, ref}], skipped}` (counts of
  changed paths each way). A symlink pointing outside the worktree is left out of the Linux
  snapshot and listed in `skipped`.
- **Seeding (D22, D38).** When a copy is created and the thread has another copy, the one
  with the newest `last_ok` is the source: `git.exe fetch <source copy> refs/wheelchair/base`
  for its objects, then the paths of the source that `git check-ignore --stdin` in the **new**
  worktree reports ignored are copied with one Windows-side `robocopy`. Then the first
  reconcile runs with no `base`: `W` is taken as empty, so `R = L` is written to the copy,
  and files the seed put there that git would see are overwritten by `R`.
- **State** per copy at `<stateDir>/win/copies/<worktree-key>/state.json`: `last_ok`,
  `last_failed` (reason, cleared on success) and `used_since_ok` (D45: set by any `win` op,
  by a tool-role session start on a worktree whose copy exists or is being readied, and by
  the sweep or a stop when it terminates jobs on that copy; cleared by a successful
  reconcile). A worktree with no copy gets no state and no flag.
- **Deleting a copy (D35, D41, D50)** deletes the folder and its refs. It happens only after
  a successful reconcile, or when `used_since_ok` is clear; a copy whose reconcile failed is
  kept and the machine log names it. A verifier's copy is deleted after its apps' jobs are
  terminated at its stop, with no reconcile (D46), at both removal sites
  (`machine/service.js:864` and `:1087`). A worker's copy is not reconciled at its stop or at
  merge (D50): workers sync and commit before reporting done (D44); at merge cleanup
  (`machine/service.js:1400`) the copy is deleted whatever its flag (D59). Archive deletes the thread's remaining copies after their final reconciles
  (Lifecycle). Conflict refs live in the Linux repository and are kept until the copy is
  deleted.

### Lifecycle (D27, D31, D42, D51, D52)

- **Session stop** (an explicit stop, including the stops archive makes,
  `machine/service.js:1122-1135`): terminate the session's apps' jobs (setting
  `used_since_ok` on the copy if any were running) and return at once. Then, in the
  background: a verifier's copy is deleted (D46); a worker's is left (D50); for a lead or
  sub-lead, if no other live session shares the copy and `used_since_ok` is set, a reconcile
  starts. A stop of a session already stopped starts nothing.
- **Archive (D42, D51):** a copy *needs a final reconcile* when its worktree exists,
  `used_since_ok` is set and no reconcile has failed since it was set. Archive starts one for each such copy of the thread
  that has none running, and returns the existing `pending` result
  (`viewer/app/threads.js:217-222`) naming the sessions that last used those copies while any
  is running; the user's "Archive again" retries. A finished reconcile, successful or failed,
  never makes archive wait again. The WIP commit happens once none is running. Then archive
  deletes copies per D41. A copy whose worktree no longer exists is never reconciled; it is
  deleted (D59).
- **Sweep** every 60 s, like the screen sweep (`machine/lib/screen.js:105-110`), and once at
  service start: terminate the jobs of apps whose session is not live in tmux (a crash or a
  natural exit), including a `run` in flight, setting `used_since_ok`; then reconcile every
  lead or sub-lead copy that needs a final reconcile (as above) and has no live session.
- **After a service restart (D52):** `apps.json` records, for each app, the program's and the
  wrapper's PID and creation time. The start-time sweep terminates a surviving wrapper (which
  closes its job and, with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, ends every process in it),
  then the program's tree, each only if its creation time matches.

### Windows-side tools (D8, D12)

- On WSL machines, every lead, sub-lead, worker and verifier session's tmux environment
  (the roles in `TOOL_ROLES`, `machine/lib/project-mcp.js:8`) gets `WHEELCHAIR_WINDOWS_PROJECT` set to
  its copy's Windows path. The value is already a Windows path, so `WSLENV` gains `WHEELCHAIR_WINDOWS_PROJECT` (appended to any
  existing value with `:`). Not set on other machines.
- The supported route for a Windows-side tool (D23): its MCP server runs on Windows as a
  stdio entry, so it reaches its app over Windows' own localhost. Example for a tool on the
  Windows PATH: `"command": "/mnt/c/Windows/System32/cmd.exe", "args": ["/c", "<tool>"]`.
- A **Windows program** in `.mcp.json` is a stdio entry whose `command` is an absolute
  `/mnt/<drive>/...` path ending in `.exe` (case-insensitive) (D32). Interop runs only `.exe`
  files directly, so a `.cmd`, `.bat` or `.ps1` tool goes through `cmd.exe` or
  `powershell.exe` as in the example. On WSL the project-programs check
  (`machine/lib/project-programs.js`) treats such a path as found when it is an existing
  regular file; any other command is checked as today.
- On a machine that is not WSL, such entries are left out of the session's project tools
  and not reported as missing (D24); `cmd.exe` and `powershell.exe` paths count as Windows
  programs too.
- **Ready before tools start (D30):** on WSL, for the same roles only, when the worktree's `.mcp.json` has at least
  one Windows-program entry, session start creates (and seeds) the copy and reconciles it
  before launching the agent's CLI, so a tool that needs the project finds it. The start
  waits for this at most 45 s (D47, D53; the hub allows a start 60 s,
  `viewer/app/sessions.js:218`). If it is not done by then, or it fails, the CLI launches
  anyway and the readying carries on in the background. `win info` reports `ready` (false
  while readying) and `reason` (the failure); any other `win` op on that copy waits for the
  readying to finish. Nothing is added to the project tools card (D53).

### Agent instructions (D18)

Add to `protocol/app/worker.md` and `protocol/app/verifier.md`, next to the screen paragraph:
on a WSL machine, use `wc.js win` to run or look at things on Windows; your Windows copy is
synced with git around each command; after editing files, run `win sync` before asking a
Windows-side tool to look at them; a sync can report conflicts: text files then hold git
conflict markers to resolve, and a binary keeps your version, with the Windows version
available through `git show <ref>:<path>` using the ref the result names; if a Windows-side
tool failed at the start of your session, check `win info`'s `ready` and say so in your
report; Windows apps
appear on the user's desktop, so never leave them running and never try to type into them;
use `win stop` when done. A worker runs `win sync` and commits what it brought back before
reporting its task done, so the merge carries every Windows-side change. Unity tests: `win run -- <Unity.exe path> -batchmode -runTests
-projectPath <copy> -testResults <copy>\Logs\wheelchair-results.xml` with no Editor open on
that copy (Unity refuses a second instance on one project); `Logs/` is ignored in a Unity
project, so read the results through `copy_linux` from `win info` rather than expecting them
in the worktree. A verifier reports a `win` 422 for "not WSL" as
COULD NOT TRY. The first Unity open in a thread imports the whole project and can outlast
`run`'s limit: use `win start` and poll `win status` for it.

### Setup (D19, D48)

README "On Windows" gains: install Git for Windows on the Windows side and make sure WSL's
git is 2.40 or newer (both checked by `win info`); interop must be on (`[interop] enabled=true`, the default); check
from a thread by asking the lead to run `wc.js win info`, which runs inside the installed
machine service (D29); if it fails, run `wsl --shutdown` from Windows, reopen WSL and check
again; Windows-side tools use full
`/mnt/c/...` paths to an `.exe`, with `.cmd`/`.bat` tools wrapped in `cmd.exe /c`; `WHEELCHAIR_WINDOWS_PROJECT` names the session's copy. `machine/API.md`
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

The machine tests use a fake `powershell.exe` and a fake `git.exe` that runs the real Linux
`git` in the fake copy folder, so sync runs real git on both sides. They must cover: non-WSL
422; reviewer and mapper 403; sandboxed Codex session gets 403 on `run` and `start`; sync of
added, changed, deleted and renamed files in each direction; ignored files never copied
either way; edits to different files on both sides both survive; a text conflict leaves
markers in the Linux file and names a ref whose tree has the Windows version; a binary
conflict keeps the Linux version and the ref has the Windows one; a file changed during a
reconcile makes it retry once and then fail with nothing lost; the thread branch, `HEAD` and
real index are unchanged by sync; an executable bit set in Linux survives a round trip; a
Windows edit made between commands is not overwritten by the next command; `status` returns
`sync` with conflicts; `WSL_INTEROP` repaired from `/run/WSL`; a recorded PID with a
different creation time is never killed; the exit code comes from the `done` line (a fake
exit code of 256 reports 256); an app whose launcher exited stays running while its job has
processes; the start-time sweep ends a recorded surviving wrapper; the sweep terminates a dead
session's jobs and reconciles lead or sub-lead copies needing it, including ones with no apps;
stop returns at once; a verifier's copy is deleted at stop without a reconcile; a worker's
copy is not reconciled at stop and is deleted at merge cleanup even when flagged; a copy
whose worktree is gone is deleted without a reconcile; an LFS-tracked file reaches the copy
with its real bytes; the copy never receives conflict markers; a session start on a worktree with no copy and no Windows `.exe` entry creates no copy
or state; start-time readying past 45 s launches the CLI and `win info` reports `ready:
false`; archive returns `pending` while a final reconcile runs and not again after it
finished or failed; a copy whose reconcile failed is never deleted; seeding copies only paths
the new worktree's git ignores; `.cmd` entries are not treated as Windows programs; `run`
timeout kills and still syncs; `run` output cap and log; `start` limit of 4; `windows`/`shot`
refuse handles of other processes; a second session on the same worktree shares the copy;
Windows-program `.mcp.json` entries dropped without warnings on non-WSL; deleting a copy
removes its refs; `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV` set only on WSL and only for tool
roles; the token never reaches a Windows program's environment.

`windows-live.sh` (with `windows-live.js`, in the pattern of `machine/test/screen-live.sh`)
tests the candidate code through its real route (D55): it starts `machine/service.js` from the
worktree it lives in under `systemd-run --user --wait --pipe` (so the environment is a
systemd user service's, without `WSL_INTEROP`), on a free port with a temporary state
directory and a fake `tmux` on `PATH` as the machine tests use, records a lead session for a
temporary git repository through the hub route the machine tests use, and calls `wc.js win`
from this worktree with that session's token and origin. It prints the service's code path so
the report shows which build answered. Steps: `info` ok, `sync` round trip with a file edited
on each side, `run -- cmd.exe /c echo hi`, `start -- notepad.exe`, `windows`, `shot` produces
a PNG that is not a single colour, `stop`. With `WHEELCHAIR_UNITY=<path to Unity.exe>` set it
also runs the Unity part (D33) on the fixture project `machine/test/fixtures/unity-min` (one
passing EditMode test), copied into the temporary repository. The fixture carries its own
`.gitignore` ignoring `Library/`, `Temp/`, `Logs/`, `UserSettings/`, `obj/`, `*.csproj`,
`*.sln` and `Packages/packages-lock.json` (D36). `win run` of batchmode tests with
`-testResults` at the fixture's (not ignored) `wheelchair-live-results.xml` returns exit 0 and
the file appears in the Linux repository; the script deletes it, runs `win sync`, and
afterwards `git status --porcelain` there is empty; `win start` of the Editor on the fixture,
wait for its window, `shot` is not a single colour, `stop`. Without `WHEELCHAIR_UNITY` it
prints `Unity part skipped` and exits 77 after the rest passes. On the user's PC, the verifier
sets `WHEELCHAIR_UNITY`.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Windows-side tools that use HTTP or SSE on Windows `localhost` | Stdio tools cover normal use; WSL's default networking does not forward to Windows localhost | planning | Options: rewrite `localhost` to the Windows host address, or a per-session port forward |
| 2 | Ready-made setup for a specific Unity MCP | The general hook (D8, D12) lets any stdio Unity MCP target the copy | planning | Pick once the user chooses one; Unity's own and MCP for Unity both target an Editor by project path |
| 4 | Disk use report and limits for copies | Copies of removed worktrees are deleted (D35) and archive removes the rest | planning | Show size in `win info`; warn past a threshold |
| 6 | Restart Windows-side tools that started before the copy was ready | The copy is usually ready within the 45 s wait; the agent reports when it was not | review-round-3 | Restart the tool once `win info` reports ready |
| 5 | Warning at session start when the bridge is broken on a WSL machine | `win info` reports it | planning | Mirror the screen tools warning at `machine/service.js:1999` |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A junction or symlinked parent directory inside a copy or worktree could make sync read or write outside it | Rare path: projects do not contain them in ordinary use; reparse points in the copy are skipped | review-round-1 |

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
| mechanics | blocking | Push can overwrite a Windows edit before the pull notices the conflict | upheld | D25 reconcile reads both sides first |
| mechanics | blocking | Archive can discard unsynced Windows edits and saved conflicts | downgraded: major | Real, small fix: D31 reconcile on stop and sweep; conflicts kept |
| mechanics | blocking | Junctions or symlinked parents could send sync outside the roots | accepted-risk | Rare path: needs a junction or symlinked parent inside a project copy; reparse points are skipped anyway |
| mechanics | blocking | `.cmd`/`.bat` cannot launch directly through interop; exec-bit check wrong | upheld | D32 |
| mechanics | major | Lead and sub-lead pull into one worktree from two copies | upheld | Already removed by D21; serialization stated |
| mechanics | major | Apps outlive a crashed session; in-flight work not cancelled | upheld | D27 sweep |
| mechanics | major | Exit code and process ownership across separate PowerShell calls | upheld | D27 wrapper, PID plus creation time |
| mechanics | major | Windows MCP server starts before the copy exists | upheld | D30 |
| mechanics | major | Interop may fail from the systemd service even when enabled | upheld | D29 |
| mechanics | major | Copying modes through the Windows mount breaks git's executable bit | upheld | D28 |
| mechanics | major | Case-only rename deletes the file | upheld | D26 |
| mechanics | major | `status` cannot report conflicts from its reconcile | downgraded: minor | One field; added `sync` to `status` |
| mechanics | major | Live check passes with a blank PNG and never runs Unity | upheld | D33 |

### Round 2 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** copies keyed by worktree and seeded from another copy (D21, D22); stdio-on-Windows as the supported tool route (D23); Windows entries dropped on non-WSL (D24); one reconcile instead of push then pull (D25); letter case (D26); app wrapper, PID plus creation time, sweep (D27); file modes (D28); `WSL_INTEROP` repair (D29); copy ready before tools start (D30); stop/sweep reconcile, conflicts kept on archive (D31); `.exe` only (D32); Unity in the live check (D33); `status` returns `sync`.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Unity fixture's generated folders would be pulled into the worktree | upheld | D36 |
| intent | major | Seeded copies of removed worktrees pile up until archive; Deferred #4's reason gone | upheld | D35; Deferred #4 reason updated |
| intent | minor | Copy and env var made for reviewers and mappers too | upheld | D37 |
| intent | minor | `results.xml` at the copy root gets pulled and maybe committed | upheld | Results under ignored `Logs/`, read through `copy_linux` |
| intent | minor | D17 contradicts D22 | upheld | D34 |
| mechanics | blocking | Seeding treats anything missing from the source manifest as ignored | upheld | D38 |
| mechanics | blocking | Archive can delete a copy after a failed reconcile | downgraded: major | Real, small fix: D41 |
| mechanics | blocking | A second conflict on one path overwrites the first saved version | downgraded: major | D40 |
| mechanics | major | Sweep only finds dead sessions through app records | upheld | `used_since_ok` sweep (Lifecycle) |
| mechanics | major | Worker merge happens before the stop's reconcile | upheld | D44, plus reconcile at merge cleanup |
| mechanics | major | Windows-origin case-only rename not propagated | accepted-risk | Rare path: a Windows tool changing only letter case; no data is lost |
| mechanics | blocking | Descendants escape once the launcher exits | upheld | D39 Job Object |
| mechanics | blocking | Exit code truncated to 8 bits | upheld | D39 `done` line |
| mechanics | major | Stop and archive waiting for a reconcile exceed the hub's 5 s call limit | upheld | D42 |
| mechanics | blocking | Readiness failure in a field the hub ignores | upheld | Now a `project_tools.programs` line |
| mechanics | major | Live check exercises the installed service, not the candidate | upheld | D43 |
| mechanics | minor | Linux-changed/Windows-deleted case has nothing to save | upheld | Spec and tests: recreated on Windows |

### Round 3 — 2026-11-19

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 2:** copies deleted with their worktree, only after a successful reconcile (D35, D41); Unity fixture `.gitignore` and clean-worktree check (D36); copy and env var only for tool roles (D37); seeding filtered by the new worktree's git ignore rules (D38); Job Object tracking and full exit codes (D39); per-reconcile conflict folders (D40); stop reconciles in the background and archive returns `pending` (D42); live check drives the candidate module without `WSL_INTEROP` (D43); workers sync and commit before done (D44); manifest `used_since_ok` and the sweep over used copies; readiness failure as a `project_tools.programs` line; Unity results under `Logs/`.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Every worktree on a WSL machine would get a copy through `used_since_ok` | upheld | D45 |
| intent | major | Start-time readying can exceed the hub's 60 s start limit | upheld | D47 |
| intent | minor | Reconciling a verifier copy is wasted; second removal site missed | upheld | D46 |
| mechanics | blocking | A successful reconcile clears `used_since_ok` while an Editor can still write; the sweep then skips the copy | downgraded: major | Lifecycle: terminating jobs sets `used_since_ok` |
| mechanics | blocking | Archive retries can stay `pending` forever (re-stops queue reconciles; failed reconcile keeps the flag) | downgraded: major | D51 |
| mechanics | blocking | `win run`/`start` let a sandboxed Codex session run programs outside its sandbox | upheld | D54 |
| mechanics | blocking | A file that Windows turned into a directory cannot reconcile | accepted-risk | Rare path: a Windows tool replacing a file with a same-named folder |
| mechanics | major | Readiness line for worker/verifier worktrees is dropped (project tools state is thread-worktree only, `machine/service.js:662-707`) | upheld | D53 |
| mechanics | major | MCP server launched on an incomplete copy after the 20 s cap is never restarted | upheld | D53: 45 s wait covers normal starts; restarting tools is Deferred #6 |
| mechanics | major | After a service restart the wrapper holding the job may survive; recovery records only the program PID | upheld | D52 |
| mechanics | major | Merge cleanup's reconcile pulls edits after the merge, outside the accepted work | upheld | D50 |
| mechanics | major | Live check never exercises the candidate service route under systemd | upheld | D55 |

### Round 4 — 2026-11-19

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 3:** the user chose git-based sync (D48): the Windows copy is a git repository and each sync snapshots both sides and merges with git (D49), replacing the home-made reconcile rules; conflicts keep text markers and a ref with the Windows side; seeding fetches from a sibling copy. Also: worker copies not reconciled at stop or merge (D50); archive waits only for unfinished final reconciles (D51); wrapper PIDs recorded and ended after a service restart (D52); readiness wait 45 s, reported through `win info` only (D53); sandboxed sessions cannot `run`/`start` (D54); live check runs the candidate service under `systemd-run` through `wc.js win` (D55); Deferred #6. Machine tests' required coverage rewritten.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | `merge-tree --merge-base` needs git 2.40, not 2.38 | upheld | D56 |
| intent | major | Git LFS files would sync as pointer files | upheld | D57 |
| intent | major | Flagged worker copy kept at merge, then never deletable | upheld | D59 |
| intent | minor | Conflict markers written into the Windows copy break an open Editor | upheld | D58 |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-19: The user will export the plan after review and import it on the Windows PC (WSL), so the build and its verification run there. `machine/test/windows-live.sh` is then a real check, not a skip: verifiers on that machine run it.
- 2026-11-19: Review budget reached after round 3 (three rounds without a clean one since the user's last decision). Recurring area: the two-way file sync and its lifecycle. Asked the user how to proceed.
