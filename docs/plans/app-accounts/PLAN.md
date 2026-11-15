---
slug: app-accounts
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Accounts, usage and balancing

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | MAP.md | A fresh login folder lacks the user's CLAUDE.md/AGENTS.md, trust records and may show first-run screens that break the ready test | no | Settled in Spec: folder seeded with links; the service already answers Claude's trust prompt (`service.js:340-353`); first-run screens are a validation step |
| W2 | MAP.md | Style preview, Codex preflight and `model.sh` cache all read the service's own login | no | D11 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Defaults: within a provider, soonest refill first; notify below 25% once per provider per week; leave 10% per account; Claude margin 5% | The proposal's own numbers | defaulted |
| D2 | Build several accounts, usage and balancing for Claude and Codex only. Google, OpenRouter and pay-as-you-go keys move to Not doing; the adapter is shaped so each new CLI is one later thread | Gemini CLI no longer serves Google subscriptions; a third CLI touches ~40 places; most value is on the two CLIs in use | idea-change |
| D3 | The hub picks provider and account for every session. Agents ask for role and tier only; a reviewer or verifier may ask for "not the same provider as <session or provider>", which the hub honours. `--cli` stops being a choice | Provider order, Save Claude for leads and the margin only hold if agents can't route around them | user |
| D4 | Leads and sub-leads run on Claude (the Claude lead model) while any Claude account has room; when none has, on GPT's lead model instead of waiting. The Leads panel keeps both models; the thread CLI picker goes away | Never stall a new thread; Claude stays the first choice | user |
| D5 | The hub owns the account list (id, provider, name, plan, nodes). Each account's login folder is at a fixed path on every machine, `~/.wheelchair/accounts/<id>/`, sent in the start request; each machine service reports per-account login state in `/v1/status`. Today's default login becomes an account called "default" pointing at the CLI's usual folder, so nothing changes until a second account is added | Settings already live on the hub; a fixed path makes the folder a node fact without a per-node list | defaulted |
| D6 | Supersedes D4. The Leads panel gets a provider order for new leads, set by Collin (e.g. "Claude > GPT", or "Claude, then whatever's left"). A thread keeps the provider its lead started on: a running lead never switches, and a restarted lead or a sub-lead in that thread waits for that provider to have room | Collin: switching mid-feature is worse than waiting; the order applies only to new leads | user |
| D7 | Signing in: Sign in on a machine starts a login session in tmux on that machine running the CLI's own login (`claude auth login` / `codex login --device-auth`) with the account's folder set; the app opens its terminal page on it; the account turns green when that machine reports it logged in | Works from the phone with pages that already exist | user |
| D8 | Refines D7: Sign in shows a sign-in card, not the terminal. Claude: an "Open sign-in link" button (the OAuth URL read from the login session's output) and a box to paste the code back, which the app types into the session. Codex: a link to auth.openai.com/codex/device and the device code with a copy button. The terminal page stays as a fallback link | Collin: maximum convenience, a link and a code, nothing else | user |
| D9 | Usage comes only from running sessions: Codex's `rate_limits` in its rollout transcript, Claude's `rate_limits` via a status-line command the service writes into each session's settings file. Each reading is stored per account with its time; idle accounts show their last reading "as of …"; an account never read shows "no reading yet" and the balancer treats it as full | Official, free, no terms risk; current whenever work runs | user |
| D10 | The provider bar weights each account by its plan size: Claude Pro 1, Max 5x 5, Max 20x 20; ChatGPT Plus 1, Pro 6 (Codex plan names map by `plan_type`); Collin can override an account's weight | Answers the proposal's open question with the published multipliers; overridable | defaulted |
| D11 | The style preview and `model.sh`'s Codex cache keep using the `default` account; the Codex preflight runs against the chosen account's folder at session start | Only the preflight protects a session's login; the others are account-independent | defaulted |
| D12 | "Notify below 25%" is shown in the app (an amber line on the Usage bar and a dot on Settings in the nav), not a phone push: the app has no push path today (no notification code in `viewer/app/`) | Push notifications are their own feature | defaulted |
| D13 | Several Claude and ChatGPT accounts are allowed; adding a second Claude account shows a one-line warning about Anthropic's consumer terms before it saves | Collin's accounts, Collin's risk; the warning keeps it visible | user |
| D14 | A start with no provider that has room is held by the hub as a `waiting` session and started when room appears; a running session that hits its limit is never moved: the hub marks its account full until the reset and queues "Continue." to it once the reset passes | Agents have no timer; Collin's "we'll just wait" (D6) needs something to do the waiting | defaulted |
| D15 | Workers and other agents follow a worker order set in Settings, default GPT then Claude; Save Claude for leads defaults on | The proposal's order with the two providers in scope; editable like the lead order | defaulted |

## Spec

Read `MAP.md` first: it traces a session from start to transcript with every pointer used
below. Decision numbers (D1…) refer to the Decision Log.

### Scope
- Providers: **Claude** (Claude Code CLI, `cli: claude`) and **GPT** (Codex CLI,
  `cli: codex`), any number of subscription accounts each (D2, D13).
- In: the provider adapter, accounts and login folders, sign-in from the app, usage
  readings, the balancer, the Accounts and Usage settings panels, the lead and worker
  orders, Save Claude for leads, the margin, waiting.
- Non-goals: Google, OpenRouter or any third CLI; pay-as-you-go keys and dollar caps; rules
  by kind of work (UI prefers Claude, Critical cross-checks, suggested rules); asides;
  phone push notifications (D12); polling undocumented usage endpoints (D9); moving a
  running session to another account or provider (D6, D14); deleting login folders from
  disk.

### 1. The provider adapter
One module per CLI on each side, so a later CLI is added by writing two files and adding
one entry to each registry. Every `cli === 'claude'` / codex branch listed in MAP.md "Every
place that assumes…" under the hub, machine service and hooks moves behind these, except
the protocol text, the installer, `seen/` and `codex/model.sh`'s grammar (which keeps
`claude|gpt` as provider names).

**Machine side** — `machine/adapters/claude.js`, `machine/adapters/codex.js`, registry
`machine/adapters/index.js` keyed by `cli`. Each exports:

| Member | What it does | Today at |
|---|---|---|
| `provider` | `'claude'` or `'gpt'` | `viewer/app/sessions.js:29` |
| `loginEnv(dir)` | `{CLAUDE_CONFIG_DIR: dir}` / `{CODEX_HOME: dir}`; `{}` when `dir` is null (the default account) | new |
| `command(input, session, worktree)` | `{argv, settingsPath?, settings?}`; Claude's settings file also carries `statusLine` (§4) | `machine/service.js:266-290` |
| `firstMessage(input, rolePrompt)` | the text typed once ready | `service.js:311-315` |
| `readyText(session, pane)`, `answerPrompts(session, pane)` | ready test and the prompts the service answers itself | `service.js:326-353`, `386` |
| `findTranscript(session, dir)` | locate the session's transcript under the account's folder, or the CLI's usual folder for `default` | `service.js:538-541`, `607-613`, `622-638` |
| `hookEvent(raw)` | translate a hook payload to `{type: 'turn-ended' \| 'prompt' \| 'limit-hit', …}` or null | `machine/lib/hook-post.js:16-24` |
| `usageFrom(source)` | extract a usage reading (§4) from a transcript line or status-line payload, or null | new |
| `loginCommand(dir)` | argv for the CLI's own login: `claude auth login` / `codex login --device-auth` | new |
| `parseLogin(pane)` | `{url, code, wantsCode}` or null from the login session's screen | new |
| `loginStatus(dir)` | `{logged_in: boolean}`: Claude `claude auth status` with `loginEnv(dir)` (`service.js:709-712`); Codex `codex login status` with `loginEnv(dir)` | `service.js:703-714` |
| `seed(dir)` | prepare a fresh folder (§2) | new |

`machine/hook.sh` keeps one line per CLI to read its payload (stdin for Claude, last argv
for Codex, `hook.sh:16-28`) and hands it to `hook-post.js`, which calls the adapter's
`hookEvent`. Session recovery that guesses the CLI from pane text (`service.js:172`) reads
the persisted `session.cli` instead when present.

**Hub side** — `viewer/app/providers.js`: `{claude: {cli: 'claude', label: 'Claude'}, gpt:
{cli: 'codex', label: 'GPT'}}` plus `providerOf(cli)` and `cliOf(provider)`, used by
`sessions.js`, `ready.js`, `threads.js` and `routes.js:52-55`. `viewer/app/chat.js:90-218`
picks its transcript parser from a map keyed by `cli` instead of "Claude or else Codex",
and an unknown `cli` renders no messages with a one-line notice instead of being parsed as
Codex.

### 2. Accounts and login folders (D5)
- Hub `settings.json` gains `accounts: [{id, provider, name, plan, weight, paused}]`.
  `id` is `default-claude`, `default-gpt` for the built-ins, else a short slug generated
  on add (`[a-z0-9-]`, unique). Add `accounts` and the balancing keys (§5) to
  `defaults()` and `normalize()` in `viewer/app/settings.js` (unknown keys are dropped at
  `settings.js:150-161`). Normalize always keeps exactly one `default-<provider>` per
  provider; it can be renamed or paused, not removed.
- `plan` is one of `pro | max5 | max20` (Claude) or `plus | pro` (GPT) or `unknown`.
  `weight` defaults from plan (D10): Claude pro 1, max5 5, max20 20; GPT plus 1, pro 6;
  unknown 1. A reading's Codex `plan_type` is shown beside the chosen plan when they
  differ; it never overwrites Collin's choice.
- Folder on each machine: `default-*` → the CLI's usual folder (no env var set, behaviour
  exactly as today). Any other account → `~/.wheelchair/accounts/<id>/` in the machine
  service user's home. The hub sends `account: {id, dir}` in the start request, `dir: null`
  for a default. The service never deletes an account folder.
- `seed(dir)` on first use of a non-default folder: create it mode 0700; symlink the user's
  `CLAUDE.md` (Claude) or `AGENTS.md` (Codex) from the usual folder if it exists; for Codex
  write `config.toml` containing `cli_auth_credentials_store = "file"` if absent.
- The service sets `loginEnv(dir)` in the `env` prefix (`service.js:307`) and finds the
  transcript with `findTranscript(session, dir)`. These two ship in the same task: either
  alone leaves the thread chat empty (MAP.md "Accounts").
- Session records (hub `threads/<id>.json` and the service's) gain `account` (the id).
- `/v1/status` gains `accounts: [{id, cli, logged_in}]`: the two defaults always, plus each
  folder under `~/.wheelchair/accounts/` (the folder name is the id; the CLI is stored in a
  `wheelchair-account.json` written at seed time). The existing per-CLI `logged_in` stays,
  meaning "the default account is logged in".
- **Ready check** (`viewer/app/ready.js:26-54`): a provider is ready on a machine when at
  least one of its unpaused accounts reports `logged_in` there. The missing-items text names
  the provider, not an account.
- **Account removed** in Settings: dropped from the list and from balancing; running
  sessions on it continue; its folder stays on disk.
- **Second Claude account warning** (D13): saving an add that would make two or more Claude
  accounts first shows, once per add: "Anthropic's terms say plan limits assume ordinary,
  individual use. Several Claude accounts behind one setup may get flagged." with Add anyway
  / Cancel.

### 3. Signing in (D7, D8)
- Accounts panel, per account and per known machine (`machines.json`,
  `viewer/app/state.js:146-149`): state signed in / signed out / unknown (machine
  unreachable), and **Sign in** when not signed in.
- Sign in → hub `POST /accounts/:id/signin {machine}` → service `POST /v1/logins {account,
  cli, dir}`: seeds the folder, starts tmux session `wc-login-<id>` (replacing an existing
  one of that name) running `loginCommand(dir)` with `loginEnv(dir)`. The service exposes
  `GET /v1/logins/:id` → `{state: 'starting'|'waiting'|'done'|'failed', url, code,
  wantsCode, logged_in}` built from `parseLogin(pane)` and, after the CLI exits,
  `loginStatus(dir)`; and `POST /v1/logins/:id/code {code}`, which types the code and Enter.
  The hub proxies both at `GET /accounts/:id/signin/:machine` and `POST
  /accounts/:id/signin/:machine/code`.
- The sign-in card polls every 2 s. Claude: "Open sign-in link" button (opens `url` in a new
  tab) and a paste box shown while `wantsCode`. Codex: a link to `url` (normally
  `https://auth.openai.com/codex/device`) and `code` with a copy button. On `done` with
  `logged_in` true the card turns green and closes after 2 s. On `failed`, or no `url`
  within 30 s, it says "Couldn't read the sign-in screen" and shows **Open terminal**.
- **Open terminal** is always available as a small link. The terminal page
  (`viewer/pages/terminal.js:7`) today addresses thread sessions under
  `/wheelchair/api/sessions/<name>`; extend it to accept a login session (`?login=<id>&machine=<m>`)
  backed by pane and keys proxies for `wc-login-<id>`. Login sessions are not thread
  sessions and never appear on the Sessions page.

### 4. Usage readings (D9)
- A **reading** is `{account, machine, at, five_hour: {used, resets_at} | null, week:
  {used, resets_at} | null, plan_type?, limited_until?}`, `used` in percent 0–100,
  times in ISO.
- **Codex:** each rollout line with `payload.rate_limits` (event `token_count`) gives a
  reading. Map by `window_minutes`: 300 → `five_hour`, 10080 → `week`, from `primary` and
  `secondary` whichever carries it; `resets_at` is Unix seconds. `rate_limit_reached_type`
  non-null → `limited_until` = the matching window's `resets_at`. The service already
  locates and copies the rollout (`service.js:502-526`, `622-638`); it scans new lines on
  each turn end.
- **Claude:** the per-session settings file gets `statusLine: {type: 'command', command:
  "<root>/machine/statusline.sh claude <session name>"}`. The script reads the status-line
  JSON from stdin, prints one short line (model and 5-hour percent) and posts
  `rate_limits.five_hour|seven_day {used_percentage, resets_at}` to the service like
  `hook-post.js` does (same spool fallback), at most once a minute per session. The
  `Stop`-type hook list gains `StopFailure`; `hookEvent` maps `error_type: 'rate_limit'` to
  `limit-hit`, `limited_until` = the latest reading's earliest `resets_at` with
  `used >= 100`, else now + 1 h.
- The service forwards readings to the hub (`POST` to the hub like turn events). The hub
  keeps the latest reading per account in `usage.json` in its state dir (one writer queue,
  as `State.updateSettings`, `state.js:176-194`).
- A reading older than its window's `resets_at` is treated as 0% used for that window.
- An account with no reading shows "no reading yet" and counts as having room (§5).

### 5. The balancer
One function, `viewer/app/balancer.js` `choose(hub, thread, role, constraints)` → `{provider,
account}` or `{wait: {until, reason}}`, called by `startSession` (`sessions.js:72`) before
`resolveModel`; `input.cli` is replaced by `cliOf(provider)`.

**Settings** (hub `settings.json`, edited on the Usage panel unless noted):
- `lead_order`: ordered providers, optionally ending in `any` ("then whatever's left").
  Default `['claude', 'any']`. Edited on the Leads panel next to each provider's lead model
  (`viewer/pages/settings.js:265-270`) (D6).
- `worker_order`: ordered providers. Default `['gpt', 'claude']` (D15).
- `within`: `soonest | spread | one` (default `soonest`).
- `leave`: percent left for Collin per account, default 10. `notify_below`: default 25.
- `save_claude_for_leads`: default true. `margin`: default 5.

**Room.** An account has room when: not paused; logged in on the thread's machine; no
`limited_until` in the future; and for each window with a reading, `used < 100 − leave`.
No reading → room.

**Within a provider** (`within`):
- `soonest`: the account with room whose `week.resets_at` is earliest (no reading sorts
  last); ties by most room left.
- `spread`: the account with the most weekly room left (weight-normalised), ties by fewest
  live sessions.
- `one`: the account most recently chosen while it still has room, else `soonest`.

**By role:**
- **Lead, new thread** (no `thread.provider` yet): first provider in `lead_order` with an
  account that has room; `any` means every provider not yet listed, in `worker_order`
  order. Record `thread.provider`. None → wait.
- **Lead restart and sub-lead:** `thread.provider` only, any of its accounts. None → wait
  (D6). Threads created before this change: `thread.provider = providerOf(thread.cli)`.
- **Worker, mapper, reviewer, verifier:** `worker_order`, skipping providers excluded by
  constraints, by Not used at the resolved slot (`model.sh` exit 3, `sessions.js:36`), and
  by Save Claude/margin below. None → wait.
- **Save Claude for leads** on: Claude is tried for these roles only after every other
  provider in `worker_order` has no room, whatever its position.
- **Margin:** for these roles Claude is skipped entirely when its forecast (below) puts the
  provider's combined week below `margin` percent at the earliest account's reset. Leads
  ignore the margin.
- **Constraints** from `wc.js`: `--not-provider <claude|gpt>`, `--not-same-as <session
  name>` (resolved from that session's record in this thread; unknown name → 400). When the
  constraint leaves no provider at all (e.g. one provider installed), the hub ignores it and
  says so in the start response's `note`, matching today's "one family: use it for both".

**Waiting** (D14): a start that must wait creates the session record with
`status: 'waiting', waiting_until, waiting_reason` and returns it (HTTP 202) instead of
failing; `wc.js` prints "waiting for room until <time>". The hub re-runs `choose` for
waiting sessions every 60 s and on every new reading, and starts the session when it gets
an account. A lead that is waiting shows on the thread as a `needs`-style line from the app:
"Waiting for Claude to refill, about <time>". `session stop` on a waiting session cancels it.

**A running session that hits its limit** (`limit-hit`, or a Codex reading with
`limited_until`): the hub stores `limited_until` on the account's reading and on the
session; the account has no room until then. When `limited_until` passes and the session is
still live and idle, the hub queues the message `Continue.` to it (the existing queue,
`sessions.js`). It is never moved.

**Forecast** (per provider, for the bar, the amber line and the margin): combined week left
= Σ(weight × (100 − week.used)) / Σ(weight × 100) over unpaused accounts with a week
reading; accounts with none count as 100% left. Pace = Σ(weight × week.used) / hours since
the earliest window start (`resets_at − 7 d`). Runs out at = now + left / pace. Amber when
that is before the earliest `week.resets_at` among the provider's accounts. Pace zero →
never amber.

### 6. Settings panels
`viewer/pages/settings.js`: add `accounts` and `usage` to `SECTIONS` (`:8`), first and
second, a branch each in `renderPanel` (`:682-688`). Match the mocks
`docs/proposals/app-shell/design/SettingsAccounts.dc.html` and `SettingsUsage.dc.html`, minus
anything for out-of-scope providers or pay-as-you-go.

**Accounts** — grouped by provider. Each account card: name, plan (and weight), per machine
signed in / out / unknown with Sign in, this 5-hour window and this week (used, reset,
"as of …"), "in use · N agents" (live sessions with that `account`), Pause/Resume, Rename,
Change plan, Remove (not on defaults). **Add account**: provider → name → plan → saved
(warning per §2) → offers Sign in on each machine.

**Usage and balancing** — one bar per provider: combined week left (§5), amber with one line
when the forecast runs out before the first refill ("runs out Sunday night, before the first
refill Monday 14:00"), and a line when below `notify_below`. Tapping a provider opens a table
of its accounts: 5-hour used and reset, week used, full reset, which is next and why ("next:
refills soonest", "skipped: paused", "skipped: signed out on beelink", "skipped: limit until
14:00"). Below: the balancing settings of §5 except `lead_order`.

**Nav dot** (D12): Settings in the app nav shows a dot while any provider is amber or below
`notify_below`; it clears when Collin opens the Usage panel, and reappears only for a
provider newly crossing in a later week.

**Live data**: the page fetches `GET /usage` on opening the Accounts or Usage panel and every
30 s while one is shown (the page has no timer today, `:699-708`).

### 7. Hub routes
Added to `viewer/app/routes.js` and documented in `viewer/app/API.md`:
- `GET /settings` also returns `accounts` and the §5 keys.
- `POST /settings/accounts {provider, name, plan}` → the account; `PUT
  /settings/accounts/:id {name?, plan?, weight?, paused?}`; `DELETE /settings/accounts/:id`
  (400 for a default).
- `PUT /settings/balancing {lead_order?, worker_order?, within?, leave?, notify_below?,
  save_claude_for_leads?, margin?}` with validation (orders contain only known providers and
  `any` only last in `lead_order`; percents 0–100).
- `GET /usage` → per provider `{left, amber, runs_out_at, first_refill, below_notify,
  accounts: [{id, name, plan, weight, paused, machines: {<m>: signed_in|signed_out|unknown},
  reading, next, reason, live_sessions}]}`.
- Sign-in routes of §3.
- `POST /sessions` (what `wc.js session start` calls) accepts `not_provider`, `not_same_as`;
  `cli` is ignored if sent, so old briefs still work.

### 8. Thread creation and wc.js
- New-thread form: the CLI picker is removed; `threads.js:44-47` no longer requires `cli`;
  the lead's provider comes from §5 and is stored as `thread.provider`, and `thread.cli` is
  set from it for code that still reads it. Stubs inherit nothing (`threads.js:75`): a stub's
  lead is a new lead.
- `wc.js session start`: `--cli` optional and ignored with a one-line stderr notice; adds
  `--not-provider` and `--not-same-as`.

### 9. Protocol text
- `protocol/app/lead.md`: the start command loses `--cli`; "start one of the two reviewers
  and the verifier on the other family from yours" becomes `--not-same-as <your session
  name>` on the second reviewer and on the verifier. "A CLI is installed when `command -v`…"
  stays as background; the hub applies it.
- `protocol/app/sub-lead.md:73`: same change for workers and its verifier.
- `protocol/app/cards.md`: no change.

### Edge cases
- Only the default accounts exist → every start lands on today's folders; behaviour matches
  today apart from the provider being chosen by the order (with defaults: leads Claude,
  others GPT then Claude).
- Machine unreachable → its accounts show unknown and do not count as logged in there.
- A Codex account whose login expired → the session-start preflight (`sessions.js:75-86`)
  runs with that account's folder (D11); failure marks that account signed out on that
  machine and the balancer tries the next account once before failing.
- The style preview and `model.sh`'s Codex cache keep using the default accounts (D11).
- Two machines, account signed in on only one → only threads on that machine can use it.
- Clock skew between machines is ignored; `resets_at` values come from the providers.

### Validation
- `bash machine/test/run.sh` — add: start with `account.dir` sets the right env var in the
  tmux command; transcript found under the account folder for both CLIs; default account
  sets no env var; `/v1/status` lists account folders; login session start, `parseLogin` on
  captured sample screens for both CLIs, code typing; Codex `usageFrom` on a rollout line
  with `rate_limits`; Claude status-line script posting a reading; `StopFailure` →
  `limit-hit`.
- `node --test viewer/test/*.test.js` — add a table-driven balancer test: soonest / spread /
  one; leave share; paused and signed-out accounts; Save Claude for leads; margin skips
  workers but not leads; lead order with `any`; restart pinned to `thread.provider`; waiting
  and resuming on a new reading; `--not-same-as` and its one-provider fallback; forecast and
  amber; settings normalize keeps one default per provider and drops nothing new; routes'
  validation.
- `npm --prefix viewer run test:browser` — add: Accounts panel renders accounts and the sign-in
  card (link, paste box, Codex code) against a fake service; Usage panel renders bars, amber
  line and the account table; second-Claude warning; CLI picker gone from the new-thread form.
- `bash codex/test/run.sh`, `bash install/test/run.sh`, `bash sensitivity/test/run.sh`,
  `bash seen/test/run.sh` still pass.
- Never start a viewer by hand (AGENTS.md "Verification"); use the suites' helpers.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-15

**Lanes:** Claude (intent lens); Codex (mechanics lens); cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-15, research (web, not code). Claude: statusline JSON `rate_limits.five_hour|seven_day`
  {used_percentage, resets_at}, Pro/Max only, after first response
  (code.claude.com/docs/en/statusline); `GET api.anthropic.com/api/oauth/usage` with OAuth
  token + `anthropic-beta: oauth-2025-04-20`, undocumented; limit hit fires `StopFailure`
  hook `error_type: rate_limit` and a synthetic transcript turn `"error":"rate_limit"`;
  weekly anchoring unconfirmed. Codex: `/status`; undocumented
  `GET chatgpt.com/backend-api/wham/usage` from `auth.json`; weekly period starts at first
  request after reset; set `cli_auth_credentials_store = "file"` per `CODEX_HOME`;
  headless login `codex login --device-auth`. Gemini CLI: subscriber access ended
  2026-06-18 (Antigravity CLI replaces it; `GEMINI_CLI_HOME` for the old CLI). OpenRouter:
  `GET openrouter.ai/api/v1/key` gives limit, remaining, usage; Claude Code works against it
  via `ANTHROPIC_BASE_URL=https://openrouter.ai/api`.
