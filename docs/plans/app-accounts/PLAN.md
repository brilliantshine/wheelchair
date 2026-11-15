---
slug: app-accounts
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Accounts, usage and balancing

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

### Q6: How usage is read per CLI, and what to show when it can't be
- **Checked locally 2026-11-15:** Codex rollout transcripts already carry
  `rate_limits {primary|secondary: {used_percent, window_minutes, resets_at}, plan_type}`
  (`~/.codex/sessions/.../rollout-*.jsonl`). Claude's per-session settings file
  (`service.js:274`) can carry a `statusLine` command, which receives `rate_limits`.
- **Context:** see Log, research 2026-11-15. Claude: official `rate_limits` in statusline JSON
  (live session only); undocumented OAuth usage endpoint from the login folder. Codex:
  `/status` in a session; undocumented `wham/usage` endpoint from `auth.json`.

### Q7: Weighting the combined bar across plans of different size

### Q8: Terms of service for several personal subscriptions in one automated setup
- **Context:** neither Anthropic nor OpenAI bans one person holding several paid accounts.
  Anthropic's consumer terms bar "automated or non-human means" except where permitted,
  and limits "assume ordinary, individual usage"; third-party OAuth clients were banned
  Feb 2026. Running the real CLI binary is not addressed. Risk is Collin's to accept.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | MAP.md | A fresh login folder lacks the user's CLAUDE.md/AGENTS.md, trust records and may show first-run screens that break the ready test | no | |
| W2 | MAP.md | Style preview, Codex preflight and `model.sh` cache all read the service's own login | no | |

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

## Spec

### Scope
- Providers: Claude (Claude Code CLI) and GPT (Codex CLI), any number of subscription
  accounts each. No third CLI, no pay-as-you-go keys (D2).
- Defaults (D1): soonest refill first within a provider; notify below 25% once per provider
  per week; leave 10% of each account; Claude margin 5%.

### Who picks (D3)
- Every session start (lead, sub-lead, mapper, reviewer, verifier, worker) goes through one
  hub balancer that returns `{provider, account}` before `resolveModel`
  (`viewer/app/sessions.js:16-39`) and overrides `input.cli` (`sessions.js:74`).
- `wc.js session start` drops `--cli` as a choice. It gains `--not-provider <claude|gpt>` and
  `--not-same-as <session name>` for reviewers and verifiers; the hub resolves the named
  session's provider from its record. A constraint that leaves no provider with room is
  refused with the reason, or waits (see open questions).
- `protocol/app/lead.md:47` and `protocol/app/sub-lead.md:73` change to match: cross-family
  rules are expressed with the new flags.

### Leads (D6, supersedes D4)
- Settings, Leads panel: an ordered provider list for new leads, plus "then whatever's
  left" as a final entry option. Stored in hub `settings.json` (`lead_order`). Default:
  `[claude, any]`. Each provider keeps its own lead model (`viewer/pages/settings.js:265-270`).
- A new thread's lead: first provider in the order with an account that has room (after
  the leave-for-you share). The new-thread CLI picker is removed
  (`viewer/app/threads.js:46`, `58`). The chosen provider is recorded on the thread.
- After that the thread is pinned to that provider: a restarted lead and the sub-lead use
  it (any of its accounts), and if none has room they wait rather than switch. The thread
  shows that it is waiting and until when.
- If no provider in the order has room, a new lead waits.

### Accounts (D5)
- Hub `settings.json` gains `accounts: [{id, provider, name, plan, paused}]`
  (`viewer/app/settings.js` `defaults()` and `normalize()`, or it is dropped:
  `settings.js:150-161`).
- Login folder on every machine: `~/.wheelchair/accounts/<id>/`, except the built-in
  `default` account of each provider, which uses the CLI's usual folder (no env set), so
  today's single-login setup behaves exactly as now.
- Start request gains `account: {id, dir}`; the service sets `CLAUDE_CONFIG_DIR` or
  `CODEX_HOME` in the env prefix (`machine/service.js:307`) and looks for that session's
  transcript in that folder (`service.js:538`, `610-611`, `622-638`). Both changes ship
  together (MAP.md, "Accounts").
- `/v1/status` reports, per account folder present on that machine, `{id, logged_in}`; the
  Ready check passes for a provider when at least one of its accounts is logged in on the
  thread's machine (`viewer/app/ready.js:26-54`).

### Signing in (D7)
- Accounts screen, per account and machine: **Sign in**. The hub asks that machine's service
  to start a tmux session `wc-login-<account id>` in the account's folder (created if
  missing) running `claude auth login` with `CLAUDE_CONFIG_DIR`, or `codex login
  --device-auth` with `CODEX_HOME` (and `cli_auth_credentials_store = "file"` in that
  folder's `config.toml`, so the login lands in the folder, not a shared keyring).
- Sign-in card (D8): the hub reads the login session's pane (the existing pane route) until
  it finds the sign-in URL and, for Codex, the device code. Claude: "Open sign-in link"
  button plus a paste box; submitting sends the code and Enter to the session (existing
  keys route). Codex: link to `https://auth.openai.com/codex/device` and the code with a
  copy button. If no URL appears within 30 s, or the text can't be parsed, the card says so
  and offers "Open terminal" (`viewer/pages/terminal.js`), which also stays available as a
  small link throughout. When the CLI exits the session ends; the
  account's per-machine state comes from `/v1/status` on the next refresh.
- Seeding a new folder (Watch W1): before first use the service links the user's
  `CLAUDE.md` / `AGENTS.md` from the CLI's usual folder into the account folder, so agents
  get the same global instructions.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

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
