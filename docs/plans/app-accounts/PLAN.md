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

### Q2: Who chooses the provider and account for a session: the app, or the lead/sub-lead?
- **Context:** Today agents pass `--cli` (MAP.md, "Usage and balancing"). Balancing by rule
  means the hub decides, before `resolveModel` (`viewer/app/sessions.js:16-39`).
- **Recommendation:** the hub decides for every session; `--cli` becomes a request the hub
  may honour only when a rule allows (e.g. "other family from mine" for reviewers).

### Q3: Leads on Claude only, against the shipped Leads panel
- **Context:** Settings lets each provider have a lead model
  (`viewer/pages/settings.js:265-270`); the proposal says leads run on Claude Opus only and
  wait when Claude is out.
- **Recommendation:** to decide with Collin.

### Q4: Where the account list lives, hub or each machine
- **Context:** Login folders are machine-local; the hub holds settings (MAP.md, "Accounts").

### Q5: How signing in works from the app
- **Context:** Nothing runs `claude auth login` / `codex login`; the mock's Sign in button
  has no code path.

### Q6: How usage is read per CLI, and what to show when it can't be
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

## Spec

### Scope
- Providers: Claude (Claude Code CLI) and GPT (Codex CLI), any number of subscription
  accounts each. No third CLI, no pay-as-you-go keys (D2).
- Defaults (D1): soonest refill first within a provider; notify below 25% once per provider
  per week; leave 10% of each account; Claude margin 5%.

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
