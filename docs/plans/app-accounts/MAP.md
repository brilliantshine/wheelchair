# MAP: accounts, usage and balancing

Checked against: `6a9811502bbd5d350fb22715f3158ad076999701` (origin/main)
Built from: `docs/maps/app-sessions.md` (**stale, re-checked and rewritten to this commit**:
the Settings feature merged since it was written) and `docs/maps/viewer-serving.md` (page
list and nav only, updated). `docs/plans/app-settings/MAP.md` describes the code before
Settings merged; where it disagrees with this file, this file wins. Detail and every
pointer for the session flow are in `docs/maps/app-sessions.md`; this file keeps what
matters for accounts, usage and balancing.

## How a session starts today, end to end

1. A thread's lead starts at once with the **CLI the person chose for the thread**
   (`viewer/app/threads.js:46`, `58`). Every other session is started by an agent running
   `wc.js session start --cli <claude|codex> --tier T` (`protocol/app/lead.md:47`,
   `protocol/app/sub-lead.md:73`). **So today the lead or sub-lead picks the CLI, and the
   hub only checks it is `claude` or `codex`** (`viewer/app/sessions.js:17`, `330`).
2. The hub turns role and tier into a *slot*, then a model: lead and sub-lead → slot
   `lead`; reviewer, verifier, mapper → the tier set in Settings' "Other agents"; worker →
   the tier asked for (`sessions.js:16-39`). The model comes from `codex/model.sh <provider>
   <slot>`, which reads the pins file `~/.wheelchair/models` on the hub's machine
   (`model.sh:41`, `313-319`). A cell set to Not used exits 3 and the start fails "use the
   other CLI" (`sessions.js:36`).
3. The hub sends the machine service `{cli, model, effort, permission_mode, codex_mode,
   role_layers, brief, …}` (`sessions.js:115-136`). **No account, login folder or
   environment is in it.**
4. The service builds the command (`machine/service.js:266-290`) and starts it in tmux with
   `env WHEELCHAIR_LANE=1 WHEELCHAIR_SESSION_TOKEN=… WHEELCHAIR_STATE_DIR=…
   WHEELCHAIR_MACHINE_ORIGIN=… <argv>` (`service.js:307`, `316-320`).
5. The service scrapes the pane until it looks ready, then types the first message
   (`service.js:326-373`).
6. When a turn ends, the CLI's hook runs `machine/hook.sh` → `machine/lib/hook-post.js` →
   service → hub (`hook-post.js:16-23`, `service.js:604-621`, `sessions.js:271-272`).
7. The service finds the session's transcript under its **own** `$CLAUDE_CONFIG_DIR` or
   `$CODEX_HOME` and copies it for the hub (`service.js:622-638`, `502-526`).

```
lead/sub-lead picks --cli, --tier  (or: person picked the thread's CLI)
   -> hub: cli -> provider (claude|gpt) ; role+tier -> slot ; model.sh pins -> model
   -> machine /v1/sessions  (no account)
   -> tmux env WHEELCHAIR_* + argv   -> pane scraped for "ready"
   -> turn ends: Stop hook | notify -> hook.sh -> hook-post.js -> hub
   -> transcript read from service's own CLAUDE_CONFIG_DIR | CODEX_HOME
```

## The provider adapter: what each of its four jobs is today

The design question is a per-CLI adapter for (1) start in tmux, (2) read usage, (3) notice
a turn ending, (4) keep logins apart. Today the first, third and fourth are done by
`if (cli === 'claude') … else codex` branches inside `machine/service.js`; the second does
not exist.

| Job | Claude today | Codex today | Fits an adapter? |
|---|---|---|---|
| **1. Start in tmux** | argv with `--session-id`, `--settings <file>` (carries the hooks), `--permission-mode`, `--model`, `--effort`, `--append-system-prompt` (`service.js:269-277`); first message typed after ready | argv with sandbox flags, `-c notify=[hook,"codex",name]`, `-c projects={…trusted}`, `-m`; first message is `[wc:role] <prompt>` (`:279-287`, `:311-315`) | Yes. One function builds argv and the first message; the `env` prefix at `:307` is common. It needs `cli` as a lookup, not an `if` |
| **Ready test** (part of 1) | pane has `auto mode on` or `bypass permissions on`, a `❯` line, no trust prompt (`:326-330`); the service answers the trust and bypass prompts itself (`:340-353`) | pane has `Ask Codex to do anything` (`:329`) | Yes, but it is screen text, so each CLI's wording is a fact the adapter must own. Recovery of a lost session guesses the CLI from pane text `Codex` (`:172`) |
| **3. Turn end** | `Stop` hook written into the per-session settings file; the payload carries `transcript_path` (`service.js:274`, `hook-post.js:17`) | `notify` argv; payload type `agent-turn-complete` carries a thread id, the transcript is found afterwards by that id (`:281`, `hook-post.js:21-23`, `service.js:607-613`) | Yes. Both end in one `turn-ended` event; the translation is already in one 8-line block (`hook-post.js:16-24`). A CLI with neither a hook nor a notify would need pane scraping, which nothing here does for turn end |
| **4. Logins apart** | `claude` reads `CLAUDE_CONFIG_DIR` (read by the service at `:623`); nothing sets it for a session | `codex` reads `CODEX_HOME` (`:631`, `preflight.sh:26`); nothing sets it for a session | **Needs two changes**, see "Accounts" below |
| **2. Usage** | none | none | Nothing to adapt. See "What the code does not tell us" |

What makes the adapter easy: the CLI-specific code is in few places and every place is
listed below. What makes it hard: the per-CLI knowledge is spread over **four layers** (hub
`sessions.js`/`ready.js`/`chat.js`, the service, the hook scripts, and `codex/model.sh`),
and the hub and the service speak about the same CLI with two names (`claude|gpt` in
`model.sh`, Settings and `routes.js:52`; `claude|codex` everywhere else).

## Accounts: what exists, what would have to change

- **Nothing models an account.** There is no account list, no login folder, no `account`
  field on a session or in `settings.json`, no mention in any route or page (grep for
  account, quota, rate limit, 5-hour in `machine/`, `viewer/`, `codex/`, `install.sh`: no
  hits outside docs).
- **Login folders.** The only login selector either CLI honours that the code already
  names is `CLAUDE_CONFIG_DIR` / `CODEX_HOME`. Past art: the retired Codex credential
  balancer used slot directories `~/.bravo/…/accounts/N` as `CODEX_HOME` for workflow lanes
  (`docs/plans/one-account-setups/MAP.md:60`, `protocol/lanes.md:50` now leaves it unset).
  App sessions never did this.
- **To run a session on an account** the service must (a) put the folder into the `env`
  prefix at `service.js:307`, and (b) look for the transcript in **that session's** folder,
  not its own environment (`service.js:623`, `631`). Without (b) the thread's chat stays
  empty: Claude's id lookup (`:538-541`) and Codex's rollout lookup (`:610-611`) both search
  the wrong tree. Claude's hook payload carries the real `transcript_path` (`hook-post.js:17`),
  so Claude only breaks before its first Stop; Codex has no such path.
- **Login status is per CLI, run in the service's environment.** Claude: `claude auth
  status` → `loggedIn` (`service.js:709-712`). Codex: `codex/preflight.sh`, which reads and
  may refresh `$CODEX_HOME/auth.json` under a `flock` (`preflight.sh:26-30`, `65-90`). Both
  need to run once per account folder, with that folder in their environment. The Ready
  check (`viewer/app/ready.js:26-54`) reads one boolean per CLI from `/v1/status`
  (`service.js:697-714`), so it would need "at least one logged-in account per CLI on this
  machine" or a per-account list.
- **Accounts live per node.** The mock says "signed in on beelink, node-2, node-3"
  (`SettingsAccounts.dc.html`). A session runs on `thread.machine` (`sessions.js:115`),
  and each machine service has its own home directory. The hub knows machines from
  `machines.json` (`viewer/app/state.js:45`, `146-149`). Today the hub holds the
  settings and the pins; a node learns the model only from the start request. An account's
  folder path is a node-local fact, so either each service keeps its own account list and
  reports it in `/v1/status`, or the hub sends the folder in the start request. Neither
  exists.
- **Other readers of the login** that would need an account too: the style preview runs
  `claude -p` with the service's environment (`service.js:718-741`); the Codex preflight at
  session start (`sessions.js:75-86`); `model.sh` reads Codex's `models_cache.json` from
  `$CODEX_HOME` (`model.sh:43`), which is per-account if homes differ.
- A new Claude config dir or Codex home will not hold the user's `CLAUDE.md`, `AGENTS.md`,
  or `~/.claude.json` trust records. For Codex `diagram-sensitivity`'s plan states the same
  of lane slot homes (`docs/plans/diagram-sensitivity/PLAN.md:166`); app sessions skip the
  wording hook anyway (`WHEELCHAIR_LANE=1`, `seen/hook.sh:166-167`). I did not run a
  session under a fresh folder to see what else differs (trust prompt, first-run screens
  that would break `readyText`).

## Usage and balancing: where it would hook in

- **Nothing reads usage.** The only token-life check is the Codex preflight's 24 hour
  margin (`preflight.sh:65`). The only post-start "something is wrong" signal is the pane
  scrape (`stuck` after 30 s, `service.js:367-371`) and the Claude permission-prompt
  notification (`hook-post.js:18`).
- **One place decides model, none decides CLI.** `resolveModel` (`sessions.js:16-39`) is
  where "which provider and slot" gets turned into a model, but it is *handed* the CLI. A
  balancer that chooses provider (and account) has to run **before** `resolveModel` and
  override `input.cli` (`sessions.js:74`), including for the lead (`threads.js:58`, `97`,
  `122`: the thread's own `cli` is the lead's, fixed at creation). It must also answer what
  happens to protocol text telling agents to pass `--cli` (`protocol/app/lead.md:47`,
  `sub-lead.md:73`).
- **The provider-order rules have a table already, only part of it.** Settings' tier table
  stores one model per provider and slot, `Not used` as a real value (`model.sh:313-317`,
  `settings.js:184`, `viewer/pages/settings.js:15`, Models panel at `:213-290`). "Leads and
  sub-leads run on Claude Opus only" is **not enforced**: the Leads panel lets each
  provider have its own lead model (`viewer/pages/settings.js:265-270`) and the thread's CLI
  decides which applies. The ordered provider list (GPT, Google, Claude, OpenRouter),
  **Save Claude for leads** and **Margin** do not exist anywhere in code or `settings.json`.
- **"UI work prefers Claude", "Critical needs two providers"**: there is no kind-of-work tag
  on a session or brief; `tier` is the only input (`wc.js:85`). Not in scope of the
  provider-order parts named for this feature, but the order list has to say where such a tag
  would come from.
- **Checker "not the provider that built it" and "plan reviewers: two providers"** are
  prose in protocol today (the lead picks `--cli`); `sessions.js` knows nothing of who built
  what.

## Where Settings state lives and how the page is built

- **Server side.** `settings.json` in the hub's state dir holds `permission_mode,
  codex_mode, other_agents, templates, style, style_version` (`settings.js:22-24`),
  normalized on every load and **unknown keys dropped** (`settings.js:150-161`: a new
  `accounts` or `balancer` key must be added to `defaults()` and `normalize()` or it is
  lost). Written through `State.updateSettings`, one queue, read-modify-write
  (`state.js:176-194`, `settings.js:171-178`). The tier table is **not** here; it is the
  `model.sh` pins file (above). Routes: `GET /settings` returns everything in one object
  (`settings.js:198-207`, `routes.js:50`); writes are `PUT /settings/models|preferences|style`,
  `POST|PUT|DELETE /settings/templates` (`routes.js:49-144`); contract
  `viewer/app/API.md:28-37`.
- **Page.** `/wheelchair/app/settings` is a name in `APP_PAGES` (`viewer/server.js:1830`)
  serving `viewer/pages/settings.html` (a section nav, `#panel`), `settings.js` (one IIFE,
  plain DOM through a local `h()` helper) and `settings.css`. Sections are the list
  `SECTIONS = [models, templates, writing]` (`viewer/pages/settings.js:8`), picked by URL
  hash (`:690-695`), drawn by `renderPanel` choosing one of `renderModels|renderTemplates|
  renderWriting` (`:682-688`). **Adding Accounts and Usage is a two-entry change to
  `SECTIONS`, a branch in `renderPanel`, and two render functions** (the mock's side nav
  already lists Accounts, Usage and balancing, Models and preferences, Behavior templates,
  Writing style, Nodes, Diagrams, Notifications). The page fetches `GET /settings` once at
  load (`:699-708`), so live usage bars would need their own route and a refresh timer; the
  page has none today.
- **What the two designs ask for** (`docs/proposals/app-shell/design/SettingsAccounts.dc.html`,
  `SettingsUsage.dc.html`, read as text only): per provider, accounts with plan, nodes
  signed in or out, 5-hour window used and reset, week used and full reset, in use by N
  agents, Pause, Sign in on another node, Rename, Add account (provider → sign in on chosen
  nodes); OpenRouter with a monthly dollar cap; per-provider "left this week" bar with an
  amber forecast line; a table of accounts with "next" and the reason; balancer rules
  (soonest refill / spread / one at a time), notify below 25 %, leave 10 %, shift workers,
  pay-as-you-go last. The "in use · 3 agents" count would need session records to carry the
  account; sessions are in `threads/<id>.json` and the hub already counts live sessions
  that way for templates (`settings.js:201-205`).
- **Signing in** has no code path: nothing runs `claude auth login` or `codex login` for
  the person. The mock's "Sign in" button opens the CLI's own flow in a browser tab; the
  app has no way to start that on a node.

## Every place that assumes the only CLIs are Claude and Codex

(The blast radius of a third provider. File:line, from a grep for the two names plus a
read of each hit.)

- **Hub, creation and start:** `viewer/app/threads.js:46` (allowed CLIs for a thread);
  `viewer/app/sessions.js:17` (unknown-cli check), `:23` (Claude tier aliases), `:29`
  (cli → provider), `:33` (effort only for Claude), `:75` (preflight only for Codex),
  `:151` (`first_message` true for Codex); `viewer/app/wc.js:70-92` (`--cli` passed
  through unchecked, the hub checks).
- **Hub, readiness and chat:** `viewer/app/ready.js:38-51` (the "other" CLI is the
  opposite of the thread's; Codex special-cased by preflight); `viewer/app/chat.js:90-218`
  (every transcript parser branches on `cli === 'claude'` vs the rest: Codex's rollout
  format is the fallback, so a third CLI would be parsed as Codex).
- **Hub, settings:** `viewer/app/routes.js:52-55` (provider must be `claude|gpt`);
  `viewer/app/settings.js:187-196` (model options hard-coded per provider), `:213` (preview
  always Claude); `viewer/app/settings.js:23` (`other_agents` tiers only).
- **Page:** `viewer/pages/settings.js:15` (`PROVIDERS`, two rows; the tier table and Leads
  panel are built from it), `:223-230` (GPT-only heads-up lines).
- **Machine service:** `machine/service.js:172` (recovery guesses Codex from pane text),
  `:269-289` (`commandFor`, dies on any other CLI), `:313` (Codex's first message), `:328`
  (`readyText`), `:340`, `:349`, `:386` (Claude-only trust and bypass answering and
  polling), `:538` (Claude-only transcript by id), `:607`, `:613` (Codex-only thread binding),
  `:622-638` (two transcript finders), `:701` (`status()` lists exactly `claude` and `codex`),
  `:703-714` (`cliStatus`: Claude has `auth status`, Codex's login is elsewhere), `:726`
  (preview spawns `claude`), `:746` (preflight is `codex/preflight.sh`).
- **Hooks:** `machine/hook.sh:16-28` (`claude` reads stdin, `codex` reads the last argv);
  `machine/lib/hook-post.js:16-24`.
- **Model pins:** `codex/model.sh:14-31` (`PROVIDERS = (claude, gpt)`, `DEFAULTS`, aliases),
  `:73-74` (pins-file line regex `(claude|gpt)\.…`), `:306-332` (command grammar); the
  file name and directory (`codex/`) also assume Codex.
- **Installer and hook writers:** `install.sh` and `seen/set.sh` write into each present
  harness's home (`install.sh:34`, `seen/set.sh:9`, `sensitivity/set.sh:11`); `seen/hook.sh:164`
  accepts only `claude|codex`. These are the *developer's* harness setup, not app providers;
  a third provider does not need them unless the wording hook should cover it.
- **Protocol text:** `protocol/app/lead.md:47` and `protocol/app/sub-lead.md:73` tell agents
  `--cli <claude|codex>`; `protocol/lanes.md` is the workflow-lane equivalent. I did not read
  the rest of `protocol/`.
- **Not related:** `viewer/server.js:1466`, `1759`, `1794`, `2044-2052` use `claude|codex|other`
  as the *harness label* of a graph, not a session provider.
- **Tests that pin the two-CLI shape:** `machine/test/service.test.js`, `codex/test/run.sh`
  (pins grammar), `install/test/run.sh`, `viewer/test/app-hub.test.js` (not read in detail).

## What the code does not tell us about each CLI's usage reporting

I was told not to research CLI usage commands. The code gives none of these, so each is an
open fact the adapter's "read usage" job depends on:

- Whether either CLI has a command, flag or file that prints plan, 5-hour window used,
  week used and reset times, and in what format (JSON or screen text).
- Whether `claude auth status` (called today for `loggedIn`, `service.js:710`) also says
  plan or account; what Codex stores in `auth.json` beyond the tokens the preflight touches.
- Whether reading usage costs a model request or counts against the limit itself.
- Whether usage can be read for an account without an open session, from its login folder
  alone (needed for accounts with no running agent, and for "signed out on beelink" checks).
- What a session shows or does when it hits a limit (pane text, a hook event, an exit), so
  the service could notice a session blocked on a limit. Today no such signal exists.
- Whether Codex's rollout transcript carries rate-limit information that could be read for
  free; whether Claude's transcript or hook payload does.
- How a weekly window is anchored per account (fixed weekday, or rolling from first use),
  which "full reset Tue 9:00" in the mock assumes is readable.
- Whether OpenRouter's usage and key-limit API is reachable from the hub; it has no CLI
  and no code here (not looked up).
- Terms: the proposal's open question on several personal subscriptions feeding one
  automated setup (`docs/proposals/app-settings/proposal.md`, "Open questions") is not a
  code fact and is unanswered here.

## Wrong or at risk

- **The old app-settings map is wrong about Astra and Opus:** both now work. Critical
  resolves to `claude-fable-5-2` / `gpt-6-astra` (`model.sh:19-25`) and a Claude lead has a
  named model, `claude-opus-5-5` (`model.sh:21`), passed as `--model` (`sessions.js:31`,
  `service.js:277`).
- **"Leads run on Claude only" contradicts the shipped Leads panel,** which lets each
  provider have a lead model (`viewer/pages/settings.js:265-270`); with no rule about
  which provider a lead gets, the thread's own CLI decides (`threads.js:58`).
- **A fresh account folder can silently leave the thread's chat empty** (see Accounts). The
  chat reads transcripts only through the service's copy (`chat.js:199-206`), so the failure
  shows as "no messages", not an error.
- **Pins live on one machine, settings on the same machine, but sessions run on any node.**
  Worker nodes get the resolved model in the start request, so this works; it means a
  per-node account list cannot piggyback on either file.

## What I did not look at

- Any CLI's own usage, login or config-directory behaviour; no session was run, no
  `CLAUDE_CONFIG_DIR` or `CODEX_HOME` was set to test.
- `machine/service.js` stop, archive and git routes; `viewer/app/hub.js` and `views.js`
  `sessions()` and the Sessions page (where a per-session account would be shown).
- How a second machine registers itself and is added to `machines.json`; the Nodes
  settings screen in the mock.
- The other four mocks (`SettingsModels|Templates|Writing`, `ThreadAside`) beyond what
  Settings already built; the designs were read as extracted text, not rendered.
- `viewer/pages/settings.css` and the Models panel's styling; the browser test suites.
- The `protocol/` files beyond the two `--cli` lines and `lanes.md:44-56`.
- `viewer/test/` and `machine/test/` beyond the one Claude-transcript test.
- `docs/maps/app-thread-page.md`: not touched by this change and not re-checked; its
  header still names `5742e2f`, and `git diff --stat` shows `chat.js`, `thread.js`,
  `threads.js` changed since.
