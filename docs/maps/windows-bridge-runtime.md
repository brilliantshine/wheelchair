# Map: Windows bridge runtime

Checked against: `cb736689c215175211cdc324422c65d7c8a08a70` (origin/main and worktree HEAD). Files covered: `machine/service.js`, `machine/lib/win.js`, `machine/lib/win-env.js`, `machine/lib/win-sync.js`, `machine/lib/win-apps.js`, `machine/lib/project-mcp.js`, `machine/lib/project-programs.js`, `machine/adapters/`, `viewer/app/wc.js`, `machine/API.md`, `machine/test/`, `README.md`.

```text
session worktree -> read project tools -> ready Windows copy -> launch agent CLI
                                      -> timeout -> launch while copy readies
agent win command -> authenticated machine route -> copy sync or Windows app
session stop / merge / archive -> reconcile when needed -> remove eligible copies
```

The machine reads `.mcp.json`, recognizes Windows stdio executables, builds provider-specific CLI configuration, waits for bridge readying, then launches the agent in tmux (`machine/service.js:810-829,865-893`). Windows commands under the configured mount or `/mnt`, ending in `.exe`, are recognized; `.cmd` is not (`machine/lib/project-programs.js:16-21`). `WinBridge.beforeLaunch` waits at most 45 seconds; readying creates and reconciles a copy in the background and records failures (`machine/lib/win.js:30,129-185`).

A copy lives at `%LOCALAPPDATA%/Wheelchair/copies/<thread>/<worktree-key>`, the key being a hash of the Linux worktree path (`machine/lib/win-env.js:47-49,160-163`). `ensureCopy` initializes a separate Git repository and can seed ignored files from another copy (`machine/lib/win-sync.js:71-118`). Reconciliation snapshots raw files in temporary indexes, fetches Windows snapshots into the Linux repository and stores conflict refs (`machine/lib/win-sync.js:149-163,259-310`). Stop, worktree removal and archive reconcile or remove copies according to role and failure state; failed copies can be kept (`machine/lib/win.js:210-240,249-276`). Deletion removes the copy and its base/windows refs, saving an unresolved snapshot under a conflict ref when requested (`machine/lib/win-sync.js:121-135`).

`wc.js win` sends an authenticated request to the machine, whose bridge checks role and session (`viewer/app/wc.js:101-111`; `machine/service.js:2176`; `machine/lib/win.js:315-335`). `info` returns WSL, Git health, readiness, reason, copy paths and sandbox status, not disk sizes (`machine/lib/win.js:307-312`). Linux and Windows Git must both be at least 2.43; PowerShell or Git startup errors become a reason (`machine/lib/win-env.js:85-90,118-124,141-155`). WSL detection checks the kernel release and interop registration, and reads the automount root; it does not detect networking mode (`machine/lib/win-env.js:8-27`).

Windows apps launched through the bridge are contained in a named Job Object (`machine/lib/win-apps.js:60-85`). Store-packaged apps can hand off outside it, so their windows and processes are outside `windows`, `shot`, and `stop` (`README.md:92`; `docs/plans/windows-bridge/PLAN.md:118`).

Tests: `machine/test/win.test.js:119,141,162,179,193,207,275,291,323`, `machine/test/win-sync.test.js:194,225,294,372`, `machine/test/win-env.test.js:8,16,22`, and `machine/test/win-service.test.js:52,69,81,101` exercise these boundaries. The separate WSL live harness tests sync and Windows apps, with optional Unity (`machine/test/windows-live.sh:1`; `machine/test/windows-live.js:148-172`).

Not checked: live WSL networking, actual disk usage or Git garbage collection, all provider internals, and Unity MCP vendor behavior.
