# Machine service API

The hub calls every `/v1/*` route with `X-Wheelchair-Machine-Secret`, whose value is the
contents of `machine.json`'s `secret_file`. Agents call only `/v1/agent/*`, with
`X-Wheelchair-Session-Token`; a token is valid only for a session the service started.
The secret is never inherited by a tmux session.

| Route | Caller | Meaning |
|---|---|---|
| `POST /v1/sessions` | hub | Start a session. Body contains `role`, `cli`, `thread_id`, `token`, and either `worktree` or a project/worktree description. Optional `model`, `brief`, `attempt_id`, and `name` are retained. New worktrees discover `origin`'s default branch after fetch (with `remote show` then `main` fallbacks), and return it as `default_branch`. A replacement worker carrying both `worktree` and `branch` starts there only when that directory exists and is already on that branch. |
| `GET /v1/sessions` | hub | Managed sessions (`managed: true`) and live tmux status, plus every other tmux session as read-only `{ name, managed: false, running: true }`. A live `wc-*` session missing from `sessions.json` is re-adopted at start with `recovered: true` and no token. |
| `POST /v1/archive` | hub | `{ "thread_id": "…" }`; stop the thread's sessions, locally commit or retain its service-created worktrees as appropriate, remove clean worktrees, and forget its sessions. A session whose worktree is retained stays as a non-running `archived_pending` record so a later archive can remove it after the problem is resolved. Returns `200 { "stopped": [names], "committed": [{ "worktree", "commit" }], "removed": [paths], "kept": [{ "worktree", "reason" }] }`. |
| `DELETE /v1/sessions/:name` | hub | Stop a managed session. |
| `GET /v1/sessions/:name/pane` | hub | Current pane text. |
| `POST /v1/sessions/:name/submit` | hub | `{ "text": "…" }`; bracketed paste followed by Enter. |
| `POST /v1/sessions/:name/keys` | hub | `{ "keys": "…" }`; raw tmux keys, never an implicit Enter. |
| `GET /v1/sessions/:name/transcript?offset=N` | hub | Newly copied transcript bytes and next byte offset. A Claude session with no Stop payload yet is found by session id under `$CLAUDE_CONFIG_DIR` (else `~/.claude`) at `projects/*/<id>.jsonl`. |
| `GET /v1/status`, `POST /v1/preflight` | hub | Version/CLI/liveness and Codex preflight. `version` is the commit read when this service process started. |
| `POST /v1/agent/cards` | agent | Assign a durable delivery id, relay a previously validated card synchronously, and return the hub's 2xx or 4xx response. Only no answer or 502/503/504 yields `202 {ok:true,spooled:true}`. |
| `POST /v1/agent/hooks` | hook | Turn-end or permission-prompt event. A relayed permission prompt is followed by a `prompt-cleared` event once the pane shows the input screen again. |
| `POST /v1/agent/git` | agent | `{operation,args,paths,message}` in that agent's worktree only. `commit` requires `paths`. `worktree-remove` (sub-lead only): `args[0]` names a stopped or not-running worker of the same thread whose branch is fully merged into the caller's `HEAD`; runs `git worktree remove` without `--force`; otherwise `400`. |
| `POST /v1/agent/session` | agent | Forward a session start/stop/list request (including `attempt_id`) to the hub; retries for 90 seconds. |

Every queued card and event has a `delivery_id`, the UUID in its spool filename. The service sends
queued cards and events in order, retrying every 5 seconds while either spool is non-empty, to
`POST {hub_url}/api/machine/cards` and `/api/machine/events`, and forwards agent session requests
to `POST {hub_url}/api/machine/session`. At most one drain per kind runs at a time. A successful
2xx acknowledgement removes a spool item; a hub 4xx moves it to `spool/rejected/<kind>/`, logs the
reason, and continues with later items. Draining an event first runs the normal hook handler, so an
offline hook event is rebound to its managed session, transcript, prompt state, and `thread_id`.

`machine.json` is `{ "hub_url", "secret_file", "host", "port" }` under the configured
state directory. It defaults to `~/.local/state/wheelchair/`, the machine's Tailscale IPv4,
and port 7374. Tests and the unit may override host, port and state directory on the command line.
