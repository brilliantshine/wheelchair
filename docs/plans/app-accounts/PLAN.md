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

### Q1: Which providers does this thread build?
- **Context:** Multi-account Claude and Codex needs the adapter, login folders per session,
  usage reading and the balancer. Google means adding Gemini CLI as a third CLI; OpenRouter
  has no CLI, so it needs a host coding tool. A third CLI touches about 40 places
  (MAP.md, "Every place that assumes…").
- **Options:** (a) Claude and Codex with several accounts, adapter shaped so a third CLI
  plugs in later; (b) also Google via Gemini CLI; (c) also Google and OpenRouter.
- **Recommendation:** (a). Gets the value (more room, balancing, visibility) on the two
  CLIs already in use; a later thread adds a provider by filling in the adapter.

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

### Q6: How usage is read per CLI (pending research), and what to show when it can't be

### Q7: Weighting the combined bar across plans of different size

### Q8: Terms of service for several personal subscriptions in one automated setup

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

## Spec

(grows as decisions land)

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
