# Map: drive a local app

Checked against `207c02f5e0b56cfbcc96046cca10a8df92002a9c` (origin/main). Detailed, rechecked source and observation: [local app driving](../../maps/drive-local-runtime.md). The older [local project runtime](../../maps/local-project-runtime.md), [macOS runtime](../../maps/macos-runtime.md), and [app sessions](../../maps/app-sessions.md) maps cover files that changed since their recorded commits; use the new map for this feature's rechecked paths. No `app-diagrams-uploads` map exists under that name.

```text
choose thread machine -> readiness and worktree -> tmux agent -> local app
  -> capture and input needed -> screenshot file -> lead image card -> thread
```

The thread's machine is fixed at creation and used for its child sessions; readiness checks service version and CLI login, not GUI capability (`viewer/app/threads.js:20-25,57-76`; `viewer/app/sessions.js:304-330`; `viewer/app/ready.js:29-58`). The Linux service sets PATH and starts tmux in a user scope where possible; the Mac service is a GUI-domain launch agent. Neither service nor session launch explicitly supplies the five display/session variables, so a real usable screen cannot be inferred from a running session (`install.sh:312-352,367-405`; `machine/service.js:606-625`).

Project MCP tools already reach lead, worker and verifier roles through `.mcp.json` for Claude and Codex; Antigravity does not support that path yet (`machine/lib/project-mcp.js:6-41`; `machine/adapters/claude.js:69-74`; `machine/adapters/codex.js:65-102`; `machine/adapters/agy.js:30-32`). Playwright supplies browser binaries, while current verifier visual steps use a headless browser; neither establishes desktop app or game input (`install.sh:115-124`; `protocol/app/verifier.md:60-68`). The image card moves an existing image through machine uploads to the thread; it does not create screenshots (`protocol/app/cards-lead.md:209-220`; `machine/service.js:329-346`; `viewer/pages/thread.js:916-919`).

The mapper process had `XDG_SESSION_TYPE` unset and none of the seven requested desktop utilities on PATH; this does not establish the actual desktop session or service environment.

## What I did not look at

Live GUI, tmux and service environments, desktop permissions, vendor MCP discovery, other capture programs or installed skills outside the repository, and complete image-upload failure cases.
