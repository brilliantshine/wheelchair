---
slug: easy-onboarding
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-20
---

# Easy install and harness picker

**Idea:** `IDEA.md` — read it first. Map: `MAP.md`, `docs/maps/onboarding-runtime.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Thread "Make OpenRouter agents solid" edits `cliStatus('pi')` and `machine/adapters/pi.js` command(); resolveCli stays theirs to leave as is | If this plan changes how Pi is found, both threads touch nearby lines | yes | Collin told; both threads proceed, a merge fix-up may be needed. Spec changes no adapter resolver (S1.3 uses the service PATH instead), so no overlap with their lines |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: two-part | Picked on the mode card | user |
| 2 | Each harness installs with its vendor's own user-level method (npm packages into a user prefix such as `~/.local`, never global/root); latest version | Matches "no root" constraint; vendors ship these | defaulted |
| 3 | The machine finds CLIs at run time from PATH plus the known user install dirs, so a CLI installed later is used without reinstalling wheelchair | IDEA "usable right away" | defaulted |
| 4 | After a harness is installed from Settings, the machine runs that harness's own setup steps the installer would have done (instruction-file block, old-hook cleanup, model pins) | Otherwise a later-installed Claude or Codex misses its setup | defaulted |
| 5 | `install.sh` no longer refuses when no harness CLI is present; it skips harness-specific steps and points to Settings | IDEA "one install command succeeds with no agent CLI" | defaulted |
| 6 | Leaving a harness out is one hub-wide switch per harness, applying to every machine | Machines lacking a harness are already skipped; fewer controls | user |
| 7 | (refined by 21) First run: a setup checklist on the home page linking into Settings, gone once one harness is installed and signed in | Guides without duplicating Settings | user |
| 8 | Decision 3 is met by always putting `~/.local/bin` and `~/.kimi-code/bin` on the service PATH, where every recipe lands; no adapter resolver changes | Avoids touching the OpenRouter thread's lines; PATH lookup is per call | defaulted |
| 9 | (superseded by 11) Turning off the harness the lead model runs on is refused until another lead model is picked | Otherwise every new thread would be stuck | defaulted |
| 10 | (refined by 21: a third `start` step) Checklist has two steps (install, sign in); no "choose" step | Choosing is optional: all harnesses default on | defaulted |
| 11 | Supersedes 9: switching a harness off is refused only when Lead order (with `any` expanded) would have no enabled harness | Review round 1: the "lead model setting" does not exist; the old rule blocked Codex-only users from leaving Claude out | review-round-1 |
| 12 | The switch stops new placements only; running agents, asides and retries of an unanswered start continue | Review round 1 | review-round-1 |
| 13 | (superseded by 15, then 17) A successful install from Settings adds that harness to Workers try first if missing | Review round 1: default orders exclude OpenRouter, so a Pi-only user would wait forever | review-round-1 |
| 14 | A recipe that can't be confirmed at build time ships as a vendor-docs link, not an Install button | Review round 1 | review-round-1 |
| 15 | (superseded by 17) Supersedes 13: a harness is added to Workers try first only when nothing in Lead order is installed, at most once, however it was installed | Review round 2: Settings-only trigger missed terminal and vendor-link installs; avoid silently adding pay-per-token OpenRouter for users who already have a working lead | review-round-2 |
| 16 | Install result survives a service restart (job writes a result file); was Deferred D4 | Review round 2: setup steps must run inside the job, which makes the result file free | review-round-2 |
| 17 | (superseded by 21) Supersedes 13 and 15: the hub never changes Lead or Worker order on its own. A harness that is signed in but not reachable from Lead order shows "Add to Lead order" in Settings and as a checklist step | Review round 3: the automatic append raced Settings drafts, missed a Lead order without `any`, and depended on a page being open; an explicit button avoids all three | review-round-3 |
| 18 | (superseded by 21) Keep the one-tap "Add to Lead order" button (over a plain link, or leaving Pi out) | Collin picked it after the review budget stopped | user |
| 19 | (superseded by 21) The one-tap button is "Let agents use <Harness>": it adds the harness to Workers try first, and also to Lead order when Lead order has no `any`. Refines 18 | Review round 4: adding to Lead order alone let a lead start but left every worker and reviewer waiting | review-round-4 |
| 20 | (superseded by 21) The row button shows only for a signed-in harness missing from Workers try first; it adds to Lead order only when Lead order reaches no working harness. Refines 19 | Review round 5: a deliberate Lead order like `['claude']` is normal and must not be flagged or changed | review-round-5 |
| 21 | Supersedes 17–20: no button changes the orders. The app asks the real placement code whether a new thread's lead and a worker could start on the default machine; if not, the checklist and Settings say why and link to the order lists. The checklist is retired for good once complete | Collin picked "Check and point" after the review budget stopped on the button | user |
| 22 | Keep reviewing the whole plan as is (no split, no trim) | Collin picked "Keep going" after the third budget stop | user |

## Spec

Validation and the bar: a fresh agent implements from this section alone. Provider keys
are the hub's (`claude`, `gpt`, `gemini`, `kimi`, `openrouter`); CLIs are `claude`, `codex`,
`agy`, `kimi`, `pi` (`viewer/app/providers.js:3`). Display names: Claude Code, Codex,
Antigravity, Kimi Code, Pi (OpenRouter).

### S1. Installer (`install.sh`, `install/test/run.sh`, `README.md`)

1. **Prerequisite check, first thing after the clone guard.** Check `node`, `npm`, `tmux`,
   `git`, `gh`, `python3`, `curl` with `command -v`, and that Node is 20 or newer (wheelchair
   targets Node 20 and later, and the installer's Playwright browser download needs it). Read
   the version with `node -e 'process.stdout.write(process.versions.node)'`, which the
   fixtures' `node` shim passes through to the real Node (`install/test/run.sh:101-105`). An
   older Node is reported like a missing tool, with its version. If any is missing, print one line per
   missing tool with how to get it (macOS: `brew install <pkg>`; Linux: "install <pkg> with
   your package manager", plus `https://cli.github.com` for gh), and exit 1 before writing
   anything. Tailscale stays checked only when serving, as today.
2. **No agent CLI is no longer fatal.** Remove the exit at `install.sh:53-57`. When none of the
   five is found, print `No agent CLI yet. After install, open the app: its setup checklist
   installs them from Settings.` and continue through every remaining step, including the
   stale-viewer check. Per-harness steps stay gated as now (`install.sh:106-114,137-139`).
   `codex/model.sh init` (`116-121`) runs unconditionally.
3. **Service PATH always includes the user install dirs.** In the PATH built at `373-390`, after
   the found-binary dirs, append `$HOME/.local/bin` and `$HOME/.kimi-code/bin` when not already
   present, whether or not they exist yet. Both the systemd unit (`414`) and the launchd plist
   (`347`) get it. No adapter resolver changes (`machine/adapters/pi.js:16`, `kimi.js:8-12`
   stay as they are).
4. **End message** when serving: just before the bookmark URL line (which stays the last
   line, as fixtures require), print `Next: open the link below; the home page walks you
   through installing and signing in to an agent.`
5. **README**: the first-time path becomes: install the basic tools, run `./install.sh --serve`,
   open the link, follow the checklist. Dependencies lists all five harnesses as optional,
   installable from Settings → Harnesses; drop "at least one CLI required". The macOS steps
   (`README.md:42-47`) stop asking for Claude Code or Codex before install and say the same.
6. **Fixtures** in `install/test/run.sh`. Change these, alongside the behavior:
   - `neither` (`430-435`): run it serving, the way `explicit_serve` does, and replace its
     assertions with: exit 0; prints the "No agent CLI yet" line; writes no Claude or Codex
     homes; runs the stale-viewer check; machine unit PATH contains `$HOME/.local/bin` and
     `$HOME/.kimi-code/bin`.
   - Restricted-PATH cases (`run_case`, `163-169`): also shim the S1.1 prerequisites `npm tmux
     git gh curl`, linking the real tool when present and otherwise writing a stub script that
     exits 0, so those cases still reach what they test. Never replace a shim
     `install_shims` (`99-103`) already writes: the existing `node` shim stays as it is.
   - `no_pi` (`326`): keep "absent pi is not reported"; replace the PATH assertion with
     "`$HOME/.local/bin` is on the machine unit PATH even with pi absent".
   - New case: `tmux` absent from the shim → exit 1, output names `tmux`, no state files
     written. New case: Node 18 — the case points `WHEELCHAIR_REAL_NODE` (which the shared
     shim execs for `-e`) at a stub that prints `18.0.0` → exit 1, output names Node 20. The
     shared shim itself is not changed.
   - The bookmark-last assertions (`651`, `730`) stay unchanged and must pass (S1.4).
   All other existing fixtures still pass.

### S2. Machine (`machine/`)

1. **Sessions and logins get the service's PATH.** A tmux server that was already running
   keeps its old global PATH (`machine/service.js:698-709`). So every tmux command the
   machine starts — session launches (`service.js:851-863`, `launchEnv` at `796-797`) and
   login commands (`1529-1533`) — puts `PATH=<process.env.PATH>` in its `env` prefix. Running
   sessions are untouched. `tmuxPath()`'s project-tools check uses `process.env.PATH` too.
2. **Recipes**, one module `machine/lib/harness-recipes.js`, keyed by provider. Each is a
   shell command run with `/bin/sh -c` as the service user, never with sudo:
   | provider | command |
   |---|---|
   | claude | script `https://claude.ai/install.sh` |
   | gpt | `npm install -g --prefix "$HOME/.local" @openai/codex@latest` |
   | gemini | script `https://antigravity.google/cli/install.sh` |
   | kimi | script `https://code.kimi.com/kimi-code/install.sh` |
   | openrouter | `npm install -g --prefix "$HOME/.local" <pi package>@latest` |
   A "script" recipe downloads first and runs only a complete download, so a failed download
   fails the install: `t=$(mktemp) && curl -fsSL <url> -o "$t" && bash "$t"; r=$?; rm -f "$t";
   exit $r`.
   Before committing, the worker confirms each URL answers (`curl -fsI <url>`), downloads each
   script (without running it) and reads where it puts the binary. A folder other than
   `$HOME/.local/bin` or `$HOME/.kimi-code/bin` is added to S1.3's PATH list (and the S2.7
   fixtures); if the folder cannot be told from the script, that provider ships `recipe:
   false`. The worker also picks the
   current, non-deprecated Pi package with `npm view <name> deprecated engines` for
   `@earendil-works/pi-coding-agent` and `@mariozechner/pi-coding-agent`. Each recipe carries a
   comment with its vendor docs URL. **A recipe whose URL or package cannot be confirmed is
   left out of the module**; such a provider has `recipe: false` (S2.6) and Settings shows a
   link to its vendor docs instead of Install (S4.2). Tests override recipes with the
   environment variable `WHEELCHAIR_HARNESS_RECIPES` (path to a JSON object provider →
   command); production never sets it.
3. **Node version for npm recipes.** An npm recipe also records the package's
   `engines.node` minimum (read by the worker from `npm view`, written as a constant beside
   the recipe). Before starting it, the machine compares `node --version`; if lower, the
   install does not run and ends `failed` with the tail `<Harness> needs Node <min> or newer;
   this machine has <version>. Update Node, then try again.`
4. **The install job** is one detached child process (its own process group, not tmux):
   `node machine/lib/harness-install.js <provider>`. It runs, in order, the Node check (S2.3),
   the recipe, the setup steps and validation (S2.5), all inside the job, so a service restart
   mid-install never skips them. Output from every step goes to
   `~/.wheelchair/installs/<provider>.log` (truncated at start); the job's pid is in
   `<provider>.pid`; when it ends it writes `<provider>.result`, JSON `{state:"succeeded"|"failed",
   exit_code, finished_at}`, then removes the pid file. Starting a job removes any old result.
5. **Setup and validation, inside the job, after the recipe exits 0:**
   - for `claude` or `gpt`: `python3 <clone>/install/unseen.py` with a present list of that
     one harness, as `install.sh:137-139` does; then the diagram dial block, keeping the
     current level: read it from the other harness's file with `WHEELCHAIR_PRESENT=<other>
     sensitivity/set.sh --json` (`<other>` is `codex` when installing claude, and vice
     versa; its `level`, or `default` when that is null or the command fails), then write only
     the new harness's file with `WHEELCHAIR_PRESENT=<installed> sensitivity/set.sh <level>`
     (`sensitivity/set.sh:16-19` seam), so the other harness's file never blocks the install.
     If this dial step itself fails (for example a non-empty Codex `AGENTS.override.md`), its
     output goes to the log as a warning and the install still counts as succeeded;
   - the CLI resolves the way `cliStatus` does (`service.js:1636-1650`) and, for claude, codex,
     agy and kimi, `<cli> --version` exits 0 (pi: resolve only).
   All pass → `succeeded`. Recipe non-zero → `failed` with its exit code. Recipe passed but the
   CLI is not found → `failed`, log ending `Installed, but wheelchair can't find <cli> on its
   path. Re-run ./install.sh from the wheelchair folder once.` (a machine installed before
   S1.3). A failing setup step → `failed` with that step's output.
6. **Routes** (hub auth, beside `GET /v1/status`, `service.js:1953`):
   - `POST /v1/harnesses/<provider>/install` → starts the job; 202 `{state:"running"}`.
     Unknown provider → 404. `recipe: false` → 404 `{error:"no recipe"}`. Running → 409
     `{error:"already installing"}`. GET works for every known provider, including
     `recipe: false` ones (they report `idle` unless a job ran).
   - `GET /v1/harnesses/<provider>/install` → `{state, exit_code, output_tail, started_at,
     finished_at}`; `state` is `idle | running | succeeded | failed`; `output_tail` is the last
     40 lines of the log. Running = the pid file names a live process (`process.kill(pid,
     0)`); otherwise the result file gives `succeeded`/`failed`; neither → `idle`. A pid file
     whose process is gone and no result file → `failed`, tail ending `The install stopped
     before finishing.` This needs no in-memory state, so it is the same after a service
     restart.
   - `GET /v1/status` adds `recipes: {<provider>: true|false}` for the five providers.
7. **Tests** in `machine/test/run.sh` using `WHEELCHAIR_HARNESS_RECIPES` with fake commands that
   drop a fake executable into a temp `$HOME/.local/bin`: success; non-zero exit; 409 on a
   second start; a service restart while a fake recipe is still running — the test kills the
   original service process (not only its listener, unlike `machine/test/service.test.js:243`)
   and starts a new one on the same state; the new one refuses a second start with 409; then
   the recipe exits 0 and the job still runs the (shimmed) setup step and validation and GET
   reports `succeeded`; unknown provider 404; a failed download in a script recipe →
   `failed`;
   not-found-after-install message; Node-too-old refusal; claude's setup step invoked; session launch and login commands carry `PATH=`.

### S3. Hub (`viewer/app/`)

1. **Setting.** New top-level `harnesses` in hub settings: `{claude, gpt, gemini, kimi,
   openrouter}` booleans, default all `true` (existing installs behave as before). Add it to
   `defaults()` and `normalize()` (`viewer/app/settings.js:37-39,205-241`): non-boolean or
   missing → `true`; unknown keys dropped. `describe()` (`settings.js:298-307`, `GET
   /settings`) adds `harnesses`.
2. **What the switch governs.** Off means no **new** session is placed on that provider.
   Roles that pick from an order (a new thread's lead, workers, reviewers, verifiers,
   mappers) simply skip it and use the next enabled provider. Only starts whose placement is
   pinned to the thread's own provider (`balancer.js:50`: a lead or sub-lead of a thread that
   already has a provider) wait, with the reason `<Harness> is left out in Settings`, when
   that provider is off. The wait carries that reason in the session's `waiting_reason`
   (`sessions.js:284`), and, for a lead, the thread's waiting line (`viewer/pages/thread.js:1300`) shows
   `<Harness> is left out in Settings. Turn it back on under Settings → Harnesses.` instead of
   the refill wording (the thread banner stays lead-only). For any waiting start,
   `wc.js session start` prints `waiting: <waiting_reason>` after its existing `waiting for
   room until …` line when the reason is the left-out one (`viewer/app/wc.js:184-188`), so a
   lead asking for a sub-lead on a switched-off harness learns why. Sessions already running keep running. Two dispatches continue an already-placed session and are
   not new placements, so the switch does not affect them: an aside fork of a live lead
   (`viewer/app/asides.js:34-46`) and a retry of an unanswered start
   (`viewer/app/sessions.js:232-241`). Turning the switch back on lets waiting starts proceed.
3. **Route** `PUT /settings/harnesses/<provider>` body `{enabled: boolean}` → saves through
   `updateSettings`, returns `describe()`. Unknown provider → 404; non-boolean → 400.
   Refused with 409 only when switching off would leave `lead_order`, expanded as the balancer
   does (`balancer.js:51`: `any` → `worker_order`), with no enabled provider; message: `Lead
   order would have no harness left. Add another to Lead order first.` The same check guards
   writes of `lead_order` and `worker_order` through the balancing route
   (`viewer/app/routes.js:253-255`): a write that leaves the expanded Lead order with no
   enabled provider → 409 with the same message.
4. **Placement.** In `viewer/app/balancer.js`, a provider whose switch is off is never
   eligible: drop it from the expanded order before the provider loop (`58-63`) and in the
   worker check (`48`). A harness whose executable is gone must not be placed even if its
   login remains: in the per-machine status fetch (`usage.js:49-77`, `machineAccounts`), an
   account whose CLI that machine reports not installed is recorded as signed out
   (`accounts[id] = false`). `signedIn`, `usage.rank`/`hasRoom` and the reservation all read
   that map, so one change covers placement, the worker check and the reservation. A review family whose harness is off counts as unavailable, so the
   existing fallback (`38-47`) applies. `usage.rank` gives such accounts the reason `skipped:
   left out in Settings`. `reservedProvider` (`balancer.js:23-26`) uses the same enabled
   order, so a switched-off provider is never the one saved for leads.
5. **Ready** (`viewer/app/ready.js`): when the thread's own provider is off, not ready with
   `<Harness> is left out in Settings`.
6. **Harness status** `GET /harnesses` → 
   ```
   { switches: {<provider>: bool},
     threads_using: {<provider>: <count of threads with a live session on it>},
     machines: [{ name, reachable,
       harnesses: {<provider>: { installed, version|null, signed_in, recipe }} }] }
   ```
   Built from the same cached per-machine `/v1/status` fetch as `usage.js:49-77` (extend that
   fetch to keep, per CLI, `installed`, `version`, and `recipes`; a machine whose status has no
   `recipes` field runs a service from before this feature, and every `recipe` there is
   `null`); `signed_in` is true when the
   machine reports a logged-in account for that provider that is an active account in hub
   settings (present in `accounts`, not retired) and not paused. A login row for a retired
   or unknown account does not count.
   An unreachable machine is `{name, reachable:false, harnesses:{}}`.
7. **Install forwarders** in `viewer/app/routes.js`, resolving the machine as the sign-in
   routes do (`412-421`): `POST` and `GET /machines/<machine>/harnesses/<provider>/install` →
   the machine's `/v1/harnesses/<provider>/install`, through `hub.client.passThrough`
   (`machine-client.js:96`) as the project-tools forwarder does (`routes.js:67-79`), so the
   machine's status (202, 404, 409) and body reach the page unchanged (`hub.call` drops the
   status). Unreachable → 502 with the
   machine name. `GET /harnesses?fresh=1` drops the status cache for all machines first
   (`cache.delete(hub)` in `usage.js`); the page asks for it after an install or sign-in ends
   (S4.3, S4.4). The hub keeps no per-install memory.
8. **Can agents start?** `/harnesses` adds
   ```
   can_start: { machine: "hub", lead: {ok, reason?}, worker: {ok, reason?} }
   ```
   `hub` is the machine a new thread starts on by default (`viewer/app/threads.js:63`). It is
   an alias: resolve it to its configured machine key exactly as `choose` does
   (`hub.state.resolveMachine`, `balancer.js:32-34`), since the installer registers the hub
   machine under its hostname (`install.sh:172`); every check below and `can_start.machine`
   use the resolved key and name. The hub decides each role in this order:
   1. `hub` unreachable → `ok: false`, `<machine> isn't reachable.`
   2. Its service version differs from the hub's (`outOfDate`, `viewer/app/ready.js:11-16`) →
      `ok: false`, `<machine> needs updating: re-run ./install.sh on it.`
   3. Otherwise it calls the real placement code, `balancer.choose(hub, {machine: "hub",
      sessions: []}, role, tier)` (`viewer/app/balancer.js:27`; it only reads), with tier
      `top` for `lead` and `standard` for `worker` (always within the Highest tier setting,
      which real worker starts check separately, `sessions.js:267-273`). A returned provider
      → `ok: true`. If `choose` throws, `ok: false` with its message.
   4. A wait → `ok: false`, with a plain reason:
      - when no provider in the order `choose` used (lead: the enabled, expanded Lead order;
        worker: the enabled Workers try first) is installed and signed in on `hub`: `New
        leads try <names>; none is installed and signed in on <machine>.` (workers: `New
        workers try …`). When some other enabled harness is installed and signed in there,
        add `Add <names> to <list> in Settings.`, where `<list>` is `Workers try first` for
        workers, and for leads `Workers try first` when Lead order contains `any` (one edit
        then fixes both) or `Leads try` when it does not;
      - otherwise: `No account has room for a new <lead|worker> right now (usage limits, or
        the share saved for leads).`
   `start` therefore means "placement would pick a harness", not a full start: checks that
   run only when a session really starts (such as the Codex preflight, `sessions.js:292`)
   still report their own errors in the thread. The hub never changes either order on its
   own; there is no button that does.
9. **Onboarding status** `GET /onboarding` → `{show, steps:[{id:"install", label:"Install an
   agent harness", done}, {id:"signin", label:"Sign in to it", done}, {id:"start",
   label:"Agents can start", done, reason?}]}`, from `GET /harnesses` data. `install` is done
   when some reachable machine has an enabled harness installed. `signin` is done when some
   reachable machine has a provider that is enabled, installed and `signed_in` on that same
   machine. `start` is done when `can_start.lead.ok` and `can_start.worker.ok`; when not done
   it carries the first failing reason. The first time all three are done, the hub saves a new
   boolean setting `onboarding_done: true`; from then on `/onboarding` answers `{show: false,
   steps: []}` at once, without building `/harnesses` data or calling `choose`, so the
   checklist never comes back and the home poll costs nothing. `defaults()` carries
   `onboarding_done: false` (a fresh install with no settings file); `normalize(saved)` always
   writes the key: a non-boolean or missing value in a saved file (an install from before this
   feature) becomes `true`. Because every write goes through `normalize` from `defaults()` or
   the saved file, a fresh user's first save keeps `false`. Otherwise `show` is true when some step is not done and at least one
   machine is reachable; false when none is.
10. **Tests** in `viewer/test/`: normalize defaults and bad values; `describe` includes
   `harnesses`; PUT 200/400/404 and the lead-order 409 (default `['claude','any']` with only
   claude off → 200); balancer never places a new session on a switched-off provider, falls
   back for a switched-off review family, and does not block an aside or an unanswered-start
   retry; Ready reason; a pinned lead waiting on a switched-off harness gets the left-out
   `waiting_reason`; `/harnesses` shape with one reachable and one unreachable machine;
   forwarders pass through and 502; `?fresh=1` clears the cache; `can_start` (Pi-only with default orders → lead and worker not ok, reasons name Pi and the
   order to add it to; after adding `openrouter` to `worker_order` → both ok; Lead order
   `['claude']` with Claude signed out and Codex signed in → lead not ok; a switched-off
   harness never makes it ok; no room → the no-room reason; Lead order with `any` → the lead
   reason points at Workers try first, without `any` at Leads try; `hub` unreachable or out of
   date → those reasons; worker probed at `standard` with Highest tier `standard` → ok); onboarding's
   `start` step and `onboarding_done` (set once; afterwards `/onboarding` does not call
   `choose`; a saved settings file without the key normalizes to `true`); balancer skips a provider whose CLI is not installed
   though its account is logged in; order writes refused when they empty the enabled Lead order;
   reservation skips a switched-off provider; onboarding for no CLI, installed-not-signed-in, installed on one machine
   with sign-in only on another (not done), a test registering the hub machine under a hostname key (as `install.sh:172` does) so
   `can_start` resolves the `hub` alias; and done.

### S4. Settings page (`viewer/pages/settings.js`)

1. New first section **Harnesses** (`SECTIONS`, `:8`), anchor `#harnesses`, data from `GET
   /harnesses`. A machine picker when more than one machine is known; the picked machine is
   kept in the page's state. An unreachable machine shows "Can't reach <machine>" instead of
   rows.
2. One row per harness, in display order: the name; its state on the picked machine: `Not
   installed`, `Installed <version>` (version omitted when null), or `Signed in`; a **Use**
   switch (shared by all machines); and an action:
   - `recipe: null` (old service) → the whole machine shows `This machine needs updating:
     re-run ./install.sh on it.` above the rows, and no row offers Install;
   - `recipe: false` and not installed → a link "Install from <vendor>'s site" to the docs URL
     kept in a page constant per provider. `recipe: false` only ever replaces Install and Try
     again (even after an earlier failed install); once the CLI is installed the rules below
     apply as for any harness;
   - not installed, or the last install on this machine `failed` → **Install** (or **Try
     again** after a failure);
   - installed, not signed in → **Sign in**;
   - installed and signed in → no action;
   - switch off → no action, whatever the state.
   Above the rows, when `can_start.lead.ok` or `can_start.worker.ok` is false, a notice
   `Agents can't start yet on <machine>:` with each failing reason and links to the lists it
   names: **Workers try first** → `#usage`; **Leads try** → `#models` (where the Lead order
   editor lives, `viewer/pages/settings.js:562,1454-1460`). Whenever the Harnesses section is
   shown again (hash navigation back to `#harnesses`) and after any order save on the page,
   it re-fetches `/harnesses?fresh=1`, so a fixed order clears the notice. The notice reflects
   the hub's default machine (`can_start.machine`) whichever machine is picked.
3. **Install state on load.** On page load, whenever the picked machine changes, and when a provider's switch is turned
   on (for that provider), the page
   GETs install state for each enabled provider on that machine. `running` → shows
   `Installing…` with the output tail (monospace, scrolls, fits a phone) and polls every 2 s;
   `failed` → `Install failed`, the tail, and **Try again**, even when the CLI is now on disk;
   `succeeded` → re-fetch `/harnesses?fresh=1`. Pressing Install POSTs, then polls the same way;
   a 409 just starts polling. If the POST or a poll fails with 502, a network error or no
   answer, the row shows `Can't reach <machine>, retrying…` and keeps polling GET every 2 s until it
   answers, then shows whatever state it reports, so a job that started or kept running
   during the outage is picked up without a reload. A POST answered 404 `no recipe` re-fetches
   `/harnesses?fresh=1`, so the row falls back to its vendor link; no install route 404 is
   read as an old service (that comes from `recipe: null`, S3.6). Likewise, while `/harnesses` reports the
   picked machine `reachable:false` (on opening Settings or on a refresh), the section shows
   `Can't reach <machine>, retrying…` and re-fetches `/harnesses?fresh=1` every 5 s; when it is
   reachable again the rows render and step 3's load-time install check runs.
4. **Sign in** uses the first account of that provider that is neither retired nor paused. It
   mounts the existing sign-in card (`viewer/pages/settings.js:1082-1140`) inline under that
   harness row, for the picked machine (not in the Accounts panel), and when the card closes
   re-fetches `GET /harnesses?fresh=1`. If every such account is paused, the row says `All
   <Harness> accounts are paused` with a link to `#accounts`. With no account, the row links
   to `#accounts` (where add and restore controls live).
5. **Switching off** a harness with `threads_using > 0` first asks "<N> threads use
   <Harness>. Their running agents keep going, but no new agent starts on it. Leave it out?"
   A 409 shows its message under the row.
6. **Switched-off harnesses are hidden elsewhere** on the page: their account rows and
   sign-in, their model cells, their option in the review-family picker (`598-603`), and their
   entries and add-options in the Workers try first and Lead order editors (`:1434`,
   `:1459`). Saved order values are not rewritten. They stay in the Harnesses list, switch off.

### S5. Home checklist (`viewer/pages/threads.js`, `threads.html`)

1. On load and on each existing 5 s poll, fetch `GET /onboarding`. When `show` is true, render a
   card at the top of the thread list titled "Set up an agent", its steps with a tick when
   done, the line "Leave out the ones you don't use.", and a button **Open Settings** to
   `settings#harnesses`. A not-done `start` step shows its reason under it. When `show` is false or the fetch fails, render nothing.
2. Browser tests (`npm --prefix viewer run test:browser`) with stubbed responses: the card
   shows and hides; the Harnesses section renders five rows, the vendor-link case, Install
   flow states (running on load, succeeded, failed with Try again), Sign in, the
   switch-off confirmation, the "can't start yet" notice and its reason, an installed
   `recipe: false` harness that is signed out shows Sign in,
   reopening Settings while the machine is unreachable and a job runs then the machine
   answering (row shows `Installing…`); switching a harness off hides its account row, review-family
   option and order-editor entries.

### Non-goals

Installing Node/tmux/git/gh/python3/curl/Tailscale; uninstalling or updating CLIs;
Windows; changing sign-in flows; changing adapter CLI resolution; Pi's version field.

### Validation commands

```bash
bash install/test/run.sh
bash machine/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Cancel a running install | Installs finish in a minute or two; waiting is fine | planning | Add `DELETE /v1/harnesses/<p>/install` killing the child's process group; Cancel button in S4 |
| D2 | Time limit for a stuck install | A hung recipe only blocks that one harness's button | planning | Kill after 15 min, state `failed` with "took too long" |
| D3 | Plain-language failure explanations | The raw output tail already shows what went wrong | planning | Map common failures (no network, disk full, npm prefix not writable) to one plain line above the tail |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A CLI removed from a machine less than 15 s before a new start can still be chosen once (status cache) | Removing a harness CLI is unusual, and the start then fails with the machine's existing missing-CLI error; rare path | review-round-5 |
| After a failed Settings install, an update removes that harness's recipe and the user installs it from the vendor site: the row may show Try again (→ vendor link) instead of Sign in | Needs a failed install, a recipe removed by an update, and a vendor install, in that order; sign-in is still reachable under Accounts; rare path | review-round-9 |
| An install that succeeds but could not write the diagram block (a non-empty Codex override) shows only in the install log | Needs a pre-existing non-empty override; only the diagram hint is missing; rare path | review-round-12 |
| A harness switched off after a failed install and switched back on in another tab may show Sign in instead of Try again until reload | Needs a failed install, a switch-off, and a stale tab; rare path | review-round-12 |
| The only signed-in worker harness has its Standard tier set to Not used, so the start step gives the no-room reason | Variant of the Lead-model-None risk: needs a deliberate Not used on the only harness; rare path | review-round-11 |
| The only signed-in harness has its Lead model set to None, so the checklist completes but no lead starts | Every provider ships default models (`codex/model.sh:33-38`); needs a deliberate None on the only harness; rare path | review-round-5 |

## Review Rounds

### Round 1 — 2026-11-20

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | "Lead model setting" doesn't exist; 409 blocks Codex-only users | upheld | S3.3 rewritten (Decision 11) |
| intent | major | Off harness still in Worker/Lead order editors | upheld | S4.6 |
| intent | minor | No warning when switching off a harness live threads use | upheld | S4.5, `threads_using` in S3.6 |
| intent | minor | Unconfirmed recipe still shipped | upheld | S2.2, S4.2 vendor link |
| mechanics | blocking | Old tmux server keeps stale PATH | upheld | S2.1 PATH in env prefix |
| mechanics | blocking | `neither` fixture contradicts S1.6 | upheld | S1.6 rewritten |
| mechanics | blocking | Pi npm needs newer Node than S1 checks | downgraded (major: worker would ask) | S2.3 per-recipe Node check |
| mechanics | blocking | Restart drops running-install exclusion | downgraded (major) | S2.4 pid file; D4 narrowed |
| mechanics | major | Lead rule undefined vs `lead_order`; pinned thread restarts | upheld | S3.2, S3.3 |
| mechanics | blocking | Pi-only setup can never place a lead | upheld | S3.7 append to worker_order; S3.8 |
| mechanics | blocking | Asides and unanswered-start retry bypass switch | downgraded (minor: continuation of placed sessions) | S3.2 states they continue |
| mechanics | blocking | Response fields for Harnesses screen undefined | upheld | S3.1 describe, S3.6 `/harnesses`, cache drop S3.7 |
| mechanics | major | Install and sign-in may be on different machines | upheld | S3.8 same machine |
| mechanics | major | Polling only after POST; failed-after-binary hides retry | upheld | S4.3 |
| mechanics | major | Sign-in link target undefined | upheld | S4.4 |

### Round 2 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 1:** S1.2, S1.6 (fixture); S2.1 (PATH in tmux env), S2.2–S2.4 (unconfirmed recipes left out, Node check, pid-file running state, `recipes` in status); S3.1–S3.3 (describe, switch governs new placements only, lead-order 409), S3.6 `/harnesses`, S3.7 cache drop and worker_order append, S3.8 same-machine onboarding; S4 (load-time install state, Sign in, switch-off confirm, order editors hidden); Decisions 11–14.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Worker-order append only fires on a watched Settings install | upheld | S3.8 (Decision 15) |
| intent | minor | Append silently adds pay-per-token OpenRouter | upheld | S3.8 only when Lead order reaches nothing installed; row note S4.2 |
| mechanics | blocking | S1.6 contradicts several existing fixtures | upheld | S1.6 lists each change; S1.4 Next line before the URL |
| mechanics | blocking | Setup steps lost if the service restarts mid-install | upheld | S2.4–S2.6 job runs everything, result file (Decision 16) |
| mechanics | blocking | Pi-only placement depends on a browser seeing success | upheld | S3.8 |
| mechanics | blocking | Balancing route can empty the enabled Lead order | downgraded (major) | S3.3 guard on order writes |
| mechanics | major | curl pipe hides download failure | upheld | S2.2 download then run |
| mechanics | major | Sign-in card mount and refresh undefined | upheld | S4.4 |
| mechanics | major | Paused-only accounts; Antigravity restore | upheld | S4.4 |
| mechanics | major | Restart test doesn't prove setup still runs | upheld | S2.7 tests |
| mechanics | minor | Lead reservation ignores the switch | upheld | S3.4 |

### Round 3 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 2:** S1.4 (Next line before the URL), S1.6 (each fixture change listed); S2.2 (script recipes download then run), S2.4–S2.7 (install job runs Node check, recipe, setup and validation; result file; restart semantics; tests); S3.3 (guard on order writes), S3.4 (reservation), S3.7–S3.8 (`?fresh=1`; worker-order append only when Lead order reaches nothing installed, at most once, `worker_order_auto_added`); S4.2 (auto-added note), S4.4 (Sign in inline, paused and no-account cases); Deferred D4 folded into the Spec; Decisions 15–16.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Per-start cache-drop memory is leftover | upheld | S3.7 `?fresh=1` only |
| intent | minor | Order write as a side effect of reads | upheld | Removed with the append (Decision 17) |
| mechanics | blocking | S1.6 would replace the existing `node` shim | upheld | S1.6 keeps `install_shims` shims |
| mechanics | blocking | Append doesn't help a Lead order without `any` | upheld | S3.8 explicit Add to Lead order (Decision 17) |
| mechanics | blocking | Append depends on a page request | upheld | Removed with the append |
| mechanics | blocking | Settings draft can undo the append | upheld | Removed with the append; page reloads settings after Add |
| mechanics | major | Placement ignores whether the CLI is installed | upheld | S3.4 |
| mechanics | major | Restart test may not kill the service | upheld | S2.7 |
| mechanics | major | Page doesn't recover from a machine blip during install | upheld | S4.3 |

### Round 4 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 3:** S1.6 (keep existing `install_shims` shims, incl. `node`); S2.7 (restart test kills the service process); S3.4 (signed in requires CLI installed); S3.7 (`?fresh=1` only, no per-install memory); S3.8 replaced: no automatic order changes, `in_lead_order` and `POST /settings/lead-order/add`; S3.9 optional `lead` step; S3.10 tests; S4.2 Add to Lead order; S4.3 recovery from unreachable machine; S5.1 lead-step button; Decisions 17–18.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Add to Lead order alone leaves workers and reviewers waiting on Pi-only | upheld | S3.8 "Let agents use" adds to Workers try first (Decision 19) |
| intent | minor | Decision Log out of order | upheld | Sorted; superseded rows marked |
| mechanics | blocking | Pi-only finishes setup but workers never place | upheld | Same fix as above; test places a worker |
| mechanics | blocking | Installed check misses `usage.rank` path | upheld | S3.4 applied in `machineAccounts` |
| mechanics | major | Stale order draft undoes the addition | upheld (same page); other-tab case accepted-risk (rare path) | S4.2 re-initialises drafts |
| mechanics | major | Machine-level outage hides rows during install | upheld | S4.3 retry `/harnesses?fresh=1` |

### Round 5 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 4:** Decision Log sorted; S3.4 (installed check moved into `machineAccounts`); S3.8 replaced by "Let agents use" (`usable`, `POST /settings/harnesses/<p>/use`, adds to Workers try first and, without `any`, Lead order); S3.9 `use` step; S3.10 tests incl. worker placement; S4.2 drafts re-initialised; S4.3 machine-level retry; S5 button and tests; Accepted Risks row; Decision 19.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | `usable` flags normal setups and would change a deliberate Lead order | upheld | S3.8, S4.2 (Decision 20) |
| intent | minor | Decisions 17–18 wording says "Add to Lead order" | declined | Marked refined by 19 and 20; record is accurate |
| mechanics | blocking | Removed CLI still chosen within the 15 s cache | accepted-risk | Rare path (Accepted Risks) |
| mechanics | blocking | Only harness with Lead model None | accepted-risk | Rare path: defaults set every model (Accepted Risks) |
| mechanics | blocking | Resetting drafts discards pending edits | upheld | S4.2 merges into drafts |
| mechanics | major | `hub.call` drops the machine's status | upheld | S3.7 uses `passThrough` |
| mechanics | major | Older service's 404 loops as an outage | downgraded (minor) | S4.3 404 → "needs updating" |

### Round 6 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 5:** S3.7 (forwarders via `passThrough`); S3.8 (`in_worker_order`, `lead_reachable`, narrower `use` route); S3.9 `use` step condition; S3.10 tests; S4.2 row button condition and draft merge; S4.3 404 handling; two Accepted Risks; Decision 20.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Row flags Pi by default, though OpenRouter is left out of the rotation on purpose | user-decision | Collin chose "Check and point" (Decision 21); the button is gone |
| intent | minor | Settings and checklist disagree when Lead order reaches nothing | user-decision | Collin chose "Check and point" (Decision 21); the button is gone |
| intent | minor | 404 means too many things; old service detection | upheld | S2.6, S3.6 `recipe: null`, S4.2–S4.3 |
| mechanics | blocking | Checklist button may target a harness that repairs nothing | user-decision | Collin chose "Check and point" (Decision 21); the button is gone |
| mechanics | blocking | Switched-off harness satisfies the worker test | user-decision | Collin chose "Check and point" (Decision 21); the button is gone |
| mechanics | major | Draft merge breaks `any` being last | upheld | S4.2 insert before `any` |
| mechanics | major | Hub-wide check vs the machine a thread starts on | user-decision | Collin chose "Check and point" (Decision 21); the button is gone |
| mechanics | major | Removed recipe → POST 404 misread as old service | upheld | S4.3 `no recipe` → vendor link |
| mechanics | minor | `use` response drops `reserved_provider` | upheld | S4.2 re-fetch settings |

### Round 7 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 6:** S2.6 (`no recipe` 404; GET for every provider); S3.6 (`recipe: null` for an old service); S3.8 replaced by `can_start` from `balancer.choose`; S3.9 `start` step and `onboarding_done`; S3.10 tests; S4.2 (old-service notice, no row action for signed-in, "can't start yet" notice); S4.3 (`no recipe` → vendor link); S5 (reason under `start`); Accepted Risks row for the second tab removed; Decision 21.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Lead reason sends Pi-only users to make two edits | upheld | S3.8 points at Workers try first when Lead order has `any` |
| intent | minor | `/onboarding` keeps calling `choose` forever | upheld | S3.9 short-circuit |
| intent | minor | Wrong reason for reserve holds or unreachable `hub` | upheld | S3.8 steps 1 and 4 |
| intent | minor | Upgraders see the checklist over a working setup | upheld | S3.9 old settings → `true` |
| mechanics | blocking | Probe passes while `hub` runs an older service | downgraded (major) | S3.8 step 2 |
| mechanics | blocking | Worker probe at `top` vs Highest tier | downgraded (minor) | S3.8 worker at `standard` |
| mechanics | blocking | Lead order lives in Models, not Usage | upheld (major) | S4.2 links per list |
| mechanics | blocking | "Usage limit" reason wrong for the lead reserve | downgraded (major) | S3.8 no-room reason |
| mechanics | major | Removed recipe vs failed result | downgraded (minor) | S4.2 `recipe: false` wins |
| mechanics | minor | No refresh after fixing the order | upheld | S4.2 re-fetch on return and save |

### Round 8 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 7:** S3.8 rewritten (unreachable and out-of-date checks, worker probed at `standard`, reasons point at the right list, no-room reason); S3.9 (`/onboarding` short-circuits once done; old settings files → `onboarding_done: true`); S3.10 tests; S4.2 (`recipe: false` wins; links to Workers try first in Usage and Leads try in Models; re-fetch on return and after order saves).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Fresh install's first save could drop `onboarding_done` and retire the checklist | upheld | S3.9 `defaults()` carries `false` |
| mechanics | blocking | `hub` alias not resolved to the hostname key | upheld | S3.8 resolve as `choose` does; test |
| mechanics | blocking | Placement can pass while Codex preflight later fails | downgraded (minor) | S3.8 states `start` is placement eligibility; start-time checks report in the thread |
| mechanics | blocking | `recipe: false` hides Sign in after a vendor install | upheld | S4.2 recipe only replaces Install/Try again; test |

### Round 9 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 8:** S3.8 (`hub` alias resolved; `start` means placement eligibility); S3.9 (`onboarding_done` in `defaults()`); S3.10 hostname-key test; S4.2 (`recipe: false` only replaces Install/Try again); S5.2 test.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Decisions 7 and 10 not marked refined | upheld | Marked refined by 21 |
| mechanics | blocking | Saved failure vs Sign in for a `recipe: false` vendor install | accepted-risk | Rare path (Accepted Risks) |
| mechanics | major | Switch-off wait could be read as blocking every role | upheld | S3.2 scoped to pinned lead/sub-lead starts |

### Round 10 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 9:** S3.2 (switch-off wait scoped to pinned lead/sub-lead starts); Decisions 7 and 10 marked refined; one Accepted Risks row. Budget reset by Collin's "Keep going".

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Script recipes' install folder never checked (Antigravity) | upheld | S2.2 worker reads each script's folder; add to PATH or `recipe: false` |
| intent | minor | Two wording slips | upheld | Fixed |
| mechanics | major | Thread banner shows refill wording for a left-out harness | upheld | S3.2 `waiting_reason` and waiting line |
| mechanics | major | Sensitivity writer scope during install | upheld | S2.5 read level from the other file, write only the new one |
| mechanics | minor | README macOS steps still require a CLI first | upheld | S1.5 |

### Round 11 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 10:** S1.5 (README macOS steps); S2.2 (worker checks each script's install folder); S2.5 (dial level kept, only the new harness's file written); S3.2 (left-out reason shown on the thread's waiting line); S3.10 test; S4.2 (switch-off line moved into the action list); S5.2 wording.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | major | Codex override vs dial step when installing Codex | downgraded (minor) | S2.5 dial failure is a logged warning |
| mechanics | major | Sub-lead wait reason not on the thread banner | downgraded (minor: banner shows leads only today) | S3.2 scoped to the lead |
| mechanics | major | Node older than 20 passes the prerequisite check | upheld | S1.1 Node ≥ 20 |
| mechanics | major | Only worker harness with Standard set to Not used | accepted-risk | Rare path (Accepted Risks) |

### Round 12 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 11:** S1.1 (Node 20 or newer) and S1.6 fixture; S2.5 (dial failure is a warning); S3.2 (waiting-line wording for leads only); one Accepted Risks row.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Node version read conflicts with the fixture shim | upheld | S1.1 reads via `node -e`; S1.6 Node 18 case via `WHEELCHAIR_REAL_NODE` |
| intent | minor | Node 20 reason names the wrong user | upheld | S1.1 |
| mechanics | blocking | Same shim conflict | upheld | As above |
| mechanics | major | Sub-lead's left-out reason never reaches the lead | upheld | S3.2 `wc.js` prints the reason |
| mechanics | major | `signed_in` counts retired accounts | downgraded (minor) | S3.6 active accounts only |
| mechanics | major | Enabling a harness doesn't load its install state | downgraded (minor) | S4.3 loads on switch-on |
| mechanics | minor | Dial warning invisible after success | accepted-risk | Rare path (Accepted Risks) |

### Round 13 — 2026-11-21

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 12:** S1.1 (Node read via `node -e`, reason) and S1.6 Node 18 case; S3.2 (`wc.js` prints the left-out reason); S3.6 (`signed_in` counts active accounts only); S4.3 (load install state on switch-on); two Accepted Risks rows; Decision 22.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
