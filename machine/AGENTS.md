# `machine/` — per-machine agent session service

Owned by the repo root. The service is the only component that starts, reads, types into,
stops, or writes git for agent sessions. The hub owns thread policy and token minting;
agents own neither tmux nor the machine secret.

| File | Role |
|---|---|
| `service.js` | Dependency-free Node HTTP service, session registry, tmux/git boundary, worktrees, readiness, transcript copies, and durable spools. |
| `hook.sh` | CLI hook entry point; turns Claude/Codex payloads into local events and spools while the service is down. |
| `lib/hook-post.js` | Dependency-free HTTP/spool helper used by `hook.sh`. |
| `API.md` | The hub-to-machine and agent-to-machine route contract. |
| `test/` | Isolated fakes and service tests; never uses a real CLI, tmux, or state directory. |

## Boundaries

- Never put the machine secret in an agent environment. Session tokens authorize only their
  own local agent calls.
- Never accept a hub secret on an agent route, or a session token on a hub route.
- A session name must start `wc-`; unmanaged tmux sessions are observable but never typed
  into or stopped here.
- Git subprocesses use the authenticated session's recorded worktree, never a caller path.
