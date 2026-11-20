---
slug: openrouter-harness
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# OpenRouter models as wheelchair agents

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md`.

## Open Questions

### Q3: Show what OpenRouter agents cost?
- **Context:** OpenRouter is pay per use; Pi records cost per reply. Today's usage screen shows subscription limits (`viewer/app/usage.js`), and Kimi shows none.
- **Options:** Show spend per thread/agent now; show nothing now and defer it.
- **Recommendation:** Defer (two-part).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Pi runs tools with no approval prompt | How other harnesses are launched | no | Settled: Decision 3 |
| 2 | Kimi limits model ids to one slash | OpenRouter id format | no | Settled: Decision 5 |
| 3 | Roles | Which roles may use the provider | no | Settled: Decision 4 |
| 4 | Key handling | Where the key lives and how it is checked | yes | Promoted to Q2 |
| 5 | Review families | OpenRouter can serve Claude or GPT models; cross-family review counts providers | no | Settled: Decision 6 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode two-part | User's choice: build for day-to-day use first, harden in a follow-up | user |
| 2 | Build on Pi (`earendil-works/pi`, `@earendil-works/pi-coding-agent`), not OpenCode | Documented turn-end event, JSONL transcript chosen by `--session-id`, per-message usage, plain auth file; OpenCode's v2 transcript and turn-end are undocumented | user |
| 3 | Pi agents run without approval prompts, like Claude `auto`, Kimi and Antigravity today (`machine/adapters/claude.js:74`, `kimi.js:128`, `agy.js:67`). Always pass `--approve`. Reviewers get Pi's read-only tool set if Pi offers one (checked in the dry run); if not, same as Kimi, which ignores role | Matches existing providers; Codex's sandbox is the only stricter one | defaulted |
| 4 | The new provider may fill every role Kimi can (lead, sub-lead, mapper, worker, reviewer, verifier), governed by the same Settings orders | Consistency with Kimi (`viewer/app/balancer.js:29-50`) | defaulted |
| 5 | Model ids accept OpenRouter's `vendor/model` form with an optional `:variant` suffix (e.g. `:free`), up to 64 characters, in the hub, Settings page and `codex/model.sh` | That is OpenRouter's id format | defaulted |
| 6 | The provider is named `openrouter` and counts as its own family for cross-family review, whatever model it serves | Simplest; a mismatch only matters when it serves the same family as the other reviewer | defaulted |
| 7 | The key is entered in the app: Settings offers sign-in for OpenRouter like other providers, opening Pi's own login (`/login openrouter`) in the login pane; status reads only whether `auth.json` has an `openrouter` entry or `OPENROUTER_API_KEY` is set, never the key itself | User's choice; matches the other providers | user |

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
