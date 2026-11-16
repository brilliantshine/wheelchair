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

### Q2: Which roles may run on Antigravity?
- **Context:** Settings keeps a provider order per role (`viewer/app/settings.js:171-208`).
- **Options:** every role, placed last in each order by default; or only workers, reviewers and verifiers.
- **Recommendation:** every role, last by default.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Docs say credentials live in a shared app dir and the OS keyring | Whether two Antigravity accounts can be kept apart on one machine (e.g. separate HOME) | no | |
| 3 | `agy` self-updates in the background on every run (installer notice) | Login screen or transcript format can change under us; parsers should fail loudly, not silently | no | |
| 2 | `protocol/app/lead.md:82-83` says Ready checks both families; `viewer/app/ready.js:39-56` checks only the thread's CLI | Fix the stale line while touching the protocol | no | |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Provider key `gemini`, CLI `agy`, shown as "Antigravity" | Provider keys name the model family (`claude`, `gpt`), CLIs name the binary | defaulted |
| 2 | Sign-in reuses the Settings sign-in card's link + pasted-code path that Claude uses | `agy` remote login is link then pasted code, same direction as Claude (`viewer/pages/settings.js:908-981`) | defaulted |
| 3 | With three families, cross-family review keeps two lanes; "the other family" means any family other than the first lane's, taken in role order | Keeps review cost the same; `both` generalises to "two or more families usable" | defaulted |
| 4 | No usage meter for Antigravity unless `agy` exposes limit windows; a rate-limit failure still marks the account limited | Limit windows are undocumented (MAP.md) | defaulted |
| 5 | Asides on Antigravity sessions use `agy -p --conversation` resume if it can fork; otherwise asides are unavailable on those sessions with a plain message | Headless resume is documented, fork is not | defaulted |
| 6 | `agy` 1.5.9 installed on this machine at `/home/collin/.local/bin/agy` via Google's installer (no root needed); the build starts with a live check task that captures real login, transcript and hook output as fixtures | Docs leave these unspecified | user |

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

- 2026-11-16: installed agy 1.5.9 (`~/.local/bin`, PATH line appended to `~/.profile`). Help shows `-p`, `--output-format stream-json`, `--conversation`, `--dangerously-skip-permissions`, `--mode`, `--model`, `--effort`, `models` and `acp` subcommands.
