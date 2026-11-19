# Map: agent screens

Checked against: `e4117bdcacf06f2a3c73dd22d8af8d8086cb00e3` (origin/main and worktree HEAD).
Files covered: `viewer/app/wc.js`, `viewer/app/ready.js`, `viewer/app/routes.js`, `viewer/app/threads.js`, `machine/service.js`, `machine/lib/screen.js`, `machine/lib/screen-input.js`, `machine/test/screen.test.js`, `machine/test/screen-input.test.js`, `machine/test/screen-args.test.js`, `machine/test/screen-live.sh`, `machine/test/screen-live.js`, `viewer/test/wc-screen.test.js`, `install.sh`, `install/test/run.sh`.

```text
wc screen -> authenticated machine route -> session queue -> start screen -> launch app -> input or shot
                                                   | stop, sweep, restart or archive
                                               kill screen slice -> reset state
                                               archive completion -> remove thread files
```

`wc.js` packages the operation and arguments for the agent route (`viewer/app/wc.js:98-102,158-175`); the service authenticates the session and the manager validates and queues operations per session, rejecting reviewers and non-Linux hosts (`machine/service.js:1615`; `machine/lib/screen.js:197-203`). `start` and `run` create or reuse one screen per session, with default 1280×800 for `run`; the in-memory `screens` map contains starting and running screens, but there is no global cap or count check (`machine/lib/screen.js:33-35,132-141,205-211`).

Before start, the manager checks executable tools on the service PATH and reports all missing names as 422; it also checks the user systemd bus (`machine/lib/screen.js:10,15-20,132-138`). Ready currently checks service reachability, version and the thread CLI login, not screen tools (`viewer/app/ready.js:29-58`). Machine `/v1/status` reports CLI, account and session data, not screen dependencies; its existing CLI detection uses `command -v` (`machine/service.js:1168-1183,1488`). Installer `command -v` at `install.sh:25-27` detects Tailscale, not screen tools; existing warnings include `install.sh:130-135,211`, and its platform check is at `install.sh:22-24`.

The manager reserves a generation and writes `state.json` under `<stateDir>/screens/<thread>/<session>` before spawning Xvfb through a systemd user scope in a per-generation slice, with an X authority cookie and display fd (`machine/lib/screen.js:34-52,123-123,140-167`). State defaults are generation, status, display, size, xvfb_pid, next_shot, next_app, apps and input_locked; each app record is `{n, unit, log, command}`, with no app PID or process group (`machine/lib/screen.js:45-52,185-190`). `xvfb_pid` is the spawned `systemd-run` child PID (`machine/lib/screen.js:149-151,167`).

App launch rebuilds the session environment without its token, validates the executable, uses the Codex sandbox when applicable, saves an app record and appends both launcher stdout and stderr to `app-N.log` (`machine/lib/screen.js:177-191`). Registration watches exit/error or active scope for up to three seconds but returns no result; launch does not inspect exit status or log and returns success after autofocus, so a failed launcher can be reported successful (`machine/lib/screen.js:118-131,190-195`; `docs/plans/drive-local-app/PLAN.md:421`). Status only probes whether each app scope is active and reports running/exited plus the log path, not an exit code or log contents (`machine/lib/screen.js:214-217`).

Session stop immediately kills its slice; archive kills the thread slice before stopping sessions; startup kills the parent slice and resets disk state, and the 60-second sweep tears down dead sessions and unheld slices (`machine/service.js:366-368,777-784,808-823`; `machine/lib/screen.js:54-72,74-90,98-105`). Explicit stop and sweep reset state, send SIGTERM, and schedule SIGKILL and stop three seconds later (`machine/lib/screen.js:93-101,213`). Reset removes the cookie but preserves numbered files and counters (`machine/lib/screen.js:45-56`).

Archive is already wired to remove the entire thread screen directory: the hub calls the machine and reopens the thread for a pending rebase or upload cleanup failure (`viewer/app/routes.js:541-542`; `viewer/app/threads.js:197-238`); the machine cleans worktrees then removes screens only after uploads succeed and no rebase remains (`machine/service.js:825-879`; `machine/lib/screen.js:72`). Screen removal errors are logged and swallowed, so they do not change archive success (`machine/lib/screen.js:72`). The prior plan records a race where in-flight work can recreate the directory after removal and a run can overlap synchronous archive git (`docs/plans/drive-local-app/PLAN.md:424-430`).

Drag shares a 10-second deadline for moves and mousedown, but always attempts mouseup with a separate one-second timeout, so it can overrun the budget (`machine/lib/screen-input.js:69-80`; `docs/plans/drive-local-app/PLAN.md:422`). Screenshots use ffmpeg and numbered PNGs (`machine/lib/screen-input.js:50-67`; `machine/lib/screen.js:224`).

Tests generate fake executables in temporary directories: `screen.test.js:21-60` supplies Xvfb, ffmpeg, xdotool, systemctl and a systemd-run wrapper; lifecycle, missing tools, archive and cleanup tests are at `machine/test/screen.test.js:73-242`. Input fakes and drag tests are in `machine/test/screen-input.test.js:8-27,39`; parsing is in `machine/test/screen-args.test.js:7-49`, and CLI transport is in `viewer/test/wc-screen.test.js:25-90`. The live check requires real screen tools and uses fake tmux and CLI (`machine/test/screen-live.sh:2-6`; `machine/test/screen-live.js:98-108`). Installer fixtures use temporary homes and shims (`install/test/run.sh:1-12,68-75`).

On hearth, `command -v` found none of `openbox`, `fluxbox`, `xfwm4`, `metacity`, `i3`, `icewm`, `twm`, `matchbox-window-manager`, or `awesome` on this session's PATH (checked 2026-11-18); this does not establish whether other window managers are installed or on the service PATH.

Not checked: other window manager names or package databases; live systemd, screen tools, or service environment; all callers and tests outside the paths above.
