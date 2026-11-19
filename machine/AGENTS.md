# `machine/` — per-machine agent session service

Owned by the repo root. The service is the only component that starts, reads, types into,
stops, or writes git for agent sessions. The hub owns thread policy and token minting;
agents own neither tmux nor the machine secret.

| File | Role |
|---|---|
| `service.js` | Dependency-free Node HTTP service, session registry, tmux/git boundary, worktrees (each new one links the clone's installed `node_modules` and lists the links in git's exclude file; `from_remote_branch` builds one at an exact pushed commit), the hub-only `/v1/handoff` actions (claims, branch inspection, kill/running) and durable archive markers, readiness, transcript copies, and durable spools. |
| `adapters/` | CLI-specific commands, login folders, hook translation and usage parsing (`claude.js`, `codex.js`, `agy.js`). |
| `statusline.sh`, `lib/statusline.js` | Claude status display and throttled usage delivery. |
| `lib/aside-turns.js` | Durable headless aside turns, CLI spawning, parsing and restart recovery. |
| `lib/sudo.js` | Durable sudo request registration, polling, outcome delivery and cancellation. |
| `lib/screen.js` | Per-session invisible X screens for `POST /v1/agent/screen`: Xvfb with a per-screen cookie, app launch (sandboxed for Codex), screenshots, validated xdotool input, one systemd user slice per screen for teardown, the 60 s sweep and startup cleanup. `test/screen-live.sh` drives it against real Xvfb. |
| `lib/usage-probe.js` | Asynchronous, timed CLI usage probe runner. |
| `lib/project-mcp.js` | Reads and validates project MCP servers for session adapters. |
| `lib/limits.js` | Pure exhausted-window reset calculation. |
| `lib/startup-warning.js` | Background startup-size check: ledger tail and kept-transcript first-call samples against `STARTUP_TYPICAL`, giving the approval card's `warnings` line. |
| `hook.sh` | CLI hook entry point; turns Claude/Codex/Antigravity payloads into local events and spools while the service is down. |
| `lib/hook-post.js` | Dependency-free HTTP/spool helper used by `hook.sh`. |
| `API.md` | The hub-to-machine and agent-to-machine route contract. |
| `test/` | Isolated fakes and service tests; never uses a real CLI, tmux, or state directory. `fixtures/agy/` holds live captures from `agy` 1.5.9. |

Test temp folders come from `test-support/run-dir.js` (`makeTemp`/`makeTempSync`), which removes them when the test process ends; never allocate from `os.tmpdir()` directly in a test.

## Boundaries

- Never put the machine secret in an agent environment. Session tokens authorize only their
  own local agent calls.
- Never accept a hub secret on an agent route, or a session token on a hub route.
- A session name must start `wc-`; unmanaged tmux sessions are observable but never typed
  into or stopped here.
- A recovered session (rebuilt from a live `wc-*` tmux session) has no token and never authorizes an agent route.
- Git subprocesses use the authenticated session's recorded worktree, never a caller path.

`lib/steps.js` classifies Claude and Codex tool calls into compact activity labels and timing keys. `lib/codex-steps.js` parses Codex rollout steps and context; the service tails bound live sessions and flushes them at turn end. Claude tool hooks emit step start/end events; its statusline emits context and rate-limit events on independent throttles.
