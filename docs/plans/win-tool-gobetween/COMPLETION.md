---
slug: win-tool-gobetween
date: 2026-11-21
implemented-by: "standard (gpt-6.1-terra) T1, T1b, T2, T3 (attempt 2 at effort xhigh); light (gpt-6-luna) T3b; sub-lead claude-opus-5-5 (router)"
verified-by: []
---

# Completion Report — Windows tools that start before their copy is ready

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are on the commit named in the sub-lead's result.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| 1. Which tools are wrapped (WSL, tool roles, loaded stdio `isWindowsProgram`, not `mcp-for-unity`, missing args = `[]`, HTTP never) and the wrapped argv | this run | `machine/lib/win-tool-wrap.js:7-14`; filled only on WSL + tool role + claude/codex/agy at `machine/service.js:853-861` | `win-tool-wrap.test.js` "wraps only eligible Windows stdio entries and hashes original invocation" |
| 1. How the real tool is started (direct spawn, own cwd, stderr inherited, env minus `WHEELCHAIR_SESSION_TOKEN`, `WHEELCHAIR_WINDOWS_PROJECT` from `copy`, added to `WSLENV`) | this run | `machine/lib/win-tool-proxy.js:97-107` | `win-tool-proxy.test.js` "stand-in hands held calls to tool, caches paginated list and sets environment", "missing or empty copy is absent from tool environment" |
| 1. Stop the tool (stdin close, 2 s, SIGTERM, 3 s, SIGKILL, 1 s) | this run | `machine/lib/win-tool-proxy.js:53-62` (defaults `:10`) | "signals close tool stdin and escalate through TERM and KILL" |
| 1. `loaded: [{name, windows, wrapped}]`, `windows` from the original command; Pi/Kimi `[]` | this run (Pi/Kimi `[]` pre-existing) | `machine/adapters/common.js:19`; `codex.js:145`; `agy.js:69`; `claude.js` loaded list; `machine/service.js:865-866` | "adapters emit replacements and report original classification"; `adapters-loaded.test.js` |
| 2. Shared map `context.replaceEntries` (not on `main` when built: `git grep replaceEntries origin/main -- machine/adapters` empty after fetch) | this run | `machine/service.js:729,853-861` | `win-tool-wrap.test.js` |
| 2. `null` withholds (Codex/Antigravity omit, Claude disables, never in `loaded`) | this run | `codex.js:56-58,144`; `agy.js:35-36`; `claude.js` disabled/loaded filter | "null withholds entries without warnings and replacement validation and budget still apply" |
| 2. Codex/Antigravity translate the replacement through the same code; Codex passthrough from the original command | this run | `codex.js:52-56,83`; `agy.js:35-36` | same test as above; "adapters emit replacements…" (passthrough) |
| 2. Claude: replaced names disabled, one `<stateDir>/settings/<name>.mcp.json` (0600, atomic), `--mcp-config`, no `--strict-mcp-config`, removed on stop | this run | adapter `machine/adapters/claude.js` (`mcpConfig`, argv); write `machine/service.js:872-877`; remove `:973-979,1226` | "WSL Claude writes wrapped config and waiting before tmux; stop removes both" |
| 2. Stale files: generalized sweep over `agy-tools`, `settings/*.mcp.json`, `win-ready`, filter first, one `liveTmux()`, per-directory protection, 60 s grace, starting names | this run | `machine/service.js:478-545` | `win-tool-sweep.test.js` (3 tests); unchanged `kimi-turns.test.js` passes |
| 3. Ready file path/modes/atomic/JSON shape | this run | `machine/lib/win.js:121-133` | "existing copy remains waiting until a post-start reconcile completes" (modes) |
| 3. `waiting` before tmux | this run | `machine/lib/win.js:134-139,182-185`; call `machine/service.js:917` | service test (fake tmux reads the file at `new-session`) |
| 3. `ready` only after a reconcile finishing after start, incl. later `win sync`; `.git` alone never | this run | `machine/lib/win.js:149-153,163` | "existing copy remains waiting…", "failed readying becomes ready after a later successful sync" |
| 3. `failed` on readying failure and on `prepareLaunch` throwing before the task | this run | `machine/lib/win.js:235,252` | "failed readying becomes ready…", "context errors before a readying task write failed" |
| 3. Removed on stop; per-session serial queue; token checked before rename; stop invalidates then removes | this run | `machine/lib/win.js:113-120,131,141-147,281` | "stop removes ready file and a late readying result cannot recreate it", "stop serializes behind an in-progress temporary ready write and removes it" |
| 3. Failed or cancelled start removes both files; late result writes nothing | this run | `machine/service.js:948-949` | "tmux failure removes both files…", "cancelled start removes both files…" |
| 4. Go-between: stand-in, handoff 3a/3b, held calls 50 s, cancellation, failed sentence, probe + pagination + cache, step 5 exits, stdin errors, spawn failure, step 6 finish routine | this run | `machine/lib/win-tool-proxy.js` (whole file; finish `:28-41`, probe `:74-96`, handoff `:97-135`, poll `:136-144`, client loop `:145-161`) | `win-tool-proxy.test.js`, 21 tests mapped bullet by bullet in `reports/T1b.md` |
| 5. Marking the copy used still runs for wrapped-only sessions | pre-existing (kept) | `machine/lib/win.js` `afterLaunch`; call `machine/service.js:952` on `windowsTools` | existing `win.test.js` "launch marking causes a final reconcile after readying" |

## Deviations from plan

- The go-between takes four test-only options before `--` (`--hold-ms`, `--poll-ms`,
  `--init-ms`, `--stop-ms`); the service never passes them. Spec asked for the wait to be
  "configurable for the test".
- A failed write of the first `waiting` ready file is logged and the start continues (the
  go-between reads a missing file as `waiting`); the Spec does not say.
- Otherwise none. Worker choices are logged in PLAN.md Log.

## Routers

`machine/AGENTS.md`: added rows for `lib/win-tool-wrap.js` and `lib/win-tool-proxy.js`, and
the `lib/win.js` row now names the per-session ready file.

## Validation evidence

On the merged feature branch (all of T1, T1b, T2, T3, T3b):

`node --test machine/test/win-tool-*.test.js machine/test/adapters-loaded.test.js machine/test/kimi-turns.test.js`

```text
✔ adapters report only loaded project entries and classify original transports (299.714575ms)
✔ Codex reports no loaded entries when its override budget is exceeded (0.414718ms)
✔ binding rejects a role message quoted after ordinary prompt text (10.463708ms)
✔ binding joins role message text parts before checking its session line (1.395471ms)
✔ binding is shared and selects each session marker, ignoring subagents (4.454696ms)
✔ turn zero and all outcomes are mapped, persisted and not repeated (3.035218ms)
✔ incompatible marker and missing binding stop with a reason (3.370756ms)
✔ protocol versions must be well formed and respect the full minimum (9.453582ms)
✔ fatal stop refuses input and waits for confirmed absence (1.06717ms)
✔ unrelated incompatible logs are ignored and truncation stops a bound session (2.701762ms)
✔ spool gate holds later turns until the previous event drains (2.208422ms)
✔ offset stays behind an unhandled turn when the spool drains after breaking (1.832246ms)
✔ copier refuses replaced or shortened Kimi logs (3.570845ms)
✔ chat binds before polling and simultaneous chat and polling share identity (2.628315ms)
✔ persisted offsets catch up after restart and a crash before saving replays the turn (16.781513ms)
✔ missing log requires continuous failures and delivery failures never start the clock (5.672679ms)
✔ persistence errors after a successful log read do not start the missing clock (1.652692ms)
✔ copier does not open source after fatal and ignores swapped opened file (1.455707ms)
✔ recovery stops Kimi while leaving Claude and marker-priority panes alone (2.227127ms)
✔ outage spools one turn at a time and drains in order even when the clock moves backwards (19.297338ms)
✔ HTTP pending stop, archive and hook preserve pending session and its worktree (205.49225ms)
✔ sign-in refuses when no Kimi binary is installed (2.190383ms)
✔ duplicate turn ends in one read hand off once (3.632094ms)
✔ HTTP start retry and listing keep Kimi binding state private (178.549785ms)
✔ fatal verifier stop and archive remove created worktrees, while worker stop keeps its checkout (58.972012ms)
✔ unchanged Kimi copy does not read source content or persist (2.530808ms)
✔ stand-in hands held calls to tool, caches paginated list and sets environment (115.856252ms)
✔ ready at start pipes messages and returns final exit status with stdin open (63.004095ms)
✔ timeouts, cancellation and failed state resolve stand-in calls (273.637261ms)
✔ handoff failure replies and exits with stdin open (62.343411ms)
✔ missing executable reports failure, before or after readiness (55.938348ms)
✔ handoff timeout covers calls queued during initialization (245.126983ms)
✔ exiting during handoff fails queued requests (72.222235ms)
✔ failed probe does not replace cache and client list is not cached (172.716663ms)
✔ 3a starts without synthetic messages and signals stop the tool (141.693829ms)
✔ large final response is flushed with client stdin open (164.066232ms)
✔ stdin close before ready exits without spawning (28.462608ms)
✔ tool signal status is propagated (59.304298ms)
✔ held calls fail immediately when readiness changes to failed (35.05624ms)
✔ handoff suppresses cancelled requests and duplicate initialized notifications (197.104218ms)
✔ missing or empty copy is absent from tool environment (121.390299ms)
✔ signals close tool stdin and escalate through TERM and KILL (188.737047ms)
✔ closed client read end during tool output shuts down without crashing (60.528286ms)
✔ closed client read end during large final response does not crash (105.154726ms)
✔ tool exiting while receiving input does not crash proxy (52.90397ms)
✔ command-only entry launches (35.923672ms)
✔ handoff with empty list forwards held call after readiness (121.706865ms)
✔ existing copy remains waiting until a post-start reconcile completes (799.711071ms)
✔ failed readying becomes ready after a later successful sync (485.799141ms)
✔ context errors before a readying task write failed (13.706514ms)
✔ beforeLaunch resolves when the ready directory cannot be created (22.570725ms)
✔ stop removes ready file and a late readying result cannot recreate it (481.225591ms)
✔ stop serializes behind an in-progress temporary ready write and removes it (475.865997ms)
✔ WSL Claude writes wrapped config and waiting before tmux; stop removes both (492.889036ms)
✔ tmux failure removes both files and late readying cannot recreate them (485.29692ms)
✔ cancelled start removes both files and late readying cannot recreate them (508.658921ms)
✔ sweep removes dead files and keeps starting and live files in each directory without agy-tools (9.553874ms)
✔ only ordinary settings files do not call tmux or remove anything (2.967548ms)
✔ sweep keeps dead session ready and MCP files younger than 60 seconds (3.185671ms)
✔ wraps only eligible Windows stdio entries and hashes original invocation (1.428537ms)
✔ adapters emit replacements and report original classification (1.974522ms)
✔ null withholds entries without warnings and replacement validation and budget still apply (1.090271ms)
ℹ tests 62
ℹ pass 62
ℹ fail 0
exit 0
```

`bash machine/test/run.sh` (only the four known environment failures, also failing on the branch before any task merged):

```text
✖ Pi asides validate, fork, resume, settle and redact (132.734418ms)
✖ new login clears previous result and uses exact target (61.203758ms)
✖ plan files use committed refs and enforce input and size limits (692.028921ms)
✖ archive keeps selected regular uploads, retries and reserves numbers (642.255603ms)
ℹ tests 605
ℹ pass 601
ℹ fail 4
✖ Pi asides validate, fork, resume, settle and redact (132.734418ms)
✖ new login clears previous result and uses exact target (61.203758ms)
✖ plan files use committed refs and enforce input and size limits (692.028921ms)
✖ archive keeps selected regular uploads, retries and reserves numbers (642.255603ms)
exit 1
```

`node --test viewer/test/*.test.js` (only the two known plan-directory failures, also failing before any task merged):

```text
✖ a plan directory committed on the thread branch is found against its upstream (96.02095ms)
✖ a file committed into an existing plan directory does not claim that plan (103.197248ms)
ℹ tests 781
ℹ pass 779
ℹ fail 2
✖ a plan directory committed on the thread branch is found against its upstream (96.02095ms)
✖ a file committed into an existing plan directory does not claim that plan (103.197248ms)
exit 1
```

## Known gaps / residual risks

- Live checks in PLAN.md Validation (cold/warm cache with Codex, Claude re-listing) need a WSL
  machine with a Windows stdio MCP server; not run here. Check Once Built C1-C3 likewise
  need live CLIs (C1 Antigravity is not installed on this machine).
- Temp files from a crash mid-write (`win-ready/.<name>.<uuid>.tmp`,
  `settings/<name>.mcp.json.<uuid>.tmp`) are not swept.
- A sync finishing in the short window between a wrapped session's `waiting` write and its
  copy context resolving does not publish `ready` to it; the session's own readying task
  publishes it moments later.
- Known environment failures on this machine (not caused by this build, also failing before
  it): machine `aside-turns` Pi aside, `kimi` new login, two `plan-files` (port 7374 held by
  the live service); viewer two plan-directory tests in `app-slug.test.js`.

## Remediation rounds
