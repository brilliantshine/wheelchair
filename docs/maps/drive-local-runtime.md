# Map: local app driving

Checked against: `207c02f5e0b56cfbcc96046cca10a8df92002a9c` (origin/main and worktree HEAD).
Files covered: `install.sh`, `machine/service.js`, `machine/API.md`, `machine/lib/project-mcp.js`, `machine/adapters/claude.js`, `machine/adapters/codex.js`, `machine/adapters/agy.js`, `viewer/app/threads.js`, `viewer/app/sessions.js`, `viewer/app/ready.js`, `viewer/app/cards.js`, `viewer/pages/thread.js`, `protocol/app/worker.md`, `protocol/app/verifier.md`, `protocol/app/cards-lead.md`, `docs/plans/local-projects/PLAN.md`.

> Screen and Ready paths: see [agent-screens.md](agent-screens.md), rechecked against `6e89dfb4b0bf67e121b8ab4c3b720844ee4a74d7`; historical claims below that screens and approval warnings do not exist are superseded. Other coverage retains its historical checked commit.

```text
thread selects machine -> hub checks project and readiness -> machine creates worktree
  -> tmux starts CLI with project tools -> agent runs and checks app
  -> image file -> lead image card -> machine uploads -> thread displays image
```

1. New threads take the supplied machine, defaulting to `hub`; the hub checks the project on that machine, then starts the lead there (`viewer/app/threads.js:20-25,41-76`). Child starts also target `thread.machine`, with separate worker and detached verifier worktrees (`viewer/app/sessions.js:304-330,615-630`). Machine status reports service commit, installed CLI versions/login, accounts and sessions, not a screen capability (`machine/service.js:1156-1171`; `machine/API.md:29`). Ready checks reachability, matching service commit and the thread CLI's installation and eligible login, not display access (`viewer/app/ready.js:11-15,29-58`).
2. The installer creates a Linux user machine unit with PATH and `KillMode=process`; macOS uses a logged-in `gui/<uid>` launch agent with HOME, PATH and `AbandonProcessGroup` (`install.sh:312-352,367-405`). The service creates a worktree and launches tmux in it; Linux tries `systemd-run --user --scope` then falls back to tmux, while macOS skips the scope (`machine/service.js:596-600,606-627`). The command explicitly adds wheelchair and account variables, but not DISPLAY, WAYLAND_DISPLAY, XAUTHORITY, DBUS_SESSION_BUS_ADDRESS or XDG_RUNTIME_DIR; neither generated service definition sets those five (`machine/service.js:616-625`; `install.sh:329-339,392-405`). Their actual availability depends on the service manager and tmux environment; GUI access and authorization are not guaranteed.
3. The service reads the worktree's `.mcp.json`, validates regular-file size, JSON and stdio/http entries, and passes it to the CLI adapter; lead, sub-lead, worker and verifier are tool roles (`machine/lib/project-mcp.js:6-41`; `machine/service.js:606-615`). Claude approves valid project servers and disables rejected ones; Codex translates supported entries into `mcp_servers.project_*` overrides and skips unsupported cases; Antigravity warns it does not support project tools (`machine/adapters/claude.js:63-74`; `machine/adapters/codex.js:58-102`; `machine/adapters/agy.js:30-32`). Warnings go to the machine log (`machine/service.js:612-614`). The merged plan's earlier environment-expansion and user-facing-warning proposals were superseded in practice; consult implementation rather than its earlier decisions (`docs/plans/local-projects/PLAN.md:38-41,194-196`; `machine/adapters/codex.js:73-77`). Installer removes retired skill wrappers; it does not install a screen skill (`install.sh:77-105`).
4. The installer installs Playwright's Chromium and Firefox unless dependencies are skipped (`install.sh:115-124`). Verifier steps-only rules call for a safely isolated app and a headless browser at phone size; ordinary verification checks code, validation and intent (`protocol/app/verifier.md:33-50,52-72`). Worker rules require the brief's validation but contain no visual-check or screenshot instruction (`protocol/app/worker.md:23-37`). These are browser paths, not a desktop capture/input facility.
5. A lead image card accepts an absolute PNG/JPEG/GIF/WebP path up to 25 MB; other sessions' screenshots reach Collin through the lead (`protocol/app/cards-lead.md:209-220`). The machine validates and copies the file into thread uploads, the hub records its basename and the thread displays it (`machine/service.js:329-346,1564`; `viewer/app/cards.js:133`; `viewer/pages/thread.js:916-919`). This transports an existing file and does not capture one.

## Observation on this machine

In this mapper process, `XDG_SESSION_TYPE` was unset. `command -v` found none of `grim`, `gnome-screenshot`, `xdotool`, `ydotool`, `scrot`, `import`, or `screencapture` on its PATH. This is the mapper environment, not proof about another login, service, or the machine's actual desktop session.

## What I did not look at

Live systemd, launchd or tmux environments; display authorization, desktop compositor or actual GUI interaction; CLI vendor MCP discovery or an active MCP connection; other screenshot tools or installed skills outside this repository; all browser-test fixtures and image-upload failure paths.
