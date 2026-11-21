---
slug: windows-bridge
date: 2026-11-21
implemented-by: "standard / gpt-6.1-terra (T1, T1b, T2, T3a, T3b, T4, T5; T1 attempt 2, T3a, T3b, T4 and T5 at xhigh effort); sub-lead: claude-opus-5-5"
verified-by:
  - round: 1
    lane: claude / claude-opus-5-5
    checks: standard / gpt-6.1-terra
---

# Completion Report — A bridge from Wheelchair in WSL to the Windows side of the same PC

Written for a hostile reviewer: every claim checkable, no claim without evidence. Built and checked on the user's real Windows PC inside WSL2 (kernel 6.6.87.2-microsoft-standard-WSL2, Windows PowerShell 5.1, Git for Windows 2.52, Linux git 2.53, Unity 6000.5.0f1 with an active Personal license). Commit verified: the tip of `wc/c833faa8e033` at the time this file was committed.

## Spec coverage

Every row's origin is `this run`: the plan has no Prior Work. Line numbers were checked by grep against this tree. Rows marked `none` in "Validated by" have no unit test of their own and are checked by the live run (real PowerShell, git.exe and Unity) or by reading the code.

### Spec items

| Spec item | Origin | Implemented at (file:line) | Validated by |
|---|---|---|---|
| D1. WSL when `WSLInterop`/`WSLInterop-late` exists and osrelease has `microsoft`, decided at start; PowerShell at `<mount>` (wsl.conf, default `/mnt`); each Windows action an `-EncodedCommand` child with timeout | this run | machine/lib/win-env.js:8-27, 14, 52, 55-59, 85-86; machine/lib/win.js:20; machine/service.js:271 | partial: machine/test/win-env.test.js:8 (detects WSL and mount root; timeout not asserted) |
| D2. Not WSL: every `win` op returns 422 with the NOT_WSL text | this run | machine/lib/win.js:12, 316 | machine/test/win.test.js:26 (lines 26-27); machine/test/win-service.test.js:52 (line 58) |
| D3. Interop repair: `WSL_INTEROP` set to newest `/run/WSL/*_interop` for that child only | this run | machine/lib/win-env.js:29-45, 53 | machine/test/win-env.test.js:16 |
| D4. PowerShell missing or failing: 422 naming WSL_INTEROP and the hint; `info` reports it as `reason` | this run | machine/lib/win-env.js:85-90; machine/lib/win.js:310 | machine/test/win-env.test.js:22; machine/test/win.test.js:323 |
| C1. Route `POST /v1/agent/win`, session-token auth; body `{op,args}`; `wc.js win` builds it | this run | machine/service.js:2079; viewer/app/wc.js:106-110, 183 | machine/test/win-service.test.js:52 (line 57); viewer/test/wc-win.test.js:60 |
| C2. Reviewer and mapper sessions get 403 | this run | machine/lib/win.js:317 | machine/test/win.test.js:26 (lines 29-32); machine/test/win-service.test.js:52 (line 59) |
| C3. Stopped, archived or not-running session 409; bad args 400; anything else 422 | this run | machine/lib/win.js:37, 41-43, 369-371; machine/lib/win-args.js:3 | machine/test/win.test.js:26 (line 35, stopped only); machine/test/win-args.test.js:17; machine/test/win-sync.test.js:153 (422) |
| C4. Ops act only on the caller's own session; no session or thread argument | this run | machine/lib/win.js:315-320; machine/lib/win-args.js:8-11 | none |
| C5. `info`: probes PowerShell, git.exe, Linux git; creates no copy; returns `{wsl, ok, ready, reason?, copy_windows, copy_linux, sandboxed}` | this run | machine/lib/win.js:307-313, 335; machine/lib/win-env.js:141-156 | machine/test/win.test.js:26 (line 41); machine/test/win.test.js:323; machine/test/win-service.test.js:69 (line 72) |
| C6. `sync`: reconcile; returns `{to_windows, to_linux, conflicts, skipped}` | this run | machine/lib/win.js:339-343; machine/lib/win-sync.js:341 | machine/test/win-sync.test.js:48; machine/test/win-service.test.js:81 (line 86) |
| C7. `run`: `[--timeout] [--env K=V]... -- program args`; reconcile, run, wait, reconcile; returns `{exit_code, timed_out, output, log, sync}` | this run | machine/lib/win.js:344-349; machine/lib/win-args.js:20-37; machine/lib/win-apps.js:313-326 | machine/test/win.test.js:93 (lines 97-98); machine/test/win-service.test.js:69 (line 73) |
| C8. `start`: reconcile, start without waiting; returns `{id, pid, log, sync}` | this run | machine/lib/win.js:344, 350; machine/lib/win-apps.js:308-311 | machine/test/win-apps.test.js:57 (line 60); machine/test/win.test.js:93 (line 104) |
| C9. `status`: running and exit code; reconciles once when it first sees an exit; `sync` only then | this run | machine/lib/win.js:352-359; machine/lib/win-apps.js:328-335 | machine/test/win.test.js:93 (lines 113-115) |
| C10. `windows`: top-level visible windows of this session's apps and their child processes | this run | machine/lib/win.js:366; machine/lib/win-apps.js:128-150, 337-343 | machine/test/win-apps.test.js:68 (lines 72-73) |
| C11. `shot <handle>`: returns a Linux PNG path | this run | machine/lib/win.js:367; machine/lib/win-apps.js:345-359 | machine/test/win-apps.test.js:68 (lines 77-78); machine/test/win-apps.test.js:82 |
| C12. `stop [id]`: kill the app's tree (all if no id), then reconcile; returns `{stopped, sync}` | this run | machine/lib/win.js:360-365; machine/lib/win-apps.js:369-375 | partial: machine/test/win-apps.test.js:57 (lines 62-65, app kill only); reconcile not tested |
| C13. `path <path>`: `wslpath -w` / `-u` translation | this run | machine/lib/win.js:338; machine/lib/win-env.js:93-105 | partial: machine/test/win-args.test.js:14 (parse only); translation not tested |
| S1. Sandbox: run/start 403 in sandboxed Codex (not `unrestricted`); `info` reports `sandboxed: true`; other ops work | this run | machine/lib/win.js:13, 308, 322 | machine/test/win.test.js:26 (lines 38-41) |
| P1. Program is a Windows name on the Windows PATH or a full path; cwd is the copy; `--env` for that program only; no console window | this run | machine/lib/win.js:344; machine/lib/win-apps.js:59-69 (CreateNoWindow at 66); machine/lib/win-args.js:23-26 | partial: machine/test/win.test.js:93 (line 100, env); no-console and cwd not asserted |
| P2. `WHEELCHAIR_SESSION_TOKEN` never passed to Windows (any case) | this run | machine/lib/win.js:321; machine/lib/win-args.js:25; machine/lib/win-apps.js:257 | machine/test/win.test.js:93 (lines 101-110); machine/test/win.test.js:330; machine/test/win-apps.test.js:25; machine/test/win-service.test.js:69 |
| R1. `run` timeout default 540 s, maximum 540 s (D15) | this run | machine/lib/win-args.js:21, 27-30 | machine/test/win-args.test.js:9; machine/test/win-args.test.js:18 (541 rejected) |
| R2. `run` timeout kills the process tree, `timed_out: true`; reconcile still runs | this run | machine/lib/win-apps.js:313-318, 361-367; machine/lib/win.js:348 | machine/test/win-apps.test.js:42 (lines 53-55); machine/test/win.test.js:93 (lines 98-99) |
| R3. `output` is last 64 KiB of stdout+stderr; full log under `<stateDir>/win/<session>/logs/` | this run | machine/lib/win-apps.js:253-255, 319-325 | machine/test/win-apps.test.js:25 (lines 27-32) |
| T1. Wrapper is a child of the service; named Job Object with KILL_ON_JOB_CLOSE; program started inside the job; prints `{"started":{pid, created}}`; `start` returns once printed | this run | machine/lib/win-apps.js:12-91 (60, 63, 65, 90), 78, 259, 277-282, 304-305 | machine/test/win-apps.test.js:57 (line 60); partial: machine/test/win-apps.test.js:25 (fake PowerShell; job flag not checked) |
| T2. Wrapper prints `{"done":{exit_code}}`; service reads the exit code only from it (32-bit); no done line gives null | this run | machine/lib/win-apps.js:79, 82, 261, 283 | machine/test/win-apps.test.js:25 (lines 28, 32: 256); machine/test/win-apps.test.js:34 (line 38) |
| T3. App is running while its job has any process, even after the program exited; `windows` and `shot` see every job process; `stop` and sweep terminate the job | this run | machine/lib/win-apps.js:81, 290-301, 128-137, 94-107, 243-247, 361-375 | machine/test/win-apps.test.js:42 (lines 44-52); machine/test/win-apps.test.js:68; machine/test/win-apps.test.js:109; machine/test/win-apps.test.js:57 (line 62) |
| T4. `apps.json` records session, PID and creation time per app; after restart a recorded wrapper, then its program, is killed only if creation time matches; exit null, running false | this run | machine/lib/win-apps.js:212, 220-226, 260-261, 185-204, 201-202, 228-241, 237-238 | machine/test/win-apps.test.js:96 (lines 99-107) |
| L1. At most 4 started apps per session at once; a fifth gets 422 | this run | machine/lib/win-apps.js:250-251 | machine/test/win-apps.test.js:57 (lines 60-61) |
| W1. `windows` and `shot` only see this session's started processes; other handles get 400 | this run | machine/lib/win-apps.js:337-347 (400 at 347) | machine/test/win-apps.test.js:68 (lines 74-75) |
| W2. `shot` uses PrintWindow with PW_RENDERFULLCONTENT; never focuses, moves or restores | this run | machine/lib/win-apps.js:170-175 (flag 2 at 175) | none (fake PowerShell writes a file; flag not checked) |
| W3. Minimized window gets 422 `window is minimized`; PNG at `<stateDir>/win/<session>/shots/<n>.png`, newest 50 kept | this run | machine/lib/win-apps.js:348, 349-358 (357) | machine/test/win-apps.test.js:68 (line 76); machine/test/win-apps.test.js:82 |
| N1. No mouse or keyboard input (D7) | this run | no input API in machine/lib/win*.js (grep: none) | none |
| K1. Copy path `%LOCALAPPDATA%\Wheelchair\copies\<thread>\<key>`; one copy per worktree; created on first sync, run or start, or at session start for tool roles (D30) | this run | machine/lib/win-env.js:47-49, 160-163; machine/lib/win.js:92-97, 158-173, 340 | machine/test/win-env.test.js:25 (key format); machine/test/win.test.js:119 (lines 120-121); machine/test/win.test.js:275 (shared copy) |
| K2. Copy is a git repo from `git.exe init` with autocrlf=false, ignorecase=true, filemode=false, longpaths=true; both git 2.43+ (D68), checked by `info` | this run | machine/lib/win-sync.js:71-79; machine/lib/win-env.js:141-156 (148, 151) | none (config values and version check not asserted) |
| K3. Windows git via `git.exe` (Windows PATH); Linux git for Linux side; Linux fetch and push only through the mount; checkouts by `git.exe` | this run | machine/lib/win-env.js:118-140; machine/lib/win-sync.js:285, 335, 336, 338 | machine/test/win-env.test.js:27 |
| B1. Raw bytes: every git command runs with `--attr-source=<empty tree>`, empty `core.attributesFile`, `core.autocrlf=false`, `GIT_ATTR_NOSYSTEM=1` | this run | machine/lib/win-sync.js:8, 57-69 (59, 61-64) | machine/test/win-sync.test.js:372; machine/test/win-sync.test.js:194 (lines 206-207) |
| I1. Bridge index per side (Linux `<stateDir>/win/copies/<key>/linux.index`, Windows `.git/wheelchair.index`); real index never read or written | this run | machine/lib/win-sync.js:138-143 | machine/test/win-sync.test.js:194 (lines 193-194, 209-211) |
| I2. New Linux index starts from `read-tree HEAD`; files tracked despite an ignore rule are included (D73) | this run | machine/lib/win-sync.js:152-154, 163 | machine/test/win-sync.test.js:194 (lines 195-208); machine/test/win-sync.test.js:396 |
| I3. Before each Linux snapshot, real-index paths missing from the bridge index are `add -f`'d if on disk; paths gone from disk are skipped (D80) | this run | machine/lib/win-sync.js:158-159 | machine/test/win-sync.test.js:350 (lines 353-357); machine/test/win-sync.test.js:350 (lines 354-359) |
| I4. Bridge-index path now ignored and not in the real index is removed with `rm --cached` on both sides (D83) | this run | machine/lib/win-sync.js:160-162 | machine/test/win-sync.test.js:194 (lines 212-217) |
| F1. Refs: `refs/wheelchair/<key>/base` and `/windows`; conflicts under `refs/wheelchair/conflicts/<thread>/<key>/<UTC time>`; copy `refs/wheelchair/base` and `/linux`; thread branch and `HEAD` never changed | this run | machine/lib/win-sync.js:121-123, 260-261, 335, 338, 340; no HEAD or branch update in win-sync.js | machine/test/win-sync.test.js:294 (lines 300-304); machine/test/win-sync.test.js:194 (lines 193, 209) |
| SN1. Snapshot = `add -A` then `write-tree` on the bridge index; ignored files never in a snapshot; deletions, renames, exec bits follow git; symlink outside the worktree left out and listed in `skipped` | this run | machine/lib/win-sync.js:149-188 (163, 186-187, 164-185) | machine/test/win-sync.test.js:48 (lines 52-57, 64); machine/test/win-sync.test.js:194 (line 216); machine/test/win-sync.test.js:149 (lines 151-153) |
| SN2. Letter case: two Linux paths equal ignoring case fail with 422 naming them, before any write | this run | machine/lib/win-sync.js:267-275 (throw at 272); machine/lib/win-sync.js:370 | machine/test/win-sync.test.js:149 (lines 146-149) |
| R-1. Reconcile step 1: snapshot both sides; fetch W objects into `refs/wheelchair/<key>/windows` | this run | machine/lib/win-sync.js:262-285 | machine/test/win-sync.test.js:48 (every reconcile) |
| R-2. Step 2: unresolved paths still holding markers are replaced by `base` on both sides; otherwise dropped from `unresolved`; a Windows edit waits | this run | machine/lib/win-sync.js:249-257, 287-290 | machine/test/win-sync.test.js:79 (lines 92-96); machine/test/win-sync.test.js:334 (lines 341-342) |
| R-3. Step 3: `R = L` if W equals base, `R = W` if L equals base; otherwise `git merge-tree --write-tree`; text conflicts keep markers; other kinds take L (D72); W commit kept as a conflict ref; `R_win` is R with conflicted paths from L (D58) | this run | machine/lib/win-sync.js:292-319 (298, 302, 309-316), 318, 325-326 | machine/test/win-sync.test.js:79 (lines 88-91, 90); machine/test/win-sync.test.js:104 (line 115); machine/test/win-sync.test.js:126 (lines 138-141) |
| R-4. Step 4: commit R and R_win with parent base; `read-tree -m -u` on the Linux index; push to copy; `git.exe read-tree -m -u` on Windows | this run | machine/lib/win-sync.js:323-338 | machine/test/win-sync.test.js:48 (applies both sides) |
| R-5. Step 4 refusal: restart reconcile once; second refusal fails 422 naming paths | this run | machine/lib/win-sync.js:355-362; machine/lib/win-sync.js:344-349 (refusal at 347) | machine/test/win-sync.test.js:162 (lines 164-168) |
| R-6. Step 5: base moves to `r_win` on both sides after both applies; `last_ok` recorded | this run | machine/lib/win-sync.js:339-340, 363-365 | partial: machine/test/win-sync.test.js:178 (next reconcile uses new base; indirect) |
| R-7. Interrupted applies need no recovery (D67): base moves only after both applies; state written before the applies | this run | machine/lib/win-sync.js:331-340 | machine/test/win-sync.test.js:178 (lines 181-187); machine/test/win-sync.test.js:334 (lines 338-342) |
| R-8. Result fields `{to_windows, to_linux, conflicts: [{path, ref}], unresolved, skipped}` | this run | machine/lib/win-sync.js:341 | machine/test/win-sync.test.js:88; machine/test/win-sync.test.js:113; machine/test/win-sync.test.js:158 |
| SE1. Seeding (D22, D38): source is the copy with newest `last_ok`; fetch its base; robocopy only paths the new worktree's `check-ignore` reports ignored; first reconcile has no base (W empty, R = L) | this run | machine/lib/win-sync.js:80-107 (82, 84, 87), 277-282 (281); machine/lib/win.js:93 | machine/test/win-sync.test.js:225 (lines 231-232); machine/test/win-sync.test.js:254 (lines 257-259) |
| SE2. robocopy exit 1 accepted; 8 or more fails with `seed failed` 422 | this run | machine/lib/win-sync.js:105, 114 | machine/test/win-sync.test.js:240 (lines 242-246) |
| ST1. State per copy at `<stateDir>/win/copies/<key>/state.json`: `last_ok`, `last_failed`, `used_since_ok`, `unresolved`; no copy means no state and no flag | this run | machine/lib/win-sync.js:11-35; machine/lib/win.js:145 | machine/test/win-sync.test.js:6; machine/test/win.test.js:119 (lines 120-121, state dir absent) |
| ST2. `used_since_ok` set by win ops, tool-role session start, sweep or stop termination, and app wrapper close (D78); cleared by a successful reconcile; set again while a live session has a Windows-program entry (D74) | this run | machine/lib/win.js:68-80, 95, 122, 149, 206, 283, 362; machine/lib/win-apps.js:298; machine/lib/win-sync.js:365 | machine/test/win.test.js:255 (lines 257-259); partial: D74 re-set not asserted (machine/test/win.test.js:275) |
| DEL1. Deletion case 1: verifier copy deleted after its apps' jobs terminate at stop; no reconcile | this run | machine/service.js:887, 1114; machine/lib/win.js:220, 226-235 | machine/test/win.test.js:162 (lines 157-164) |
| DEL2. Deletion case 2: worker copy deleted at merge cleanup, whatever its state | this run | machine/service.js:1436; machine/lib/win.js:235 | machine/test/win.test.js:141 (lines 146-147); machine/test/win-service.test.js:81 (line 92) |
| DEL3. Deletion case 3: archive deletes each remaining copy whose last reconcile did not fail, after a final reconcile (D69, D82) | this run | machine/service.js:1203; machine/lib/win.js:266-277 | machine/test/win.test.js:193 (lines 191-192); machine/test/win.test.js:207 (lines 204-205) |
| DEL4. Deletion case 4: worktree removed any other way: copy deleted unless its last reconcile failed | this run | machine/service.js:1201; machine/lib/win.js:226-240 | machine/test/win.test.js:179 (kind other kept); machine/test/win.test.js:310 (lines 307-308) |
| DEL5. D81: copy with unresolved paths deleted under cases 3 and 4 saves the Windows snapshot as a conflict ref first | this run | machine/lib/win-sync.js:125-130 | machine/test/win-sync.test.js:294 (lines 298-305) |
| DEL6. Only the deletion list deletes a copy (idle copies kept until archive, D76, D14); conflict refs never deleted (D65); `deleteCopy` removes only the `base` and `windows` refs | this run | remove callers: machine/service.js:887, 1114, 1201, 1203, 1436; machine/lib/win-sync.js:132-134 | machine/test/win-sync.test.js:294 (lines 301-304); machine/test/win.test.js:291 (lines 290-295) |
| LC1. Session stop: terminate the session's app jobs (mark copy used if any ran) and return at once; after stop, in background: verifier copy deleted, worker copy kept, lead or sub-lead reconciled if no other live session and `used_since_ok`; stopping an already-stopped session starts nothing | this run | machine/lib/win.js:211-224 (212, 215, 220, 221); machine/lib/win-apps.js:369-377; machine/service.js:879, 1110 | machine/test/win.test.js:162 (lines 158-160); machine/test/win.test.js:141 (lines 143-145); machine/test/win.test.js:275 (lines 274-276); machine/test/win-service.test.js:81 (line 88) |
| LC2. Archive: a copy needing a final reconcile gets one; returns `pending` naming sessions while any runs; WIP commit after; a finished or failed reconcile never makes archive wait again | this run | machine/lib/win.js:243-277; machine/service.js:1156-1172, 1203; viewer/app/threads.js:219-220 | machine/test/win.test.js:193 (lines 186-189); machine/test/win.test.js:207 (lines 201-203); machine/test/win-service.test.js:81 (lines 95-96) |
| LC3. Sweep every 60 s and once at service start: terminate dead sessions' jobs (including a `run` in flight) and reconcile lead or sub-lead copies needing it with no live session | this run | machine/service.js:394-396; machine/lib/win.js:279-294; machine/lib/win-apps.js:243-247 | machine/test/win.test.js:220 (lines 215-216); machine/test/win.test.js:231 (lines 239-240); machine/test/win-apps.test.js:109 (lines 113-114); startup sweep and timer untested |
| WT1. Windows tools (WSL, tool roles): `WHEELCHAIR_WINDOWS_PROJECT` = copy's Windows path; `WSLENV` gains it with `:`; not set on other machines | this run | machine/lib/win.js:296-305; machine/service.js:841 | machine/test/win.test.js:45 (lines 47-48, 52); machine/test/win-service.test.js:52 (lines 62-63) |
| WT2. Windows program in `.mcp.json`: stdio, absolute `/mnt/<drive>/...` path ending `.exe` (case-insensitive) (D32); `.cmd`, `.bat`, `.ps1` are not Windows programs | this run | machine/lib/project-programs.js:16-22; machine/lib/project-mcp.js:80-84 | machine/test/project-programs.test.js:75 (lines 80-82) |
| WT3. WSL: Windows program found when it is an existing regular file; other commands checked as today. Not WSL: entries dropped from tools, not reported missing; `cmd.exe` and `powershell.exe` count | this run | machine/lib/project-programs.js:24-34 (31-32); machine/lib/project-mcp.js:114 | machine/test/project-programs.test.js:75 (lines 84-87); machine/test/project-mcp-reader.test.js:96 (lines 101-106); machine/test/win-service.test.js:52 (lines 63-64) |
| WT4. Ready before tools (D30, D47, D53): WSL, tool roles, `.mcp.json` has a Windows entry; create, seed and reconcile before CLI launch; wait at most 45 s, then launch and keep readying; `info` reports `ready` (false while readying) and `reason`; other ops on that copy wait for readying | this run | machine/service.js:781-783, 833-841; machine/lib/win.js:30 (45000), 129-186 (158-173), 310-311, 336 | machine/test/win-service.test.js:69 (lines 71-72, 77); machine/test/win.test.js:119 (lines 122-134, 5 ms override; 45 s default not asserted) |
| WT5. Nothing added to the project tools card (D53) | this run | machine/service.js:694-760 (no windows reference; grep) | none |
| AI1. `protocol/app/worker.md` and `protocol/app/verifier.md`: win paragraph (wc.js win, sync around commands, conflicts and refs, Windows apps and `win stop`, Unity, sync before reporting done); verifier: a win 422 "not WSL" is COULD NOT TRY | this run | protocol/app/worker.md:43; protocol/app/verifier.md:70 | none (docs) |
| DOC1. README "On Windows": Git 2.43+ both sides, interop, `win info` check, `wsl --shutdown`, `/mnt` `.exe` paths and `cmd.exe /c`, `WHEELCHAIR_WINDOWS_PROJECT`, conflict-ref cleanup | this run | README.md:92-94 | none (docs) |
| DOC2. `machine/API.md` documents `/v1/agent/win`; `machine/AGENTS.md` lists the new files | this run | machine/API.md:35; machine/AGENTS.md:16-20 (win-apps.js not listed; test/windows-live.sh listed but absent on this branch) | none (docs; GAP: win-apps.js missing) |
| LIVE1. Live check `machine/test/windows-live.sh` and `.js` (D20, D55, D33) | this run | machine/test/windows-live.sh:1-9; machine/test/windows-live.js:130-179; machine/test/fixtures/unity-min/ | live runs pasted below (exit 77 without Unity, exit 0 with Unity) |

Table 1 row count: 73.


### Validation list (the Spec's machine-test coverage list, item by item)

Source: PLAN.md lines 427-465 ("They must cover:"), split into one row per item.

| # | Validation item | Covered by (file:line, test name) | Status |
|---|---|---|---|
| 1 | non-WSL 422 | machine/test/win.test.js:26 (availability, role, session and argument checks are ordered) | covered |
| 2 | reviewer and mapper 403 | machine/test/win.test.js:26 (same test, lines 29-32) | covered |
| 3 | sandboxed Codex session gets 403 on run and start | machine/test/win.test.js:26 (same test, lines 38-40) | covered |
| 4 | sync of added, changed, deleted and renamed files in each direction | machine/test/win-sync.test.js:48 (reconcile transfers additions, edits, deletions, renames and independent changes); machine/test/win-sync.test.js:350 (successive Windows edits, lines 360-364) | covered |
| 5 | ignored files never copied either way | machine/test/win-sync.test.js:48 (lines 52-57, 64) | covered |
| 6 | edits to different files on both sides both survive | machine/test/win-sync.test.js:48 (lines 58-63, same reconcile) | covered |
| 7 | text conflict leaves markers in Linux file and names a ref whose tree has the Windows version | machine/test/win-sync.test.js:79 (text conflicts preserve the Windows version and mask markers until resolved; lines 89-91) | covered |
| 8 | binary conflict keeps Linux version and the ref has the Windows one | machine/test/win-sync.test.js:126 (binary and modify/delete conflicts choose Linux and save Windows; lines 139, 141) | covered: binary ref holds the Windows bytes (win-sync.test.js:141-144) |
| 9 | file touched by the update changes during reconcile: retry once, then fail with nothing lost | machine/test/win-sync.test.js:162 (refuses after two changes during apply without losing edits) | covered |
| 10 | interrupted apply, then new Linux edit to a different file, finished by next reconcile without conflicts or 422 | machine/test/win-sync.test.js:178 (interrupted Windows apply is resumed after another Linux edit) | covered |
| 11 | second sync before text conflict resolved does not send markers to Windows; resolving later sends the resolution | machine/test/win-sync.test.js:79 (lines 92-96, 97-101); machine/test/win-sync.test.js:104 (add/add, lines 116-123) | covered |
| 12 | Linux case collision refused before writing | machine/test/win-sync.test.js:149 (refuses case collisions and leaves external symlinks out; lines 146-149) | covered |
| 13 | LFS-tracked file and `eol=crlf` file reach copy byte for byte from clean checkout | machine/test/win-sync.test.js:372 (clean checkout LFS and eol attributes do not transform bridge bytes) | covered |
| 14 | conflict refs survive copy deletion and archive | machine/test/win-sync.test.js:294 (deleting unresolved copies saves the Windows snapshot and removes copy refs; line 304); machine/test/win.test.js:291 (archive deletes copies while retaining conflict refs) | covered |
| 15 | thread branch, HEAD and real index unchanged by sync | machine/test/win-sync.test.js:194 (raw bytes, executable mode, force-added and newly ignored files; lines 193, 209-211) | covered |
| 16 | executable bit set in Linux survives a round trip | machine/test/win-sync.test.js:194 (line 216) | covered |
| 17 | Windows edit made between commands is not overwritten by the next command | machine/test/win-sync.test.js:350 (later force-add, repeated tracked deletion, and successive Windows edits sync; lines 360-364) | covered |
| 18 | `status` returns `sync` with conflicts | machine/test/win.test.js:93 (run timeout syncs, status syncs an exit and launch environment excludes the token; lines 113-114) | covered |
| 19 | `WSL_INTEROP` repaired from `/run/WSL` | machine/test/win-env.test.js:16 (repairs interop without leaking token or mutating the input) | covered |
| 20 | recorded PID with a different creation time is never killed | machine/test/win-apps.test.js:96 (startup kills a matching wrapper first and never kills reused PIDs; lines 101-105) | covered |
| 21 | exit code comes from the `done` line (fake 256 reports 256) | machine/test/win-apps.test.js:25 (run reads the done code, caps output, and does not leak the token; line 28) | covered |
| 22 | app whose launcher exited stays running while its job has processes | machine/test/win-apps.test.js:42 (job remains running until the wrapper closes; timeout terminates it; lines 44-47) | covered |
| 23 | start-time sweep ends a recorded surviving wrapper | machine/test/win-apps.test.js:96 (lines 102-105) | covered |
| 24 | sweep terminates dead session's jobs and reconciles lead or sub-lead copies needing it, including ones with no apps | machine/test/win.test.js:220 (sweep reconciles a dead lead with no apps); machine/test/win.test.js:231 (sweep marks dead app copies and reconciles a shared thread worktree); machine/test/win-apps.test.js:109 (sweep terminates dead sessions and returns their copy keys) | covered |
| 25 | stop returns at once | machine/test/win.test.js:162 (verifier stop returns immediately and deletes after its apps stop; lines 158-159); machine/test/win-service.test.js:81 (line 88, stop returns while kill is gated) | covered |
| 26 | verifier's copy deleted at stop without a reconcile | machine/test/win.test.js:162 (lines 157-164) | covered |
| 27 | worker's copy not reconciled at stop and deleted at merge cleanup even when flagged | machine/test/win.test.js:141 (worker merge cleanup deletes its copy and stop does not reconcile); machine/test/win-service.test.js:81 (line 92, removeWorkerWorktree) | partial: no test sets `used_since_ok` before merge; "flagged" not asserted |
| 28 | copy whose worktree is gone is deleted without a reconcile | machine/test/win.test.js:310 (cleanup removes a vanished linked worktree copy without a reconcile) | covered |
| 29 | copy never receives conflict markers | machine/test/win-sync.test.js:79 (line 90, Windows file has no markers); machine/test/win-sync.test.js:104 (line 115) | covered |
| 30 | session start on worktree with no copy and no Windows .exe entry creates no copy or state | machine/test/win.test.js:119 (readying times out without blocking launch...; lines 120-121) | covered: state dir and copy folder both absent (win.test.js:123-125) |
| 31 | start-time readying past 45 s launches the CLI and `win info` reports `ready: false` | machine/test/win.test.js:119 (lines 122-130, readyTimeoutMs = 5) | partial: timeout path covered with 5 ms override; 45 s default not asserted |
| 32 | archive returns `pending` while a final reconcile runs, and not again after it finished or failed | machine/test/win.test.js:193 (archive waits for successful final sync then deletes the copy; lines 186-189); machine/test/win.test.js:207 (archive waits once for a final sync and retains a failed copy; lines 201-203) | covered |
| 33 | copy whose reconcile failed kept, except a verifier's or a merged worker's | machine/test/win.test.js:179 (failed copies survive ordinary removal and archive, but verifier and merge removal delete them) | covered |
| 34 | seeding copies only the paths the new worktree's git ignores | machine/test/win-sync.test.js:225 (seeding copies only ignored paths accepted by the new worktree; lines 231-232) | covered |
| 35 | `.cmd` entries are not treated as Windows programs | machine/test/project-programs.test.js:75 (Windows programs respect mount, file type and WSL; line 82) | covered |
| 36 | `run` timeout kills and still syncs | machine/test/win-apps.test.js:42 (lines 53-55, kill); machine/test/win.test.js:93 (lines 98-99, sync after timeout) | covered (two tests) |
| 37 | `run` output cap and log | machine/test/win-apps.test.js:25 (lines 27-32) | covered |
| 38 | `start` limit of 4 | machine/test/win-apps.test.js:57 (four started jobs are allowed and stop returns their copy keys; lines 60-61) | covered |
| 39 | `windows`/`shot` refuse handles of other processes | machine/test/win-apps.test.js:68 (windows and shots are restricted to the session and reject minimized windows; lines 74-75) | covered |
| 40 | a second session on the same worktree shares the copy | machine/test/win.test.js:275 (sessions sharing a worktree share the copy and Windows tool use triggers stop sync; line 271) | covered |
| 41 | Windows-program `.mcp.json` entries dropped without warnings on non-WSL | machine/test/project-mcp-reader.test.js:96 (omits Windows programs outside WSL without warnings; lines 104-105); machine/test/win-service.test.js:52 (lines 63-64) | covered |
| 42 | deleting a copy removes its `base` and `windows` refs and keeps its conflict refs | machine/test/win-sync.test.js:294 (lines 300-304) | covered |
| 43 | lead copy used only through a Windows MCP tool after its last sync is reconciled at the lead's stop | machine/test/win.test.js:275 (lines 272-276, tool-edit) | covered |
| 44 | Windows edit to a path with unresolved markers waits on Windows; reconcile still applies other changes | machine/test/win-sync.test.js:79 (lines 92-96) | covered |
| 45 | Linux delete against a Windows edit keeps the deletion; conflict ref holds the Windows file | machine/test/win-sync.test.js:126 (lines 134-136, 140-141) | covered |
| 46 | file tracked despite an ignore rule reaches the copy | machine/test/win-sync.test.js:194 (lines 196-208); machine/test/win-sync.test.js:396 (force-tracked ignored file survives repeated syncs) | covered |
| 47 | tracked file deleted but not committed syncs on two syncs in a row without error | machine/test/win-sync.test.js:350 (lines 354-359) | covered |
| 48 | copy deleted with unresolved paths leaves a conflict ref holding its Windows files | machine/test/win-sync.test.js:294 (lines 303-305) | covered |
| 49 | copy whose final reconcile failed is not deleted at archive | machine/test/win.test.js:207 (archive waits once for a final sync and retains a failed copy; line 205) | covered |
| 50 | file synced before a new `.gitignore` rule covered it stops syncing | machine/test/win-sync.test.js:194 (lines 212-217) | covered |
| 51 | `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV` set only on WSL and only for tool roles | machine/test/win.test.js:45 (session environment applies to tool roles without creating state; lines 47-52); machine/test/win-service.test.js:52 (lines 62-63) | covered |
| 52 | token never reaches a Windows program's environment | machine/test/win.test.js:93 (lines 101-110); machine/test/win-apps.test.js:25 (does not leak the token); machine/test/win-service.test.js:69 | covered |


Spec line references that have moved since the plan was written (the code is where the Spec meant): the win route is `machine/service.js:2079` (Spec: 2044); verifier worktree removal `machine/service.js:887` and `:1114` (Spec: 864 and 1087); merge cleanup `:1436` (Spec: 1400); archive's `pending` result `viewer/app/threads.js:219` (Spec: 217-222).

## Deviations from plan

1. **Live check uses a WinForms window, not Notepad** (lead-approved; PLAN.md Log 2026-11-20). Windows 11's Notepad is a Store-packaged app: `notepad.exe` hands off to a process Windows starts outside the bridge's Job Object, so `windows`, `shot` and `stop` cannot reach it. The live check starts a uniquely titled WinForms window with `win start -- powershell.exe -NoProfile -Command ...` and checks `windows`, a non-single-colour `shot` and `stop` on it. worker.md, verifier.md and README each gained one line saying Store apps cannot be reached. The job-only window filter is unchanged.
2. **D83 on the Windows side** (lead clarification): "paths the real index lists" means the Linux worktree's real index on both sides, since the copy has no real index of its own (`machine/lib/win-sync.js`, `snapshot(ctx, win, trackedPaths)`).
3. **Live check commits what Unity writes during the test run before the clean check.** Unity 6000.5 writes `Assets/Resources/BillingMode.json` (+ `.meta`) while running tests, and `.vscode/` and a `<key>.slnx` on first open. These are not in the fixture's `.gitignore` (which follows the Spec's list exactly) and the bridge correctly brings them back. The harness syncs and commits them after the test run, as it does after the import, so the clean check proves that deleting the results file and syncing leaves nothing behind. Generated caches (`Library/`, `Temp/`, `Logs/`, ...) still never reach the worktree.
4. **First reconcile of a new copy** writes the empty tree with `git mktree` as W and takes no Windows snapshot from disk (the Spec's Seeding bullet: "W counts as empty and R = L"). Without this, a seeded cache was snapshotted before the copy had its `.gitignore` and then deleted by the first checkout (found by the real check on this PC; unit test `win-sync.test.js` "first and second reconciles preserve seeded ignored files outside both indexes and base").
5. **Unity fixture** pins `com.unity.test-framework` 1.4.5; Unity upgrades it to 1.7.0 and rewrites `Packages/manifest.json` with its default package set on first open; that comes back through sync and is committed by the harness, as the Spec expects.

## Routers

- `machine/AGENTS.md`: rows added for `lib/win.js`, `lib/win-env.js`, `lib/win-sync.js`, `lib/win-args.js`, `lib/win-apps.js`, and `test/windows-live.sh`/`.js` with the Unity fixture.
- `machine/API.md`: `POST /v1/agent/win` documented.
- No other router changed; no ownership moved between directories.

## Validation evidence

`bash machine/test/run.sh` (tip of the feature branch):

```text
exit 1
✖ new login clears previous result and uses exact target (112.709963ms)
ℹ tests 498
ℹ pass 497
ℹ fail 1
✖ failing tests:
```

The one failure is pre-existing and fails identically on the base branch (`kimi.test.js`: "Kimi Code is not installed" on this PC; PLAN.md Log 2026-11-20).

`node --test viewer/test/*.test.js`:

```text
exit 1
✖ a plan directory committed on the thread branch is found against its upstream (103.059141ms)
✖ a file committed into an existing plan directory does not claim that plan (113.909125ms)
ℹ tests 714
ℹ pass 712
ℹ fail 2
✖ failing tests:
```

Both failures are pre-existing and fail identically on the base branch (checked 2026-11-20 before any change).

`bash machine/test/windows-live.sh` (no `WHEELCHAIR_UNITY`):

```text
exit 77
service code: /home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc/c833faa8e033/machine/service.js
Running as unit: wc-win-live-449472554cd7.service; invocation ID: 841c0366726d4f07bc7ef43c3d08902d
machine: screen startup cleanup failed: wcscreen-297a71104b8a.slice
machine service listening on 127.0.0.1:41241
ok - commit base
ok - info reports ready
ok - sync round trip
ok - cmd.exe echo hi exits 0
ok - windows lists WinForms title
ok - screenshot is PNG
ok - PNG is 8-bit RGB/RGBA without interlace
ok - PNG has complete pixel data
ok - screenshot contains more than one colour
screenshot: /tmp/wheelchair-windows-live-449472554cd7-winforms.png
ok - stop removes WinForms window
ok - commit round trip
Unity part skipped
machine: screen teardown failed: wcscreen-297a71104b8a-winlive449472554cd7.slice
```

`WHEELCHAIR_UNITY="/mnt/c/Program Files/Unity/Hub/Editor/6000.5.0f1/Editor/Unity.exe" bash machine/test/windows-live.sh`:

```text
exit 0
service code: /home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc/c833faa8e033/machine/service.js
Running as unit: wc-win-live-769a7c1b2714.service; invocation ID: 4a5714fd44ed459b9e1cb54e78c4f0f4
machine: screen startup cleanup failed: wcscreen-c7a4483ab4fd.slice
machine service listening on 127.0.0.1:44541
ok - commit base
ok - info reports ready
ok - sync round trip
ok - cmd.exe echo hi exits 0
ok - windows lists WinForms title
ok - screenshot is PNG
ok - PNG is 8-bit RGB/RGBA without interlace
ok - PNG has complete pixel data
ok - screenshot contains more than one colour
screenshot: /tmp/wheelchair-windows-live-769a7c1b2714-winforms.png
ok - stop removes WinForms window
ok - commit round trip
ok - commit Unity fixture
ok - app 990d328e-a7ea-4147-b24e-a9962de673c0 exits 0
Unity import paths: [30 paths: Packages/manifest.json, .vscode/*, *.meta, ProjectSettings/*, <key>.slnx]
ok - commit Unity import
ok - Unity tests exit 0
ok - Unity results contain passed FixtureTest
Unity tests paths: ["Assets/Resources/BillingMode.json","Assets/Resources/BillingMode.json.meta"]
ok - commit Unity tests
ok - Unity worktree is clean
ok - windows lists Unity Editor
ok - screenshot is PNG
ok - PNG is 8-bit RGB/RGBA without interlace
ok - PNG has complete pixel data
ok - screenshot contains more than one colour
screenshot: /tmp/wheelchair-windows-live-769a7c1b2714-unity.png
machine: screen teardown failed: wcscreen-c7a4483ab4fd-winlive769a7c1b2714.slice
```

Screenshots from these runs (opened and checked): the WinForms window and the Unity 6.5 Editor on the fixture project, at the `screenshot:` paths printed above. The `machine: screen teardown failed: wcscreen-...` lines come from the existing screen manager's slice cleanup in the temporary service (no screen was started), not from the bridge.

Per-task real checks on this PC (in each task's report under `docs/plans/windows-bridge/reports/`): T1 sync smoke, T1b 2,000-file seed in 2.4 s, T3a exit code 256 and WinForms containment, T3b two-worktree seeded readying through archive, T4 in-process service `win info`/`win sync`/archive.

## Known gaps / residual risks

- Store-packaged Windows apps (Windows 11 Notepad, Calculator, Paint, Explorer windows) are invisible to `windows`/`shot` and not ended by `stop` (deviation 1).
- An app start racing a session stop inside one call can leave that app running until the next 60 s sweep (sub-second window; rare path).
- After copies are deleted, the empty thread folder `%LOCALAPPDATA%\Wheelchair\copies\<thread-id>` is left behind (cosmetic; seen after T4's real check).
- `apps.json` keeps a record of every app ever started; it is never pruned.
- The live script does not assert that `WSL_INTEROP` is absent inside the systemd-run service, and does not separately assert the Unity Editor window is gone after `stop` (its cleanup fails if the copy cannot be removed; no Unity process remained after the runs).
- Deleting a large copy removes it from Linux through `/mnt/c`, which is slow for a multi-GB Unity `Library/` (runs in the background).
- Unity batch mode needs an activated Unity license on the PC; without one Unity exits 198 (README does not yet say this).

## Remediation rounds

### Remediation 1 — 2026-11-21

Verification attempt 1 (claude-opus-5-5, commit 7f815025) found one gap: in a Codex session a
Windows stdio MCP server did not receive `WHEELCHAIR_WINDOWS_PROJECT`, because Codex starts stdio
servers with a cleared environment and interop forwards only variables named in `WSLENV`
(`REMEDIATION-1.md`). Judged normal use; no rare paths.

Fix (R1, standard / gpt-6.1-terra at xhigh effort):
- `machine/adapters/codex.js:52,81-86`: on WSL, every stdio entry whose command is a Windows program
  gets `WHEELCHAIR_WINDOWS_PROJECT` and `WSLENV` in its `env_vars` passthrough, merged without
  duplicates; off WSL and for other entries the overrides are unchanged.
- `machine/service.js:664,789`: the adapter context carries `wsl` and `mount`.
- `machine/adapters/agy.js`: unchanged; agy's stdio servers inherit its whole environment
  (`docs/plans/project-tools-solid/PLAN.md` decision 16), so the variables already arrive, as in
  Claude. Kimi runs no project tools.
- `README.md` (Windows bridge): Windows-side tools started by Wheelchair get the variable
  automatically; a tool run by hand outside Wheelchair needs it in `WSLENV`.
- Tests: `machine/test/project-mcp-codex.test.js:138-145` (Windows entry on WSL, merged with an
  existing passthrough, non-Windows entry, off WSL); `machine/test/win-service.test.js:100-107`
  (a Codex launch on the fake WSL root carries the passthrough).

Evidence: real `codex exec` on this PC with the adapter's own `-c` overrides and a Windows stdio
test tool returned `project=[C:\some\path]` (`docs/plans/windows-bridge/reports/R1.md`).
`bash machine/test/run.sh` after the merge: tests 500, pass 499, fail 1 (the known Kimi test).
`node --test viewer/test/*.test.js`: pass 712, fail 2 (the two known plan-directory tests); one
earlier run also failed a third, timing-sensitive viewer test that passed on rerun and fails the
same way on the base branch occasionally.
