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
| 16 | Per-session op queue; stopping sessions refuse new screens; teardown on a 60 s sweep (superseded in part by 21–22) | Closes start/stop races and sessions that die without `stop()` | review-round-1 |
| 17 | Screen processes identified by an environment marker scoped to the state dir; a service restart tears every screen down instead of re-adopting | Durable identity through PID reuse, exited launchers and interrupted spawns; simpler than adoption | review-round-2 |
| 18 | `--env` applies inside the sandbox via `env`; launch environment rebuilt at run time, never with the session token | Keeps caller overrides out of the sandbox launcher; works for sessions started before install | review-round-2 |
| 19 | Validated, literal xdotool arguments; one `xdotool key` call per token | xdotool chains commands, including `exec` | review-round-2 |
| 20 | Screen failures use 422, never 503 | `wc.js` turns 503 into "hub unavailable" (viewer/app/wc.js:171) | review-round-2 |
| 21 | Each screen lives in its own systemd user slice; teardown and startup cleanup act on the slice (supersedes the environment marker in 17) | Kills every descendant whatever it does to its environment, with no PID reuse window | review-round-3 |
| 22 | Session stop and archive tear down immediately (SIGKILL) without waiting in the queue; `screen stop` and the sweep are graceful | Stays inside the hub's 5 s timeout and finishes before a verifier worktree is removed | review-round-3 |
| 23 | `type` text capped at 400 characters, timeout scaled; key tokens that are xdotool command names refused; command names with `=` refused; windows are viewable top-level children of the root; auto-focus picks a new window only | Closes the round 3 argument and window findings | review-round-3 |
| 24 | Key names come from a fixed list (letters, digits, F-keys, navigation and editing keys, common punctuation, with ctrl/alt/shift/super combos); supersedes the command-name blocklist in 23. Codex sandbox wrap kept | Collin's pick ("Only the fixed key list") after three review rounds without a clean pass | user |
| 25 | Thread-level slice under the parent; generation fence on launches; sweep stops unheld slices; `systemctl` calls 2 s deadline (superseded by 31), archive carries on | Closes registration races, restart stragglers and the archive time budget | review-round-4 |
| 26 | `--expand-environment=no` on systemd 254+ | systemd 258 expands `$` in scope commands by default | review-round-4 |
| 27 | Each modifier at most once; `--hold` for held keys and lone modifiers; `type` limited to printable ASCII, newline and tab; auto-focus only a window owned by the app's scope; screen size capped at 2560 | Round 4 findings | review-round-4 |
| 28 | Screen slice names carry the generation; sweep compares names | A replacement screen never shares a slice with one being torn down | review-round-5 |
| 29 | Auto-focus is best effort: first new window, reported back; no ownership proof (supersedes that part of 27) | Many X apps publish no pid, sandboxed pids differ; the agent sees and can correct focus | review-round-5 |
| 30 | `--hold` presses its keys together; at most 6 held and 20 tapped per call | Game controls need chords; bounds each op's time | review-round-5 |
| 31 | Archive: one 1 s-bounded kill on the thread slice and a non-blocking stop | Screens add at most ~1 s to archive | review-round-5 |
| 32 | Generation reserved in `state.json` before spawn; sweep leaves `starting` screens; thread-slice kill bumps generations; kill + stop share 1 s | Closes sweep/start and restart generation races; one archive budget | review-round-6 |
| 33 | One deadline per `key` op; releases always attempted; failed release blocks input until `screen stop`; focus failure is still a successful `run` | Bounds input ops; no stuck keys; no duplicate launches | review-round-6 |
| 34 | One last review round; findings that only arise when two events coincide within about a second (concurrent stop/archive/restart/sweep/launch timing) go to Accepted Risks rather than rework; other findings are fixed as usual | Collin's pick ("One last round, timing cases accepted") after six rounds | user |
| 35 | Cut-off taps released too; releases in parallel, 500 ms each; `env --` always, `-` refused; command resolved before launch (422 if missing); auto-focus probes 1 s each, phase ≤ 6 s; archive keeps the screens dir when it keeps uploads; screen-dir removal failure doesn't fail archive | Round 7 findings | review-round-7 |
| 36 | Approve after round 7 even though it upheld three non-timing findings (env option parsing, missing command, unbounded focus probes); they are fixed in the Spec without another round | Collin's decision 34 ended review with this round; the fixes are small and the builder's tests and the verifier cover them | defaulted |

## Spec

### What this adds

A `screen` command group in `viewer/app/wc.js` that lets an agent session (lead, sub-lead,
worker, verifier, mapper; any CLI; never a reviewer) get its own invisible X screen on the
machine it runs on, launch an app on it, take screenshots, and send mouse and keyboard input.
The machine service owns every screen and every app launched on one, so they are torn down
with the session.

Linux only (including WSL2, untested). Tools used: `Xvfb` (the invisible screen), `xauth`
and `mcookie` (a per-screen access cookie), `ffmpeg` with the `x11grab` device
(screenshots), `xdotool` (input), `xwininfo` (window listing), and `systemd-run` /
`systemctl --user` (one cgroup per screen, for teardown).
Checked on hearth on 2026-11-18: Xvfb + ffmpeg captured a PNG of an `xmessage` window;
Playwright's Chromium launched on the screen in `--app` mode received a `xdotool click`
(title changed) and `xdotool type` (input received keys); a command inside Codex's
`workspace-write` sandbox (`codex sandbox -c sandbox_mode="workspace-write" -c
sandbox_workspace_write.network_access=true -- ...`) connected to an Xvfb display; that
sandbox runs commands in their own process namespace, so a background process started by a
Codex agent's own shell does not outlive the command. Apps run without a window manager.

### Command surface (`wc.js screen <op> ...`)

Each op POSTs `{op, args}` to a new machine route `POST /v1/agent/screen`, authenticated with
the session token exactly like `/v1/agent/git` (`machine/service.js` `authorize()`), using
`wc.js`'s plain `request()` (not the session retry). Success is `200` with a JSON body, printed
to stdout, exit 0. Every failure is a non-2xx status other than `503` with `{error}`, so
`wc.js`'s existing branch (`viewer/app/wc.js:170-171`) prints `wc: <body>` on stderr and exits
1 (`503` is reserved: `wc.js` turns it into "hub unavailable"). Statuses: `400` bad arguments,
`403` reviewer, `409` session stopped, archived or not running, `422` everything else
(op failed, no screen, missing tools, non-Linux machine, tmux could not be asked).

| Op | Arguments | Does | Returns |
|---|---|---|---|
| `start` | `[--size WxH]` (default `1280x800`, each side 200–2560, which keeps a screenshot under the image card's 25 MB limit) | Starts the caller's screen if it has none; idempotent (a second `start` returns the existing screen, ignoring `--size`) | `{ok, display: ":N", size}` |
| `run` | `[--env KEY=VALUE]... -- <command> [args...]` | Starts the screen if needed, then launches the command on it (see "Launching apps") | `{ok, app: <n>, log, focused}` |
| `shot` | `[--window <id>]` | Captures the whole screen, or only that window's rectangle (geometry from `xdotool getwindowgeometry`, clipped to the screen; `422` if the window is gone or wholly off screen), as PNG | `{ok, path, width, height}` |
| `windows` | none | Lists visible app windows, titled or not | `{ok, windows: [{id, name, x, y, width, height}]}` (`name` is `""` for untitled) |
| `move` | `<x> <y>` | Moves the pointer | `{ok}` |
| `click` | `<x> <y> [--button left\|middle\|right] [--double]` | Moves the pointer, then clicks | `{ok}` |
| `drag` | `<x1> <y1> <x2> <y2>` | Press at the first point, move, release at the second | `{ok}` |
| `type` | `<text>` | Types the text literally into the focused window | `{ok}` |
| `key` | `[--hold <ms>] <keys...>` | Presses key names or chords (`Return`, `ctrl+s`, `Left`) in order; with `--hold` (50–5000 ms) all the given keys go down together, stay held that long, then release, for game controls (run + jump, diagonals) | `{ok}` |
| `focus` | `<window id>` | Focuses that window (`xdotool windowfocus`) | `{ok}` |
| `stop` | none | Tears down the caller's apps and screen (see "Teardown"); the session may `start` again afterwards | `{ok}` |
| `status` | none | Whether the caller has a screen, its display and size, and each app's number, state (`running`/`exited`) and log | `{ok, running, ...}` |

Coordinates are integers in screen pixels from the top-left. Without a window manager,
keyboard input goes to the focused window: `run` focuses the first visible app window the app
opens if one appears within 5 s, and agents can `focus` explicitly. Every op except `start`,
`run`, `stop` and `status` fails `422 no screen; run wc.js screen start first` when the caller
has none.

**Argument safety.** xdotool accepts chained commands (including `exec`), so the service never
forwards caller text where xdotool could read it as a command or option. It validates every
argument and builds argv itself: coordinates and window ids must be decimal integers; each
`key` token must match a fixed list: zero or more modifiers from `ctrl`, `alt`, `shift`, `super`
(each at most once) joined by `+`, then one key from: `a`–`z`, `A`–`Z`, `0`–`9`, `F1`–`F12`, `Return`, `Escape`,
`Tab`, `space`, `BackSpace`, `Delete`, `Insert`, `Home`, `End`, `Page_Up`, `Page_Down`, `Up`,
`Down`, `Left`, `Right`, `minus`, `equal`, `comma`, `period`, `slash`, `semicolon`,
`apostrophe`, `bracketleft`, `bracketright`, `backslash`, `grave` (e.g. `ctrl+shift+s`,
`Return`). Matching is exact and case-sensitive, so no token can name an xdotool command. All
tokens are checked before any key is sent, then each is sent as its own `xdotool key --
<token>` call. At most 20 tokens per call. With `--hold`, a token may also be a lone modifier
(`shift`), at most 6 tokens are given, and they are pressed together: `xdotool keydown --
<token>` for each in order, one wait of the hold time, then `xdotool keyup -- <token>` for
each in reverse order (keyups are also sent if the wait is interrupted or a keydown fails).
**Key op deadline:** one `key` op has a single deadline of 10 s plus the hold time, covering
all its xdotool calls; when it expires no further keydown or tap is sent. Every key that may
be down is released afterwards: all held keys, and for a tap whose `xdotool key` call was cut
off, that tap's key (a tap sends press and release separately). Each release is its own
`xdotool keyup` call with its own 500 ms timeout, all started together, so one stalled
release cannot starve the others. If any keyup fails or
times out, the op returns `422 keys may still be held; run wc.js screen stop` and every later
input op on that screen is refused with the same message until `screen stop`.
`type` sends `xdotool type --delay 20 -- <text>` as a single argument; text is 1–400
characters of printable ASCII (space to `~`), newline and tab only, so every character maps
to a key on the default US layout and none is silently skipped; its timeout is 10 s plus
30 ms per character. Anything else is
`400`.

**Window listing:** app windows are the viewable top-level windows: the direct children of
the root window whose map state is `IsViewable`, from `xwininfo -root -children` and
`xwininfo -id <id>` per child (name `""` when it has none; geometry from the same output).
With no window manager, every app's top-level window is a direct child of the root, and child
widgets are not listed. No children means `windows: []`.

**Auto-focus on `run`** (best effort): the service lists app windows just before launching,
then polls every 250 ms for up to 5 s for a viewable top-level window not in that list, and
focuses the first one that appears. It does not try to prove which app owns the window (many
X apps publish no pid, and a sandboxed app's pid is not the service's), so on a screen where
an earlier app opens a window at the same moment, the wrong one may be focused. `run` returns
`focused: {id, name}` or `focused: null`, so the agent can see what got focus and `focus`
another window if needed. Every probe in this phase (the baseline listing, each `xwininfo`
call and the focus call) has a 1 s timeout and the whole phase ends by 6 s; a failed or timed
out probe ends it with `focused: null`. If the new window vanishes or `xdotool windowfocus` fails, `run`
still succeeds with `focused: null` (the app did launch; a retry would start a second copy).

### Launching apps

Agents launch apps only through `run`, never by setting `DISPLAY` themselves (an app started
from a Codex agent's shell dies when its command ends, and an app the service did not start is
not torn down). `start` returns the display for information only.

- The service spawns the command detached in its own process group, cwd the caller's
  worktree, stdout+stderr to `<stateDir>/screens/<thread>/<session>/app-<n>.log`.
- **Environment:** rebuilt at `run` time from the session record, the same way `startIn()`
  builds the session's launch environment (`machine/service.js` around 606-627: the service's
  own environment plus the session's added variables, including the account login env),
  except `WHEELCHAIR_SESSION_TOKEN`, which the app never gets. This works for sessions
  started before this feature was installed. Then `DISPLAY=:N`, `XAUTHORITY=<cookie file>` and
  the screen's slice placement (below). Nothing new is persisted.
- **Caller overrides** (`--env KEY=VALUE`, keys matching `^[A-Za-z_][A-Za-z0-9_]*$`; `DISPLAY`,
  `XAUTHORITY` and `WHEELCHAIR_SESSION_TOKEN` refused with `400`) apply
  only to the app itself: the service runs `env KEY=VALUE ... <command> [args...]` (as argv,
  no shell) as the launched command, so for a sandboxed Codex session they take effect inside
  the sandbox and never on the sandbox launcher. The argv is `env -- KEY=VALUE ... <command>
  [args...]` (with `--` even when there are no overrides, so a command like `--help` is run as
  a command, not read as an `env` option). A command whose first word contains `=` or is
  exactly `-` is refused with `400` (`env` would read it as an assignment, or as "clear the
  environment").
- **Command must exist:** before launching, the service resolves the first word against the
  `PATH` of the app's environment (or, if it contains `/`, relative to the worktree), and
  refuses with `422 command not found: <word>` if it is not an executable file. A command that
  starts and exits quickly is a successful `run`; `status` then shows that app as `exited`,
  and its log holds its output. The agent's shell-local changes (an activated
  toolchain, an edited `PATH`) are not carried: pass them with `--env`, or launch
  `sh -c '<activate>; exec <app>'`.
- **Permissions:** the app runs with the caller's own execution limits. For a Codex session
  that is not `unrestricted` (`session.codex_mode`, `machine/adapters/codex.js:61`), the
  service runs `codex sandbox -c sandbox_mode="workspace-write" -c
  sandbox_workspace_write.network_access=true -- env KEY=VALUE ... <command> [args...]` with
  the same cwd and the rebuilt base environment, so the app can write only where the agent
  could. Claude and Antigravity sessions are not sandboxed by wheelchair today, so their apps
  are spawned directly. Reviewer sessions get `403` on every op.

### Machine service behaviour

- **Ownership:** at most one screen per session name. State (display number, Xvfb pid, cookie
  file, app numbers, pids and process groups, shot and app counters) is kept in memory and
  written to `<stateDir>/screens/<thread>/<session>/state.json` after every change.
- **One cgroup per screen:** every process the service starts for a screen (Xvfb, and each
  app or its sandbox launcher) is started with `systemd-run --user --scope
  --expand-environment=no --slice=<screen slice> --unit=<unit>` so it and all its descendants live in that screen's
  slice, whatever they do to their environment or process ids. Names: `<s>` is the first 12 hex
  characters of sha256 of the state dir, `<t>` the thread id, `<id>` the first 12 of sha256
  of the session name; the parent slice is `wcscreen-<s>.slice`, the thread slice
  `wcscreen-<s>-<t>.slice`, the screen slice `wcscreen-<s>-<t>-<id>g<gen>.slice` (each a child of
  the one before, by systemd's dash rule; `<gen>` is the screen's generation, below), units
  `wcscreen-<s>-<t>-<id>g<gen>-x.scope` and `wcscreen-<s>-<t>-<id>g<gen>-app<n>.scope`. Each
  screen instance therefore has its own slice name: a replacement screen never shares a
  slice with the one being torn down. `--expand-environment=no` keeps arguments and `--env`
  values literal (systemd 258 starts expanding `$` in scope commands by default); the flag
  exists from systemd 254, so on an older systemd the service omits it (those versions do not
  expand), choosing by the number in `systemd-run --version`. `systemd-run --scope` runs the command as the scope's
  own process, so `-displayfd` and pipes work as usual. Teardown acts on the slice, so it
  survives PID reuse, launchers that exited leaving children, children that dropped any
  environment variable, and a restart between spawn and the `state.json` write. The `<s>` part keeps a test
  service (own temp state dir) from touching real screens. If `systemctl --user` cannot be
  reached, `start` and `run` fail `422 screens need a systemd user session on this machine`.
- **Who may call, and ordering:** ops for one session run one at a time (a per-session
  queue). Inside the queue, before `start` or `run` creates anything, the service checks: the
  session record exists, is not a reviewer, is not `stopped`, its thread is not archiving, and
  its tmux session is live by `liveTmux()` (`null`, meaning tmux could not be asked, gives
  `422 could not check the session; try again`, never "dead"). A failed check is `409`.
  Session stop and archive do not wait in the queue: `stop()` marks the session `stopped`
  (as it already does) and then kills the screen slice at once (below), so an op in flight
  fails and anything queued is refused; that refusal is permanent. A `start` or `run` that
  finds the session's tmux gone also kills the screen slice before returning `409`.
- **Fencing launches:** each screen has a generation number, bumped by every teardown and
  persisted in `state.json` with the counters (never reused, also across restarts). `start`
  reserves the new screen's generation by writing it to `state.json` (marked `starting`)
  before spawning Xvfb, so a restart can never hand the same generation to a replacement; the
  sweep counts a `starting` generation as held, and a startup or sweep finding a `starting`
  entry with no live service-side start in progress treats it as not held. A
  `start` or `run` notes the generation before spawning; once `systemd-run` has registered the
  scope (the spawned process is running), it checks the session is not `stopped` and the
  generation is unchanged; if either changed, it kills its own scope and returns `409`. The
  sweep is the backstop: every 60 s it lists units under `wcscreen-<s>.slice` (`systemctl --user
  list-units --all 'wcscreen-<s>-*'`) and stops any screen slice whose name (with its
  generation) is not the one the service holds as a live screen, which catches a launcher that
  registered after a teardown or a restart, and old processes left by a failed teardown even
  when the session has since started a new screen. The
  `screen stop` op is not a session stop: it tears down in queue order and a later `start` or
  `run` makes a fresh screen.
- **Starting a screen:** make a cookie with `mcookie` and write it with `xauth -f <dir>/xauth
  add :0 . <cookie>` (file mode 0600; the X server accepts any cookie in its `-auth` file
  whatever display it is listed under). Start `Xvfb -displayfd <fd> -auth <dir>/xauth
  -screen 0 <W>x<H>x24 -nolisten tcp` (the local unix socket stays, since clients need it). The
  display number comes from `-displayfd`, so it never collides with screens already in use
  (tests on hearth use `:99`/`:100`). Wait for it with a 10 s timeout, else tear down by
  slice and return `422 screen did not start`. Then add the same cookie under `:N` to the
  same file, which is what clients use as `XAUTHORITY`.
- **Missing tools:** before starting, check `Xvfb`, `xauth`, `mcookie`, `ffmpeg`, `xdotool`,
  `xwininfo`, `systemd-run` and `systemctl` on PATH; if any is missing, return `422 missing on this machine: <names>` with no
  partial state. On a non-Linux machine return `422 screens only work on Linux machines for
  now`.
- **Files:** screenshots go to `<stateDir>/screens/<thread>/<session>/shot-<n>.png`. The shot
  and app counters belong to the session, not the screen: they survive `screen stop`/`start`
  and a service restart, and are never lower than one more than the highest existing file
  number in the directory, so a path is never overwritten. ffmpeg writes to a temp name and
  renames it into place. Paths are absolute, so the lead can post one with an `image` card and
  an agent can open it with its image-reading tool.
- **Screenshot:** `ffmpeg -loglevel error -y -f x11grab -video_size WxH -i :N[+x,y]
  -frames:v 1 <tmp>` with `DISPLAY` and `XAUTHORITY` set, 15 s timeout.
- **Input:** each op runs `xdotool` with `DISPLAY` and `XAUTHORITY` set; a non-zero exit returns
  `422` with the last stderr line. Timeouts: 10 s per op for `move`, `click`, `drag` and
  `focus`; the `type` and `key` rules above (scaled `type` timeout; one deadline per `key` op
  plus separate releases) take precedence over this default.
- **Teardown:** two strengths, both on the screen slice. *Graceful* (the `screen stop` op,
  and the sweep): `systemctl --user kill --signal=SIGTERM <screen slice>`, then after 3 s
  `systemctl --user kill --signal=SIGKILL <screen slice>` and `systemctl --user stop <screen
  slice>`. *Immediate* (`MachineService.stop(name)`, reached by session stop and `archive()`):
  SIGKILL and stop at once, synchronously, before `stop()` removes a verifier's worktree.
  `archive()` first does one `systemctl --user kill --signal=SIGKILL` on the thread slice
  `wcscreen-<s>-<t>.slice`, covering every screen of the thread in one call, and issues the
  matching `systemctl --user stop --no-block`, then stops its sessions (each `stop()` then
  finds no screen and returns at once). The thread-slice kill counts as a teardown of every
  screen of that thread: it bumps each one's generation (persisted) and drops it from memory,
  so a launch fenced on any of them kills itself. In both paths the kill and the
  `stop --no-block` submission share one 1 s deadline; on timeout or failure the service logs
  it and carries on, and the sweep retries the slice. The 1 s covers only those `systemctl`
  calls; the local file work (persisting generations, deleting cookies, removing the screens
  directory) is small and comes on top. Every teardown, graceful or immediate, deletes the
  screen's cookie file. Session stop keeps shots and logs. Archive removes
  `<stateDir>/screens/<thread>/` whenever it removes the thread's uploads, and keeps it
  whenever it keeps them (a worktree kept mid-rebase, so the thread can reopen with its
  counters and generations intact); a failure removing it is logged and does not fail the
  archive (the hub's archive outcome is unchanged). The sweep runs every 60 s and tears down screens whose
  session tmux is confirmed gone (`liveTmux()` returned a set without it; a `null` answer
  skips that sweep). A screen whose Xvfb died is treated as no screen (its slice is torn
  down; the next `start` makes a new one).
- **Service restart:** the service runs with `KillMode=process` (`install.sh:401`) and
  `./install.sh` restarts it, so screens would outlive a restart. At startup the service tears
  down every screen: SIGKILL and stop on its parent slice `wcscreen-<s>.slice`, then mark
  each `state.json` as having no screen (counters kept). Agents get "no screen" and
  `run` again.
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
  temporary data, never Collin's live data, and give each launch its own profile or data
  directory (for example Chromium's `--user-data-dir`) so it cannot hand off to another
  agent's copy of the same app; when a screenshot would help Collin see the
  result, put its absolute path in your report; a missing-tools error is reported to the
  lead, not worked around.
- `protocol/app/verifier.md`: in the live-app paragraph, add that a desktop app or game is
  checked the same way on the session's invisible screen (not a headless browser), with the
  same isolation rules; name the screenshot paths that show what you saw in the report; a
  missing-tools error means COULD NOT TRY with that reason.
- `protocol/app/sub-lead.md`: pass screenshot paths from worker and verifier reports on to
  the lead in the `result` summary or a `message`.
- `protocol/app/lead.md`: one line where `image` cards are described: to show Collin what an
  agent saw, post its screenshot path with an `image` card.
- Reviewers do not get the command; the route refuses them.

### Docs

`machine/API.md` gains the `POST /v1/agent/screen` row; `machine/AGENTS.md` and
`viewer/AGENTS.md` routers name the new code's files.

### Not in this part

See IDEA.md "Not doing" and the Deferred table below. No macOS, no real desktop, no window
manager, no video, no Ready-check change.

### Validation

- `node --test viewer/test/*.test.js` — includes a new test that `wc.js screen <op>` builds the
  right request for every op, prints a 200 body to stdout with exit 0, and on a `422` writes
  `wc: <body>` to stderr with exit 1.
- `bash machine/test/run.sh` — includes new tests with fake `Xvfb` (writes a display number to
  the `-displayfd` fd), fake `xauth`, `mcookie`, `ffmpeg` (writes a PNG), `xdotool`,
  `xwininfo` and `codex` in the fake bin dir, covering: start and idempotent start; run spawns
  with `DISPLAY`, `XAUTHORITY` and the rebuilt session environment without the token, inside
  `systemd-run --user --scope` with the screen's slice and unit names, `--env` only inside `env ...` after the sandbox launcher's `--`, and the `codex
  sandbox` wrap for a non-unrestricted Codex session only; reviewer refused 403; key tokens
  outside the fixed list (`exec`, `EXEC`, `windowkill`, `ctrl+`) and repeated modifiers
  (`ctrl+ctrl+a`) refused before any key is sent; every listed key and a modifier combo
  accepted; more than 20 tokens refused; `--hold` presses all keys down in order, waits
  once, releases in reverse, allows a lone modifier, refuses more than 6 tokens, and sends
  keyups after a failed keydown; type text with a
  non-ASCII or control character other than newline and tab refused; `--size` over 2560
  refused; type text that looks like an option (`--window`) sent literally; type
  text over 400 characters refused; a command whose first word contains `=` refused; shot paths never reused across `screen stop`/`start` and a service restart;
  windows from `xwininfo` output: only viewable direct children of the root, none gives `[]`;
  auto-focus picks the first window not present before the launch, never a pre-existing
  one, and returns `focused: null` when none appears within 5 s; `systemd-run` gets
  `--expand-environment=no` on systemd 254 and later and not before; a launch whose scope
  registers after a teardown (generation bumped) kills its own scope and returns 409; the
  sweep stops a screen slice the service does not hold, including an older generation of a
  session that now has a new screen, and never the current one; archive kills the thread slice once
  and carries on when either the kill or the stop submission stalls, within 1 s in total;
  the thread-slice kill bumps every screen generation of the thread; a `start` reserves its
  generation in `state.json` before spawning and the sweep leaves a `starting` screen alone;
  a `key` op with a stalled xdotool stops sending at its deadline, still releases held keys,
  and a failed release refuses later input until `screen stop`; a `run` whose focus fails
  returns success with `focused: null`; a tap cut off by the key deadline is released and a
  failed release locks input; a stalled first release still lets the others run; `run --
  --help` runs a command named `--help` (not `env --help`) and `run -- -` is refused; a
  missing command gives `422 command not found`, a command that exits at once gives success
  and `exited` in `status`; an auto-focus probe that stalls ends the phase with `focused:
  null` within 6 s; archive keeps the screens directory when it keeps uploads; missing-tool error naming each
  missing tool, status 422; op without a screen; one session cannot reach another's screen;
  `start` after session stop refused 409, `start` after `screen stop` allowed; `start` when
  tmux shows the session gone refused 409 with the slice killed, when tmux cannot be asked
  422; graceful teardown on `screen stop` and the sweep, immediate teardown on session stop
  (before a verifier worktree is removed) and archive (screens dir removed); startup stops
  only its own state dir's parent slice; no `systemctl --user` gives 422.
- A live check script `machine/test/screen-live.sh` (skips with exit 0 and a `SKIP:` line when
  any of the tools is missing or `systemctl --user` cannot be reached): drives the screen code against real Xvfb; launches
  Playwright's Chromium in `--app` mode on a `data:` page whose title changes on click and on
  key input, then a second `run` of `xmessage`, whose window name the test then clears
  directly with `xdotool set_window --name ''` (a genuinely unnamed X window), plus an app
  argument containing a literal `$HOME` that must arrive unexpanded; asserts the `shot` PNG exists and is non-empty, `windows` lists exactly
  those two top-level windows by their ids, the second with `name: ""`, each `run` reports
  `focused` as its own window, a `click` changes the
  first window's title, `type` of 400 characters arrives whole (the page title shows its
  length), a client without the cookie is refused, an app that starts a child which clears its
  environment and outlives its parent is gone after `screen stop`, and after `stop` the
  screen's slice has no processes. Run: `bash machine/test/screen-live.sh`.

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
| A `run` that races an archive can start an app before the fence kills it, inside a worktree being archived; it can run until archive's synchronous git steps finish and the service runs the fence (seconds, not an instant) | The agent's own processes are equally unfenced then; fixing it means reworking archive's synchronous git, outside this feature | 5, 6 |
| An op in flight during archive (a `shot`, or `run` in auto-focus) can write its state file after archive removed the screens directory, leaving a stray directory | Two events in the same moment; Decision 34; harmless leftover | 7 |
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

### Round 2 — 2026-11-18

**Lanes:** claude / claude-opus-5-5 (intent); gpt (mechanics); cross-family: yes.

**Changed since Round 1:** apps launch only via `screen run` (session launch env + `--env`, `codex sandbox` wrap for sandboxed Codex, reviewers refused); per-screen xauth cookie; per-session op queue and stopping state (409); teardown on tmux found dead and a 60 s sweep; restart adopt-or-teardown from `state.json` (pulled back from Deferred); window listing with empty pattern and empty result; persistent shot/app counters; failure path = non-2xx, stderr, exit 1; validation lists updated.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | 503 for missing tools shows as "hub unavailable" | upheld | 422; Decision 20 |
| intent | major | Stale Round-1 text and second Validation section left in the Spec | upheld | Removed; one Validation section |
| intent | minor | Launch env needn't be stored; token shouldn't reach the app | upheld | Rebuilt at run time without token; Decision 18 |
| intent | minor | Teardown hooks listed as open "e.g." | upheld | stop() plus 60 s sweep only |
| intent | minor | Restart re-adoption is the most fragile part; tear down instead | upheld | Startup tears down all; Decision 17 |
| intent | minor | Workers aren't told to report screenshot paths | upheld | worker, verifier, sub-lead rules |
| mechanics | blocking | `--env` applied to the sandbox launcher | upheld | Applied via `env` inside the sandbox; Decision 18 |
| mechanics | blocking | xdotool reads caller text as commands | upheld | Validation and literal argv; Decision 19 |
| mechanics | blocking | `screen stop` vs session stop semantics undefined | upheld | Defined: only session stop/archive refuse permanently |
| mechanics | blocking | Dead tmux leaves token able to create screens | upheld | Liveness checked in the queue before creating; null ≠ dead |
| mechanics | blocking | PID reuse on adoption and teardown | upheld | Marker identity; no adoption; Decision 17 |
| mechanics | blocking | Restart between spawn and state write loses processes | upheld | Marker scan at startup |
| mechanics | blocking | Window search returns the root window | upheld | Root excluded; live check asserts real ids |
| mechanics | major | Launch env missing for already-running sessions; token copy | upheld | Rebuilt at run time; Decision 18 |
| mechanics | blocking | 503 diagnostic lost (same as intent finding) | upheld | 422; Decision 20 |
| mechanics | minor | Stale second Validation section (same as intent finding) | upheld | Removed |

### Round 3 — 2026-11-18

**Lanes:** claude / claude-opus-5-5 (intent); gpt (mechanics); cross-family: yes.

**Changed since Round 2:** screen processes identified by a `WHEELCHAIR_SCREEN` environment marker scoped to the state dir, used for all teardown; service restart tears every screen down (no adoption); `--env` applied via `env` inside the Codex sandbox; launch environment rebuilt at run time without the session token; validated literal xdotool arguments, one `key` call per token; `screen stop` vs session stop semantics; liveness checked in the per-session queue (null tmux answer ≠ dead); teardown = `screen stop`, `stop()`, 60 s sweep; root window excluded from listing; all failures non-503 (422); worker/verifier/sub-lead report screenshot paths; stale duplicate Validation removed; `xwininfo` added to required tools.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | `type` 4096 chars vs 10 s timeout | upheld | 400 chars, scaled timeout; Decision 23 |
| intent | minor | Decision 16 says dead tmux triggers teardown; Spec doesn't | upheld | Dead tmux on start/run now kills the slice; Decision 16 wording fixed |
| intent | minor | Verifier screen vs worktree removal order | upheld | Immediate teardown before worktree removal; Decision 22 |
| mechanics | blocking | Key tokens can be xdotool command names | upheld | Refused case-insensitively before sending; Decision 23 |
| mechanics | blocking | `env` reads a command name with `=` as assignment | upheld | Refused 400; Decision 23 |
| mechanics | blocking | Marker-only teardown misses children that drop it or hide environ | upheld | Per-screen systemd slice; Decision 21 |
| mechanics | blocking | PID reuse between read and signal | upheld | Slice-level kill; Decision 21 |
| mechanics | blocking | Queued teardown exceeds hub 5 s timeout | upheld | Immediate teardown outside the queue; Decision 22 |
| mechanics | blocking | `type` length vs timeout (same as intent) | upheld | Decision 23 |
| mechanics | major | Search lists child widgets; second run's focus undefined | upheld | Top-level viewable children; new-window diff; Decision 23 |

### Round 4 — 2026-11-18

**Lanes:** claude / claude-opus-5-5 (intent); gpt (mechanics); cross-family: yes. Budget reset by Collin's decision 24.

**Changed since Round 3:** each screen in its own systemd user slice, teardown and startup cleanup act on the slice (Decision 21); session stop and archive tear down immediately outside the queue, `screen stop` and the sweep gracefully (22); `type` capped at 400 characters with scaled timeout, command first word with `=` refused, windows = viewable top-level children of the root via `xwininfo`, auto-focus picks only a new window (23); key names from a fixed list (24); `systemd-run`/`systemctl` added to required tools; validation updated.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Keys can only be tapped, games need held keys | upheld | `--hold`; Decision 27 |
| intent | minor | Leftover `WHEELCHAIR_SCREEN` refusal and typo | upheld | Removed |
| mechanics | blocking | Scope can register after teardown; restart straggler | upheld | Generation fence and sweep of unheld slices; Decision 25 |
| mechanics | blocking | Repeated modifiers reach xdotool parser overflow | upheld | Each modifier once; Decision 27 |
| mechanics | blocking | systemd 258 expands `$` in scope commands | upheld | `--expand-environment=no` on 254+; Decision 26 |
| mechanics | major | Archive has no total time budget | upheld | One thread-slice kill, 2 s per call, carry on; Decision 25 |
| mechanics | major | Auto-focus can grab another app's window | upheld | Ownership by scope via window pid; best effort; Decision 27 |
| mechanics | major | Chromium fixture may not be untitled | upheld | xmessage with name cleared; asserts `name: ""` |
| mechanics | minor | `type` can silently skip unmappable characters | upheld | Printable ASCII, newline, tab only |
| mechanics | minor | 3840² PNG can exceed image card limit | upheld | Size capped at 2560 |

### Round 5 — 2026-11-18

**Lanes:** claude / claude-opus-5-5 (intent); gpt (mechanics); cross-family: yes.

**Changed since Round 4:** thread-level slice and one-call archive teardown with 2 s per `systemctl` call; generation fence on launches and sweep of unheld slices (25); `--expand-environment=no` on systemd 254+ (26); modifiers at most once, `key --hold`, `type` limited to printable ASCII/newline/tab, auto-focus only windows owned by the app's scope with `focused` in the reply, `--size` capped at 2560 (27); live fixture uses xmessage with its name cleared and a literal `$HOME` argument; leftover marker refusal removed.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Live check expects xmessage auto-focus but xmessage publishes no pid | upheld | Best-effort focus without ownership; Decision 29 |
| intent | minor | Sandboxed pid isn't the host pid | upheld | Ownership check dropped; Decision 29 |
| intent | minor | `--hold` can't hold two keys at once | upheld | Keys held together; Decision 30 |
| mechanics | blocking | Late launch can run app code while archive removes the worktree | accepted-risk | Instant-long window; agent's own processes have the same exposure; holding archive would break its time budget. Accepted Risks |
| mechanics | blocking | Sweep and replacement screen share a slice name | upheld | Generation in slice names; Decision 28 |
| mechanics | blocking | xmessage fixture can't be auto-focused by pid | upheld | Decision 29 (same as intent) |
| mechanics | major | Sandbox-local pid used as host pid | upheld | Decision 29 |
| mechanics | major | Archive still unbounded | downgraded (minor) | Archive's own git and file work is pre-existing; screens' share now ≤ ~1 s; Decision 31 |
| mechanics | major | `--hold` total time unbounded | upheld | Token caps; Decision 30 |
| mechanics | major | Single-instance apps (Chromium profile) cross sessions | downgraded (minor) | A launch-command concern, not the screen tool's; worker rule now says use a per-launch profile dir |

### Round 6 — 2026-11-18

**Lanes:** claude / claude-opus-5-5 (intent); gpt (mechanics); cross-family: yes.

**Changed since Round 5:** generation in screen slice names, sweep compares names (28); auto-focus best effort, first new window, `focused: {id,name}|null` (29); `--hold` presses keys together, ≤6 held and ≤20 tapped (30); archive does one 1 s-bounded kill on the thread slice plus `stop --no-block` (31); worker rule asks for a per-launch profile/data dir; new Accepted Risk for a run racing archive.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Thread-slice kill doesn't bump generations | upheld | Decision 32 |
| intent | minor | Decision 31 doesn't supersede 25 | upheld | Marked superseded |
| intent | minor | Teardown says archive keeps shots | upheld | Wording fixed |
| mechanics | blocking | Sweep can stop a screen being started; restart can reuse a generation | upheld | Reserved generation before spawn; Decision 32 |
| mechanics | major | Stop submission not inside the 1 s budget | upheld | Shared 1 s deadline; Decision 32 |
| mechanics | major | RE-RAISE: archive race lasts while synchronous git runs | accepted-risk | Evidence correct (machine/service.js:817-843); Accepted Risk reworded; fix belongs to archive's git, outside this feature |
| mechanics | major | Key op has no total deadline; failed keyup | upheld | Decision 33 |
| mechanics | minor | Focus failure after launch returns 422 | upheld | Success with `focused: null`; Decision 33 |

### Round 7 — 2026-11-18

**Lanes:** claude / claude-opus-5-5 (intent); gpt (mechanics); cross-family: yes. Budget reset by Collin's decision 34.

**Changed since Round 6:** generation reserved in `state.json` before spawn and `starting` screens held by the sweep; thread-slice kill bumps every generation of the thread; kill and stop submission share a 1 s deadline (32); one deadline per `key` op, releases always attempted, failed release blocks input until `screen stop`, focus failure still a successful `run` (33); archive-race Accepted Risk reworded; session stop keeps shots while archive removes them.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Screens dir vs uploads kept mid-rebase | upheld | Kept together; Decision 35 |
| intent | minor | "Both delete the cookie" unclear | upheld | Every teardown deletes it |
| intent | minor | Input timeout rule vs type/key rules | upheld | Specific rules take precedence |
| mechanics | blocking | Cut-off tap can leave a key down | downgraded (minor) | Only on a stalled xdotool; fixed anyway: tap released too; Decision 35 |
| mechanics | major | One stalled keyup starves the rest | downgraded (minor) | Same stall case; releases in parallel; Decision 35 |
| mechanics | blocking | `env` reads `--help` as its own option; `-` clears env | upheld | `env --`, `-` refused; Decision 35 |
| mechanics | major | Missing executable vs success undefined | upheld | Resolved before launch; Decision 35 |
| mechanics | major | Auto-focus probes unbounded | upheld | 1 s probes, ≤ 6 s; Decision 35 |
| mechanics | major | Late state write after archive recreates dir | accepted-risk | Same-moment timing case per Decision 34; Accepted Risks |
| mechanics | major | 1 s archive claim leaves out file work; removal failure | downgraded (minor) | Wording: 1 s covers systemctl only; failure logged, archive outcome unchanged |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-18: xdotool installed on hearth by Collin (sudo card, exit 0).
