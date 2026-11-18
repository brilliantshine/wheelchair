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
| 13 | Pulled cleanup after a machine service restart back from Deferred into the Spec | `./install.sh` restarts the service with `KillMode=process`, so every install would orphan live screens (install.sh:401,410) | review-round-1 |
| 14 | Apps launch only through `screen run`, run by the service with the session's launch environment plus `--env`, inside `codex sandbox` for a sandboxed Codex session; reviewers refused | Keeps each agent's own limits; a Codex agent's own background process dies with its command (checked on hearth) | review-round-1 |
| 15 | Each screen gets an access cookie (`-auth`) | Stops a mistyped display reaching another session's screen | review-round-1 |
| 16 | Per-session op queue; stopping sessions refuse new screens; teardown also when tmux is found dead and on a 60 s sweep | Closes start/stop races and sessions that die without `stop()` | review-round-1 |

## Spec

### What this adds

A `screen` command group in `viewer/app/wc.js` that lets an agent session (lead, sub-lead,
worker, verifier, mapper; any CLI; never a reviewer) get its own invisible X screen on the
machine it runs on, launch an app on it, take screenshots, and send mouse and keyboard input.
The machine service owns every screen and every app launched on one, so they are torn down
with the session.

Linux only (including WSL2, untested). Tools used: `Xvfb` (the invisible screen), `xauth`
and `mcookie` (a per-screen access cookie), `ffmpeg` with the `x11grab` device
(screenshots), `xdotool` (input and window listing). Checked on hearth on 2026-11-18:
Xvfb + ffmpeg captured a PNG of an `xmessage` window; Playwright's Chromium launched on the
screen in `--app` mode received a `xdotool click` (title changed) and `xdotool type` (input
received keys); a command inside Codex's `workspace-write` sandbox (`codex sandbox -c
sandbox_mode="workspace-write" -c sandbox_workspace_write.network_access=true -- ...`)
connected to an Xvfb display; that sandbox runs commands in their own process namespace, so a
background process started by a Codex agent's own shell does not outlive the command. Apps
run without a window manager.

### Command surface (`wc.js screen <op> ...`)

Each op POSTs `{op, args}` to a new machine route `POST /v1/agent/screen`, authenticated with
the session token exactly like `/v1/agent/git` (`machine/service.js` `authorize()`).
Success is `200` with a JSON body, printed to stdout, exit 0. Failure is a non-2xx status
(`400` bad arguments, `403` role or session not allowed, `409` session stopping or stopped,
`422` op failed, `503` missing tools or unsupported platform) with `{error}`; `wc.js` handles
it on its existing non-2xx path (`viewer/app/wc.js:170-171`: message on stderr prefixed
`wc: `, exit 1). The `screen` group uses the plain `request()` path, not the session retry.

| Op | Arguments | Does | Returns |
|---|---|---|---|
| `start` | `[--size WxH]` (default `1280x800`, each side 200–3840) | Starts the caller's screen if it has none; idempotent (a second `start` returns the existing screen, ignoring `--size`) | `{ok, display: ":N", size}` |
| `run` | `[--env KEY=VALUE]... -- <command> [args...]` | Starts the screen if needed, then launches the command on it (see "Launching apps") | `{ok, app: <n>, log}` |
| `shot` | `[--window <id>]` | Captures the whole screen, or only that window's rectangle (geometry from `xdotool getwindowgeometry`, clipped to the screen; `422` if the window is gone or wholly off screen), as PNG | `{ok, path, width, height}` |
| `windows` | none | Lists visible windows, titled or not | `{ok, windows: [{id, name, x, y, width, height}]}` (`name` is `""` for untitled) |
| `move` | `<x> <y>` | Moves the pointer | `{ok}` |
| `click` | `<x> <y> [--button left\|middle\|right] [--double]` | Moves the pointer, then clicks | `{ok}` |
| `drag` | `<x1> <y1> <x2> <y2>` | Press at the first point, move, release at the second | `{ok}` |
| `type` | `<text>` | Types text into the focused window (`xdotool type --delay 20`) | `{ok}` |
| `key` | `<keys...>` | Presses xdotool key names or chords (`Return`, `ctrl+s`, `Left`) in order | `{ok}` |
| `focus` | `<window id>` | Focuses that window (`xdotool windowfocus`) | `{ok}` |
| `stop` | none | Tears down the caller's apps and screen (see "Teardown") | `{ok}` |
| `status` | none | Whether the caller has a screen, its display and size, and each app's number, state (`running`/`exited`) and log | `{ok, running, ...}` |

Coordinates are screen pixels from the top-left. Without a window manager, keyboard input goes
to the focused window: `run` focuses the first visible window the app opens if one appears
within 5 s, and agents can `focus` explicitly. Every op except `start`, `run`, `stop` and
`status` fails `422 no screen; run wc.js screen start first` when the caller has none.

**Window listing:** `xdotool search --onlyvisible --name ''` (the empty pattern matches
untitled windows too), then `getwindowname` and `getwindowgeometry` per id. A search that
exits non-zero with no output means no windows: return `windows: []`, not an error. The live
check below must include an untitled window.

### Launching apps

Agents launch apps only through `run`, never by setting `DISPLAY` themselves (an app started
from a Codex agent's shell dies when its command ends, and an app the service did not start
is not torn down). `start` returns the display for information only.

- The service spawns the command detached in its own process group, cwd the caller's
  worktree, stdout+stderr to `<stateDir>/screens/<thread>/<session>/app-<n>.log`.
- **Environment:** the same environment the session's CLI was launched with (the service's
  own environment plus the variables `startIn()` adds for the session, `machine/service.js`
  around 606-627), plus `DISPLAY=:N` and `XAUTHORITY=<the screen's cookie file>`, plus each
  `--env KEY=VALUE` (keys match `^[A-Za-z_][A-Za-z0-9_]*$`; `DISPLAY` and `XAUTHORITY` may not
  be overridden). The agent's shell-local changes (an activated toolchain, an edited `PATH`)
  are not carried: pass them with `--env`, or launch through `sh -c '<activate>; exec <app>'`.
  Store the launch environment on the session record at start so it can be reused here;
  never store the session token in a file.
- **Permissions:** the app runs with the caller's own execution limits. For a Codex session
  that is not `unrestricted` (`session.codex_mode`, `machine/adapters/codex.js:61`), the
  service wraps the command as `codex sandbox -c sandbox_mode="workspace-write" -c
  sandbox_workspace_write.network_access=true -- <command>` with the same cwd, so it can
  write only where the agent could. Claude and Antigravity sessions are not sandboxed by
  wheelchair today, so their apps are spawned directly. Reviewer sessions are refused with
  `403` on every op.

### Machine service behaviour

- **Ownership:** at most one screen per session name. State (display number, Xvfb pid,
  cookie file, app pids and process groups, shot and app counters) is kept in memory and
  written to `<stateDir>/screens/<thread>/<session>/state.json` after every change.
- **Who may call:** the authenticated session must be a non-reviewer whose record exists,
  is not `stopped`, and whose thread is not being archived. Ops for one session run one at a
  time (a per-session queue); `stop`, session stop and archive mark the session as stopping
  inside that queue first, so a `start` or `run` queued behind them is refused `409` and none
  can create a screen or app after teardown.
- **Starting a screen:** make a cookie with `mcookie` and write it with `xauth -f <dir>/xauth
  add :0 . <cookie>` (file mode 0600; the X server accepts any cookie in its `-auth` file
  whatever display it is listed under). Start `Xvfb -displayfd <fd> -auth <dir>/xauth
  -screen 0 <W>x<H>x24 -nolisten tcp` (the local unix socket stays, since clients need it).
  The display number comes from `-displayfd`, so it never collides with screens already in
  use (tests on hearth use `:99`/`:100`). Wait for it with a 10 s timeout, else kill Xvfb and
  return `422 screen did not start`. Then add the same cookie under `:N` to the same file, which
  is what clients use as `XAUTHORITY`. The live check must prove a client with the cookie
  connects and one without it (`DISPLAY=:N`, `XAUTHORITY` pointing at an empty file) is refused.
- **Missing tools:** before starting, check `Xvfb`, `xauth`, `mcookie`, `ffmpeg` and
  `xdotool` on PATH; if any is missing, return `503 missing on this machine: <names>` with no
  partial state. On a non-Linux machine return `503 screens only work on Linux machines for
  now`.
- **Files:** screenshots go to `<stateDir>/screens/<thread>/<session>/shot-<n>.png`. The shot
  and app counters belong to the session, not the screen: they survive `stop`/`start` and a
  service restart (reloaded from `state.json`, and never lower than one more than the highest
  existing file number in the directory), so a path is never overwritten. ffmpeg writes to a
  temp name and renames it into place. Paths are absolute, so the lead can post one with an
  `image` card and an agent can open it with its image-reading tool.
- **Screenshot:** `ffmpeg -loglevel error -y -f x11grab -video_size WxH -i :N[+x,y]
  -frames:v 1 <tmp>` with `XAUTHORITY` set, 15 s timeout.
- **Input:** each op runs `xdotool` with `DISPLAY` and `XAUTHORITY` set, 10 s timeout; a
  non-zero exit returns `422` with the last stderr line.
- **Teardown:** kill each app's process group (SIGTERM, then SIGKILL after 3 s), then Xvfb,
  then delete the cookie file; keep shots and logs. It runs on the `stop` op; in
  `MachineService.stop(name)` (reached by session stop and `archive()`); and whenever the
  service sees a session's tmux is gone (wherever it already notices dead sessions, e.g. the
  readiness poll and the handoff kill path, plus a 60 s sweep of all screens whose session
  is not live). `archive()` also removes `<stateDir>/screens/<thread>/` alongside the uploads
  it removes. A screen whose Xvfb died is treated as no screen (its apps are torn down; the
  next `start` makes a new one).
- **Service restart:** the service runs with `KillMode=process` (`install.sh:401`) and
  `./install.sh` restarts it, so screens outlive a restart. At startup, read every
  `state.json`: if its session is known and live and its Xvfb pid is alive with an `Xvfb`
  command line, adopt it (apps whose process group is gone are marked `exited`); otherwise
  tear it down, killing only pids whose command line still matches what was recorded.
- **Isolation:** the route only acts on the caller's own screen and takes no display or
  session argument. The per-screen cookie stops a session reaching another screen by a
  mistyped display. All sessions run as the same user, so an agent that deliberately reads
  another screen's cookie file can still connect (see Accepted Risks).
- **Environment of sessions:** session launch is unchanged: no `DISPLAY` is added to sessions.

### Rules for agents

- `protocol/app/worker.md`: a short section "Seeing a desktop app": when the task changes
  something visible in a desktop app or game, launch it with `wc.js screen run -- <command>`
  (never by setting `DISPLAY` yourself), look with `shot` (open the PNG with your
  image-reading tool), drive it with `click`/`type`/`key`, and `stop` when done; point it at
  temporary data, never Collin's live data; a missing-tools error is reported to the lead,
  not worked around.
- `protocol/app/verifier.md`: in the live-app paragraph, add that a desktop app or game is
  checked the same way on the session's invisible screen (not a headless browser), with the
  same isolation rules; a missing-tools error means COULD NOT TRY with that reason.
- `protocol/app/lead.md`: one line where `image` cards are described: to show Collin what an
  agent saw, post its screenshot path with an `image` card.
- Reviewers do not get the command; the route refuses them.

### Docs

`machine/API.md` gains the `POST /v1/agent/screen` row; `machine/AGENTS.md` and
`viewer/AGENTS.md` routers name the new code's files.

### Not in this part

See IDEA.md "Not doing" and `## Deferred`. No macOS, no real desktop, no window manager, no
video, no Ready-check change.

### Validation

- `node --test viewer/test/*.test.js` — includes a new test that `wc.js screen <op>` builds the
  right request for every op, prints a 200 body to stdout with exit 0, and on a non-2xx
  writes `wc: <error>` to stderr with exit 1.
- `bash machine/test/run.sh` — includes new tests with fake `Xvfb` (writes a display number to
  the `-displayfd` fd), fake `xauth`, `mcookie`, `ffmpeg` (writes a PNG), `xdotool` and
  `codex` in the fake bin dir: start and idempotent start; run spawns with `DISPLAY`,
  `XAUTHORITY`, `--env` values and the session's launch environment, and wraps a non-
  unrestricted Codex session's command in `codex sandbox`; reviewer refused; shot paths never
  reused across `stop`/`start` and across a service restart; windows parsing, including an
  empty search; input argument building; missing-tool error naming each missing tool; op
  without a screen; one session cannot reach another's screen; `start` queued behind `stop`
  refused 409; teardown on `stop` op, on session stop, on tmux found dead, and on archive
  (screens dir removed); restart adopts a live session's screen and tears down a dead one's.
- A live check script `machine/test/screen-live.sh` (skips with exit 0 and a `SKIP:` line when
  any of the tools is missing): drives the screen code against real Xvfb; launches
  Playwright's Chromium in `--app` mode on a `data:` page whose title changes on click and on
  key input, plus one untitled window; asserts the `shot` PNG exists and is non-empty,
  `windows` lists both, a `click` changes the window title, `type` changes it again, a client
  without the cookie is refused, and after `stop` no Xvfb or Chromium process from the test
  remains. Run: `bash machine/test/screen-live.sh`.

## Deferred`. No macOS, no real desktop, no window manager, no
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
| 3 | A limit on how many screens run at once | One per session already bounds it; hearth has room | planning | Memory per Xvfb at 1280x800x24 is small; add a cap with a clear error |
| 4 | Old screenshots removed before the thread is archived | Files are small and archive removes them | planning | Directory `<stateDir>/screens/<thread>/<session>/` |
| 5 | A window manager on the screen, for apps that need one (resizing, full screen, dialog placement) | Apps tested without one work; keys go via explicit focus | planning | Candidate: a minimal WM started per screen if present on PATH |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| Heavy 3D may be slow or fail on the invisible screen (software rendering, no graphics card) | Accepted in IDEA.md constraints | planning |
| An agent that deliberately reads another session's screen cookie can connect to that screen | All sessions run as the same user; the cookie stops mistakes, not a determined agent | 1 |

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** claude / claude-opus-5-5 (intent); gpt (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Restart orphans screens: `./install.sh` restarts the service with `KillMode=process`, Deferred #2 called it only the crash path | upheld | Pulled back into Spec ("Service restart"); Deferred row removed; Decision 13 |
| intent | minor | A worker that ends without `screen stop` keeps its screen until stopped | declined | sub-lead.md:176 stops each worker after merging; that runs teardown |
| intent | minor | Mistyped DISPLAY reaches another session's screen (no `-auth`) | upheld | Per-screen cookie; Decision 15; residual in Accepted Risks |
| mechanics | blocking | `run` escapes Codex's sandbox; reviewers hold tokens | upheld | Codex apps wrapped in `codex sandbox`; reviewers refused 403; Decision 14 |
| mechanics | blocking | Direct X connections bypass route isolation | downgraded (major) | Not a wrong-build risk: a worker could still build it; fixed by cookie, residual same-user risk accepted |
| mechanics | blocking | start/run race with stop/archive; stopped tokens can start screens | upheld | Per-session queue and stopping state; Decision 16 |
| mechanics | major | Sessions that die without `stop()` keep screens | upheld | Teardown on tmux found dead and 60 s sweep |
| mechanics | major | Apps launched with DISPLAY directly are never torn down | upheld | Apps launch only through `run` |
| mechanics | major | Caller's environment can't reach the service | upheld | Defined: session launch environment plus `--env` |
| mechanics | major | Window search misses untitled windows; empty search errors | upheld | Empty pattern; empty search returns [] |
| mechanics | major | Shot counter reset overwrites PNGs | upheld | Counters per session, persisted, never reused |
| mechanics | minor | Failure output conflicts with wc.js paths | upheld | Non-2xx path: stderr, exit 1 |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-18: xdotool installed on hearth by Collin (sudo card, exit 0).
