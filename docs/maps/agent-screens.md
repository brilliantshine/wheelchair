# Map: agent screens

Checked against: `6e89dfb4b0bf67e121b8ab4c3b720844ee4a74d7` (origin/main; screen paths also checked in worktree).
Files covered: `viewer/app/wc.js`, `viewer/app/ready.js`, `viewer/app/threads.js`, `viewer/pages/thread.js`, `machine/service.js`, `machine/lib/screen.js`, `machine/lib/screen-input.js`, `machine/lib/screen-args.js`, `machine/test/screen.test.js`, `machine/test/screen-input.test.js`, `machine/test/screen-args.test.js`, `machine/test/screen-tools-warning.test.js`, `machine/test/screen-live.sh`, `machine/test/screen-live.js`, `viewer/test/wc-screen.test.js`, `install.sh`, `install/test/run.sh`.

```text
wc screen -> authenticated machine route -> per-session queue -> Xvfb scope -> app scope -> input / screenshot
                                                      -> stop / sweep / archive -> kill screen slice
approval card -> machine screen tool warning -> hub card -> thread display
                                      hub Ready check -> start-building gate
```

`wc.js` sends screen operations to the authenticated agent route (`viewer/app/wc.js:98`; `machine/service.js:2438`); the manager rejects reviewers and non-Linux, validates arguments and serializes per session (`machine/lib/screen.js:233-239`). Start reuses a live display, checks required tools and systemd, checks the session, and reserves one of eight slots including starting screens (`machine/lib/screen.js:139-150`). A private cookie and Xvfb scope with `-displayfd` establish the display; it waits up to 10 seconds for a valid number, adds the matching xauth entry, fences against stop/archive and saves running (`machine/lib/screen.js:151-183`).

Each screen uses `<stateDir>/screens/<thread>/<session>` with private `state.json`, `xauth`, `app-N.log`, `app-N.started` and `shot-N.png`; state saves atomically, `trySave` logs failures, reset clears live state and cookie while preserving counters/files (`machine/lib/screen.js:39-64,194-207,253-262`). App launch strips the session token, sets DISPLAY and XAUTHORITY, checks the executable and launches in a separate scope; sandboxed Codex wraps the command with `codex sandbox` workspace-write and network access, whereas unrestricted Codex and other CLIs execute the command directly (`machine/lib/screen.js:186-208`). The marker before exec is a five-second hand-over, not proof that the app itself succeeded; timeout or early launcher exit kills the scope and returns a log-derived error (`machine/lib/screen.js:197-229`).

Listing parses `xwininfo -root -children`, inspects each ID with `xwininfo -id`, and keeps viewable windows; explicit focus and autofocus use `xdotool windowfocus` (`machine/lib/screen-input.js:32-48,115-130`). No xprop or wmctrl path is present in this implementation (`machine/lib/screen-input.js:1-133`). Screenshots use ffmpeg; keyboard and pointer use xdotool (`machine/lib/screen-input.js:50-91`). Stop resets state and sends SIGTERM, followed by SIGKILL and stop after three seconds; session/thread teardown kills immediately, startup kills the parent slice and resets saved screens, and sweep cleans dead sessions and orphan slices (`machine/lib/screen.js:61-112`; `machine/service.js:455`).

On Linux the machine adds missing-required-tool warnings to lead approval cards, replacing caller-supplied warnings; the hub's Ready check separately checks service version and CLI login, and recheck/start-building recompute that gate (`machine/service.js:2370-2389`; `viewer/app/ready.js:29-74`; `viewer/app/threads.js:381-395`). The thread displays card warnings (`viewer/pages/thread.js:1039-1045`). Installer independently checks the same required tools and prints Debian package hints only on Linux, with no Darwin screen warning (`install.sh:512-532`; `install/test/run.sh:754-779`). `screenTools()` currently returns only `missing` (`machine/lib/screen.js:10-25`).

Tests: `bash machine/test/run.sh` runs the machine Node tests, including screen lifecycle, input, argument and approval warnings (`machine/test/run.sh:1-3`; `machine/test/screen.test.js:99,260`; `machine/test/screen-tools-warning.test.js:17`). CLI transport uses `node --test viewer/test/wc-screen.test.js`; installer fixtures use `bash install/test/run.sh`; real Linux screen tools and a user systemd session are exercised by `bash machine/test/screen-live.sh` (`machine/test/screen-live.sh:2-6`).

Not checked: actual installed window managers or live systemd environment; the complete hub card delivery and all unrelated screen input failure paths.
