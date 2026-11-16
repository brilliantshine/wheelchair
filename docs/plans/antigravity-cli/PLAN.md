---
slug: antigravity-cli
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-16
---

# Antigravity CLI as a third agent provider

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: How do we get a real `agy` to check against?
- **Context:** `agy` is not installed on this machine (MAP.md, "Public Antigravity evidence"). Turn-end detection, transcript parsing and the login screen parser can't be built safely from docs alone (IDEA.md Constraints).
- **Options:** (a) Collin installs `agy` here before building; the build starts with a live check task that captures real login, transcript and hook output as test fixtures. (b) Build from the docs only and validate later.
- **Recommendation:** (a).

### Q2: Which roles may run on Antigravity?
- **Context:** Settings keeps a provider order per role (`viewer/app/settings.js:171-208`).
- **Options:** every role, placed last in each order by default; or only workers, reviewers and verifiers.
- **Recommendation:** every role, last by default.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Docs say credentials live in a shared app dir and the OS keyring | Whether two Antigravity accounts can be kept apart on one machine (e.g. separate HOME) | no | |
| 2 | `protocol/app/lead.md:82-83` says Ready checks both families; `viewer/app/ready.js:39-56` checks only the thread's CLI | Fix the stale line while touching the protocol | no | |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Provider key `gemini`, CLI `agy`, shown as "Antigravity" | Provider keys name the model family (`claude`, `gpt`), CLIs name the binary | defaulted |
| 2 | Sign-in reuses the Settings sign-in card's link + pasted-code path that Claude uses | `agy` remote login is link then pasted code, same direction as Claude (`viewer/pages/settings.js:908-981`) | defaulted |
| 3 | With three families, cross-family review keeps two lanes; "the other family" means any family other than the first lane's, taken in role order | Keeps review cost the same; `both` generalises to "two or more families usable" | defaulted |
| 4 | No usage meter for Antigravity unless `agy` exposes limit windows; a rate-limit failure still marks the account limited | Limit windows are undocumented (MAP.md) | defaulted |
| 5 | Asides on Antigravity sessions use `agy -p --conversation` resume if it can fork; otherwise asides are unavailable on those sessions with a plain message | Headless resume is documented, fork is not | defaulted |

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
