---
slug: openrouter-harness
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# OpenRouter models as wheelchair agents

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md`.

## Open Questions

_None open; more being prepared from the Watch List._

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
| 2 | Build on Pi (`earendil-works/pi`, `@earendil-works/pi-coding-agent`), not OpenCode | Documented turn-end event, JSONL transcript chosen by `--session-id`, per-message usage, plain auth file; OpenCode's v2 transcript and turn-end are undocumented | user |

## Spec

### Harness

The new provider runs the Pi coding agent (`pi`, from `earendil-works/pi`) with Pi's built-in
`openrouter` provider. Facts from Pi's docs (2026-11-19, unverified by a run; the first
build task confirms them with a dry run and records any difference in the Log):

- Launch: `pi [message]` in the session's working directory; `--provider`, `--model`,
  `--session-id <uuid>`, `--approve` (skips the project-trust prompt).
- Turn end: an extension (global `~/.pi/agent/extensions/`, or `-e <file>`) can listen for
  `agent_settled`.
- Transcript: `~/.pi/agent/sessions/--<cwd>--/<timestamp>_<uuid>.jsonl`; header line
  `type: session`, then `type: message` lines; assistant messages carry `usage` and `cost`.
- Credentials: `~/.pi/agent/auth.json` keyed by provider, or `OPENROUTER_API_KEY`.
- tmux needs `extended-keys` on for Pi's Enter handling.

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
