---
slug: screens-solid
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Make agent screens solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md` and `docs/maps/agent-screens.md`. Parent plan:
`docs/plans/drive-local-app/PLAN.md` on branch `wc/940599e3df66` (merged as PR #113).

## Open Questions

_None open._

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked Thorough | user |
| 2 | Archive deletion of screenshots already exists; the screenshot item becomes pruning while the thread is open | MAP.md: archive removes `<stateDir>/screens/<thread>/` (`machine/lib/screen.js:72`) | defaulted |
| 3 | Screen cap is machine-wide, 8 running-or-starting screens, overridable by `WHEELCHAIR_MAX_SCREENS`; past the cap `start`/`run` return 422 naming the cap and how many run | hearth: 16 cores, 27 GB; Xvfb plus an app is a few hundred MB | defaulted |
| 4 | Pruning keeps the newest 50 screenshots per session, pruned after each new shot | Agents read the latest shots; image cards copy the file, so older ones are safe to delete | defaulted |
| 5 | Launch failure and drag overrun use the approaches in the parent's Deferred rows 7 and 8 | Already evidenced and agreed there | adopted |
| 6 | App pid and process group recorded in state.json from the scope's MainPID once active; unread by teardown (still by slice) | Parent Spec Ownership line; Decision 21 there | adopted |
| 7 | Support openbox: each screen starts openbox when it is on the service PATH; without it screens behave as today. Installer and Ready say it is optional and give `sudo apt install openbox` | Collin picked Support openbox | user |
| 8 | Missing screen tools only warn; they never set Ready `ok: false` | Collin picked Just warn | user |
| 9 | The warning rides on the approval card's machine-added `warnings` (next to the startup-size warning), computed by the thread's machine service when a lead posts an approval; `viewer/app/ready.js` and `/v1/status` are unchanged | `warnings` already exist for exactly this (service.js:1571-1574); a status field nothing reads would be dead code | defaulted |
| 10 | With openbox running, windows are listed from the root's `_NET_CLIENT_LIST` (via `xprop`) and `focus` uses `xdotool windowactivate`; without it both behave as today | A reparenting window manager makes root children frame windows, so today's listing would return frames, not app windows (screen-input.js:31-35) | defaulted |
| 11 | openbox is started only when both `openbox` and `xprop` are on the service PATH | Decision 10 needs `xprop`; otherwise screens behave as today | defaulted |
| 12 | Screenshots are kept when a session stops; only the per-session cap of 50 and archive remove them | A lead posts a stopped agent's screenshot from its report (lead.md, Diagrams); deleting on stop would break that | review-round-1 |
| 13 | The screen cap is a `maxScreens` constructor option (default 8), no environment variable; supersedes Decision 3's override | The service unit sets only PATH (install.sh:398), so the variable could only serve tests | review-round-1 |
| 14 | App pid = pgid = the detached spawned child's pid; supersedes Decision 6's MainPID | One source; known at spawn even when the app exits early | review-round-1 |
| 15 | Launch failure is detected by a marker file written inside the scope just before hand-over, not by never-active plus a `Failed to` line; only pre-hand-over failures are errors; supersedes Decision 5's S6 approach | The old test misreads a fast app printing `Failed to`, and misses spawn errors | review-round-1 |
| 16 | openbox counts only once `_NET_SUPPORTING_WM_CHECK` is set; otherwise its scope is stopped. If it later exits, the screen drops back to today's window handling | Scope registration doesn't mean openbox is managing windows | review-round-1 |
| 17 | The optional hint says `sudo apt install openbox` only | `xprop` ships in x11-utils with `xwininfo`, which screens already need | review-round-1 |

## Spec

Builds on the merged screens work (`wc.js screen`, PR #113). Everything in
`docs/plans/drive-local-app/PLAN.md` (branch `wc/940599e3df66`) still holds unless changed
here. File references are to `main` at `e4117bd`. Screens are Linux-only; nothing below
runs or warns on macOS.

### S1. Missing screen tools: installer warning and approval-card warning

**Tool list.** The required tools are `TOOLS` in `machine/lib/screen.js:10`
(`Xvfb, xauth, mcookie, ffmpeg, xdotool, xwininfo, systemd-run, systemctl`). Export a
function from `machine/lib/screen.js`, `screenTools(searchPath = process.env.PATH)`,
returning `{ missing: [names in TOOLS order], windowManager: boolean }`, where
`windowManager` is true when both `openbox` and `xprop` are found (S4). It uses the same
`findCommand` check `start()` uses, so the two never disagree. `start()` uses it for its
existing missing-tools 422 (message unchanged).

**Approval card.** In `machine/service.js`, where a lead's `approval` card gets
`input.warnings` (`:1571-1574`), on Linux also add, in this order after the startup-size
warning:

- when `missing` is non-empty: `Screens won't work on <hostname>: missing <a, b>. Builds that don't use a screen are unaffected.`
- when `missing` is empty and `windowManager` is false: `Screens on <hostname> have no window manager, so apps that need one may misbehave. Optional: sudo apt install openbox.`

`<hostname>` is `os.hostname()`. `warnings` is present only when it has at least one
entry, and holds at most 10 (the card validator's limit, `viewer/app/card.js:171`). These
are information only: `ready`, `viewer/app/ready.js` and `/v1/status` do not change, and
Start building is never blocked by them.

**Installer.** In `install.sh`, on Linux only (`platform` is not `Darwin`), after the
existing service setup, check each tool with `command -v`. Keep the same eight names as
`TOOLS`, with a comment in both places saying to keep them in step. Print to stderr:

- when any are missing: `screens: warning — missing <names>; agents can't use screens until they're installed (Debian: sudo apt install <packages>)`. Map each missing tool to its
  Debian package: Xvfb→xvfb, xauth→xauth, mcookie→util-linux, ffmpeg→ffmpeg,
  xdotool→xdotool, xwininfo→x11-utils, systemd-run/systemctl→systemd. List each package once.
- otherwise, when `openbox` or `xprop` is missing: `screens: optional — no window manager; for apps that need one: sudo apt install openbox`.
- otherwise nothing.

The installer never installs anything and its exit status is unchanged.

### S2. Screen limit

- A machine-wide cap on screens held by the service: every entry in
  `ScreenManager.screens` (starting or running) counts.
- The cap is 8. `ScreenManager` takes an optional constructor option `maxScreens`
  (positive integer, default 8) so tests can set it; there is no environment variable.
- Checked in `start()` only when a new screen would be created (a reused running screen
  never counts against the cap). The check and `this.screens.set(...)` happen with no
  `await` between them, so two sessions starting at once cannot both slip under the cap.
- Past the cap, `start` and `run` fail with 422:
  `screen limit reached: <n> screens running on this machine (limit <cap>); try again later`. Nothing is created and no state file changes.
- A screen leaves the count exactly when it leaves `screens` today (teardown, reset, stop,
  archive, sweep).
- **No stranded slots.** If the first `save()` after `this.screens.set(...)` in `start()`
  throws, the entry is deleted from `screens` (if it is still that screen) before the
  error propagates. `reset()` deletes the entry in a `finally`, so a failing `save()` there
  still frees the slot. A failed start therefore never holds a slot, and the same session
  can retry.

### S3. Screenshot pruning

- After a `shot` succeeds and its file has been renamed into place (`screen.js:229`;
  `screen-input.js:63`), delete that session's older screenshots so at most the newest 50
  `shot-<n>.png` files remain in the session's screen directory, keeping the highest `n`.
- Only files matching `^shot-(\d+)\.png$` are touched; `.tmp-*` files, logs, `state.json`
  and `xauth` never are.
- The whole pruning pass (listing the directory and each deletion) is wrapped so any
  error is logged with `service.log` and never fails the shot. The shot's result is
  unchanged.
- Screenshots are not deleted when a session stops: a lead may post a stopped agent's
  screenshot from its report (see Accepted Risks).
- `next_shot` numbering is unchanged: numbers are never reused after pruning.
- Archive's existing removal of the whole thread directory is unchanged.

### S4. Window manager (openbox)

- In `start()`, after the display number is known and its xauth entry is written, and
  before the state is saved as `running`: if `screenTools().windowManager` is true, start
  `openbox --sm-disable` in its own scope in the screen's slice
  (`scopeArgs(screen, 'wm')`), with `DISPLAY` and `XAUTHORITY` set to the screen's, stdio
  to `wm.log` in the screen directory, and wait for registration as apps do
  (`registered()`, up to 3 s).
- **Readiness.** openbox counts as ready only when `xprop -root _NET_SUPPORTING_WM_CHECK`
  (screen's `DISPLAY`/`XAUTHORITY`, 1 s timeout per probe) returns a window id. Poll every
  100 ms for up to 3 s after spawning. If it is not ready by then, or the spawn fails, stop
  the `wm` scope at once (`immediate(unit(screen, 'wm'))`) and carry on without it.
- Failing to start openbox is never fatal. The screen runs without it, the failure is
  logged with `service.log`, and `state.window_manager` is `null`. On success
  `state.window_manager` is `"openbox"`. `load()` defaults it to `null`, and `reset()`
  clears it.
- Teardown is unchanged: openbox's scope is in the screen's slice, so killing the slice
  ends it.
- **openbox exiting later.** Before each window op (`windows`, `focus`, `shot --window`,
  and `run`'s autofocus), when `state.window_manager` is `"openbox"`, check the `wm` scope
  with `scopeActive`. If it is not active, set `state.window_manager` to `null`, save, and
  use today's behaviour for that op and after. It is not restarted.
- `status` adds `window_manager` (the state value).
- **Windows with openbox running** (`state.window_manager === "openbox"`):
  - Listing windows (`windows`, `windowIds`, `autoFocus` baseline and polling) takes ids
    from `xprop -root _NET_CLIENT_LIST`, not root children. Each id then goes through the
    same `xwininfo -id` viewable check and parsing as today. Empty or absent property means
    no windows.
  - `focus <id>` runs `xdotool windowactivate --sync -- <id>` with the existing 10 s
    timeout. `autoFocus` uses the same command (`windowactivate --sync`) in place of its
    current focus command, but keeps its own timings: 1 s probe timeout and the 6 s phase
    deadline.
  - Without openbox, both behave exactly as today.
  - `screen-input.js` gets the mode from `ctx.windowManager`, set by `screen.js` where it
    builds `ctx`.
- Window ids reported are app (client) windows in both modes, so `shot --window`,
  `focus` and `windows` keep working on the same ids.

### S5. App process ids in state

- Each app record in `state.json` gains `pid` and `pgid`. `systemd-run --scope` execs the
  command in place, and the launch is spawned with `detached: true`. So the spawned
  child's pid is the top process of the app's scope, and it leads its own process group:
  `pid = pgid = child.pid`. For Codex sessions that top process is the `codex sandbox`
  wrapper; this is expected and is said so in a code comment.
- This is the only pid source (it supersedes Decision 6's MainPID). It is known as soon
  as `spawn` returns, so it is recorded even when the app exits before registration is
  seen. It is written in the `save()` right after `spawn`. If `spawn` throws, the record
  keeps `pid: null, pgid: null`.
- Teardown does not read them; teardown stays by slice (parent Decision 21).
  `status` adds `pid` to each app entry.

### S6. Launch that fails before the app starts

**What is detected.** Only failures before the command is handed over inside the scope:
`spawn` throwing or emitting `error`, and `systemd-run` failing to create the scope or to
exec. Anything after hand-over is the app's own outcome and still returns `ok: true`, with
`status` showing it `exited` and its log holding the reason. That includes a script with
a missing interpreter, a `codex sandbox` wrapper failing, or an app crashing at once.

**How hand-over is known.** The scope's command is prefixed with a marker step:
`sh -c ': > "$0"; exec "$@"' <dir>/app-<n>.started <the existing command…>`. The existing
command is `env -- …`, or `codex sandbox … -- env -- …` for sandboxed Codex sessions. The
marker sits outside the Codex sandbox, so the sandbox never has to write to the screen
directory. `exec` keeps the pid (S5 unchanged). The marker file is created in the screen
directory, `0600`.

- `registered(child, unit, displayPromise)` returns
  `{ active, exited, code, error }`:
  - `active`: the scope was seen active, or the display marker was received.
  - `exited` and `code`: from the child's `exit` event, if it fired within the wait.
  - `error`: the message of an `error` event.

  Callers that ignore the return keep working.
- In `launch()`, record the log size just before `spawn`, then:
  - `spawn` throws: keep the app record (`pid: null`) and fail with 422
    `app did not start: <error message>`.
  - After `registered()`, if the child emitted `error`, or exited with a non-zero code,
    and `app-<n>.started` does not exist: fail with 422 `app did not start: <reason>`.
    `<reason>` is the last non-empty line of the log bytes written since spawn, preferring
    the last line starting `Failed to`. If there is none, it is the error message or
    `systemd-run exited <code>`.
  - In both cases the app record stays (it shows `exited` in `status`) and autofocus is
    skipped.
- Otherwise launch returns as today, `{ ok: true, app, log, focused }`. The marker file is
  left in place; it is small and goes with the directory on archive.

### S7. Drag within 10 seconds

- In `pointer()` (`screen-input.js:69-80`), `drag` gets a reserve for mouseup:
  `mouseupReserveMs`, a new test-hook option next to `baseDeadlineMs`, default 1000.
- The moves and mousedown use the deadline `end - mouseupReserveMs`.
- The guaranteed mouseup's timeout is `Math.max(0, end - Date.now())`, which is at least
  the reserve unless a step overran.
- A drag therefore finishes within the base deadline (10 s in production) plus process
  overhead. Mouseup is still always attempted, and the first error still wins.
- `move` and `click` are unchanged.
- The existing drag test that uses `baseDeadlineMs: 100` (`machine/test/screen-input.test.js:39`)
  passes `mouseupReserveMs: 25`.

### Non-goals

- Installing any tool or window manager.
- Changing teardown (still by systemd user slice).
- Window managers other than openbox.
- Pruning app logs.
- New screen commands.
- Changes to the Ready check's `ok`/`missing`.

### Validation

Every item gets a test with fake tools in the existing style (`machine/test/screen.test.js:21-60`,
`machine/test/screen-input.test.js:8-27`, `install/test/run.sh`):

- S1: approval-card warnings with tools missing, with no window manager, and with
  everything present (no screen warning). Linux-only lines are absent when the platform
  is not Linux, if the service has a platform seam; otherwise the test is skipped off
  Linux. Installer prints each message in a temp home with a shimmed PATH, and prints
  nothing on Darwin.
- S2, with `maxScreens: 1`:
  - A second session's `start` gets the 422, and the first's screen is unaffected.
  - After stopping the first, the second starts.
  - Two simultaneous starts yield exactly one screen.
  - A start whose state write fails (e.g. a read-only screen directory) leaves no slot
    held, so a later start succeeds.
- S3: after 52 shots, `shot-1.png` and `shot-2.png` are gone, 3–52 remain, and the next
  shot is `shot-53.png`. A non-shot file in the directory survives. A pruning error (e.g.
  an unreadable directory) still returns the shot.
- S4, with fake `openbox` and `xprop` on PATH:
  - A `wm` scope is started, and `status` shows `window_manager: "openbox"`.
  - `windows` uses `_NET_CLIENT_LIST`, and `focus` calls `windowactivate --sync`.
  - Without them: no `wm` scope, `null`, and today's calls.
  - A fake `xprop` that never reports `_NET_SUPPORTING_WM_CHECK`: the `wm` scope is
    stopped, the value is `null`, and today's calls are used.
  - A `wm` scope that goes inactive after start: the next `windows` call switches to
    `null` and today's calls.
- S5: `state.json` app record has numeric `pid` equal to `pgid`, and `status` shows `pid`.
- S6:
  - A fake `systemd-run` that writes `Failed to start transient scope unit: boom` to
    stderr and exits 1 without running the command gives 422
    `app did not start: Failed to start transient scope unit: boom`.
  - An app that runs (marker created) and prints `Failed to x` then exits 1 within 10 ms
    returns `ok: true`.
  - A script whose interpreter is missing returns `ok: true`, and `status` shows it
    `exited`.
  - `spawn` emitting `error` (e.g. `systemd-run` removed from PATH after the tool check)
    gives 422, and the app record is kept.
- S7, with `baseDeadlineMs: 3000` and the default 1 s reserve, using a fake `xdotool`
  whose stalls are set per subcommand:
  - The second `mousemove` hangs and `mouseup` returns at once: the drag rejects in under
    3.3 s, and `mouseup` was called.
  - The second `mousemove` hangs and `mouseup` also hangs: the drag rejects in under
    3.3 s, and `mouseup` was attempted.
  - With the old code, the second case takes about 4 s, so the test fails.

Commands:

```bash
bash machine/test/run.sh
bash install/test/run.sh
node --test viewer/test/*.test.js
```

On hearth with the real tools, `bash machine/test/screen-live.sh` still passes. When
openbox is installed, the live test also asserts `status` shows `window_manager:
"openbox"`, and that `windows` lists the launched app's window.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A thread keeps up to 50 screenshots per screen-using session until it is archived | Deleting on session stop would break posting a stopped agent's screenshot; growth is bounded per session | 1 |

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | S3 per-shot pruning leaves up to 50 per stopped session; delete on stop | downgraded (minor) | Deleting on stop breaks the lead posting a stopped agent's screenshot (lead.md Diagrams); growth is bounded. Accepted Risk; Decision 12 |
| intent | minor | `xprop`/x11-utils in the WM gate and hint are redundant | upheld | Hint is openbox only (Decision 17); `xprop` check kept since S4 uses it |
| intent | minor | S6 misses `codex sandbox` failing after hand-over; say so | upheld | S6 "What is detected" names it |
| intent | minor | `WHEELCHAIR_MAX_SCREENS` only serves tests | upheld | Constructor option (Decision 13) |
| mechanics | blocking | Scope registration isn't proof openbox is ready; no recovery if it exits | downgraded (major) | Implementable as written, only missing edge cases. Fixed: readiness via `_NET_SUPPORTING_WM_CHECK`, fallback on exit, live assertion (Decision 16) |
| mechanics | blocking | S6 misses post-hand-over failures and misreads fast apps printing `Failed to` | upheld | Marker-file design; detected scope stated (Decision 15) |
| mechanics | major | S6 omits spawn errors (sync throw → 500) | upheld | Both cases give 422 and keep the record |
| mechanics | major | Cap slot stranded when a state write fails | upheld | Rollback on the first save; `reset()` frees in `finally` |
| mechanics | major | S5 has two pid sources | upheld | `child.pid` only (Decision 14) |
| mechanics | major | S7 test can't fail the old code; 100 ms fixture vs 1 s reserve | upheld | Separate stalls; `mouseupReserveMs` hook; old code fails |
| mechanics | minor | Autofocus timeout ambiguous | upheld | Keeps its 1 s / 6 s timings |
| mechanics | minor | Pruning enumeration errors unspecified | upheld | Whole pass logged and swallowed |

### Round 2 — 2026-11-18

**Lanes:** intent — claude; mechanics — not claude; cross-family: yes.

**Changed since Round 1:**
- S1: the optional hint is openbox only.
- S2: `maxScreens` constructor option replaces the environment variable; no stranded slots on failed writes.
- S3: the whole pruning pass is error-safe; no deletion on session stop (Accepted Risk).
- S4: readiness via `_NET_SUPPORTING_WM_CHECK`; fallback when openbox exits; autofocus timings; live assertion.
- S5: one pid source.
- S6: rewritten around a hand-over marker file; spawn errors.
- S7: `mouseupReserveMs` hook; stronger tests.
- Decisions 12–17.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
