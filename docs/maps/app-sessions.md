# Map: how the app starts an agent session (tier, model, permissions, login, role prompt, transcript)

Checked against: `695931e84556a21d3c22729d21083992640dcc0e` (origin/main) for the parts marked
(re-checked): the model/effort resolution, the command line, the role prompt and the settings
store. The rest was last checked at `5742e2f` and `machine/service.js` has since gained ~84
lines, so its line numbers below (readiness, transcripts, logins) may be off by 20-40.
Files covered: `viewer/app/sessions.js`, `viewer/app/threads.js` (createThread),
`viewer/app/wc.js` (session start), `viewer/app/ready.js`, `viewer/app/routes.js`,
`viewer/app/state.js`, `machine/service.js`, `codex/model.sh`, `codex/preflight.sh`,
`seen/hook.sh` (lane skip only)

## Flow

1. **Someone asks for a session.** A new thread starts its lead with
   `{role:'lead', brief:'', tier:'top'}` (`viewer/app/threads.js:57`). Any other session is
   an agent running `wc.js session start --role --cli --brief-file --attempt [--tier]`; the
   tier defaults to `top` (`viewer/app/wc.js:77`, `85`). The machine service forwards it to
   the hub's `/api/machine/session` (`machine/service.js:637-656`, route at `:715`), and `sessionRequest`
   checks who may start what (`viewer/app/sessions.js:288-326`; the table is
   `sessions.js:47-50`).
2. **The hub resolves the model and effort** (re-checked). `startSession`
   (`viewer/app/sessions.js:71-160`) runs the Codex preflight first for a Codex session
   (`:75-86`), then `resolveModel` (`:16-39`). The role picks a *slot*: lead and sub-lead →
   `lead`; reviewer, verifier, mapper → the tier saved in Settings' `other_agents`
   (`:20-21`); anything else → the requested tier, with `top` meaning `heavy`, and Claude's
   old `haiku|sonnet|opus` meaning light|standard|heavy (`:22-27`). It then runs
   `codex/model.sh <claude|gpt> <slot>` for the model and, **for Claude only**,
   `codex/model.sh effort claude <slot>` (`:29-33`). Allowed tiers are `settings.js:12-13`.
   A cell set to `none` is a 400 (`:36`).
3. **The hub asks the machine service to start it**, `POST /v1/sessions` with role, cli,
   token, worktree, brief, `model`, `effort` (only when set), `permission_mode`, `codex_mode`,
   `role_layers` and git refs (`sessions.js:115-135`) (re-checked). The hub never sends
   `role_prompt`, and nothing chooses a login or environment.
4. **The service builds the command line** in `commandFor` (`machine/service.js:266-289`)
   (re-checked):
   - The role prompt is `composeRolePrompt` (`service.js:57-63`): the pointer line `Read
     <root>/protocol/app/<role>.md before responding. It is wheelchair's built-in rules for
     your role.`, then a blank line and `role_layers` when there are any. `role_prompt`, if
     sent, replaces both.
   - Claude: `claude --session-id <uuid> --settings <stateDir>/settings/<name>.json
     --permission-mode auto|bypassPermissions [--model M] [--effort E]
     --append-system-prompt <role prompt>` (`service.js:277`). `--effort` appears only when
     the session record has one (`startOptions`, `service.js:65-73`, accepts low, medium,
     high, xhigh, max).
   - Codex: `codex <access flags> -c notify=… -c projects={…trust…} [-m M]`
     (`service.js:287`). **No reasoning-effort flag at all**: `grep reasoning_effort` finds it
     only in protocol text (`protocol/lanes.md`), never in `machine/`, `viewer/` or `codex/`.
     The role prompt and layers go as the first `[wc:role]` message instead
     (`service.js:310-314`).
5. **tmux runs it**: `env WHEELCHAIR_LANE=1 WHEELCHAIR_SESSION_TOKEN=… WHEELCHAIR_STATE_DIR=…
   WHEELCHAIR_MACHINE_ORIGIN=… <argv>` in `tmux new-session -d -s <name> -c <worktree>`,
   under `systemd-run --user --scope` when available (`service.js:278`, `287-291`).
6. **Readiness.** The service polls the pane: Claude is ready when the pane shows
   `auto mode on` and a `❯` prompt (it answers the folder-trust prompt itself); Codex when
   it shows `Ask Codex to do anything` (`service.js:297-300`, `306-338`). Then it types the
   pending first message (the brief, or Codex's `[wc:role]` line) (`service.js:321-326`).
   No ready screen after 30 s → `stuck` (`service.js:330-334`).
7. **Transcripts.** Claude's file is found by session id under
   `$CLAUDE_CONFIG_DIR/projects/*/<id>.jsonl` (`service.js:582-588`); Codex's rollout is
   bound on the first turn-end whose first input starts `[wc:role]`, by thread id under
   `$CODEX_HOME/sessions` (`service.js:568-572`, `590-598`). The service appends new lines
   to its own copy `<stateDir>/transcripts/<thread>/<name>.jsonl` (`service.js:462-485`),
   which the hub reads through `GET /v1/sessions/:name/transcript` (`service.js:487-509`,
   `viewer/app/chat.js:194-201`).

```
new thread (lead, top)        agent: wc.js session start --tier T
        \                           |
         \                     machine /v1/agent/session -> hub sessionRequest (who may start what)
          \                         |
           +-----> startSession: codex? preflight -> resolveModel(cli, tier)
                        |   claude: top=no --model, else alias | codex: model.sh pin
                   POST machine /v1/sessions {role, cli, model, brief}   (no role_prompt, no login)
                        |
                   commandFor: claude ... --permission-mode auto --append-system-prompt "Read <role>.md"
                               codex  -s ... -a never ...; first message "[wc:role] Read <role>.md"
                        |
                   tmux new-session (env WHEELCHAIR_LANE=1, token) -> pane polled until ready
                        |
                   transcript found in $CLAUDE_CONFIG_DIR / $CODEX_HOME -> copied -> hub /chat
```

## Logins: one account per CLI per machine

- Nothing chooses a login. The tmux command sets only the four `WHEELCHAIR_*` variables
  (`service.js:278`), so each CLI uses whatever config directory the service's own user
  environment gives it. The unit sets only `PATH` (`install.sh:332-336`).
- The service reads `CLAUDE_CONFIG_DIR` and `CODEX_HOME` **from its own process
  environment** to find transcripts (`service.js:583`, `591`). If a session were started
  with a different config directory, these lookups would search the wrong place and the
  thread's chat would stay empty.
- Login status: Claude's is `claude auth status` → `loggedIn` (`service.js:669-672`);
  Codex's is `codex/preflight.sh`, which reads and, if needed, refreshes
  `$CODEX_HOME/auth.json` under a lock (`codex/preflight.sh:26-30`, `46-49`).
- `GET /v1/status` returns per CLI only `{installed, logged_in, version}`
  (`service.js:657-673`).

## Permission mode (re-checked)

- No longer hard-coded: Settings holds `permission_mode` (`auto`|`bypass`) and `codex_mode`
  (`sandboxed`|`unrestricted`); the hub passes them on start (`sessions.js:130-131`) and
  the service maps them in `commandFor` (`service.js:266-289`). Readiness still depends on
  the mode (`auto mode on` in the pane, or the bypass confirmation answered by key presses).

## Where a role's instructions come from

- The pointer line to `protocol/app/<role>.md` plus **`role_layers`** (re-checked), delivered
  by `--append-system-prompt` (Claude) or the first `[wc:role]` message (Codex). The chat
  hides `[wc:role]` turns (`viewer/app/chat.js:133`).
- **`role_layers` is how Settings reaches an agent.** `settings.roleLayers`
  (`viewer/app/settings.js:121-134`) builds it per role and project: one line "Nothing below
  overrides the built-in rules above", then the in-use behavior template for that role
  (project-scoped wins over `all`, `settings.js:116-119`) with its switch sentences
  (`:93-106`) and free text, then "where the template and the brief disagree, the brief
  wins"; for a **lead only**, also the rendered writing style (`:132`). The hub computes it at
  start (`sessions.js:89`, `132`) and `composeRolePrompt` appends it (`service.js:57-63`). A
  running session keeps what it started with.
- The brief is typed in as the first message (`service.js:284-286`); a lead's brief is
  empty (`threads.js:57`).
- **The wording list does not reach app sessions**: every session runs with
  `WHEELCHAIR_LANE=1` (`service.js:278`) and `seen/hook.sh` returns at once when it is set
  (`seen/hook.sh:166-167`). `protocol/app/AGENTS.md:23-25` states the same.
- Nothing in the Claude argv restricts setting or memory sources (`service.js:254`), so I
  expect a Claude app session loads the user's global instruction file (with the
  diagram-sensitivity region) like any session. I did not run one to confirm.

## Forking a conversation

- Nothing in the app resumes or forks a session: no `--resume`, `--fork-session` or
  `codex resume|fork` anywhere under `machine/`, `viewer/app/` or `viewer/pages/` (grep).
- The CLIs installed here can: `claude --resume <id> --fork-session` (Claude Code 2.1.325)
  and `codex fork [SESSION_ID]` (codex-cli 0.169.0), from their `--help`. The service
  already keeps what each needs: Claude's `cli_session_id` (`service.js:274`) and Codex's
  `codex_thread_id` (`service.js:571`).
- What a fork would trip over in the current code:
  - `commandFor` has no resume path; Claude's `--session-id` is always a fresh UUID
    (`service.js:274`).
  - Readiness for Codex and the rollout binding both key on the first message starting
    `[wc:role]` (`service.js:284-286`, `570`); a fork carries the lead's history and gets
    no new `[wc:role]` line.
  - `SESSION_ROLES` has no role for it (`sessions.js:38-45`); the chat reads only `lead`
    sessions (`chat.js:222`), so a non-lead role stays out of the main thread.
  - A fork is told it is the lead (its history holds `lead.md`) and gets a session token
    the hub accepts cards from, so it could post cards to the thread unless the hub refuses
    cards by role.
  - A Claude transcript is stored per working directory; I did not check whether a resume
    must run in the lead's worktree to find it.

## Usage and limits

- Nothing reads usage or rate limits anywhere: no usage call in `machine/service.js`,
  `viewer/app/`, or `codex/` (grep for usage/limit).
- **The newer-model heads-up is thrown away.** `preflight.sh` ends by running
  `model.sh check` (`codex/preflight.sh:123`), which prints heads-up lines
  (`codex/model.sh:151-212`, `240-244`). The service returns the command's stdout in the
  `/v1/preflight` body (`service.js:681`), but the hub only looks at success or failure
  (`viewer/app/ready.js:17-24`) or the error text on failure (`sessions.js:76`).

## The Ready check

`check` (`viewer/app/ready.js:26-54`): the service must answer `/v1/status` and run the
hub's commit; the thread's CLI must be installed and logged in, and the other CLI too when
installed (Codex's login = preflight passes; Claude's = `logged_in`). It knows nothing about
accounts, usage or models.

## Hub routes and state

- Browser API routes are dispatched in `viewer/app/routes.js:27-45`: `machine`, `threads`,
  `features`, `projects`, `settings`, `sessions`; anything else is 404. The contract is
  `viewer/app/API.md:8-27`.
- Hub-wide state lives in `~/.local/state/wheelchair/` (`viewer/app/state.js:9`):
  `machines.json`, `projects.json`, `threads/<id>.json` and, new, `settings.json`
  (`state.js:47`, `176-193`; written through one read-modify-write queue, `updateSettings`).
  Model and effort pins are **not** in it: they live in `~/.wheelchair/models`, owned by
  `codex/model.sh`.
- Machine routes are in `machine/service.js:675-718` and `machine/API.md:8-22`.

## Every place the tier names Luna, Terra, Sol, Astra appear (outside plan history)

- Code: `viewer/app/sessions.js:15`, `17`, `25`; `codex/model.sh` (6 lines: the defaults
  table `:15-20`, the pin parser `:25`, usage `:27`); `codex/test/run.sh` (43 lines);
  `install/test/run.sh:258`, `263-265`; `viewer/test/app-hub.test.js` (5 lines).
- Pins file format: `~/.wheelchair/models` keys are the tier names (`codex/model.sh:25`).
- Protocol: `protocol/lanes.md:42`, `68-83`, `162-167`, `188-214`;
  `protocol/app/sub-lead.md:55-75`, `119-123`; `protocol/app/lead.md:69`;
  `protocol/implementation.md:173`, `185-187`; `protocol/verification.md:25-35`, `103`;
  `protocol/plan-review.md:34-36`; `protocol/templates/COMPLETION.md:4`.
- API doc: `viewer/app/API.md:53-54`.
- Designs: `docs/proposals/app-shell/design/` Run, SessionWall, SettingsModels, Main,
  PhoneInbox, PhoneLane, Thread (`.dc.html`); `docs/proposals/app-settings/proposal.md`.
- Past plans under `docs/plans/` (model-pins, one-account-setups, app-shell and others)
  mention them as history.

## Wrong today

- (Re-checked: the old "Astra cannot be reached" finding is fixed; `critical` is a valid tier,
  `sessions.js:22-27`, `settings.js:12`.)
- **"Leads run on Opus 5.5" is now a pin, not a CLI default** (`model.sh:21`): `top` no longer
  means "no `--model`"; every session gets a model (`sessions.js:29-34`).

## What I did not look at

- `machine/service.js` stop, archive and git routes beyond their names.
- `viewer/app/hub.js` beyond the state wiring; `views.js` `sessions()`.
- How `hub.call` maps a 409 from the service into an exception.
- Whether `claude --resume` must run in the original working directory, and how either
  CLI's fork names its new transcript.
- Whether a long `--append-system-prompt` on the tmux command line hits a length limit.
- The full `codex/model.sh` heads-up logic and its cache file format.
- `machine/hook.sh` and `machine/lib/hook-post.js`.
