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
| 7 | First run: a setup checklist on the home page linking into Settings, gone once one harness is installed and signed in | Guides without duplicating Settings | user |
| 8 | Decision 3 is met by always putting `~/.local/bin` and `~/.kimi-code/bin` on the service PATH, where every recipe lands; no adapter resolver changes | Avoids touching the OpenRouter thread's lines; PATH lookup is per call | defaulted |
| 9 | Turning off the harness the lead model runs on is refused until another lead model is picked | Otherwise every new thread would be stuck | defaulted |
| 10 | Checklist has two steps (install, sign in); no "choose" step | Choosing is optional: all harnesses default on | defaulted |
| 15 | Supersedes 13: a harness is added to Workers try first only when nothing in Lead order is installed, at most once, however it was installed | Review round 2: Settings-only trigger missed terminal and vendor-link installs; avoid silently adding pay-per-token OpenRouter for users who already have a working lead | review-round-2 |
| 17 | Supersedes 13 and 15: the hub never changes Lead or Worker order on its own. A harness that is signed in but not reachable from Lead order shows "Add to Lead order" in Settings and as a checklist step | Review round 3: the automatic append raced Settings drafts, missed a Lead order without `any`, and depended on a page being open; an explicit button avoids all three | review-round-3 |
| 18 | Keep the one-tap "Add to Lead order" button (over a plain link, or leaving Pi out) | Collin picked it after the review budget stopped | user |
| 16 | Install result survives a service restart (job writes a result file); was Deferred D4 | Review round 2: setup steps must run inside the job, which makes the result file free | review-round-2 |
| 11 | Supersedes 9: switching a harness off is refused only when Lead order (with `any` expanded) would have no enabled harness | Review round 1: the "lead model setting" does not exist; the old rule blocked Codex-only users from leaving Claude out | review-round-1 |
| 12 | The switch stops new placements only; running agents, asides and retries of an unanswered start continue | Review round 1 | review-round-1 |
| 13 | A successful install from Settings adds that harness to Workers try first if missing | Review round 1: default orders exclude OpenRouter, so a Pi-only user would wait forever | review-round-1 |
| 14 | A recipe that can't be confirmed at build time ships as a vendor-docs link, not an Install button | Review round 1 | review-round-1 |

## Spec

Validation and the bar: a fresh agent implements from this section alone. Provider keys
are the hub's (`claude`, `gpt`, `gemini`, `kimi`, `openrouter`); CLIs are `claude`, `codex`,
`agy`, `kimi`, `pi` (`viewer/app/providers.js:3`). Display names: Claude Code, Codex,
Antigravity, Kimi Code, Pi (OpenRouter).

### S1. Installer (`install.sh`, `install/test/run.sh`, `README.md`)

1. **Prerequisite check, first thing after the clone guard.** Check `node`, `npm`, `tmux`,
   `git`, `gh`, `python3`, `curl` with `command -v`. If any is missing, print one line per
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
   installable from Settings → Harnesses; drop "at least one CLI required".
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
     written.
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
   Before committing, the worker confirms each URL answers (`curl -fsI <url>`) and picks the
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
     one harness, as `install.sh:137-139` does, then `sensitivity/set.sh`;
   - the CLI resolves the way `cliStatus` does (`service.js:1636-1650`) and, for claude, codex,
     agy and kimi, `<cli> --version` exits 0 (pi: resolve only).
   All pass → `succeeded`. Recipe non-zero → `failed` with its exit code. Recipe passed but the
   CLI is not found → `failed`, log ending `Installed, but wheelchair can't find <cli> on its
   path. Re-run ./install.sh from the wheelchair folder once.` (a machine installed before
   S1.3). A failing setup step → `failed` with that step's output.
6. **Routes** (hub auth, beside `GET /v1/status`, `service.js:1953`):
   - `POST /v1/harnesses/<provider>/install` → starts the job; 202 `{state:"running"}`.
     Unknown provider or `recipe: false` → 404. Running → 409 `{error:"already installing"}`.
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
2. **What the switch governs.** Off means no **new** session is placed on that provider:
   balancer placement for every role, including a thread's lead restart, waits with the
   reason `<Harness> is left out in Settings` when the thread is pinned to it. Sessions
   already running keep running. Two dispatches continue an already-placed session and are
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
   worker check (`48`). A provider also counts as signed in on a machine only when that
   machine reports its CLI installed (from the `installed` kept in S3.6's status fetch), so
   `signedIn` (`balancer.js:19-22`) and everything built on it — placement, the worker check
   and the reservation — skip a harness whose executable is gone even if its login remains. A review family whose harness is off counts as unavailable, so the
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
   fetch to keep, per CLI, `installed`, `version`, and `recipes`); `signed_in` is true when the
   machine reports a logged-in account for that provider that is not paused in hub settings.
   An unreachable machine is `{name, reachable:false, harnesses:{}}`.
7. **Install forwarders** in `viewer/app/routes.js`, following the sign-in pattern
   (`412-421`): `POST` and `GET /machines/<machine>/harnesses/<provider>/install` →
   `hub.call(machine, '/v1/harnesses/<provider>/install', method)`. Unreachable → 502 with the
   machine name. `GET /harnesses?fresh=1` drops the status cache for all machines first
   (`cache.delete(hub)` in `usage.js`); the page asks for it after an install or sign-in ends
   (S4.3, S4.4). The hub keeps no per-install memory.
8. **Reaching a harness from Lead order.** `/harnesses` reports, per provider, `in_lead_order`:
   true when the provider is in `lead_order` expanded as the balancer does (`any` →
   `worker_order`). New route `POST /settings/lead-order/add` body `{provider}` → appends the
   provider to `lead_order`, before `any` when present, else at the end, unless already
   reachable; returns `describe()`. Unknown provider → 404. The hub never changes either order
   on its own.
9. **Onboarding status** `GET /onboarding` → `{show, steps:[{id:"install", label:"Install an
   agent harness", done}, {id:"signin", label:"Sign in to it", done}]}`, from `GET
   /harnesses` data. `install` is done when some reachable machine has an enabled harness
   installed. `signin` is done when some reachable machine has a provider that is enabled,
   installed and `signed_in` on that same machine. A third step `{id:"lead", label:"Let agents
   start on it", done}` is included only when `signin` is done for some provider but no such
   provider is `in_lead_order`; it is done otherwise. Each step not done carries `provider`
   (the first matching one, display order) so the card can act.
   `show` is true when not every included step is done and at least one machine is reachable; false when
   none is reachable.
10. **Tests** in `viewer/test/`: normalize defaults and bad values; `describe` includes
   `harnesses`; PUT 200/400/404 and the lead-order 409 (default `['claude','any']` with only
   claude off → 200); balancer never places a new session on a switched-off provider, falls
   back for a switched-off review family, and does not block an aside or an unanswered-start
   retry; Ready reason; `/harnesses` shape with one reachable and one unreachable machine;
   forwarders pass through and 502; `?fresh=1` clears the cache; `lead-order/add` (with and
   without `any`, already reachable, unknown); onboarding's `lead` step for Pi-only with default
   orders and with saved `['claude']`; balancer skips a provider whose CLI is not installed
   though its account is logged in; order writes refused when they empty the enabled Lead order;
   reservation skips a switched-off provider; onboarding for no CLI, installed-not-signed-in, installed on one machine
   with sign-in only on another (not done), and done.

### S4. Settings page (`viewer/pages/settings.js`)

1. New first section **Harnesses** (`SECTIONS`, `:8`), anchor `#harnesses`, data from `GET
   /harnesses`. A machine picker when more than one machine is known; the picked machine is
   kept in the page's state. An unreachable machine shows "Can't reach <machine>" instead of
   rows.
2. One row per harness, in display order: the name; its state on the picked machine: `Not
   installed`, `Installed <version>` (version omitted when null), or `Signed in`; a **Use**
   switch (shared by all machines); and an action:
   - `recipe: false` and not installed → a link "Install from <vendor>'s site" to the docs URL
     kept in a page constant per provider;
   - not installed, or the last install on this machine `failed` → **Install** (or **Try
     again** after a failure);
   - installed, not signed in → **Sign in**;
   - installed, signed in, not `in_lead_order` → the note `Agents won't start on this yet.`
     and **Add to Lead order** (`POST /settings/lead-order/add`; then the page reloads its
     settings state, so the Lead and Worker order editors show the saved order).
   No action when the switch is off.
3. **Install state on load.** On page load and whenever the picked machine changes, the page
   GETs install state for each enabled provider on that machine. `running` → shows
   `Installing…` with the output tail (monospace, scrolls, fits a phone) and polls every 2 s;
   `failed` → `Install failed`, the tail, and **Try again**, even when the CLI is now on disk;
   `succeeded` → re-fetch `/harnesses?fresh=1`. Pressing Install POSTs, then polls the same way;
   a 409 just starts polling. If the POST or a poll fails (502, network error, no answer), the
   row shows `Can't reach <machine>, retrying…` and keeps polling GET every 2 s until it
   answers, then shows whatever state it reports, so a job that started or kept running
   during the outage is picked up without a reload.
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
   `settings#harnesses`. When the `lead` step is shown and not done, it has its own **Add
   <Harness> to Lead order** button (the S3.8 route), after which the card refetches. When `show` is false or the fetch fails, render nothing.
2. Browser tests (`npm --prefix viewer run test:browser`) with stubbed responses: the card
   shows and hides; the Harnesses section renders five rows, the vendor-link case, Install
   flow states (running on load, succeeded, failed with Try again), Sign in, the
   switch-off confirmation, Add to Lead order; switching a harness off hides its account row, review-family
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

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
