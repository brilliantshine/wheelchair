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
| 18 | Launch waits for the hand-over marker or the launcher ending, within one 5 s deadline; scope activation alone is not hand-over | Activation precedes `exec`; a launcher can still fail after it | review-round-2 |
| 19 | openbox start uses one 5 s deadline for registration and readiness, and kills the launcher at expiry | Separate waits could overrun, and a late openbox could survive | review-round-2 |
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

**Installer.** In `install.sh`, on Linux only (`platform` is not `Darwin`), before
`configure_service` is first called (`install.sh:474`), so the bookmark stays the last
line of output (`install/test/run.sh:188-191,575`), check each tool with `command -v`. Keep the same eight names as
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
- **Cleanup survives a failed write.** In `reset()`, a failing `save()` is logged and does
  not stop the rest: the `xauth` cookie is still removed and the map entry still deleted.
  `teardown()` always signals the slice (`gracefulSlice`) even if `reset()` threw, so
  Xvfb, openbox and apps never outlive a freed slot.

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
  to `wm.log` in the screen directory.
- **Readiness, one deadline.** A single deadline of 5 s from spawning openbox covers both
  waits. First registration (`registered()`, bounded by the time left), then polling
  `xprop -root _NET_SUPPORTING_WM_CHECK` (screen's `DISPLAY`/`XAUTHORITY`) every 100 ms.
  Each probe's timeout is `min(1000, time left)`. openbox counts as ready when that
  returns a window id.
- If the deadline passes first, or the spawn fails: SIGKILL the spawned `systemd-run`
  child if it is still running (so a late-registering openbox cannot start), stop the
  `wm` scope at once (`immediate(unit(screen, 'wm'))`), and carry on without it.
- Failing to start openbox is never fatal. The screen runs without it, the failure is
  logged with `service.log`, and `state.window_manager` is `null`. On success
  `state.window_manager` is `"openbox"`. `load()` defaults it to `null`, and `reset()`
  clears it.
- Teardown is unchanged: openbox's scope is in the screen's slice, so killing the slice
  ends it.
- **openbox exiting later.** Before each window op (`windows`, `focus`, `shot --window`,
  and `run`'s autofocus), when `state.window_manager` is `"openbox"`, query the `wm`
  scope with `systemctl --user show --property=ActiveState --value`. Only a confirmed
  inactive result clears the mode: the command succeeded and the state is not `active`,
  `activating` or `reloading`. Then set `state.window_manager` to `null`, save, and use
  today's behaviour for that op and after; openbox is not restarted. A failed or timed-out
  query changes nothing, and the op runs in openbox mode.
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
  seen.
- **Order after spawn.** First attach the child's `exit` and `error` listeners (the ones
  S6's wait reads), then set `pid`/`pgid` to `child.pid ?? null`, then `save()`. An
  asynchronous spawn failure leaves `child.pid` undefined, so both are stored as `null`.
  They are never omitted. If `spawn` throws, the record keeps `pid: null, pgid: null`.
- Teardown does not read them; teardown stays by slice (parent Decision 21).
  `status` adds `pid` to each app entry.

### S6. Launch that fails before the app starts

**What is detected.** Only failures before the command is handed over inside the scope:
`spawn` throwing or emitting `error`, and `systemd-run` failing to create the scope or to
exec. Anything after hand-over is the app's own outcome and still returns `ok: true`, with
`status` showing it `exited` and its log holding the reason. That includes a script with
a missing interpreter, a `codex sandbox` wrapper failing, or an app crashing at once.

**How hand-over is known.** The scope's command is prefixed with a marker step:
`sh -c '(umask 077; : > "$0") || exit 127; exec "$@"' <dir>/app-<n>.started <the existing command…>`.
The umask is set only in the subshell, so the app keeps the service's umask, and `exec`
runs only if the marker was created. The existing
command is `env -- …`, or `codex sandbox … -- env -- …` for sandboxed Codex sessions. The
marker sits outside the Codex sandbox, so the sandbox never has to write to the screen
directory. `exec` keeps the pid (S5 unchanged).

- `registered(child, unit, displayPromise)` returns
  `{ active, exited, code, error }`:
  - `active`: the scope was seen active, or the display marker was received.
  - `exited` and `code`: from the child's `exit` event, if it fired within the wait.
  - `error`: the message of an `error` event.

  Callers that ignore the return keep working.
- In `launch()`, record the log size just before `spawn`, then:
  - `spawn` throws: keep the app record (`pid: null`) and fail with 422
    `app did not start: <error message>`.
  - **Hand-over wait.** After spawn, wait until one of these, polling every 50 ms, with a
    single 5 s deadline from spawn. Scope activation alone does not end this wait;
    `registered()` runs inside it, bounded by the same deadline.
    - `app-<n>.started` exists: hand-over happened. Continue as today.
    - The child emitted `error`, or exited with any code (including a non-zero code, or
      `null` from a signal), and the marker does not exist: fail with 422
      `app did not start: <reason>`.
    - The deadline passes with neither: SIGKILL the child, stop the app scope at once
      (`immediate(unit)`), and fail with 422
      `app did not start: no hand-over within 5 s`.
  - The `<reason>` for a failed launch:
    the last non-empty line of the log bytes written since spawn, preferring the last line
    starting `Failed to`. If there is none, it is the error message or
    `systemd-run exited <code|signal>`.
  - In every failure case the app record stays (it shows `exited` in `status`) and autofocus is
    skipped.
- After hand-over, launch returns as today, `{ ok: true, app, log, focused }`. The marker file is
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
- S2, with `maxScreens: 1` (stop and failed-write cases also check the slice was signalled):
  - A second session's `start` gets the 422, and the first's screen is unaffected.
  - After stopping the first, the second starts.
  - Two simultaneous starts yield exactly one screen.
  - A start whose state write fails (e.g. a read-only screen directory) leaves no slot
    held, so a later start succeeds.
  - A screen whose final `save()` fails during start still has its cookie removed and
    its slice signalled.
- S3: after 52 shots, `shot-1.png` and `shot-2.png` are gone, 3–52 remain, and the next
  shot is `shot-53.png`. A non-shot file in the directory survives. A pruning error (e.g.
  an unreadable directory) still returns the shot.
- S4, with fake `openbox` and `xprop` on PATH:
  - A `wm` scope is started, and `status` shows `window_manager: "openbox"`.
  - `windows` uses `_NET_CLIENT_LIST`, and `focus` calls `windowactivate --sync`.
  - Without them: no `wm` scope, `null`, and today's calls.
  - A fake `xprop` that never reports `_NET_SUPPORTING_WM_CHECK`: the `wm` scope is
    stopped, the value is `null`, today's calls are used, and the screen is running by 5 s
    plus overhead.
  - A `systemctl show` that fails once during a window op leaves the mode as openbox.
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
    gives 422, and the app record is kept with `pid: null, pgid: null`.
  - A fake `systemd-run` that marks the scope active, then exits 1 without running the
    command, gives 422 (scope activation does not count as hand-over).
  - A fake `systemd-run` killed by a signal before running the command gives 422.
  - A fake `systemd-run` that hangs without running the command gives 422
    `app did not start: no hand-over within 5 s`, and the child is killed.
  - The marker file is mode `0600`, and the app sees the service's umask (not `077`).
- S7, with `baseDeadlineMs: 3000` and the default 1 s reserve, using a fake `xdotool`
  whose stalls are set per subcommand. A stall hangs until the process is killed, not for
  a fixed time:
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

**Lanes:** intent — claude; mechanics — gpt (no provider flag; the first start waited); cross-family: yes.

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
| intent | minor | The no-window-manager warning shows on every approval card on hearth; may teach Collin to skip the box | declined | Collin chose this option, whose text said the Ready check would say openbox is optional (Decision 7) |
| intent | minor | Checking the `wm` scope before each window op is heavy; use `xprop` instead | declined | `_NET_SUPPORTING_WM_CHECK` stays set on the root after openbox dies, so xprop alone can't tell; it's one call either way |
| mechanics | blocking | S6 can still succeed before hand-over (activation ends the wait; timeout; signal exit) | upheld | Bounded hand-over wait for marker or launcher end; timeout and signal give 422 (Decision 18) |
| mechanics | major | Failed `reset()` write skips cookie removal and slice kill | upheld | Cleanup continues; teardown always signals the slice |
| mechanics | major | Transient `systemctl` failure drops openbox mode | upheld | Only confirmed inactivity clears it |
| mechanics | major | openbox registration and readiness waits overlap; late openbox can survive | upheld | One 5 s deadline; kill the launcher at expiry (Decision 19) |
| mechanics | major | Listener/save ordering; undefined pid | upheld | Listeners, then pid `?? null`, then save |
| mechanics | minor | Marker mode depends on umask | upheld | Subshell `umask 077`; exec only if created |
| mechanics | minor | S7 stall must exceed both budgets | upheld | Stalls hang until killed |
| mechanics | minor | Installer warnings after the bookmark break the last-line test | upheld | Printed before `configure_service` |

### Round 3 — 2026-11-18

**Lanes:** intent and mechanics, families as started; cross-family: as recorded at start.

**Changed since Round 2:**
- S1: the installer warnings are printed before `configure_service`.
- S2: cleanup survives a failed write.
- S4: one 5 s deadline for registration and readiness, killing the launcher at expiry; only a confirmed-inactive scope clears openbox mode.
- S5: order after spawn; `?? null`.
- S6: bounded hand-over wait (timeout, signal and activation cases); marker umask.
- S7: stalls hang until killed.
- Decisions 18–19; Validation additions for each.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
