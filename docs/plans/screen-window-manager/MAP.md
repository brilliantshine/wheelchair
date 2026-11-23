# Screen window manager map

```text
screen request -> reserve screen -> Xvfb ready -> launch app -> list / focus windows
                                               -> stop / sweep -> slice cleanup
approval post -> machine tool warning -> hub card -> display
                         Ready gate -> service and CLI check
```

The current flow, paths, test commands and line evidence are in [agent-screens](../../maps/agent-screens.md). `screenTools()` finds required executables on the service PATH and returns only `missing` (`machine/lib/screen.js:10-25`); the installer has a separate Linux-only list and no macOS counterpart (`install.sh:512-532`). Approval warnings are populated on the machine at card creation, while the hub Ready gate is separate and its recheck does not recompute those warnings (`machine/service.js:2370-2389`; `viewer/app/threads.js:381-395`).

The earlier design is S4 and Decision Log / Review Rounds 1–6 in `git show e71d4e0:docs/plans/screens-solid/PLAN.md`. Its assumptions still hold: per-screen systemd slices and generation fences, Xvfb readiness before running, `trySave`, startup teardown, root-child listing, `xdotool windowfocus`, and sandboxed Codex app launch (`machine/lib/screen.js:39-51,81-98,122-130,151-176,186-207`; `machine/lib/screen-input.js:32-48,115-130`). A reparenting WM therefore changes what root-child listing sees, as the earlier design anticipated. App launch is wrapped in the Codex sandbox, but a separately started WM is outside that wrapper; its executable actions and configuration are relevant to that boundary (`machine/lib/screen.js:186-198`).

The earlier plan's proposed openbox state, readiness polling, fixed configuration and WM-specific list/focus behavior are not implemented on this branch: state has no `window_manager`, `screenTools()` has no openbox result, start saves running immediately after xauth, and input uses root children and `windowfocus` unconditionally (`machine/lib/screen.js:24-25,52-59,171-176`; `machine/lib/screen-input.js:32-35,115-125`). The old plan's title path `openbox-rc.xml` conflicts with its detailed `openbox/rc.xml` instructions (S4); treat that as a historical inconsistency. The branch also now has an eight-screen cap and launch hand-over, so older maps describing no cap and silent launcher failure are stale (`machine/lib/screen.js:40,147,197-227`).

Not checked: real openbox behavior or host configuration; live service PATH and installed packages; unrelated platform and application behavior.
