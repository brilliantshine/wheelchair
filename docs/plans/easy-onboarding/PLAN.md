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

## Spec

Validation and the bar: a fresh agent implements from this section alone. Provider keys
are the hub's (`claude`, `gpt`, `gemini`, `kimi`, `openrouter`); CLIs are `claude`, `codex`,
`agy`, `kimi`, `pi` (`viewer/app/providers.js:3`).

### S1. Installer (`install.sh`, `install/test/run.sh`, `README.md`)

1. **Prerequisite check, first thing after the clone guard.** Check `node`, `npm`, `tmux`,
   `git`, `gh`, `python3`, `curl` with `command -v`. If any is missing, print one line per
   missing tool with how to get it (macOS: `brew install <pkg>`; Linux: "install <pkg> with
   your package manager", plus `https://cli.github.com` for gh), print nothing else, and exit 1
   before writing anything. Tailscale stays checked only when serving, as today.
2. **No agent CLI is no longer fatal.** Remove the exit at `install.sh:53-57`. When none of the
   five is found, print `No agent CLI yet. After install, open the app: its setup checklist
   installs them from Settings.` and continue. Per-harness steps stay gated as now
   (`install.sh:106-114,137-139`). `codex/model.sh init` (`116-121`) runs unconditionally.
3. **Service PATH always includes the user install dirs.** In the PATH built at `373-390`, after
   the found-binary dirs, append `$HOME/.local/bin` and `$HOME/.kimi-code/bin` when not already
   present, whether or not they exist yet. Both the systemd unit (`414`) and the launchd plist
   (`347`) get it. Because sessions inherit the tmux server's PATH from the service
   (`machine/service.js:851-857`), a CLI placed in either dir later is found by `command -v`
   with no reinstall. No adapter resolver changes (`machine/adapters/pi.js:16`,
   `kimi.js:8-12` stay as they are).
4. **End message** when serving: after the existing URL output, print `Next: open that link;
   the home page walks you through installing and signing in to an agent.`
5. **README**: the first-time path becomes: install the basic tools, run `./install.sh --serve`,
   open the link, follow the checklist. Dependencies lists all five harnesses as optional,
   installable from Settings → Harnesses; drop "at least one CLI required".
6. **Fixtures** in `install/test/run.sh`: (a) no CLI on PATH → exit 0, prints the "No agent
   CLI yet" line, service unit PATH contains `$HOME/.local/bin` and `$HOME/.kimi-code/bin`;
   (b) one prerequisite shimmed absent (e.g. `tmux`) → exit 1, output names `tmux`, no state
   files written; (c) existing fixtures still pass.

### S2. Machine: installing a harness (`machine/`)

1. **Recipes**, one module `machine/lib/harness-recipes.js`, keyed by provider. Each is a
   shell command run with `/bin/sh -c` as the service user, never with sudo:
   | provider | command |
   |---|---|
   | claude | `curl -fsSL https://claude.ai/install.sh \| bash` |
   | gpt | `npm install -g --prefix "$HOME/.local" @openai/codex@latest` |
   | gemini | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` |
   | kimi | `curl -fsSL https://code.kimi.com/kimi-code/install.sh \| bash` |
   | openrouter | `npm install -g --prefix "$HOME/.local" <pi package>@latest` |
   Before committing, the worker confirms each URL answers (`curl -fsI <url>`) and picks the
   current, non-deprecated Pi package with `npm view @earendil-works/pi-coding-agent` and
   `npm view @mariozechner/pi-coding-agent` (use the one not marked deprecated); each recipe
   carries a comment with its vendor docs URL. A recipe whose URL fails that check is still
   written, and the worker notes it in its report. Tests may override recipes with the
   environment variable `WHEELCHAIR_HARNESS_RECIPES` (path to a JSON object provider →
   command); production never sets it.
2. **Routes** (hub auth, beside `GET /v1/status`, `service.js:1953`):
   - `POST /v1/harnesses/<provider>/install` → starts the recipe in a detached child process
     (not tmux), output to `~/.wheelchair/installs/<provider>.log` (truncated at start).
     Returns 202 `{state:"running"}`. Unknown provider → 404. Already running → 409
     `{error:"already installing"}`.
   - `GET /v1/harnesses/<provider>/install` → `{state, exit_code, output_tail, started_at,
     finished_at}`; `state` is `idle | running | succeeded | failed`; `output_tail` is the
     last 40 lines of the log, as text. State lives in memory; after a service restart it is
     `idle`.
3. **After the recipe exits 0**, the machine:
   - for `claude` or `gpt`: runs `python3 <clone>/install/unseen.py` with a present list of
     that one harness, as `install.sh:137-139` does, then `sensitivity/set.sh` (writes the
     dial block into the newly present `CLAUDE.md` / `AGENTS.md`);
   - confirms the CLI resolves the way `cliStatus` does (`service.js:1636-1650`) and that
     `<cli> --version` exits 0.
   All pass → `succeeded`. The recipe exits non-zero → `failed` with its exit code. The
   recipe passed but the CLI is not found → `failed`, and the tail ends with
   `Installed, but wheelchair can't find <cli> on its path. Re-run ./install.sh from the
   wheelchair folder once.` (covers a machine installed before S1.3). A failing setup step
   → `failed`, with that step's output in the tail.
4. **Tests** in `machine/test/run.sh` using `WHEELCHAIR_HARNESS_RECIPES` with fake commands
   that drop a fake executable into a temp `$HOME/.local/bin`: success path; non-zero exit;
   409 on a second start; unknown provider 404; not-found-after-install message; for
   `claude` the setup step is invoked (shimmed).

### S3. Hub: the harness switch (`viewer/app/`)

1. **Setting.** New top-level `harnesses` in hub settings: `{claude, gpt, gemini, kimi,
   openrouter}` booleans, default all `true` (so existing installs behave as before). Add it
   to `defaults()` and `normalize()` (`viewer/app/settings.js:37-39,205-241`): non-boolean or
   missing → `true`; unknown keys dropped.
2. **Route** `PUT /settings/harnesses/<provider>` body `{enabled: boolean}` → saves through
   `updateSettings`, returns the new settings. Unknown provider → 404; non-boolean → 400.
   Turning off the provider that the lead model setting runs on → 409 `{error:"The lead runs on
   <Harness>. Pick another lead model first."}`.
3. **Placement.** In `viewer/app/balancer.js`, a provider whose switch is off is never
   eligible: skip it in the provider loop (`58-63`), and in the worker check (`48`). A review
   family whose harness is off counts as unavailable, so the existing fallback (`38-47`)
   applies. `usage.rank` gives such accounts the reason `skipped: left out in Settings`.
4. **Ready** (`viewer/app/ready.js`): when the thread's own provider is off, not ready with
   `<Harness> is left out in Settings`.
5. **Install forwarders** in `viewer/app/routes.js`, following the sign-in pattern
   (`412-421`): `POST` and `GET /machines/<machine>/harnesses/<provider>/install` →
   `hub.call(machine, '/v1/harnesses/<provider>/install', method)`. Machine unreachable →
   502 with the machine name.
6. **Onboarding status** `GET /onboarding` → `{show, steps:[{id:"install", label:"Install
   an agent harness", done}, {id:"signin", label:"Sign in to it", done}]}`. `install` is done
   when any machine reports an enabled harness installed (from the same per-machine
   `/v1/status` data `usage.js:49-72` gathers); `signin` when any enabled harness has a
   signed-in, non-paused account. `show` is true when not both done and at least one machine
   answered; false when no machine answered (no nagging on a blip).
7. **Tests** in `viewer/test/`: normalize defaults and bad values; PUT 200/400/404/409; the
   balancer never places on a switched-off provider and falls back for a switched-off review
   family; Ready reason; forwarders pass through and 502; onboarding steps for no-CLI,
   installed-not-signed-in, and done.

### S4. Settings page (`viewer/pages/settings.js`)

1. New first section **Harnesses** (`SECTIONS`, `:8`), anchor `#harnesses`. A machine picker
   (as the sign-in flow uses) when more than one machine is known.
2. One row per harness, in the order Claude Code, Codex, Antigravity, Kimi Code, Pi
   (OpenRouter): the name; its state on the picked machine: `Not installed`, `Installed
   <version>`, or `Signed in` (from `/usage`'s machine status); a **Use** switch (the hub
   setting, shared by all machines); and, when not installed and the switch is on, an
   **Install** button.
3. Install: press → POST; the row shows `Installing…` and the output tail (monospace, scrolls,
   phone-width), polled every 2 s; on `succeeded` the row refreshes to installed and shows a
   **Sign in** link to that harness's account row; on `failed`, `Install failed` with the tail
   and the button back as **Try again**. A 409 from the switch shows its message under the row.
4. **Switched-off harnesses** are hidden elsewhere on the page: their account rows and
   sign-in, their model cells, and their option in the review-family picker (`598-603`).
   They stay in the Harnesses list, switch off, so they can be turned back on.

### S5. Home checklist (`viewer/pages/threads.js`, `threads.html`)

1. On load and on each existing 5 s poll, fetch `GET /onboarding`. When `show` is true,
   render a card at the top of the thread list titled "Set up an agent", the two steps with a
   tick when done, the line "Leave out the ones you don't use.", and a button **Open
   Settings** to `settings#harnesses`. When `show` is false, render nothing. A failed fetch
   renders nothing.
2. Browser test (`npm --prefix viewer run test:browser`): with a stubbed `/onboarding`, the
   card shows with steps and the link, and is gone when `show` is false; the Settings
   Harnesses section renders the five rows, the Install flow states (running, succeeded,
   failed) from stubbed responses, and switching a harness off hides its account row and
   review-family option.

### Non-goals

Installing Node/tmux/git/gh/python3/curl/Tailscale; uninstalling or updating CLIs;
Windows; changing sign-in flows; changing adapter CLI resolution.

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
| D4 | Install state survives a machine service restart | After restart the row shows installed or not from status; only the log view is lost | planning | Persist state next to `~/.wheelchair/installs/<p>.log` |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-20

**Lanes:** intent (claude preferred); mechanics (other family); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
