# Map: app residual risks

Checked against `635c45f07991f31191f2ab1443b52b4ee76559d5` (origin/main). This supplements the older maps in `docs/maps/`; their checked commits predate changes to the relevant files.

## Test setup

```text
fixture directory -> fake commands + fake hub -> isolated machine service -> assertions
viewer fixture -> free loopback port + isolated state/cache -> fake machine -> assertions
```

`machine/test/run.sh:3` runs Node tests. `machine/test/service.test.js:19-38,40-65` prepends shims for tmux, systemd-run, git, gh, Claude, Codex, tailscale and sh, creates a configurable fake hub, and starts a service with a temporary state directory, secret and loopback port. Most starts supply an already-created worktree (`machine/test/service.test.js:71-76`); some use real git and a temporary bare origin and clone (`machine/test/service.test.js:84-97`). The viewer's helper uses a free port, explicit `--port` and `--cache-root` (`viewer/test/helpers/server.js:66-91`); its fake machine accepts starts and fabricates worktrees (`viewer/test/helpers/app-machine.js:25,82-89,191-197`). `test-support/run-dir.js:93-119` groups temporary directories under one per-process OS temp directory and cleans up at exit.

A real smoke needs to replace the tmux/CLI shims, use real git and an isolated origin, and connect the actual hub to the actual service; a fake hub or fake machine cannot exercise that boundary. Isolation needs explicit state, port, and HOME/config choices: service defaults are `~/.local/state/wheelchair` and port 7374 (`machine/service.js:26,144,252`); `wc.js` falls back to `127.0.0.1:7374` (`viewer/app/wc.js:119`); adapters default to `~/.claude` and `~/.codex` (`machine/adapters/claude.js:5`, `machine/adapters/codex.js:5`). Some service tests override HOME individually (`machine/test/service.test.js:784-799`); the common fixture does not (`machine/test/service.test.js:58-65`). The existing manual real-CLI aside probe explicitly unsets config overrides and searches live HOME transcripts (`machine/test/aside-probe.sh:5,89,149`), so it is not an isolated smoke fixture.

## Start and timeout

```text
thread or wc session start -> hub chooses provider/model -> machine POST -> git fetch -> worktree -> tmux -> response
                                                               | no response
                                                        same-name retry -> 503 if unanswered
```

The hub saves a starting session and sends its project, token, name, model and options to the machine (`viewer/app/sessions.js:166-221`). For a new worktree the machine fetches origin, resolves the default branch, adds a worktree under its state directory, then launches the CLI through systemd-run or tmux and persists the session (`machine/service.js:365-390,420-455`); a supplied worktree follows a different path (`machine/service.js:353-363`).

The historical five-second start risk is stale: starts now have **60 seconds per request**, with one same-name retry on transport failure (`viewer/app/sessions.js:74-85`). The machine joins an in-progress same-name start or returns its existing session (`machine/service.js:407-418`). If both requests get no answer, the hub records the unanswered body and returns 503 telling the caller to repeat the same attempt; the machine may still complete it (`viewer/app/sessions.js:88-101,220-231`). Other `MachineClient.call` requests default to five seconds, including preflight, status and message submit (`viewer/app/machine-client.js:10-43,64-78`; `viewer/app/sessions.js:143,171,333`); preview explicitly uses 75 seconds (`viewer/app/settings.js:269-273`), and streaming uses a separate request path (`viewer/app/machine-client.js:80-100`). Timeout destroys the client request, not a cancellation of machine work (`viewer/app/machine-client.js:42`; `machine/service.js:985`).

## Model tiers

```text
wc --tier / Settings -> slot and provider -> model.sh -> start body -> adapter argv -> CLI
```

`wc.js` forwards the requested tier, defaulting to `top` (`viewer/app/wc.js:87`). Worker aliases map `terra` to `standard`; `top` maps to `heavy`, while leads use `lead` and mapper/reviewer/verifier use Settings' role slots (`viewer/app/settings.js:13-14,35-37`; `viewer/app/balancer.js:11-17`). Provider/account selection precedes `model.sh` lookup (`viewer/app/sessions.js:18-30,120-126,164-166`); Settings writes model slots via its models route (`viewer/pages/settings.js:94-113`; `viewer/app/routes.js:185-199`). The hub records and sends the resolved model and effort (`viewer/app/sessions.js:190,197-213`); Claude passes `--model` and Codex passes `-m` (`machine/adapters/claude.js:17-22`; `machine/adapters/codex.js:31`). The machine records `session.command` (`machine/service.js:443-446`), and the hub exposes its recorded model through public sessions (`viewer/app/sessions.js:48-50,233-236`). These show what was requested, not proof of what the CLI actually selected; inspect the live CLI or its own transcript/status for that observation.

## Permission prompt

```text
Claude Notification -> hook -> machine prompt_open -> event spool -> hub permission_open + needs card
pane input returns / turn ends -> clear event -> hub clears hold and marks card answered
```

Claude installs Notification hooks (`machine/adapters/claude.js:17-22`); the machine accepts only permission-prompt notifications, records `prompt_open` and emits a session-bound event (`machine/service.js:761-768`). The hub sets `permission_open` and `needs_open`, posts a system needs card and holds queued delivery (`viewer/app/sessions.js:313,399-409`). Polling a ready session with an open prompt captures the pane and clears it when the adapter recognizes the input screen (`machine/service.js:500-505,514-520`; `machine/adapters/claude.js:25`). `ready`, `prompt-cleared`, `permission-cleared`, or a turn end while permission is open clears the hub hold and answers the card (`viewer/app/sessions.js:411-429`). The pane-based check has a simulated test (`machine/test/service.test.js:448-451`); that is not a live prompt observation.

## Card relay

```text
card.js -> agent endpoint -> durable spool + delivery id -> hub update -> acknowledgment -> remove spool
                                               | 500
                                     spool stays; caller sees 500
```

`card.js` validates and sends to the machine (`viewer/app/card.js:162-196`); the service assigns a UUID at spooling (`machine/service.js:682-690`). A direct relay forwards 500 to the agent while retaining the spool; 502/503/504 or connection failure instead report accepted for later delivery (`machine/service.js:1016-1030`). The periodic drain retries in order and retains an item on 5xx (`machine/service.js:703-735,1044`). The hub deduplicates delivery IDs, retains the last 500, and stores the card and ID together (`viewer/app/cards.js:38-46,79-80,101-109`). A retry of the *same spool item* reuses its ID; an agent resending after 500 creates a new spool item and UUID, so both can be accepted (`machine/service.js:685-690,1019-1028`).

## Projects

```text
new thread -> machine validates project -> hub saves thread -> append project path to projects.json
new-thread picker -> saved paths + machine folder scan + previous threads -> choices
```

The hub writes a unique path to `projects.json` after validation and thread save (`viewer/app/threads.js:41-70`; `viewer/app/state.js:171-173,196-203`). It is a history of selected project paths, without a machine identity, not an inventory of all clones. The current picker does **not** read that list for its previous group: it uses previous threads for the selected machine, configured saved directories, and a machine scan of immediate non-hidden git directories in the configured default folder (`viewer/app/routes.js:88-115`; `machine/service.js:924-946`; `viewer/pages/new.js:36-55`). D4 says the hub holds every project and the app lists its cloned repos (`docs/plans/app-shell/PLAN.md:47,228`); the current scan is limited to a configured folder and also supports selected remote machines, so it is not a complete hub-wide clone inventory.

## Not looked at

No live CLI, tmux, service, network, permissions interaction, or actual model output was exercised. This map does not audit all viewer test suites, every caller timeout override, all possible git layouts, or the complete history of the superseding project-picker and start-timeout changes.
