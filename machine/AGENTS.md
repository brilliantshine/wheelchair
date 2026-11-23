# `machine/` — per-machine agent session service

Owned by the repo root. The service is the only component that starts, reads, types into,
stops, or writes git for agent sessions. The hub owns thread policy and token minting;
agents own neither tmux nor the machine secret.

| File | Role |
|---|---|
| `service.js` | Dependency-free Node HTTP service, session registry, tmux/git boundary, worktrees (each new one links the clone's installed `node_modules` and lists the links in git's exclude file; `from_remote_branch` builds one at an exact pushed commit), the hub-only `/v1/handoff` actions (claims, branch inspection, kill/running) and durable archive markers, readiness, transcript copies, and durable spools. |
| `../connectors/` (see its [README](../connectors/README.md)) | Every tool's commands, login folders, hook translation and usage parsing live in `connectors/<cli>/machine.js`; the service loads them through `connectors/index.js`. |
| `hook.sh`, `lib/hook-in.js`, `lib/hook-post.js` | CLI hook bridge: `hook.sh` execs `hook-in.js`, which follows the tool's manifest `hook` field and posts through `hook-post.js`. |
| `statusline.sh`, `lib/statusline.js` | Claude status display and throttled usage delivery. |
| `lib/harness-recipes.js`, `lib/harness-install.js` | Harness install recipes and detached jobs, persisted state, setup and validation. |
| `test/harness-install.test.js` | Harness install job and route coverage. |
| `lib/try.js` | Folder-local Try records, checks, Git switches and metadata-only status. |
| `test/try.test.js` | Try endpoint, record, switching and status tests against isolated repositories. |
| `lib/aside-turns.js` | Durable headless aside turns, CLI spawning, parsing and restart recovery. |
| `lib/sudo.js` | Durable sudo request registration, polling, outcome delivery and cancellation. |
| `lib/win.js` | Windows bridge lifecycle, session routing, readying and copy cleanup, Windows tool tracking across restarts, cached bridge health (background probe), and the per-session ready file (`win-ready/<session>`) the Windows tool go-between polls. |
| `lib/win-env.js` | WSL detection (kernel, enabled interop), Windows paths, interop and PowerShell environment, the health probe. |
| `lib/win-disk.js` | `win info` disk report: cached background copy-size walks, Git object size, conflict ref count, Windows free space and warnings. |
| `lib/win-prompt.js` | Pure builder for the bridge-broken and MCP for Unity lines added to a tool-role session's prompt file. |
| `lib/unity-prep.js` | `POST /v1/project-tools/unity-prep`: finds Windows `uvx.exe` and fetches MCP for Unity once in the background. |
| `lib/win-sync.js` | Windows worktree copies and Git reconciliation. |
| `lib/win-mark.js` | The "Runs on Windows" eligibility rule for localhost HTTP tools and the textual URL rewrite to a private port. |
| `lib/win-forward.js` | Forwards for Windows localhost tools: private Linux ports, `win/forwards.json` record and restore, one relay per connection, status checks. |
| `lib/win-relay.ps1` | The Windows relay a forward runs per connection (`connect`) or per status check (`check`): dials the tool port, refuses ports that lead back to Linux, then pipes bytes. |
| `lib/win-args.js` | Windows bridge argument validation. |
| `lib/win-apps.js` | Windows app tracking for the bridge: PowerShell wrapper in a named Job Object, run/start/status/stop, window listing and screenshots, `apps.json`, restart cleanup and sweep. |
| `lib/win-tool-wrap.js` | Pure builder of the per-session `replaceEntries` map that launches WSL tool roles' Windows stdio MCP entries through the go-between, and the tool-list cache key. |
| `lib/win-tool-proxy.js` | The Windows tool go-between: stands in for a Windows stdio MCP server until the copy's ready file says `ready`, then starts the real tool, hands off and keeps its last tool list in `win-tool-lists/`. |
| `test/windows-live.sh`, `test/windows-live.js` | Live Windows bridge check through the real service on a WSL machine, with an optional Unity part (`WHEELCHAIR_UNITY`, fixture `test/fixtures/unity-min/`) that also checks the MCP for Unity stdio server when Windows has `uvx.exe`; exit 77 when not WSL or Unity is skipped. |
| `lib/screen.js` | Per-session invisible X screens for `POST /v1/agent/screen`: Xvfb with a per-screen cookie, app launch (sandboxed for Codex), screenshots, validated xdotool input, one systemd user slice per screen for teardown, the 60 s sweep and startup cleanup. `test/screen-live.sh` drives it against real Xvfb. |
| `lib/screen-input.js` | X-tool layer for screens: window listing, screenshots, pointer, typing, key deadlines and releases, auto-focus. |
| `lib/screen-args.js` | Pure validation of `wc.js screen` arguments (fixed key list, limits) and `xwininfo` output parsing. |
| `lib/usage-probe.js` | Asynchronous, timed CLI usage probe runner. |
| `lib/project-mcp.js` | Reads project MCP servers (including the `wheelchair.windows` marks) and exposes shared document and entry validation. |
| `lib/project-tools.js` | Reads and saves project tools and manages stored keys through GitHub PRs. |
| `lib/project-keys.js` | Shared project key references, identity, storage and launch selection. |
| `lib/env-launch.js` | Session key launcher: reads and deletes the mode-600 JSON env file, then execs the CLI; never prints values. |
| `lib/project-programs.js` | Synchronous check that each project stdio server's program exists, for the thread's project-tools lines. |
| `lib/limits.js` | Pure exhausted-window reset calculation. |
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
