# Map: screen hardening

Checked against `e4117bdcacf06f2a3c73dd22d8af8d8086cb00e3` (origin/main and worktree HEAD). The detailed reusable map is [agent screens](../../maps/agent-screens.md).

```text
Ready -> machine status -> screen start -> app scope -> input and screenshots
                                           | stop or archive
                                       kill slice -> reset -> archive removes files
```

- Ready has no screen-tool check; status has no screen-tool fields, while screen start already detects missing executables by name. The installer reference in the old plan is Tailscale detection, not a screen warning (`viewer/app/ready.js:29-58`; `machine/service.js:1168-1183`; `machine/lib/screen.js:10,132-138`; `install.sh:25-27`).
- `screens` holds starting and running sessions with no cap; state tracks a generation and app `{n, unit, log, command}`, not app PID/group. `registered()` discards launcher exit/registration outcome and `launch()` returns success without reading its log; status only checks active scope (`machine/lib/screen.js:33-35,45-52,124-141,185-195,214-217`).
- Drag's mouseup has an extra one-second timeout outside the shared ten-second budget (`machine/lib/screen-input.js:69-80`).
- Archive already kills the thread slice and removes its screen directory after uploads succeed, unless a rebase remains; removal errors are logged rather than returned (`viewer/app/threads.js:215-233`; `machine/service.js:817-823,871-879`; `machine/lib/screen.js:68-72`). The prior plan records archive races (`docs/plans/drive-local-app/PLAN.md:424-430`).
- Fakes are generated in `machine/test/screen.test.js:21-60` and `machine/test/screen-input.test.js:8-27`; live and CLI tests are at `machine/test/screen-live.sh:2-6`, `machine/test/screen-live.js:98-108`, and `viewer/test/wc-screen.test.js:25-90`. No listed small window manager was found on this hearth session's PATH; the names checked are in the reusable map.

Not checked: other window managers or package databases, live screen behavior, the service's PATH, or unrelated callers and tests.
