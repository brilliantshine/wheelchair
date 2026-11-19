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
- when `missing` is empty and `windowManager` is false: `Screens on <hostname> have no window manager, so apps that need one may misbehave. Optional: sudo apt install openbox x11-utils.`

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
- otherwise, when `openbox` or `xprop` is missing: `screens: optional — no window manager; for apps that need one: sudo apt install openbox x11-utils`.
- otherwise nothing.

The installer never installs anything and its exit status is unchanged.

### S2. Screen limit

- A machine-wide cap on screens held by the service: every entry in
  `ScreenManager.screens` (starting or running) counts.
- The cap is 8 by default. `WHEELCHAIR_MAX_SCREENS` in the service's environment
  overrides it when it is a positive integer. Any other value is ignored (the default
  applies) and logged once at construction.
- Checked in `start()` only when a new screen would be created (a reused running screen
  never counts against the cap). The check and `this.screens.set(...)` happen with no
  `await` between them, so two sessions starting at once cannot both slip under the cap.
- Past the cap, `start` and `run` fail with 422:
  `screen limit reached: <n> screens running on this machine (limit <cap>); try again later`. Nothing is created and no state file changes.
- A screen leaves the count exactly when it leaves `screens` today (teardown, reset, stop,
  archive, sweep).

### S3. Screenshot pruning

- After a `shot` succeeds and its file has been renamed into place (`screen.js:229`;
  `screen-input.js:63`), delete that session's older screenshots so at most the newest 50
  `shot-<n>.png` files remain in the session's screen directory, keeping the highest `n`.
- Only files matching `^shot-(\d+)\.png$` are touched; `.tmp-*` files, logs, `state.json`
  and `xauth` never are.
- Deletion errors are logged with `service.log` and never fail the shot. The shot's
  result is unchanged.
- `next_shot` numbering is unchanged: numbers are never reused after pruning.
- Archive's existing removal of the whole thread directory is unchanged.

### S4. Window manager (openbox)

- In `start()`, after the display number is known and its xauth entry is written, and
  before the state is saved as `running`: if `screenTools().windowManager` is true, start
  `openbox --sm-disable` in its own scope in the screen's slice
  (`scopeArgs(screen, 'wm')`), with `DISPLAY` and `XAUTHORITY` set to the screen's, stdio
  to `wm.log` in the screen directory, and wait for registration as apps do
  (`registered()`, up to 3 s).
- Failing to start openbox is never fatal. The screen runs without it, the failure is
  logged with `service.log`, and `state.window_manager` is `null`. On success
  `state.window_manager` is `"openbox"`. `load()` defaults it to `null`, and `reset()`
  clears it.
- Teardown is unchanged: openbox's scope is in the screen's slice, so killing the slice
  ends it.
- `status` adds `window_manager` (the state value).
- **Windows with openbox running** (`state.window_manager === "openbox"`):
  - Listing windows (`windows`, `windowIds`, `autoFocus` baseline and polling) takes ids
    from `xprop -root _NET_CLIENT_LIST`, not root children. Each id then goes through the
    same `xwininfo -id` viewable check and parsing as today. Empty or absent property means
    no windows.
  - `focus <id>` runs `xdotool windowactivate --sync -- <id>` with the existing 10 s
    timeout. `autoFocus` focuses the same way.
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
- They are written in the same `save()` that follows registration. If `spawn` itself
  throws, the record keeps `pid: null, pgid: null`.
- Teardown does not read them; teardown stays by slice (parent Decision 21).
  `status` adds `pid` to each app entry.

### S6. Launch that fails before the app starts

- `registered(child, unit, displayPromise)` returns
  `{ active: boolean, exited: boolean, code: number|null }`: `active` true when the scope
  was seen active (or the display marker was received), `exited` and `code` from the
  child's `exit` event if it fired within the wait. Existing callers that ignore the
  return keep working.
- In `launch()`, record the log file's size just before spawning. After `registered()`:
  if the scope was never seen active, the child exited with a non-zero code, and the log
  bytes after the recorded size contain a line starting `Failed to` (systemd-run's own
  error), launch fails with 422 `app did not start: <that line, trimmed>`.
  - The app record stays in `state.json` (it shows as `exited` in `status`).
  - Autofocus is skipped.
  - If several lines match, use the last.
- In every other case launch returns as today, `{ ok: true, app, log, focused }`. A fast
  app that exits on its own without a `Failed to` line is not an error.

### S7. Drag within 10 seconds

In `pointer()` (`screen-input.js:69-80`), for `drag` the moves and mousedown use a
deadline of `end - 1000` (1 s reserved). The guaranteed mouseup gets
`Math.max(0, end - Date.now())` as its timeout, which is still at least the reserved 1 s
unless the steps overran. A drag therefore finishes within the base deadline (10 s in
production) plus process overhead. Mouseup is still always attempted, and the first error
still wins. `move` and `click` are unchanged.

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
- S2: with `WHEELCHAIR_MAX_SCREENS=1`, a second session's `start` gets the 422 and the
  first's screen is unaffected. After stopping the first, the second starts. Two
  simultaneous starts at cap 1 yield exactly one screen. An invalid value means 8.
- S3: after 52 shots, `shot-1.png` and `shot-2.png` are gone, 3–52 remain, and the next
  shot is `shot-53.png`. A non-shot file in the directory survives.
- S4: with fake `openbox` and `xprop` on PATH, a `wm` scope is started, `status` shows
  `window_manager: "openbox"`, `windows` uses `_NET_CLIENT_LIST`, and `focus` calls
  `windowactivate`. Without them: no `wm` scope, `null`, and today's calls. A fake
  openbox that fails leaves the screen running with `null`.
- S5: `state.json` app record has numeric `pid` equal to `pgid`, and `status` shows `pid`.
- S6: fake `systemd-run` that writes `Failed to start transient scope unit: boom` to
  stderr and exits 1 without activating → 422 `app did not start: Failed to start
  transient scope unit: boom`. An app that activates then exits 1 → `ok: true`. Exits
  non-zero without activating and without a `Failed to` line → `ok: true`.
- S7: with `baseDeadlineMs: 3000` and a fake `xdotool` whose `mousemove` hangs, drag
  rejects in under 3.3 s and `mouseup` was called.

Commands:

```bash
bash machine/test/run.sh
bash install/test/run.sh
node --test viewer/test/*.test.js
```

On hearth with the real tools, `bash machine/test/screen-live.sh` still passes. If
openbox is installed, it also passes with it.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent lens and mechanics lens, families as started; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
