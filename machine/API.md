# Machine service API

The hub calls every `/v1/*` route with `X-Wheelchair-Machine-Secret`, whose value is the
contents of `machine.json`'s `secret_file`. Agents call only `/v1/agent/*`, with
`X-Wheelchair-Session-Token`; a token is valid only for a session the service started.
The secret is never inherited by a tmux session.

| Route | Caller | Meaning |
|---|---|---|
| `POST /v1/sessions` | hub | Start a session. Body contains `role`, `cli`, `thread_id`, `token`, and either `worktree` or a project/worktree description. Optional `model`, `brief`, `attempt_id`, and `name` are retained. Optional `account: {id, dir}` selects a login folder; omitted means the default account, with `dir: null`. Non-default directories must be `~/.wheelchair/accounts/<id>` and are seeded on first use. Session records and responses include the account id. Four more optional fields are checked before anything is created, and a bad value is `400`: `permission_mode` (`auto`, the default, or `bypass`; Claude gets `--permission-mode auto` or `--permission-mode bypassPermissions`, Codex ignores it, Antigravity gets `--mode auto` or `--dangerously-skip-permissions`, and the session records it so readiness knows which status line to wait for; a bypass session's settings file sets `skipDangerousModePermissionPrompt`, and a "Bypass Permissions mode" confirmation that still appears is answered Down then Enter), `codex_mode` (`sandboxed`, the default, or `unrestricted`; Codex only, ignored for Claude and Antigravity: sandboxed starts `codex -s workspace-write -a never -c sandbox_workspace_write.network_access=true`, unrestricted starts `codex --dangerously-bypass-approvals-and-sandbox`, and a reviewer gets `-s read-only -a never` under either), `effort` (`low`, `medium`, `high`, `xhigh` or `max`; Claude and Antigravity get `--effort <value>` and Codex gets `-c model_reasoning_effort=<value>`; GPT values are `low`, `medium`, `high`, `xhigh` and are validated by the hub), and `role_layers` (text). The starting instructions are composed once and written to `<stateDir>/prompts/<name>.md` before worktree creation; prompt files are retained. The file begins with `Role: <role>`, then the applicable header, inlined role and card files, and trimmed `role_layers`. A `role_prompt` replaces everything after the Role line and ignores layers. Claude receives the file via `--append-system-prompt-file` and a `--disallowedTools` list: Artifact, Workflow, ScheduleWakeup, SendFeedback, ShareOnboardingGuide, ReportFindings, ListAgents, ArtifactComments, ArtifactData, CronCreate, CronDelete, CronList, RemoteTrigger, PushNotification, PublishPlugin, DesignSync, EnterWorktree, ExitWorktree, EnterPlanMode, ExitPlanMode, AskUserQuestion, EndConversation. Codex and Antigravity receive a first `[wc:role]` message pointing to the prompt file. After each successful start, a best-effort append to `<stateDir>/session-ledger.jsonl` records `at`, `name`, `role`, `provider`, `model`, `account_dir`, `cli_session_id`, and `thread_id`; the ledger is append-only and read in the background for the startup-size warning (last 512 KB only). New worktrees discover `origin`'s default branch after fetch (with `remote show` then `main` fallbacks), and return it as `default_branch`. A replacement worker carrying both `worktree` and `branch` starts there only when that directory exists and is already on that branch, and no other worker is still in tmux there or starting there (`409`; a tmux failure counts as in use). That last check applies to any worker start that names a `worktree`, with or without `branch`. |
| `GET /v1/sessions` | hub | Managed sessions (`managed: true`) include `codex_thread_id` (null when unknown), `agy_conversation_id` when known, and `running` (whether its tmux session exists), plus every other tmux session as read-only `{ name, managed: false, running: true }`. A live `wc-*` session missing from `sessions.json` is re-adopted at start with `recovered: true` and no token. When tmux cannot be asked (a failure other than "no server running"), managed sessions carry no `running` field and no unmanaged sessions are listed: unknown, not ended. |
| `POST /v1/uploads?thread_id=<id>&name=<filename>` | hub | Streams a raw file up to 25 MiB into the writable lead thread’s uploads directory; returns `201 {path}`. Refuses a closed or unwritable thread with 409, and an oversized file with 413. `&vouched=1` (always sent by the hub, which has already checked the thread is open with a live lead) admits the thread even with no lead session here yet, as when its lead is waiting for room or starting. A thread whose archive this service finished (uploads removed) is refused either way; one whose archive was cut short by a rebase or a failed removal is not. |
| `GET /v1/uploads/<thread-id>/<file>` | hub | Streams a stored file, with image MIME types for PNG, JPEG, GIF and WebP; other files are octet-stream attachments. Sends `X-Content-Type-Options: nosniff`. |
| `POST /v1/archive` | hub | `{ "thread_id": "…" }`; stop the thread's sessions, locally commit or retain its service-created worktrees as appropriate, remove clean worktrees, and forget its sessions. A session whose worktree is retained stays as a non-running `archived_pending` record so a later archive can remove it after the problem is resolved. Returns `200 { "stopped": [names], "committed": [{ "worktree", "commit" }], "removed": [paths], "kept": [{ "worktree", "reason" }], "uploads_removed": true|false|null, "uploads_error"?: "…" }`. Uploads are removed unless a rebase is in progress (null); false and the error indicate removal failed. If a fatal stop is still unconfirmed, the response has `pending: true` and `pending_sessions: [names]` and omits `uploads_removed`; uploads, session records and worktrees remain for an archive retry. |
| `POST /v1/handoff` | hub | Handoff git, ownership and session operations; see [Handoff actions](#handoff-actions). |
| `DELETE /v1/sessions/:name` | hub | Stop a managed session. A confirmed fatal stop replies `200 { ok: true, end_reason }`. |
| `GET /v1/sessions/:name/pane` | hub | Current pane text, with its color escape codes. `?history=<n>` (0–2000) adds the last n lines of scrollback (`capture-pane -S -<n>`); anything else is 400. |
| `POST /v1/sessions/:name/submit` | hub | `{ "text": "…" }`; bracketed paste followed by Enter. |
| `POST /v1/sessions/:name/keys` | hub | `{ "keys": "…" }`; raw tmux keys, never an implicit Enter. |
| `GET /v1/sessions/:name/transcript?offset=N` | hub | Newly copied transcript bytes and next byte offset. A Claude session with no Stop payload yet is found by session id under `$CLAUDE_CONFIG_DIR` (else `~/.claude`) at `projects/*/<id>.jsonl`. |
| `POST /v1/aside-turns` | hub | Accept `{turn_id, provider, account_dir, cwd, model, effort?, mode, from, new_id?, prompt, style?, access?}`; returns `202 {turn_id,state}` or `200` for an existing id. Runs a CLI turn with a 15-minute timeout: read-only by default; `access: "full"` runs Claude with `bypassPermissions` and Codex with `--dangerously-bypass-approvals-and-sandbox`. |
| `GET /v1/aside-turns/:turn_id` | hub | Return `{state,reply,conversation_id,error,limit}`; unknown ids return 404. |
| `DELETE /v1/aside-turns/:turn_id` | hub | Kill a running turn and mark it failed; finished turns are unchanged; an unknown id is recorded as stopped, so a later POST with that id starts nothing. |
| `POST /v1/aside-turns/:turn_id/ack` | hub | Forget a turn after its result is saved; unknown ids return 404. Records survive restart, and running turns are killed and marked failed on recovery. |
| `POST /v1/preview` | hub | `{ "prompt", "model" }`; runs `claude -p --model <model> --permission-mode dontAsk` with `WHEELCHAIR_LANE=1`, the prompt on stdin, asynchronously, with a 60 s timeout. `200 { "text": <stdout, trimmed> }`. Errors use the service's usual `{ "error" }` body: `400` missing or invalid `model`/`prompt`; `503 claude is not installed`; `504 preview timed out after 60 s`; `502` with the last non-empty stderr line, or `claude exited <code>`. |
| `GET /v1/projects?folder=<path>&check=<path>` | hub | Read-only folder listing and path check; at least one param, else `400`. A path is `~`, `~/…` (expanded against the service's home directory) or absolute; `~user` is not expanded. `folder`: `400` unless absolute after expansion; `found` is `[{name,path}]` sorted by name, the immediate subdirectories (symlinks to directories followed) not starting with `.`, matching `^[A-Za-z0-9._-]+$` without `..`, that contain a `.git` entry (directory or file). A folder that is missing or not a directory gives `found: []` and `folder_error` (`does not exist` / `is not a directory`). `check`: `checked: {path, ok, reason?}` with `path` expanded; `reason` is one of `does not exist`, `is not a directory`, `is not a git repository`, `must be an absolute path`, `has characters a thread can't use in its name` (last segment fails the name rule above). Keys appear only for what was asked. |
| `GET /v1/diagram-sensitivity` | hub | Runs the local sensitivity writer's read-only report; returns `200 {level, files: [{harness, level}], text}`. The agreed level is null when none is installed or the files disagree; each present harness has a level or null. A report failure returns `422 {error}`. |
| `POST /v1/diagram-sensitivity` | hub | `{level}` accepts `ask`, `default`, or `high`; asynchronously runs the local writer with a 30-second timeout and returns `200 {level, text}`. Invalid levels return 400, writer failures return `422 {error}` with the last non-empty stderr line, and another concurrent update returns 409. |
| `GET /v1/status`, `POST /v1/preflight` | hub | Status includes version, CLI/liveness (including the `agy` and `kimi` keys) and `accounts: [{id, cli, logged_in, problem?}]` for both defaults and seeded folders. Preflight accepts optional `{dir}` and runs with that account as `CODEX_HOME`; empty body uses the usual login. `version` is the commit read when this service process started. |
| `POST /v1/sudo/:request_id/cancel` | hub | Return a saved terminal sudo result, or cancel through the helper and persist its terminal answer first. Unknown requests return 404; an unreachable helper returns 503. |
| `POST /v1/agent/cards` | agent | Lead approval cards may gain a machine-generated `warnings` array. For sudo cards, only a lead may post: register command, does and why with the local intake socket before spooling, and add the returned request_id, url and editable fields. A helper refusal is passed through; an unreachable helper returns 503. For image cards, validate and copy the image into the thread uploads directory and rewrite its path before spooling; invalid images return 422 and archived sessions return 409. Assign a durable delivery id, relay a previously validated card synchronously, and return the hub's 2xx or 4xx response. Only no answer or 502/503/504 yields `202 {ok:true,spooled:true}`. |
| `POST /v1/agent/hooks` | hook | Turn-end or permission-prompt event. A relayed permission prompt is followed by a `prompt-cleared` event once the pane shows the input screen again. |
| `POST /v1/agent/git` | agent | `{operation,args,paths,message}` in that agent's worktree only. `commit` requires `paths`. `worktree-remove` (sub-lead only): `args[0]` names a stopped or not-running worker of the same thread whose branch is fully merged into the caller's `HEAD`; runs `git worktree remove` without `--force`; otherwise `400`. |
| `POST /v1/agent/session` | agent | Forward a session start/stop/list request (including `attempt_id`) to the hub; retries for 90 seconds. |

### Handoff actions

All requests carry `action` and `thread_id` (12 lowercase hex characters). Git actions also
carry `project`, an absolute repository path accepted by `GET /v1/projects?check=`. Branches
match `wc/<12 lowercase hex characters>`, SHAs have 40 lowercase hex characters, slugs match
`^[a-z0-9][a-z0-9-]*$`, and a supplied `worktree` must be an absolute path of a worktree the
machine created for that thread. For `inspect` and `known`, the thread checkout path under
`<stateDir>/worktrees/<project-name>/wc/<thread_id>` is also accepted after its session or
folder is gone. A `status` pull request URL must match `https://github.com/<owner>/<repo>/pull/<number>`.
Invalid input returns `422 {result: "failed", error}`; all
action outcomes, including refusals and git failures, return HTTP 200. An action-level failure
is `{result: "failed", error}`. Requests take the archive's per-thread lock before the
per-repository queue.

The following request fields are in addition to `action`, `thread_id`, and, for git actions,
`project`. A `?` marks an optional field.

| Action | Request fields | Success or action-specific response |
|---|---|---|
| `status` | `worktree, slug, pr_url?` | `{dirty, branch, head, remote_has_branch, remote_tip, idea_status, plan_status, map_committed, repository, pr_state, pr_error?}` |
| `push` | `worktree, branch, sha` | `{head, repository}`; failure includes git's last error line. |
| `inspect` | `branch, head, worktree?, slug, fallback_head?` | `{repository, remote_has_branch, remote_tip, remote_contains_head, picked_up_at, local_head, worktree_exists, relation, idea_status, plan_status, map_committed}`; `relation` is `same`, `behind`, `ahead`, `diverged`, or null. |
| `claim-commit` | `parent, message` | `{sha}` |
| `claim-state` | `branch, parent, sha` | `{result: "landed"\|"parent"\|"moved"\|"unknown", remote_tip?, picked_up_at?, error?}` |
| `claim-push` | `branch, parent, sha` | `{result: "landed"\|"moved"\|"unknown", remote_tip?, picked_up_at?, error?}`; `unknown` may include git's last error line. |
| `claim-revoke` | `branch, parent, sha` | `{result: "revoked"\|"waiting"\|"gone"\|"failed", error?}` |
| `reopen` | none | `{ok: true}` |
| `fast-forward` | `worktree, branch, head` | `{result: "ok"\|"failed", error?}` |
| `set-branch` | `branch, sha` | `{result: "ok"\|"failed", error?}` |
| `running` | none | `{names: [...]}` |
| `kill` | `names: [...]` | `{names: [...]}` of names still starting or running; every requested name must start with `wc-<thread_id>-`. |
| `known` | `head` | `{known, local_branch, local_ancestor, checked_out}`; `checked_out` is an array of all absolute checkout paths, empty when none; `local_ancestor` is null when the local branch is absent. |

`status` and `inspect` report `remote_has_branch: false` and `remote_tip: null` when the
remote branch is absent. `repository` is the normalized GitHub origin or null. Statuses and
`map_committed` reflect committed plan files, at HEAD for `status` and at the supplied `head`
for `inspect`. A failed `gh` lookup returns `pr_state: null` and `pr_error`. `fallback_head`
is the hub's handed-off head. Claim results other than `unknown` include the observed
`remote_tip`; the revoke push uses an exact lease on the claim. `known` includes sessions,
worktrees, and durable archiving or archived markers. `reopen` clears both markers.

Every queued card and event has a `delivery_id`, the UUID in its spool filename. The service sends
queued cards and events in order, retrying every 5 seconds while either spool is non-empty, to
`POST {hub_url}/api/machine/cards` and `/api/machine/events`, and forwards agent session requests
to `POST {hub_url}/api/machine/session`. At most one drain per kind runs at a time. A successful
2xx acknowledgement removes a spool item; a hub 4xx moves it to `spool/rejected/<kind>/`, logs the
reason, and continues with later items. Preparing an offline hook event runs the normal hook handler,
rebinding it to its managed session, transcript, prompt state, and `thread_id`.
Spooled events are enriched once and rewritten before the first delivery, so retries send the identical body.

`machine.json` is `{ "hub_url", "secret_file", "host", "port" }` under the configured
state directory. It defaults to `~/.local/state/wheelchair/`, the machine's Tailscale IPv4,
and port 7374. Tests and the unit may override host, port and state directory on the command line.

Antigravity sessions use a per-session `--settings` file with `trustedWorkspaces`. The adapter merges a `wheelchair` Stop hook into `~/.gemini/config/hooks.json`, calling `machine/hook.sh agy`; the hook takes the session name from its second argument or `WHEELCHAIR_SESSION_NAME`, which the service sets for the session. Ready Antigravity panes are watched for permission prompts.

`POST /v1/usage` requires hub authorization and body `{account, cli, dir}`. The CLI is `claude` or `codex`; the directory follows the login account rules, including null for the matching default account. It returns `200 {reading}` in the usage event shape below, `400 {error}` for invalid input, or `502 {error}` if the 30-second probe times out, exits unsuccessfully, or produces an invalid response. The service does not read credentials. Claude's model endpoint is isolated to a closed local port, and Codex receives only initialization and a rate-limit read, so the probe sends no model message.

Claude's settings run `machine/statusline.sh claude <session>` to display the model and five-hour usage and forward status payloads at most once a minute, with the same local spool fallback as hooks. `StopFailure` forwards `limit-hit` with `error` and `limited_until`, or `turn-failed` with `error`. Usage events carry `reading: {account, at, five_hour, week, plan_type?, limited_until?}`; each window is null or `{used, resets_at}`. Codex readings come from appended rollout lines and travel in the `reading` field of the `turn-ended` event. Reset times and `at` are ISO strings.

### Login sessions

All routes require the hub secret. `POST /v1/logins` accepts `{account, cli, dir}` and returns `201 {state: "starting"}`. The directory must match the account folder contract, or be null for the matching default account. It seeds the folder and replaces any existing `wc-login-<account>` tmux session.

`GET /v1/logins/:account` returns `{state, url, code, wantsCode, logged_in}`. State is `starting`, `waiting`, `done`, or `failed`; a login unknown to the service and absent from tmux returns 404. `POST /v1/logins/:account/code` accepts `{code}` and submits it. `GET /v1/logins/:account/pane` returns `{text}` (with color escape codes) and `POST /v1/logins/:account/keys` accepts `{keys}`. Antigravity login presents a link and asks for the pasted authorization code; when its welcome or ready prompt appears, the service ends the otherwise persistent login session. Login sessions are excluded from session listing, recovery, and archive.

The machine persists sudo requests in `sudo-requests.json` (atomic writes, mode 0600). It saves hub card acceptance before removing the card spool, polls non-terminal helper requests, and posts running and terminal outcomes to `/api/machine/sudo-outcome` only after acceptance. Outcomes retry with a stable delivery id; a saved terminal result is never replaced, and is removed after hub acknowledgement. Restart reloads this file. The intake socket defaults to `/run/wheelchair-sudo/intake.sock` and can be overridden by `WHEELCHAIR_SUDO_INTAKE`.

Claude tool hooks send `step` events with `phase` (`start` or `end`) and a `step` object containing the call ID and compact classification or completion fields. Statusline context events carry `context: {percent, at}`; context is throttled independently to 15 seconds, while rate limits retain their 60-second throttle. Each event travels through the existing event spool with its own delivery ID.

Codex steps and context are read from each bound live session’s rollout every two seconds, with the reader offset and open state persisted in `sessions.json`. Complete lines are emitted through the same spool; a turn-end notification flushes through the file size measured at the start of the flush. For a live notification, steps are delivered before `turn-ended`; when replaying a spooled notification, steps may be delivered on the next drain after `turn-ended`. Polls continue a yielded step and a new operation closes it uncleanly. The separate turn-end usage scan is unchanged.

Kimi Code uses an absolute resolved executable and an explicit `KIMI_CODE_HOME` for login and launches. Status reads the home config and reports eligibility without exposing internal authentication state. An asynchronous version check runs at startup and when the executable path or mtime changes, with a five-second timeout; status reports a checking problem until it finishes, and an unsupported or unreadable version appears as a per-CLI problem. A Kimi launch waits for the check. Sign-in uses the global region and keeps its exit result for the attempt. Launch maps permission mode to `--yolo` or `--auto`; Kimi has no effort setting, so no effort is passed (a Kimi account login ignores `KIMI_MODEL_THINKING_EFFORT`).

Kimi Code turn ends are read from the bound main wire log. Lifecycle events carry a
numeric `turn_id`; a cancelled `turn-ended` also carries `interrupted: true`. Failed
turns use `turn-failed` or `limit-hit` with `error`. Agent hook events from Kimi
sessions are ignored; permission prompts are detected from the pane.

Session listings may include `end_reason` when the service can no longer safely follow
a session. Input is refused with that reason. A DELETE for such a session returns
`202 { pending: true, end_reason }` while the tmux session's absence is unconfirmed;
repeat the request or inspect the listing for the stopped state. Archive likewise keeps
its session and worktree until the stop is confirmed.
