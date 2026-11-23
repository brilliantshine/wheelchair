---
slug: screen-window-manager
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-22
---

# A window manager for agent screens

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first. Mode: two-part.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | Collin picked Two-part | user |
| 2 | Each screen starts openbox when both `openbox` and `xprop` are on the service PATH; otherwise screens behave as today. Installer and approval warnings say it is optional and give `sudo apt install openbox` only | Collin's choice in the parent thread (screens-solid Decisions 7, 11, 17); `xprop` ships in x11-utils with `xwininfo`, already required | adopted |
| 3 | In openbox mode, windows are listed from the root's `_NET_CLIENT_LIST` and focused with `xdotool windowactivate --sync` | openbox reparents app windows into frames, so root children would be frames (screens-solid Decision 10) | adopted |
| 4 | openbox runs with a fixed rc.xml whose only bindings are click-to-focus (`Focus`, `Raise` in `Client`/`Frame`), and its config lookup is isolated to the screen directory | Default bindings open menus with `Execute`, which would run commands outside the Codex sandbox; openbox falls back to the desktop rc.xml if ours fails to load (screens-solid Decisions 21, 23). Sandbox bypass is always fixed, never deferred | adopted |
| 5 | openbox counts as running once `_NET_SUPPORTING_WM_CHECK` is set, within one 5 s deadline from spawning; otherwise it is killed and the screen runs without it | Scope registration doesn't mean openbox manages windows (screens-solid Decisions 16, 19) | adopted |
| 6 | openbox exiting mid-session (falling back to today's window handling) and an Xvfb liveness re-check after the readiness wait are deferred to the follow-up | Hardening for a crash after a healthy start; normal use works without them | defaulted |
| 7 | Tests gate openbox with an instance property `allowOpenbox` on `service.screens` (default `true`); the shared fake-tool fixture sets it `false` | So a host with openbox installed never starts it in unrelated tests (screens-solid Decision 20) | adopted |

## Spec

Builds on the merged screens work (PRs #113 and #122). File references are to this branch
at `43707808`. Screens are Linux-only; nothing below runs or warns on macOS. Evidence for
current behaviour: `docs/plans/screen-window-manager/MAP.md` and `docs/maps/agent-screens.md`.

### S1. Detecting openbox

`screenTools(searchPath)` in `machine/lib/screen.js:24` returns
`{ missing, openboxInstalled }`, where `openboxInstalled` is true when both `openbox` and
`xprop` are found by the same `findCommand` check. `missing` and `TOOLS` are unchanged
(openbox stays optional).

### S2. Approval card and installer

- **Approval card** (`machine/service.js:2375-2378`): on Linux, when `missing` is empty and
  `openboxInstalled` is false, add after the missing-tools check:
  `Screens on <hostname> have no window manager, so apps that need one may misbehave. Optional: sudo apt install openbox.`
  When tools are missing, only the existing missing-tools warning is shown. Information
  only; `ready` is unchanged.
- **Installer** (`install.sh:512-532`, Linux only): when no required tool is missing but
  `openbox` or `xprop` is missing, print to stderr:
  `screens: optional — no window manager; for apps that need one: sudo apt install openbox`.
  When required tools are missing, only the existing warning prints. Exit status unchanged,
  nothing installed, and it stays before `configure_service` so the bookmark remains the
  last line.

### S3. Starting openbox with a screen

In `start()` (`machine/lib/screen.js:139-185`), after the second `xauth add` and its fence
(`:174-175`), and before the state is saved as `running`:

- Only when `this.allowOpenbox` (instance property, default `true`, set in the
  constructor) and `screenTools().openboxInstalled` are both true. Otherwise skip this
  section entirely; `state.window_manager` is `null`.
- **Fixed config.** Write `<dir>/openbox/rc.xml` (directory `0700`, file `0600`): an empty
  `<keyboard/>` and a `<mouse>` section whose only bindings are, for each context `Client`
  and `Frame` and each button `Left`, `Middle`, `Right`, one `Press` binding running
  `Focus` then `Raise`. No `<menu>` section, no `Root` bindings, no other actions (in
  particular no `Execute` or `ShowMenu`). Clicking into a dialog focuses it; nothing an
  agent clicks or types can start a process.
- **Spawn.** `systemd-run` with `await this.scopeArgs(screen, 'wm')`, then
  `openbox --sm-disable --config-file <dir>/openbox/rc.xml` (plain `openbox`, never
  `openbox-session`, so no autostart). Environment: the service's env plus `DISPLAY` and
  `XAUTHORITY` set to the screen's, and `XDG_CONFIG_HOME`, `XDG_CONFIG_DIRS` and `HOME`
  all set to the screen directory, so no desktop or system rc.xml is ever read. stdout and
  stderr go to `<dir>/wm.log` (opened `0600`, append). Attach `exit` and `error`
  listeners at once that set a local `exited` flag.
- **Readiness.** Within one 5 s deadline from the spawn, every 100 ms run
  `xprop -root _NET_SUPPORTING_WM_CHECK` with the screen's `DISPLAY`/`XAUTHORITY` and a
  probe timeout of `min(1000, time left)`. Ready when its stdout contains a window id
  (`window id # 0x…`) and `exited` is false.
- **Not ready** (deadline passed, spawn error, or openbox exited first): SIGKILL the
  spawned child if still running, `this.immediate(this.unit(screen, 'wm'))`, log the
  reason with `this.service.log`, and carry on with `window_manager: null`. Never fatal.
- **Ready:** `state.window_manager = 'openbox'`.
- Then the existing fence runs before the `running` save, as today. In the catch path's
  "screen replaced" branch (`:180-181`), also stop the `wm` scope immediately when openbox
  was spawned. Teardown is otherwise unchanged: the `wm` scope is in the screen's slice.
- `load()` defaults `window_manager` to `null`; `reset()` and the start of `start()` set
  it to `null`.
- `status` (`:249-253`) adds `window_manager` (the state value, `null` when not running
  with openbox).

### S4. Windows in openbox mode

When `screen.state.window_manager === 'openbox'`:

- Every `ctx` passed to `screen-input.js` (`screen.js:192` in `launch`, `:257` in
  `execute`) gets `openbox: true`; otherwise `false`.
- `windows()` in `machine/lib/screen-input.js:31` takes ids from
  `xprop -root _NET_CLIENT_LIST` (same timeout handling as the current root query) instead
  of `xwininfo -root -children`. Parse the hex ids after `#`; an empty or absent property
  (`not found`, or no `#`) means no windows. Each id then goes through the existing
  `xwininfo -id` viewable check and parsing unchanged. This covers `listWindows`,
  `windowIds` and `autoFocus`.
- `focusWindow` runs `xdotool windowactivate --sync -- <id>` (10 s timeout as today).
  `autoFocus` uses the same command in place of `windowfocus`, keeping its own timeouts.
- Without openbox, every call is exactly as today. Ids reported are app windows in both
  modes, so `shot --window`, `focus` and `windows` keep working on the same ids.

### Non-goals

- Installing openbox or any tool; other window managers.
- Restarting openbox, or reacting to it exiting after a healthy start (Deferred).
- Changing teardown, the screen cap, launch hand-over, or Ready's `ok`/`missing`.
- macOS.

### Validation

Tests with fake tools in the existing style (`machine/test/screen.test.js`,
`machine/test/screen-input.test.js`, `machine/test/screen-tools-warning.test.js`,
`install/test/run.sh`). The shared fake-tool fixture sets
`service.screens.allowOpenbox = false`; openbox tests set it `true` and shim `openbox`
and `xprop`.

- `screenTools(searchPath)` with temp PATHs: `openboxInstalled` true only with both
  `openbox` and `xprop`.
- Approval warning: no-window-manager line present when tools are complete and openbox is
  absent; absent when openbox and xprop are present; only the missing-tools line when
  tools are missing; nothing off Linux.
- Installer: prints the optional line with a shimmed PATH lacking openbox (all required
  tools present), prints nothing extra when openbox and xprop exist, and nothing on Darwin;
  the bookmark is still the last line.
- With fake `openbox` (sets a flag file and sleeps) and fake `xprop` (reports
  `_NET_SUPPORTING_WM_CHECK` and a `_NET_CLIENT_LIST`): a `wm` scope is started; `status`
  shows `window_manager: "openbox"`; `windows` lists the client-list ids;
  `focus` calls `windowactivate --sync`; a launch's autofocus uses `windowactivate`.
- openbox invocation: `--sm-disable --config-file <dir>/openbox/rc.xml`, with
  `XDG_CONFIG_HOME`, `XDG_CONFIG_DIRS` and `HOME` equal to the screen directory. The file
  is `0600` in a `0700` directory, has an empty `<keyboard/>`, no `<menu>`, no `Execute`
  or `ShowMenu`, and its only actions are `Focus` and `Raise` in `Client` and `Frame`.
- Without openbox on PATH, or with `allowOpenbox = false`: no `wm` scope,
  `window_manager: null`, and the existing `xwininfo -root -children` / `windowfocus`
  calls.
- A fake `xprop` that never reports `_NET_SUPPORTING_WM_CHECK`: the `wm` scope is
  stopped, `window_manager` is `null`, and `start` returns within 5.5 s.
- A fake openbox that exits at once: `window_manager` is `null`, the screen runs.
- A session stopped during the readiness wait gets 409 and the screen is not saved as
  running.

Commands:

```bash
bash machine/test/run.sh
bash install/test/run.sh
node --test viewer/test/*.test.js
```

On hearth with real tools, `bash machine/test/screen-live.sh` still passes. When
`openbox` and `xprop` are installed, it also asserts `status` shows
`window_manager: "openbox"` and that `windows` lists the launched app's window.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | If openbox exits after a healthy start, the screen falls back to today's window handling | Only after a crash; normal use keeps openbox running | planning | Keep the spawned child (not `unref`'d); its `exit`/`error` listener, if the screen is still current at the same generation, sets `window_manager` to `null` and `trySave`s; `ctx.openbox` becomes a getter reading current state so a running autofocus switches. Baseline ids stay valid after the switch. See screens-solid Decision 22 at `e71d4e0` |
| 2 | After the readiness wait, re-check the display is still alive before saving `running` | Xvfb dying in the same 5 s window is a crash path | planning | `scopeActive(unit(screen, 'x'))`; not active → teardown and 422 `screen did not start`. See screens-solid S4 "Display still alive" at `e71d4e0` |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-22

**Lanes:** intent: pending; mechanics: pending; cross-family: pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
