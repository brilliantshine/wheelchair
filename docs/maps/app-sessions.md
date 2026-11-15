# Map: how the app starts an agent session (tier, model, permissions, login, role prompt, transcript, turn end)

Checked against: `6a9811502bbd5d350fb22715f3158ad076999701` (origin/main)
Files covered: `viewer/app/sessions.js`, `viewer/app/settings.js`, `viewer/app/threads.js`
(createThread), `viewer/app/wc.js` (session start), `viewer/app/ready.js`,
`viewer/app/routes.js`, `viewer/app/state.js`, `viewer/app/chat.js` (per-CLI parts only),
`machine/service.js`, `machine/hook.sh`, `machine/lib/hook-post.js`, `codex/model.sh`,
`codex/preflight.sh`, `seen/hook.sh` (lane skip only)

Earlier version was checked against `5742e2f`; the Settings feature merged since
(`docs/plans/app-settings/`) and changed the model choice, the command line and the
readiness test. Every pointer below was re-read at the commit above.

## Flow

1. **Someone asks for a session.** A new thread starts its lead with
   `{role:'lead', cli: thread.cli, brief:'', tier:'top'}` (`viewer/app/threads.js:58`; the same call at `:97` and `:122`). The
   thread's CLI was chosen by the person and must be `claude` or `codex`
   (`threads.js:46`). Any other session is an agent running
   `wc.js session start --role --cli --brief-file --attempt [--tier]` (`wc.js:70-92`); the
   tier defaults to `top`. The machine service forwards it to the hub
   (`service.js:677-696`) and `sessionRequest` checks who may start what
   (`sessions.js:310-348`; table `sessions.js:50-53`). **The calling agent picks the CLI**
   (`--cli`, `sessions.js:330`); the hub does not choose or check it beyond
   `claude|codex` (`sessions.js:17`).
2. **The hub resolves the model.** `startSession` (`sessions.js:71-161`) runs the Codex
   preflight first for a Codex session (`:75-86`), then `resolveModel(hub, cli, role, tier)`
   (`sessions.js:16-39`):
   - slot: lead and sub-lead → `lead`; reviewer, verifier, mapper → the tier in
     `settings.other_agents[role]`; worker → the requested tier (`top` → `heavy`;
     Claude's `haiku|sonnet|opus` and Codex's `luna|terra|sol|astra` are accepted as
     aliases, `sessions.js:23-27`, `settings.js:12-13`).
   - provider is `claude` for the claude CLI and `gpt` for codex (`sessions.js:29`).
   - model = `codex/model.sh <provider> <slot>` (`sessions.js:31`); Claude also gets an
     effort from `model.sh effort claude <slot>` (`:33`). A cell set to Not used makes
     `model.sh` exit 3 and the start fails 400 "not used at <slot>; use the other CLI"
     (`sessions.js:36`, `model.sh:313-317`).
   - **The tier table is not in the settings file.** It is the pins file
     `~/.wheelchair/models` on the **hub's machine**, read and written only by
     `codex/model.sh` (`model.sh:41`, `117-118`, `293-301`); defaults at `model.sh:17-28`.
     Settings' `PUT /settings/models` shells out to `model.sh set`
     (`routes.js:51-61`). The Astra problem the old map recorded is gone: Critical works.
3. **The hub builds the layers** (`settingsStore.roleLayers`, `sessions.js:89`) and sends the
   machine service `POST /v1/sessions` with role, cli, token, model, effort,
   `permission_mode`, `codex_mode`, `role_layers`, worktree, brief and git refs
   (`sessions.js:115-136`). **The hub sends no account, login folder or environment.**
4. **The service builds the command line** in `commandFor` (`service.js:266-290`), with
   the starting instructions from `composeRolePrompt` (`service.js:57-63`):
   - Claude: `claude --session-id <uuid> --settings <stateDir>/settings/<name>.json
     --permission-mode auto|bypassPermissions [--model M] [--effort E]
     --append-system-prompt <prompt>` (`:277`). The per-session settings file holds
     `cleanupPeriodDays`, `promptSuggestionEnabled:false`, optional
     `skipDangerousModePermissionPrompt`, and the `Stop` and `Notification` hooks that call
     `machine/hook.sh claude <name>` (`:270-276`, written at `:306`).
   - Codex: `codex <access flags> -c notify=[hook.sh,"codex",<name>] -c
     projects={<worktree>={trust_level="trusted"}} [-m M]` (`:279-287`). Access flags: a
     reviewer is always `-s read-only -a never`; `codex_mode` `unrestricted` →
     `--dangerously-bypass-approvals-and-sandbox`; else `-s workspace-write -a never -c
     sandbox_workspace_write.network_access=true`. The prompt goes as the first message
     `[wc:role] <prompt>\n\n<brief>` (`:311-315`).
   - Anything else → `die('cli must be claude or codex')` (`:289`).
5. **tmux runs it**: `env WHEELCHAIR_LANE=1 WHEELCHAIR_SESSION_TOKEN=…
   WHEELCHAIR_STATE_DIR=… WHEELCHAIR_MACHINE_ORIGIN=… <argv>` via
   `tmux new-session -d -s <name> -x 200 -y 50 -c <worktree>`, under
   `systemd-run --user --scope` when that works (`service.js:307`, `316-320`). That `env`
   prefix is the **only** place a per-session environment could be added.
6. **Readiness.** `readyText` (`service.js:326-330`): Claude is ready when the pane has no
   trust or bypass-accept prompt, shows `auto mode on` (or `bypass permissions on` for a
   bypass session) and a `❯` line; Codex when it shows `Ask Codex to do anything`. The
   service answers the folder-trust prompt (and the bypass warning) with Down + Enter
   (`:340-353`). When ready it types the pending first message (`:358-363`) and emits a
   `ready` event. No ready screen after 30 s → `stuck` (`:367-371`). Pane scraping is the
   only readiness signal for both CLIs.
7. **Turn end.** Claude's `Stop` hook and Codex's `notify` call `machine/hook.sh`, which
   needs `WHEELCHAIR_SESSION_TOKEN` (exits quietly without it, `hook.sh:12-14`) and pipes the
   payload to `machine/lib/hook-post.js`. Claude: a `Stop` event becomes
   `{type:'turn-ended', transcript_path}`; a `Notification` with `permission_prompt` becomes
   `prompt` (`hook-post.js:16-19`). Codex: a payload of type `agent-turn-complete` becomes
   `turn-ended` (`:21-23`). The event is POSTed to the service's `/v1/agent/hooks`, or
   spooled to `<state>/spool/events/` when the service is down (`:26-37`). The service's
   `hook()` (`service.js:604-621`) binds the transcript (below) and forwards to the hub,
   which sets `turn_ended = true` and releases the queue (`sessions.js:271-272`,
   `189-195`, `218`).
8. **Transcripts.** Claude: the hook payload carries `transcript_path`, used directly
   (`service.js:606`); before any Stop it is found by session id under
   `$CLAUDE_CONFIG_DIR|~/.claude` + `/projects/*/<id>.jsonl` (`:538-541`, `622-629`).
   Codex: bound on the first turn-end whose first input starts `[wc:role]`, by thread id,
   under `$CODEX_HOME|~/.codex` + `/sessions/**/*-<thread>.jsonl` (`:607-612`, `630-638`).
   `copyTranscript` appends new lines to the service's own copy
   `<stateDir>/transcripts/<thread>/<name>.jsonl` (`:502-526`); the hub reads it through
   `GET /v1/sessions/:name/transcript` and parses it per CLI (`viewer/app/chat.js:90-218`).
   **Both lookups read the service's own process environment**, not the session's.

```
new thread (lead, cli chosen)      agent: wc.js session start --cli X --tier T
        \                                |
         \                         hub sessionRequest (who may start what; cli = caller's pick)
          +-------> startSession: codex? preflight -> resolveModel(cli, role, tier)
                        |   slot -> provider (claude|gpt) -> codex/model.sh  (pins file, hub machine)
                   POST machine /v1/sessions {cli, model, effort, modes, role_layers}   (no account)
                        |
                   commandFor: claude ... --settings <hooks> | codex ... -c notify=<hook>
                        |
                   tmux new-session: env WHEELCHAIR_* <argv>  -> pane scraped until ready
                        |
        Stop / notify -> hook.sh -> hook-post.js -> service /v1/agent/hooks -> hub turn_ended
                        |
        transcript found under $CLAUDE_CONFIG_DIR | $CODEX_HOME (service's env) -> copy -> hub /chat
```

## Logins: one account per CLI per machine

- Nothing chooses a login. The `env` prefix sets only the four `WHEELCHAIR_*` variables
  (`service.js:307`); each CLI uses whatever config directory the service's own user
  environment gives it. The service unit sets only `PATH` (`install.sh:332-336`).
- `CLAUDE_CONFIG_DIR` and `CODEX_HOME` are read in exactly two places in the service
  (`service.js:623`, `631`), plus `codex/preflight.sh:26` and `codex/model.sh:43` (the
  models cache). No other code names them (grep).
- Login status: Claude's is `claude auth status` → JSON `loggedIn` (`service.js:709-712`).
  Codex's is `codex/preflight.sh` (the service's `/v1/preflight`, `:746`), which reads
  `$CODEX_HOME/auth.json`, refreshes the OAuth token under a `flock` when under 24 h of life
  remains, and exits 2 when the refresh token is rejected (`preflight.sh:26-30`, `65-67`,
  `87-90`). Run from the service, it sees the service's `CODEX_HOME` only. It then runs
  `model.sh check` (`:123`).
- `GET /v1/status` returns per CLI only `{installed, logged_in, version}`
  (`service.js:697-714`).

## Permission mode

- Settings now holds `permission_mode` (`auto|bypass`) and `codex_mode`
  (`sandboxed|unrestricted`) (`settings.js:23`, `154-155`); the hub sends them on every
  start (`sessions.js:130-131`). Readiness already follows the mode (`service.js:328`).

## Where a role's instructions come from

- `composeRolePrompt`: the pointer `Read <root>/protocol/app/<role>.md before responding. It
  is wheelchair's built-in rules for your role.` plus the hub's `role_layers` (template, and
  for a lead the writing style) (`service.js:57-63`, `settings.js:121-134`). `role_prompt`
  still replaces both (`service.js:57`).
- The wording list does not reach app sessions: `WHEELCHAIR_LANE=1` (`service.js:307`) and
  `seen/hook.sh` returns at once when it is set (`seen/hook.sh:166-167`).

## Other things that call a CLI

- The style preview: the service runs `claude -p --model M --permission-mode dontAsk` with
  `WHEELCHAIR_LANE=1` and its own environment (`service.js:718-741`, route `:747`). It
  always uses Claude and the service's login.
- Session recovery guesses a recovered session's CLI from the pane text: contains `Codex`
  → codex, else claude (`service.js:172`).

## Usage and limits

- Nothing reads usage, quotas or rate limits anywhere: no usage call in `machine/`,
  `viewer/app/`, `viewer/pages/` or `codex/` (grep for usage, quota, rate limit, 5-hour).
  The only token-life check is the Codex preflight's 24 h margin (`preflight.sh:65`).
- The newer-model heads-up now reaches Settings: `settings.headsUp` runs
  `model.sh check --json` on the hub's machine (`settings.js:185`) and `describe` returns
  it (`settings.js:206`).

## The Ready check

`check` (`viewer/app/ready.js:26-54`): the service must answer `/v1/status` and run the
hub's commit; the thread's CLI must be installed and logged in, and the other CLI too when
installed (Codex's login = preflight passes; Claude's = `logged_in`). It knows nothing about
accounts, usage or models.

## Hub routes and state

- Browser API routes (`viewer/app/routes.js:29-47`): `machine`, `threads`, `features`,
  `projects`, `settings`, `sessions`; anything else is 404. `settings` routes are
  `routes.js:49-144`; contract in `viewer/app/API.md:28-37`.
- Hub state is in `~/.local/state/wheelchair/` (`viewer/app/state.js:9`): `machines.json`,
  `projects.json`, `settings.json` and `threads/<id>.json` (`state.js:45-47`). `settings.json`
  holds `permission_mode, codex_mode, other_agents, templates, style, style_version`
  (`settings.js:23`), saved through one read-modify-write queue (`state.js:176-194`,
  `settings.js:171-178`). Unknown keys are dropped on every load (`settings.js:150-161`).
- Machine routes: `machine/service.js:743-` and `machine/API.md`.

## Wrong today

- **The service cannot start a third CLI.** `commandFor` ends in
  `die('cli must be claude or codex')` (`service.js:289`) and the hub refuses any other
  value (`sessions.js:17`, `threads.js:46`).
- **`provider` and `cli` are two vocabularies for the same thing**: Settings and
  `model.sh` say `claude|gpt`, the rest of the code says `claude|codex`
  (`sessions.js:29`, `routes.js:52`, `settings.js:213`).

## What I did not look at

- `machine/service.js` stop, archive and git routes beyond their names.
- `viewer/app/hub.js` beyond the state wiring; `views.js` `sessions()`.
- How `hub.call` maps a 409 from the service into an exception.
- The full `codex/model.sh` heads-up logic and its cache file format.
- Whether `claude --resume` must run in the original working directory (forking is not
  touched by this map any more; the previous version's fork notes were dropped as not
  checked at this commit).
