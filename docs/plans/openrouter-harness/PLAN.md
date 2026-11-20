---
slug: openrouter-harness
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# OpenRouter models as wheelchair agents

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md`.

## Open Questions

### Q1: Which program runs OpenRouter agents: Pi or OpenCode?
- **Context:** Research 2026-11-19 (docs only, nothing run). Pi (`earendil-works/pi`, v1.5.x, single Node process): documented `agent_settled` extension event; JSONL transcript under `~/.pi/agent/sessions/`, file chosen by `--session-id`; per-message usage and cost; `auth.json` keyed by provider; built-in OpenRouter via `OPENROUTER_API_KEY`; no per-tool approval prompts, only a project-trust prompt skipped by `--approve`; needs tmux `extended-keys`. OpenCode (`anomalyco/opencode`, mid v1→v2 rewrite, client/server on Bun): transcript in SQLite with a schema that changed between versions; v2 turn-end event undocumented; TUI launch flags and auth path unconfirmed.
- **Options:** Pi; OpenCode.
- **Recommendation:** Pi.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Pi runs tools with no approval prompt | How other harnesses are launched (approval mode) and whether Pi's behaviour matches | no | |
| 2 | Kimi limits model ids to one slash | OpenRouter ids may be `vendor/model` or `openrouter/vendor/model`; check the hub, settings page and `codex/model.sh` rules | no | |
| 3 | Roles | Which roles may run on the new provider, matching how Kimi is treated | no | |
| 4 | Key handling | Where the key lives (Pi `auth.json` vs env) and how wheelchair checks it offline without reading it into logs | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode two-part | User's choice: build for day-to-day use first, harden in a follow-up | user |

## Spec

_Grows as decisions land._

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
