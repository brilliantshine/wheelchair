---
slug: drive-local-app
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Agents run, screenshot and drive the app they build

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

(none open)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode two-part | Collin's pick | user |
| 2 | Works for any window the same way: launch, capture, mouse and keys; no app-specific setup | Collin's pick ("Any window") | user |
| 3 | The app runs on an invisible screen per agent, on the thread's machine (hearth) | Collin's pick ("Invisible screen") | user |
| 4 | Agents reach it as a command-line tool, not an MCP server | Every agent CLI can run a command and read an image file (Claude, Codex and Antigravity alike); MCP would leave Antigravity out (MAP.md) | defaulted |
| 5 | A screen is created on first use by a session and torn down when that session stops | Nothing runs when unused; sessions never share a screen | defaulted |
| 6 | Screenshots stay as files the agent reads; they reach the thread only when the lead posts an image card | Reuses the existing image card; no flood of pictures in the thread | defaulted |
| 7 | The agent chooses the launch command for the project; no per-project launch config | Matches "without app-specific setup" in IDEA.md | defaulted |
| 8 | Linux only in this part; macOS is out of this thread | IDEA.md constraints: runs on hearth | defaulted |
| 9 | Use the system tools Xvfb (screen), ffmpeg (capture) and xdotool (mouse and keys); xdotool is installed once on hearth through a sudo card; a missing tool is reported by name | Collin's pick ("Install xdotool once") | user |
| 10 | The machine service owns screens (route `POST /v1/agent/screen`) rather than agents starting Xvfb themselves | Teardown on session stop and archive, and one session cannot reach another's screen | defaulted |
| 11 | No window manager in this part | Tested on hearth: clicks and typing reach a Chromium window without one; WM moved to Deferred | defaulted |
| 12 | Five hardening items moved to Deferred (Ready check, crash cleanup, screen cap, screenshot cleanup, window manager) | Not needed for normal use | defaulted |

## Spec

### What this adds

A `screen` command group in `viewer/app/wc.js` that lets any agent session (lead, sub-lead,
worker, verifier, mapper; any CLI) get its own invisible X screen on the machine it runs on,
launch an app on it, take screenshots, and send mouse and keyboard input. The machine service
owns every screen, so screens and the apps on them are torn down with the session.

Linux only. Tools used: `Xvfb` (the invisible screen), `ffmpeg` with the `x11grab` device
(screenshots), `xdotool` (input and window listing). Checked on hearth on 2026-11-18:
Xvfb + ffmpeg captured a PNG of an `xmessage` window; Playwright's Chromium launched on the
screen in `--app` mode received a `xdotool click` (title changed) and `xdotool type` (input
received keys). Apps run without a window manager.

### Command surface (`wc.js screen <op> ...`)

Each op POSTs `{op, args}` to a new machine route `POST /v1/agent/screen`, authenticated with
the session token exactly like `/v1/agent/git` (`machine/service.js` `authorize()`), and prints
the JSON response to stdout. Failures exit non-zero with `{ok:false,error}`; `wc.js` follows
its existing request/print conventions for `git` and `session`.

| Op | Arguments | Does | Returns |
|---|---|---|---|
| `start` | `[--size WxH]` (default `1280x800`, each side 200–3840) | Starts the caller's screen if it has none; idempotent (a second `start` returns the existing screen, ignoring `--size`) | `{ok, display: ":N", size}` |
| `run` | `-- <command> [args...]` | Starts the screen if needed, then spawns the command with `DISPLAY=:N`, cwd the caller's worktree, the caller session's environment otherwise, detached in its own process group, stdout+stderr to a log file | `{ok, pid, log}` |
| `shot` | `[--window <id>]` | Captures the whole screen, or only that window's rectangle (geometry from `xdotool getwindowgeometry`, clipped to the screen), as PNG | `{ok, path, width, height}` |
| `windows` | none | Lists visible windows (`xdotool search --onlyvisible --name .`) | `{ok, windows: [{id, name, x, y, width, height}]}` |
| `move` | `<x> <y>` | Moves the pointer | `{ok}` |
| `click` | `<x> <y> [--button left\|middle\|right] [--double]` | Moves the pointer, then clicks | `{ok}` |
| `drag` | `<x1> <y1> <x2> <y2>` | Press at the first point, move, release at the second | `{ok}` |
| `type` | `<text>` | Types text into the focused window (`xdotool type --delay 20`) | `{ok}` |
| `key` | `<keys...>` | Presses xdotool key names or chords (`Return`, `ctrl+s`, `Left`) in order | `{ok}` |
| `focus` | `<window id>` | Focuses that window (`xdotool windowfocus`) | `{ok}` |
| `stop` | none | Kills the caller's apps and screen | `{ok}` |
| `status` | none | Whether the caller has a screen, its display, size and the pids of running apps | `{ok, running, ...}` |

Coordinates are screen pixels from the top-left. Without a window manager, keyboard input goes
to the focused window: `run` focuses the first visible window the app opens if one appears
within 5 s, and agents can `focus` explicitly. Every op except `start`, `run`, `stop` and
`status` fails with `no screen; run wc.js screen start first` when the caller has none.

### Machine service behaviour

- **Ownership:** at most one screen per session name. Op state (display number, Xvfb pid,
  app pids, counters) is kept in memory and in `<stateDir>/screens/<thread>/<session>/state.json`.
- **Starting a screen:** spawn `Xvfb -displayfd <fd> -screen 0 <W>x<H>x24 -nolisten tcp`
  (the local unix socket stays, since clients need it). The display number is read from `-displayfd`, so it never collides with screens already in use
  (tests on hearth use `:99`/`:100`). Wait until the number arrives (10 s timeout →
  `screen did not start`, kill the process).
- **Missing tools:** before starting, check `Xvfb`, `ffmpeg` and `xdotool` on PATH; if any is
  missing, return `{ok:false, error:"missing on this machine: <names>"}` with no partial state.
  On a non-Linux machine return `screens only work on Linux machines for now`.
- **Files:** screenshots go to `<stateDir>/screens/<thread>/<session>/shot-<n>.png` (n counts
  up from 1), app logs to `app-<n>.log` in the same directory. Paths are absolute, so the lead
  can post one with an `image` card and an agent can open it with its image-reading tool.
- **Screenshot:** `ffmpeg -loglevel error -y -f x11grab -video_size WxH -i :N[+x,y]
  -frames:v 1 <path>`, 15 s timeout.
- **Input:** each op runs `xdotool` with `DISPLAY=:N`, 10 s timeout; a non-zero exit returns
  `{ok:false,error:<last stderr line>}`.
- **Teardown:** `stop` op, and `MachineService.stop(name)` (which session stop and `archive()`
  both reach), kill each app's process group (SIGTERM, then SIGKILL after 3 s) and then Xvfb.
  `archive()` also removes `<stateDir>/screens/<thread>/` alongside the uploads it removes.
  A session whose Xvfb died is treated as having no screen (next `start` makes a new one).
- **Isolation:** a session can only act on its own screen; the route takes no display or
  session argument from the caller.
- **Environment:** session launch is unchanged: no `DISPLAY` is added to sessions. Agents
  either use `screen run` or prefix their own commands with the `display` that `start` returned.

### Rules for agents

- `protocol/app/worker.md`: a short section "Seeing a desktop app": when the task changes
  something visible in a desktop app or game, launch it with `wc.js screen run`, look with
  `shot` (open the PNG with your image-reading tool), drive it with `click`/`type`/`key`, and
  `stop` when done; never point it at Collin's live data; a missing-tools error is reported
  to the lead, not worked around.
- `protocol/app/verifier.md`: in the live-app paragraph, add that a desktop app or game is
  checked the same way on the session's invisible screen (not a headless browser), with the
  same isolation rules; a missing-tools error means COULD NOT TRY with that reason.
- `protocol/app/lead.md`: one line under "Diagrams" / `image` use: to show Collin what an agent
  saw, post its screenshot path with an `image` card. (Image cards already accept the path.)
- Reviewers do not get the command (read-only role).

### Docs

`machine/API.md` gains the `POST /v1/agent/screen` row; `machine/AGENTS.md` and
`viewer/AGENTS.md` routers name the new code's files.

### Not in this part

See IDEA.md "Not doing" and `## Deferred`. No macOS, no real desktop, no window manager, no
video, no Ready-check change.

### Validation

- `node --test viewer/test/*.test.js` — includes a new test that `wc.js screen <op>` builds the
  right request for every op and prints the response.
- `bash machine/test/run.sh` — includes new tests with fake `Xvfb` (writes a display number to
  the `-displayfd` fd), fake `ffmpeg` (writes a PNG) and fake `xdotool` in the fake bin dir:
  start/idempotent start, run spawns with `DISPLAY`, shot path and counter, windows parsing,
  input argument building, missing-tool error naming each missing tool, op without a screen,
  one session cannot reach another's screen, teardown on `stop` op, on session stop and on
  archive (screens dir removed).
- A live check script `machine/test/screen-live.sh` (skips with exit 0 and a `SKIP:` line when
  Xvfb, ffmpeg or xdotool is missing): starts a throwaway machine service the same way the
  machine tests do, or drives the screen module directly; launches Playwright's Chromium in
  `--app` mode on a `data:` page whose title changes on click and on key input; asserts the
  `shot` PNG exists and is non-empty, a `click` changes the window title, `type` changes it
  again, and after `stop` no Xvfb or Chromium process from the test remains. Run:
  `bash machine/test/screen-live.sh`.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | The Ready check and installer say when a machine lacks Xvfb, ffmpeg or xdotool | The command already names missing tools when used | planning | Ready: `viewer/app/ready.js:29-58`; machine status `machine/service.js:1156-1171`; installer warnings pattern `install.sh:25-27` |
| 2 | Clean up screens and apps left behind when the machine service restarts or crashes | Normal stop and archive already tear down; this is the crash path | planning | Read `<stateDir>/screens/*/*/state.json` at service start and kill recorded pids that are still Xvfb or their app groups |
| 3 | A limit on how many screens run at once | One per session already bounds it; hearth has room | planning | Memory per Xvfb at 1280x800x24 is small; add a cap with a clear error |
| 4 | Old screenshots removed before the thread is archived | Files are small and archive removes them | planning | Directory `<stateDir>/screens/<thread>/<session>/` |
| 5 | A window manager on the screen, for apps that need one (resizing, full screen, dialog placement) | Apps tested without one work; keys go via explicit focus | planning | Candidate: a minimal WM started per screen if present on PATH |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| Heavy 3D may be slow or fail on the invisible screen (software rendering, no graphics card) | Accepted in IDEA.md constraints | planning |

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-18: xdotool installed on hearth by Collin (sudo card, exit 0).
