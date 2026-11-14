# Machine service API

The hub calls every `/v1/*` route with `X-Wheelchair-Machine-Secret`, whose value is the
contents of `machine.json`'s `secret_file`. Agents call only `/v1/agent/*`, with
`X-Wheelchair-Session-Token`; a token is valid only for a session the service started.
The secret is never inherited by a tmux session.

| Route | Caller | Meaning |
|---|---|---|
| `POST /v1/sessions` | hub | Start a session. Body contains `role`, `cli`, `thread_id`, `token`, and either `worktree` or a project/worktree description. Optional `model`, `brief`, `attempt_id`, and `name` are retained. |
| `GET /v1/sessions` | hub | Sessions and live tmux status. |
| `DELETE /v1/sessions/:name` | hub | Stop a managed session. |
| `GET /v1/sessions/:name/pane` | hub | Current pane text. |
| `POST /v1/sessions/:name/submit` | hub | `{ "text": "…" }`; bracketed paste followed by Enter. |
| `POST /v1/sessions/:name/keys` | hub | `{ "keys": "…" }`; raw tmux keys, never an implicit Enter. |
| `GET /v1/sessions/:name/transcript?offset=N` | hub | Newly copied transcript bytes and next byte offset. |
| `GET /v1/status`, `POST /v1/preflight` | hub | Version/CLI/liveness and Codex preflight. |
| `POST /v1/agent/cards` | agent | Persist then relay a previously validated card. |
| `POST /v1/agent/hooks` | hook | Turn-end or permission-prompt event. |
| `POST /v1/agent/git` | agent | `{operation,args,paths,message}` in that agent's worktree only. `commit` requires `paths`. |
| `POST /v1/agent/session` | agent | Forward a session start/stop/list request (including `attempt_id`) to the hub; retries for 90 seconds. |

The service sends queued cards and events in order to `POST {hub_url}/api/machine/cards`
and `/api/machine/events`, and forwards agent session requests to
`POST {hub_url}/api/machine/session`. A successful 2xx acknowledgement removes a spool item.

`machine.json` is `{ "hub_url", "secret_file", "host", "port" }` under the configured
state directory. It defaults to `~/.local/state/wheelchair/`, the machine's Tailscale IPv4,
and port 7374. Tests and the unit may override host, port and state directory on the command line.
