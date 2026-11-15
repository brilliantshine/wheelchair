# Machine service API

The hub calls every `/v1/*` route with `X-Wheelchair-Machine-Secret`, whose value is the
contents of `machine.json`'s `secret_file`. Agents call only `/v1/agent/*`, with
`X-Wheelchair-Session-Token`; a token is valid only for a session the service started.
The secret is never inherited by a tmux session.

| Route | Caller | Meaning |
|---|---|---|
| `POST /v1/sessions` | hub | Start a session. Body contains `role`, `cli`, `thread_id`, `token`, and either `worktree` or a project/worktree description. Optional `model`, `brief`, `attempt_id`, and `name` are retained. Optional `account: {id, dir}` selects a login folder; omitted means the default account, with `dir: null`. Non-default directories must be `~/.wheelchair/accounts/<id>` and are seeded on first use. Session records and responses include the account id. Four more optional fields are checked before anything is created, and a bad value is `400`: `permission_mode` (`auto`, the default, or `bypass`; Claude gets `--permission-mode auto` or `--permission-mode bypassPermissions`, Codex ignores it, and the session records it so readiness knows which status line to wait for; a bypass session's settings file sets `skipDangerousModePermissionPrompt`, and a "Bypass Permissions mode" confirmation that still appears is answered Down then Enter), `codex_mode` (`sandboxed`, the default, or `unrestricted`; Codex only, ignored for Claude: sandboxed starts `codex -s workspace-write -a never -c sandbox_workspace_write.network_access=true`, unrestricted starts `codex --dangerously-bypass-approvals-and-sandbox`, and a reviewer gets `-s read-only -a never` under either), `effort` (`low`, `medium`, `high`, `xhigh` or `max`; Claude only, as `--effort <value>`, ignored for Codex), and `role_layers` (text). The starting instructions are composed in one place for both CLIs (Claude's `--append-system-prompt`, Codex's first `[wc:role]` message): the pointer `Read <this clone's root>/protocol/app/<role>.md before responding. It is wheelchair's built-in rules for your role.`, then, when `role_layers` is non-empty, a blank line and `role_layers`. A `role_prompt` replaces all of it and `role_layers` is then ignored. New worktrees discover `origin`'s default branch after fetch (with `remote show` then `main` fallbacks), and return it as `default_branch`. A replacement worker carrying both `worktree` and `branch` starts there only when that directory exists and is already on that branch. |
| `GET /v1/sessions` | hub | Managed sessions (`managed: true`) and live tmux status, plus every other tmux session as read-only `{ name, managed: false, running: true }`. A live `wc-*` session missing from `sessions.json` is re-adopted at start with `recovered: true` and no token. |
| `POST /v1/archive` | hub | `{ "thread_id": "…" }`; stop the thread's sessions, locally commit or retain its service-created worktrees as appropriate, remove clean worktrees, and forget its sessions. A session whose worktree is retained stays as a non-running `archived_pending` record so a later archive can remove it after the problem is resolved. Returns `200 { "stopped": [names], "committed": [{ "worktree", "commit" }], "removed": [paths], "kept": [{ "worktree", "reason" }] }`. |
| `DELETE /v1/sessions/:name` | hub | Stop a managed session. |
| `GET /v1/sessions/:name/pane` | hub | Current pane text. |
| `POST /v1/sessions/:name/submit` | hub | `{ "text": "…" }`; bracketed paste followed by Enter. |
| `POST /v1/sessions/:name/keys` | hub | `{ "keys": "…" }`; raw tmux keys, never an implicit Enter. |
| `GET /v1/sessions/:name/transcript?offset=N` | hub | Newly copied transcript bytes and next byte offset. A Claude session with no Stop payload yet is found by session id under `$CLAUDE_CONFIG_DIR` (else `~/.claude`) at `projects/*/<id>.jsonl`. |
| `POST /v1/preview` | hub | `{ "prompt", "model" }`; runs `claude -p --model <model> --permission-mode dontAsk` with `WHEELCHAIR_LANE=1`, the prompt on stdin, asynchronously, with a 60 s timeout. `200 { "text": <stdout, trimmed> }`. Errors use the service's usual `{ "error" }` body: `400` missing or invalid `model`/`prompt`; `503 claude is not installed`; `504 preview timed out after 60 s`; `502` with the last non-empty stderr line, or `claude exited <code>`. |
| `GET /v1/status`, `POST /v1/preflight` | hub | Status includes version, CLI/liveness and `accounts: [{id, cli, logged_in}]` for both defaults and seeded folders. Preflight accepts optional `{dir}` and runs with that account as `CODEX_HOME`; empty body uses the usual login. `version` is the commit read when this service process started. |
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

Claude's settings run `machine/statusline.sh claude <session>` to display the model and five-hour usage and forward status payloads at most once a minute, with the same local spool fallback as hooks. `StopFailure` forwards `limit-hit` with `error` and `limited_until`, or `turn-failed` with `error`. Usage events carry `reading: {account, at, five_hour, week, plan_type?, limited_until?}`; each window is null or `{used, resets_at}`. Codex readings come from appended rollout lines on turn end. Reset times and `at` are ISO strings.
